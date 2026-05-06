-- Apply with: turso db shell recruit-ai < migrations/2026-05-06-rate-limit-events.sql

CREATE TABLE IF NOT EXISTS rate_limit_events (
  id   INTEGER PRIMARY KEY AUTOINCREMENT,
  key  TEXT NOT NULL,
  ts   INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rate_key_ts
  ON rate_limit_events(key, ts);
