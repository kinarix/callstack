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
    pub position: i64,
    pub created_at: String,
    pub updated_at: String,
    pub imported: bool,
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
}

pub struct Database {
    pub conn: Mutex<Connection>,
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
                FOREIGN KEY (project_id) REFERENCES projects(id)
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
                FOREIGN KEY (request_id) REFERENCES requests(id)
            );
            CREATE TABLE IF NOT EXISTS folders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (project_id) REFERENCES projects(id)
            );
            CREATE TABLE IF NOT EXISTS environments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                variables TEXT NOT NULL DEFAULT '[]',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (project_id) REFERENCES projects(id)
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

        // Migrate requests table to add position column
        let _ = conn.execute(
            "ALTER TABLE requests ADD COLUMN position INTEGER DEFAULT 0",
            [],
        );
        // Seed positions for existing rows so ordering is stable
        let _ = conn.execute(
            "UPDATE requests SET position = rowid WHERE position = 0",
            [],
        );
        let _ = conn.execute(
            "ALTER TABLE requests ADD COLUMN imported INTEGER NOT NULL DEFAULT 0",
            [],
        );
        let _ = conn.execute(
            "ALTER TABLE folders ADD COLUMN imported INTEGER NOT NULL DEFAULT 0",
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
            "SELECT id, project_id, folder_id, user_email, name, method, url, params, headers, body, attachments, position, created_at, updated_at, imported
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
        "SELECT id, project_id, folder_id, user_email, name, method, url, params, headers, body, attachments, position, created_at, updated_at, imported FROM requests WHERE id = ?1",
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
        "SELECT id, project_id, folder_id, user_email, name, method, url, params, headers, body, attachments, position, created_at, updated_at, imported FROM requests WHERE id = ?1",
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
    // Move requests in this folder to project root (preserve them)
    conn.execute(
        "UPDATE requests SET folder_id = NULL WHERE folder_id = ?1",
        params![id],
    )
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
        "INSERT INTO requests (project_id, folder_id, user_email, name, method, url, params, headers, body, attachments, position)
         SELECT project_id, folder_id, user_email, 'Copy of ' || name, method, url, params, headers, body, COALESCE(attachments, '[]'), ?2
         FROM requests WHERE id = ?1",
        params![id, new_position],
    )
    .map_err(|e| e.to_string())?;

    let new_id = conn.last_insert_rowid();

    conn.query_row(
        "SELECT id, project_id, folder_id, user_email, name, method, url, params, headers, body, attachments, position, created_at, updated_at, imported FROM requests WHERE id = ?1",
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
        "INSERT INTO requests (project_id, folder_id, user_email, name, method, url, params, headers, body, attachments, position)
         SELECT project_id, ?2, user_email, name, method, url, params, headers, body, COALESCE(attachments, '[]'), position
         FROM requests WHERE folder_id = ?1",
        params![id, new_folder_id],
    )
    .map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare(
            "SELECT id, project_id, folder_id, user_email, name, method, url, params, headers, body, attachments, position, created_at, updated_at, imported
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
            "INSERT INTO requests (project_id, folder_id, user_email, name, method, url, params, headers, body, attachments, position, imported, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, '[]', ?10, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
            params![project_id, folder_id, user_email, req.name, req.method, req.url, req.params, req.headers, req.body, pos as i64],
        )
        .map_err(|e| e.to_string())?;

        let id = conn.last_insert_rowid();
        let request = conn
            .query_row(
                "SELECT id, project_id, folder_id, user_email, name, method, url, params, headers, body, attachments, position, created_at, updated_at, imported FROM requests WHERE id = ?1",
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
) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO responses (request_id, status, status_text, headers, body, time_ms, size, timestamp_ms) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![request_id, status, status_text, headers, body, time_ms, size, timestamp_ms],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn get_last_response(
    db: tauri::State<Database>,
    request_id: i64,
) -> Result<Option<StoredResponse>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let result = conn.query_row(
        "SELECT id, request_id, status, status_text, headers, body, time_ms, size, timestamp_ms FROM responses WHERE request_id = ?1 ORDER BY id DESC LIMIT 1",
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
            "SELECT id, project_id, name, variables, created_at, updated_at
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
                created_at: row.get(4)?,
                updated_at: row.get(5)?,
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
        "SELECT id, project_id, name, variables, created_at, updated_at FROM environments WHERE id = ?1",
        params![id],
        |row| Ok(Environment {
            id: row.get(0)?,
            project_id: row.get(1)?,
            name: row.get(2)?,
            variables: row.get(3)?,
            created_at: row.get(4)?,
            updated_at: row.get(5)?,
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
        "SELECT id, project_id, name, variables, created_at, updated_at FROM environments WHERE id = ?1",
        params![id],
        |row| Ok(Environment {
            id: row.get(0)?,
            project_id: row.get(1)?,
            name: row.get(2)?,
            variables: row.get(3)?,
            created_at: row.get(4)?,
            updated_at: row.get(5)?,
        }),
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_environment(db: tauri::State<Database>, id: i64) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM environments WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}
