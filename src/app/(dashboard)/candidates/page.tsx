'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import TopBar from '@/components/TopBar';
import { supabase } from '@/lib/supabase';
import { Applicant } from '@/lib/types';

export default function CandidatesPage() {
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [filter, setFilter] = useState<'all' | 'screening' | 'scheduled'>('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchApplicants();
  }, []);

  async function fetchApplicants() {
    const { data } = await supabase
      .from('applicants')
      .select('*')
      .order('ai_match_score', { ascending: false, nullsFirst: false });
    if (data) setApplicants(data);
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
                <p className="text-sm text-[#9ca3af]">Highest compatibility based on current requirements</p>
              </div>
              <div className="flex gap-2">
                <button className="p-2 rounded-lg border border-[#333] hover:bg-[#242424] text-[#9ca3af]">&lt;</button>
                <button className="p-2 rounded-lg border border-[#333] hover:bg-[#242424] text-[#9ca3af]">&gt;</button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {topMatches.map((a) => (
                <div key={a.id} className="bg-[#242424] border border-[#333] rounded-xl p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-12 h-12 rounded-full bg-[#FF6B35]/20 flex items-center justify-center text-[#FF6B35] font-bold">
                      {a.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-[#FF6B35]">{a.ai_match_score}%</div>
                      <div className="text-xs text-[#9ca3af] uppercase">Match</div>
                    </div>
                  </div>
                  <h3 className="font-semibold">{a.name}</h3>
                  <p className="text-sm text-[#9ca3af]">{a.job_title}</p>
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
              <p className="text-sm text-[#9ca3af]">Total {applicants.length} applicants in the pipeline</p>
            </div>
            <div className="flex gap-2">
              <button className="px-4 py-2 rounded-lg border border-[#333] text-sm text-[#9ca3af] hover:bg-[#242424] flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
                Filters
              </button>
              <button className="px-4 py-2 rounded-lg border border-[#333] text-sm text-[#9ca3af] hover:bg-[#242424] flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                Export
              </button>
            </div>
          </div>

          {/* Filter tabs */}
          <div className="flex items-center gap-4 mb-4">
            <div className="flex gap-1 bg-[#242424] rounded-lg p-1">
              {(['all', 'screening', 'scheduled'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    filter === f ? 'bg-[#FF6B35] text-white' : 'text-[#9ca3af] hover:text-white'
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
              className="bg-[#242424] border border-[#333] rounded-lg px-3 py-1.5 text-sm outline-none text-white placeholder:text-[#6b7280] w-48"
            />
          </div>

          {/* Table */}
          <div className="bg-[#242424] border border-[#333] rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#333]">
                  <th className="text-left text-xs font-semibold text-[#9ca3af] uppercase px-5 py-3">Name</th>
                  <th className="text-left text-xs font-semibold text-[#9ca3af] uppercase px-5 py-3">AI Match Score</th>
                  <th className="text-left text-xs font-semibold text-[#9ca3af] uppercase px-5 py-3">Date</th>
                  <th className="text-left text-xs font-semibold text-[#9ca3af] uppercase px-5 py-3">Status</th>
                  <th className="text-left text-xs font-semibold text-[#9ca3af] uppercase px-5 py-3">Quick Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((a) => (
                  <tr key={a.id} className="border-b border-[#333] hover:bg-[#2a2a2a] transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-[#FF6B35]/20 flex items-center justify-center text-[#FF6B35] text-sm font-bold">
                          {a.name.split(' ').map(n => n[0]).join('')}
                        </div>
                        <div>
                          <Link href={`/candidates/${a.id}`} className="font-medium hover:text-[#FF6B35]">{a.name}</Link>
                          <div className="text-xs text-[#9ca3af]">{a.job_title}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      {a.ai_match_score ? (
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-2 bg-[#333] rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${a.ai_match_score}%`,
                                backgroundColor: a.ai_match_score >= 90 ? '#ef4444' : a.ai_match_score >= 70 ? '#FF6B35' : '#10b981',
                              }}
                            />
                          </div>
                          <span className="text-sm font-medium">{a.ai_match_score}%</span>
                        </div>
                      ) : (
                        <span className="text-sm text-[#6b7280]">Pending</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-sm text-[#9ca3af]">
                      {new Date(a.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                        a.status === 'scheduled' ? 'bg-[#10b981]/20 text-[#10b981]' :
                        a.status === 'screened' ? 'bg-[#FF6B35]/20 text-[#FF6B35]' :
                        a.status === 'screening' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-[#333] text-[#9ca3af]'
                      }`}>
                        {a.status.charAt(0).toUpperCase() + a.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <Link href={`/candidates/${a.id}`} className="p-1.5 rounded hover:bg-[#333] text-[#9ca3af] hover:text-white" title="View">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                        </Link>
                        <button className="p-1.5 rounded hover:bg-[#333] text-[#9ca3af] hover:text-white" title="Schedule">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        </button>
                        <button className="p-1.5 rounded hover:bg-[#333] text-[#9ca3af] hover:text-red-400" title="Remove">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-12 text-center text-[#9ca3af]">
                      {applicants.length === 0 ? 'No candidates yet. Applications submitted at /apply will appear here.' : 'No candidates match your filter.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
