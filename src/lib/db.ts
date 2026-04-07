// Client-side database helper - calls /api/db which talks to Turso
import { Applicant, Interview } from './types';

async function dbAction(action: string, params?: Record<string, unknown>) {
  const res = await fetch('/api/db', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, params }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

export const db = {
  // Applicants
  getApplicants: (): Promise<Applicant[]> => dbAction('getApplicants'),
  getApplicant: (id: string): Promise<Applicant | null> => dbAction('getApplicant', { id }),
  getApplicantIds: (): Promise<string[]> => dbAction('getApplicantIds'),
  getScreenedApplicants: (): Promise<Applicant[]> => dbAction('getScreenedApplicants'),
  insertApplicant: (data: {
    name: string;
    email: string;
    phone?: string;
    job_title?: string;
    years_experience?: number;
    cover_letter?: string;
    resume_url?: string | null;
    status?: string;
  }): Promise<Applicant> => dbAction('insertApplicant', data),
  updateApplicantStatus: (id: string, status: string): Promise<void> =>
    dbAction('updateApplicantStatus', { id, status }),
  deleteApplicant: (id: string): Promise<void> => dbAction('deleteApplicant', { id }),

  // Interviews
  getInterviews: (): Promise<(Interview & { applicant?: Applicant })[]> => dbAction('getInterviews'),
  getInterviewsLimited: (): Promise<(Interview & { applicant?: Applicant })[]> =>
    dbAction('getInterviewsLimited'),
  insertInterview: (data: {
    applicant_id: string;
    scheduled_date: string;
    scheduled_time: string;
    duration_minutes?: number;
    type?: string;
    status?: string;
  }): Promise<{ success: boolean; id: string }> => dbAction('insertInterview', data),
  deleteInterview: (id: string): Promise<void> => dbAction('deleteInterview', { id }),
};
