import { turso } from './turso';
import { JobRow } from './db-types';
import type { Job } from './types';

// Public reads — no auth, used by the candidate-facing /apply page and API.
// Admin CRUD lives in src/app/(dashboard)/actions.ts.

export async function getActiveJobs(): Promise<Job[]> {
  const result = await turso.execute(
    "SELECT * FROM jobs WHERE status = 'active' ORDER BY created_at DESC"
  );
  return result.rows.map((r) => JobRow.parse(r));
}

export async function getActiveJob(id: string): Promise<Job | null> {
  const result = await turso.execute({
    sql: "SELECT * FROM jobs WHERE id = ? AND status = 'active'",
    args: [id],
  });
  if (result.rows.length === 0) return null;
  return JobRow.parse(result.rows[0]);
}

export async function getJobById(id: string): Promise<Job | null> {
  const result = await turso.execute({
    sql: 'SELECT * FROM jobs WHERE id = ?',
    args: [id],
  });
  if (result.rows.length === 0) return null;
  return JobRow.parse(result.rows[0]);
}
