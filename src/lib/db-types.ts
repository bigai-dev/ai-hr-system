import { z } from 'zod';
import type { Applicant, Interview } from './types';

const ApplicantStatus = z.enum(['new', 'screening', 'screened', 'scheduled', 'rejected']);
const InterviewStatus = z.enum(['scheduled', 'confirmed', 'completed']);

const NullableString = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((v) => (v === undefined ? null : v));

const NullableNumber = z
  .union([z.number(), z.string(), z.null(), z.undefined()])
  .transform((v) => {
    if (v === null || v === undefined) return null;
    if (typeof v === 'string') {
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    }
    return v;
  });

const SkillsField = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((v): string[] | null => {
    if (!v) return null;
    try {
      const parsed = JSON.parse(v);
      return Array.isArray(parsed) ? parsed.map(String) : null;
    } catch {
      return null;
    }
  });

export const ApplicantRow = z
  .object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
    phone: NullableString,
    job_title: NullableString,
    years_experience: z.coerce.number().int().nonnegative(),
    cover_letter: NullableString,
    resume_url: NullableString,
    resume_text: NullableString,
    status: ApplicantStatus,
    ai_match_score: NullableNumber,
    ai_reasoning: NullableString,
    ai_extracted_skills: SkillsField,
    created_at: z.string(),
    updated_at: z.string(),
  })
  .transform((r): Applicant => ({
    id: r.id,
    name: r.name,
    email: r.email,
    phone: r.phone ?? '',
    job_title: r.job_title ?? '',
    years_experience: r.years_experience,
    cover_letter: r.cover_letter ?? '',
    resume_url: r.resume_url,
    resume_text: r.resume_text,
    status: r.status,
    ai_match_score: r.ai_match_score,
    ai_reasoning: r.ai_reasoning,
    ai_extracted_skills: r.ai_extracted_skills,
    created_at: r.created_at,
    updated_at: r.updated_at,
  }));

export const InterviewRow = z
  .object({
    id: z.string(),
    applicant_id: z.string(),
    scheduled_date: z.string(),
    scheduled_time: z.string(),
    duration_minutes: z.coerce.number().int().positive(),
    type: z.string(),
    status: InterviewStatus,
    created_at: z.string(),
  })
  .transform(
    (r): Interview => ({
      id: r.id,
      applicant_id: r.applicant_id,
      scheduled_date: r.scheduled_date,
      scheduled_time: r.scheduled_time,
      duration_minutes: r.duration_minutes,
      type: r.type,
      status: r.status,
      created_at: r.created_at,
    })
  );

const InterviewWithJoin = z.object({
  id: z.string(),
  applicant_id: z.string(),
  scheduled_date: z.string(),
  scheduled_time: z.string(),
  duration_minutes: z.coerce.number().int().positive(),
  type: z.string(),
  status: InterviewStatus,
  created_at: z.string(),
  // joined applicant fields, prefixed a_
  a_id: z.string().nullish(),
  a_name: z.string().nullish(),
  a_email: z.string().nullish(),
  a_phone: NullableString,
  a_job_title: NullableString,
  a_years_experience: NullableNumber,
  a_cover_letter: NullableString,
  a_resume_url: NullableString,
  a_resume_text: NullableString,
  a_status: ApplicantStatus.nullish(),
  a_ai_match_score: NullableNumber,
  a_ai_reasoning: NullableString,
  a_ai_extracted_skills: SkillsField,
  a_created_at: z.string().nullish(),
  a_updated_at: z.string().nullish(),
});

export const InterviewWithApplicantRow = InterviewWithJoin.transform(
  (r): Interview & { applicant?: Applicant } => ({
    id: r.id,
    applicant_id: r.applicant_id,
    scheduled_date: r.scheduled_date,
    scheduled_time: r.scheduled_time,
    duration_minutes: r.duration_minutes,
    type: r.type,
    status: r.status,
    created_at: r.created_at,
    applicant: r.a_id
      ? {
          id: r.a_id,
          name: r.a_name ?? '',
          email: r.a_email ?? '',
          phone: r.a_phone ?? '',
          job_title: r.a_job_title ?? '',
          years_experience: r.a_years_experience ?? 0,
          cover_letter: r.a_cover_letter ?? '',
          resume_url: r.a_resume_url,
          resume_text: r.a_resume_text,
          status: r.a_status ?? 'new',
          ai_match_score: r.a_ai_match_score,
          ai_reasoning: r.a_ai_reasoning,
          ai_extracted_skills: r.a_ai_extracted_skills,
          created_at: r.a_created_at ?? '',
          updated_at: r.a_updated_at ?? '',
        }
      : undefined,
  })
);
