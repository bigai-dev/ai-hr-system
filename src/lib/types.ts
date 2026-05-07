export type ApplicantStatus =
  | 'new'
  | 'screening'
  | 'screened'
  | 'phone_screen'
  | 'onsite'
  | 'offer'
  | 'hired'
  | 'rejected'
  | 'archived'
  | 'withdrawn';

// Columns shown on the kanban board, left-to-right.
// 'screening' is transient (AI is mid-flight) — folded into 'New' visually.
// Terminal states ('rejected','archived','withdrawn') live in a separate rail.
export const PIPELINE_STAGES: ApplicantStatus[] = [
  'new',
  'screened',
  'phone_screen',
  'onsite',
  'offer',
  'hired',
];

export const TERMINAL_STAGES: ApplicantStatus[] = [
  'rejected',
  'archived',
  'withdrawn',
];

export const STAGE_LABELS: Record<ApplicantStatus, string> = {
  new: 'New',
  screening: 'Screening',
  screened: 'Screened',
  phone_screen: 'Phone Screen',
  onsite: 'Onsite',
  offer: 'Offer',
  hired: 'Hired',
  rejected: 'Rejected',
  archived: 'Archived',
  withdrawn: 'Withdrawn',
};

export interface Applicant {
  id: string;
  name: string;
  email: string;
  phone: string;
  job_title: string;
  job_id: string | null;
  years_experience: number;
  cover_letter: string;
  resume_url: string | null;
  resume_text: string | null;
  status: ApplicantStatus;
  ai_match_score: number | null;
  ai_reasoning: string | null;
  ai_extracted_skills: string[] | null;
  stage_changed_at: string;
  created_at: string;
  updated_at: string;
}

export interface Job {
  id: string;
  title: string;
  summary: string;
  responsibilities: string;
  required_skills: string;        // comma-separated
  nice_to_have_skills: string;    // comma-separated
  min_years_experience: number;
  additional_notes: string;
  status: 'active' | 'archived';
  hiring_manager_email: string | null;
  created_at: string;
  updated_at: string;
}

export interface Interview {
  id: string;
  applicant_id: string;
  scheduled_date: string;
  scheduled_time: string;
  duration_minutes: number;
  type: string;
  status: 'scheduled' | 'confirmed' | 'completed';
  created_at: string;
  applicant?: Applicant;
}
