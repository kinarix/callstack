use futures_util::{SinkExt, StreamExt};
use serde::Serialize;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter};
use tokio::sync::mpsc;
use tokio_tungstenite::tungstenite::http::Request as HttpRequest;
use tokio_tungstenite::tungstenite::Message;

/// Outgoing command sent from a Tauri command into the per-connection task.
enum WsCommand {
    Send(String),
    Close,
}

struct WsHandle {
    tx: mpsc::UnboundedSender<WsCommand>,
}

#[derive(Default)]
pub struct WsConnections(Arc<Mutex<HashMap<i64, WsHandle>>>);

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct WsMessageEvent {
    request_id: i64,
    direction: String, // "in" | "out" | "system"
    kind: String,      // "text" | "binary" | "ping" | "pong" | "close"
    data: String,
    size: i64,
    ts: i64,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct WsStatusEvent {
    request_id: i64,
    status: String, // "connecting" | "open" | "closed" | "error"
    detail: String,
}

fn now_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

fn emit_status(app: &AppHandle, request_id: i64, status: &str, detail: &str) {
    let _ = app.emit(
        "ws-status",
        WsStatusEvent {
            request_id,
            status: status.to_string(),
            detail: detail.to_string(),
        },
    );
}

fn emit_message(app: &AppHandle, request_id: i64, direction: &str, kind: &str, data: String, size: i64) {
    let _ = app.emit(
        "ws-message",
        WsMessageEvent {
            request_id,
            direction: direction.to_string(),
            kind: kind.to_string(),
            data,
            size,
            ts: now_ms(),
        },
    );
}

/// Build the upgrade request with custom handshake headers.
fn build_request(url: &str, headers: &[(String, String)]) -> Result<HttpRequest<()>, String> {
    use tokio_tungstenite::tungstenite::client::IntoClientRequest;
    let mut req = url.into_client_request().map_err(|e| e.to_string())?;
    for (k, v) in headers {
        if k.is_empty() {
            continue;
        }
        if let (Ok(name), Ok(val)) = (
            tokio_tungstenite::tungstenite::http::header::HeaderName::from_bytes(k.as_bytes()),
            tokio_tungstenite::tungstenite::http::HeaderValue::from_str(v),
        ) {
            req.headers_mut().insert(name, val);
        }
    }
    Ok(req)
}

#[tauri::command]
pub async fn ws_connect(
    app: AppHandle,
    conns: tauri::State<'_, WsConnections>,
    request_id: i64,
    url: String,
    headers: Vec<(String, String)>,
) -> Result<(), String> {
    {
        let map = conns.0.lock().map_err(|e| e.to_string())?;
        if map.contains_key(&request_id) {
            return Err("Already connected".to_string());
        }
    }

    let (tx, mut rx) = mpsc::unbounded_channel::<WsCommand>();
    {
        let mut map = conns.0.lock().map_err(|e| e.to_string())?;
        map.insert(request_id, WsHandle { tx });
    }

    emit_status(&app, request_id, "connecting", "");

    let req = match build_request(&url, &headers) {
        Ok(r) => r,
        Err(e) => {
            emit_status(&app, request_id, "error", &e);
            return Err(e);
        }
    };

    let app_task = app.clone();
    let registry = conns.0.clone();
    tokio::spawn(async move {
        let (ws_stream, _resp) = match tokio_tungstenite::connect_async(req).await {
            Ok(pair) => pair,
            Err(e) => {
                emit_status(&app_task, request_id, "error", &e.to_string());
                if let Ok(mut map) = registry.lock() {
                    map.remove(&request_id);
                }
                return;
            }
        };
        emit_status(&app_task, request_id, "open", "");
        let (mut write, mut read) = ws_stream.split();

        loop {
            tokio::select! {
                incoming = read.next() => {
                    match incoming {
                        Some(Ok(msg)) => match msg {
                            Message::Text(t) => {
                                let s = t.to_string();
                                let len = s.len() as i64;
                                emit_message(&app_task, request_id, "in", "text", s, len);
                            }
                            Message::Binary(b) => {
                                use base64::Engine;
                                let len = b.len() as i64;
                                let encoded = base64::engine::general_purpose::STANDARD.encode(&b);
                                emit_message(&app_task, request_id, "in", "binary", encoded, len);
                            }
                            Message::Ping(_) => emit_message(&app_task, request_id, "in", "ping", String::new(), 0),
                            Message::Pong(_) => emit_message(&app_task, request_id, "in", "pong", String::new(), 0),
                            Message::Close(_) => {
                                emit_message(&app_task, request_id, "in", "close", String::new(), 0);
                                break;
                            }
                            _ => {}
                        },
                        Some(Err(e)) => {
                            emit_status(&app_task, request_id, "error", &e.to_string());
                            break;
                        }
                        None => break,
                    }
                }
                cmd = rx.recv() => {
                    match cmd {
                        Some(WsCommand::Send(text)) => {
                            let len = text.len() as i64;
                            if write.send(Message::Text(text.clone().into())).await.is_err() {
                                break;
                            }
                            emit_message(&app_task, request_id, "out", "text", text, len);
                        }
                        Some(WsCommand::Close) | None => {
                            let _ = write.send(Message::Close(None)).await;
                            break;
                        }
                    }
                }
            }
        }

        if let Ok(mut map) = registry.lock() {
            map.remove(&request_id);
        }
        emit_status(&app_task, request_id, "closed", "");
    });

    Ok(())
}

#[tauri::command]
pub fn ws_send(conns: tauri::State<'_, WsConnections>, request_id: i64, text: String) -> Result<(), String> {
    let map = conns.0.lock().map_err(|e| e.to_string())?;
    match map.get(&request_id) {
        Some(h) => h.tx.send(WsCommand::Send(text)).map_err(|_| "Connection closed".to_string()),
        None => Err("Not connected".to_string()),
    }
}

#[tauri::command]
pub fn ws_close(conns: tauri::State<'_, WsConnections>, request_id: i64) -> Result<(), String> {
    let mut map = conns.0.lock().map_err(|e| e.to_string())?;
    if let Some(h) = map.remove(&request_id) {
        let _ = h.tx.send(WsCommand::Close);
    }
    Ok(())
}

#[tauri::command]
pub fn ws_list_open(conns: tauri::State<'_, WsConnections>) -> Result<Vec<i64>, String> {
    let map = conns.0.lock().map_err(|e| e.to_string())?;
    Ok(map.keys().copied().collect())
}
