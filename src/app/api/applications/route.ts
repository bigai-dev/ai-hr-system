import { NextRequest, NextResponse, after } from 'next/server';
import { put } from '@vercel/blob';
import { ApplicationSchema, MAX_RESUME_BYTES, PDF_MAGIC } from '@/lib/schemas';
import { turso } from '@/lib/turso';
import { screenApplicant } from '@/lib/screen';
import { checkRateLimit, clientIp } from '@/lib/ratelimit';
import { getActiveJob } from '@/lib/jobs';
import { log } from '@/lib/log';
import { sendEmail } from '@/lib/email';
import { buildAcknowledgementEmail } from '@/lib/email-templates';

const IP_LIMIT_MAX = 30;
const IP_LIMIT_WINDOW_SECONDS = 60 * 60; // 1 hour
const EMAIL_LIMIT_MAX = 10;
const EMAIL_LIMIT_WINDOW_SECONDS = 60 * 60 * 24; // 24 hours

function rateLimitResponse(retryAfter: number) {
  return NextResponse.json(
    { error: 'Too many submissions. Please try again later.' },
    {
      status: 429,
      headers: { 'Retry-After': String(retryAfter) },
    }
  );
}

export async function POST(request: NextRequest) {
  const ip = clientIp(request);
  const ipLimit = await checkRateLimit(`apply:ip:${ip}`, IP_LIMIT_MAX, IP_LIMIT_WINDOW_SECONDS);
  if (!ipLimit.allowed) {
    log.warn('apply_rate_limited', { reason: 'ip', ip });
    return rateLimitResponse(ipLimit.retryAfterSeconds);
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  const fileEntry = formData.get('resume');
  const file = fileEntry instanceof File ? fileEntry : null;

  const fields = {
    name: String(formData.get('name') ?? ''),
    email: String(formData.get('email') ?? ''),
    phone: String(formData.get('phone') ?? ''),
    job_title: String(formData.get('job_title') ?? ''),
    job_id: String(formData.get('job_id') ?? ''),
    years_experience: formData.get('years_experience') ?? 0,
    cover_letter: String(formData.get('cover_letter') ?? ''),
  };

  const parsed = ApplicationSchema.safeParse(fields);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const data = parsed.data;

  const job = await getActiveJob(data.job_id);
  if (!job) {
    return NextResponse.json(
      { error: 'Selected position is no longer accepting applications' },
      { status: 400 }
    );
  }

  const emailLimit = await checkRateLimit(
    `apply:email:${data.email}`,
    EMAIL_LIMIT_MAX,
    EMAIL_LIMIT_WINDOW_SECONDS
  );
  if (!emailLimit.allowed) {
    log.warn('apply_rate_limited', { reason: 'email', email: data.email });
    return rateLimitResponse(emailLimit.retryAfterSeconds);
  }

  let resumeUrl: string | null = null;

  if (file) {
    if (file.size === 0) {
      return NextResponse.json({ error: 'Empty file' }, { status: 400 });
    }
    if (file.size > MAX_RESUME_BYTES) {
      return NextResponse.json({ error: 'Resume exceeds 5 MB' }, { status: 413 });
    }
    if (file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'Resume must be a PDF' }, { status: 415 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    if (!buffer.subarray(0, PDF_MAGIC.length).equals(PDF_MAGIC)) {
      return NextResponse.json({ error: 'File is not a valid PDF' }, { status: 415 });
    }

    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      log.error('blob_token_missing');
      return NextResponse.json({ error: 'Storage not configured' }, { status: 500 });
    }

    const key = `resumes/${crypto.randomUUID()}.pdf`;
    try {
      const result = await put(key, buffer, {
        access: 'private',
        addRandomSuffix: true,
        contentType: 'application/pdf',
      });
      resumeUrl = result.url;
    } catch (e) {
      log.error('blob_upload_failed', { error: e instanceof Error ? e.message : 'unknown' });
      return NextResponse.json({ error: 'Resume upload failed' }, { status: 500 });
    }
  }

  const id = crypto.randomUUID();
  try {
    await turso.execute({
      sql: `INSERT INTO applicants
              (id, name, email, phone, job_title, job_id, years_experience, cover_letter, resume_url, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'new')`,
      args: [
        id,
        data.name,
        data.email,
        data.phone,
        data.job_title,
        data.job_id,
        data.years_experience,
        data.cover_letter,
        resumeUrl,
      ],
    });
  } catch (e) {
    log.error('insert_applicant_failed', { error: e instanceof Error ? e.message : 'unknown' });
    return NextResponse.json({ error: 'Could not save application' }, { status: 500 });
  }

  log.info('application_received', {
    applicantId: id,
    email: data.email,
    jobId: data.job_id,
    hasResume: !!resumeUrl,
  });

  after(async () => {
    // Acknowledgement email runs in parallel with screening — both are
    // background work and neither blocks the candidate's submit response.
    const ack = (async () => {
      try {
        await sendEmail(
          await buildAcknowledgementEmail(
            { id, name: data.name, email: data.email, job_id: data.job_id },
            { title: job.title },
          ),
        );
      } catch (err) {
        log.error('ack_email_failed', {
          applicantId: id,
          error: err instanceof Error ? err.message : 'unknown',
        });
      }
    })();

    const screen = screenApplicant(id)
      .then(() => log.info('screening_completed', { applicantId: id }))
      .catch((err) =>
        log.error('screening_failed', {
          applicantId: id,
          error: err instanceof Error ? err.message : 'unknown',
        }),
      );

    await Promise.allSettled([ack, screen]);
  });

  return NextResponse.json({ success: true, id });
}
