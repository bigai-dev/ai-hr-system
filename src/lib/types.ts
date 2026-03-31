export interface Applicant {
  id: string;
  name: string;
  email: string;
  phone: string;
  job_title: string;
  years_experience: number;
  cover_letter: string;
  resume_url: string | null;
  status: 'new' | 'screening' | 'screened' | 'scheduled' | 'rejected';
  ai_match_score: number | null;
  ai_reasoning: string | null;
  ai_extracted_skills: string[] | null;
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
