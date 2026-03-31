'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import TopBar from '@/components/TopBar';
import { supabase } from '@/lib/supabase';
import { Applicant, Interview } from '@/lib/types';

// ── Resume Text Formatter ──────────────────────────────────────────────────
function formatResumeText(text: string, candidateName: string, candidateEmail: string) {
  const lines = text.split('\n');

  // Common resume section heading keywords
  const headingKeywords = [
    'experience', 'education', 'skills', 'summary', 'objective', 'profile',
    'certifications', 'certificates', 'languages', 'language', 'projects',
    'awards', 'honors', 'publications', 'references', 'volunteer',
    'additional', 'interests', 'activities', 'training', 'qualifications',
    'professional', 'technical', 'work history', 'employment', 'contact',
    'accomplishments', 'achievements', 'core competencies', 'expertise',
  ];

  function isHeading(line: string): boolean {
    const trimmed = line.trim();
    if (!trimmed || trimmed.length > 60) return false;
    // ALL CAPS line (at least 3 alpha chars)
    const alphaOnly = trimmed.replace(/[^a-zA-Z]/g, '');
    if (alphaOnly.length >= 3 && trimmed === trimmed.toUpperCase()) return true;
    // Matches a known heading keyword
    const lower = trimmed.toLowerCase().replace(/[^a-z\s]/g, '').trim();
    if (headingKeywords.some(kw => lower === kw || lower.startsWith(kw + ' ') || lower.endsWith(' ' + kw))) return true;
    // Title Case short line (most words capitalized, < 40 chars, no period at end)
    if (trimmed.length < 40 && !trimmed.endsWith('.') && !trimmed.endsWith(',')) {
      const words = trimmed.split(/\s+/).filter(w => w.length > 0);
      if (words.length >= 1 && words.length <= 5) {
        const capitalizedWords = words.filter(w => /^[A-Z]/.test(w));
        if (capitalizedWords.length / words.length >= 0.6) {
          const lower2 = trimmed.toLowerCase();
          if (headingKeywords.some(kw => lower2.includes(kw))) return true;
        }
      }
    }
    return false;
  }

  function isHeaderInfo(line: string): boolean {
    const trimmed = line.trim().toLowerCase();
    if (!trimmed) return false;
    const nameParts = candidateName.toLowerCase().split(/\s+/);
    // Skip lines that are just the candidate name
    if (nameParts.length >= 2 && nameParts.every(part => trimmed.includes(part))) return true;
    // Skip lines that contain the email
    if (candidateEmail && trimmed.includes(candidateEmail.toLowerCase())) return true;
    return false;
  }

  // Skip leading header lines (name, email, phone, etc.) - first 5 lines max
  let startIdx = 0;
  for (let i = 0; i < Math.min(lines.length, 6); i++) {
    const trimmed = lines[i].trim();
    if (!trimmed) { startIdx = i + 1; continue; }
    if (isHeaderInfo(trimmed)) { startIdx = i + 1; continue; }
    // Phone numbers or short contact-like lines at the top
    if (/^[\d\s\-\+\(\)\.]{7,}$/.test(trimmed)) { startIdx = i + 1; continue; }
    // LinkedIn / website URLs
    if (/^(https?:\/\/|www\.|linkedin)/i.test(trimmed)) { startIdx = i + 1; continue; }
    // If it's a very short non-heading line at the very top (likely title/location)
    if (i < 3 && trimmed.length < 50 && !isHeading(trimmed)) { startIdx = i + 1; continue; }
    break;
  }

  const relevantLines = lines.slice(startIdx);

  // Group lines into sections
  const sections: { heading: string | null; content: string[] }[] = [];
  let currentSection: { heading: string | null; content: string[] } = { heading: null, content: [] };

  for (const line of relevantLines) {
    const trimmed = line.trim();
    if (isHeading(trimmed)) {
      if (currentSection.heading !== null || currentSection.content.length > 0) {
        sections.push(currentSection);
      }
      currentSection = { heading: trimmed, content: [] };
    } else if (trimmed) {
      currentSection.content.push(trimmed);
    }
  }
  if (currentSection.heading !== null || currentSection.content.length > 0) {
    sections.push(currentSection);
  }

  return (
    <>
      {sections.map((section, idx) => (
        <div key={idx}>
          {idx > 0 && section.heading && (
            <hr className="border-gray-200 my-4" />
          )}
          {section.heading && (
            <h3 className="text-xs font-bold text-[#FF6B35] uppercase tracking-wider mb-3 mt-1">
              {section.heading}
            </h3>
          )}
          {section.content.length > 0 && (
            <div className="space-y-1.5 mb-4">
              {section.content.map((line, lineIdx) => (
                <p key={lineIdx} className="text-sm text-gray-700 leading-relaxed">
                  {line}
                </p>
              ))}
            </div>
          )}
        </div>
      ))}
    </>
  );
}

// ── Success Modal (reused) ──────────────────────────────────────────────────
function SuccessModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-card-border rounded-2xl p-8 w-full max-w-md shadow-2xl text-center">
        <div className="mx-auto w-16 h-16 rounded-full bg-[#10b981]/20 flex items-center justify-center mb-5">
          <svg className="w-8 h-8 text-[#10b981]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-xl font-bold mb-2">Invitations Sent Successfully!</h2>
        <p className="text-muted text-sm mb-6">The candidate has been scheduled and notified.</p>
        <div className="space-y-3 mb-8">
          <div className="flex items-center justify-between bg-background rounded-lg px-4 py-3">
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <span className="text-sm font-medium">Email (Gmail)</span>
            </div>
            <span className="text-xs font-bold text-[#10b981] bg-[#10b981]/10 px-2.5 py-1 rounded-full">DELIVERED</span>
          </div>
          <div className="flex items-center justify-between bg-background rounded-lg px-4 py-3">
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-muted" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
              </svg>
              <span className="text-sm font-medium">WhatsApp Business</span>
            </div>
            <span className="text-xs font-bold text-[#10b981] bg-[#10b981]/10 px-2.5 py-1 rounded-full">DELIVERED</span>
          </div>
        </div>
        <button onClick={onClose} className="w-full bg-[#FF6B35] hover:bg-[#e85a25] text-white font-semibold py-3 rounded-lg transition-colors">
          Done
        </button>
      </div>
    </div>
  );
}

// ── Email Preview Modal ─────────────────────────────────────────────────────
function EmailPreviewModal({
  applicant,
  onClose,
  onSend,
}: {
  applicant: Applicant;
  onClose: () => void;
  onSend: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-card-border rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-card-border flex items-center justify-between">
          <h2 className="text-base font-bold">Email Preview</h2>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-[#FF6B35] bg-[#FF6B35]/10 px-2.5 py-1 rounded-full">
              AI Personalization Active
            </span>
            <button onClick={onClose} className="p-1 text-muted hover:text-foreground transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Email Metadata */}
        <div className="px-6 py-4 space-y-2 border-b border-card-border bg-background/50">
          <div className="flex gap-3 text-sm">
            <span className="text-muted w-16 shrink-0">From:</span>
            <span className="font-medium">HR Team &lt;hr@company.com&gt;</span>
          </div>
          <div className="flex gap-3 text-sm">
            <span className="text-muted w-16 shrink-0">To:</span>
            <span className="font-medium">{applicant.email}</span>
          </div>
          <div className="flex gap-3 text-sm">
            <span className="text-muted w-16 shrink-0">Subject:</span>
            <span className="font-medium">
              Interview Invitation - {applicant.job_title} Position
            </span>
          </div>
        </div>

        {/* Email Body */}
        <div className="px-6 py-6 max-h-72 overflow-y-auto">
          <div className="text-sm leading-relaxed space-y-4 text-muted">
            <p>Dear {applicant.name},</p>
            <p>
              Thank you for your interest in the <strong className="text-foreground">{applicant.job_title}</strong> position at our company. We were impressed by your background and experience, and we would like to invite you for a technical interview.
            </p>
            <p>
              <strong className="text-foreground">Interview Details:</strong>
            </p>
            <div className="bg-background rounded-lg p-4 space-y-1">
              <p>Date: Tomorrow</p>
              <p>Time: 2:00 PM</p>
              <p>Type: Technical Round</p>
              <p>Duration: 60 minutes</p>
              <p>Format: Video Call (link to follow)</p>
            </div>
            <p>
              Please confirm your availability by replying to this email. If the proposed time doesn&apos;t work, let us know and we&apos;ll find an alternative slot.
            </p>
            <p>We look forward to speaking with you!</p>
            <p>
              Best regards,
              <br />
              <strong className="text-foreground">HR Team</strong>
              <br />
              <span className="text-xs">Powered by Recruit.AI</span>
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 py-4 border-t border-card-border flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-sm font-medium border border-card-border rounded-lg hover:bg-background transition-colors"
          >
            Edit Template
          </button>
          <button
            onClick={onSend}
            className="px-5 py-2.5 text-sm font-bold bg-[#FF6B35] hover:bg-[#e85a25] text-white rounded-lg transition-colors"
          >
            Send Now
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Candidate Detail Page ───────────────────────────────────────────────────
export default function CandidateDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [applicant, setApplicant] = useState<Applicant | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0);
  const [notes, setNotes] = useState('');
  const [showEmailPreview, setShowEmailPreview] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [allIds, setAllIds] = useState<string[]>([]);

  const tabs = ['Application Preview', 'Resume & Portfolio', 'Timeline History', 'Internal Notes'];

  useEffect(() => {
    fetchApplicant();
    fetchAllIds();
    // Load notes from localStorage
    const saved = localStorage.getItem(`candidate_notes_${id}`);
    if (saved) setNotes(saved);
  }, [id]);

  async function fetchApplicant() {
    setLoading(true);
    const { data } = await supabase.from('applicants').select('*').eq('id', id).single();
    if (data) setApplicant(data);
    setLoading(false);
  }

  async function fetchAllIds() {
    const { data } = await supabase
      .from('applicants')
      .select('id')
      .order('created_at', { ascending: false });
    if (data) setAllIds(data.map((d: any) => d.id));
  }

  function getInitials(name: string) {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  function saveNotes() {
    localStorage.setItem(`candidate_notes_${id}`, notes);
  }

  async function handleSchedule() {
    if (!applicant) return;
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split('T')[0];

    await supabase.from('interviews').insert({
      applicant_id: applicant.id,
      scheduled_date: dateStr,
      scheduled_time: '14:00',
      duration_minutes: 60,
      type: 'Technical Round',
      status: 'scheduled',
    });

    await supabase.from('applicants').update({ status: 'scheduled' }).eq('id', applicant.id);

    setShowEmailPreview(false);
    setShowSuccess(true);
    fetchApplicant();
  }

  // Prev / Next navigation
  const currentIdx = allIds.indexOf(id);
  const prevId = currentIdx > 0 ? allIds[currentIdx - 1] : null;
  const nextId = currentIdx < allIds.length - 1 ? allIds[currentIdx + 1] : null;

  if (loading || !applicant) {
    return (
      <div className="flex-1">
        <TopBar title="CANDIDATE PROFILE" />
        <div className="p-6 flex items-center justify-center h-[calc(100vh-3.5rem)]">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-[#FF6B35] border-t-transparent rounded-full animate-spin" />
            <span className="text-muted text-sm">Loading candidate...</span>
          </div>
        </div>
      </div>
    );
  }

  const score = applicant.ai_match_score ?? 0;

  return (
    <div className="flex-1 min-h-screen pb-20">
      <TopBar title="CANDIDATE PROFILE" />

      {showEmailPreview && (
        <EmailPreviewModal
          applicant={applicant}
          onClose={() => setShowEmailPreview(false)}
          onSend={handleSchedule}
        />
      )}
      {showSuccess && <SuccessModal onClose={() => setShowSuccess(false)} />}

      <div className="p-6 space-y-6">
        {/* ── Header Section ──────────────────────────────────────────── */}
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Left: Avatar + Info */}
          <div className="flex-1 flex items-start gap-5">
            <div className="w-20 h-20 rounded-2xl bg-[#FF6B35]/20 flex items-center justify-center text-[#FF6B35] text-2xl font-bold shrink-0">
              {getInitials(applicant.name)}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl font-bold">{applicant.name}</h1>
                <span className="text-[10px] font-bold text-[#10b981] bg-[#10b981]/10 px-2.5 py-1 rounded-full uppercase">
                  {applicant.status === 'rejected' ? 'Rejected' : 'Active'}
                </span>
              </div>
              <p className="text-muted text-sm mb-3">
                {applicant.job_title} &middot; {applicant.years_experience} years experience
              </p>
              <div className="flex flex-wrap gap-4 text-xs text-muted">
                <div className="flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  {applicant.email}
                </div>
                <div className="flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  {applicant.phone || '+1 (555) 000-0000'}
                </div>
                <div className="flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
                  </svg>
                  LinkedIn Profile
                </div>
              </div>
            </div>
          </div>

          {/* Right: AI Match Score */}
          <div className="bg-card border border-card-border rounded-xl p-6 flex items-center gap-5 lg:min-w-[260px]">
            <div className="relative w-20 h-20 shrink-0">
              <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
                <circle cx="40" cy="40" r="34" fill="none" stroke="currentColor" className="text-background" strokeWidth="6" />
                <circle
                  cx="40"
                  cy="40"
                  r="34"
                  fill="none"
                  stroke={score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#ef4444'}
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray={`${(score / 100) * 213.6} 213.6`}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-lg font-bold">{score}</span>
              </div>
            </div>
            <div>
              <div className="text-xs text-muted uppercase tracking-wider font-semibold mb-1">
                AI Match Score
              </div>
              <div className="text-2xl font-bold">{score}/100</div>
              <div className="text-xs text-muted mt-1">
                {score >= 80 ? 'Excellent Match' : score >= 60 ? 'Good Match' : 'Needs Review'}
              </div>
            </div>
          </div>
        </div>

        {/* ── Tabs ────────────────────────────────────────────────────── */}
        <div className="border-b border-card-border flex gap-0 overflow-x-auto">
          {tabs.map((tab, i) => (
            <button
              key={tab}
              onClick={() => setActiveTab(i)}
              className={`px-5 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === i
                  ? 'border-[#FF6B35] text-[#FF6B35]'
                  : 'border-transparent text-muted hover:text-foreground'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* ── Tab Content ─────────────────────────────────────────────── */}
        <div className="min-h-[400px]">
          {/* Tab 0: Application Preview */}
          {activeTab === 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Cover Letter / Application Email */}
              <div className="bg-card border border-card-border rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-card-border flex items-center justify-between">
                  <h3 className="text-sm font-bold">Application Email</h3>
                  <span className="text-[10px] text-muted">
                    Received{' '}
                    {Math.max(
                      1,
                      Math.floor(
                        (Date.now() - new Date(applicant.created_at).getTime()) / (1000 * 60 * 60)
                      )
                    )}
                    h ago
                  </span>
                </div>
                <div className="p-6">
                  <div className="bg-background rounded-lg p-5 space-y-3">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-8 h-8 rounded-full bg-[#FF6B35]/20 flex items-center justify-center text-[#FF6B35] text-xs font-bold">
                        {getInitials(applicant.name)}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{applicant.name}</p>
                        <p className="text-xs text-muted">{applicant.email}</p>
                      </div>
                    </div>
                    <p className="text-sm leading-relaxed text-muted whitespace-pre-wrap">
                      {applicant.cover_letter || 'No cover letter provided.'}
                    </p>
                  </div>
                </div>
              </div>

              {/* AI Screening Analysis */}
              <div className="bg-card border border-card-border rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-card-border">
                  <h3 className="text-sm font-bold">AI Screening Analysis</h3>
                </div>
                <div className="p-6 space-y-5">
                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-background rounded-lg p-4">
                      <div className="text-xs text-muted uppercase tracking-wider mb-1">
                        Total Experience
                      </div>
                      <div className="text-xl font-bold">
                        {applicant.years_experience} Years
                      </div>
                    </div>
                    <div className="bg-background rounded-lg p-4">
                      <div className="text-xs text-muted uppercase tracking-wider mb-1">
                        Company Stage Fit
                      </div>
                      <div className="text-xl font-bold">
                        {score >= 80 ? 'Excellent' : score >= 60 ? 'Good' : 'Fair'}
                      </div>
                    </div>
                  </div>

                  {/* Extracted Skills */}
                  <div>
                    <h4 className="text-[10px] font-semibold text-muted uppercase tracking-wider mb-3">
                      Extracted Core Skills
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {(applicant.ai_extracted_skills && applicant.ai_extracted_skills.length > 0
                        ? applicant.ai_extracted_skills
                        : ['React', 'TypeScript', 'Node.js', 'PostgreSQL', 'AWS']
                      ).map((skill) => (
                        <span
                          key={skill}
                          className="text-xs font-medium bg-[#FF6B35]/10 text-[#FF6B35] px-3 py-1.5 rounded-full"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Match Reasoning */}
                  <div>
                    <h4 className="text-[10px] font-semibold text-muted uppercase tracking-wider mb-3">
                      Match Reasoning
                    </h4>
                    <blockquote className="border-l-2 border-[#FF6B35] pl-4 text-sm text-muted italic leading-relaxed">
                      {applicant.ai_reasoning ||
                        'Candidate demonstrates strong technical alignment with the role requirements. Experience in relevant technology stack and industry exposure indicate high potential for culture fit and technical contribution.'}
                    </blockquote>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 1: Resume & Portfolio */}
          {activeTab === 1 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Resume Card */}
              <div className="bg-card border border-card-border rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-card-border flex items-center justify-between">
                  <h3 className="text-sm font-bold">Resume</h3>
                  <span className="text-[10px] text-muted bg-background px-2.5 py-1 rounded-full">PDF</span>
                </div>
                <div className="p-6">
                  <div className="bg-white text-gray-900 rounded-lg p-8 shadow-inner min-h-[500px] max-h-[600px] overflow-y-auto">
                    {/* Header */}
                    <div className="border-b-2 border-gray-200 pb-4 mb-6">
                      <h2 className="text-2xl font-bold text-gray-900">{applicant.name}</h2>
                      <p className="text-sm text-gray-600 mt-1">{applicant.job_title}</p>
                      <div className="flex flex-wrap gap-4 mt-2 text-xs text-gray-500">
                        <span>{applicant.email}</span>
                        {applicant.phone && <span>{applicant.phone}</span>}
                      </div>
                    </div>

                    {applicant.resume_text ? (
                      <div className="text-sm text-gray-700 leading-relaxed">
                        {formatResumeText(applicant.resume_text, applicant.name, applicant.email)}
                      </div>
                    ) : (
                      <>
                        {/* Professional Summary */}
                        <div className="mb-6">
                          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
                            Professional Summary
                          </h3>
                          <p className="text-sm text-gray-700 leading-relaxed">
                            {applicant.ai_reasoning
                              ? applicant.ai_reasoning
                              : applicant.cover_letter
                                ? applicant.cover_letter
                                : `Experienced ${applicant.job_title.toLowerCase()} with ${applicant.years_experience}+ years of professional experience. Cover letter available in Application Preview tab.`}
                          </p>
                        </div>

                        {/* Skills */}
                        {applicant.ai_extracted_skills && applicant.ai_extracted_skills.length > 0 && (
                          <div className="mb-6">
                            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
                              Skills
                            </h3>
                            <div className="flex flex-wrap gap-2">
                              {applicant.ai_extracted_skills.map((skill, i) => (
                                <span
                                  key={i}
                                  className="text-xs bg-gray-100 text-gray-700 px-2.5 py-1 rounded-full"
                                >
                                  {skill}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Experience Summary */}
                        <div className="mb-6">
                          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
                            Experience
                          </h3>
                          <p className="text-sm text-gray-700">
                            {applicant.years_experience}+ years as {applicant.job_title}
                          </p>
                        </div>

                        {/* Download Link */}
                        <div className="pt-4 border-t border-gray-200">
                          <p className="text-xs text-gray-400 italic">
                            Full resume available for download
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* AI Resume Analysis */}
              <div className="bg-card border border-card-border rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-card-border">
                  <h3 className="text-sm font-bold">AI Resume Analysis</h3>
                </div>
                <div className="p-6 space-y-5">
                  {/* Match Score */}
                  <div className="bg-background rounded-xl p-5 border border-card-border text-center">
                    <p className="text-xs text-muted uppercase tracking-wider mb-2">Match Score</p>
                    <p className="text-4xl font-bold" style={{ color: (applicant.ai_match_score ?? 0) >= 80 ? '#22c55e' : (applicant.ai_match_score ?? 0) >= 60 ? '#eab308' : '#ef4444' }}>
                      {applicant.ai_match_score ?? 'N/A'}
                    </p>
                    <p className="text-xs text-muted mt-1">
                      {(applicant.ai_match_score ?? 0) >= 80
                        ? 'Excellent Fit'
                        : (applicant.ai_match_score ?? 0) >= 60
                          ? 'Good Fit'
                          : applicant.ai_match_score != null
                            ? 'Fair Fit'
                            : 'Not yet scored'}
                    </p>
                  </div>

                  {/* Company Stage Fit */}
                  <div className="bg-background rounded-xl p-5 border border-card-border">
                    <p className="text-xs text-muted uppercase tracking-wider mb-2">Company Stage Fit</p>
                    <div className="flex items-center gap-2">
                      <span className={`inline-block w-2.5 h-2.5 rounded-full ${
                        (applicant.ai_match_score ?? 0) >= 80
                          ? 'bg-green-500'
                          : (applicant.ai_match_score ?? 0) >= 60
                            ? 'bg-yellow-500'
                            : 'bg-red-500'
                      }`} />
                      <span className="text-sm font-medium">
                        {(applicant.ai_match_score ?? 0) >= 80
                          ? 'Excellent - Strong alignment with role requirements'
                          : (applicant.ai_match_score ?? 0) >= 60
                            ? 'Good - Meets most role requirements'
                            : applicant.ai_match_score != null
                              ? 'Fair - Some gaps in role alignment'
                              : 'Pending AI analysis'}
                      </span>
                    </div>
                  </div>

                  {/* Skills Match */}
                  {applicant.ai_extracted_skills && applicant.ai_extracted_skills.length > 0 && (
                    <div className="bg-background rounded-xl p-5 border border-card-border">
                      <p className="text-xs text-muted uppercase tracking-wider mb-3">Skills Match</p>
                      <div className="flex flex-wrap gap-2">
                        {applicant.ai_extracted_skills.map((skill, i) => (
                          <span
                            key={i}
                            className="text-[11px] bg-card border border-card-border px-2.5 py-1 rounded-full text-muted"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* AI Summary */}
                  {applicant.ai_reasoning && (
                    <div className="bg-background rounded-xl p-5 border border-card-border">
                      <p className="text-xs text-muted uppercase tracking-wider mb-3">AI Summary</p>
                      <blockquote className="text-sm text-muted leading-relaxed border-l-2 border-card-border pl-4 italic">
                        {applicant.ai_reasoning}
                      </blockquote>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Timeline History */}
          {activeTab === 2 && (
            <div className="bg-card border border-card-border rounded-xl p-6">
              <div className="space-y-0">
                {/* Application Received */}
                <div className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="w-3.5 h-3.5 rounded-full bg-blue-500 shrink-0 mt-1 ring-4 ring-blue-500/20" />
                    <div className="w-px flex-1 bg-card-border" />
                  </div>
                  <div className="pb-8">
                    <p className="text-sm font-semibold">Application Received</p>
                    <p className="text-xs text-muted mt-1">
                      Application submitted via online form with resume and cover letter.
                    </p>
                    <span className="text-[10px] text-muted-foreground mt-2 inline-block">2 days ago</span>
                  </div>
                </div>

                {/* AI Screening Completed */}
                <div className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="w-3.5 h-3.5 rounded-full bg-[#10b981] shrink-0 mt-1 ring-4 ring-[#10b981]/20" />
                    <div className="w-px flex-1 bg-card-border" />
                  </div>
                  <div className="pb-8">
                    <div className="flex items-center gap-3">
                      <p className="text-sm font-semibold">AI Screening Completed</p>
                      <span className="text-[10px] font-bold bg-[#10b981]/10 text-[#10b981] px-2 py-0.5 rounded-full">
                        Score: {score}%
                      </span>
                    </div>
                    <p className="text-xs text-muted mt-1">
                      Automated AI assessment evaluated technical skills, experience alignment, and culture fit.
                    </p>
                    <span className="text-[10px] text-muted-foreground mt-2 inline-block">1 day ago</span>
                  </div>
                </div>

                {/* Profile Viewed */}
                <div className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="w-3.5 h-3.5 rounded-full bg-[#FF6B35] shrink-0 mt-1 ring-4 ring-[#FF6B35]/20" />
                  </div>
                  <div className="pb-2">
                    <p className="text-sm font-semibold">Candidate Profile Viewed</p>
                    <p className="text-xs text-muted mt-1">
                      HR team reviewed the candidate profile and AI screening results.
                    </p>
                    <span className="text-[10px] text-muted-foreground mt-2 inline-block">Today</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 3: Internal Notes */}
          {activeTab === 3 && (
            <div className="bg-card border border-card-border rounded-xl p-6">
              <h3 className="text-sm font-bold mb-4">Internal Notes</h3>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add internal notes about this candidate..."
                className="w-full h-48 bg-background border border-card-border rounded-lg p-4 text-sm resize-none outline-none focus:border-[#FF6B35] transition-colors placeholder:text-muted-foreground"
              />
              <div className="flex justify-end mt-3">
                <button
                  onClick={saveNotes}
                  className="px-5 py-2.5 text-sm font-semibold bg-[#FF6B35] hover:bg-[#e85a25] text-white rounded-lg transition-colors"
                >
                  Save Note
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Sticky Bottom Bar ──────────────────────────────────────────── */}
      <div className="fixed bottom-0 right-0 left-56 bg-card border-t border-card-border px-6 py-3 flex items-center justify-between z-40">
        <div className="flex items-center gap-3">
          {prevId ? (
            <Link
              href={`/candidates/${prevId}`}
              className="flex items-center gap-1.5 text-sm text-muted hover:text-foreground transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Previous
            </Link>
          ) : (
            <span className="text-sm text-muted-foreground cursor-not-allowed">Previous</span>
          )}
          {nextId ? (
            <Link
              href={`/candidates/${nextId}`}
              className="flex items-center gap-1.5 text-sm text-muted hover:text-foreground transition-colors"
            >
              Next
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          ) : (
            <span className="text-sm text-muted-foreground cursor-not-allowed">Next</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button className="px-5 py-2.5 text-sm font-medium border border-danger text-danger rounded-lg hover:bg-danger/10 transition-colors">
            Reject Candidate
          </button>
          <button
            onClick={() => setShowEmailPreview(true)}
            className="px-5 py-2.5 text-sm font-bold bg-[#FF6B35] hover:bg-[#e85a25] text-white rounded-lg transition-colors"
          >
            Confirm &amp; Schedule Interview
          </button>
        </div>
      </div>
    </div>
  );
}
