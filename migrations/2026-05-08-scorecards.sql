-- Interview scorecards + optional interviewer fields on interviews.
--
-- A scorecard belongs to an interview but multiple are allowed per interview
-- (panel interviews — one scorecard per panelist). interviewer_email is the
-- author identity; for an unauthenticated app it's just a free-text label.
-- applicant_id and job_id are denormalized so the daily reminder query can
-- group by job without a 3-table JOIN.

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

ALTER TABLE interviews ADD COLUMN interviewer_name TEXT;
ALTER TABLE interviews ADD COLUMN interviewer_email TEXT;
