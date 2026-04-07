import { NextRequest, NextResponse } from 'next/server';
import { turso } from '@/lib/turso';

// Generic DB proxy for client components to execute queries via fetch
// This replaces the direct Supabase client calls from the browser
export async function POST(request: NextRequest) {
  try {
    const { action, params } = await request.json();

    switch (action) {
      // ── Applicants ──────────────────────────────────────────────────
      case 'getApplicants': {
        const result = await turso.execute(
          'SELECT * FROM applicants ORDER BY CASE WHEN ai_match_score IS NULL THEN 1 ELSE 0 END, ai_match_score DESC'
        );
        const applicants = result.rows.map(parseApplicantRow);
        return NextResponse.json(applicants);
      }

      case 'getApplicant': {
        const result = await turso.execute({
          sql: 'SELECT * FROM applicants WHERE id = ?',
          args: [params.id],
        });
        if (result.rows.length === 0) {
          return NextResponse.json(null);
        }
        return NextResponse.json(parseApplicantRow(result.rows[0]));
      }

      case 'getApplicantIds': {
        const result = await turso.execute(
          'SELECT id FROM applicants ORDER BY created_at DESC'
        );
        return NextResponse.json(result.rows.map((r) => r.id as string));
      }

      case 'getScreenedApplicants': {
        const result = await turso.execute(
          "SELECT * FROM applicants WHERE status = 'screened' ORDER BY ai_match_score DESC"
        );
        return NextResponse.json(result.rows.map(parseApplicantRow));
      }

      case 'insertApplicant': {
        const { name, email, phone, job_title, years_experience, cover_letter, resume_url, status } = params;
        const id = crypto.randomUUID();
        await turso.execute({
          sql: `INSERT INTO applicants (id, name, email, phone, job_title, years_experience, cover_letter, resume_url, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [id, name, email, phone || null, job_title || null, years_experience || 0, cover_letter || null, resume_url || null, status || 'new'],
        });
        const result = await turso.execute({
          sql: 'SELECT * FROM applicants WHERE id = ?',
          args: [id],
        });
        return NextResponse.json(parseApplicantRow(result.rows[0]));
      }

      case 'updateApplicantStatus': {
        await turso.execute({
          sql: "UPDATE applicants SET status = ?, updated_at = datetime('now') WHERE id = ?",
          args: [params.status, params.id],
        });
        return NextResponse.json({ success: true });
      }

      case 'deleteApplicant': {
        await turso.execute({
          sql: 'DELETE FROM applicants WHERE id = ?',
          args: [params.id],
        });
        return NextResponse.json({ success: true });
      }

      // ── Interviews ──────────────────────────────────────────────────
      case 'getInterviews': {
        const result = await turso.execute(
          'SELECT i.*, a.id as a_id, a.name as a_name, a.email as a_email, a.phone as a_phone, a.job_title as a_job_title, a.years_experience as a_years_experience, a.cover_letter as a_cover_letter, a.resume_url as a_resume_url, a.resume_text as a_resume_text, a.status as a_status, a.ai_match_score as a_ai_match_score, a.ai_reasoning as a_ai_reasoning, a.ai_extracted_skills as a_ai_extracted_skills, a.created_at as a_created_at, a.updated_at as a_updated_at FROM interviews i LEFT JOIN applicants a ON i.applicant_id = a.id ORDER BY i.scheduled_date ASC'
        );
        return NextResponse.json(result.rows.map(parseInterviewWithApplicant));
      }

      case 'getInterviewsLimited': {
        const result = await turso.execute(
          'SELECT i.*, a.id as a_id, a.name as a_name, a.email as a_email, a.phone as a_phone, a.job_title as a_job_title, a.years_experience as a_years_experience, a.cover_letter as a_cover_letter, a.resume_url as a_resume_url, a.resume_text as a_resume_text, a.status as a_status, a.ai_match_score as a_ai_match_score, a.ai_reasoning as a_ai_reasoning, a.ai_extracted_skills as a_ai_extracted_skills, a.created_at as a_created_at, a.updated_at as a_updated_at FROM interviews i LEFT JOIN applicants a ON i.applicant_id = a.id ORDER BY i.scheduled_date ASC LIMIT 5'
        );
        return NextResponse.json(result.rows.map(parseInterviewWithApplicant));
      }

      case 'insertInterview': {
        const { applicant_id, scheduled_date, scheduled_time, duration_minutes, type, status } = params;
        const id = crypto.randomUUID();
        await turso.execute({
          sql: `INSERT INTO interviews (id, applicant_id, scheduled_date, scheduled_time, duration_minutes, type, status)
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
          args: [id, applicant_id, scheduled_date, scheduled_time, duration_minutes || 30, type || 'Technical Screen', status || 'scheduled'],
        });
        return NextResponse.json({ success: true, id });
      }

      case 'deleteInterview': {
        await turso.execute({
          sql: 'DELETE FROM interviews WHERE id = ?',
          args: [params.id],
        });
        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (err: unknown) {
    console.error('DB API error:', err);
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ── Row parsers ──────────────────────────────────────────────────────────────

function parseApplicantRow(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    name: row.name as string,
    email: row.email as string,
    phone: row.phone as string,
    job_title: row.job_title as string,
    years_experience: row.years_experience as number,
    cover_letter: row.cover_letter as string,
    resume_url: (row.resume_url as string) || null,
    resume_text: (row.resume_text as string) || null,
    status: row.status as string,
    ai_match_score: row.ai_match_score != null ? Number(row.ai_match_score) : null,
    ai_reasoning: (row.ai_reasoning as string) || null,
    ai_extracted_skills: row.ai_extracted_skills ? JSON.parse(row.ai_extracted_skills as string) : null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

function parseInterviewWithApplicant(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    applicant_id: row.applicant_id as string,
    scheduled_date: row.scheduled_date as string,
    scheduled_time: row.scheduled_time as string,
    duration_minutes: row.duration_minutes as number,
    type: row.type as string,
    status: row.status as string,
    created_at: row.created_at as string,
    applicant: row.a_id
      ? {
          id: row.a_id as string,
          name: row.a_name as string,
          email: row.a_email as string,
          phone: row.a_phone as string,
          job_title: row.a_job_title as string,
          years_experience: row.a_years_experience as number,
          cover_letter: row.a_cover_letter as string,
          resume_url: (row.a_resume_url as string) || null,
          resume_text: (row.a_resume_text as string) || null,
          status: row.a_status as string,
          ai_match_score: row.a_ai_match_score != null ? Number(row.a_ai_match_score) : null,
          ai_reasoning: (row.a_ai_reasoning as string) || null,
          ai_extracted_skills: row.a_ai_extracted_skills ? JSON.parse(row.a_ai_extracted_skills as string) : null,
          created_at: row.a_created_at as string,
          updated_at: row.a_updated_at as string,
        }
      : undefined,
  };
}
