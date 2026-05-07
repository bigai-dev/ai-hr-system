-- Apply with: turso db shell ai-hr-system < migrations/2026-05-07-jobs.sql
--
-- Adds the `jobs` table (recruiters maintain an open-roles list) and links
-- applicants to a specific job. Existing applicants are backfilled to a seed
-- job that uses the previously-hardcoded JOB_DESCRIPTION constant so old
-- screening data still has a referenceable JD.

CREATE TABLE IF NOT EXISTS jobs (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  description TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'active'
              CHECK (status IN ('active', 'archived')),
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);

-- Seed: the prior single hardcoded role.
INSERT OR IGNORE INTO jobs (id, title, description, status) VALUES (
  '00000000-0000-4000-8000-000000000001',
  'Senior Software Engineer',
  '## Senior Software Engineer - RecruitAI

**Company:** RecruitAI - AI-powered recruitment platform
**Location:** Remote / Singapore
**Type:** Full-time

### About the Role
We are looking for a Senior Software Engineer to join our core platform team. You will be building scalable, AI-powered recruitment tools that help companies hire better and faster.

### Requirements
- 5+ years of professional software engineering experience
- Strong proficiency in React, TypeScript, and Node.js
- Experience with Python and machine learning frameworks is a plus
- Experience building and deploying cloud-native applications (AWS, GCP, or Azure)
- Strong understanding of database design (PostgreSQL preferred)
- Experience with RESTful APIs and microservices architecture
- Familiarity with CI/CD pipelines and DevOps practices
- Excellent problem-solving and communication skills

### Nice to Have
- Experience with AI/ML integration in production systems
- Knowledge of recruitment/HR tech domain
- Open source contributions
- Leadership or mentoring experience
- Experience with real-time systems and WebSocket

### Tech Stack
- Frontend: React, Next.js, TypeScript, Tailwind CSS
- Backend: Node.js, Python, FastAPI
- Database: PostgreSQL, Redis
- Infrastructure: AWS (Lambda, ECS, S3), Docker, Kubernetes
- AI/ML: OpenAI API, LangChain, vector databases',
  'active'
);

-- ALTER TABLE ADD COLUMN is not idempotent on older libSQL — if the column
-- already exists, comment out this line and re-run.
ALTER TABLE applicants ADD COLUMN job_id TEXT REFERENCES jobs(id);

UPDATE applicants
SET job_id = '00000000-0000-4000-8000-000000000001'
WHERE job_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_applicants_job ON applicants(job_id);
