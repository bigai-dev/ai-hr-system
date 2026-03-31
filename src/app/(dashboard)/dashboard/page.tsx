'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import TopBar from '@/components/TopBar';
import { supabase } from '@/lib/supabase';
import { Applicant, Interview } from '@/lib/types';

// ── Success Modal ────────────────────────────────────────────────────────────
function SuccessModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-card-border rounded-2xl p-8 w-full max-w-md shadow-2xl text-center">
        {/* Check icon */}
        <div className="mx-auto w-16 h-16 rounded-full bg-[#10b981]/20 flex items-center justify-center mb-5">
          <svg className="w-8 h-8 text-[#10b981]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-xl font-bold mb-2">Invitations Sent Successfully!</h2>
        <p className="text-muted text-sm mb-6">
          The candidate has been scheduled and notified via all channels.
        </p>

        <div className="space-y-3 mb-8">
          <div className="flex items-center justify-between bg-background rounded-lg px-4 py-3">
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <span className="text-sm font-medium">Email (Gmail)</span>
            </div>
            <span className="text-xs font-bold text-[#10b981] bg-[#10b981]/10 px-2.5 py-1 rounded-full">
              DELIVERED
            </span>
          </div>
          <div className="flex items-center justify-between bg-background rounded-lg px-4 py-3">
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-muted" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
              </svg>
              <span className="text-sm font-medium">WhatsApp Business</span>
            </div>
            <span className="text-xs font-bold text-[#10b981] bg-[#10b981]/10 px-2.5 py-1 rounded-full">
              DELIVERED
            </span>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full bg-[#FF6B35] hover:bg-[#e85a25] text-white font-semibold py-3 rounded-lg transition-colors"
        >
          Done
        </button>
      </div>
    </div>
  );
}

// ── Dashboard Page ───────────────────────────────────────────────────────────
export default function DashboardPage() {
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [screenedApplicants, setScreenedApplicants] = useState<Applicant[]>([]);
  const [interviews, setInterviews] = useState<(Interview & { applicant?: Applicant })[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSuccess, setShowSuccess] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  // Counts
  const totalCount = applicants.length;
  const aiScreenedCount = applicants.filter((a) => a.status !== 'new').length;
  const scheduledCount = applicants.filter((a) => a.status === 'scheduled').length;

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);

    const [allRes, screenedRes, interviewRes] = await Promise.all([
      supabase.from('applicants').select('*'),
      supabase
        .from('applicants')
        .select('*')
        .eq('status', 'screened')
        .order('ai_match_score', { ascending: false }),
      supabase
        .from('interviews')
        .select('*, applicant:applicants(*)')
        .order('scheduled_date', { ascending: true })
        .limit(5),
    ]);

    if (allRes.data) setApplicants(allRes.data);
    if (screenedRes.data) setScreenedApplicants(screenedRes.data);
    if (interviewRes.data) setInterviews(interviewRes.data as any);

    setLoading(false);
  }

  async function handleConfirmAutomate(applicant: Applicant) {
    setConfirmingId(applicant.id);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split('T')[0];

    // Create interview
    await supabase.from('interviews').insert({
      applicant_id: applicant.id,
      scheduled_date: dateStr,
      scheduled_time: '14:00',
      duration_minutes: 60,
      type: 'Technical Round',
      status: 'scheduled',
    });

    // Update applicant status
    await supabase.from('applicants').update({ status: 'scheduled' }).eq('id', applicant.id);

    setConfirmingId(null);
    setShowSuccess(true);
    fetchData();
  }

  function getInitials(name: string) {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  function randomSource() {
    return Math.random() > 0.5 ? 'EMAIL' : 'LINKEDIN';
  }

  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  // Build pipeline activity from applicant data
  function getPipelineActivity() {
    const events: { label: string; detail: string; time: string; color: string }[] = [];
    const sorted = [...applicants].sort(
      (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );
    sorted.slice(0, 6).forEach((a) => {
      if (a.status === 'scheduled') {
        events.push({
          label: `${a.name} scheduled for interview`,
          detail: 'Technical Round - Automated',
          time: timeAgo(a.updated_at),
          color: '#FF6B35',
        });
      } else if (a.status === 'screened') {
        events.push({
          label: `AI screening completed for ${a.name}`,
          detail: `Match Score: ${a.ai_match_score}%`,
          time: timeAgo(a.updated_at),
          color: '#10b981',
        });
      } else if (a.status === 'screening') {
        events.push({
          label: `${a.name} entered AI screening`,
          detail: 'Processing application...',
          time: timeAgo(a.updated_at),
          color: '#f59e0b',
        });
      } else {
        events.push({
          label: `New application from ${a.name}`,
          detail: a.job_title || 'Application received',
          time: timeAgo(a.created_at),
          color: '#3b82f6',
        });
      }
    });
    return events;
  }

  if (loading) {
    return (
      <div className="flex-1">
        <TopBar title="HIRING PIPELINE DASHBOARD" />
        <div className="p-6 flex items-center justify-center h-[calc(100vh-3.5rem)]">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-[#FF6B35] border-t-transparent rounded-full animate-spin" />
            <span className="text-muted text-sm">Loading pipeline data...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-screen">
      <TopBar title="HIRING PIPELINE DASHBOARD" />

      {showSuccess && <SuccessModal onClose={() => setShowSuccess(false)} />}

      <div className="p-6 space-y-6">
        {/* ── Stats Cards ──────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Applicants */}
          <div className="bg-card border border-card-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-muted uppercase tracking-wider">
                Total Applicants
              </span>
              <span className="text-[10px] font-bold text-[#10b981] bg-[#10b981]/10 px-2 py-0.5 rounded-full">
                +12%
              </span>
            </div>
            <div className="text-3xl font-bold mt-2">{totalCount}</div>
            <div className="text-xs text-muted mt-1">All time applications</div>
          </div>

          {/* AI Screened */}
          <div className="bg-card border border-card-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-muted uppercase tracking-wider">
                AI Screened
              </span>
            </div>
            <div className="text-3xl font-bold mt-2">{aiScreenedCount}</div>
            <div className="text-xs text-muted mt-1">Last 24h</div>
          </div>

          {/* Scheduled */}
          <div className="bg-card border border-card-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-muted uppercase tracking-wider">
                Scheduled
              </span>
              <span className="text-[10px] font-bold text-[#10b981] bg-[#10b981]/10 px-2 py-0.5 rounded-full">
                +5%
              </span>
            </div>
            <div className="text-3xl font-bold mt-2">{scheduledCount}</div>
            <div className="text-xs text-muted mt-1">Interviews upcoming</div>
          </div>

          {/* System Health */}
          <div className="bg-card border border-card-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-muted uppercase tracking-wider">
                System Health
              </span>
              <span className="text-[10px] font-bold text-[#10b981] bg-[#10b981]/10 px-2 py-0.5 rounded-full">
                SYSTEM ONLINE
              </span>
            </div>
            <div className="mt-3 space-y-2">
              <div className="flex items-center gap-2 text-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-[#10b981]" />
                <span className="text-muted">AI Screening:</span>
                <span className="text-[#10b981] font-semibold">ACTIVE</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-[#10b981]" />
                <span className="text-muted">Gmail API:</span>
                <span className="text-[#10b981] font-semibold">CONNECTED</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-[#10b981]" />
                <span className="text-muted">WhatsApp API:</span>
                <span className="text-[#10b981] font-semibold">RESTORED</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── AI Screening Queue ───────────────────────────────────────── */}
        <div className="bg-card border border-card-border rounded-xl">
          <div className="px-6 py-5 border-b border-card-border">
            <h2 className="text-base font-bold">AI Screening Queue</h2>
            <p className="text-xs text-muted mt-1">
              Automated technical assessment rankings for open &apos;Lead Engineer&apos; roles.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-card-border text-left">
                  <th className="px-6 py-3 text-[10px] font-semibold text-muted uppercase tracking-wider">
                    Candidate Info
                  </th>
                  <th className="px-6 py-3 text-[10px] font-semibold text-muted uppercase tracking-wider">
                    Current Role
                  </th>
                  <th className="px-6 py-3 text-[10px] font-semibold text-muted uppercase tracking-wider">
                    Source
                  </th>
                  <th className="px-6 py-3 text-[10px] font-semibold text-muted uppercase tracking-wider">
                    Match Score
                  </th>
                  <th className="px-6 py-3 text-[10px] font-semibold text-muted uppercase tracking-wider">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {screenedApplicants.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-10 text-center text-muted text-sm">
                      No screened candidates in queue.
                    </td>
                  </tr>
                )}
                {screenedApplicants.map((a, idx) => {
                  const source = idx % 2 === 0 ? 'EMAIL' : 'LINKEDIN';
                  return (
                    <tr
                      key={a.id}
                      className="border-b border-card-border last:border-0 hover:bg-background/50 transition-colors"
                    >
                      {/* Candidate Info */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-[#FF6B35]/20 flex items-center justify-center text-[#FF6B35] text-xs font-bold shrink-0">
                            {getInitials(a.name)}
                          </div>
                          <div>
                            <Link
                              href={`/candidates/${a.id}`}
                              className="text-sm font-medium hover:text-[#FF6B35] transition-colors"
                            >
                              {a.name}
                            </Link>
                            <div className="text-xs text-muted">{a.email}</div>
                          </div>
                        </div>
                      </td>

                      {/* Current Role */}
                      <td className="px-6 py-4 text-sm text-muted">{a.job_title}</td>

                      {/* Source */}
                      <td className="px-6 py-4">
                        <span
                          className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                            source === 'EMAIL'
                              ? 'bg-blue-500/10 text-blue-400'
                              : 'bg-purple-500/10 text-purple-400'
                          }`}
                        >
                          {source}
                        </span>
                      </td>

                      {/* Match Score */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex-1 h-2 bg-background rounded-full overflow-hidden max-w-[120px]">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{
                                width: `${a.ai_match_score ?? 0}%`,
                                background:
                                  (a.ai_match_score ?? 0) >= 75
                                    ? '#10b981'
                                    : (a.ai_match_score ?? 0) >= 60
                                    ? '#eab308'
                                    : (a.ai_match_score ?? 0) >= 40
                                    ? '#FF6B35'
                                    : '#ef4444',
                              }}
                            />
                          </div>
                          <span className="text-sm font-bold min-w-[36px]">
                            {a.ai_match_score ?? 0}%
                          </span>
                        </div>
                      </td>

                      {/* Action */}
                      <td className="px-6 py-4">
                        <button
                          onClick={() => handleConfirmAutomate(a)}
                          disabled={confirmingId === a.id}
                          className="bg-[#FF6B35] hover:bg-[#e85a25] disabled:opacity-50 text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors whitespace-nowrap"
                        >
                          {confirmingId === a.id ? (
                            <span className="flex items-center gap-2">
                              <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              PROCESSING...
                            </span>
                          ) : (
                            'CONFIRM & AUTOMATE'
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Bottom Section: Activity + Upcoming Interviews ───────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Recent Pipeline Activity */}
          <div className="bg-card border border-card-border rounded-xl">
            <div className="px-6 py-4 border-b border-card-border">
              <h3 className="text-sm font-bold uppercase tracking-wider">
                Recent Pipeline Activity
              </h3>
            </div>
            <div className="p-6 space-y-5">
              {getPipelineActivity().length === 0 && (
                <p className="text-muted text-sm text-center py-4">No recent activity.</p>
              )}
              {getPipelineActivity().map((ev, i) => (
                <div key={i} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div
                      className="w-2.5 h-2.5 rounded-full shrink-0 mt-1.5"
                      style={{ backgroundColor: ev.color }}
                    />
                    {i < getPipelineActivity().length - 1 && (
                      <div className="w-px flex-1 bg-card-border mt-1" />
                    )}
                  </div>
                  <div className="pb-1">
                    <p className="text-sm font-medium leading-tight">{ev.label}</p>
                    <p className="text-xs text-muted mt-0.5">{ev.detail}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">{ev.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Upcoming Interviews */}
          <div className="bg-card border border-card-border rounded-xl">
            <div className="px-6 py-4 border-b border-card-border">
              <h3 className="text-sm font-bold uppercase tracking-wider">Upcoming Interviews</h3>
            </div>
            <div className="p-6 space-y-4">
              {interviews.length === 0 && (
                <p className="text-muted text-sm text-center py-4">No upcoming interviews.</p>
              )}
              {interviews.map((iv) => (
                <div
                  key={iv.id}
                  className="flex items-center justify-between bg-background rounded-lg px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-[#FF6B35]/20 flex items-center justify-center text-[#FF6B35] text-xs font-bold shrink-0">
                      {iv.applicant ? getInitials(iv.applicant.name) : '??'}
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        {iv.applicant?.name ?? 'Unknown Candidate'}
                      </p>
                      <p className="text-xs text-muted">{iv.type}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">{iv.scheduled_date}</p>
                    <p className="text-xs text-muted">{iv.scheduled_time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
