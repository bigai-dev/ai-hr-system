import { describe, it, expect } from 'vitest';
import {
  ApplicationSchema,
  ApplicantStatusSchema,
  ScheduleInterviewSchema,
  MAX_RESUME_BYTES,
  PDF_MAGIC,
} from '@/lib/schemas';

describe('ApplicationSchema', () => {
  const valid = {
    name: 'Jane Doe',
    email: 'jane@example.com',
    phone: '+15555555555',
    job_title: 'Senior Engineer',
    job_id: '00000000-0000-4000-8000-000000000001',
    years_experience: '5',
    cover_letter: 'I would like to apply.',
  };

  it('accepts valid input', () => {
    const result = ApplicationSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe('jane@example.com');
      expect(result.data.years_experience).toBe(5);
    }
  });

  it('rejects empty name', () => {
    expect(ApplicationSchema.safeParse({ ...valid, name: '' }).success).toBe(false);
  });

  it('rejects invalid email', () => {
    expect(ApplicationSchema.safeParse({ ...valid, email: 'not-an-email' }).success).toBe(false);
  });

  it('rejects negative years_experience', () => {
    expect(ApplicationSchema.safeParse({ ...valid, years_experience: '-1' }).success).toBe(false);
  });

  it('caps years_experience at 60', () => {
    expect(ApplicationSchema.safeParse({ ...valid, years_experience: '99' }).success).toBe(false);
  });

  it('rejects oversized cover letter', () => {
    expect(
      ApplicationSchema.safeParse({ ...valid, cover_letter: 'x'.repeat(5001) }).success
    ).toBe(false);
  });

  it('rejects oversized name', () => {
    expect(ApplicationSchema.safeParse({ ...valid, name: 'x'.repeat(201) }).success).toBe(false);
  });

  it('lowercases email', () => {
    const result = ApplicationSchema.safeParse({ ...valid, email: 'JANE@EXAMPLE.COM' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.email).toBe('jane@example.com');
  });

  it('strips unknown fields', () => {
    const result = ApplicationSchema.safeParse({ ...valid, resume_url: 'http://evil.com/x.pdf' });
    expect(result.success).toBe(true);
    if (result.success) {
      // Zod's default mode strips unknown keys.
      expect((result.data as Record<string, unknown>).resume_url).toBeUndefined();
    }
  });
});

describe('ApplicantStatusSchema', () => {
  it('accepts the five valid statuses', () => {
    for (const s of ['new', 'screening', 'screened', 'scheduled', 'rejected']) {
      expect(ApplicantStatusSchema.safeParse(s).success).toBe(true);
    }
  });
  it('rejects invalid statuses', () => {
    expect(ApplicantStatusSchema.safeParse('hired').success).toBe(false);
    expect(ApplicantStatusSchema.safeParse('').success).toBe(false);
  });
});

describe('ScheduleInterviewSchema', () => {
  const valid = {
    applicant_id: '11111111-2222-4333-8444-555555555555',
    scheduled_date: '2026-05-08',
    scheduled_time: '14:00',
    duration_minutes: 60,
    type: 'Technical Round',
  };

  it('accepts a valid interview', () => {
    expect(ScheduleInterviewSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects bad date format', () => {
    expect(
      ScheduleInterviewSchema.safeParse({ ...valid, scheduled_date: '05/08/2026' }).success
    ).toBe(false);
  });

  it('rejects bad time format', () => {
    expect(
      ScheduleInterviewSchema.safeParse({ ...valid, scheduled_time: '2pm' }).success
    ).toBe(false);
  });

  it('rejects non-uuid applicant_id', () => {
    expect(
      ScheduleInterviewSchema.safeParse({ ...valid, applicant_id: 'not-a-uuid' }).success
    ).toBe(false);
  });
});

describe('PDF constants', () => {
  it('exposes 5MB max', () => {
    expect(MAX_RESUME_BYTES).toBe(5 * 1024 * 1024);
  });

  it('PDF_MAGIC matches a real PDF header', () => {
    const buf = Buffer.from('%PDF-1.7\nrest of file', 'utf-8');
    expect(buf.subarray(0, PDF_MAGIC.length).equals(PDF_MAGIC)).toBe(true);
  });

  it('PDF_MAGIC rejects non-PDF content', () => {
    const buf = Buffer.from('<html>not a pdf</html>', 'utf-8');
    expect(buf.subarray(0, PDF_MAGIC.length).equals(PDF_MAGIC)).toBe(false);
  });
});
