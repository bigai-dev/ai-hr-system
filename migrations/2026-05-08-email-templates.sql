-- Editable email templates for the three candidate-facing auto-emails.
--
-- Internal operational mail (scorecard reminders, weekly digests) is left
-- hardcoded in lib/email-templates.ts because HR doesn't typically tweak
-- those. Each row's id matches an EmailCategory value so the loader can do
-- a direct lookup. Seeded with the exact copy that's currently hardcoded so
-- behaviour doesn't change until someone actually edits a template.

CREATE TABLE IF NOT EXISTS email_templates (
  id          TEXT PRIMARY KEY CHECK (id IN (
                'application_acknowledgement','rejection','interview_invite'
              )),
  subject     TEXT NOT NULL,
  body        TEXT NOT NULL,
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO email_templates (id, subject, body) VALUES
  ('application_acknowledgement',
   'We received your application — {Job_Title}',
   'Hi {Candidate_Name},

Thanks for applying to the {Job_Title} role. We have received your application and our team will be in touch as we review your background.

You don''t need to do anything else right now. If you have any questions, you can reply directly to this email.

— {Company_Name}'),
  ('rejection',
   'Update on your application — {Job_Title}',
   'Hi {Candidate_Name},

Thank you for your interest in the {Job_Title} role and for the time you put into your application.

{Rejection_Reason}{Custom_Note}

We genuinely appreciate the effort you put in and wish you well in your search.

— {Company_Name}'),
  ('interview_invite',
   'Interview confirmed: {Interview_Type} for {Job_Title}',
   'Hi {Candidate_Name},

Your {Interview_Type_Lower} for {Job_Title} is confirmed.

  When: {When}
  Duration: {Duration_Minutes} minutes

You''ll receive joining instructions separately. If you need to reschedule, reply to this email and we''ll send a new booking link.

— {Company_Name}');
