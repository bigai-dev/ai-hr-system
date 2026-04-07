'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import TopBar from '@/components/TopBar';
import { db } from '@/lib/db';
import { Applicant } from '@/lib/types';

export default function CandidatesPage() {
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [filter, setFilter] = useState<'all' | 'screening' | 'scheduled'>('all');
  const [search, setSearch] = useState('');
  const [scheduleModal, setScheduleModal] = useState<{id: string, name: string} | null>(null);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('14:00');
  const [scheduleType, setScheduleType] = useState('Technical Screen');

  useEffect(() => {
    fetchApplicants();
  }, []);

  async function fetchApplicants() {
    const data = await db.getApplicants();
    if (data) setApplicants(data);
  }

  function openScheduleModal(applicantId: string, applicantName: string) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setScheduleDate(tomorrow.toISOString().split('T')[0]);
    setScheduleTime('14:00');
    setScheduleType('Technical Screen');
    setScheduleModal({id: applicantId, name: applicantName});
  }

  async function confirmSchedule() {
    if (!scheduleModal) return;

    await db.insertInterview({
      applicant_id: scheduleModal.id,
      scheduled_date: scheduleDate,
      scheduled_time: scheduleTime,
      duration_minutes: 60,
      type: scheduleType,
      status: 'scheduled',
    });

    await db.updateApplicantStatus(scheduleModal.id, 'scheduled');

    setScheduleModal(null);
    fetchApplicants();
  }

  async function handleDelete(applicantId: string) {
    await db.deleteApplicant(applicantId);
    fetchApplicants();
  }

  const filtered = applicants.filter((a) => {
    if (filter === 'screening' && a.status !== 'screened') return false;
    if (filter === 'scheduled' && a.status !== 'scheduled') return false;
    if (search && !a.name.toLowerCase().includes(search.toLowerCase()) && !a.job_title?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const topMatches = applicants.filter(a => a.ai_match_score).slice(0, 3);

  return (
    <div className="min-h-screen">
      <TopBar title="Candidates" />
      <div className="p-6">
        {/* Top AI Matches */}
        {topMatches.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <span className="text-[#FF6B35]">&#10024;</span> Top AI Matches
                </h2>
                <p className="text-sm text-gray-500 dark:text-[#9ca3af]">Highest compatibility based on current requirements</p>
              </div>
              <div className="flex gap-2">
                <button className="p-2 rounded-lg border border-gray-200 dark:border-[#333] hover:bg-gray-100 dark:hover:bg-[#242424] text-gray-500 dark:text-[#9ca3af]">&lt;</button>
                <button className="p-2 rounded-lg border border-gray-200 dark:border-[#333] hover:bg-gray-100 dark:hover:bg-[#242424] text-gray-500 dark:text-[#9ca3af]">&gt;</button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {topMatches.map((a) => (
                <div key={a.id} className="bg-white dark:bg-[#242424] border border-gray-200 dark:border-[#333] rounded-xl p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-12 h-12 rounded-full bg-[#FF6B35]/20 flex items-center justify-center text-[#FF6B35] font-bold">
                      {a.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-[#FF6B35]">{a.ai_match_score}%</div>
                      <div className="text-xs text-gray-500 dark:text-[#9ca3af] uppercase">Match</div>
                    </div>
                  </div>
                  <h3 className="font-semibold">{a.name}</h3>
                  <p className="text-sm text-gray-500 dark:text-[#9ca3af]">{a.job_title}</p>
                  <div className="flex items-center justify-between mt-4">
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      a.status === 'scheduled' ? 'bg-[#10b981]/20 text-[#10b981]' : 'bg-[#FF6B35]/20 text-[#FF6B35]'
                    }`}>
                      {a.status.toUpperCase()}
                    </span>
                    <Link href={`/candidates/${a.id}`} className="text-sm text-[#FF6B35] hover:underline">
                      View Profile &rarr;
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* All Candidates */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold">All Candidates</h2>
              <p className="text-sm text-gray-500 dark:text-[#9ca3af]">Total {applicants.length} applicants in the pipeline</p>
            </div>
            <div className="flex gap-2">
              <button className="px-4 py-2 rounded-lg border border-gray-200 dark:border-[#333] text-sm text-gray-500 dark:text-[#9ca3af] hover:bg-gray-100 dark:hover:bg-[#242424] flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
                Filters
              </button>
              <button className="px-4 py-2 rounded-lg border border-gray-200 dark:border-[#333] text-sm text-gray-500 dark:text-[#9ca3af] hover:bg-gray-100 dark:hover:bg-[#242424] flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                Export
              </button>
            </div>
          </div>

          {/* Filter tabs */}
          <div className="flex items-center gap-4 mb-4">
            <div className="flex gap-1 bg-gray-100 dark:bg-[#242424] rounded-lg p-1">
              {(['all', 'screening', 'scheduled'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    filter === f ? 'bg-[#FF6B35] text-white' : 'text-gray-500 dark:text-[#9ca3af] hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
            <input
              type="text"
              placeholder="Quick search list..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-white dark:bg-[#242424] border border-gray-200 dark:border-[#333] rounded-lg px-3 py-1.5 text-sm outline-none text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-[#6b7280] w-48"
            />
          </div>

          {/* Table */}
          <div className="bg-white dark:bg-[#242424] border border-gray-200 dark:border-[#333] rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-[#333]">
                  <th className="text-left text-xs font-semibold text-gray-500 dark:text-[#9ca3af] uppercase px-5 py-3">Name</th>
                  <th className="text-left text-xs font-semibold text-gray-500 dark:text-[#9ca3af] uppercase px-5 py-3">AI Match Score</th>
                  <th className="text-left text-xs font-semibold text-gray-500 dark:text-[#9ca3af] uppercase px-5 py-3">Date</th>
                  <th className="text-left text-xs font-semibold text-gray-500 dark:text-[#9ca3af] uppercase px-5 py-3">Status</th>
                  <th className="text-left text-xs font-semibold text-gray-500 dark:text-[#9ca3af] uppercase px-5 py-3">Quick Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((a) => (
                  <tr key={a.id} className="border-b border-gray-200 dark:border-[#333] hover:bg-gray-50 dark:hover:bg-[#2a2a2a] transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-[#FF6B35]/20 flex items-center justify-center text-[#FF6B35] text-sm font-bold">
                          {a.name.split(' ').map(n => n[0]).join('')}
                        </div>
                        <div>
                          <Link href={`/candidates/${a.id}`} className="font-medium hover:text-[#FF6B35]">{a.name}</Link>
                          <div className="text-xs text-gray-500 dark:text-[#9ca3af]">{a.job_title}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      {a.ai_match_score ? (
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-2 bg-gray-200 dark:bg-[#333] rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${a.ai_match_score}%`,
                                backgroundColor: a.ai_match_score >= 75 ? '#10b981' : a.ai_match_score >= 60 ? '#eab308' : a.ai_match_score >= 40 ? '#FF6B35' : '#ef4444',
                              }}
                            />
                          </div>
                          <span className="text-sm font-medium">{a.ai_match_score}%</span>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400 dark:text-[#6b7280]">Pending</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-500 dark:text-[#9ca3af]">
                      {new Date(a.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                        a.status === 'scheduled' ? 'bg-[#10b981]/20 text-[#10b981]' :
                        a.status === 'screened' ? 'bg-[#FF6B35]/20 text-[#FF6B35]' :
                        a.status === 'screening' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-gray-200 dark:bg-[#333] text-gray-500 dark:text-[#9ca3af]'
                      }`}>
                        {a.status.charAt(0).toUpperCase() + a.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <Link href={`/candidates/${a.id}`} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-[#333] text-gray-500 dark:text-[#9ca3af] hover:text-gray-900 dark:hover:text-white" title="View">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                        </Link>
                        <button onClick={() => openScheduleModal(a.id, a.name)} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-[#333] text-gray-500 dark:text-[#9ca3af] hover:text-gray-900 dark:hover:text-white" title="Schedule">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        </button>
                        <button onClick={() => handleDelete(a.id)} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-[#333] text-gray-500 dark:text-[#9ca3af] hover:text-red-400" title="Remove">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-12 text-center text-gray-500 dark:text-[#9ca3af]">
                      {applicants.length === 0 ? 'No candidates yet. Applications submitted at /apply will appear here.' : 'No candidates match your filter.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Schedule Interview Modal */}
      {scheduleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#242424] border border-gray-200 dark:border-[#333] rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200 dark:border-[#333] flex items-center justify-between">
              <h2 className="text-base font-bold">Schedule Interview</h2>
              <button onClick={() => setScheduleModal(null)} className="p-1 text-gray-400 dark:text-[#9ca3af] hover:text-gray-900 dark:hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-5 space-y-4">
              <div className="text-sm text-gray-500 dark:text-[#9ca3af]">
                Scheduling interview for <span className="font-semibold text-gray-900 dark:text-white">{scheduleModal.name}</span>
              </div>

              {/* Date */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-[#9ca3af] uppercase tracking-wider mb-1.5">Date</label>
                <input
                  type="date"
                  value={scheduleDate}
                  onChange={(e) => setScheduleDate(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-[#1a1a1a] border border-gray-200 dark:border-[#333] rounded-lg px-3 py-2 text-sm outline-none text-gray-900 dark:text-white focus:border-[#FF6B35] transition-colors"
                />
              </div>

              {/* Time */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-[#9ca3af] uppercase tracking-wider mb-1.5">Time</label>
                <select
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-[#1a1a1a] border border-gray-200 dark:border-[#333] rounded-lg px-3 py-2 text-sm outline-none text-gray-900 dark:text-white focus:border-[#FF6B35] transition-colors"
                >
                  <option value="09:00">9:00 AM</option>
                  <option value="10:00">10:00 AM</option>
                  <option value="11:00">11:00 AM</option>
                  <option value="12:00">12:00 PM</option>
                  <option value="13:00">1:00 PM</option>
                  <option value="14:00">2:00 PM</option>
                  <option value="15:00">3:00 PM</option>
                  <option value="16:00">4:00 PM</option>
                </select>
              </div>

              {/* Interview Type */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-[#9ca3af] uppercase tracking-wider mb-1.5">Interview Type</label>
                <select
                  value={scheduleType}
                  onChange={(e) => setScheduleType(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-[#1a1a1a] border border-gray-200 dark:border-[#333] rounded-lg px-3 py-2 text-sm outline-none text-gray-900 dark:text-white focus:border-[#FF6B35] transition-colors"
                >
                  <option value="Technical Screen">Technical Screen</option>
                  <option value="HR Interview">HR Interview</option>
                  <option value="Portfolio Review">Portfolio Review</option>
                  <option value="Final Round">Final Round</option>
                </select>
              </div>
            </div>

            {/* Actions */}
            <div className="px-6 py-4 border-t border-gray-200 dark:border-[#333] flex items-center justify-end gap-3">
              <button
                onClick={() => setScheduleModal(null)}
                className="px-5 py-2.5 text-sm font-medium border border-gray-200 dark:border-[#333] rounded-lg hover:bg-gray-100 dark:hover:bg-[#1a1a1a] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmSchedule}
                className="px-5 py-2.5 text-sm font-bold bg-[#FF6B35] hover:bg-[#e85a25] text-white rounded-lg transition-colors"
              >
                Schedule Interview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
