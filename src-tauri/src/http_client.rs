use serde::{Deserialize, Serialize};
use base64::{engine::general_purpose, Engine as _};

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

#[tauri::command]
pub async fn send_request(
    method: String,
    url: String,
    params: Vec<KeyValueParam>,
    headers: Vec<KeyValueParam>,
    body: String,
    follow_redirects: bool,
    attachments: Vec<FileAttachment>,
) -> Result<SendResponse, String> {
    // Build URL with query params
    let normalized = if url.starts_with("http://") || url.starts_with("https://") {
        url.clone()
    } else {
        format!("https://{url}")
    };
    let mut parsed_url = reqwest::Url::parse(&normalized).map_err(|e| format!("Invalid URL: {e}"))?;

    let active_params: Vec<&KeyValueParam> = params
        .iter()
        .filter(|p| p.enabled.unwrap_or(true) && !p.key.is_empty())
        .collect();
    if !active_params.is_empty() {
        let mut query = parsed_url.query_pairs_mut();
        for p in active_params {
            query.append_pair(&p.key, &p.value);
        }
    }

    // Build request
    let redirect_policy = if follow_redirects {
        reqwest::redirect::Policy::limited(10)
    } else {
        reqwest::redirect::Policy::none()
    };
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .redirect(redirect_policy)
        .build()
        .map_err(|e| format!("Failed to create client: {e}"))?;

    let reqwest_method = method
        .parse::<reqwest::Method>()
        .map_err(|e| format!("Invalid method: {e}"))?;

    let mut req = client.request(reqwest_method.clone(), parsed_url.clone());

    // Set headers
    let active_header_keys: std::collections::HashSet<String> = headers
        .iter()
        .filter(|h| h.enabled.unwrap_or(true) && !h.key.is_empty())
        .map(|h| h.key.to_lowercase())
        .collect();

    for h in &headers {
        if h.enabled.unwrap_or(true) && !h.key.is_empty() {
            req = req.header(&h.key, &h.value);
        }
    }

    if !active_header_keys.contains("user-agent") {
        req = req.header("User-Agent", "Callstack/1.0");
    }
    if !active_header_keys.contains("origin") {
        let origin = parsed_url.origin().ascii_serialization();
        if origin != "null" {
            req = req.header("Origin", &origin);
        }
    }

    // Set body or multipart (not for GET/HEAD)
    let can_have_body = reqwest_method != reqwest::Method::GET && reqwest_method != reqwest::Method::HEAD;
    if can_have_body && !attachments.is_empty() {
        let mut form = reqwest::multipart::Form::new();
        for att in attachments {
            let bytes = tokio::fs::read(&att.path)
                .await
                .map_err(|e| format!("File not found: {} ({})", att.path, e))?;
            let part = reqwest::multipart::Part::bytes(bytes)
                .file_name(att.name.clone())
                .mime_str(&att.mime)
                .map_err(|e| format!("Invalid MIME type '{}': {e}", att.mime))?;
            form = form.part(att.name, part);
        }
        req = req.multipart(form);
    } else if can_have_body && !body.is_empty() {
        req = req.body(body);
    }

    let start = std::time::Instant::now();
    let response = req.send().await;
    let elapsed = start.elapsed().as_millis();

    match response {
        Ok(resp) => {
            let status = resp.status().as_u16();
            let status_text = resp.status().to_string();

            let resp_headers: Vec<ResponseHeader> = resp
                .headers()
                .iter()
                .map(|(k, v)| ResponseHeader {
                    key: k.to_string(),
                    value: v.to_str().unwrap_or("").to_string(),
                })
                .collect();

            // Extract content-type header to determine if body is binary
            let content_type = resp
                .headers()
                .get("content-type")
                .and_then(|v| v.to_str().ok())
                .unwrap_or("")
                .to_lowercase();

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

            Ok(SendResponse {
                status,
                status_text,
                headers: resp_headers,
                body: resp_body,
                time_ms: elapsed,
                size,
                is_base64,
            })
        }
        Err(e) => Err(friendly_network_error(&e, elapsed)),
    }
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
