import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { JOB_DESCRIPTION } from '@/lib/job-description';
import { turso } from '@/lib/turso';

export async function POST(request: NextRequest) {
  try {
    const { applicantId } = await request.json();

    if (!applicantId) {
      return NextResponse.json(
        { error: 'applicantId is required' },
        { status: 400 }
      );
    }

    // Fetch the applicant row
    const { rows } = await turso.execute({
      sql: 'SELECT * FROM applicants WHERE id = ?',
      args: [applicantId],
    });

    if (rows.length === 0) {
      return NextResponse.json(
        { error: 'Applicant not found' },
        { status: 404 }
      );
    }

    const applicant = rows[0] as Record<string, unknown>;

    // Extract text from PDF resume if available
    let resumeText = '';
    if (applicant.resume_url as string) {
      try {
        const { extractText } = await import('unpdf');
        const pdfResponse = await fetch(applicant.resume_url as string);
        const pdfBuffer = new Uint8Array(await pdfResponse.arrayBuffer());
        const { text } = await extractText(pdfBuffer);
        resumeText = Array.isArray(text) ? text.join('\n') : String(text);
      } catch (e) {
        console.error('PDF parse error:', e);
      }
    }

    // Update status to screening
    await turso.execute({
      sql: "UPDATE applicants SET status = 'screening', updated_at = datetime('now') WHERE id = ?",
      args: [applicantId],
    });

    // Call Claude API for AI screening
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: `You are an HR screening AI. Analyze this candidate against the job description.

IMPORTANT: Base your scoring PRIMARILY on the candidate's resume/CV content. The resume is the main source of truth for skills, experience, and qualifications. The cover letter is supplementary context only - do not let it significantly influence the score if a resume is provided.

Return ONLY valid JSON: { "match_score": <0-100>, "reasoning": "<2-3 sentence explanation>", "extracted_skills": ["skill1", "skill2", ...] }

CANDIDATE DETAILS:
- Name: ${applicant.name}
- Current Job Title: ${applicant.job_title}
- Years of Experience: ${applicant.years_experience}

CANDIDATE RESUME (extracted from PDF) - PRIMARY SOURCE FOR SCORING:
${resumeText || 'No resume uploaded'}

CANDIDATE COVER LETTER (supplementary context only):
${applicant.cover_letter || 'No cover letter provided'}

JOB DESCRIPTION:
${JOB_DESCRIPTION}`,
        },
      ],
    });

    // Parse the JSON response from Claude
    const responseText =
      message.content[0].type === 'text' ? message.content[0].text : '';

    let aiAnalysis: {
      match_score: number;
      reasoning: string;
      extracted_skills: string[];
    };

    try {
      // Handle potential markdown code blocks in response
      const jsonStr = responseText
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      aiAnalysis = JSON.parse(jsonStr);
    } catch {
      return NextResponse.json(
        { error: 'Failed to parse AI response', raw: responseText },
        { status: 500 }
      );
    }

    // Update the applicant row with AI results
    try {
      await turso.execute({
        sql: `UPDATE applicants SET
          ai_match_score = ?,
          ai_reasoning = ?,
          ai_extracted_skills = ?,
          resume_text = ?,
          status = 'screened',
          updated_at = datetime('now')
          WHERE id = ?`,
        args: [
          aiAnalysis.match_score,
          aiAnalysis.reasoning,
          JSON.stringify(aiAnalysis.extracted_skills),
          resumeText || null,
          applicantId,
        ],
      });
    } catch {
      return NextResponse.json(
        { error: 'Failed to update applicant with AI results' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      applicantId,
      match_score: aiAnalysis.match_score,
      reasoning: aiAnalysis.reasoning,
      extracted_skills: aiAnalysis.extracted_skills,
    });
  } catch (err: unknown) {
    console.error('Screen API error:', err);
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
