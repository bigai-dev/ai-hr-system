import { z } from 'zod';

export const ApplicationSchema = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().toLowerCase().email().max(254),
  phone: z.string().trim().max(32).optional().default(''),
  job_title: z.string().trim().max(200).optional().default(''),
  job_id: z.string().uuid(),
  years_experience: z.coerce.number().int().min(0).max(60).default(0),
  cover_letter: z.string().trim().max(5000).optional().default(''),
  upload_id: z.string().uuid().optional(),
});

export type ApplicationInput = z.infer<typeof ApplicationSchema>;

export const JobInputSchema = z.object({
  title: z.string().trim().min(1).max(200),
  summary: z.string().trim().min(1).max(2_000),
  responsibilities: z.string().trim().max(4_000).optional().default(''),
  required_skills: z.string().trim().max(2_000).optional().default(''),
  nice_to_have_skills: z.string().trim().max(2_000).optional().default(''),
  min_years_experience: z.coerce.number().int().min(0).max(60).default(0),
  additional_notes: z.string().trim().max(4_000).optional().default(''),
  status: z.enum(['active', 'archived']).default('active'),
  hiring_manager_email: z
    .union([z.string().trim().email().max(254), z.literal('')])
    .optional()
    .default(''),
});

export type JobInput = z.infer<typeof JobInputSchema>;

export const ScheduleInterviewSchema = z.object({
  applicant_id: z.string().uuid(),
  scheduled_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  scheduled_time: z.string().regex(/^\d{2}:\d{2}$/, 'Time must be HH:MM'),
  duration_minutes: z.number().int().min(5).max(480).default(30),
  type: z.string().max(100).default('Technical Screen'),
});

export const ApplicantStatusSchema = z.enum([
  'new',
  'screening',
  'screened',
  'phone_screen',
  'onsite',
  'offer',
  'hired',
  'rejected',
  'archived',
  'withdrawn',
]);

export const MAX_RESUME_BYTES = 5 * 1024 * 1024; // 5 MB
export const PDF_MAGIC = Buffer.from('%PDF-', 'utf-8');
