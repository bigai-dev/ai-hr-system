-- Self-serve scheduling: booking links are short-lived tokens a recruiter
-- generates on a candidate, then shares with that candidate. The candidate
-- opens /book/<token>, picks a slot, and we create the interview row.
--
-- One-shot: a link is consumed when booked_interview_id is set.

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
