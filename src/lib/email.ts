// Email abstraction with two modes:
//   - Resend mode (RESEND_API_KEY set): actually sends.
//   - Mock-log mode (no key): records to outgoing_emails + logs.
// Every send (real or mocked) is persisted to outgoing_emails for audit.
import { turso } from '@/lib/turso';
import { log } from '@/lib/log';

export interface EmailMessage {
  to: string;
  subject: string;
  body: string;            // plain text
  category: EmailCategory; // for filtering / reporting
  applicant_id?: string;
  job_id?: string;
}

export type EmailCategory =
  | 'application_acknowledgement'
  | 'rejection'
  | 'interview_invite'
  | 'scorecard_reminder'
  | 'weekly_digest'
  | 'other';

export interface SendResult {
  id: string;          // outgoing_emails.id
  delivered: 'sent' | 'mocked' | 'failed';
  provider_id?: string;
  error?: string;
}

const FROM_ADDRESS =
  process.env.EMAIL_FROM_ADDRESS ?? 'Recruit.AI <noreply@recruit.local>';

async function recordEmail(msg: EmailMessage, status: SendResult): Promise<void> {
  await turso.execute({
    sql: `INSERT INTO outgoing_emails
            (id, to_email, subject, body, category, applicant_id, job_id,
             delivery_status, provider_id, error)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      status.id,
      msg.to,
      msg.subject,
      msg.body,
      msg.category,
      msg.applicant_id ?? null,
      msg.job_id ?? null,
      status.delivered,
      status.provider_id ?? null,
      status.error ?? null,
    ],
  });
}

async function sendViaResend(msg: EmailMessage, id: string): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY missing');
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM_ADDRESS,
      to: msg.to,
      subject: msg.subject,
      text: msg.body,
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    return { id, delivered: 'failed', error: `${res.status} ${text}`.slice(0, 500) };
  }
  const data = (await res.json()) as { id?: string };
  return { id, delivered: 'sent', provider_id: data.id };
}

export async function sendEmail(msg: EmailMessage): Promise<SendResult> {
  const id = crypto.randomUUID();

  // No provider key → mock-log mode.
  if (!process.env.RESEND_API_KEY) {
    const result: SendResult = { id, delivered: 'mocked' };
    await recordEmail(msg, result);
    log.info('email_mocked', {
      category: msg.category,
      to: msg.to,
      subject: msg.subject,
      applicantId: msg.applicant_id,
    });
    return result;
  }

  let result: SendResult;
  try {
    result = await sendViaResend(msg, id);
  } catch (err) {
    result = {
      id,
      delivered: 'failed',
      error: err instanceof Error ? err.message : 'unknown',
    };
  }
  await recordEmail(msg, result);
  if (result.delivered === 'sent') {
    log.info('email_sent', {
      category: msg.category,
      to: msg.to,
      providerId: result.provider_id,
      applicantId: msg.applicant_id,
    });
  } else {
    log.warn('email_failed', {
      category: msg.category,
      to: msg.to,
      error: result.error,
      applicantId: msg.applicant_id,
    });
  }
  return result;
}
