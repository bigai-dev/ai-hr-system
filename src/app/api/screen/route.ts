import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import { JOB_DESCRIPTION } from '@/lib/job-description';

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { applicantId } = await request.json();

    if (!applicantId) {
      return NextResponse.json(
        { error: 'applicantId is required' },
        { status: 400 }
      );
    }

    // Fetch the applicant row
    const { data: applicant, error: fetchError } = await supabase
      .from('applicants')
      .select('*')
      .eq('id', applicantId)
      .single();

    if (fetchError || !applicant) {
      return NextResponse.json(
        { error: 'Applicant not found' },
        { status: 404 }
      );
    }

    // Extract text from PDF resume if available
    let resumeText = '';
    if (applicant.resume_url) {
      try {
        const pdfResponse = await fetch(applicant.resume_url);
        const pdfBuffer = Buffer.from(await pdfResponse.arrayBuffer());
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const pdfParse = require('pdf-parse');
        const pdfData = await pdfParse(pdfBuffer);
        resumeText = pdfData.text;
      } catch (e) {
        console.error('PDF parse error:', e);
      }
    }

    // Update status to screening
    await supabase
      .from('applicants')
      .update({ status: 'screening' })
      .eq('id', applicantId);

    // Call Claude API for AI screening
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: `You are an HR screening AI. Analyze this candidate against the job description. The candidate's cover letter and details are provided. Return ONLY valid JSON: { "match_score": <0-100>, "reasoning": "<2-3 sentence explanation>", "extracted_skills": ["skill1", "skill2", ...] }

CANDIDATE DETAILS:
- Name: ${applicant.name}
- Current Job Title: ${applicant.job_title}
- Years of Experience: ${applicant.years_experience}

CANDIDATE RESUME (extracted from PDF):
${resumeText || 'No resume uploaded'}

CANDIDATE COVER LETTER:
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
    const { error: updateError } = await supabase
      .from('applicants')
      .update({
        ai_match_score: aiAnalysis.match_score,
        ai_reasoning: aiAnalysis.reasoning,
        ai_extracted_skills: aiAnalysis.extracted_skills,
        resume_text: resumeText || null,
        status: 'screened',
      })
      .eq('id', applicantId);

    if (updateError) {
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
