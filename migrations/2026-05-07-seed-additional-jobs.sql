-- Apply with: turso db shell ai-hr-system < migrations/2026-05-07-seed-additional-jobs.sql
--
-- Seed data (not a schema migration). Adds four sample roles across
-- Design, Data, Marketing, and Customer Success so the apply-form
-- dropdown has variety for the workshop demo.
--
-- INSERT OR IGNORE so re-running is safe — existing rows with these
-- IDs are left alone.
--
-- Note: the legacy `description` column is NOT NULL with no default,
-- so we pass '' for it. The structured fields (summary, responsibilities,
-- etc.) are what the AI prompt actually uses.

INSERT OR IGNORE INTO jobs (
  id, title, description,
  summary, responsibilities, required_skills,
  nice_to_have_skills, min_years_experience, additional_notes, status
) VALUES (
  '00000000-0000-4000-8000-000000000002',
  'Product Designer',
  '',
  'Lead product design for RecruitAI''s hiring tools — recruiter dashboards, candidate-facing flows, and AI-driven workflows. Remote-friendly, Singapore preferred.',
  '- Own end-to-end design for new features, from research to high-fidelity prototypes
- Collaborate with PM and engineering to ship usable, polished UI
- Run lightweight user research with recruiters and candidates
- Maintain and evolve the design system
- Champion accessibility and clarity across the product',
  'Figma, UI/UX design, design systems, prototyping, user research, written communication',
  'Webflow, motion design, B2B SaaS experience, HR/ATS domain, Tailwind CSS familiarity',
  4,
  'We work async-first across timezones; written specs and recorded walkthroughs are part of the role.',
  'active'
);

INSERT OR IGNORE INTO jobs (
  id, title, description,
  summary, responsibilities, required_skills,
  nice_to_have_skills, min_years_experience, additional_notes, status
) VALUES (
  '00000000-0000-4000-8000-000000000003',
  'Data Analyst',
  '',
  'Turn product, hiring, and customer data into decisions for RecruitAI''s leadership team. Mid-level, remote.',
  '- Build dashboards and recurring reports on activation, retention, and AI screening quality
- Partner with PM and CS to investigate funnel drop-offs and customer health signals
- Define and maintain north-star metrics and event taxonomy
- Run SQL-heavy ad-hoc analyses for product and growth experiments
- Document findings clearly for non-technical stakeholders',
  'SQL, data visualization (Looker / Metabase / Tableau), Python or R for analysis, statistics, stakeholder communication',
  'dbt, BigQuery / Snowflake, A/B testing, Mixpanel / Amplitude, basic ML literacy',
  3,
  'We''re early on the data infra side — comfort building things from scratch matters more than polished tooling experience.',
  'active'
);

INSERT OR IGNORE INTO jobs (
  id, title, description,
  summary, responsibilities, required_skills,
  nice_to_have_skills, min_years_experience, additional_notes, status
) VALUES (
  '00000000-0000-4000-8000-000000000004',
  'Marketing Manager',
  '',
  'Own go-to-market for RecruitAI in Southeast Asia — content, demand gen, partnerships. Reports to the founder.',
  '- Plan and run quarterly campaigns (paid + organic) targeting HR teams at growing tech companies
- Own the content calendar: blog, LinkedIn, case studies
- Run customer interviews and turn them into positioning and messaging
- Manage paid budget across LinkedIn, Google, and sector publications
- Build co-marketing partnerships with HR tools and communities in the region',
  'B2B SaaS marketing, content marketing, paid acquisition, copywriting, CRM (HubSpot / Salesforce)',
  'HR-tech industry experience, SEO, lifecycle email, event marketing, design tool fluency (Figma / Canva)',
  4,
  'Singapore base preferred for in-region events and customer visits.',
  'active'
);

INSERT OR IGNORE INTO jobs (
  id, title, description,
  summary, responsibilities, required_skills,
  nice_to_have_skills, min_years_experience, additional_notes, status
) VALUES (
  '00000000-0000-4000-8000-000000000005',
  'Customer Success Manager',
  '',
  'Onboard and grow recruiting teams using RecruitAI. Reduce churn, drive expansion, and surface product gaps.',
  '- Own a portfolio of 30–50 customers from kickoff through renewal
- Run quarterly business reviews; share product updates and best practices
- Triage support escalations and partner with engineering on bug repros
- Identify expansion opportunities and hand off to sales when warranted
- Funnel customer feedback into PM with concrete examples and frequency data',
  'B2B SaaS customer success, account management, written and verbal communication, CRM (HubSpot / Salesforce), Notion / Loom',
  'Recruiting / HR domain knowledge, SQL or basic data fluency, project management, second SEA language',
  3,
  'We''re a small team — this role is hands-on, from running implementations to leading QBRs.',
  'active'
);
