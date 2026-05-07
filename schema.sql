-- RECRUIT.AI — Turso / libSQL schema
-- Run once against a fresh Turso database:
--   turso db shell recruit-ai < schema.sql

CREATE TABLE IF NOT EXISTS jobs (
  id                    TEXT PRIMARY KEY,
  title                 TEXT NOT NULL,
  summary               TEXT NOT NULL DEFAULT '',
  responsibilities      TEXT NOT NULL DEFAULT '',
  required_skills       TEXT NOT NULL DEFAULT '',  -- comma-separated
  nice_to_have_skills   TEXT NOT NULL DEFAULT '',  -- comma-separated
  min_years_experience  INTEGER NOT NULL DEFAULT 0,
  additional_notes      TEXT NOT NULL DEFAULT '',
  status                TEXT NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active', 'archived')),
  hiring_manager_email  TEXT,
  created_at            TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);

CREATE TABLE IF NOT EXISTS applicants (
  id                       TEXT PRIMARY KEY,
  name                     TEXT NOT NULL,
  email                    TEXT NOT NULL,
  phone                    TEXT,
  job_title                TEXT,                  -- candidate's CURRENT title
  job_id                   TEXT REFERENCES jobs(id), -- the role they applied for
  years_experience         INTEGER DEFAULT 0,
  cover_letter             TEXT,
  resume_url               TEXT,
  resume_text              TEXT,
  status                   TEXT NOT NULL DEFAULT 'new'
                           CHECK (status IN (
                             'new','screening','screened',
                             'phone_screen','onsite','offer','hired',
                             'rejected','archived','withdrawn'
                           )),
  ai_match_score           REAL,
  ai_reasoning             TEXT,
  ai_extracted_skills      TEXT, -- JSON array, stored as text
  screen_input_tokens      INTEGER,
  screen_output_tokens     INTEGER,
  screen_cost_micros       INTEGER, -- USD cost in micros (1e-6 USD), nullable until screened
  manual_review_required   INTEGER NOT NULL DEFAULT 0,
  stage_changed_at         TEXT NOT NULL DEFAULT (datetime('now')),
  created_at               TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at               TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_applicants_status
  ON applicants(status);
CREATE INDEX IF NOT EXISTS idx_applicants_score
  ON applicants(ai_match_score DESC);
CREATE INDEX IF NOT EXISTS idx_applicants_job
  ON applicants(job_id);
CREATE INDEX IF NOT EXISTS idx_applicants_stage_changed_at
  ON applicants(stage_changed_at DESC);

CREATE TABLE IF NOT EXISTS interviews (
  id                TEXT PRIMARY KEY,
  applicant_id      TEXT NOT NULL REFERENCES applicants(id) ON DELETE CASCADE,
  scheduled_date    TEXT NOT NULL, -- YYYY-MM-DD
  scheduled_time    TEXT NOT NULL, -- HH:MM
  duration_minutes  INTEGER DEFAULT 30,
  type              TEXT DEFAULT 'Technical Screen',
  status            TEXT NOT NULL DEFAULT 'scheduled'
                    CHECK (status IN ('scheduled','confirmed','completed','cancelled')),
  interviewer_name  TEXT,
  interviewer_email TEXT,
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS interview_scorecards (
  id                TEXT PRIMARY KEY,
  interview_id      TEXT NOT NULL REFERENCES interviews(id) ON DELETE CASCADE,
  applicant_id      TEXT NOT NULL REFERENCES applicants(id) ON DELETE CASCADE,
  job_id            TEXT REFERENCES jobs(id) ON DELETE SET NULL,
  interviewer_name  TEXT,
  interviewer_email TEXT,
  overall_rating    INTEGER NOT NULL CHECK (overall_rating BETWEEN 1 AND 5),
  recommendation    TEXT NOT NULL
                    CHECK (recommendation IN (
                      'strong_hire','hire','no_hire','strong_no_hire'
                    )),
  skill_ratings     TEXT, -- JSON: { "<skill>": 1..5 | null }
  notes             TEXT,
  submitted_at      TEXT NOT NULL DEFAULT (datetime('now')),
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_scorecards_interview
  ON interview_scorecards(interview_id);
CREATE INDEX IF NOT EXISTS idx_scorecards_applicant
  ON interview_scorecards(applicant_id);
CREATE INDEX IF NOT EXISTS idx_scorecards_submitted_at
  ON interview_scorecards(submitted_at DESC);

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

CREATE TABLE IF NOT EXISTS outgoing_emails (
  id              TEXT PRIMARY KEY,
  to_email        TEXT NOT NULL,
  subject         TEXT NOT NULL,
  body            TEXT NOT NULL,
  category        TEXT NOT NULL
                  CHECK (category IN (
                    'application_acknowledgement','rejection',
                    'interview_invite','scorecard_reminder',
                    'weekly_digest','other'
                  )),
  applicant_id    TEXT REFERENCES applicants(id) ON DELETE SET NULL,
  job_id          TEXT REFERENCES jobs(id) ON DELETE SET NULL,
  delivery_status TEXT NOT NULL
                  CHECK (delivery_status IN ('sent','mocked','failed')),
  provider_id     TEXT,
  error           TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_outgoing_emails_created_at
  ON outgoing_emails(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_outgoing_emails_applicant
  ON outgoing_emails(applicant_id);
CREATE INDEX IF NOT EXISTS idx_outgoing_emails_category
  ON outgoing_emails(category);

CREATE TABLE IF NOT EXISTS email_templates (
  id          TEXT PRIMARY KEY CHECK (id IN (
                'application_acknowledgement','rejection','interview_invite'
              )),
  subject     TEXT NOT NULL,
  body        TEXT NOT NULL,
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS scheduling_config (
  id                       TEXT PRIMARY KEY DEFAULT 'default',
  timezone                 TEXT NOT NULL DEFAULT 'Asia/Kuala_Lumpur',
  working_days             TEXT NOT NULL DEFAULT '1,2,3,4,5',
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

CREATE TABLE IF NOT EXISTS booking_links (
  id                  TEXT PRIMARY KEY,
  token               TEXT NOT NULL UNIQUE,
  applicant_id        TEXT NOT NULL REFERENCES applicants(id) ON DELETE CASCADE,
  interview_type      TEXT NOT NULL,
  duration_minutes    INTEGER NOT NULL,
  expires_at          TEXT NOT NULL,
  booked_interview_id TEXT REFERENCES interviews(id) ON DELETE SET NULL,
  created_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_booking_links_token
  ON booking_links(token);
CREATE INDEX IF NOT EXISTS idx_booking_links_applicant
  ON booking_links(applicant_id);

CREATE TABLE IF NOT EXISTS rate_limit_events (
  id   INTEGER PRIMARY KEY AUTOINCREMENT,
  key  TEXT NOT NULL,
  ts   INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rate_key_ts
  ON rate_limit_events(key, ts);
