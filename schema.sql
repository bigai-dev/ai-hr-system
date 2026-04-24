-- RECRUIT.AI — Turso / libSQL schema
-- Run once against a fresh Turso database:
--   turso db shell recruit-ai < schema.sql

CREATE TABLE IF NOT EXISTS applicants (
  id                   TEXT PRIMARY KEY,
  name                 TEXT NOT NULL,
  email                TEXT NOT NULL,
  phone                TEXT,
  job_title            TEXT,
  years_experience     INTEGER DEFAULT 0,
  cover_letter         TEXT,
  resume_url           TEXT,
  resume_text          TEXT,
  status               TEXT NOT NULL DEFAULT 'new',
  ai_match_score       REAL,
  ai_reasoning         TEXT,
  ai_extracted_skills  TEXT, -- JSON array, stored as text
  created_at           TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at           TEXT NOT NULL DEFAULT (datetime('now'))
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
  status            TEXT NOT NULL DEFAULT 'scheduled',
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_interviews_date
  ON interviews(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_interviews_applicant
  ON interviews(applicant_id);
