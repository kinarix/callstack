use rusqlite::{Connection, params};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Project {
    pub id: i64,
    pub user_email: Option<String>,
    pub name: String,
    pub description: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Request {
    pub id: i64,
    pub project_id: i64,
    pub folder_id: Option<i64>,
    pub user_email: Option<String>,
    pub name: String,
    pub method: String,
    pub url: String,
    pub params: String,
    pub headers: String,
    pub body: String,
    pub attachments: String,
    pub pre_script: String,
    pub post_script: String,
    pub position: i64,
    pub created_at: String,
    pub updated_at: String,
    pub imported: bool,
    pub env_id: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Folder {
    pub id: i64,
    pub project_id: i64,
    pub name: String,
    pub created_at: String,
    pub updated_at: String,
    pub imported: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DuplicateFolderResult {
    pub folder: Folder,
    pub requests: Vec<Request>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StoredResponse {
    pub id: i64,
    pub request_id: i64,
    pub status: i64,
    pub status_text: String,
    pub headers: String,
    pub body: String,
    pub time_ms: i64,
    pub size: i64,
    pub timestamp_ms: i64,
    pub request_headers: String,
    pub request_params: String,
    pub request_body: String,
}

pub struct Database {
    pub conn: Mutex<Connection>,
}

impl Drop for Database {
    fn drop(&mut self) {
        if let Ok(conn) = self.conn.lock() {
            let _ = conn.execute_batch("VACUUM; PRAGMA wal_checkpoint(TRUNCATE);");
        }
    }
}

pub fn db_path() -> Result<std::path::PathBuf, String> {
    let db_dir = dirs::data_dir()
        .ok_or("Cannot find data directory")?
        .join("callstack");
    Ok(db_dir.join("callstack.db"))
}

impl Database {
    pub fn new() -> Result<Self, String> {
        let db_dir = dirs::data_dir()
            .ok_or("Cannot find data directory")?
            .join("callstack");
        std::fs::create_dir_all(&db_dir).map_err(|e| format!("Cannot create data dir: {e}"))?;

        let db_path = db_dir.join("callstack.db");
        let conn = Connection::open(&db_path).map_err(|e| format!("Cannot open database: {e}"))?;

        conn.execute_batch(
            "PRAGMA busy_timeout = 5000;
             PRAGMA journal_mode = WAL;
             PRAGMA foreign_keys = ON;",
        )
        .map_err(|e| format!("Cannot set database pragmas: {e}"))?;

        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS projects (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_email TEXT,
                name TEXT NOT NULL,
                description TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS requests (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER,
                user_email TEXT,
                name TEXT NOT NULL,
                method TEXT NOT NULL DEFAULT 'GET',
                url TEXT NOT NULL DEFAULT '',
                params TEXT DEFAULT '[]',
                headers TEXT DEFAULT '[]',
                body TEXT DEFAULT '',
                position INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
            );
            CREATE TABLE IF NOT EXISTS responses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                request_id INTEGER,
                status INTEGER,
                status_text TEXT,
                headers TEXT,
                body TEXT,
                time_ms INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (request_id) REFERENCES requests(id) ON DELETE CASCADE
            );
            CREATE TABLE IF NOT EXISTS folders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
            );
            CREATE TABLE IF NOT EXISTS environments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                variables TEXT NOT NULL DEFAULT '[]',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (project_id) REFERENCES projects(id)
            );
            CREATE TABLE IF NOT EXISTS automations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                request_ids TEXT NOT NULL DEFAULT '[]',
                steps TEXT NOT NULL DEFAULT '[]',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
            );
            CREATE TABLE IF NOT EXISTS automation_runs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                automation_id INTEGER NOT NULL,
                status TEXT NOT NULL,
                results TEXT NOT NULL DEFAULT '[]',
                duration_ms INTEGER NOT NULL DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (automation_id) REFERENCES automations(id) ON DELETE CASCADE
            );
            CREATE TABLE IF NOT EXISTS data_files (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                content TEXT NOT NULL DEFAULT '',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
            );
            CREATE TABLE IF NOT EXISTS cookies (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL,
                domain TEXT NOT NULL,
                path TEXT NOT NULL DEFAULT '/',
                name TEXT NOT NULL,
                value TEXT NOT NULL,
                expires INTEGER,
                secure INTEGER NOT NULL DEFAULT 0,
                http_only INTEGER NOT NULL DEFAULT 0,
                same_site TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
                UNIQUE(project_id, domain, path, name) ON CONFLICT REPLACE
            );",
        )
        .map_err(|e| format!("Cannot create tables: {e}"))?;

        // Idempotent migrations — silently ignored if column already exists
        let _ = conn.execute(
            "ALTER TABLE requests ADD COLUMN folder_id INTEGER REFERENCES folders(id)",
            [],
        );
        let _ = conn.execute(
            "ALTER TABLE requests ADD COLUMN attachments TEXT DEFAULT '[]'",
            [],
        );
        let _ = conn.execute(
            "ALTER TABLE responses ADD COLUMN size INTEGER NOT NULL DEFAULT 0",
            [],
        );
        let _ = conn.execute(
            "ALTER TABLE responses ADD COLUMN timestamp_ms INTEGER NOT NULL DEFAULT 0",
            [],
        );
        let _ = conn.execute(
            "ALTER TABLE responses ADD COLUMN request_headers TEXT NOT NULL DEFAULT ''",
            [],
        );
        let _ = conn.execute(
            "ALTER TABLE responses ADD COLUMN request_params TEXT NOT NULL DEFAULT ''",
            [],
        );
        let _ = conn.execute(
            "ALTER TABLE responses ADD COLUMN request_body TEXT NOT NULL DEFAULT ''",
            [],
        );

        // Migrate requests table to add position column
        let position_col_added = conn.execute(
            "ALTER TABLE requests ADD COLUMN position INTEGER DEFAULT 0",
            [],
        ).is_ok();
        // Seed positions for existing rows so ordering is stable — only on first migration
        if position_col_added {
            let _ = conn.execute(
                "UPDATE requests SET position = rowid WHERE position = 0",
                [],
            );
        }
        let _ = conn.execute(
            "ALTER TABLE requests ADD COLUMN imported INTEGER NOT NULL DEFAULT 0",
            [],
        );
        let _ = conn.execute(
            "ALTER TABLE folders ADD COLUMN imported INTEGER NOT NULL DEFAULT 0",
            [],
        );
        let _ = conn.execute(
            "ALTER TABLE requests ADD COLUMN pre_script TEXT NOT NULL DEFAULT ''",
            [],
        );
        let _ = conn.execute(
            "ALTER TABLE requests ADD COLUMN post_script TEXT NOT NULL DEFAULT ''",
            [],
        );
        let _ = conn.execute(
            "ALTER TABLE automations ADD COLUMN steps TEXT NOT NULL DEFAULT '[]'",
            [],
        );
        let _ = conn.execute(
            "ALTER TABLE requests ADD COLUMN env_id INTEGER REFERENCES environments(id)",
            [],
        );
        let _ = conn.execute(
            "ALTER TABLE automations ADD COLUMN env_id INTEGER REFERENCES environments(id)",
            [],
        );
        let _ = conn.execute(
            "ALTER TABLE environments ADD COLUMN secrets TEXT NOT NULL DEFAULT '[]'",
            [],
        );

        Ok(Self {
            conn: Mutex::new(conn),
        })
    }
}

// --- Project commands ---

#[tauri::command]
pub fn list_projects(
    db: tauri::State<Database>,
    user_email: Option<String>,
) -> Result<Vec<Project>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    let (query, param_values): (&str, Vec<Box<dyn rusqlite::types::ToSql>>) = match &user_email {
        Some(email) => (
            "SELECT id, user_email, name, description, created_at, updated_at FROM projects WHERE user_email = ? ORDER BY name ASC",
            vec![Box::new(email.clone()) as Box<dyn rusqlite::types::ToSql>],
        ),
        None => (
            "SELECT id, user_email, name, description, created_at, updated_at FROM projects WHERE user_email IS NULL ORDER BY name ASC",
            vec![],
        ),
    };

    let mut stmt = conn.prepare(query).map_err(|e| e.to_string())?;
    let params: Vec<&dyn rusqlite::types::ToSql> = param_values.iter().map(|p| p.as_ref()).collect();
    let rows = stmt
        .query_map(params.as_slice(), |row| {
            Ok(Project {
                id: row.get(0)?,
                user_email: row.get(1)?,
                name: row.get(2)?,
                description: row.get(3)?,
                created_at: row.get(4)?,
                updated_at: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_project(
    db: tauri::State<Database>,
    user_email: Option<String>,
    name: String,
    description: Option<String>,
) -> Result<Project, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT INTO projects (user_email, name, description) VALUES (?1, ?2, ?3)",
        params![user_email, name, description],
    )
    .map_err(|e| e.to_string())?;

    let id = conn.last_insert_rowid();

    conn.query_row(
        "SELECT id, user_email, name, description, created_at, updated_at FROM projects WHERE id = ?1",
        params![id],
        |row| {
            Ok(Project {
                id: row.get(0)?,
                user_email: row.get(1)?,
                name: row.get(2)?,
                description: row.get(3)?,
                created_at: row.get(4)?,
                updated_at: row.get(5)?,
            })
        },
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_project(
    db: tauri::State<Database>,
    id: i64,
    name: String,
    description: Option<String>,
) -> Result<Project, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    conn.execute(
        "UPDATE projects SET name = ?1, description = ?2, updated_at = CURRENT_TIMESTAMP WHERE id = ?3",
        params![name, description, id],
    )
    .map_err(|e| e.to_string())?;

    conn.query_row(
        "SELECT id, user_email, name, description, created_at, updated_at FROM projects WHERE id = ?1",
        params![id],
        |row| {
            Ok(Project {
                id: row.get(0)?,
                user_email: row.get(1)?,
                name: row.get(2)?,
                description: row.get(3)?,
                created_at: row.get(4)?,
                updated_at: row.get(5)?,
            })
        },
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_project(db: tauri::State<Database>, id: i64) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "DELETE FROM responses WHERE request_id IN (SELECT id FROM requests WHERE project_id = ?1)",
        params![id],
    )
    .map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM requests WHERE project_id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM automations WHERE project_id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM data_files WHERE project_id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM environments WHERE project_id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM folders WHERE project_id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM projects WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

// --- Request commands ---

#[tauri::command]
pub fn list_requests(
    db: tauri::State<Database>,
    project_id: i64,
) -> Result<Vec<Request>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare(
            "SELECT id, project_id, folder_id, user_email, name, method, url, params, headers, body, attachments, position, created_at, updated_at, imported, pre_script, post_script, env_id
             FROM requests WHERE project_id = ?1 ORDER BY position ASC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(params![project_id], |row| {
            Ok(Request {
                id: row.get(0)?,
                project_id: row.get(1)?,
                folder_id: row.get(2)?,
                user_email: row.get(3)?,
                name: row.get(4)?,
                method: row.get(5)?,
                url: row.get(6)?,
                params: row.get(7)?,
                headers: row.get(8)?,
                body: row.get(9)?,
                attachments: row.get(10)?,
                position: row.get(11)?,
                created_at: row.get(12)?,
                updated_at: row.get(13)?,
                imported: row.get::<_, i64>(14)? != 0,
                pre_script: row.get::<_, Option<String>>(15)?.unwrap_or_default(),
                post_script: row.get::<_, Option<String>>(16)?.unwrap_or_default(),
                env_id: row.get(17)?,
            })
        })
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_request(
    db: tauri::State<Database>,
    project_id: i64,
    user_email: Option<String>,
    name: String,
    folder_id: Option<i64>,
) -> Result<Request, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    // Get the max position for this folder/root so new requests go to the end
    let max_position: i64 = conn
        .query_row(
            "SELECT COALESCE(MAX(position), -1) FROM requests WHERE project_id = ?1 AND folder_id IS ?2",
            params![project_id, folder_id],
            |row| row.get(0),
        )
        .unwrap_or(-1);

    let new_position = max_position + 1;

    conn.execute(
        "INSERT INTO requests (project_id, folder_id, user_email, name, method, url, params, headers, body, position) VALUES (?1, ?2, ?3, ?4, 'GET', '', '[]', '[]', '', ?5)",
        params![project_id, folder_id, user_email, name, new_position],
    )
    .map_err(|e| e.to_string())?;

    let id = conn.last_insert_rowid();

    conn.query_row(
        "SELECT id, project_id, folder_id, user_email, name, method, url, params, headers, body, attachments, position, created_at, updated_at, imported, pre_script, post_script, env_id FROM requests WHERE id = ?1",
        params![id],
        |row| {
            Ok(Request {
                id: row.get(0)?,
                project_id: row.get(1)?,
                folder_id: row.get(2)?,
                user_email: row.get(3)?,
                name: row.get(4)?,
                method: row.get(5)?,
                url: row.get(6)?,
                params: row.get(7)?,
                headers: row.get(8)?,
                body: row.get(9)?,
                attachments: row.get(10)?,
                position: row.get(11)?,
                created_at: row.get(12)?,
                updated_at: row.get(13)?,
                imported: row.get::<_, i64>(14)? != 0,
                pre_script: row.get::<_, Option<String>>(15)?.unwrap_or_default(),
                post_script: row.get::<_, Option<String>>(16)?.unwrap_or_default(),
                env_id: row.get(17)?,
            })
        },
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_request(
    db: tauri::State<Database>,
    id: i64,
    name: Option<String>,
    method: Option<String>,
    url: Option<String>,
    params: Option<String>,
    headers: Option<String>,
    body: Option<String>,
    folder_id: Option<i64>,
    attachments: Option<String>,
    pre_script: Option<String>,
    post_script: Option<String>,
    env_id: Option<Option<i64>>,
) -> Result<Request, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    // Build dynamic update
    let mut sets = vec!["updated_at = CURRENT_TIMESTAMP".to_string()];
    let mut values: Vec<Box<dyn rusqlite::types::ToSql>> = vec![];

    if let Some(v) = name {
        sets.push(format!("name = ?{}", values.len() + 1));
        values.push(Box::new(v));
    }
    if let Some(v) = method {
        sets.push(format!("method = ?{}", values.len() + 1));
        values.push(Box::new(v));
    }
    if let Some(v) = url {
        sets.push(format!("url = ?{}", values.len() + 1));
        values.push(Box::new(v));
    }
    if let Some(v) = params {
        sets.push(format!("params = ?{}", values.len() + 1));
        values.push(Box::new(v));
    }
    if let Some(v) = headers {
        sets.push(format!("headers = ?{}", values.len() + 1));
        values.push(Box::new(v));
    }
    if let Some(v) = body {
        sets.push(format!("body = ?{}", values.len() + 1));
        values.push(Box::new(v));
    }
    if let Some(v) = folder_id {
        sets.push(format!("folder_id = ?{}", values.len() + 1));
        values.push(Box::new(v));
    }
    if let Some(v) = attachments {
        sets.push(format!("attachments = ?{}", values.len() + 1));
        values.push(Box::new(v));
    }
    if let Some(v) = pre_script {
        sets.push(format!("pre_script = ?{}", values.len() + 1));
        values.push(Box::new(v));
    }
    if let Some(v) = post_script {
        sets.push(format!("post_script = ?{}", values.len() + 1));
        values.push(Box::new(v));
    }
    if let Some(v) = env_id {
        sets.push(format!("env_id = ?{}", values.len() + 1));
        values.push(Box::new(v));
    }

    let id_param_idx = values.len() + 1;
    values.push(Box::new(id));

    let query = format!(
        "UPDATE requests SET {} WHERE id = ?{}",
        sets.join(", "),
        id_param_idx
    );

    let param_refs: Vec<&dyn rusqlite::types::ToSql> = values.iter().map(|v| v.as_ref()).collect();
    conn.execute(&query, param_refs.as_slice())
        .map_err(|e| e.to_string())?;

    conn.query_row(
        "SELECT id, project_id, folder_id, user_email, name, method, url, params, headers, body, attachments, position, created_at, updated_at, imported, pre_script, post_script, env_id FROM requests WHERE id = ?1",
        params![id],
        |row| {
            Ok(Request {
                id: row.get(0)?,
                project_id: row.get(1)?,
                folder_id: row.get(2)?,
                user_email: row.get(3)?,
                name: row.get(4)?,
                method: row.get(5)?,
                url: row.get(6)?,
                params: row.get(7)?,
                headers: row.get(8)?,
                body: row.get(9)?,
                attachments: row.get(10)?,
                position: row.get(11)?,
                created_at: row.get(12)?,
                updated_at: row.get(13)?,
                imported: row.get::<_, i64>(14)? != 0,
                pre_script: row.get::<_, Option<String>>(15)?.unwrap_or_default(),
                post_script: row.get::<_, Option<String>>(16)?.unwrap_or_default(),
                env_id: row.get(17)?,
            })
        },
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_request(db: tauri::State<Database>, id: i64) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM responses WHERE request_id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM requests WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn move_request(
    db: tauri::State<Database>,
    id: i64,
    project_id: i64,
    folder_id: Option<i64>,
    position: i64,
) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE requests SET project_id = ?1, folder_id = ?2, position = ?3, updated_at = CURRENT_TIMESTAMP WHERE id = ?4",
        params![project_id, folder_id, position, id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn move_folder(
    db: tauri::State<Database>,
    id: i64,
    project_id: i64,
) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE folders SET project_id = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2",
        params![project_id, id],
    )
    .map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE requests SET project_id = ?1, updated_at = CURRENT_TIMESTAMP WHERE folder_id = ?2",
        params![project_id, id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn reorder_requests(
    db: tauri::State<Database>,
    ids: Vec<i64>,
) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    for (position, id) in ids.iter().enumerate() {
        conn.execute(
            "UPDATE requests SET position = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2",
            params![position as i64, id],
        )
        .map_err(|e| e.to_string())?;
    }

    Ok(())
}

// --- Folder commands ---

#[tauri::command]
pub fn list_folders(
    db: tauri::State<Database>,
    project_id: i64,
) -> Result<Vec<Folder>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare(
            "SELECT id, project_id, name, created_at, updated_at, imported FROM folders WHERE project_id = ?1 ORDER BY name ASC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(params![project_id], |row| {
            Ok(Folder {
                id: row.get(0)?,
                project_id: row.get(1)?,
                name: row.get(2)?,
                created_at: row.get(3)?,
                updated_at: row.get(4)?,
                imported: row.get::<_, i64>(5)? != 0,
            })
        })
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_folder(
    db: tauri::State<Database>,
    project_id: i64,
    name: String,
    imported: Option<bool>,
) -> Result<Folder, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let imported_val = imported.unwrap_or(false) as i64;

    conn.execute(
        "INSERT INTO folders (project_id, name, imported) VALUES (?1, ?2, ?3)",
        params![project_id, name, imported_val],
    )
    .map_err(|e| e.to_string())?;

    let id = conn.last_insert_rowid();

    conn.query_row(
        "SELECT id, project_id, name, created_at, updated_at, imported FROM folders WHERE id = ?1",
        params![id],
        |row| {
            Ok(Folder {
                id: row.get(0)?,
                project_id: row.get(1)?,
                name: row.get(2)?,
                created_at: row.get(3)?,
                updated_at: row.get(4)?,
                imported: row.get::<_, i64>(5)? != 0,
            })
        },
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_folder(
    db: tauri::State<Database>,
    id: i64,
    name: String,
) -> Result<Folder, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    conn.execute(
        "UPDATE folders SET name = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2",
        params![name, id],
    )
    .map_err(|e| e.to_string())?;

    conn.query_row(
        "SELECT id, project_id, name, created_at, updated_at, imported FROM folders WHERE id = ?1",
        params![id],
        |row| {
            Ok(Folder {
                id: row.get(0)?,
                project_id: row.get(1)?,
                name: row.get(2)?,
                created_at: row.get(3)?,
                updated_at: row.get(4)?,
                imported: row.get::<_, i64>(5)? != 0,
            })
        },
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_folder(db: tauri::State<Database>, id: i64) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    // Delete responses for requests in this folder
    conn.execute(
        "DELETE FROM responses WHERE request_id IN (SELECT id FROM requests WHERE folder_id = ?1)",
        params![id],
    )
    .map_err(|e| e.to_string())?;
    // Delete requests in this folder
    conn.execute("DELETE FROM requests WHERE folder_id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM folders WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

// --- Duplicate commands ---

#[tauri::command]
pub fn duplicate_request(db: tauri::State<Database>, id: i64) -> Result<Request, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    let (project_id, folder_id): (i64, Option<i64>) = conn
        .query_row(
            "SELECT project_id, folder_id FROM requests WHERE id = ?1",
            params![id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(|e| e.to_string())?;

    let max_position: i64 = conn
        .query_row(
            "SELECT COALESCE(MAX(position), -1) FROM requests WHERE project_id = ?1 AND folder_id IS ?2",
            params![project_id, folder_id],
            |row| row.get(0),
        )
        .unwrap_or(-1);

    let new_position = max_position + 1;

    conn.execute(
        "INSERT INTO requests (project_id, folder_id, user_email, name, method, url, params, headers, body, attachments, pre_script, post_script, position)
         SELECT project_id, folder_id, user_email, 'Copy of ' || name, method, url, params, headers, body, COALESCE(attachments, '[]'), pre_script, post_script, ?2
         FROM requests WHERE id = ?1",
        params![id, new_position],
    )
    .map_err(|e| e.to_string())?;

    let new_id = conn.last_insert_rowid();

    conn.query_row(
        "SELECT id, project_id, folder_id, user_email, name, method, url, params, headers, body, attachments, position, created_at, updated_at, imported, pre_script, post_script, env_id FROM requests WHERE id = ?1",
        params![new_id],
        |row| {
            Ok(Request {
                id: row.get(0)?,
                project_id: row.get(1)?,
                folder_id: row.get(2)?,
                user_email: row.get(3)?,
                name: row.get(4)?,
                method: row.get(5)?,
                url: row.get(6)?,
                params: row.get(7)?,
                headers: row.get(8)?,
                body: row.get(9)?,
                attachments: row.get(10)?,
                position: row.get(11)?,
                created_at: row.get(12)?,
                updated_at: row.get(13)?,
                imported: row.get::<_, i64>(14)? != 0,
                pre_script: row.get::<_, Option<String>>(15)?.unwrap_or_default(),
                post_script: row.get::<_, Option<String>>(16)?.unwrap_or_default(),
                env_id: row.get(17)?,
            })
        },
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn duplicate_folder(db: tauri::State<Database>, id: i64) -> Result<DuplicateFolderResult, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT INTO folders (project_id, name) SELECT project_id, 'Copy of ' || name FROM folders WHERE id = ?1",
        params![id],
    )
    .map_err(|e| e.to_string())?;

    let new_folder_id = conn.last_insert_rowid();

    let folder = conn
        .query_row(
            "SELECT id, project_id, name, created_at, updated_at, imported FROM folders WHERE id = ?1",
            params![new_folder_id],
            |row| {
                Ok(Folder {
                    id: row.get(0)?,
                    project_id: row.get(1)?,
                    name: row.get(2)?,
                    created_at: row.get(3)?,
                    updated_at: row.get(4)?,
                    imported: row.get::<_, i64>(5)? != 0,
                })
            },
        )
        .map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT INTO requests (project_id, folder_id, user_email, name, method, url, params, headers, body, attachments, pre_script, post_script, position)
         SELECT project_id, ?2, user_email, name, method, url, params, headers, body, COALESCE(attachments, '[]'), pre_script, post_script, position
         FROM requests WHERE folder_id = ?1",
        params![id, new_folder_id],
    )
    .map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare(
            "SELECT id, project_id, folder_id, user_email, name, method, url, params, headers, body, attachments, position, created_at, updated_at, imported, pre_script, post_script
             FROM requests WHERE folder_id = ?1 ORDER BY position ASC",
        )
        .map_err(|e| e.to_string())?;

    let new_requests = stmt
        .query_map(params![new_folder_id], |row| {
            Ok(Request {
                id: row.get(0)?,
                project_id: row.get(1)?,
                folder_id: row.get(2)?,
                user_email: row.get(3)?,
                name: row.get(4)?,
                method: row.get(5)?,
                url: row.get(6)?,
                params: row.get(7)?,
                headers: row.get(8)?,
                body: row.get(9)?,
                attachments: row.get(10)?,
                position: row.get(11)?,
                created_at: row.get(12)?,
                updated_at: row.get(13)?,
                imported: row.get::<_, i64>(14)? != 0,
                pre_script: row.get::<_, Option<String>>(15)?.unwrap_or_default(),
                post_script: row.get::<_, Option<String>>(16)?.unwrap_or_default(),
                env_id: row.get(17)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(DuplicateFolderResult { folder, requests: new_requests })
}

// --- Import commands ---

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportRequestData {
    pub name: String,
    pub method: String,
    pub url: String,
    pub params: String,
    pub headers: String,
    pub body: String,
    #[serde(default)]
    pub pre_script: String,
    #[serde(default)]
    pub post_script: String,
}

#[tauri::command]
pub fn import_requests(
    db: tauri::State<Database>,
    project_id: i64,
    folder_id: Option<i64>,
    user_email: Option<String>,
    requests: Vec<ImportRequestData>,
) -> Result<Vec<Request>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut result = Vec::new();

    for (pos, req) in requests.iter().enumerate() {
        conn.execute(
            "INSERT INTO requests (project_id, folder_id, user_email, name, method, url, params, headers, body, attachments, position, imported, pre_script, post_script, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, '[]', ?10, 1, ?11, ?12, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
            params![project_id, folder_id, user_email, req.name, req.method, req.url, req.params, req.headers, req.body, pos as i64, req.pre_script, req.post_script],
        )
        .map_err(|e| e.to_string())?;

        let id = conn.last_insert_rowid();
        let request = conn
            .query_row(
                "SELECT id, project_id, folder_id, user_email, name, method, url, params, headers, body, attachments, position, created_at, updated_at, imported, pre_script, post_script, env_id FROM requests WHERE id = ?1",
                params![id],
                |row| {
                    Ok(Request {
                        id: row.get(0)?,
                        project_id: row.get(1)?,
                        folder_id: row.get(2)?,
                        user_email: row.get(3)?,
                        name: row.get(4)?,
                        method: row.get(5)?,
                        url: row.get(6)?,
                        params: row.get(7)?,
                        headers: row.get(8)?,
                        body: row.get(9)?,
                        attachments: row.get(10)?,
                        position: row.get(11)?,
                        created_at: row.get(12)?,
                        updated_at: row.get(13)?,
                        imported: row.get::<_, i64>(14)? != 0,
                        pre_script: row.get::<_, Option<String>>(15)?.unwrap_or_default(),
                        post_script: row.get::<_, Option<String>>(16)?.unwrap_or_default(),
                        env_id: row.get(17)?,
                    })
                },
            )
            .map_err(|e| e.to_string())?;
        result.push(request);
    }

    Ok(result)
}

// --- Response commands ---

#[tauri::command]
pub fn save_response(
    db: tauri::State<Database>,
    request_id: i64,
    status: i64,
    status_text: String,
    headers: String,
    body: String,
    time_ms: i64,
    size: i64,
    timestamp_ms: i64,
    history_limit: i64,
    request_headers: String,
    request_params: String,
    request_body: String,
) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO responses (request_id, status, status_text, headers, body, time_ms, size, timestamp_ms, request_headers, request_params, request_body) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
        params![request_id, status, status_text, headers, body, time_ms, size, timestamp_ms, request_headers, request_params, request_body],
    )
    .map_err(|e| e.to_string())?;
    if history_limit > 0 {
        conn.execute(
            "DELETE FROM responses WHERE request_id = ?1 AND id NOT IN (SELECT id FROM responses WHERE request_id = ?1 ORDER BY id DESC LIMIT ?2)",
            params![request_id, history_limit],
        )
        .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn get_response_history(
    db: tauri::State<Database>,
    request_id: i64,
) -> Result<Vec<StoredResponse>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT id, request_id, status, status_text, headers, body, time_ms, size, timestamp_ms, request_headers, request_params, request_body FROM responses WHERE request_id = ?1 ORDER BY id DESC LIMIT 100",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![request_id], |row| {
            Ok(StoredResponse {
                id: row.get(0)?,
                request_id: row.get(1)?,
                status: row.get(2)?,
                status_text: row.get(3)?,
                headers: row.get(4)?,
                body: row.get(5)?,
                time_ms: row.get(6)?,
                size: row.get(7)?,
                timestamp_ms: row.get(8)?,
                request_headers: row.get::<_, Option<String>>(9)?.unwrap_or_default(),
                request_params: row.get::<_, Option<String>>(10)?.unwrap_or_default(),
                request_body: row.get::<_, Option<String>>(11)?.unwrap_or_default(),
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn clear_response_history(db: tauri::State<Database>) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM responses", []).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn get_last_response(
    db: tauri::State<Database>,
    request_id: i64,
) -> Result<Option<StoredResponse>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let result = conn.query_row(
        "SELECT id, request_id, status, status_text, headers, body, time_ms, size, timestamp_ms, request_headers, request_params, request_body FROM responses WHERE request_id = ?1 ORDER BY id DESC LIMIT 1",
        params![request_id],
        |row| {
            Ok(StoredResponse {
                id: row.get(0)?,
                request_id: row.get(1)?,
                status: row.get(2)?,
                status_text: row.get(3)?,
                headers: row.get(4)?,
                body: row.get(5)?,
                time_ms: row.get(6)?,
                size: row.get(7)?,
                timestamp_ms: row.get(8)?,
                request_headers: row.get::<_, Option<String>>(9)?.unwrap_or_default(),
                request_params: row.get::<_, Option<String>>(10)?.unwrap_or_default(),
                request_body: row.get::<_, Option<String>>(11)?.unwrap_or_default(),
            })
        },
    );
    match result {
        Ok(r) => Ok(Some(r)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

// Environment commands

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Environment {
    pub id: i64,
    pub project_id: i64,
    pub name: String,
    pub variables: String,
    pub secrets: String,
    pub created_at: String,
    pub updated_at: String,
}

#[tauri::command]
pub fn list_environments(
    db: tauri::State<Database>,
    project_id: i64,
) -> Result<Vec<Environment>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT id, project_id, name, variables, secrets, created_at, updated_at
             FROM environments WHERE project_id = ?1 ORDER BY created_at ASC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(params![project_id], |row| {
            Ok(Environment {
                id: row.get(0)?,
                project_id: row.get(1)?,
                name: row.get(2)?,
                variables: row.get(3)?,
                secrets: row.get(4)?,
                created_at: row.get(5)?,
                updated_at: row.get(6)?,
            })
        })
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_environment(
    db: tauri::State<Database>,
    project_id: i64,
    name: String,
) -> Result<Environment, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT INTO environments (project_id, name, variables) VALUES (?1, ?2, '[]')",
        params![project_id, name],
    )
    .map_err(|e| e.to_string())?;

    let id = conn.last_insert_rowid();

    conn.query_row(
        "SELECT id, project_id, name, variables, secrets, created_at, updated_at FROM environments WHERE id = ?1",
        params![id],
        |row| Ok(Environment {
            id: row.get(0)?,
            project_id: row.get(1)?,
            name: row.get(2)?,
            variables: row.get(3)?,
            secrets: row.get(4)?,
            created_at: row.get(5)?,
            updated_at: row.get(6)?,
        }),
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_environment(
    db: tauri::State<Database>,
    id: i64,
    name: String,
    variables: String,
) -> Result<Environment, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    conn.execute(
        "UPDATE environments SET name = ?1, variables = ?2, updated_at = CURRENT_TIMESTAMP WHERE id = ?3",
        params![name, variables, id],
    )
    .map_err(|e| e.to_string())?;

    conn.query_row(
        "SELECT id, project_id, name, variables, secrets, created_at, updated_at FROM environments WHERE id = ?1",
        params![id],
        |row| Ok(Environment {
            id: row.get(0)?,
            project_id: row.get(1)?,
            name: row.get(2)?,
            variables: row.get(3)?,
            secrets: row.get(4)?,
            created_at: row.get(5)?,
            updated_at: row.get(6)?,
        }),
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_environment_secrets(
    db: tauri::State<Database>,
    id: i64,
    secrets: String,
) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE environments SET secrets = ?1 WHERE id = ?2",
        params![secrets, id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn delete_environment(db: tauri::State<Database>, id: i64) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM environments WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

// --- Automation structs ---

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Automation {
    pub id: i64,
    pub project_id: i64,
    pub name: String,
    pub steps: String, // JSON array of AutomationStep
    pub created_at: String,
    pub updated_at: String,
    pub env_id: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AutomationRun {
    pub id: i64,
    pub automation_id: i64,
    pub status: String,
    pub results: String, // JSON array
    pub duration_ms: i64,
    pub created_at: String,
}

// --- Automation commands ---

#[tauri::command]
pub fn list_automations(db: tauri::State<Database>, project_id: i64) -> Result<Vec<Automation>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, project_id, name, steps, created_at, updated_at, env_id FROM automations WHERE project_id = ?1 ORDER BY created_at ASC")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![project_id], |row| {
            Ok(Automation {
                id: row.get(0)?,
                project_id: row.get(1)?,
                name: row.get(2)?,
                steps: row.get(3)?,
                created_at: row.get(4)?,
                updated_at: row.get(5)?,
                env_id: row.get(6)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_automation(
    db: tauri::State<Database>,
    project_id: i64,
    name: String,
    steps: String,
) -> Result<Automation, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO automations (project_id, name, steps) VALUES (?1, ?2, ?3)",
        params![project_id, name, steps],
    )
    .map_err(|e| e.to_string())?;
    let id = conn.last_insert_rowid();
    conn.query_row(
        "SELECT id, project_id, name, steps, created_at, updated_at, env_id FROM automations WHERE id = ?1",
        params![id],
        |row| Ok(Automation {
            id: row.get(0)?,
            project_id: row.get(1)?,
            name: row.get(2)?,
            steps: row.get(3)?,
            created_at: row.get(4)?,
            updated_at: row.get(5)?,
            env_id: row.get(6)?,
        }),
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_automation(
    db: tauri::State<Database>,
    id: i64,
    name: String,
    steps: String,
    env_id: Option<Option<i64>>,
) -> Result<Automation, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    match env_id {
        Some(eid) => conn.execute(
            "UPDATE automations SET name = ?1, steps = ?2, env_id = ?3, updated_at = CURRENT_TIMESTAMP WHERE id = ?4",
            params![name, steps, eid, id],
        ),
        None => conn.execute(
            "UPDATE automations SET name = ?1, steps = ?2, updated_at = CURRENT_TIMESTAMP WHERE id = ?3",
            params![name, steps, id],
        ),
    }
    .map_err(|e| e.to_string())?;
    conn.query_row(
        "SELECT id, project_id, name, steps, created_at, updated_at, env_id FROM automations WHERE id = ?1",
        params![id],
        |row| Ok(Automation {
            id: row.get(0)?,
            project_id: row.get(1)?,
            name: row.get(2)?,
            steps: row.get(3)?,
            created_at: row.get(4)?,
            updated_at: row.get(5)?,
            env_id: row.get(6)?,
        }),
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_automation(db: tauri::State<Database>, id: i64) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM automations WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn save_automation_run(
    db: tauri::State<Database>,
    automation_id: i64,
    status: String,
    results: String,
    duration_ms: i64,
) -> Result<AutomationRun, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO automation_runs (automation_id, status, results, duration_ms) VALUES (?1, ?2, ?3, ?4)",
        params![automation_id, status, results, duration_ms],
    )
    .map_err(|e| e.to_string())?;
    let id = conn.last_insert_rowid();
    conn.query_row(
        "SELECT id, automation_id, status, results, duration_ms, created_at FROM automation_runs WHERE id = ?1",
        params![id],
        |row| Ok(AutomationRun {
            id: row.get(0)?,
            automation_id: row.get(1)?,
            status: row.get(2)?,
            results: row.get(3)?,
            duration_ms: row.get(4)?,
            created_at: row.get(5)?,
        }),
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_automation_runs(
    db: tauri::State<Database>,
    automation_id: i64,
    limit: i64,
) -> Result<Vec<AutomationRun>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, automation_id, status, results, duration_ms, created_at FROM automation_runs WHERE automation_id = ?1 ORDER BY created_at DESC LIMIT ?2")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![automation_id, limit], |row| {
            Ok(AutomationRun {
                id: row.get(0)?,
                automation_id: row.get(1)?,
                status: row.get(2)?,
                results: row.get(3)?,
                duration_ms: row.get(4)?,
                created_at: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn clear_automation_runs(db: tauri::State<Database>, automation_id: i64) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM automation_runs WHERE automation_id = ?1", params![automation_id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn delete_automation_run(db: tauri::State<Database>, id: i64) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM automation_runs WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

// --- Data file commands ---

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DataFile {
    pub id: i64,
    pub project_id: i64,
    pub name: String,
    pub content: String,
    pub created_at: String,
    pub updated_at: String,
}

#[tauri::command]
pub fn list_data_files(
    db: tauri::State<Database>,
    project_id: i64,
) -> Result<Vec<DataFile>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT id, project_id, name, content, created_at, updated_at
             FROM data_files WHERE project_id = ?1 ORDER BY created_at ASC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(params![project_id], |row| {
            Ok(DataFile {
                id: row.get(0)?,
                project_id: row.get(1)?,
                name: row.get(2)?,
                content: row.get(3)?,
                created_at: row.get(4)?,
                updated_at: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_data_file(
    db: tauri::State<Database>,
    project_id: i64,
    name: String,
    content: String,
) -> Result<DataFile, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT INTO data_files (project_id, name, content) VALUES (?1, ?2, ?3)",
        params![project_id, name, content],
    )
    .map_err(|e| e.to_string())?;

    let id = conn.last_insert_rowid();

    conn.query_row(
        "SELECT id, project_id, name, content, created_at, updated_at FROM data_files WHERE id = ?1",
        params![id],
        |row| Ok(DataFile {
            id: row.get(0)?,
            project_id: row.get(1)?,
            name: row.get(2)?,
            content: row.get(3)?,
            created_at: row.get(4)?,
            updated_at: row.get(5)?,
        }),
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_data_file(
    db: tauri::State<Database>,
    id: i64,
    name: String,
    content: String,
) -> Result<DataFile, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    conn.execute(
        "UPDATE data_files SET name = ?1, content = ?2, updated_at = CURRENT_TIMESTAMP WHERE id = ?3",
        params![name, content, id],
    )
    .map_err(|e| e.to_string())?;

    conn.query_row(
        "SELECT id, project_id, name, content, created_at, updated_at FROM data_files WHERE id = ?1",
        params![id],
        |row| Ok(DataFile {
            id: row.get(0)?,
            project_id: row.get(1)?,
            name: row.get(2)?,
            content: row.get(3)?,
            created_at: row.get(4)?,
            updated_at: row.get(5)?,
        }),
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_data_file(db: tauri::State<Database>, id: i64) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM data_files WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

// --- Cookie jar commands ---

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Cookie {
    pub id: i64,
    pub project_id: i64,
    pub domain: String,
    pub path: String,
    pub name: String,
    pub value: String,
    pub expires: Option<i64>,
    pub secure: bool,
    pub http_only: bool,
    pub same_site: Option<String>,
}

#[tauri::command]
pub fn list_cookies(db: tauri::State<Database>, project_id: i64) -> Result<Vec<Cookie>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT id, project_id, domain, path, name, value, expires, secure, http_only, same_site
             FROM cookies WHERE project_id = ?1 ORDER BY domain, name",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![project_id], |row| {
            Ok(Cookie {
                id: row.get(0)?,
                project_id: row.get(1)?,
                domain: row.get(2)?,
                path: row.get(3)?,
                name: row.get(4)?,
                value: row.get(5)?,
                expires: row.get(6)?,
                secure: row.get::<_, i64>(7)? != 0,
                http_only: row.get::<_, i64>(8)? != 0,
                same_site: row.get(9)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_cookie(db: tauri::State<Database>, id: i64) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM cookies WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn clear_cookies(
    db: tauri::State<Database>,
    project_id: i64,
    domain: Option<String>,
) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    match domain {
        Some(d) => conn.execute(
            "DELETE FROM cookies WHERE project_id = ?1 AND domain = ?2",
            params![project_id, d],
        ),
        None => conn.execute(
            "DELETE FROM cookies WHERE project_id = ?1",
            params![project_id],
        ),
    }
    .map_err(|e| e.to_string())?;
    Ok(())
}
