'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import TopBar from '@/components/TopBar';
import {
  getApplicants,
  getScreenedApplicants,
  getInterviewsLimited,
  insertInterview,
  updateApplicantStatus,
  getEmailProviderStatus,
} from '@/app/(dashboard)/actions';
import { Applicant, Interview } from '@/lib/types';
import ScheduleInterviewModal, {
  buildScheduleDefaults,
  type ScheduleValues,
} from '@/components/ScheduleInterviewModal';

// ── Dashboard Page ───────────────────────────────────────────────────────────
export default function DashboardPage() {
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [screenedApplicants, setScreenedApplicants] = useState<Applicant[]>([]);
  const [interviews, setInterviews] = useState<(Interview & { applicant?: Applicant })[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [scheduleTarget, setScheduleTarget] = useState<Applicant | null>(null);
  const [emailProvider, setEmailProvider] = useState<{
    configured: boolean;
    fromAddress: string | null;
  } | null>(null);

  // Counts
  const totalCount = applicants.length;
  const aiScreenedCount = applicants.filter(
    (a) => a.status !== 'new' && a.status !== 'screening',
  ).length;
  const scheduledCount = applicants.filter(
    (a) => a.status === 'phone_screen' || a.status === 'onsite',
  ).length;

  useEffect(() => {
    fetchData();
    getEmailProviderStatus().then(setEmailProvider).catch(() => setEmailProvider(null));
  }, []);

  async function fetchData() {
    setLoading(true);

    const [allData, screenedData, interviewData] = await Promise.all([
      getApplicants(),
      getScreenedApplicants(),
      getInterviewsLimited(),
    ]);

    setApplicants(allData);
    setScreenedApplicants(screenedData);
    setInterviews(interviewData as any);

    setLoading(false);
  }

  async function handleScheduleConfirmed(applicant: Applicant, values: ScheduleValues) {
    setConfirmingId(applicant.id);
    try {
      const result = await insertInterview({
        applicant_id: applicant.id,
        scheduled_date: values.date,
        scheduled_time: values.time,
        duration_minutes: values.durationMinutes,
        type: values.type,
      });
      // Only advance the candidate if they're still pre-interview.
      if (['new', 'screening', 'screened'].includes(applicant.status)) {
        await updateApplicantStatus(applicant.id, 'phone_screen');
      }
      setScheduleTarget(null);
      const emailNote = result.email_sent ? ' · candidate emailed' : '';
      setToast(`${applicant.name} scheduled for ${values.date} at ${values.time}${emailNote}`);
      setTimeout(() => setToast(null), 4000);
      fetchData();
    } finally {
      setConfirmingId(null);
    }
  }

  function getInitials(name: string) {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
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
      if (a.status === 'phone_screen' || a.status === 'onsite') {
        events.push({
          label: `${a.name} moved to ${a.status === 'phone_screen' ? 'phone screen' : 'onsite'}`,
          detail: 'Interview stage',
          time: timeAgo(a.updated_at),
          color: '#FF6B35',
        });
      } else if (a.status === 'offer') {
        events.push({
          label: `Offer extended to ${a.name}`,
          detail: 'Awaiting response',
          time: timeAgo(a.updated_at),
          color: '#FF6B35',
        });
      } else if (a.status === 'hired') {
        events.push({
          label: `${a.name} hired`,
          detail: 'Offer accepted',
          time: timeAgo(a.updated_at),
          color: '#10b981',
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
            <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            <span className="text-muted text-sm">Loading pipeline data...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-screen">
      <TopBar title="HIRING PIPELINE DASHBOARD" />

      {toast && (
        <div className="fixed top-6 right-6 z-50 bg-card border border-card-border rounded-lg shadow-lg px-5 py-3 text-sm">
          {toast}
        </div>
      )}

      {scheduleTarget && (
        <ScheduleInterviewModal
          applicant={scheduleTarget}
          defaults={buildScheduleDefaults()}
          onCancel={() => setScheduleTarget(null)}
          onConfirm={(values) => handleScheduleConfirmed(scheduleTarget, values)}
        />
      )}

      <div className="p-4 md:p-6 space-y-6">
        {/* ── Stats Cards ──────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Applicants */}
          <div className="bg-card border border-card-border rounded-xl p-5">
            <span className="text-xs font-semibold text-muted uppercase tracking-wider">
              Total Applicants
            </span>
            <div className="text-3xl font-bold mt-2">{totalCount}</div>
            <div className="text-xs text-muted mt-1">All time</div>
          </div>

          {/* AI Screened */}
          <div className="bg-card border border-card-border rounded-xl p-5">
            <span className="text-xs font-semibold text-muted uppercase tracking-wider">
              AI Screened
            </span>
            <div className="text-3xl font-bold mt-2">{aiScreenedCount}</div>
            <div className="text-xs text-muted mt-1">Out of {totalCount}</div>
          </div>

          {/* Interviewing */}
          <div className="bg-card border border-card-border rounded-xl p-5">
            <span className="text-xs font-semibold text-muted uppercase tracking-wider">
              Interviewing
            </span>
            <div className="text-3xl font-bold mt-2">{scheduledCount}</div>
            <div className="text-xs text-muted mt-1">In phone screen or onsite</div>
          </div>

          {/* System Status */}
          <div className="bg-card border border-card-border rounded-xl p-5">
            <span className="text-xs font-semibold text-muted uppercase tracking-wider">
              System Status
            </span>
            <div className="mt-3 space-y-2">
              <div className="flex items-center gap-2 text-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-success" />
                <span className="text-muted">AI Screening:</span>
                <span className="text-success font-semibold">ACTIVE</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    emailProvider?.configured ? 'bg-success' : 'bg-yellow-500'
                  }`}
                />
                <span className="text-muted">Email:</span>
                <span
                  className={`font-semibold ${
                    emailProvider?.configured ? 'text-success' : 'text-yellow-500'
                  }`}
                  title={emailProvider?.fromAddress ?? undefined}
                >
                  {emailProvider == null
                    ? '…'
                    : emailProvider.configured
                      ? 'CONFIGURED'
                      : 'NOT CONFIGURED'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── AI Screening Queue ───────────────────────────────────────── */}
        <div className="bg-card border border-card-border rounded-xl">
          <div className="px-6 py-5 border-b border-card-border">
            <h2 className="text-base font-bold">AI Screening Queue</h2>
            <p className="text-xs text-muted mt-1">
              AI-scored candidates ranked by match against the current job description.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-200">
              <thead>
                <tr className="border-b border-card-border text-left">
                  <th className="px-6 py-3 text-[10px] font-semibold text-muted uppercase tracking-wider">
                    Candidate Info
                  </th>
                  <th className="px-6 py-3 text-[10px] font-semibold text-muted uppercase tracking-wider">
                    Current Role
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
                    <td colSpan={4} className="px-6 py-10 text-center text-muted text-sm">
                      No screened candidates in queue.
                    </td>
                  </tr>
                )}
                {screenedApplicants.map((a) => {
                  return (
                    <tr
                      key={a.id}
                      className="border-b border-card-border last:border-0 hover:bg-background/50 transition-colors"
                    >
                      {/* Candidate Info */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-accent/20 flex items-center justify-center text-accent text-xs font-bold shrink-0">
                            {getInitials(a.name)}
                          </div>
                          <div>
                            <Link
                              href={`/candidates/${a.id}`}
                              className="text-sm font-medium hover:text-accent transition-colors"
                            >
                              {a.name}
                            </Link>
                            <div className="text-xs text-muted">{a.email}</div>
                          </div>
                        </div>
                      </td>

                      {/* Current Role */}
                      <td className="px-6 py-4 text-sm text-muted">{a.job_title}</td>

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
                          onClick={() => setScheduleTarget(a)}
                          disabled={confirmingId === a.id}
                          className="bg-accent hover:bg-accent-hover disabled:opacity-50 text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors whitespace-nowrap"
                        >
                          {confirmingId === a.id ? (
                            <span className="flex items-center gap-2">
                              <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              SCHEDULING...
                            </span>
                          ) : (
                            'SCHEDULE INTERVIEW'
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
                    <div className="w-9 h-9 rounded-full bg-accent/20 flex items-center justify-center text-accent text-xs font-bold shrink-0">
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
