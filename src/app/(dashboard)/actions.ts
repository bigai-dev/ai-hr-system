'use server';

import { del } from '@vercel/blob';
import { turso } from '@/lib/turso';
import { requireAuth, getCurrentUser } from '@/lib/auth';
import { log } from '@/lib/log';
import { ApplicantStatusSchema, JobInputSchema, ScheduleInterviewSchema } from '@/lib/schemas';
import { ApplicantRow, InterviewWithApplicantRow, JobRow } from '@/lib/db-types';
import type { Applicant, Interview, Job } from '@/lib/types';

const INTERVIEW_JOIN_SQL = `SELECT i.*,
    a.id as a_id, a.name as a_name, a.email as a_email, a.phone as a_phone,
    a.job_title as a_job_title, a.job_id as a_job_id,
    a.years_experience as a_years_experience,
    a.cover_letter as a_cover_letter, a.resume_url as a_resume_url,
    a.resume_text as a_resume_text, a.status as a_status,
    a.ai_match_score as a_ai_match_score, a.ai_reasoning as a_ai_reasoning,
    a.ai_extracted_skills as a_ai_extracted_skills,
    a.created_at as a_created_at, a.updated_at as a_updated_at
  FROM interviews i
  LEFT JOIN applicants a ON i.applicant_id = a.id`;

// ── Queries ──────────────────────────────────────────────────────────────

export async function getApplicants(): Promise<Applicant[]> {
  await requireAuth();
  const result = await turso.execute(
    'SELECT * FROM applicants ORDER BY CASE WHEN ai_match_score IS NULL THEN 1 ELSE 0 END, ai_match_score DESC'
  );
  return result.rows.map((r) => ApplicantRow.parse(r));
}

export async function getApplicant(id: string): Promise<Applicant | null> {
  await requireAuth();
  const result = await turso.execute({
    sql: 'SELECT * FROM applicants WHERE id = ?',
    args: [id],
  });
  if (result.rows.length === 0) return null;
  return ApplicantRow.parse(result.rows[0]);
}

export async function getApplicantIds(): Promise<string[]> {
  await requireAuth();
  const result = await turso.execute('SELECT id FROM applicants ORDER BY created_at DESC');
  return result.rows.map((r) => r.id as string);
}

export async function getScreenedApplicants(): Promise<Applicant[]> {
  await requireAuth();
  const result = await turso.execute(
    "SELECT * FROM applicants WHERE status = 'screened' ORDER BY ai_match_score DESC"
  );
  return result.rows.map((r) => ApplicantRow.parse(r));
}

export async function getInterviews(): Promise<(Interview & { applicant?: Applicant })[]> {
  await requireAuth();
  const result = await turso.execute(
    `${INTERVIEW_JOIN_SQL} ORDER BY i.scheduled_date ASC`
  );
  return result.rows.map((r) => InterviewWithApplicantRow.parse(r));
}

export async function getInterviewsLimited(): Promise<(Interview & { applicant?: Applicant })[]> {
  await requireAuth();
  const result = await turso.execute(
    `${INTERVIEW_JOIN_SQL} ORDER BY i.scheduled_date ASC LIMIT 5`
  );
  return result.rows.map((r) => InterviewWithApplicantRow.parse(r));
}

// ── Mutations ────────────────────────────────────────────────────────────

export async function updateApplicantStatus(id: string, status: string): Promise<void> {
  await requireAuth();
  const parsedStatus = ApplicantStatusSchema.parse(status);
  await turso.execute({
    sql: "UPDATE applicants SET status = ?, updated_at = datetime('now') WHERE id = ?",
    args: [parsedStatus, id],
  });
}

export async function deleteApplicant(id: string): Promise<void> {
  await requireAuth();

  const { rows } = await turso.execute({
    sql: 'SELECT resume_url FROM applicants WHERE id = ?',
    args: [id],
  });
  const resumeUrl = rows.length > 0 ? ((rows[0] as Record<string, unknown>).resume_url as string | null) : null;

  await turso.execute({ sql: 'DELETE FROM applicants WHERE id = ?', args: [id] });

  if (resumeUrl) {
    try {
      await del(resumeUrl);
    } catch (e) {
      log.warn('blob_delete_failed', {
        applicantId: id,
        error: e instanceof Error ? e.message : 'unknown',
      });
    }
  }

  log.info('applicant_deleted', { applicantId: id });
}

export async function insertInterview(input: unknown): Promise<{ success: boolean; id: string }> {
  await requireAuth();
  const parsed = ScheduleInterviewSchema.parse(input);
  const id = crypto.randomUUID();
  await turso.execute({
    sql: `INSERT INTO interviews (id, applicant_id, scheduled_date, scheduled_time, duration_minutes, type, status)
          VALUES (?, ?, ?, ?, ?, ?, 'scheduled')`,
    args: [
      id,
      parsed.applicant_id,
      parsed.scheduled_date,
      parsed.scheduled_time,
      parsed.duration_minutes,
      parsed.type,
    ],
  });
  return { success: true, id };
}

export async function deleteInterview(id: string): Promise<void> {
  await requireAuth();
  await turso.execute({ sql: 'DELETE FROM interviews WHERE id = ?', args: [id] });
}

// ── Notes ────────────────────────────────────────────────────────────────

export interface ApplicantNote {
  id: string;
  applicant_id: string;
  body: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

const MAX_NOTE_LENGTH = 4000;

export async function getNotes(applicantId: string): Promise<ApplicantNote[]> {
  await requireAuth();
  const result = await turso.execute({
    sql: `SELECT id, applicant_id, body, created_by, created_at, updated_at
            FROM applicant_notes
            WHERE applicant_id = ?
            ORDER BY created_at DESC`,
    args: [applicantId],
  });
  return result.rows.map((r) => {
    const row = r as Record<string, unknown>;
    return {
      id: row.id as string,
      applicant_id: row.applicant_id as string,
      body: row.body as string,
      created_by: (row.created_by as string | null) ?? null,
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
    };
  });
}

export async function addNote(applicantId: string, body: string): Promise<ApplicantNote> {
  await requireAuth();
  const trimmed = body.trim();
  if (!trimmed) throw new Error('Note body is empty');
  if (trimmed.length > MAX_NOTE_LENGTH) {
    throw new Error(`Note exceeds ${MAX_NOTE_LENGTH} characters`);
  }
  const user = await getCurrentUser();
  const id = crypto.randomUUID();
  await turso.execute({
    sql: `INSERT INTO applicant_notes (id, applicant_id, body, created_by) VALUES (?, ?, ?, ?)`,
    args: [id, applicantId, trimmed, user],
  });
  const result = await turso.execute({
    sql: `SELECT id, applicant_id, body, created_by, created_at, updated_at
            FROM applicant_notes WHERE id = ?`,
    args: [id],
  });
  const row = result.rows[0] as Record<string, unknown>;
  return {
    id: row.id as string,
    applicant_id: row.applicant_id as string,
    body: row.body as string,
    created_by: (row.created_by as string | null) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

export async function deleteNote(noteId: string): Promise<void> {
  await requireAuth();
  await turso.execute({ sql: 'DELETE FROM applicant_notes WHERE id = ?', args: [noteId] });
}

// ── Jobs (admin CRUD) ────────────────────────────────────────────────────

export async function listJobs(): Promise<Job[]> {
  await requireAuth();
  const result = await turso.execute(
    "SELECT * FROM jobs ORDER BY CASE status WHEN 'active' THEN 0 ELSE 1 END, created_at DESC"
  );
  return result.rows.map((r) => JobRow.parse(r));
}

export async function getJob(id: string): Promise<Job | null> {
  await requireAuth();
  const result = await turso.execute({
    sql: 'SELECT * FROM jobs WHERE id = ?',
    args: [id],
  });
  if (result.rows.length === 0) return null;
  return JobRow.parse(result.rows[0]);
}

export async function createJob(input: unknown): Promise<{ id: string }> {
  await requireAuth();
  const parsed = JobInputSchema.parse(input);
  const id = crypto.randomUUID();
  await turso.execute({
    sql: `INSERT INTO jobs (id, title, description, status) VALUES (?, ?, ?, ?)`,
    args: [id, parsed.title, parsed.description, parsed.status],
  });
  log.info('job_created', { jobId: id, title: parsed.title });
  return { id };
}

export async function updateJob(id: string, input: unknown): Promise<void> {
  await requireAuth();
  const parsed = JobInputSchema.parse(input);
  await turso.execute({
    sql: `UPDATE jobs
            SET title = ?, description = ?, status = ?, updated_at = datetime('now')
            WHERE id = ?`,
    args: [parsed.title, parsed.description, parsed.status, id],
  });
  log.info('job_updated', { jobId: id });
}

export async function setJobStatus(id: string, status: 'active' | 'archived'): Promise<void> {
  await requireAuth();
  if (status !== 'active' && status !== 'archived') {
    throw new Error('Invalid job status');
  }
  await turso.execute({
    sql: "UPDATE jobs SET status = ?, updated_at = datetime('now') WHERE id = ?",
    args: [status, id],
  });
  log.info('job_status_changed', { jobId: id, status });
}
