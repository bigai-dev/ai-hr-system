'use server';

import { del } from '@vercel/blob';
import { turso } from '@/lib/turso';
import { requireAuth, getCurrentUser } from '@/lib/auth';
import { log } from '@/lib/log';
import { ApplicantStatusSchema, JobInputSchema, ScheduleInterviewSchema } from '@/lib/schemas';
import { ApplicantRow, InterviewWithApplicantRow, JobRow } from '@/lib/db-types';
import type { Applicant, Interview, Job } from '@/lib/types';
import { sendEmail } from '@/lib/email';
import {
  buildRejectionEmail,
  buildBookingConfirmationEmail,
  loadEmailTemplate,
  type RejectionReason,
  type EditableTemplateId,
} from '@/lib/email-templates';
import { generateBookingToken, tzWallClockToUTC } from '@/lib/booking';
import {
  loadSchedulingConfig,
  writeSchedulingConfig,
  type SchedulingConfig,
  type SchedulingConfigInput,
} from '@/lib/scheduling-config';

const INTERVIEW_JOIN_SQL = `SELECT i.*,
    a.id as a_id, a.name as a_name, a.email as a_email, a.phone as a_phone,
    a.job_title as a_job_title, a.job_id as a_job_id,
    a.years_experience as a_years_experience,
    a.cover_letter as a_cover_letter, a.resume_url as a_resume_url,
    a.resume_text as a_resume_text, a.status as a_status,
    a.ai_match_score as a_ai_match_score, a.ai_reasoning as a_ai_reasoning,
    a.ai_extracted_skills as a_ai_extracted_skills,
    a.stage_changed_at as a_stage_changed_at,
    a.created_at as a_created_at, a.updated_at as a_updated_at
  FROM interviews i
  LEFT JOIN applicants a ON i.applicant_id = a.id
  WHERE i.status != 'cancelled'`;

// ── Queries ──────────────────────────────────────────────────────────────

export async function getApplicants(): Promise<Applicant[]> {
  await requireAuth();
  const result = await turso.execute(
    'SELECT * FROM applicants ORDER BY CASE WHEN ai_match_score IS NULL THEN 1 ELSE 0 END, ai_match_score DESC'
  );
  return result.rows.map((r) => ApplicantRow.parse(r));
}

export async function getApplicantsByJob(jobId: string | null): Promise<Applicant[]> {
  await requireAuth();
  const result = jobId
    ? await turso.execute({
        sql:
          'SELECT * FROM applicants WHERE job_id = ? ORDER BY ' +
          'CASE WHEN ai_match_score IS NULL THEN 1 ELSE 0 END, ai_match_score DESC',
        args: [jobId],
      })
    : await turso.execute(
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

// Stages where a candidate is no longer expected to attend an interview.
// Moving to one of these cancels any future interviews so the calendar
// stays accurate. Past interviews are preserved for audit + scorecards.
//   - pre-interview (new, screening, screened): they're not at the meeting stage yet
//   - terminal (rejected, archived, withdrawn): they're out of the pipeline
const STAGES_THAT_CANCEL_FUTURE_INTERVIEWS: readonly string[] = [
  'new',
  'screening',
  'screened',
  'rejected',
  'archived',
  'withdrawn',
];

// Mark every scheduled interview for this applicant whose start date hasn't
// passed as cancelled. Returns how many rows were affected so callers can
// surface it in toasts. Past interviews are left intact.
async function cancelFutureInterviewsFor(applicantId: string): Promise<number> {
  const result = await turso.execute({
    sql: `UPDATE interviews
            SET status = 'cancelled'
          WHERE applicant_id = ?
            AND status = 'scheduled'
            AND scheduled_date >= date('now')`,
    args: [applicantId],
  });
  return Number(result.rowsAffected ?? 0);
}

export async function updateApplicantStatus(
  id: string,
  status: string,
): Promise<{ cancelledInterviews: number }> {
  await requireAuth();
  const parsedStatus = ApplicantStatusSchema.parse(status);
  // Only bump stage_changed_at if the stage actually changes — keeps time-in-stage
  // accurate when someone re-saves the same stage.
  await turso.execute({
    sql: `UPDATE applicants
            SET status = ?,
                updated_at = datetime('now'),
                stage_changed_at = CASE
                  WHEN status = ? THEN stage_changed_at
                  ELSE datetime('now')
                END
          WHERE id = ?`,
    args: [parsedStatus, parsedStatus, id],
  });

  let cancelledInterviews = 0;
  if (STAGES_THAT_CANCEL_FUTURE_INTERVIEWS.includes(parsedStatus)) {
    cancelledInterviews = await cancelFutureInterviewsFor(id);
    if (cancelledInterviews > 0) {
      log.info('interviews_cancelled_on_stage_change', {
        applicantId: id,
        stage: parsedStatus,
        cancelled: cancelledInterviews,
      });
    }
  }

  log.info('applicant_stage_changed', { applicantId: id, stage: parsedStatus });
  return { cancelledInterviews };
}

export async function archiveApplicant(
  id: string,
): Promise<{ cancelledInterviews: number }> {
  await requireAuth();
  await turso.execute({
    sql: `UPDATE applicants
            SET status = 'archived',
                updated_at = datetime('now'),
                stage_changed_at = CASE
                  WHEN status = 'archived' THEN stage_changed_at
                  ELSE datetime('now')
                END
          WHERE id = ?`,
    args: [id],
  });
  const cancelledInterviews = await cancelFutureInterviewsFor(id);
  log.info('applicant_archived', { applicantId: id, cancelledInterviews });
  return { cancelledInterviews };
}

// ── Rejection (writes status + sends email + logs reason) ────────────────

export interface BulkRejectResult {
  rejected: number;
  emailed: number;
  email_failures: number;
  skipped: number;
}

async function rejectOne(
  id: string,
  reason: RejectionReason,
  customNote: string | undefined,
): Promise<{ rejected: boolean; emailed: boolean }> {
  // Fetch applicant + job in a single query so we have everything
  // needed for the email template.
  const { rows } = await turso.execute({
    sql: `SELECT a.id, a.name, a.email, a.job_id, a.status, j.title AS job_title
            FROM applicants a
            LEFT JOIN jobs j ON j.id = a.job_id
            WHERE a.id = ?`,
    args: [id],
  });
  if (rows.length === 0) return { rejected: false, emailed: false };
  const row = rows[0] as Record<string, unknown>;
  const currentStatus = row.status as string;

  // Idempotent: if already rejected, don't re-send the email.
  if (currentStatus === 'rejected') return { rejected: false, emailed: false };

  await turso.execute({
    sql: `UPDATE applicants
            SET status = 'rejected',
                updated_at = datetime('now'),
                stage_changed_at = datetime('now')
          WHERE id = ?`,
    args: [id],
  });
  const cancelledInterviews = await cancelFutureInterviewsFor(id);
  log.info('applicant_rejected', { applicantId: id, reason, cancelledInterviews });

  let emailed = false;
  try {
    const applicantInfo = {
      id: row.id as string,
      name: row.name as string,
      email: row.email as string,
      job_id: (row.job_id as string | null) ?? null,
    };
    const jobInfo = { title: (row.job_title as string | null) ?? 'this role' };
    const result = await sendEmail(
      await buildRejectionEmail(applicantInfo, jobInfo, reason, customNote),
    );
    emailed = result.delivered === 'sent' || result.delivered === 'mocked';
  } catch (err) {
    log.error('rejection_email_failed', {
      applicantId: id,
      error: err instanceof Error ? err.message : 'unknown',
    });
  }
  return { rejected: true, emailed };
}

export async function rejectApplicantWithReason(
  id: string,
  reason: RejectionReason,
  customNote?: string,
): Promise<{ rejected: boolean; emailed: boolean }> {
  await requireAuth();
  return rejectOne(id, reason, customNote);
}

/**
 * Bring a terminal-state candidate (rejected / archived / withdrawn) back
 * into the active pipeline at the 'screened' stage so the recruiter can
 * decide what to do next. Cancelled interviews are not auto-restored — if
 * needed, the recruiter schedules a fresh one or sends a new booking link.
 * No-op if the candidate is already in the active pipeline.
 */
export async function restoreApplicant(id: string): Promise<void> {
  await requireAuth();
  const { rows } = await turso.execute({
    sql: 'SELECT status FROM applicants WHERE id = ?',
    args: [id],
  });
  const current = (rows[0] as Record<string, unknown> | undefined)?.status as string | undefined;
  if (!current) throw new Error('Applicant not found');
  if (!['rejected', 'archived', 'withdrawn'].includes(current)) {
    return; // already active — nothing to do
  }
  await turso.execute({
    sql: `UPDATE applicants
            SET status = 'screened',
                updated_at = datetime('now'),
                stage_changed_at = datetime('now')
          WHERE id = ?`,
    args: [id],
  });
  log.info('applicant_restored', { applicantId: id, from: current });
}

export async function bulkRejectApplicants(
  ids: string[],
  reason: RejectionReason,
  customNote?: string,
): Promise<BulkRejectResult> {
  await requireAuth();
  const result: BulkRejectResult = {
    rejected: 0,
    emailed: 0,
    email_failures: 0,
    skipped: 0,
  };
  for (const id of ids) {
    try {
      const r = await rejectOne(id, reason, customNote);
      if (r.rejected) {
        result.rejected += 1;
        if (r.emailed) result.emailed += 1;
        else result.email_failures += 1;
      } else {
        result.skipped += 1;
      }
    } catch (err) {
      log.error('bulk_reject_item_failed', {
        applicantId: id,
        error: err instanceof Error ? err.message : 'unknown',
      });
      result.skipped += 1;
    }
  }
  log.info('bulk_reject_completed', {
    requested: ids.length,
    ...result,
    reason,
  });
  return result;
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

export async function insertInterview(
  input: unknown,
): Promise<{ success: boolean; id: string; email_sent: boolean }> {
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

  // Send the interview_invite confirmation to the candidate. Skipped when the
  // recruiter is recording a past interview (e.g., logging an external one
  // after the fact) — the candidate doesn't need a "your interview is at <past
  // date>" email. Best-effort send; failures land in outgoing_emails as
  // 'failed' so the recruiter can see them in /settings/outgoing-emails.
  let emailSent = false;
  const today = new Date().toISOString().slice(0, 10);
  if (parsed.scheduled_date >= today) {
    try {
      const { rows: applicantRows } = await turso.execute({
        sql: 'SELECT id, name, email, job_id FROM applicants WHERE id = ?',
        args: [parsed.applicant_id],
      });
      const a = applicantRows[0] as Record<string, unknown> | undefined;
      if (a && (a.email as string)) {
        let jobTitle = 'this role';
        const jobId = (a.job_id as string | null) ?? null;
        if (jobId) {
          const { rows: jobRows } = await turso.execute({
            sql: 'SELECT title FROM jobs WHERE id = ?',
            args: [jobId],
          });
          const j = jobRows[0] as Record<string, unknown> | undefined;
          jobTitle = (j?.title as string) ?? 'this role';
        }
        const config = await loadSchedulingConfig();
        // Recruiter picked wall-clock time in the booking timezone; convert
        // to a UTC instant so the email "When" string can be formatted in
        // any zone (we still display in booking timezone here).
        const dm = parsed.scheduled_date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        const tm = parsed.scheduled_time.match(/^(\d{2}):(\d{2})/);
        const startISO =
          dm && tm
            ? tzWallClockToUTC(
                Number(dm[1]),
                Number(dm[2]),
                Number(dm[3]),
                Number(tm[1]),
                Number(tm[2]),
                config.timezone,
              ).toISOString()
            : `${parsed.scheduled_date}T${parsed.scheduled_time}:00Z`;
        const result = await sendEmail(
          await buildBookingConfirmationEmail(
            {
              id: a.id as string,
              name: a.name as string,
              email: a.email as string,
              job_id: jobId,
            },
            { title: jobTitle },
            {
              startISO,
              durationMinutes: parsed.duration_minutes,
              interviewType: parsed.type,
              timezone: config.timezone,
            },
          ),
        );
        emailSent = result.delivered === 'sent' || result.delivered === 'mocked';
      }
    } catch (err) {
      log.error('manual_schedule_confirmation_failed', {
        applicantId: parsed.applicant_id,
        interviewId: id,
        error: err instanceof Error ? err.message : 'unknown',
      });
    }
  }

  log.info('interview_inserted', {
    applicantId: parsed.applicant_id,
    interviewId: id,
    date: parsed.scheduled_date,
    emailSent,
  });

  return { success: true, id, email_sent: emailSent };
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
    sql: `INSERT INTO jobs (
            id, title, summary, responsibilities, required_skills,
            nice_to_have_skills, min_years_experience, additional_notes, status,
            hiring_manager_email
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id,
      parsed.title,
      parsed.summary,
      parsed.responsibilities,
      parsed.required_skills,
      parsed.nice_to_have_skills,
      parsed.min_years_experience,
      parsed.additional_notes,
      parsed.status,
      parsed.hiring_manager_email || null,
    ],
  });
  log.info('job_created', { jobId: id, title: parsed.title });
  return { id };
}

export async function updateJob(id: string, input: unknown): Promise<void> {
  await requireAuth();
  const parsed = JobInputSchema.parse(input);
  await turso.execute({
    sql: `UPDATE jobs SET
            title = ?,
            summary = ?,
            responsibilities = ?,
            required_skills = ?,
            nice_to_have_skills = ?,
            min_years_experience = ?,
            additional_notes = ?,
            status = ?,
            hiring_manager_email = ?,
            updated_at = datetime('now')
          WHERE id = ?`,
    args: [
      parsed.title,
      parsed.summary,
      parsed.responsibilities,
      parsed.required_skills,
      parsed.nice_to_have_skills,
      parsed.min_years_experience,
      parsed.additional_notes,
      parsed.status,
      parsed.hiring_manager_email || null,
      id,
    ],
  });
  log.info('job_updated', { jobId: id });
}

// ── Interviews per applicant (used by scorecard tab) ─────────────────────

export async function getInterviewsForApplicant(applicantId: string): Promise<Interview[]> {
  await requireAuth();
  const result = await turso.execute({
    sql: `SELECT id, applicant_id, scheduled_date, scheduled_time,
                 duration_minutes, type, status, created_at
            FROM interviews
            WHERE applicant_id = ?
              AND status != 'cancelled'
            ORDER BY scheduled_date ASC, scheduled_time ASC`,
    args: [applicantId],
  });
  return result.rows.map((r) => {
    const row = r as Record<string, unknown>;
    return {
      id: row.id as string,
      applicant_id: row.applicant_id as string,
      scheduled_date: row.scheduled_date as string,
      scheduled_time: row.scheduled_time as string,
      duration_minutes: Number(row.duration_minutes ?? 30),
      type: row.type as string,
      status: row.status as Interview['status'],
      created_at: row.created_at as string,
    };
  });
}

// ── Scorecards ────────────────────────────────────────────────────────────

export type Recommendation = 'strong_hire' | 'hire' | 'no_hire' | 'strong_no_hire';

export interface Scorecard {
  id: string;
  interview_id: string;
  applicant_id: string;
  job_id: string | null;
  interviewer_name: string | null;
  interviewer_email: string | null;
  overall_rating: number;
  recommendation: Recommendation;
  skill_ratings: Record<string, number | null> | null;
  notes: string | null;
  submitted_at: string;
  created_at: string;
}

export interface ScorecardInput {
  interview_id: string;
  interviewer_name?: string;
  interviewer_email?: string;
  overall_rating: number;
  recommendation: Recommendation;
  skill_ratings?: Record<string, number | null>;
  notes?: string;
}

export async function getScorecardsForApplicant(applicantId: string): Promise<Scorecard[]> {
  await requireAuth();
  const result = await turso.execute({
    sql: `SELECT id, interview_id, applicant_id, job_id, interviewer_name,
                 interviewer_email, overall_rating, recommendation,
                 skill_ratings, notes, submitted_at, created_at
            FROM interview_scorecards
            WHERE applicant_id = ?
            ORDER BY submitted_at DESC`,
    args: [applicantId],
  });
  return result.rows.map((r) => {
    const row = r as Record<string, unknown>;
    let skills: Record<string, number | null> | null = null;
    const raw = row.skill_ratings as string | null;
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') skills = parsed;
      } catch {
        skills = null;
      }
    }
    return {
      id: row.id as string,
      interview_id: row.interview_id as string,
      applicant_id: row.applicant_id as string,
      job_id: (row.job_id as string | null) ?? null,
      interviewer_name: (row.interviewer_name as string | null) ?? null,
      interviewer_email: (row.interviewer_email as string | null) ?? null,
      overall_rating: Number(row.overall_rating),
      recommendation: row.recommendation as Recommendation,
      skill_ratings: skills,
      notes: (row.notes as string | null) ?? null,
      submitted_at: row.submitted_at as string,
      created_at: row.created_at as string,
    };
  });
}

export async function saveScorecard(input: ScorecardInput): Promise<{ id: string }> {
  await requireAuth();

  if (!Number.isInteger(input.overall_rating) || input.overall_rating < 1 || input.overall_rating > 5) {
    throw new Error('overall_rating must be 1-5');
  }
  if (!['strong_hire', 'hire', 'no_hire', 'strong_no_hire'].includes(input.recommendation)) {
    throw new Error('Invalid recommendation');
  }

  // Resolve applicant_id + job_id from the interview so the scorecard row is denormalized.
  const interviewRows = await turso.execute({
    sql: `SELECT i.applicant_id, a.job_id FROM interviews i
            LEFT JOIN applicants a ON a.id = i.applicant_id
            WHERE i.id = ?`,
    args: [input.interview_id],
  });
  if (interviewRows.rows.length === 0) {
    throw new Error('Interview not found');
  }
  const { applicant_id, job_id } = interviewRows.rows[0] as Record<string, unknown>;

  const id = crypto.randomUUID();
  const skillsJson = input.skill_ratings ? JSON.stringify(input.skill_ratings) : null;

  await turso.execute({
    sql: `INSERT INTO interview_scorecards
            (id, interview_id, applicant_id, job_id, interviewer_name,
             interviewer_email, overall_rating, recommendation, skill_ratings, notes)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id,
      input.interview_id,
      applicant_id as string,
      (job_id as string | null) ?? null,
      input.interviewer_name?.trim() || null,
      input.interviewer_email?.trim() || null,
      input.overall_rating,
      input.recommendation,
      skillsJson,
      input.notes?.trim() || null,
    ],
  });

  // Mark the interview as completed so it leaves the "scheduled" bucket.
  await turso.execute({
    sql: `UPDATE interviews SET status = 'completed' WHERE id = ?`,
    args: [input.interview_id],
  });

  log.info('scorecard_saved', {
    scorecardId: id,
    interviewId: input.interview_id,
    overallRating: input.overall_rating,
    recommendation: input.recommendation,
  });
  return { id };
}

// ── Email templates (recruiter-editable) ──────────────────────────────────

const VALID_TEMPLATE_IDS: EditableTemplateId[] = [
  'application_acknowledgement',
  'rejection',
  'interview_invite',
];

export async function getEmailTemplate(
  id: EditableTemplateId,
): Promise<{ id: EditableTemplateId; subject: string; body: string }> {
  await requireAuth();
  if (!VALID_TEMPLATE_IDS.includes(id)) throw new Error('Unknown template id');
  const tpl = await loadEmailTemplate(id);
  return { id, subject: tpl.subject, body: tpl.body };
}

export async function updateEmailTemplate(
  id: EditableTemplateId,
  subject: string,
  body: string,
): Promise<void> {
  await requireAuth();
  if (!VALID_TEMPLATE_IDS.includes(id)) throw new Error('Unknown template id');
  const trimmedSubject = subject.trim();
  const trimmedBody = body.trim();
  if (!trimmedSubject) throw new Error('Subject cannot be empty');
  if (!trimmedBody) throw new Error('Body cannot be empty');
  if (trimmedSubject.length > 300) throw new Error('Subject too long (max 300)');
  if (trimmedBody.length > 10_000) throw new Error('Body too long (max 10k chars)');

  // The migration seeded all three rows; this is an UPSERT so a misapplied
  // migration doesn't lose changes.
  await turso.execute({
    sql: `INSERT INTO email_templates (id, subject, body, updated_at)
          VALUES (?, ?, ?, datetime('now'))
          ON CONFLICT(id) DO UPDATE SET
            subject = excluded.subject,
            body = excluded.body,
            updated_at = datetime('now')`,
    args: [id, trimmedSubject, trimmedBody],
  });
  log.info('email_template_updated', { templateId: id });
}

// ── Scheduling config (single global row) ────────────────────────────────

export async function getSchedulingConfig(): Promise<SchedulingConfig> {
  await requireAuth();
  return loadSchedulingConfig();
}

export async function updateSchedulingConfig(input: SchedulingConfigInput): Promise<void> {
  await requireAuth();
  await writeSchedulingConfig(input);
  log.info('scheduling_config_updated', {
    timezone: input.timezone,
    workingDays: input.workingDays.join(','),
    startHour: input.startHour,
    endHour: input.endHour,
  });
}

// ── Booking links (recruiter-side) ───────────────────────────────────────

export interface BookingLinkInput {
  applicant_id: string;
  interview_type: string;
  duration_minutes: number;
  expires_in_days?: number; // default 7
}

export interface BookingLinkSummary {
  id: string;
  token: string;
  applicant_id: string;
  interview_type: string;
  duration_minutes: number;
  expires_at: string;
  booked_interview_id: string | null;
  created_at: string;
}

export async function createBookingLink(input: BookingLinkInput): Promise<BookingLinkSummary> {
  await requireAuth();
  const expiresInDays = Math.max(1, Math.min(30, input.expires_in_days ?? 7));
  const expiresAt = new Date(Date.now() + expiresInDays * 86400000)
    .toISOString()
    .replace('T', ' ')
    .slice(0, 19);

  const id = crypto.randomUUID();
  const token = generateBookingToken();

  await turso.execute({
    sql: `INSERT INTO booking_links
            (id, token, applicant_id, interview_type, duration_minutes, expires_at)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [id, token, input.applicant_id, input.interview_type, input.duration_minutes, expiresAt],
  });

  log.info('booking_link_created', {
    bookingLinkId: id,
    applicantId: input.applicant_id,
    interviewType: input.interview_type,
    durationMinutes: input.duration_minutes,
    expiresAt,
  });

  return {
    id,
    token,
    applicant_id: input.applicant_id,
    interview_type: input.interview_type,
    duration_minutes: input.duration_minutes,
    expires_at: expiresAt,
    booked_interview_id: null,
    created_at: new Date().toISOString().replace('T', ' ').slice(0, 19),
  };
}

export async function getBookingLinksForApplicant(
  applicantId: string,
): Promise<BookingLinkSummary[]> {
  await requireAuth();
  const result = await turso.execute({
    sql: `SELECT id, token, applicant_id, interview_type, duration_minutes,
                 expires_at, booked_interview_id, created_at
            FROM booking_links
            WHERE applicant_id = ?
            ORDER BY created_at DESC`,
    args: [applicantId],
  });
  return result.rows.map((r) => {
    const row = r as Record<string, unknown>;
    return {
      id: row.id as string,
      token: row.token as string,
      applicant_id: row.applicant_id as string,
      interview_type: row.interview_type as string,
      duration_minutes: Number(row.duration_minutes),
      expires_at: row.expires_at as string,
      booked_interview_id: (row.booked_interview_id as string | null) ?? null,
      created_at: row.created_at as string,
    };
  });
}

// ── Outgoing emails (audit log) ──────────────────────────────────────────

export interface OutgoingEmail {
  id: string;
  to_email: string;
  subject: string;
  body: string;
  category: string;
  applicant_id: string | null;
  job_id: string | null;
  delivery_status: 'sent' | 'mocked' | 'failed';
  provider_id: string | null;
  error: string | null;
  created_at: string;
}

export async function listOutgoingEmails(limit = 100): Promise<OutgoingEmail[]> {
  await requireAuth();
  const result = await turso.execute({
    sql: `SELECT id, to_email, subject, body, category, applicant_id, job_id,
                 delivery_status, provider_id, error, created_at
            FROM outgoing_emails
            ORDER BY created_at DESC
            LIMIT ?`,
    args: [Math.max(1, Math.min(500, limit))],
  });
  return result.rows.map((r) => {
    const row = r as Record<string, unknown>;
    return {
      id: row.id as string,
      to_email: row.to_email as string,
      subject: row.subject as string,
      body: row.body as string,
      category: row.category as string,
      applicant_id: (row.applicant_id as string | null) ?? null,
      job_id: (row.job_id as string | null) ?? null,
      delivery_status: row.delivery_status as 'sent' | 'mocked' | 'failed',
      provider_id: (row.provider_id as string | null) ?? null,
      error: (row.error as string | null) ?? null,
      created_at: row.created_at as string,
    };
  });
}

export async function getEmailProviderStatus(): Promise<{
  configured: boolean;
  fromAddress: string | null;
}> {
  await requireAuth();
  return {
    configured: !!process.env.RESEND_API_KEY,
    fromAddress: process.env.EMAIL_FROM_ADDRESS ?? null,
  };
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
