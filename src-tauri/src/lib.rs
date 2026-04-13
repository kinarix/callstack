mod database;
mod http_client;

use database::Database;
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
        "DELETE FROM responses;
         DELETE FROM requests;
         DELETE FROM environments;
         DELETE FROM folders;
         DELETE FROM projects;",
    )
    .map_err(|e| e.to_string())?;
    drop(conn);
    app.restart();
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
            save_file,
            save_binary_file,
            pick_file,
            reset_all_data,
            write_clipboard,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
