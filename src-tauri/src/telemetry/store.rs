//! SQLite-backed telemetry queue with 1MB cap.

use rusqlite::{Connection, params};
use std::path::PathBuf;
use std::sync::Mutex;

use crate::telemetry::event::TelemetryEvent;

const MAX_QUEUE_BYTES: usize = 1_048_576; // 1 MB
const BATCH_SIZE: usize = 50;

#[derive(thiserror::Error, Debug)]
pub enum StoreError {
    #[error("SQLite error: {0}")]
    Sqlite(#[from] rusqlite::Error),
    #[error("Serialization error: {0}")]
    Serde(#[from] serde_json::Error),
}

pub struct TelemetryStore {
    conn: Mutex<Connection>,
}

impl TelemetryStore {
    pub fn new(app_data_dir: PathBuf) -> Result<Self, StoreError> {
        let db_path = app_data_dir.join("telemetry_queue.db");
        let conn = Connection::open(db_path)?;

        conn.execute(
            "CREATE TABLE IF NOT EXISTS telemetry_queue (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                payload TEXT NOT NULL,
                severity TEXT NOT NULL,
                enqueued_at INTEGER NOT NULL,
                attempts INTEGER NOT NULL DEFAULT 0,
                next_retry_at INTEGER
            )",
            [],
        )?;

        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_telemetry_queue_ready
             ON telemetry_queue(next_retry_at, id)",
            [],
        )?;

        Ok(Self {
            conn: Mutex::new(conn),
        })
    }

    /// Enqueue an event. If queue exceeds 1MB, drop oldest 100 rows.
    pub fn enqueue(&self, event: TelemetryEvent) -> Result<(), StoreError> {
        let conn = self.conn.lock().unwrap();

        let payload_json = serde_json::to_string(&event.payload)?;
        let enqueued_at = event.enqueued_at.timestamp_millis();

        conn.execute(
            "INSERT INTO telemetry_queue (payload, severity, enqueued_at, attempts, next_retry_at)
             VALUES (?1, ?2, ?3, 0, NULL)",
            params![payload_json, event.severity.as_str(), enqueued_at],
        )?;

        // Check size and enforce cap
        let size: i64 = conn.query_row(
            "SELECT page_count * page_size FROM pragma_page_count(), pragma_page_size()",
            [],
            |row| row.get(0),
        )?;

        if size as usize > MAX_QUEUE_BYTES {
            conn.execute(
                "DELETE FROM telemetry_queue WHERE id IN (
                    SELECT id FROM telemetry_queue ORDER BY id ASC LIMIT 100
                )",
                [],
            )?;
        }

        Ok(())
    }

    /// Take up to `limit` events that are ready to send (next_retry_at is NULL or <= now).
    pub fn take_batch(&self, limit: usize, now_ms: i64) -> Result<Vec<QueuedEvent>, StoreError> {
        let conn = self.conn.lock().unwrap();

        let mut stmt = conn.prepare(
            "SELECT id, payload, severity, enqueued_at, attempts
             FROM telemetry_queue
             WHERE next_retry_at IS NULL OR next_retry_at <= ?1
             ORDER BY id ASC
             LIMIT ?2",
        )?;

        let rows = stmt.query_map(params![now_ms, limit], |row| {
            Ok(QueuedEvent {
                id: row.get(0)?,
                payload: row.get(1)?,
                severity: row.get(2)?,
                enqueued_at: row.get(3)?,
                attempts: row.get(4)?,
            })
        })?;

        let mut events = Vec::new();
        for row in rows {
            events.push(row?);
        }

        Ok(events)
    }

    /// Delete events by ID (after successful send).
    pub fn delete_batch(&self, ids: &[i64]) -> Result<(), StoreError> {
        if ids.is_empty() {
            return Ok(());
        }

        let conn = self.conn.lock().unwrap();
        let placeholders = ids.iter().map(|_| "?").collect::<Vec<_>>().join(",");
        let sql = format!("DELETE FROM telemetry_queue WHERE id IN ({})", placeholders);

        let params: Vec<&dyn rusqlite::ToSql> = ids.iter().map(|id| id as &dyn rusqlite::ToSql).collect();
        conn.execute(&sql, params.as_slice())?;

        Ok(())
    }

    /// Reschedule events for retry (after transient failure).
    pub fn reschedule_batch(&self, ids: &[i64], delay_ms: i64) -> Result<(), StoreError> {
        if ids.is_empty() {
            return Ok(());
        }

        let conn = self.conn.lock().unwrap();
        let now_ms = chrono::Utc::now().timestamp_millis();
        let next_retry = now_ms + delay_ms;

        let placeholders = ids.iter().map(|_| "?").collect::<Vec<_>>().join(",");
        let sql = format!(
            "UPDATE telemetry_queue SET attempts = attempts + 1, next_retry_at = ?1 WHERE id IN ({})",
            placeholders
        );

        let mut params: Vec<&dyn rusqlite::ToSql> = vec![&next_retry];
        params.extend(ids.iter().map(|id| id as &dyn rusqlite::ToSql));

        conn.execute(&sql, params.as_slice())?;

        Ok(())
    }

    /// Dump all queued events (for `omnix --telemetry-dump` command).
    pub fn dump_all(&self) -> Result<Vec<QueuedEvent>, StoreError> {
        let conn = self.conn.lock().unwrap();

        let mut stmt = conn.prepare(
            "SELECT id, payload, severity, enqueued_at, attempts FROM telemetry_queue ORDER BY id ASC",
        )?;

        let rows = stmt.query_map([], |row| {
            Ok(QueuedEvent {
                id: row.get(0)?,
                payload: row.get(1)?,
                severity: row.get(2)?,
                enqueued_at: row.get(3)?,
                attempts: row.get(4)?,
            })
        })?;

        let mut events = Vec::new();
        for row in rows {
            events.push(row?);
        }

        Ok(events)
    }
}

#[derive(Debug, Clone)]
pub struct QueuedEvent {
    pub id: i64,
    pub payload: String,
    pub severity: String,
    pub enqueued_at: i64,
    pub attempts: i32,
}
