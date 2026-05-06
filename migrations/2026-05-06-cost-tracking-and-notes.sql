-- Apply with: turso db shell recruit-ai < migrations/2026-05-06-cost-tracking-and-notes.sql
--
-- Notes:
-- 1. SQLite cannot ADD CHECK constraints to existing columns. The constraints
--    on the `status` columns in schema.sql apply only to NEW installs. For
--    existing DBs, status validation is enforced at the application layer
--    (Zod schemas in src/lib/schemas.ts).
-- 2. ALTER TABLE ADD COLUMN does not support IF NOT EXISTS in older libSQL.
--    If a column already exists, the statement will fail and you can
--    comment it out and re-run.

ALTER TABLE applicants ADD COLUMN screen_input_tokens INTEGER;
ALTER TABLE applicants ADD COLUMN screen_output_tokens INTEGER;
ALTER TABLE applicants ADD COLUMN screen_cost_micros INTEGER;
ALTER TABLE applicants ADD COLUMN manual_review_required INTEGER NOT NULL DEFAULT 0;

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
