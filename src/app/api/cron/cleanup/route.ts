import { NextResponse } from 'next/server';
import { del } from '@vercel/blob';
import { turso } from '@/lib/turso';
import { log } from '@/lib/log';

const RETENTION_DAYS = 90;

function isAuthorizedCronRequest(request: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const header = request.headers.get('authorization');
  return header === `Bearer ${expected}`;
}

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000)
    .toISOString()
    .replace('T', ' ')
    .slice(0, 19);

  const { rows } = await turso.execute({
    sql: `SELECT id, resume_url FROM applicants
            WHERE status = 'rejected' AND updated_at < ?`,
    args: [cutoff],
  });

  let deleted = 0;
  for (const r of rows) {
    const row = r as Record<string, unknown>;
    const id = row.id as string;
    const resumeUrl = (row.resume_url as string | null) ?? null;
    try {
      await turso.execute({ sql: 'DELETE FROM applicants WHERE id = ?', args: [id] });
      if (resumeUrl) {
        try {
          await del(resumeUrl);
        } catch (e) {
          log.warn('cleanup_blob_delete_failed', {
            applicantId: id,
            error: e instanceof Error ? e.message : 'unknown',
          });
        }
      }
      deleted++;
    } catch (e) {
      log.error('cleanup_delete_failed', {
        applicantId: id,
        error: e instanceof Error ? e.message : 'unknown',
      });
    }
  }

  // Prune rate-limit events older than 7 days
  const ratePruneCutoff = Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60;
  const rateResult = await turso.execute({
    sql: 'DELETE FROM rate_limit_events WHERE ts < ?',
    args: [ratePruneCutoff],
  });

  log.info('cleanup_completed', {
    rejected_deleted: deleted,
    rate_events_pruned: rateResult.rowsAffected ?? 0,
  });

  return NextResponse.json({
    rejected_deleted: deleted,
    rate_events_pruned: rateResult.rowsAffected ?? 0,
  });
}
