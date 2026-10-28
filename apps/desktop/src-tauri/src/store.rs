//! The documents, in a SQLite file in Application Support (~/Library/Application
//! Support/app.andiko.desktop/), where Time Machine backs them up. The page owns the
//! data model (see packages/core/src/store/sqlite.ts): a row is its JSON, keyed by id,
//! and all querying happens there.

use std::{collections::HashMap, error::Error, fs, sync::Mutex};

use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::{AppHandle, Manager, State};

/// `tauri dev` gets its own file, so working on the app never touches real documents.
const FILE_NAME: &str = if cfg!(debug_assertions) { "andiko-dev.db" } else { "andiko.db" };

/// Migration `n` takes the schema from version `n` (PRAGMA user_version) to `n + 1`.
const MIGRATIONS: &[&str] = &["
    CREATE TABLE docs (id TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE folders (id TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE history (id TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE public_copies (id TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE settings (id TEXT PRIMARY KEY, value TEXT NOT NULL);
"];

pub struct Store(Mutex<Connection>);

/// The tables the page may name; SQL only ever sees these fixed names.
#[derive(Clone, Copy, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Table {
    Docs,
    Folders,
    History,
    PublicCopies,
    Settings,
}

impl Table {
    fn name(self) -> &'static str {
        match self {
            Table::Docs => "docs",
            Table::Folders => "folders",
            Table::History => "history",
            Table::PublicCopies => "public_copies",
            Table::Settings => "settings",
        }
    }
}

pub fn open(app: &AppHandle) -> Result<Store, Box<dyn Error>> {
    let dir = app.path().app_data_dir()?;
    fs::create_dir_all(&dir)?;
    let mut conn = Connection::open(dir.join(FILE_NAME))?;
    conn.pragma_update(None, "journal_mode", "WAL")?;
    // saves are debounced, so waiting for the disk on each one costs little
    conn.pragma_update(None, "synchronous", "FULL")?;
    migrate(&mut conn)?;
    Ok(Store(Mutex::new(conn)))
}

fn migrate(conn: &mut Connection) -> rusqlite::Result<()> {
    let mut version: i64 = conn.pragma_query_value(None, "user_version", |row| row.get(0))?;
    while let Some(sql) = MIGRATIONS.get(version as usize) {
        let tx = conn.transaction()?;
        tx.execute_batch(sql)?;
        version += 1;
        tx.pragma_update(None, "user_version", version)?;
        tx.commit()?;
    }
    Ok(())
}

fn parse(text: String) -> rusqlite::Result<Value> {
    serde_json::from_str(&text)
        .map_err(|e| rusqlite::Error::FromSqlConversionFailure(0, rusqlite::types::Type::Text, e.into()))
}

fn values(conn: &Connection, table: Table) -> rusqlite::Result<Vec<Value>> {
    let mut stmt = conn.prepare(&format!("SELECT value FROM {}", table.name()))?;
    let rows = stmt.query_map([], |row| parse(row.get(0)?))?;
    rows.collect()
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Snapshot {
    docs: Vec<Value>,
    folders: Vec<Value>,
    public_copies: Vec<Value>,
    settings: HashMap<String, Value>,
}

/// Every row but the editor histories, which are read one at a time.
#[tauri::command]
pub async fn store_load(store: State<'_, Store>) -> Result<Snapshot, String> {
    let conn = store.0.lock().map_err(|e| e.to_string())?;
    let load = || -> rusqlite::Result<Snapshot> {
        let mut stmt = conn.prepare("SELECT id, value FROM settings")?;
        let settings = stmt
            .query_map([], |row| Ok((row.get(0)?, parse(row.get(1)?)?)))?
            .collect::<rusqlite::Result<_>>()?;
        Ok(Snapshot {
            docs: values(&conn, Table::Docs)?,
            folders: values(&conn, Table::Folders)?,
            public_copies: values(&conn, Table::PublicCopies)?,
            settings,
        })
    };
    load().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn store_get(store: State<'_, Store>, table: Table, id: String) -> Result<Option<Value>, String> {
    let conn = store.0.lock().map_err(|e| e.to_string())?;
    conn.query_row(&format!("SELECT value FROM {} WHERE id = ?1", table.name()), [id], |row| parse(row.get(0)?))
        .optional()
        .map_err(|e| e.to_string())
}

/// Stores `value` under `id`, or deletes the row when it is null.
#[derive(Deserialize)]
pub struct WriteOp {
    table: Table,
    id: String,
    value: Option<Value>,
}

/// Applies the writes all together or not at all.
#[tauri::command]
pub async fn store_write(store: State<'_, Store>, ops: Vec<WriteOp>) -> Result<(), String> {
    let mut conn = store.0.lock().map_err(|e| e.to_string())?;
    let write = || -> rusqlite::Result<()> {
        let tx = conn.transaction()?;
        for op in ops {
            let table = op.table.name();
            match op.value {
                Some(value) => tx
                    .prepare_cached(&format!("INSERT OR REPLACE INTO {table} (id, value) VALUES (?1, ?2)"))?
                    .execute(params![op.id, value.to_string()])?,
                None => tx.prepare_cached(&format!("DELETE FROM {table} WHERE id = ?1"))?.execute([op.id])?,
            };
        }
        tx.commit()
    };
    write().map_err(|e| e.to_string())
}
