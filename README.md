# RECRUIT.AI

An AI-powered recruitment demo built with Next.js 16, Claude (Anthropic SDK), and Turso (SQLite-as-a-service). Candidates apply through a public form → Claude scores their resume against a job description → you manage the pipeline and schedule interviews from a dashboard.

Built as a **vibe-coding workshop** starter: a small, readable codebase you can extend with natural-language prompts in Claude Code.

---

## What you get out of the box

- **Public application page** (`/apply`) — form + PDF resume upload
- **AI screening** — Claude reads the resume PDF and scores the candidate 0–100 with reasoning and extracted skills
- **Candidates dashboard** — search, filter, reject, schedule
- **Scheduling** — calendar view of upcoming interviews
- **Settings** — editable email / WhatsApp outreach templates
- **Dark + light theme** toggle

Stack: Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · Claude Sonnet 4.5 · Turso (libSQL) · `unpdf` for resume parsing.

---

## Quick start (5 min)

### 1. Clone + install

```bash
git clone <this-repo-url> recruit-ai
cd recruit-ai
npm install
```

### 2. Create a Turso database (free tier is plenty)

Install the Turso CLI once: <https://docs.turso.tech/cli/installation>

```bash
turso auth signup          # or: turso auth login
turso db create recruit-ai
turso db shell recruit-ai < schema.sql   # creates the tables
turso db show recruit-ai --url           # copy the libsql:// URL
turso db tokens create recruit-ai        # copy the token
```

### 3. Get an Anthropic API key

Sign up at <https://console.anthropic.com> → **API Keys** → **Create Key**. New accounts get free credit.

### 4. Wire up your environment

```bash
cp .env.example .env.local
```

Open `.env.local` and paste in your three values:

```
TURSO_DATABASE_URL=libsql://recruit-ai-<you>.turso.io
TURSO_AUTH_TOKEN=eyJ...
ANTHROPIC_API_KEY=sk-ant-...
```

### 5. Run it

```bash
npm run dev
```

Open <http://localhost:3000>:

- **`/apply`** — submit a test application (upload any PDF resume)
- **`/dashboard`** — see the candidate scored by Claude
- **`/candidates`** — manage the pipeline
- **`/scheduling`** — book interviews

That's it. If the AI score doesn't appear within ~10 seconds, check the terminal for errors.

---

## Project map

```
src/
├── app/
│   ├── apply/                  # public application form
│   ├── (dashboard)/            # protected-style layout + pages
│   │   ├── dashboard/          # overview
│   │   ├── candidates/         # list + detail
│   │   ├── scheduling/         # calendar
│   │   └── settings/           # email / whatsapp templates
│   └── api/
│       ├── db/route.ts         # Turso proxy for client components
│       ├── screen/route.ts     # Claude-powered resume scoring
│       └── upload-resume/route.ts
├── components/                 # Sidebar, TopBar, ThemeProvider
└── lib/
    ├── turso.ts                # DB client
    ├── db.ts                   # typed client-side wrapper
    ├── types.ts                # Applicant / Interview types
    └── job-description.ts      # the JD Claude scores against
schema.sql                      # run this once in Turso
```

**Key files to read first:**

1. [src/lib/job-description.ts](src/lib/job-description.ts) — change this to change what Claude scores against
2. [src/app/api/screen/route.ts](src/app/api/screen/route.ts) — the Claude prompt lives here
3. [src/app/apply/page.tsx](src/app/apply/page.tsx) — the candidate-facing form
4. [src/lib/types.ts](src/lib/types.ts) — data model

---

## Vibe-coding from here (prompts to try in Claude Code)

Open this project in [Claude Code](https://www.anthropic.com/claude-code) and try prompts like:

**Tweak the AI:**
> "Change the job description to a Junior Data Analyst role and update the fields on the apply page to match."

> "In `src/app/api/screen/route.ts`, make Claude also return a `red_flags` array of concerns. Surface it on the candidate detail page."

**Add features:**
> "Add a `rejection_reason` column to the applicants table (update `schema.sql` and the migrations). When I reject a candidate, ask me for a reason and store it."

> "When an interview is scheduled, send an email via Resend. Put the Resend key in `.env.example` and document it in the README."

> "Add an 'Export to CSV' button on the candidates page that downloads the current filtered list."

**Polish:**
> "The theme toggle flashes on first load. Fix it."

> "Add skeleton loaders to the candidates page while applicants are being fetched."

> "Make the dashboard stat cards animate on mount with a subtle count-up."

**Deploy:**
> "Walk me through deploying this to Vercel. Tell me which env vars I need to set in the Vercel dashboard."

### Tips for working with Claude Code on this repo

- **This is Next.js 16** (App Router, React 19, Tailwind v4). If Claude suggests patterns that look like older Next.js, push back: *"Use the Next.js 16 App Router conventions."*
- **Keep edits small.** Ask for one feature at a time and run the dev server between prompts so you catch regressions early.
- **The Claude model is set in [src/app/api/screen/route.ts](src/app/api/screen/route.ts)** — swap `claude-sonnet-4-5` for `claude-haiku-4-5` to save cost while experimenting, or `claude-opus-4-7` for the smartest scoring.
- **Uploaded resumes land in `public/resumes/`** which is gitignored. On Vercel the filesystem is ephemeral — if you deploy, switch to object storage (Vercel Blob, S3, Turso file storage, etc.). Ask Claude to help.

---

## Security notes

- `.env.local` is gitignored. **Never commit real keys.** If you accidentally do, rotate them immediately.
- `public/resumes/*` is gitignored — candidate PDFs contain PII and should never be pushed.
- `.claude/` is gitignored so your local Claude Code settings don't leak.
- This demo has **no authentication** on the dashboard. Don't put it on the public internet with real candidate data. Add auth (NextAuth, Clerk, etc.) before going live.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `TURSO_DATABASE_URL` is undefined | You didn't copy `.env.example` → `.env.local`, or didn't restart `npm run dev` after editing it |
| `401` from Anthropic | `ANTHROPIC_API_KEY` is wrong, expired, or out of credit |
| PDF resume isn't being scored | Check the terminal — `unpdf` fails on some scanned/encrypted PDFs. Try a text-based PDF |
| Candidate stuck on `screening` status | The `/api/screen` call failed; check the browser network tab and server logs |
| Hydration warning about theme | Already handled — ignore unless the page actually flashes |

---

## Scripts

```bash
npm run dev      # local dev server on http://localhost:3000
npm run build    # production build
npm run start    # run the production build
```

---

Built for the vibe-coding workshop. Fork it, break it, rebuild it.
