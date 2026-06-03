# Recruit.AI

An AI-powered recruitment system where candidates apply through a public form, an AI scores each resume against the job, and your team manages the whole pipeline from a single dashboard.

Candidates submit an application and PDF resume on a public page; DeepSeek reads the resume and scores the fit 0-100 with reasoning and extracted skills; recruiters then triage, schedule interviews, and send outreach from a protected dashboard. It is built for small hiring teams who want automated first-pass screening without a heavyweight applicant-tracking platform.

## Features

- **Public application page** (`/apply`) with form fields and PDF resume upload (5 MB cap, PDF-only with magic-byte validation).
- **AI resume screening** — DeepSeek (`deepseek-chat`) scores each candidate 0-100 against the active job, returning reasoning and an extracted-skills list. Runs as background work so the applicant gets an instant confirmation.
- **Screening cost tracking** — input/output tokens and per-screen cost are recorded, with a log alert when a screen exceeds a cost threshold.
- **Manual-review flagging** — suspiciously high scores on near-empty resumes are flagged for human review (a guard against prompt injection and gamed resumes).
- **Prompt-injection hardening** — resume and cover-letter text is wrapped in untrusted-content tags with explicit instructions to ignore any embedded commands.
- **Jobs management** — create and edit structured job postings (summary, responsibilities, required and nice-to-have skills, minimum experience); applications are scored against the active job.
- **Candidates pipeline** — a Kanban board to search, filter, move stages, and reject candidates (with a reason prompt).
- **Interview scheduling** — schedule interviews from the dashboard and view them on a calendar.
- **Self-serve booking links** — generate a tokenized link so candidates can pick a slot themselves (`/book/[token]`), with working-hours slot generation in a configurable timezone.
- **Interview scorecards** — capture structured interview feedback per candidate.
- **Transactional email** — sends via Resend when configured, or falls back to a safe "mock-log" mode that records every message to an in-app audit list. Includes editable email and WhatsApp outreach templates.
- **Scheduled jobs (cron)** — daily cleanup of old rejected applicants and rate-limit events (Vercel Cron, defined in `vercel.ts`), plus scorecard reminders and a weekly digest (triggered by GitHub Actions workflows in `.github/workflows/`).
- **Rate limiting** — per-IP and per-email submission limits on the public apply endpoint.
- **HTTP Basic auth** protecting the entire dashboard (everything except the public apply, application-intake, cron, booking, and privacy paths), with a `DISABLE_AUTH` escape hatch for local demos.
- **Security headers & CSP** — strict Content-Security-Policy with per-request nonce, HSTS, and clickjacking/MIME protections.
- **Dark and light theme** toggle and a built-in guided product tour.

## Tech Stack

- **Framework:** Next.js 16 (App Router) with React 19
- **Language:** TypeScript
- **Styling:** Tailwind CSS v4
- **AI provider:** DeepSeek V3 (`deepseek-chat`), called through the OpenAI SDK (OpenAI-compatible API)
- **Database:** Turso / libSQL (`@libsql/client`)
- **File storage:** Vercel Blob (private blobs for resumes)
- **PDF parsing:** `unpdf`
- **Validation:** Zod
- **Email:** Resend (optional; mock-log fallback)
- **Testing:** Vitest
- **Hosting:** Vercel (the cleanup cron and serverless function config are defined in `vercel.ts`; the scorecard-reminder and weekly-digest crons are scheduled by GitHub Actions in `.github/workflows/`)

## Getting Started

### Prerequisites

- Node.js 22+
- A Turso database (free tier is plenty)
- A DeepSeek API key

### Installation

```bash
npm install
```

Create the database tables once against your Turso database using the included `schema.sql`:

```bash
turso db shell <your-db-name> < schema.sql
```

### Environment Variables

Copy `.env.example` to `.env.local` and fill in your own values:

| Variable | Description |
|----------|-------------|
| `TURSO_DATABASE_URL` | Connection URL for your Turso (libSQL) database. |
| `TURSO_AUTH_TOKEN` | Auth token for the Turso database. |
| `DEEPSEEK_API_KEY` | API key for DeepSeek, used for AI resume screening. |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob token for storing uploaded resumes (auto-injected when Blob is connected on Vercel). |
| `BASIC_AUTH_USER` | Username for HTTP Basic auth on the dashboard. |
| `BASIC_AUTH_PASS` | Password for HTTP Basic auth on the dashboard (use a long random value). |
| `DISABLE_AUTH` | Optional. Set to `1` to bypass dashboard auth for local demos only. Never use in production. |
| `CRON_SECRET` | Secret Vercel sends in the Authorization header to the `/api/cron/*` endpoints. |
| `RESEND_API_KEY` | Optional. Resend API key for sending real email. If unset, the app runs in mock-log mode. |
| `EMAIL_FROM_ADDRESS` | The "from" address used on outgoing email. |
| `EMAIL_COMPANY_NAME` | Company/team name shown in email content. |
| `BOOKING_TIMEZONE` | IANA timezone for self-serve scheduling (default `Asia/Kuala_Lumpur`). |

### Running Locally

```bash
npm run dev
```

Then open http://localhost:3000 in your browser. Try `/apply` to submit a test application (upload any text-based PDF), then `/dashboard` and `/candidates` to see the AI-scored candidate and manage the pipeline.

Other useful scripts:

```bash
npm run build      # production build
npm run start      # run the production build
npm run typecheck  # TypeScript type checking
npm run test       # run the Vitest test suite
```

## Project Structure

- `src/app/apply/` — public application form (the candidate-facing entry point).
- `src/app/book/[token]/` — public self-serve interview booking page.
- `src/app/(dashboard)/` — the protected dashboard: overview, candidates, jobs, scheduling, and settings (email/WhatsApp templates, scheduling config, outgoing-emails audit).
- `src/app/api/` — route handlers: `applications` (intake + screening), `resumes/[id]` (private resume streaming), and `cron/*` (cleanup, scorecard reminders, weekly digest).
- `src/lib/` — core logic: `screen.ts` (DeepSeek screening + prompt), `turso.ts` (DB client), `jobs.ts`, `booking.ts`, `email.ts` and email templates, `auth.ts`, `ratelimit.ts`, `schemas.ts`.
- `src/components/` — shared UI (sidebar, top bar, theme provider, modals, guided tour).
- `src/proxy.ts` — middleware that enforces HTTP Basic auth and applies the Content-Security-Policy.
- `migrations/` — incremental SQL migrations; `schema.sql` — the full schema to initialize a fresh database.
- `scripts/` — helper scripts (run migration, email smoke tests).
- `tests/` — Vitest unit tests for auth, logging, and schema validation.
- `.github/workflows/` — CI (typecheck, test, build) plus the scheduled GitHub Actions that trigger the scorecard-reminder and weekly-digest cron endpoints.

## Notes

- This project was built as a starter for a **vibe-coding workshop**: a small, readable codebase meant to be extended with natural-language prompts in Claude Code.
- Resumes are stored as **private** Vercel Blobs and streamed through `/api/resumes/[id]`; they contain PII and are never publicly served.
- Email runs in **mock-log mode** by default (no `RESEND_API_KEY`): messages are recorded to the in-app outgoing-emails list instead of being sent, which keeps demos and dev environments safe.
- `.env.local` is gitignored — never commit real credentials. If a key is ever exposed, rotate it immediately.
- The cleanup cron schedule and serverless function limits are defined in `vercel.ts` for deployment on Vercel. The scorecard-reminder and weekly-digest crons are scheduled separately by GitHub Actions workflows in `.github/workflows/`, which call the matching `/api/cron/*` endpoints using the shared `CRON_SECRET`.
