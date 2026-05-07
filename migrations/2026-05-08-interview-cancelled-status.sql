-- Allow 'cancelled' as a valid interview.status. SQLite CHECK constraints
-- can't be altered in place, so recreate the table.
--
-- Existing FK references (interview_scorecards.interview_id, booking_links
-- .booked_interview_id) point to interviews(id) — we disable foreign_keys
-- during the swap so the temporary rename doesn't trigger cascades, then
-- re-enable. Data is copied verbatim; ids stay the same so FKs are valid
-- against the new table.

PRAGMA foreign_keys = OFF;

CREATE TABLE interviews_new (
  id                TEXT PRIMARY KEY,
  applicant_id      TEXT NOT NULL REFERENCES applicants(id) ON DELETE CASCADE,
  scheduled_date    TEXT NOT NULL,
  scheduled_time    TEXT NOT NULL,
  duration_minutes  INTEGER DEFAULT 30,
  type              TEXT DEFAULT 'Technical Screen',
  status            TEXT NOT NULL DEFAULT 'scheduled'
                    CHECK (status IN ('scheduled','confirmed','completed','cancelled')),
  interviewer_name  TEXT,
  interviewer_email TEXT,
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO interviews_new
  (id, applicant_id, scheduled_date, scheduled_time, duration_minutes,
   type, status, interviewer_name, interviewer_email, created_at)
SELECT
  id, applicant_id, scheduled_date, scheduled_time, duration_minutes,
  type, status, interviewer_name, interviewer_email, created_at
FROM interviews;

DROP TABLE interviews;
ALTER TABLE interviews_new RENAME TO interviews;

CREATE INDEX IF NOT EXISTS idx_interviews_scheduled_date
  ON interviews(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_interviews_applicant_id
  ON interviews(applicant_id);

PRAGMA foreign_keys = ON;
