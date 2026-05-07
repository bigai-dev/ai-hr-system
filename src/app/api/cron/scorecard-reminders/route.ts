// Daily scorecard reminder.
//
// Auth: Bearer ${CRON_SECRET}, same as other cron routes. Triggered by
// .github/workflows/scorecard-reminders.yml on a daily schedule.
//
// Logic: find interviews scheduled before today (i.e. presumably already
// happened) that have no scorecard yet. Group by job and email each job's
// hiring_manager_email with the list of candidates awaiting feedback.
import { NextResponse } from 'next/server';
import { turso } from '@/lib/turso';
import { log } from '@/lib/log';
import { sendEmail } from '@/lib/email';
import { buildScorecardReminderEmail, type PendingScorecard } from '@/lib/email-templates';
import { JobRow } from '@/lib/db-types';

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_LOOKBACK_DAYS = 14;     // ignore interviews older than this — likely abandoned
const MAX_PENDING_IN_EMAIL = 20;  // truncate list if a job has many pending

function isAuthorized(request: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  return request.headers.get('authorization') === `Bearer ${expected}`;
}

function todayISODate(): string {
  return new Date().toISOString().slice(0, 10);
}

function lookbackISODate(): string {
  return new Date(Date.now() - MAX_LOOKBACK_DAYS * DAY_MS).toISOString().slice(0, 10);
}

function daysAgo(dateStr: string): number {
  const t = new Date(dateStr + 'T00:00:00Z').getTime();
  if (Number.isNaN(t)) return 0;
  return Math.max(0, Math.floor((Date.now() - t) / DAY_MS));
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  // Find every interview that's past-dated, recent enough, and has no scorecard,
  // for jobs with a hiring_manager_email set.
  const result = await turso.execute({
    sql: `SELECT i.id           AS interview_id,
                 i.type         AS interview_type,
                 i.scheduled_date,
                 a.name         AS applicant_name,
                 a.job_id       AS job_id
            FROM interviews i
            JOIN applicants a ON a.id = i.applicant_id
            JOIN jobs j ON j.id = a.job_id
            LEFT JOIN interview_scorecards s ON s.interview_id = i.id
            WHERE s.id IS NULL
              AND i.scheduled_date < ?
              AND i.scheduled_date >= ?
              AND j.hiring_manager_email IS NOT NULL
              AND j.hiring_manager_email != ''
              AND a.status NOT IN ('rejected','archived','withdrawn')
            ORDER BY a.job_id, i.scheduled_date DESC`,
    args: [todayISODate(), lookbackISODate()],
  });

  // Group pending interviews by job_id.
  const byJob = new Map<string, PendingScorecard[]>();
  for (const r of result.rows) {
    const row = r as Record<string, unknown>;
    const jobId = row.job_id as string;
    const list = byJob.get(jobId) ?? [];
    list.push({
      applicant_name: row.applicant_name as string,
      interview_type: (row.interview_type as string) ?? 'Interview',
      days_ago: daysAgo(row.scheduled_date as string),
    });
    byJob.set(jobId, list);
  }

  if (byJob.size === 0) {
    log.info('scorecard_reminders_completed', { jobs_with_pending: 0, sent: 0, failed: 0 });
    return NextResponse.json({ jobs_with_pending: 0, sent: 0, failed: 0 });
  }

  // Fetch the affected jobs in one go.
  const jobIds = Array.from(byJob.keys());
  const placeholders = jobIds.map(() => '?').join(',');
  const jobsResult = await turso.execute({
    sql: `SELECT * FROM jobs WHERE id IN (${placeholders})`,
    args: jobIds,
  });
  const jobs = jobsResult.rows.map((r) => JobRow.parse(r));

  let sent = 0;
  let failed = 0;
  for (const job of jobs) {
    const pending = byJob.get(job.id);
    if (!pending || pending.length === 0) continue;
    if (!job.hiring_manager_email) continue;

    const truncated = pending.slice(0, MAX_PENDING_IN_EMAIL);
    try {
      const result = await sendEmail(buildScorecardReminderEmail(job, truncated));
      if (result.delivered === 'sent' || result.delivered === 'mocked') sent += 1;
      else failed += 1;
    } catch (err) {
      failed += 1;
      log.error('scorecard_reminder_send_failed', {
        jobId: job.id,
        error: err instanceof Error ? err.message : 'unknown',
      });
    }
  }

  const summary = { jobs_with_pending: byJob.size, sent, failed };
  log.info('scorecard_reminders_completed', summary);
  return NextResponse.json(summary);
}
