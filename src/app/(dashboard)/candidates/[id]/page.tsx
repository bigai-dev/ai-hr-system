'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import TopBar from '@/components/TopBar';
import {
  getApplicant,
  getApplicantIds,
  insertInterview,
  updateApplicantStatus,
  rejectApplicantWithReason,
  getNotes,
  addNote,
  deleteNote,
  getJob,
  type ApplicantNote,
} from '@/app/(dashboard)/actions';
import RejectReasonModal from '@/components/RejectReasonModal';
import type { RejectionReason } from '@/lib/email-templates-shared';
import { Applicant, Job } from '@/lib/types';
import Scorecards from './Scorecards';
import BookingLinkModal from './BookingLinkModal';
import ScheduleInterviewModal, {
  buildScheduleDefaults,
  type ScheduleValues,
} from '@/components/ScheduleInterviewModal';

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
            <h3 className="text-xs font-bold text-accent uppercase tracking-wider mb-3 mt-1">
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

// ── Timeline ────────────────────────────────────────────────────────────────
function timeAgo(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  if (diffMs < 60_000) return 'Just now';
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function Timeline({ applicant }: { applicant: Applicant }) {
  const events: { label: string; detail: string; ts: string; color: string }[] = [
    {
      label: 'Application Received',
      detail: 'Submitted via the public apply form.',
      ts: applicant.created_at,
      color: '#3b82f6',
    },
  ];
  const aiSeen = ['screening', 'screened', 'phone_screen', 'onsite', 'offer', 'hired'];
  if (aiSeen.includes(applicant.status)) {
    events.push({
      label: applicant.status === 'screening' ? 'AI Screening Started' : 'AI Screening Completed',
      detail: applicant.ai_match_score != null
        ? `Match score: ${applicant.ai_match_score}/100`
        : 'Screening in progress.',
      ts: applicant.updated_at,
      color: '#10b981',
    });
  }
  if (applicant.status === 'phone_screen' || applicant.status === 'onsite') {
    events.push({
      label: applicant.status === 'phone_screen' ? 'Phone Screen Stage' : 'Onsite Stage',
      detail: 'Interview in progress.',
      ts: applicant.stage_changed_at,
      color: '#FF6B35',
    });
  }
  if (applicant.status === 'offer') {
    events.push({
      label: 'Offer Extended',
      detail: 'Awaiting candidate response.',
      ts: applicant.stage_changed_at,
      color: '#FF6B35',
    });
  }
  if (applicant.status === 'hired') {
    events.push({
      label: 'Candidate Hired',
      detail: 'Offer accepted.',
      ts: applicant.stage_changed_at,
      color: '#10b981',
    });
  }
  if (applicant.status === 'rejected') {
    events.push({
      label: 'Candidate Rejected',
      detail: 'Marked as not a fit.',
      ts: applicant.stage_changed_at,
      color: '#ef4444',
    });
  }
  if (applicant.status === 'archived') {
    events.push({
      label: 'Candidate Archived',
      detail: 'Removed from active pipeline.',
      ts: applicant.stage_changed_at,
      color: '#6b7280',
    });
  }
  if (applicant.status === 'withdrawn') {
    events.push({
      label: 'Candidate Withdrew',
      detail: 'Pulled out of the process.',
      ts: applicant.stage_changed_at,
      color: '#6b7280',
    });
  }

  return (
    <div className="space-y-0">
      {events.map((ev, i) => (
        <div key={i} className="flex gap-4">
          <div className="flex flex-col items-center">
            <div
              className="w-3.5 h-3.5 rounded-full shrink-0 mt-1 ring-4"
              style={{ backgroundColor: ev.color, boxShadow: `0 0 0 4px ${ev.color}33` }}
            />
            {i < events.length - 1 && <div className="w-px flex-1 bg-card-border" />}
          </div>
          <div className="pb-8">
            <p className="text-sm font-semibold">{ev.label}</p>
            <p className="text-xs text-muted mt-1">{ev.detail}</p>
            <span className="text-[10px] text-muted-foreground mt-2 inline-block">
              {timeAgo(ev.ts)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Candidate Detail Page ───────────────────────────────────────────────────
export default function CandidateDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [applicant, setApplicant] = useState<Applicant | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0);
  const [noteDraft, setNoteDraft] = useState('');
  const [notes, setNotes] = useState<ApplicantNote[]>([]);
  const [savingNote, setSavingNote] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showBookingLink, setShowBookingLink] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [allIds, setAllIds] = useState<string[]>([]);

  const scheduleDefaults: ScheduleValues = buildScheduleDefaults();

  const tabs = [
    'Application Preview',
    'Resume & Portfolio',
    'Scorecards',
    'Timeline History',
    'Internal Notes',
  ];

  useEffect(() => {
    fetchApplicant();
    fetchAllIds();
    fetchNotes();
  }, [id]);

  async function fetchNotes() {
    const data = await getNotes(id);
    setNotes(data);
  }

  async function fetchApplicant() {
    setLoading(true);
    const data = await getApplicant(id);
    if (data) {
      setApplicant(data);
      if (data.job_id) {
        const j = await getJob(data.job_id);
        setJob(j);
      }
    }
    setLoading(false);
  }

  async function fetchAllIds() {
    const data = await getApplicantIds();
    if (data) setAllIds(data);
  }

  function getInitials(name: string) {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  async function saveNote() {
    if (!noteDraft.trim() || savingNote) return;
    setSavingNote(true);
    try {
      await addNote(id, noteDraft);
      setNoteDraft('');
      await fetchNotes();
    } finally {
      setSavingNote(false);
    }
  }

  async function removeNote(noteId: string) {
    await deleteNote(noteId);
    await fetchNotes();
  }

  async function handleSchedule(values: ScheduleValues) {
    if (!applicant) return;
    const result = await insertInterview({
      applicant_id: applicant.id,
      scheduled_date: values.date,
      scheduled_time: values.time,
      duration_minutes: values.durationMinutes,
      type: values.type,
    });
    // Only advance the candidate if they're still pre-interview. If they're
    // already further along, scheduling another round shouldn't pull them back.
    if (['new', 'screening', 'screened'].includes(applicant.status)) {
      await updateApplicantStatus(applicant.id, 'phone_screen');
    }
    setShowConfirm(false);
    const emailNote = result.email_sent ? ' · candidate emailed' : '';
    setToast(`Interview scheduled for ${values.date} at ${values.time}${emailNote}`);
    setTimeout(() => setToast(null), 4000);
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
            <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
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

      {showConfirm && (
        <ScheduleInterviewModal
          applicant={applicant}
          defaults={scheduleDefaults}
          onCancel={() => setShowConfirm(false)}
          onConfirm={handleSchedule}
        />
      )}
      {toast && (
        <div className="fixed top-6 right-6 z-50 bg-card border border-card-border rounded-lg shadow-lg px-5 py-3 text-sm">
          {toast}
        </div>
      )}

      <div className="p-4 md:p-6 space-y-6">
        {/* ── Header Section ──────────────────────────────────────────── */}
        <div data-tour="candidate-header" className="flex flex-col lg:flex-row gap-6">
          {/* Left: Avatar + Info */}
          <div className="flex-1 flex items-start gap-5">
            <div className="w-20 h-20 rounded-2xl bg-accent/20 flex items-center justify-center text-accent text-2xl font-bold shrink-0">
              {getInitials(applicant.name)}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl font-bold">{applicant.name}</h1>
                <span className="text-[10px] font-bold text-success bg-success/10 px-2.5 py-1 rounded-full uppercase">
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
                  {applicant.phone || (
                    <span className="italic text-muted">No phone provided</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Right: AI Match Score */}
          <div className="bg-card border border-card-border rounded-xl p-6 flex items-center gap-5 lg:min-w-65">
            <div className="relative w-20 h-20 shrink-0">
              <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
                <circle cx="40" cy="40" r="34" fill="none" stroke="currentColor" className="text-background" strokeWidth="6" />
                <circle
                  cx="40"
                  cy="40"
                  r="34"
                  fill="none"
                  stroke={score >= 75 ? '#10b981' : score >= 60 ? '#f59e0b' : score >= 40 ? '#f97316' : '#ef4444'}
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
                {score >= 90 ? 'Excellent Match' : score >= 75 ? 'Strong Match' : score >= 60 ? 'Good Fit' : score >= 40 ? 'Moderate Fit' : score >= 20 ? 'Weak Fit' : 'Not Suitable'}
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
                  ? 'border-accent text-accent'
                  : 'border-transparent text-muted hover:text-foreground'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* ── Tab Content ─────────────────────────────────────────────── */}
        <div className="min-h-100">
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
                      <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-accent text-xs font-bold">
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
                        {score >= 90 ? 'Excellent' : score >= 75 ? 'Good' : score >= 60 ? 'Moderate' : score >= 40 ? 'Below Avg' : 'Poor'}
                      </div>
                    </div>
                  </div>

                  {/* Extracted Skills */}
                  <div>
                    <h4 className="text-[10px] font-semibold text-muted uppercase tracking-wider mb-3">
                      Extracted Core Skills
                    </h4>
                    {applicant.ai_extracted_skills && applicant.ai_extracted_skills.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {applicant.ai_extracted_skills.map((skill) => (
                          <span
                            key={skill}
                            className="text-xs font-medium bg-accent/10 text-accent px-3 py-1.5 rounded-full"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted italic">Pending screening.</p>
                    )}
                  </div>

                  {/* Match Reasoning */}
                  <div>
                    <h4 className="text-[10px] font-semibold text-muted uppercase tracking-wider mb-3">
                      Match Reasoning
                    </h4>
                    {applicant.ai_reasoning ? (
                      <blockquote className="border-l-2 border-accent pl-4 text-sm text-muted italic leading-relaxed">
                        {applicant.ai_reasoning}
                      </blockquote>
                    ) : (
                      <p className="text-sm text-muted italic">Pending screening.</p>
                    )}
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
                  <div className="bg-white text-gray-900 rounded-lg p-8 shadow-inner min-h-125 max-h-150 overflow-y-auto">
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
                    <p className="text-4xl font-bold" style={{ color: (applicant.ai_match_score ?? 0) >= 75 ? '#22c55e' : (applicant.ai_match_score ?? 0) >= 60 ? '#eab308' : (applicant.ai_match_score ?? 0) >= 40 ? '#f97316' : '#ef4444' }}>
                      {applicant.ai_match_score ?? 'N/A'}
                    </p>
                    <p className="text-xs text-muted mt-1">
                      {applicant.ai_match_score == null
                        ? 'Not yet scored'
                        : (applicant.ai_match_score ?? 0) >= 90
                          ? 'Excellent Match'
                          : (applicant.ai_match_score ?? 0) >= 75
                            ? 'Strong Match'
                            : (applicant.ai_match_score ?? 0) >= 60
                              ? 'Good Fit'
                              : (applicant.ai_match_score ?? 0) >= 40
                                ? 'Moderate Fit'
                                : (applicant.ai_match_score ?? 0) >= 20
                                  ? 'Weak Fit'
                                  : 'Not Suitable'}
                    </p>
                  </div>

                  {/* Company Stage Fit */}
                  <div className="bg-background rounded-xl p-5 border border-card-border">
                    <p className="text-xs text-muted uppercase tracking-wider mb-2">Company Stage Fit</p>
                    <div className="flex items-center gap-2">
                      <span className={`inline-block w-2.5 h-2.5 rounded-full ${
                        (applicant.ai_match_score ?? 0) >= 75
                          ? 'bg-green-500'
                          : (applicant.ai_match_score ?? 0) >= 60
                            ? 'bg-yellow-500'
                            : (applicant.ai_match_score ?? 0) >= 40
                              ? 'bg-orange-500'
                              : 'bg-red-500'
                      }`} />
                      <span className="text-sm font-medium">
                        {applicant.ai_match_score == null
                          ? 'Pending AI analysis'
                          : (applicant.ai_match_score ?? 0) >= 90
                            ? 'Excellent - Strong role alignment'
                            : (applicant.ai_match_score ?? 0) >= 75
                              ? 'Good - Solid role alignment'
                              : (applicant.ai_match_score ?? 0) >= 60
                                ? 'Moderate - Partial role alignment'
                                : (applicant.ai_match_score ?? 0) >= 40
                                  ? 'Below Average - Limited alignment'
                                  : 'Poor - Significant gaps in role alignment'}
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

          {/* Tab 2: Scorecards */}
          {activeTab === 2 && (
            <Scorecards
              applicantId={applicant.id}
              requiredSkills={
                job?.required_skills
                  ? job.required_skills
                      .split(',')
                      .map((s) => s.trim())
                      .filter((s) => s.length > 0)
                  : []
              }
            />
          )}

          {/* Tab 3: Timeline History */}
          {activeTab === 3 && (
            <div className="bg-card border border-card-border rounded-xl p-6">
              <Timeline applicant={applicant} />
            </div>
          )}

          {/* Tab 4: Internal Notes */}
          {activeTab === 4 && (
            <div className="bg-card border border-card-border rounded-xl p-6">
              <h3 className="text-sm font-bold mb-4">Internal Notes</h3>
              <textarea
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                placeholder="Add a note about this candidate…"
                className="w-full h-32 bg-background border border-card-border rounded-lg p-4 text-sm resize-none outline-none focus:border-accent transition-colors placeholder:text-muted-foreground"
                maxLength={4000}
              />
              <div className="flex justify-end mt-3 mb-6">
                <button
                  onClick={saveNote}
                  disabled={savingNote || !noteDraft.trim()}
                  className="px-5 py-2.5 text-sm font-semibold bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                >
                  {savingNote ? 'Saving…' : 'Add Note'}
                </button>
              </div>

              {notes.length === 0 ? (
                <p className="text-sm text-muted text-center py-6">No notes yet.</p>
              ) : (
                <div className="space-y-3">
                  {notes.map((n) => (
                    <div
                      key={n.id}
                      className="rounded-lg border border-card-border bg-background p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm whitespace-pre-wrap leading-relaxed flex-1">
                          {n.body}
                        </p>
                        <button
                          onClick={() => removeNote(n.id)}
                          className="text-xs text-muted hover:text-danger shrink-0"
                          title="Delete note"
                        >
                          Delete
                        </button>
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-2 flex gap-2">
                        <span>{n.created_by ?? 'unknown'}</span>
                        <span>·</span>
                        <span>{new Date(n.created_at).toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Sticky Bottom Bar ──────────────────────────────────────────── */}
      <div className="fixed bottom-0 right-0 left-0 md:left-56 bg-card border-t border-card-border px-4 md:px-6 py-3 flex items-center justify-between gap-2 z-40">
        {/* Prev/Next: desktop-only — on mobile use the back button or candidates list. */}
        <div className="hidden md:flex items-center gap-3">
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
        <div data-tour="schedule-actions" className="flex items-center gap-2 md:gap-3 ml-auto">
          <button
            onClick={() => setShowRejectModal(true)}
            className="px-3 md:px-5 py-2 md:py-2.5 text-sm font-medium border border-danger text-danger rounded-lg hover:bg-danger/10 transition-colors"
          >
            Reject<span className="hidden sm:inline"> Candidate</span>
          </button>
          <button
            onClick={() => setShowBookingLink(true)}
            className="px-3 md:px-5 py-2 md:py-2.5 text-sm font-medium border border-card-border rounded-lg hover:bg-background transition-colors"
          >
            <span className="sm:hidden">Book</span>
            <span className="hidden sm:inline">Send booking link</span>
          </button>
          <button
            onClick={() => setShowConfirm(true)}
            className="px-3 md:px-5 py-2 md:py-2.5 text-sm font-bold bg-accent hover:bg-accent-hover text-white rounded-lg transition-colors whitespace-nowrap"
          >
            <span className="sm:hidden">Schedule</span>
            <span className="hidden sm:inline">Confirm &amp; Schedule Interview</span>
          </button>
        </div>
      </div>

      {showBookingLink && (
        <BookingLinkModal
          applicantId={applicant.id}
          applicantName={applicant.name}
          onClose={() => setShowBookingLink(false)}
        />
      )}

      {showRejectModal && (
        <RejectReasonModal
          targets={[{ id: applicant.id, name: applicant.name, email: applicant.email }]}
          onCancel={() => setShowRejectModal(false)}
          onConfirm={async (reason: RejectionReason, customNote: string) => {
            try {
              const result = await rejectApplicantWithReason(
                applicant.id,
                reason,
                customNote || undefined,
              );
              setShowRejectModal(false);
              setToast(
                result.emailed
                  ? `${applicant.name} rejected · email sent`
                  : `${applicant.name} rejected · email failed (see Outgoing Emails)`,
              );
              setTimeout(() => router.push('/candidates'), 1200);
            } catch (err) {
              setShowRejectModal(false);
              setToast(
                `Reject failed: ${err instanceof Error ? err.message : 'unknown error'}`,
              );
              setTimeout(() => setToast(null), 4000);
            }
          }}
        />
      )}
    </div>
  );
}
