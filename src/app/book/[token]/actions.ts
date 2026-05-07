'use server';

// Public-facing booking actions.
//
// IMPORTANT: these intentionally do NOT call requireAuth(). Authorization is
// established by possession of a valid, unexpired, unconsumed booking token.
// Treat the token like a bearer secret.
import { turso } from '@/lib/turso';
import { log } from '@/lib/log';
import { sendEmail } from '@/lib/email';
import { buildBookingConfirmationEmail } from '@/lib/email-templates';
import {
  generateSlots,
  tzWallClockToUTC,
  formatInTZ,
  type BookedRange,
  type Slot,
} from '@/lib/booking';
import { loadSchedulingConfig } from '@/lib/scheduling-config';

export interface BookingContext {
  status: 'available' | 'expired' | 'booked' | 'not_found';
  applicant_name?: string;
  job_title?: string;
  interview_type?: string;
  duration_minutes?: number;
  expires_at?: string;
  slots?: Slot[];
  // When status === 'booked':
  booked_start_iso?: string;
}

interface LinkRow {
  link_id: string;
  applicant_id: string;
  job_id: string | null;
  applicant_name: string;
  applicant_email: string;
  job_title: string | null;
  interview_type: string;
  duration_minutes: number;
  expires_at: string;
  booked_interview_id: string | null;
  booked_date: string | null;
  booked_time: string | null;
}

async function fetchLinkRow(token: string): Promise<LinkRow | null> {
  const { rows } = await turso.execute({
    sql: `SELECT bl.id              AS link_id,
                 bl.applicant_id    AS applicant_id,
                 a.job_id           AS job_id,
                 a.name             AS applicant_name,
                 a.email            AS applicant_email,
                 j.title            AS job_title,
                 bl.interview_type  AS interview_type,
                 bl.duration_minutes AS duration_minutes,
                 bl.expires_at      AS expires_at,
                 bl.booked_interview_id AS booked_interview_id,
                 i.scheduled_date   AS booked_date,
                 i.scheduled_time   AS booked_time
            FROM booking_links bl
            JOIN applicants a ON a.id = bl.applicant_id
            LEFT JOIN jobs j ON j.id = a.job_id
            LEFT JOIN interviews i ON i.id = bl.booked_interview_id
            WHERE bl.token = ?
            LIMIT 1`,
    args: [token],
  });
  if (rows.length === 0) return null;
  const r = rows[0] as Record<string, unknown>;
  return {
    link_id: r.link_id as string,
    applicant_id: r.applicant_id as string,
    job_id: (r.job_id as string | null) ?? null,
    applicant_name: r.applicant_name as string,
    applicant_email: r.applicant_email as string,
    job_title: (r.job_title as string | null) ?? null,
    interview_type: r.interview_type as string,
    duration_minutes: Number(r.duration_minutes),
    expires_at: r.expires_at as string,
    booked_interview_id: (r.booked_interview_id as string | null) ?? null,
    booked_date: (r.booked_date as string | null) ?? null,
    booked_time: (r.booked_time as string | null) ?? null,
  };
}

function parseSqliteTimestamp(s: string): Date {
  // libSQL stores datetime('now') as "YYYY-MM-DD HH:MM:SS" without zone.
  // Treat as UTC (which is what sqlite's datetime('now') returns).
  return new Date(s.replace(' ', 'T') + 'Z');
}

async function fetchBookedRanges(horizon: Date, tz: string): Promise<BookedRange[]> {
  // Pull every interview between now and the horizon to subtract from
  // candidate-visible slots. scheduled_date + scheduled_time are wall-clock
  // values in the configured booking timezone; convert to UTC for overlap.
  // 1-day buffer on the date filter to cover tz drift across day boundaries.
  const horizonDate = horizon.toISOString().slice(0, 10);
  const todayDate = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);

  const { rows } = await turso.execute({
    sql: `SELECT scheduled_date, scheduled_time, duration_minutes
            FROM interviews
            WHERE scheduled_date >= ?
              AND scheduled_date <= ?`,
    args: [todayDate, horizonDate],
  });
  return rows
    .map((r) => {
      const row = r as Record<string, unknown>;
      const date = row.scheduled_date as string;
      const time = (row.scheduled_time as string) ?? '00:00';
      const duration = Number(row.duration_minutes ?? 30);
      const m = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      const t = time.match(/^(\d{2}):(\d{2})/);
      if (!m || !t) return null;
      const start = tzWallClockToUTC(
        Number(m[1]),
        Number(m[2]),
        Number(m[3]),
        Number(t[1]),
        Number(t[2]),
        tz,
      );
      const end = new Date(start.getTime() + duration * 60_000);
      return { start, end };
    })
    .filter((x): x is BookedRange => x !== null);
}

export async function getBookingContext(token: string): Promise<BookingContext> {
  const link = await fetchLinkRow(token);
  if (!link) return { status: 'not_found' };

  const expiresAt = parseSqliteTimestamp(link.expires_at);
  const now = new Date();

  const config = await loadSchedulingConfig();

  if (link.booked_interview_id && link.booked_date && link.booked_time) {
    const dm = link.booked_date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const tm = link.booked_time.match(/^(\d{2}):(\d{2})/);
    const bookedUTC =
      dm && tm
        ? tzWallClockToUTC(
            Number(dm[1]),
            Number(dm[2]),
            Number(dm[3]),
            Number(tm[1]),
            Number(tm[2]),
            config.timezone,
          )
        : new Date(`${link.booked_date}T${link.booked_time.slice(0, 5)}:00Z`);
    return {
      status: 'booked',
      applicant_name: link.applicant_name,
      job_title: link.job_title ?? 'this role',
      interview_type: link.interview_type,
      duration_minutes: link.duration_minutes,
      booked_start_iso: bookedUTC.toISOString(),
    };
  }

  if (expiresAt <= now) {
    return {
      status: 'expired',
      applicant_name: link.applicant_name,
      job_title: link.job_title ?? 'this role',
      interview_type: link.interview_type,
      duration_minutes: link.duration_minutes,
      expires_at: link.expires_at,
    };
  }

  const bookedRanges = await fetchBookedRanges(expiresAt, config.timezone);
  const slots = generateSlots({
    durationMinutes: link.duration_minutes,
    bookedRanges,
    now,
    expiresAt,
    timezone: config.timezone,
    workingDays: config.workingDays,
    startHour: config.startHour,
    endHour: config.endHour,
    slotIntervalMinutes: config.slotIntervalMinutes,
    bufferHoursFromNow: config.bufferHoursFromNow,
    lookaheadDays: config.lookaheadDays,
  });

  return {
    status: 'available',
    applicant_name: link.applicant_name,
    job_title: link.job_title ?? 'this role',
    interview_type: link.interview_type,
    duration_minutes: link.duration_minutes,
    expires_at: link.expires_at,
    slots,
  };
}

export interface BookSlotResult {
  ok: boolean;
  error?: string;
  booked_start_iso?: string;
}

export async function bookSlot(
  token: string,
  startISO: string,
): Promise<BookSlotResult> {
  const link = await fetchLinkRow(token);
  if (!link) return { ok: false, error: 'Booking link not found.' };
  if (link.booked_interview_id) {
    return { ok: false, error: 'This link has already been used.' };
  }
  const expiresAt = parseSqliteTimestamp(link.expires_at);
  if (expiresAt <= new Date()) {
    return { ok: false, error: 'This booking link has expired.' };
  }

  // Validate the requested slot is currently in the available list — guards
  // against stale clients submitting a slot that's been taken in the meantime.
  const start = new Date(startISO);
  if (Number.isNaN(start.getTime())) {
    return { ok: false, error: 'Invalid time.' };
  }
  const end = new Date(start.getTime() + link.duration_minutes * 60_000);
  const config = await loadSchedulingConfig();
  const bookedRanges = await fetchBookedRanges(expiresAt, config.timezone);
  const conflict = bookedRanges.some((r) => r.start < end && start < r.end);
  if (conflict) {
    return { ok: false, error: 'That slot was just taken. Please pick another.' };
  }

  // Store wall-clock date/time in the configured booking timezone, so a
  // recruiter in that zone sees the right hour without client-side conversion.
  // The candidate selected a UTC instant (`start`); re-format it for storage.
  const { date: dateStr, time: timeStr } = formatInTZ(start, config.timezone);
  const interviewId = crypto.randomUUID();
  await turso.execute({
    sql: `INSERT INTO interviews
            (id, applicant_id, scheduled_date, scheduled_time,
             duration_minutes, type, status)
          VALUES (?, ?, ?, ?, ?, ?, 'scheduled')`,
    args: [
      interviewId,
      link.applicant_id,
      dateStr,
      timeStr,
      link.duration_minutes,
      link.interview_type,
    ],
  });

  // Consume the link.
  await turso.execute({
    sql: `UPDATE booking_links SET booked_interview_id = ? WHERE id = ?`,
    args: [interviewId, link.link_id],
  });

  // Move the candidate forward in the pipeline if they were earlier.
  const { rows: statusRows } = await turso.execute({
    sql: `SELECT status FROM applicants WHERE id = ?`,
    args: [link.applicant_id],
  });
  const currentStatus = (statusRows[0] as Record<string, unknown> | undefined)?.status as
    | string
    | undefined;
  if (currentStatus && ['new', 'screening', 'screened'].includes(currentStatus)) {
    await turso.execute({
      sql: `UPDATE applicants
              SET status = 'phone_screen',
                  updated_at = datetime('now'),
                  stage_changed_at = datetime('now')
            WHERE id = ?`,
      args: [link.applicant_id],
    });
  }

  // Confirmation email (best-effort; booking already succeeded).
  try {
    await sendEmail(
      await buildBookingConfirmationEmail(
        {
          id: link.applicant_id,
          name: link.applicant_name,
          email: link.applicant_email,
          job_id: link.job_id,
        },
        { title: link.job_title ?? 'this role' },
        {
          startISO: start.toISOString(),
          durationMinutes: link.duration_minutes,
          interviewType: link.interview_type,
          timezone: config.timezone,
        },
      ),
    );
  } catch (err) {
    log.error('booking_confirmation_email_failed', {
      applicantId: link.applicant_id,
      bookingLinkId: link.link_id,
      error: err instanceof Error ? err.message : 'unknown',
    });
  }

  log.info('booking_slot_taken', {
    applicantId: link.applicant_id,
    bookingLinkId: link.link_id,
    interviewId,
    startISO: start.toISOString(),
  });

  return { ok: true, booked_start_iso: start.toISOString() };
}

export interface CancelBookingResult {
  ok: boolean;
  error?: string;
}

/**
 * Cancel the candidate's existing booking so they can pick a new slot using
 * the SAME link. Marks the interview as 'cancelled' (preserved for audit) and
 * clears booked_interview_id on the link so the next bookSlot call succeeds.
 *
 * Refuses if the booked time has already started — past meetings can't be
 * rescheduled by the candidate; they must contact the recruiter.
 */
export async function cancelBooking(token: string): Promise<CancelBookingResult> {
  const link = await fetchLinkRow(token);
  if (!link) return { ok: false, error: 'Booking link not found.' };
  if (!link.booked_interview_id) {
    return { ok: false, error: 'No interview is currently booked on this link.' };
  }

  const expiresAt = parseSqliteTimestamp(link.expires_at);
  if (expiresAt <= new Date()) {
    return { ok: false, error: 'This booking link has expired.' };
  }

  // Block reschedule if the interview's start time has already passed.
  if (link.booked_date && link.booked_time) {
    const config = await loadSchedulingConfig();
    const dm = link.booked_date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const tm = link.booked_time.match(/^(\d{2}):(\d{2})/);
    const bookedUTC =
      dm && tm
        ? tzWallClockToUTC(
            Number(dm[1]),
            Number(dm[2]),
            Number(dm[3]),
            Number(tm[1]),
            Number(tm[2]),
            config.timezone,
          )
        : new Date(`${link.booked_date}T${link.booked_time.slice(0, 5)}:00Z`);
    if (bookedUTC <= new Date()) {
      return {
        ok: false,
        error:
          'That interview time has already started or finished. Please contact the recruiter to arrange a new time.',
      };
    }
  }

  await turso.execute({
    sql: `UPDATE interviews SET status = 'cancelled' WHERE id = ?`,
    args: [link.booked_interview_id],
  });
  await turso.execute({
    sql: `UPDATE booking_links SET booked_interview_id = NULL WHERE id = ?`,
    args: [link.link_id],
  });

  log.info('booking_cancelled_by_candidate', {
    applicantId: link.applicant_id,
    bookingLinkId: link.link_id,
    interviewId: link.booked_interview_id,
  });

  return { ok: true };
}
