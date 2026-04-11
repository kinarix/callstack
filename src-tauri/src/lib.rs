mod database;
mod http_client;

use database::Database;

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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let db = Database::new().expect("Failed to initialize database");

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(db)
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
            database::save_response,
            database::get_last_response,
            database::list_environments,
            database::create_environment,
            database::update_environment,
            database::delete_environment,
            save_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
