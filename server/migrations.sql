-- Spec §5 — DDL for the tickets table.
-- Postgres syntax in the spec is adapted to SQLite here:
--   VARCHAR(n) → TEXT (SQLite ignores length anyway)
--   TIMESTAMPTZ → TEXT (we store ISO 8601 strings — the timezone is always 'Z')
--   now()       → CURRENT_TIMESTAMP
CREATE TABLE IF NOT EXISTS tickets (
  issue_key    TEXT    PRIMARY KEY,
  issue_type   TEXT    NOT NULL,
  team_key     TEXT    NOT NULL,
  team         TEXT    NOT NULL,
  project      TEXT    NOT NULL,
  summary      TEXT    NOT NULL,
  points       INTEGER NOT NULL DEFAULT 0,
  assignee     TEXT    NOT NULL,
  display_name TEXT    NOT NULL,
  agent_check  TEXT    NOT NULL,
  status       TEXT    NOT NULL,
  action       TEXT    NOT NULL,
  event_time   TEXT    NOT NULL,
  updated_at   TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tickets_team_key   ON tickets (team_key);
CREATE INDEX IF NOT EXISTS idx_tickets_status     ON tickets (status);
CREATE INDEX IF NOT EXISTS idx_tickets_assignee   ON tickets (assignee);
CREATE INDEX IF NOT EXISTS idx_tickets_event_time ON tickets (event_time DESC);

-- Activity-log durable history (v10.228). Audit events (config saves, ticket
-- writes, ...) and server errors are persisted here; the live tail uses an
-- in-memory ring buffer (see server/logs/log-bus.ts). detail is a JSON string.
CREATE TABLE IF NOT EXISTS audit_log (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  ts        TEXT    NOT NULL,
  level     TEXT    NOT NULL,
  evt       TEXT,
  msg       TEXT    NOT NULL DEFAULT '',
  source    TEXT,
  ip        TEXT,
  team_key  TEXT,
  detail    TEXT
);

CREATE INDEX IF NOT EXISTS idx_audit_ts  ON audit_log (ts DESC);
CREATE INDEX IF NOT EXISTS idx_audit_evt ON audit_log (evt);
