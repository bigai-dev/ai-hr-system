-- Org-wide scheduling configuration for self-serve booking links.
--
-- Single-row design: every read uses id = 'default'. We seed the row with
-- sensible defaults (Asia/Kuala_Lumpur, Mon-Fri 9-17) so existing booking
-- links keep working without any manual setup.

CREATE TABLE IF NOT EXISTS scheduling_config (
  id                       TEXT PRIMARY KEY DEFAULT 'default',
  timezone                 TEXT NOT NULL DEFAULT 'Asia/Kuala_Lumpur',
  working_days             TEXT NOT NULL DEFAULT '1,2,3,4,5', -- CSV, 0=Sun..6=Sat
  start_hour               INTEGER NOT NULL DEFAULT 9
                           CHECK (start_hour BETWEEN 0 AND 23),
  end_hour                 INTEGER NOT NULL DEFAULT 17
                           CHECK (end_hour BETWEEN 1 AND 24),
  slot_interval_minutes    INTEGER NOT NULL DEFAULT 30
                           CHECK (slot_interval_minutes IN (15,20,30,45,60)),
  buffer_hours_from_now    INTEGER NOT NULL DEFAULT 24
                           CHECK (buffer_hours_from_now BETWEEN 0 AND 168),
  lookahead_days           INTEGER NOT NULL DEFAULT 14
                           CHECK (lookahead_days BETWEEN 1 AND 60),
  updated_at               TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO scheduling_config (id) VALUES ('default');
