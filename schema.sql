-- RECRUIT.AI — Turso / libSQL schema
-- Run once against a fresh Turso database:
--   turso db shell recruit-ai < schema.sql

CREATE TABLE IF NOT EXISTS applicants (
  id                       TEXT PRIMARY KEY,
  name                     TEXT NOT NULL,
  email                    TEXT NOT NULL,
  phone                    TEXT,
  job_title                TEXT,
  years_experience         INTEGER DEFAULT 0,
  cover_letter             TEXT,
  resume_url               TEXT,
  resume_text              TEXT,
  status                   TEXT NOT NULL DEFAULT 'new'
                           CHECK (status IN ('new','screening','screened','scheduled','rejected')),
  ai_match_score           REAL,
  ai_reasoning             TEXT,
  ai_extracted_skills      TEXT, -- JSON array, stored as text
  screen_input_tokens      INTEGER,
  screen_output_tokens     INTEGER,
  screen_cost_micros       INTEGER, -- USD cost in micros (1e-6 USD), nullable until screened
  manual_review_required   INTEGER NOT NULL DEFAULT 0,
  created_at               TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at               TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_applicants_status
  ON applicants(status);
CREATE INDEX IF NOT EXISTS idx_applicants_score
  ON applicants(ai_match_score DESC);

CREATE TABLE IF NOT EXISTS interviews (
  id                TEXT PRIMARY KEY,
  applicant_id      TEXT NOT NULL REFERENCES applicants(id) ON DELETE CASCADE,
  scheduled_date    TEXT NOT NULL, -- YYYY-MM-DD
  scheduled_time    TEXT NOT NULL, -- HH:MM
  duration_minutes  INTEGER DEFAULT 30,
  type              TEXT DEFAULT 'Technical Screen',
  status            TEXT NOT NULL DEFAULT 'scheduled'
                    CHECK (status IN ('scheduled','confirmed','completed')),
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS applicant_notes (
  id            TEXT PRIMARY KEY,
  applicant_id  TEXT NOT NULL REFERENCES applicants(id) ON DELETE CASCADE,
  body          TEXT NOT NULL,
  created_by    TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_notes_applicant
  ON applicant_notes(applicant_id);

CREATE INDEX IF NOT EXISTS idx_interviews_date
  ON interviews(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_interviews_applicant
  ON interviews(applicant_id);

CREATE TABLE IF NOT EXISTS rate_limit_events (
  id   INTEGER PRIMARY KEY AUTOINCREMENT,
  key  TEXT NOT NULL,
  ts   INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rate_key_ts
  ON rate_limit_events(key, ts);
