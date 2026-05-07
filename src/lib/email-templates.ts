import type { Applicant, Job } from '@/lib/types';
import type { EmailMessage } from '@/lib/email';
import { turso } from '@/lib/turso';
import {
  EDITABLE_TEMPLATES,
  substituteVariables,
  REJECTION_REASON_LABELS,
  type EditableTemplateId,
  type RejectionReason,
} from '@/lib/email-templates-shared';

// Re-export so existing server callers keep working through this module.
export {
  EDITABLE_TEMPLATES,
  substituteVariables,
  REJECTION_REASON_LABELS,
};
export type { EditableTemplateId, RejectionReason };

const COMPANY_NAME = process.env.EMAIL_COMPANY_NAME ?? 'the team';

interface StoredTemplate {
  subject: string;
  body: string;
}

const FALLBACKS: Record<EditableTemplateId, StoredTemplate> = {
  application_acknowledgement: {
    subject: 'We received your application — {Job_Title}',
    body: `Hi {Candidate_Name},

Thanks for applying to the {Job_Title} role. We have received your application and our team will be in touch as we review your background.

You don't need to do anything else right now. If you have any questions, you can reply directly to this email.

— {Company_Name}`,
  },
  rejection: {
    subject: 'Update on your application — {Job_Title}',
    body: `Hi {Candidate_Name},

Thank you for your interest in the {Job_Title} role and for the time you put into your application.

{Rejection_Reason}{Custom_Note}

We genuinely appreciate the effort you put in and wish you well in your search.

— {Company_Name}`,
  },
  interview_invite: {
    subject: 'Interview confirmed: {Interview_Type} for {Job_Title}',
    body: `Hi {Candidate_Name},

Your {Interview_Type_Lower} for {Job_Title} is confirmed.

  When: {When}
  Duration: {Duration_Minutes} minutes

You'll receive joining instructions separately. If you need to reschedule, reply to this email and we'll send a new booking link.

— {Company_Name}`,
  },
};

export async function loadEmailTemplate(id: EditableTemplateId): Promise<StoredTemplate> {
  try {
    const { rows } = await turso.execute({
      sql: 'SELECT subject, body FROM email_templates WHERE id = ? LIMIT 1',
      args: [id],
    });
    if (rows.length === 0) return FALLBACKS[id];
    const r = rows[0] as Record<string, unknown>;
    return {
      subject: (r.subject as string) || FALLBACKS[id].subject,
      body: (r.body as string) || FALLBACKS[id].body,
    };
  } catch {
    return FALLBACKS[id];
  }
}

export function getTemplateFallback(id: EditableTemplateId): StoredTemplate {
  return { ...FALLBACKS[id] };
}

const REJECTION_LANGUAGE: Record<RejectionReason, string> = {
  skills_mismatch:
    'After reviewing your background against the role requirements, we have decided to move forward with candidates whose experience aligns more closely with the specific skills the team is looking for.',
  experience:
    'After reviewing your background, we have decided to move forward with candidates whose experience level is a closer match for what the role requires.',
  role_filled:
    'We have filled this role with another candidate. We will keep your details on file and reach out if a more suitable opening comes up.',
  timing:
    'Due to timing and current pipeline considerations, we are not able to advance your application at this time.',
  other:
    'After careful consideration, we have decided to move forward with other candidates for this role.',
};

// ── Booking confirmation ──────────────────────────────────────────────────

export interface BookingDetails {
  startISO: string;
  durationMinutes: number;
  interviewType: string;
  timezone: string;
}

function formatBookingTime(iso: string, tz: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: tz,
    timeZoneName: 'short',
  });
}

export async function buildBookingConfirmationEmail(
  applicant: Pick<Applicant, 'id' | 'name' | 'email' | 'job_id'>,
  job: Pick<Job, 'title'>,
  details: BookingDetails,
): Promise<EmailMessage> {
  const tpl = await loadEmailTemplate('interview_invite');
  const vars: Record<string, string | number> = {
    Candidate_Name: applicant.name,
    Job_Title: job.title,
    Company_Name: COMPANY_NAME,
    Interview_Type: details.interviewType,
    Interview_Type_Lower: details.interviewType.toLowerCase(),
    When: formatBookingTime(details.startISO, details.timezone),
    Duration_Minutes: details.durationMinutes,
  };
  return {
    to: applicant.email,
    subject: substituteVariables(tpl.subject, vars),
    body: substituteVariables(tpl.body, vars),
    category: 'interview_invite',
    applicant_id: applicant.id,
    job_id: applicant.job_id ?? undefined,
  };
}

// ── Application acknowledgement ───────────────────────────────────────────

export async function buildAcknowledgementEmail(
  applicant: Pick<Applicant, 'id' | 'name' | 'email' | 'job_id'>,
  job: Pick<Job, 'title'>,
): Promise<EmailMessage> {
  const tpl = await loadEmailTemplate('application_acknowledgement');
  const vars = {
    Candidate_Name: applicant.name,
    Job_Title: job.title,
    Company_Name: COMPANY_NAME,
  };
  return {
    to: applicant.email,
    subject: substituteVariables(tpl.subject, vars),
    body: substituteVariables(tpl.body, vars),
    category: 'application_acknowledgement',
    applicant_id: applicant.id,
    job_id: applicant.job_id ?? undefined,
  };
}

// ── Rejection ─────────────────────────────────────────────────────────────

export async function buildRejectionEmail(
  applicant: Pick<Applicant, 'id' | 'name' | 'email' | 'job_id'>,
  job: Pick<Job, 'title'>,
  reason: RejectionReason,
  customNote?: string,
): Promise<EmailMessage> {
  const tpl = await loadEmailTemplate('rejection');
  const note = customNote?.trim() ? `\n\n${customNote.trim()}` : '';
  const vars = {
    Candidate_Name: applicant.name,
    Job_Title: job.title,
    Company_Name: COMPANY_NAME,
    Rejection_Reason: REJECTION_LANGUAGE[reason],
    Custom_Note: note,
  };
  return {
    to: applicant.email,
    subject: substituteVariables(tpl.subject, vars),
    body: substituteVariables(tpl.body, vars),
    category: 'rejection',
    applicant_id: applicant.id,
    job_id: applicant.job_id ?? undefined,
  };
}

// ── Internal operational mail (still hardcoded) ───────────────────────────

export interface PendingScorecard {
  applicant_name: string;
  interview_type: string;
  days_ago: number;
}

export function buildScorecardReminderEmail(
  job: Pick<Job, 'id' | 'title' | 'hiring_manager_email'>,
  pending: PendingScorecard[],
): EmailMessage {
  if (!job.hiring_manager_email) {
    throw new Error('buildScorecardReminderEmail: job.hiring_manager_email is required');
  }
  const subject = `Pending interview scorecards: ${pending.length} for ${job.title}`;
  const lines: string[] = [];
  lines.push(`The following interviews for ${job.title} are missing scorecards:`);
  lines.push('');
  for (const p of pending) {
    const ago = p.days_ago === 0
      ? 'today'
      : `${p.days_ago} day${p.days_ago === 1 ? '' : 's'} ago`;
    lines.push(`  • ${p.applicant_name} — ${p.interview_type} (${ago})`);
  }
  lines.push('');
  lines.push(
    'Please nudge the interviewer to submit feedback. Open the candidate in Recruit.AI and use the Scorecards tab to fill it in.',
  );
  lines.push('');
  lines.push(`— ${COMPANY_NAME}`);
  return {
    to: job.hiring_manager_email,
    subject,
    body: lines.join('\n'),
    category: 'scorecard_reminder',
    job_id: job.id,
  };
}

export interface DigestStats {
  new_applicants: number;
  in_interview: number;
  in_offer: number;
  hired_this_week: number;
  stale: { name: string; stage: string; days: number }[];
  oldest_open_days: number;
}

export function digestHasSignal(stats: DigestStats): boolean {
  return (
    stats.new_applicants > 0 ||
    stats.in_interview > 0 ||
    stats.in_offer > 0 ||
    stats.hired_this_week > 0 ||
    stats.stale.length > 0
  );
}

export function buildWeeklyDigestEmail(
  job: Pick<Job, 'id' | 'title' | 'hiring_manager_email'>,
  stats: DigestStats,
): EmailMessage {
  if (!job.hiring_manager_email) {
    throw new Error('buildWeeklyDigestEmail: job.hiring_manager_email is required');
  }
  const subject = `Weekly hiring update: ${job.title}`;
  const lines: string[] = [];
  lines.push(`Here is this week's hiring activity for ${job.title}.`);
  lines.push('');
  lines.push(`• New applications this week: ${stats.new_applicants}`);
  lines.push(`• Currently interviewing (phone screen + onsite): ${stats.in_interview}`);
  lines.push(`• In offer: ${stats.in_offer}`);
  if (stats.hired_this_week > 0) {
    lines.push(`• Hired this week: ${stats.hired_this_week}`);
  }
  if (stats.stale.length > 0) {
    lines.push('');
    lines.push('Aging candidates (>7 days in their current stage):');
    for (const s of stats.stale) {
      lines.push(`  – ${s.name} — ${s.stage} (${s.days}d)`);
    }
  }
  if (stats.oldest_open_days > 0 && stats.stale.length === 0) {
    lines.push('');
    lines.push(
      `Oldest active candidate has been in their current stage for ${stats.oldest_open_days} day${stats.oldest_open_days === 1 ? '' : 's'}.`,
    );
  }
  lines.push('');
  lines.push(`— ${COMPANY_NAME}`);

  return {
    to: job.hiring_manager_email,
    subject,
    body: lines.join('\n'),
    category: 'weekly_digest',
    job_id: job.id,
  };
}
