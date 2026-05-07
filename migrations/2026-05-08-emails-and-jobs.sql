-- Auto-emails foundation:
--   - outgoing_emails: audit log of every email the system sends or mocks.
--     The 'mocked' status is used in dev / when RESEND_API_KEY is not set.
--   - jobs.hiring_manager_email: who gets the weekly digest (Phase 4).

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

ALTER TABLE jobs ADD COLUMN hiring_manager_email TEXT;
