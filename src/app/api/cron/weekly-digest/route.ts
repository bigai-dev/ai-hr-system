// Weekly hiring-manager digest.
//
// Auth: same `Bearer ${CRON_SECRET}` pattern used by /api/cron/cleanup so the
// scheduler (GitHub Actions, in this project — see .github/workflows/weekly-digest.yml)
// can call this endpoint securely.
//
// Logic: for every active job that has a hiring_manager_email, compute a
// rolling-7d digest of pipeline activity. If the digest has any signal
// (new applicants, interviews, offers, aging candidates), send it.
import { NextResponse } from 'next/server';
import { turso } from '@/lib/turso';
import { log } from '@/lib/log';
import { sendEmail } from '@/lib/email';
import {
  buildWeeklyDigestEmail,
  digestHasSignal,
  type DigestStats,
} from '@/lib/email-templates';
import { JobRow } from '@/lib/db-types';
import { STAGE_LABELS, type ApplicantStatus } from '@/lib/types';

const DAY_MS = 24 * 60 * 60 * 1000;
const STALE_DAYS = 7;
const MAX_STALE_IN_DIGEST = 3;

function isAuthorized(request: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  return request.headers.get('authorization') === `Bearer ${expected}`;
}

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * DAY_MS)
    .toISOString()
    .replace('T', ' ')
    .slice(0, 19);
}

async function computeStats(jobId: string): Promise<DigestStats> {
  const sevenDaysAgo = isoDaysAgo(7);

  const [newRes, interviewRes, offerRes, hiredRes, staleRes] = await Promise.all([
    turso.execute({
      sql: `SELECT COUNT(*) AS n FROM applicants
              WHERE job_id = ? AND created_at >= ?`,
      args: [jobId, sevenDaysAgo],
    }),
    turso.execute({
      sql: `SELECT COUNT(*) AS n FROM applicants
              WHERE job_id = ? AND status IN ('phone_screen', 'onsite')`,
      args: [jobId],
    }),
    turso.execute({
      sql: `SELECT COUNT(*) AS n FROM applicants
              WHERE job_id = ? AND status = 'offer'`,
      args: [jobId],
    }),
    turso.execute({
      sql: `SELECT COUNT(*) AS n FROM applicants
              WHERE job_id = ? AND status = 'hired' AND stage_changed_at >= ?`,
      args: [jobId, sevenDaysAgo],
    }),
    turso.execute({
      sql: `SELECT name, status, stage_changed_at FROM applicants
              WHERE job_id = ?
                AND status NOT IN ('rejected','archived','withdrawn','hired','new','screening')
                AND stage_changed_at <= ?
              ORDER BY stage_changed_at ASC
              LIMIT ?`,
      args: [jobId, isoDaysAgo(STALE_DAYS), MAX_STALE_IN_DIGEST],
    }),
  ]);

  const stale = staleRes.rows.map((r) => {
    const row = r as Record<string, unknown>;
    const stage = row.status as ApplicantStatus;
    const ts = row.stage_changed_at as string;
    const days = Math.floor((Date.now() - new Date(ts.replace(' ', 'T') + 'Z').getTime()) / DAY_MS);
    return {
      name: row.name as string,
      stage: STAGE_LABELS[stage] ?? stage,
      days: Math.max(0, days),
    };
  });

  const oldestOpen = stale[0]?.days ?? 0;

  return {
    new_applicants: Number((newRes.rows[0] as Record<string, unknown>).n ?? 0),
    in_interview: Number((interviewRes.rows[0] as Record<string, unknown>).n ?? 0),
    in_offer: Number((offerRes.rows[0] as Record<string, unknown>).n ?? 0),
    hired_this_week: Number((hiredRes.rows[0] as Record<string, unknown>).n ?? 0),
    stale,
    oldest_open_days: oldestOpen,
  };
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const { rows } = await turso.execute(
    `SELECT * FROM jobs
       WHERE status = 'active'
         AND hiring_manager_email IS NOT NULL
         AND hiring_manager_email != ''`,
  );
  const jobs = rows.map((r) => JobRow.parse(r));

  let sent = 0;
  let skipped_no_signal = 0;
  let failed = 0;

  for (const job of jobs) {
    if (!job.hiring_manager_email) continue;
    try {
      const stats = await computeStats(job.id);
      if (!digestHasSignal(stats)) {
        skipped_no_signal += 1;
        continue;
      }
      const result = await sendEmail(buildWeeklyDigestEmail(job, stats));
      if (result.delivered === 'sent' || result.delivered === 'mocked') {
        sent += 1;
      } else {
        failed += 1;
      }
    } catch (err) {
      failed += 1;
      log.error('weekly_digest_job_failed', {
        jobId: job.id,
        error: err instanceof Error ? err.message : 'unknown',
      });
    }
  }

  const summary = {
    jobs_with_manager: jobs.length,
    digests_sent: sent,
    skipped_no_signal,
    failed,
  };
  log.info('weekly_digest_completed', summary);
  return NextResponse.json(summary);
}
