-- Apply with: turso db shell ai-hr-system < migrations/2026-05-07-jobs-structured.sql
--
-- Replace the free-form `description` field on jobs with structured fields
-- that HR can fill in without writing markdown. Old `description` column is
-- kept around (unused) for safety; can be dropped in a later cleanup.
--
-- ALTER TABLE ADD COLUMN is not idempotent on older libSQL — if columns
-- already exist, comment those lines out and re-run.

ALTER TABLE jobs ADD COLUMN summary TEXT NOT NULL DEFAULT '';
ALTER TABLE jobs ADD COLUMN responsibilities TEXT NOT NULL DEFAULT '';
ALTER TABLE jobs ADD COLUMN required_skills TEXT NOT NULL DEFAULT '';      -- comma-separated
ALTER TABLE jobs ADD COLUMN nice_to_have_skills TEXT NOT NULL DEFAULT '';  -- comma-separated
ALTER TABLE jobs ADD COLUMN min_years_experience INTEGER NOT NULL DEFAULT 0;
ALTER TABLE jobs ADD COLUMN additional_notes TEXT NOT NULL DEFAULT '';

-- Backfill the seed Senior Software Engineer role.
UPDATE jobs SET
  summary = 'Senior Software Engineer at RecruitAI — remote / Singapore, full-time. Joining the core platform team to build scalable, AI-powered recruitment tools.',
  responsibilities = '- Build and ship features on our AI-powered recruitment platform
- Design and own backend services and APIs end-to-end
- Integrate AI/ML models into production workflows
- Collaborate with product, design, and recruiting teams to ship user-facing improvements
- Mentor junior engineers and raise the engineering bar',
  required_skills = 'React, TypeScript, Node.js, REST APIs, PostgreSQL, Cloud (AWS / GCP / Azure), CI/CD, Microservices',
  nice_to_have_skills = 'Python, Machine Learning frameworks, AI/ML in production, Recruitment / HR tech, Open source contributions, Mentoring, WebSockets',
  min_years_experience = 5,
  additional_notes = 'Tech stack: Frontend — React, Next.js, TypeScript, Tailwind CSS. Backend — Node.js, Python, FastAPI. Database — PostgreSQL, Redis. Infra — AWS (Lambda, ECS, S3), Docker, Kubernetes. AI/ML — OpenAI API, LangChain, vector databases.'
WHERE id = '00000000-0000-4000-8000-000000000001';
