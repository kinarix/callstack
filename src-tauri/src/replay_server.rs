use rusqlite::{params, Connection};
use serde::Serialize;
use std::collections::{HashMap, HashSet};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Condvar, Mutex};
use std::thread;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter};
use tiny_http::{Header, Response, Server};

use crate::database::{db_path, Database};

/// How long a paused request waits for a Step before auto-continuing.
const PAUSE_TIMEOUT: Duration = Duration::from_secs(60);

/// One replay registered on a port's shared server.
#[derive(Clone)]
struct Route {
    replay_id: i64,
    request_id: i64,
    method: String,             // expected method, uppercased
    expected_path: Option<String>, // None => method-only match (templated URL)
    hit_limit: i64,
    paused: Arc<AtomicBool>,    // when true, matched requests block until stepped
}

struct PortServer {
    stop: Arc<AtomicBool>,
    routes: Arc<Mutex<Vec<Route>>>,
}

/// Lets a paused server thread block until the UI sends a Step (resume).
#[derive(Default)]
struct ResumeGate {
    resumed: Mutex<HashSet<u64>>,
    cv: Condvar,
}

enum PauseOutcome {
    Stepped,
    Stopped,
    TimedOut,
}

fn wait_for_resume(gate: &ResumeGate, stop: &AtomicBool, pause_id: u64) -> PauseOutcome {
    let start = Instant::now();
    let mut resumed = gate.resumed.lock().unwrap();
    loop {
        if resumed.remove(&pause_id) {
            return PauseOutcome::Stepped;
        }
        if stop.load(Ordering::Relaxed) {
            return PauseOutcome::Stopped;
        }
        let elapsed = start.elapsed();
        if elapsed >= PAUSE_TIMEOUT {
            return PauseOutcome::TimedOut;
        }
        // Cap each wait so the stop flag is re-checked promptly even without a notify.
        let slice = (PAUSE_TIMEOUT - elapsed).min(Duration::from_millis(500));
        let (g, _) = gate.cv.wait_timeout(resumed, slice).unwrap();
        resumed = g;
    }
}

#[derive(Default)]
struct Inner {
    /// One bound server per port, shared by every replay on that port.
    ports: HashMap<u16, PortServer>,
    /// Which port each running replay is served from.
    replay_to_port: HashMap<i64, u16>,
    gate: Arc<ResumeGate>,
    next_pause_id: Arc<AtomicU64>,
}

#[derive(Default)]
pub struct ReplayServers(Mutex<Inner>);

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ReplayHit {
    replay_id: i64,
    method: String,
    path: String,
    matched: bool,
    status: i64,
    request_headers: Vec<(String, String)>,
    request_body: String,
    response_headers: Vec<(String, String)>,
    response_body: String,
    ts: i64,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ResumedEvent {
    replay_id: i64,
    pause_id: u64,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct PausedRequest {
    replay_id: i64,
    pause_id: u64,
    method: String,
    path: String,
    status: i64,
    request_headers: Vec<(String, String)>,
    request_body: String,
    response_headers: Vec<(String, String)>,
    response_body: String,
    ts: i64,
}

/// Derive the path portion of a (possibly templated) request URL.
/// Returns None when the URL is too templated to extract a path — callers
/// fall back to method-only matching in that case.
fn expected_path(url: &str) -> Option<String> {
    if let Ok(u) = reqwest::Url::parse(url) {
        return Some(u.path().to_string());
    }
    // Templated / scheme-less URL: strip scheme + host (or `{{var}}` host) and
    // take everything from the first '/' as the path. Only a URL with no path
    // component at all (e.g. a fully-templated `{{fullUrl}}`) yields None and
    // falls back to method-only matching.
    let no_q = url.split(['?', '#']).next().unwrap_or(url).trim();
    let after_scheme = match no_q.find("://") {
        Some(idx) => &no_q[idx + 3..],
        None => no_q,
    };
    after_scheme.find('/').map(|slash| after_scheme[slash..].to_string())
}

/// Path match where any segment containing `{{…}}` is a single-segment wildcard.
fn path_matches(expected: &str, actual: &str) -> bool {
    let e: Vec<&str> = expected.trim_matches('/').split('/').collect();
    let a: Vec<&str> = actual.trim_matches('/').split('/').collect();
    if e.len() != a.len() {
        return false;
    }
    e.iter()
        .zip(a.iter())
        .all(|(es, az)| es.contains("{{") || es == az)
}

fn route_matches(route: &Route, method: &str, path: &str) -> bool {
    route.method == method
        && match &route.expected_path {
            Some(p) => path_matches(p, path),
            None => true,
        }
}

#[tauri::command]
pub fn start_replay(
    app: AppHandle,
    servers: tauri::State<'_, ReplayServers>,
    db: tauri::State<'_, Database>,
    replay_id: i64,
    request_id: i64,
    port: u16,
    hit_limit: i64,
) -> Result<u16, String> {
    // Snapshot the bound request's method + url once; per-hit lookups read the
    // latest stored response live.
    let (req_method, req_url): (String, String) = {
        let conn = db.conn.lock().map_err(|e| e.to_string())?;
        conn.query_row(
            "SELECT method, url FROM requests WHERE id = ?1",
            params![request_id],
            |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)),
        )
        .map_err(|_| "Bound request not found".to_string())?
    };

    let route = Route {
        replay_id,
        request_id,
        method: req_method.to_uppercase(),
        expected_path: expected_path(&req_url),
        hit_limit,
        paused: Arc::new(AtomicBool::new(false)),
    };

    let mut inner = servers.0.lock().map_err(|e| e.to_string())?;

    if inner.replay_to_port.contains_key(&replay_id) {
        return Err("Replay is already running".to_string());
    }

    // Reuse a server already listening on this port (e.g. another replay).
    if let Some(ps) = inner.ports.get(&port) {
        ps.routes.lock().map_err(|e| e.to_string())?.push(route);
        inner.replay_to_port.insert(replay_id, port);
        return Ok(port);
    }

    // Otherwise bind a fresh server for this port.
    let server = Server::http(("127.0.0.1", port))
        .map_err(|e| format!("Cannot bind 127.0.0.1:{port} — {e}"))?;
    let bound_port = server
        .server_addr()
        .to_ip()
        .map(|a| a.port())
        .unwrap_or(port);

    let db_path = db_path()?;
    let stop = Arc::new(AtomicBool::new(false));
    let stop_thread = stop.clone();
    let routes = Arc::new(Mutex::new(vec![route]));
    let routes_thread = routes.clone();
    let gate = inner.gate.clone();
    let pause_ids = inner.next_pause_id.clone();

    thread::spawn(move || {
        let conn = match Connection::open(&db_path) {
            Ok(c) => {
                let _ = c.execute_batch("PRAGMA busy_timeout = 5000;");
                c
            }
            Err(_) => return,
        };

        let persist = |replay_id: i64, hit_limit: i64, status: i64, matched: bool, method: &str, path: &str, headers: &[(String, String)], body: &str, response_headers: &[(String, String)], response_body: &str, ts: i64| {
            let hj = serde_json::to_string(headers).unwrap_or_else(|_| "[]".to_string());
            let rhj = serde_json::to_string(response_headers).unwrap_or_else(|_| "[]".to_string());
            let _ = conn.execute(
                "INSERT INTO replay_hits (replay_id, method, path, matched, status, request_headers, request_body, response_headers, response_body, ts) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
                params![replay_id, method, path, matched as i64, status, hj, body, rhj, response_body, ts],
            );
            if hit_limit > 0 {
                let _ = conn.execute(
                    "DELETE FROM replay_hits WHERE replay_id = ?1 AND id NOT IN (SELECT id FROM replay_hits WHERE replay_id = ?1 ORDER BY id DESC LIMIT ?2)",
                    params![replay_id, hit_limit],
                );
            }
        };

        loop {
            if stop_thread.load(Ordering::Relaxed) {
                break;
            }
            match server.recv_timeout(Duration::from_millis(200)) {
                Ok(Some(mut request)) => {
                    let method = request.method().as_str().to_uppercase();
                    let raw_url = request.url().to_string();
                    let path = raw_url.split(['?', '#']).next().unwrap_or(&raw_url).to_string();

                    let req_headers: Vec<(String, String)> = request
                        .headers()
                        .iter()
                        .map(|h| (h.field.as_str().as_str().to_string(), h.value.as_str().to_string()))
                        .collect();
                    let mut body = String::new();
                    let _ = request.as_reader().read_to_string(&mut body);

                    let ts = std::time::SystemTime::now()
                        .duration_since(std::time::UNIX_EPOCH)
                        .map(|d| d.as_millis() as i64)
                        .unwrap_or(0);

                    // Find the first replay on this port whose method+path matches.
                    // Fall back to attributing an unmatched (404) hit to the sole
                    // replay when there is exactly one on the port.
                    let (route_opt, sole_route) = {
                        let routes = routes_thread.lock().unwrap();
                        let m = routes.iter().find(|r| route_matches(r, &method, &path)).cloned();
                        let sole = if routes.len() == 1 { Some(routes[0].clone()) } else { None };
                        (m, sole)
                    };

                    if let Some(route) = route_opt {
                        let stored: Option<(i64, String, String, String)> = conn
                            .query_row(
                                "SELECT status, status_text, headers, body FROM responses WHERE request_id = ?1 ORDER BY id DESC LIMIT 1",
                                params![route.request_id],
                                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
                            )
                            .ok();

                        let (status, headers_json, resp_body) = match stored {
                            Some((s, _st, h, b)) => (s, h, b),
                            None => (
                                503,
                                "[]".to_string(),
                                "No captured response yet for this request.".to_string(),
                            ),
                        };

                        let mut resp_headers: Vec<(String, String)> = Vec::new();
                        let mut response = Response::from_string(resp_body.clone()).with_status_code(status as u16);
                        if let Ok(serde_json::Value::Array(arr)) =
                            serde_json::from_str::<serde_json::Value>(&headers_json)
                        {
                            for h in arr {
                                let key = h.get("key").and_then(|v| v.as_str()).unwrap_or("");
                                let val = h.get("value").and_then(|v| v.as_str()).unwrap_or("");
                                if key.is_empty() {
                                    continue;
                                }
                                resp_headers.push((key.to_string(), val.to_string()));
                                let kl = key.to_lowercase();
                                // Body is stored already-decompressed and tiny_http sets its
                                // own framing, so drop length/encoding/framing headers.
                                if kl == "content-length"
                                    || kl == "transfer-encoding"
                                    || kl == "content-encoding"
                                {
                                    continue;
                                }
                                if let Ok(header) = Header::from_bytes(key.as_bytes(), val.as_bytes()) {
                                    response.add_header(header);
                                }
                            }
                        }

                        // Breakpoint: if this replay is in pause mode, surface the
                        // request + prepared response and block until the UI steps.
                        if route.paused.load(Ordering::Relaxed) {
                            let pause_id = pause_ids.fetch_add(1, Ordering::Relaxed);
                            let _ = app.emit(
                                "replay-paused",
                                PausedRequest {
                                    replay_id: route.replay_id,
                                    pause_id,
                                    method: method.clone(),
                                    path: path.clone(),
                                    status,
                                    request_headers: req_headers.clone(),
                                    request_body: body.clone(),
                                    response_headers: resp_headers.clone(),
                                    response_body: resp_body.clone(),
                                    ts,
                                },
                            );
                            let outcome = wait_for_resume(&gate, &stop_thread, pause_id);
                            let _ = app.emit("replay-resumed", ResumedEvent { replay_id: route.replay_id, pause_id });
                            match outcome {
                                PauseOutcome::Stepped => {
                                    persist(route.replay_id, route.hit_limit, status, true, &method, &path, &req_headers, &body, &resp_headers, &resp_body, ts);
                                    let _ = app.emit(
                                        "replay-hit",
                                        ReplayHit {
                                            replay_id: route.replay_id,
                                            method,
                                            path,
                                            matched: true,
                                            status,
                                            request_headers: req_headers,
                                            request_body: body,
                                            response_headers: resp_headers,
                                            response_body: resp_body,
                                            ts,
                                        },
                                    );
                                    let _ = request.respond(response);
                                }
                                PauseOutcome::TimedOut => {
                                    // Don't strand the client; serve but don't log.
                                    let _ = request.respond(response);
                                }
                                PauseOutcome::Stopped => {
                                    let _ = request.respond(Response::from_string("Replay stopped").with_status_code(503));
                                }
                            }
                        } else {
                            persist(route.replay_id, route.hit_limit, status, true, &method, &path, &req_headers, &body, &resp_headers, &resp_body, ts);
                            let _ = app.emit(
                                "replay-hit",
                                ReplayHit {
                                    replay_id: route.replay_id,
                                    method,
                                    path,
                                    matched: true,
                                    status,
                                    request_headers: req_headers,
                                    request_body: body,
                                    response_headers: resp_headers,
                                    response_body: resp_body,
                                    ts,
                                },
                            );
                            let _ = request.respond(response);
                        }
                    } else {
                        if let Some(route) = sole_route {
                            persist(route.replay_id, route.hit_limit, 404, false, &method, &path, &req_headers, &body, &[], "Not Found", ts);
                            let _ = app.emit(
                                "replay-hit",
                                ReplayHit {
                                    replay_id: route.replay_id,
                                    method,
                                    path,
                                    matched: false,
                                    status: 404,
                                    request_headers: req_headers,
                                    request_body: body,
                                    response_headers: Vec::new(),
                                    response_body: "Not Found".to_string(),
                                    ts,
                                },
                            );
                        }
                        let _ = request.respond(Response::from_string("Not Found").with_status_code(404));
                    }
                }
                Ok(None) => continue,
                Err(_) => break,
            }
        }
    });

    inner.ports.insert(port, PortServer { stop, routes });
    inner.replay_to_port.insert(replay_id, port);
    Ok(bound_port)
}

#[tauri::command]
pub fn stop_replay(servers: tauri::State<'_, ReplayServers>, replay_id: i64) -> Result<(), String> {
    let mut inner = servers.0.lock().map_err(|e| e.to_string())?;
    let Some(port) = inner.replay_to_port.remove(&replay_id) else {
        return Ok(());
    };
    let mut shutdown = false;
    if let Some(ps) = inner.ports.get(&port) {
        let mut routes = ps.routes.lock().map_err(|e| e.to_string())?;
        routes.retain(|r| r.replay_id != replay_id);
        if routes.is_empty() {
            ps.stop.store(true, Ordering::Relaxed);
            shutdown = true;
        }
    }
    // Last replay on the port left — drop the server so the port is freed.
    if shutdown {
        inner.ports.remove(&port);
    }
    // Wake any thread blocked on a paused request so it can re-check its stop flag.
    inner.gate.cv.notify_all();
    Ok(())
}

#[tauri::command]
pub fn list_running_replays(servers: tauri::State<'_, ReplayServers>) -> Result<Vec<i64>, String> {
    let inner = servers.0.lock().map_err(|e| e.to_string())?;
    Ok(inner.replay_to_port.keys().copied().collect())
}

/// Toggle pause (breakpoint) mode for a running replay. Resets when restarted.
#[tauri::command]
pub fn set_replay_paused(servers: tauri::State<'_, ReplayServers>, replay_id: i64, paused: bool) -> Result<(), String> {
    let inner = servers.0.lock().map_err(|e| e.to_string())?;
    if let Some(port) = inner.replay_to_port.get(&replay_id) {
        if let Some(ps) = inner.ports.get(port) {
            let routes = ps.routes.lock().map_err(|e| e.to_string())?;
            for r in routes.iter() {
                if r.replay_id == replay_id {
                    r.paused.store(paused, Ordering::Relaxed);
                }
            }
        }
    }
    Ok(())
}

/// Step: release a paused request so its response is sent.
#[tauri::command]
pub fn resume_replay(servers: tauri::State<'_, ReplayServers>, pause_id: u64) -> Result<(), String> {
    let inner = servers.0.lock().map_err(|e| e.to_string())?;
    inner.gate.resumed.lock().map_err(|e| e.to_string())?.insert(pause_id);
    inner.gate.cv.notify_all();
    Ok(())
}
