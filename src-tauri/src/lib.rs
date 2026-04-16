mod database;
mod http_client;

use database::Database;
use serde::Serialize;
use tauri::Manager;

pub struct CancelHandle(pub tokio::sync::Mutex<Option<tokio::task::AbortHandle>>);

#[tauri::command]
async fn save_file(filename: String, content: String) -> Result<bool, String> {
    let ext = std::path::Path::new(&filename)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("txt")
        .to_string();

    let handle = rfd::AsyncFileDialog::new()
        .set_file_name(&filename)
        .add_filter("File", &[ext.as_str()])
        .save_file()
        .await;

    match handle {
        Some(h) => {
            let mut path = h.path().to_path_buf();
            // Ensure the extension is present (macOS may strip it)
            if path.extension().is_none() {
                path = path.with_extension(&ext);
            }
            std::fs::write(&path, content.as_bytes()).map_err(|e| e.to_string())?;
            Ok(true)
        }
        None => Ok(false),
    }
}

#[tauri::command]
async fn save_binary_file(filename: String, data: Vec<u8>) -> Result<bool, String> {
    let ext = std::path::Path::new(&filename)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("callstack")
        .to_string();

    let handle = rfd::AsyncFileDialog::new()
        .set_file_name(&filename)
        .add_filter("File", &[ext.as_str()])
        .save_file()
        .await;

    match handle {
        Some(h) => {
            let mut path = h.path().to_path_buf();
            if path.extension().is_none() {
                path = path.with_extension(&ext);
            }
            std::fs::write(&path, &data).map_err(|e| e.to_string())?;
            Ok(true)
        }
        None => Ok(false),
    }
}

#[derive(Serialize)]
struct AttachmentMeta {
    name: String,
    size: u64,
    mime: String,
    path: String,
}

fn guess_mime(name: &str) -> &'static str {
    match name.rsplit('.').next().map(|e| e.to_lowercase()).as_deref() {
        Some("jpg") | Some("jpeg") => "image/jpeg",
        Some("png") => "image/png",
        Some("gif") => "image/gif",
        Some("webp") => "image/webp",
        Some("svg") => "image/svg+xml",
        Some("pdf") => "application/pdf",
        Some("json") => "application/json",
        Some("xml") => "application/xml",
        Some("csv") => "text/csv",
        Some("txt") => "text/plain",
        Some("html") | Some("htm") => "text/html",
        Some("zip") => "application/zip",
        _ => "application/octet-stream",
    }
}

#[tauri::command]
async fn pick_attachment_files(app: tauri::AppHandle) -> Result<Option<Vec<AttachmentMeta>>, String> {
    let handles = rfd::AsyncFileDialog::new().pick_files().await;
    let Some(files) = handles else { return Ok(None) };

    let attachments_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("attachments");
    std::fs::create_dir_all(&attachments_dir).map_err(|e| e.to_string())?;

    let mut result = Vec::new();
    for h in files {
        let src = h.path().to_path_buf();
        let name = h.file_name();
        let ts = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos();
        let dest = attachments_dir.join(format!("{ts}_{name}"));
        std::fs::copy(&src, &dest).map_err(|e| format!("Failed to copy '{}': {e}", name))?;
        let size = std::fs::metadata(&dest).map(|m| m.len()).unwrap_or(0);
        let mime = guess_mime(&name).to_string();
        result.push(AttachmentMeta { name, size, mime, path: dest.to_string_lossy().into_owned() });
    }
    Ok(Some(result))
}

#[tauri::command]
async fn pick_file(filters: Vec<String>) -> Result<Option<Vec<u8>>, String> {
    let mut dialog = rfd::AsyncFileDialog::new();
    if !filters.is_empty() {
        let refs: Vec<&str> = filters.iter().map(|s| s.as_str()).collect();
        dialog = dialog.add_filter("Supported files", &refs);
    }
    let handle = dialog.pick_file().await;
    match handle {
        Some(h) => {
            let bytes = h.read().await;
            Ok(Some(bytes))
        }
        None => Ok(None),
    }
}

#[tauri::command]
#[allow(deprecated)]
fn open_system_url(app: tauri::AppHandle, url: String) -> Result<(), String> {
    use tauri_plugin_shell::ShellExt;
    app.shell().open(&url, None).map_err(|e| e.to_string())
}

#[tauri::command]
fn write_clipboard(text: String) -> Result<(), String> {
    let mut clipboard = arboard::Clipboard::new().map_err(|e| e.to_string())?;
    clipboard.set_text(text).map_err(|e| e.to_string())
}

#[tauri::command]
async fn cancel_request(state: tauri::State<'_, CancelHandle>) -> Result<(), String> {
    let guard = state.0.lock().await;
    if let Some(handle) = guard.as_ref() {
        handle.abort();
    }
    Ok(())
}

#[tauri::command]
fn reset_all_data(db: tauri::State<'_, Database>, app: tauri::AppHandle) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute_batch(
        "DELETE FROM automation_runs;
         DELETE FROM automations;
         DELETE FROM responses;
         DELETE FROM requests;
         DELETE FROM environments;
         DELETE FROM folders;
         DELETE FROM projects;",
    )
    .map_err(|e| e.to_string())?;
    drop(conn);
    app.restart();
}

#[tauri::command]
fn get_full_snapshot(db: tauri::State<'_, Database>) -> Result<serde_json::Value, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    fn dump_table(conn: &rusqlite::Connection, sql: &str) -> Result<serde_json::Value, String> {
        let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
        let col_count = stmt.column_count();
        let col_names: Vec<String> = (0..col_count)
            .map(|i| stmt.column_name(i).unwrap_or("").to_string())
            .collect();
        let rows = stmt
            .query_map([], |row| {
                let mut obj = serde_json::Map::new();
                for (i, name) in col_names.iter().enumerate() {
                    let val = match row.get_ref(i).map_err(|_| rusqlite::Error::InvalidQuery)? {
                        rusqlite::types::ValueRef::Null => serde_json::Value::Null,
                        rusqlite::types::ValueRef::Integer(n) => serde_json::Value::from(n),
                        rusqlite::types::ValueRef::Real(f) => serde_json::Value::from(f),
                        rusqlite::types::ValueRef::Text(t) => {
                            serde_json::Value::String(String::from_utf8_lossy(t).into_owned())
                        }
                        rusqlite::types::ValueRef::Blob(b) => {
                            serde_json::Value::String(format!("<blob {} bytes>", b.len()))
                        }
                    };
                    obj.insert(name.clone(), val);
                }
                Ok(serde_json::Value::Object(obj))
            })
            .map_err(|e| e.to_string())?;
        let mut out = Vec::new();
        for r in rows {
            out.push(r.map_err(|e| e.to_string())?);
        }
        Ok(serde_json::Value::Array(out))
    }

    Ok(serde_json::json!({
        "projects":        dump_table(&conn, "SELECT * FROM projects")?,
        "folders":         dump_table(&conn, "SELECT * FROM folders")?,
        "requests":        dump_table(&conn, "SELECT * FROM requests")?,
        "responses":       dump_table(&conn, "SELECT * FROM responses")?,
        "environments":    dump_table(&conn, "SELECT * FROM environments")?,
        "automations":     dump_table(&conn, "SELECT * FROM automations")?,
        "automation_runs": dump_table(&conn, "SELECT * FROM automation_runs")?,
    }))
}

#[tauri::command]
fn get_db_stats(db: tauri::State<'_, Database>) -> Result<serde_json::Value, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let count = |table: &str| -> Result<i64, String> {
        conn.query_row(&format!("SELECT COUNT(*) FROM {}", table), [], |row| row.get::<_, i64>(0))
            .map_err(|e| e.to_string())
    };
    // Checkpoint the WAL into the main DB file so the file size is accurate
    let _ = conn.execute_batch("PRAGMA wal_checkpoint(TRUNCATE);");
    let db_path = crate::database::db_path()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_default();
    let table_sizes: Vec<serde_json::Value> = {
        let mut stmt = conn
            .prepare("SELECT name, SUM(pgsize) FROM dbstat WHERE name NOT LIKE 'sqlite_%' GROUP BY name ORDER BY 2 DESC")
            .map_err(|e| e.to_string())?;
        let sizes = match stmt.query_map([], |row| Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)?))) {
            Err(_) => vec![],
            Ok(rows) => rows
                .filter_map(|r| r.ok())
                .map(|(name, size)| serde_json::json!({ "name": name, "sizeBytes": size }))
                .collect(),
        };
        sizes
    };
    let db_size_bytes: i64 = table_sizes
        .iter()
        .filter_map(|t| t.get("sizeBytes").and_then(|v| v.as_i64()))
        .sum();
    Ok(serde_json::json!({
        "projects":        count("projects")?,
        "requests":        count("requests")?,
        "responses":       count("responses")?,
        "folders":         count("folders")?,
        "environments":    count("environments")?,
        "automations":     count("automations")?,
        "automation_runs": count("automation_runs")?,
        "data_files":      count("data_files")?,
        "dbPath":          db_path,
        "dbSizeBytes":     db_size_bytes,
        "tableSizes":      table_sizes,
    }))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let db = Database::new().expect("Failed to initialize database");
    let cancel_handle = CancelHandle(tokio::sync::Mutex::new(None));

    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_shell::init())
        .manage(db)
        .manage(cancel_handle)
        .invoke_handler(tauri::generate_handler![
            http_client::send_request,
            database::list_projects,
            database::create_project,
            database::update_project,
            database::delete_project,
            database::list_requests,
            database::create_request,
            database::update_request,
            database::delete_request,
            database::move_request,
            database::move_folder,
            database::reorder_requests,
            database::list_folders,
            database::create_folder,
            database::update_folder,
            database::delete_folder,
            database::duplicate_request,
            database::duplicate_folder,
        database::import_requests,
            cancel_request,
            database::save_response,
            database::get_last_response,
            database::list_environments,
            database::create_environment,
            database::update_environment,
            database::delete_environment,
            database::list_automations,
            database::create_automation,
            database::update_automation,
            database::delete_automation,
            database::save_automation_run,
            database::list_automation_runs,
            database::clear_automation_runs,
            database::delete_automation_run,
            database::list_data_files,
            database::create_data_file,
            database::update_data_file,
            database::delete_data_file,
            save_file,
            save_binary_file,
            pick_file,
            pick_attachment_files,
            reset_all_data,
            get_db_stats,
            get_full_snapshot,
            write_clipboard,
            open_system_url,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
