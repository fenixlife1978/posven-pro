-- PosVEN Pro desktop offline outbox schema (SQLite).
-- This schema is intentionally isolated from Corte Z and all accounting tables.
-- Every record is scoped to a stable terminalId; operationId is idempotent per terminal.
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
PRAGMA synchronous = FULL;
PRAGMA busy_timeout = 5000;

CREATE TABLE IF NOT EXISTS desktop_meta (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS offline_operations (
  terminal_id TEXT NOT NULL,
  operation_id TEXT NOT NULL,
  operation_type TEXT NOT NULL,
  payload_json TEXT NOT NULL CHECK (json_valid(payload_json)),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','processing','processed','conflict')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  last_error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  next_attempt_at TEXT,
  processed_at TEXT,
  PRIMARY KEY (terminal_id, operation_id)
);

CREATE INDEX IF NOT EXISTS idx_offline_operations_ready
  ON offline_operations (terminal_id, status, next_attempt_at, created_at);

-- A sync acknowledgement is persisted separately so a crash after remote commit
-- but before UI refresh can safely replay the same idempotency key.
CREATE TABLE IF NOT EXISTS offline_sync_receipts (
  terminal_id TEXT NOT NULL,
  operation_id TEXT NOT NULL,
  remote_reference TEXT,
  acknowledged_at TEXT NOT NULL,
  PRIMARY KEY (terminal_id, operation_id),
  FOREIGN KEY (terminal_id, operation_id)
    REFERENCES offline_operations (terminal_id, operation_id)
    ON DELETE CASCADE
);
