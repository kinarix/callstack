use serde::{Deserialize, Serialize};
use base64::{engine::general_purpose, Engine as _};
use rusqlite::Connection;

#[derive(Debug, Deserialize)]
pub struct KeyValueParam {
    pub key: String,
    pub value: String,
    pub enabled: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct FileAttachment {
    pub name: String,
    pub mime: String,
    pub path: String,
    pub data: Option<String>, // base64-encoded contents from the frontend
}

#[derive(Debug, Serialize)]
pub struct ResponseHeader {
    pub key: String,
    pub value: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SendResponse {
    pub status: u16,
    pub status_text: String,
    pub headers: Vec<ResponseHeader>,
    pub body: String,
    pub time_ms: u128,
    pub size: usize,
    pub is_base64: bool,
}

async fn execute_request(
    method: String,
    url: String,
    params: Vec<KeyValueParam>,
    headers: Vec<KeyValueParam>,
    body: String,
    follow_redirects: bool,
    attachments: Vec<FileAttachment>,
) -> Result<SendResponse, String> {
    let normalized = if url.starts_with("http://") || url.starts_with("https://") {
        url.clone()
    } else {
        format!("https://{url}")
    };
    let mut current_url = reqwest::Url::parse(&normalized).map_err(|e| format!("Invalid URL: {e}"))?;

    let active_params: Vec<&KeyValueParam> = params
        .iter()
        .filter(|p| p.enabled.unwrap_or(true) && !p.key.is_empty())
        .collect();
    if !active_params.is_empty() {
        current_url.set_query(None);
        let mut query = current_url.query_pairs_mut();
        for p in active_params {
            query.append_pair(&p.key, &p.value);
        }
        drop(query);
    }

    // Always use Policy::none() — we follow redirects manually so we can capture Set-Cookie from each hop
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .redirect(reqwest::redirect::Policy::none())
        .cookie_store(true)
        .build()
        .map_err(|e| format!("Failed to create client: {e}"))?;

    let reqwest_method = method
        .parse::<reqwest::Method>()
        .map_err(|e| format!("Invalid method: {e}"))?;

    let active_header_keys: std::collections::HashSet<String> = headers
        .iter()
        .filter(|h| h.enabled.unwrap_or(true) && !h.key.is_empty())
        .map(|h| h.key.to_lowercase())
        .collect();

    let start = std::time::Instant::now();
    let max_hops: usize = if follow_redirects { 10 } else { 0 };
    let mut hop_cookies: Vec<ResponseHeader> = vec![];

    for hop in 0..=max_hops {
        let is_first = hop == 0;
        // 302/303 redirects conventionally become GET; preserve method on 307/308
        let effective_method = if is_first { reqwest_method.clone() } else { reqwest::Method::GET };

        let mut req = client.request(effective_method.clone(), current_url.clone());

        for h in &headers {
            if h.enabled.unwrap_or(true) && !h.key.is_empty() {
                req = req.header(&h.key, &h.value);
            }
        }
        if !active_header_keys.contains("user-agent") {
            req = req.header("User-Agent", "Callstack/1.0");
        }
        if !active_header_keys.contains("origin") {
            let origin = current_url.origin().ascii_serialization();
            if origin != "null" {
                req = req.header("Origin", &origin);
            }
        }

        // Body only on first hop
        let can_have_body = effective_method != reqwest::Method::GET && effective_method != reqwest::Method::HEAD;
        if is_first && can_have_body {
            if !attachments.is_empty() {
                let mut form = reqwest::multipart::Form::new();
                for att in &attachments {
                    let bytes = if let Some(ref b64) = att.data {
                        general_purpose::STANDARD
                            .decode(b64)
                            .map_err(|e| format!("Failed to decode file data for '{}': {e}", att.name))?
                    } else if !att.path.is_empty() {
                        tokio::fs::read(&att.path)
                            .await
                            .map_err(|e| format!("File not found: {} ({})", att.path, e))?
                    } else {
                        return Err(format!("No data provided for file '{}'", att.name));
                    };
                    let part = reqwest::multipart::Part::bytes(bytes)
                        .file_name(att.name.clone())
                        .mime_str(&att.mime)
                        .map_err(|e| format!("Invalid MIME type '{}': {e}", att.mime))?;
                    form = form.part(att.name.clone(), part);
                }
                req = req.multipart(form);
            } else if !body.is_empty() {
                req = req.body(body.clone());
            }
        }

        match req.send().await {
            Err(e) => return Err(friendly_network_error(&e, start.elapsed().as_millis())),
            Ok(resp) => {
                let status = resp.status();

                // Collect headers before potentially dropping resp on redirect
                let resp_headers: Vec<ResponseHeader> = resp
                    .headers()
                    .iter()
                    .map(|(k, v)| ResponseHeader {
                        key: k.to_string(),
                        value: v.to_str().unwrap_or("").to_string(),
                    })
                    .collect();

                // Accumulate Set-Cookie from every hop so the UI and SQLite persistence see them all
                for h in &resp_headers {
                    if h.key.eq_ignore_ascii_case("set-cookie") {
                        hop_cookies.push(ResponseHeader { key: h.key.clone(), value: h.value.clone() });
                    }
                }

                // Follow redirect if applicable
                if status.is_redirection() && hop < max_hops {
                    if let Some(location) = resp_headers.iter()
                        .find(|h| h.key.eq_ignore_ascii_case("location"))
                        .map(|h| h.value.as_str())
                    {
                        if let Ok(next_url) = current_url.join(location) {
                            current_url = next_url;
                            continue;
                        }
                    }
                }

                // Final response — merge Set-Cookie from intermediate hops into headers
                let elapsed = start.elapsed().as_millis();
                let status_code = status.as_u16();
                let status_text = status.canonical_reason().unwrap_or("").to_string();

                let mut final_headers = resp_headers;
                // Prepend hop cookies (Set-Cookie from redirects not in the final response)
                let existing_cookies: std::collections::HashSet<String> = final_headers.iter()
                    .filter(|h| h.key.eq_ignore_ascii_case("set-cookie"))
                    .map(|h| h.value.clone())
                    .collect();
                for c in hop_cookies {
                    if !existing_cookies.contains(&c.value) {
                        final_headers.push(c);
                    }
                }

                let content_type = final_headers.iter()
                    .find(|h| h.key.eq_ignore_ascii_case("content-type"))
                    .map(|h| h.value.to_lowercase())
                    .unwrap_or_default();

                let is_binary = content_type.starts_with("image/")
                    || content_type.starts_with("video/")
                    || content_type.starts_with("audio/");

                let (resp_body, is_base64) = if is_binary {
                    let bytes = resp.bytes().await.unwrap_or_default();
                    (general_purpose::STANDARD.encode(&bytes), true)
                } else {
                    (resp.text().await.unwrap_or_default(), false)
                };

                let size = resp_body.len();

                return Ok(SendResponse {
                    status: status_code,
                    status_text,
                    headers: final_headers,
                    body: resp_body,
                    time_ms: elapsed,
                    size,
                    is_base64,
                });
            }
        }
    }

    Err("Too many redirects".to_string())
}

struct ParsedCookie {
    name: String,
    value: String,
    domain: String,
    path: String,
    expires: Option<i64>,
    secure: bool,
    http_only: bool,
    same_site: Option<String>,
}

fn parse_set_cookie(header_value: &str, request_host: &str, now_secs: i64) -> Option<ParsedCookie> {
    let mut segments = header_value.splitn(2, ';');
    let name_value = segments.next()?.trim();
    let eq_pos = name_value.find('=')?;
    let name = name_value[..eq_pos].trim().to_string();
    if name.is_empty() {
        return None;
    }
    let value = name_value[eq_pos + 1..].trim().to_string();
    let rest = segments.next().unwrap_or("");

    let mut domain: Option<String> = None;
    let mut path = "/".to_string();
    let mut expires: Option<i64> = None;
    let mut max_age: Option<i64> = None;
    let mut secure = false;
    let mut http_only = false;
    let mut same_site: Option<String> = None;

    for attr in rest.split(';') {
        let attr = attr.trim();
        let lower = attr.to_lowercase();
        if let Some(v) = lower.strip_prefix("domain=") {
            let d = v.trim().trim_start_matches('.').to_string();
            if !d.is_empty() {
                domain = Some(d);
            }
        } else if let Some(v) = lower.strip_prefix("path=") {
            let p = v.trim().to_string();
            path = if p.is_empty() { "/".to_string() } else { p };
        } else if let Some(v) = lower.strip_prefix("max-age=") {
            max_age = v.trim().parse::<i64>().ok();
        } else if let Some(v) = attr.strip_prefix("SameSite=").or_else(|| attr.strip_prefix("samesite=")) {
            same_site = Some(v.trim().to_string());
        } else if lower == "secure" {
            secure = true;
        } else if lower == "httponly" {
            http_only = true;
        }
    }

    if let Some(age) = max_age {
        expires = Some(if age <= 0 { now_secs - 1 } else { now_secs + age });
    }

    let effective_domain = domain.unwrap_or_else(|| request_host.to_string());

    Some(ParsedCookie { name, value, domain: effective_domain, path, expires, secure, http_only, same_site })
}

fn load_cookies_for_request(conn: &Connection, project_id: i64, url: &str) -> String {
    let Ok(parsed) = reqwest::Url::parse(url) else { return String::new() };
    let Some(host) = parsed.host_str().map(|h| h.to_lowercase()) else { return String::new() };
    let req_path = parsed.path().to_string();

    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64;

    let Ok(mut stmt) = conn.prepare(
        "SELECT name, value, domain, path FROM cookies
         WHERE project_id = ?1 AND (expires IS NULL OR expires > ?2)",
    ) else { return String::new() };

    let Ok(rows_iter) = stmt.query_map(rusqlite::params![project_id, now], |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, String>(2)?,
            row.get::<_, String>(3)?,
        ))
    }) else { return String::new() };

    rows_iter
        .filter_map(|r| r.ok())
        .filter(|(_, _, domain, cookie_path)| {
            let d = domain.trim_start_matches('.');
            (host == d || host.ends_with(&format!(".{d}")))
                && req_path.starts_with(cookie_path.as_str())
        })
        .map(|(name, value, _, _)| format!("{name}={value}"))
        .collect::<Vec<_>>()
        .join("; ")
}

fn save_response_cookies(conn: &Connection, project_id: i64, request_url: &str, headers: &[ResponseHeader]) {
    let request_host = reqwest::Url::parse(request_url)
        .ok()
        .and_then(|u| u.host_str().map(|h| h.to_lowercase()))
        .unwrap_or_default();

    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64;

    for header in headers {
        if header.key.to_lowercase() != "set-cookie" {
            continue;
        }
        let Some(cookie) = parse_set_cookie(&header.value, &request_host, now) else { continue };
        let _ = conn.execute(
            "INSERT OR REPLACE INTO cookies
             (project_id, domain, path, name, value, expires, secure, http_only, same_site, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, CURRENT_TIMESTAMP)",
            rusqlite::params![
                project_id,
                cookie.domain,
                cookie.path,
                cookie.name,
                cookie.value,
                cookie.expires,
                cookie.secure as i64,
                cookie.http_only as i64,
                cookie.same_site,
            ],
        );
    }
}

#[tauri::command]
pub async fn send_request(
    cancel_state: tauri::State<'_, crate::CancelHandle>,
    db: tauri::State<'_, crate::database::Database>,
    method: String,
    url: String,
    params: Vec<KeyValueParam>,
    mut headers: Vec<KeyValueParam>,
    body: String,
    follow_redirects: bool,
    attachments: Vec<FileAttachment>,
    project_id: Option<i64>,
    use_cookie_jar: bool,
) -> Result<SendResponse, String> {
    let url_str = url.clone();

    // Inject stored cookies before sending
    if use_cookie_jar {
        if let Some(pid) = project_id {
            if let Ok(conn) = db.conn.lock() {
                let cookie_str = load_cookies_for_request(&conn, pid, &url);
                if !cookie_str.is_empty()
                    && !headers.iter().any(|h| h.key.eq_ignore_ascii_case("cookie"))
                {
                    headers.push(KeyValueParam {
                        key: "Cookie".into(),
                        value: cookie_str,
                        enabled: Some(true),
                    });
                }
            }
        }
    }

    let handle = tokio::spawn(execute_request(
        method, url, params, headers, body, follow_redirects, attachments,
    ));
    {
        let mut g = cancel_state.0.lock().await;
        *g = Some(handle.abort_handle());
    }
    let result = match handle.await {
        Ok(r) => r,
        Err(e) if e.is_cancelled() => Err("Request cancelled".to_string()),
        Err(e) => Err(format!("Task error: {e}")),
    };
    {
        let mut g = cancel_state.0.lock().await;
        *g = None;
    }

    // Persist cookies from Set-Cookie response headers
    if use_cookie_jar {
        if let Some(pid) = project_id {
            if let Ok(ref resp) = result {
                if let Ok(conn) = db.conn.lock() {
                    save_response_cookies(&conn, pid, &url_str, &resp.headers);
                }
            }
        }
    }

    result
}

fn friendly_network_error(e: &reqwest::Error, elapsed: u128) -> String {
    if e.is_timeout() {
        return format!(
            "Request timed out after {}ms — the server took too long to respond",
            elapsed
        );
    }

    if e.is_connect() {
        let msg = e.to_string().to_lowercase();
        let host = e
            .url()
            .and_then(|u| u.host_str().map(|h| h.to_string()))
            .unwrap_or_default();

        if msg.contains("dns")
            || msg.contains("no such host")
            || msg.contains("failed to lookup")
            || msg.contains("name or service not known")
            || msg.contains("resolve")
        {
            return if host.is_empty() {
                "DNS error: could not resolve hostname".to_string()
            } else {
                format!("DNS error: could not resolve '{host}'")
            };
        }

        if msg.contains("refused") || msg.contains("actively refused") {
            return if host.is_empty() {
                "Connection refused — is the server running?".to_string()
            } else {
                format!("Connection refused at '{host}' — is the server running?")
            };
        }

        if msg.contains("tls") || msg.contains("ssl") || msg.contains("certificate") {
            return format!("TLS/SSL error: {e}");
        }

        if msg.contains("reset") {
            return "Connection reset by the server".to_string();
        }

        return format!("Could not connect: {e}");
    }

    if e.is_redirect() {
        return "Too many redirects — the server may be in a redirect loop".to_string();
    }

    if e.is_decode() {
        return "Failed to decode the server's response body".to_string();
    }

    format!("Request failed: {e}")
}
