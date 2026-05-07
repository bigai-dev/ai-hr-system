-- Pipeline stages: expand applicant.status enum and track time-in-stage.
--
-- Old: new | screening | screened | scheduled | rejected
-- New: new | screening | screened | phone_screen | onsite | offer | hired
--      | rejected | archived | withdrawn
--
-- 'scheduled' is mapped to 'phone_screen' (the previous default interview type
-- was Technical Screen, which lives in the phone_screen stage of the new pipeline).
-- 'archived' replaces hard-delete in the UI; the row + resume blob are kept for audit.
--
-- SQLite cannot ALTER a CHECK constraint, so we recreate the table.

PRAGMA foreign_keys = OFF;

BEGIN TRANSACTION;

-- 1. New table with the expanded enum + stage_changed_at.
CREATE TABLE applicants_new (
  id                       TEXT PRIMARY KEY,
  name                     TEXT NOT NULL,
  email                    TEXT NOT NULL,
  phone                    TEXT,
  job_title                TEXT,
  job_id                   TEXT REFERENCES jobs(id),
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
  ai_extracted_skills      TEXT,
  screen_input_tokens      INTEGER,
  screen_output_tokens     INTEGER,
  screen_cost_micros       INTEGER,
  manual_review_required   INTEGER NOT NULL DEFAULT 0,
  stage_changed_at         TEXT NOT NULL DEFAULT (datetime('now')),
  created_at               TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at               TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 2. Copy data, mapping 'scheduled' -> 'phone_screen' and seeding stage_changed_at.
INSERT INTO applicants_new (
  id, name, email, phone, job_title, job_id, years_experience,
  cover_letter, resume_url, resume_text, status, ai_match_score,
  ai_reasoning, ai_extracted_skills, screen_input_tokens, screen_output_tokens,
  screen_cost_micros, manual_review_required, stage_changed_at,
  created_at, updated_at
)
SELECT
  id, name, email, phone, job_title, job_id, years_experience,
  cover_letter, resume_url, resume_text,
  CASE status WHEN 'scheduled' THEN 'phone_screen' ELSE status END,
  ai_match_score, ai_reasoning, ai_extracted_skills,
  screen_input_tokens, screen_output_tokens, screen_cost_micros,
  manual_review_required,
  COALESCE(updated_at, created_at),
  created_at, updated_at
FROM applicants;

-- 3. Swap.
DROP TABLE applicants;
ALTER TABLE applicants_new RENAME TO applicants;

-- 4. Indexes (recreated since the table was rebuilt).
CREATE INDEX idx_applicants_status ON applicants(status);
CREATE INDEX idx_applicants_score ON applicants(ai_match_score DESC);
CREATE INDEX idx_applicants_job ON applicants(job_id);
CREATE INDEX idx_applicants_stage_changed_at ON applicants(stage_changed_at DESC);

COMMIT;

PRAGMA foreign_keys = ON;
