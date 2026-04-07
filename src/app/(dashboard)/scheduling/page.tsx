'use client';

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import TopBar from '@/components/TopBar';
import { db } from '@/lib/db';
import type { Interview } from '@/lib/types';

const HOURS = [9, 10, 11, 12, 13, 14, 15, 16];
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

interface CalendarInterview {
  id?: string;         // DB id (undefined for sample interviews)
  name: string;
  type: string;
  day: number;         // 0=Mon to 6=Sun
  hour: number;
  duration: number;    // minutes
  isSample: boolean;
  dbInterview?: Interview; // full DB record for real interviews
}

const SAMPLE_INTERVIEWS: CalendarInterview[] = [
  { name: 'Alex Rivera', type: 'Technical Screen', day: 1, hour: 10, duration: 60, isSample: true },
  { name: 'Sarah Chen', type: 'HR Interview', day: 2, hour: 14, duration: 45, isSample: true },
  { name: 'James Wilson', type: 'Portfolio Review', day: 3, hour: 11, duration: 30, isSample: true },
  { name: 'Priya Patel', type: 'Technical Screen', day: 4, hour: 9, duration: 60, isSample: true },
  { name: 'Marcus Lee', type: 'Final Round', day: 0, hour: 15, duration: 45, isSample: true },
];

const ACTIVITY_ITEMS = [
  { name: 'Alex Rivera', action: 'invited', time: '2M AGO', color: 'text-[#FF6B35]' },
  { name: 'Sarah Chen', action: 'confirmed', time: '1H AGO', color: 'text-[#10b981]' },
  { name: 'James Wilson', action: 'rescheduled', time: '3H AGO', color: 'text-[#f59e0b]' },
  { name: 'Priya Patel', action: 'completed', time: '5H AGO', color: 'text-[#10b981]' },
  { name: 'Marcus Lee', action: 'invited', time: '1D AGO', color: 'text-[#FF6B35]' },
];

function getWeekDates(today: Date) {
  const dayOfWeek = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((dayOfWeek + 6) % 7));
  const dates: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    dates.push(d);
  }
  return dates;
}

function getMonthGrid(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDay = (firstDay.getDay() + 6) % 7;
  const totalDays = lastDay.getDate();
  const grid: (number | null)[] = [];
  for (let i = 0; i < startDay; i++) grid.push(null);
  for (let d = 1; d <= totalDays; d++) grid.push(d);
  while (grid.length % 7 !== 0) grid.push(null);
  return grid;
}

export default function SchedulingPage() {
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const today = useMemo(() => new Date(), []);
  const weekDates = useMemo(() => getWeekDates(today), [today]);
  const monthGrid = useMemo(() => getMonthGrid(today.getFullYear(), today.getMonth()), [today]);
  const todayDate = today.getDate();
  const todayDayIndex = (today.getDay() + 6) % 7; // 0=Mon

  const monthName = today.toLocaleString('default', { month: 'long' });
  const weekStart = weekDates[0];
  const weekEnd = weekDates[6];
  const weekRangeStr = `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

  // Popup state for click-to-manage
  const [selectedInterview, setSelectedInterview] = useState<CalendarInterview | null>(null);
  const [popupPos, setPopupPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const [actionLoading, setActionLoading] = useState(false);
  const popupRef = useRef<HTMLDivElement>(null);

  const fetchInterviews = useCallback(async () => {
    const data = await db.getInterviews();
    if (data) setInterviews(data as any);
  }, []);

  useEffect(() => {
    fetchInterviews();
  }, [fetchInterviews]);

  // Convert DB interviews to calendar format and merge with samples
  const calendarInterviews = useMemo(() => {
    const mondayDate = weekDates[0];
    const sundayDate = weekDates[6];

    const realInterviews: CalendarInterview[] = interviews
      .map((iv) => {
        // Parse scheduled_date (YYYY-MM-DD) and determine day index relative to this week
        const dateObj = new Date(iv.scheduled_date + 'T00:00:00');
        // Check if the interview is within the current week
        if (dateObj < mondayDate || dateObj > sundayDate) return null;

        const dayIndex = (dateObj.getDay() + 6) % 7; // 0=Mon to 6=Sun

        // Parse hour from scheduled_time (HH:MM or HH:MM:SS)
        const timeParts = iv.scheduled_time?.split(':');
        const hour = timeParts ? parseInt(timeParts[0], 10) : 9;

        return {
          id: iv.id,
          name: iv.applicant?.name || 'Unknown',
          type: iv.type || 'Interview',
          day: dayIndex,
          hour,
          duration: iv.duration_minutes || 30,
          isSample: false,
          dbInterview: iv,
        } as CalendarInterview;
      })
      .filter((x): x is CalendarInterview => x !== null);

    return [...SAMPLE_INTERVIEWS, ...realInterviews];
  }, [interviews, weekDates]);

  // Interview dates for orange dots on mini calendar
  const interviewDays = new Set(calendarInterviews.map((i) => weekDates[i.day]?.getDate()));

  // Handle interview block click
  const handleInterviewClick = useCallback(
    (interview: CalendarInterview, e: React.MouseEvent) => {
      e.stopPropagation();
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const scrollContainer = (e.currentTarget as HTMLElement).closest('.overflow-x-auto');
      const containerRect = scrollContainer?.getBoundingClientRect() || { top: 0, left: 0 };

      setPopupPos({
        top: rect.top - containerRect.top + 40,
        left: rect.left - containerRect.left + rect.width / 2,
      });
      setSelectedInterview(interview);
    },
    []
  );

  // Delete interview from Supabase
  const handleDelete = useCallback(
    async (interview: CalendarInterview) => {
      if (interview.isSample || !interview.id) {
        setSelectedInterview(null);
        return;
      }
      setActionLoading(true);
      try {
        // Delete the interview
        await db.deleteInterview(interview.id);
        // Reset applicant status back to screened
        if (interview.dbInterview?.applicant_id) {
          await db.updateApplicantStatus(interview.dbInterview.applicant_id, 'screened');
        }
        // Refresh interviews and close popup
        await fetchInterviews();
        setSelectedInterview(null);
      } catch (err) {
        console.error('Error deleting interview:', err);
      } finally {
        setActionLoading(false);
      }
    },
    [fetchInterviews]
  );

  // Close popup when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        setSelectedInterview(null);
      }
    }
    if (selectedInterview) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [selectedInterview]);

  return (
    <div className="flex flex-col h-screen">
      <TopBar title="INTERVIEW SCHEDULING" />
      <div className="flex-1 overflow-auto p-6">
        {/* Top header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div>
              <h2 className="text-xl font-bold flex items-center gap-3">
                Interview Scheduling Bot
                <span className="text-xs font-semibold bg-[#10b981]/20 text-[#10b981] px-2.5 py-1 rounded-full uppercase tracking-wider">
                  Active Bot
                </span>
              </h2>
              <p className="text-sm text-gray-500 dark:text-[#9ca3af] mt-1">
                AI-powered scheduling manages availability and sends invitations automatically
              </p>
            </div>
          </div>
          <button className="bg-[#FF6B35] hover:bg-[#e85a25] text-white px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Schedule Meeting
          </button>
        </div>

        <div className="flex gap-6">
          {/* Main calendar area */}
          <div className="flex-1 bg-white dark:bg-[#242424] border border-gray-200 dark:border-[#333] rounded-xl overflow-hidden">
            {/* Calendar header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-[#333]">
              <div>
                <h3 className="text-base font-semibold">Weekly Availability</h3>
                <p className="text-xs text-gray-500 dark:text-[#9ca3af] mt-0.5">{weekRangeStr}</p>
              </div>
              <div className="flex items-center gap-1 bg-gray-50 dark:bg-[#1a1a1a] rounded-lg p-1">
                <button className="px-3 py-1.5 text-xs font-medium rounded-md bg-[#FF6B35] text-white">
                  Week
                </button>
                <button className="px-3 py-1.5 text-xs font-medium rounded-md text-gray-500 dark:text-[#9ca3af] hover:text-gray-900 dark:hover:text-white transition-colors">
                  Month
                </button>
                <button className="px-3 py-1.5 text-xs font-medium rounded-md text-gray-500 dark:text-[#9ca3af] hover:text-gray-900 dark:hover:text-white transition-colors">
                  Agenda
                </button>
              </div>
            </div>

            {/* Calendar grid */}
            <div className="overflow-x-auto relative">
              <div className="min-w-[700px]">
                {/* Day headers */}
                <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-gray-200 dark:border-[#333]">
                  <div className="p-2" />
                  {DAY_LABELS.map((label, i) => {
                    const date = weekDates[i];
                    const isToday = i === todayDayIndex;
                    return (
                      <div key={label} className="p-2 text-center border-l border-gray-200 dark:border-[#333]">
                        <div className={`text-xs font-medium uppercase tracking-wider ${isToday ? 'text-[#FF6B35]' : 'text-gray-500 dark:text-[#9ca3af]'}`}>
                          {label}
                        </div>
                        <div className={`text-lg font-bold mt-0.5 ${isToday ? 'text-[#FF6B35]' : 'text-gray-900 dark:text-white'}`}>
                          {date.getDate()}
                        </div>
                        {isToday && (
                          <div className="w-1.5 h-1.5 bg-[#FF6B35] rounded-full mx-auto mt-1" />
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Time rows */}
                {HOURS.map((hour) => (
                  <div key={hour} className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-gray-200/50 dark:border-[#333333]/50 relative" style={{ height: 72 }}>
                    <div className="p-2 text-xs text-gray-500 dark:text-[#9ca3af] text-right pr-3 pt-1">
                      {hour <= 12 ? `${hour}:00 AM` : `${hour - 12}:00 PM`}
                    </div>
                    {DAY_LABELS.map((_, dayIdx) => {
                      const matchingInterviews = calendarInterviews.filter((s) => s.day === dayIdx && s.hour === hour);

                      return (
                        <div key={dayIdx} className="border-l border-gray-200/50 dark:border-[#333333]/50 relative px-1 py-0.5">
                          {matchingInterviews.map((interview, idx) => (
                            <div
                              key={interview.id || `sample-${interview.name}-${idx}`}
                              onClick={(e) => handleInterviewClick(interview, e)}
                              className={`absolute inset-x-1 top-1 rounded-md p-1.5 cursor-pointer transition-colors z-10 ${
                                interview.isSample
                                  ? 'bg-[#FF6B35]/15 border border-[#FF6B35]/30 hover:bg-[#FF6B35]/25'
                                  : 'bg-[#3b82f6]/15 border border-[#3b82f6]/30 hover:bg-[#3b82f6]/25'
                              }`}
                              style={{ height: Math.max(30, (interview.duration / 60) * 68) }}
                            >
                              <div className={`text-xs font-semibold truncate ${interview.isSample ? 'text-[#FF6B35]' : 'text-[#3b82f6]'}`}>
                                {interview.name}
                              </div>
                              <div className={`text-[10px] truncate ${interview.isSample ? 'text-[#FF6B35]/70' : 'text-[#3b82f6]/70'}`}>
                                {interview.type}
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>

              {/* Interview detail popup */}
              {selectedInterview && (
                <div
                  ref={popupRef}
                  className="absolute z-50 w-72 bg-white dark:bg-[#2a2a2a] border border-gray-200 dark:border-[#444] rounded-xl shadow-2xl p-4"
                  style={{
                    top: popupPos.top,
                    left: Math.min(popupPos.left, 500),
                  }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-bold text-gray-900 dark:text-white">Interview Details</h4>
                    <button
                      onClick={() => setSelectedInterview(null)}
                      className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  <div className="space-y-2 mb-4">
                    <div className="flex items-center gap-2">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${
                        selectedInterview.isSample
                          ? 'bg-[#FF6B35]/10 text-[#FF6B35]'
                          : 'bg-[#3b82f6]/10 text-[#3b82f6]'
                      }`}>
                        {selectedInterview.name.split(' ').map((n) => n[0]).join('')}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-gray-900 dark:text-white">{selectedInterview.name}</div>
                        <div className="text-xs text-gray-500 dark:text-[#9ca3af]">{selectedInterview.type}</div>
                      </div>
                    </div>
                    <div className="text-xs text-gray-500 dark:text-[#9ca3af] space-y-1 pl-9">
                      <div className="flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        {DAY_LABELS[selectedInterview.day]}, {weekDates[selectedInterview.day]?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {selectedInterview.hour <= 12 ? `${selectedInterview.hour}:00 AM` : `${selectedInterview.hour - 12}:00 PM`} - {selectedInterview.duration}min
                      </div>
                    </div>
                    {selectedInterview.isSample && (
                      <div className="text-[10px] text-gray-400 dark:text-[#666] italic pl-9">Sample data (demo only)</div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    {!selectedInterview.isSample ? (
                      <>
                        <button
                          onClick={() => handleDelete(selectedInterview)}
                          disabled={actionLoading}
                          className="flex-1 px-3 py-2 text-xs font-semibold rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {actionLoading ? 'Deleting...' : 'Delete'}
                        </button>
                        <button
                          onClick={() => handleDelete(selectedInterview)}
                          disabled={actionLoading}
                          className="flex-1 px-3 py-2 text-xs font-semibold rounded-lg bg-[#FF6B35]/10 text-[#FF6B35] hover:bg-[#FF6B35]/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {actionLoading ? 'Working...' : 'Reschedule'}
                        </button>
                      </>
                    ) : (
                      <span className="flex-1 px-3 py-2 text-xs text-center font-medium text-gray-400 dark:text-[#666]">
                        Sample data
                      </span>
                    )}
                    <button
                      onClick={() => setSelectedInterview(null)}
                      disabled={actionLoading}
                      className="flex-1 px-3 py-2 text-xs font-semibold rounded-lg bg-gray-100 dark:bg-[#333] text-gray-600 dark:text-[#9ca3af] hover:bg-gray-200 dark:hover:bg-[#444] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Close
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right sidebar */}
          <div className="w-72 flex-shrink-0 space-y-5">
            {/* Month Preview */}
            <div className="bg-white dark:bg-[#242424] border border-gray-200 dark:border-[#333] rounded-xl p-4">
              <h4 className="text-sm font-semibold mb-3">Month Preview</h4>
              <div className="text-xs text-gray-500 dark:text-[#9ca3af] mb-3 font-medium">
                {monthName} {today.getFullYear()}
              </div>
              <div className="grid grid-cols-7 gap-y-1 text-center">
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                  <div key={i} className="text-[10px] text-gray-500 dark:text-[#9ca3af] font-semibold pb-1">{d}</div>
                ))}
                {monthGrid.map((day, i) => {
                  const isToday = day === todayDate;
                  const hasInterview = day !== null && interviewDays.has(day);
                  return (
                    <div key={i} className="relative flex flex-col items-center">
                      <div className={`w-7 h-7 flex items-center justify-center text-xs rounded-full ${
                        isToday
                          ? 'bg-[#FF6B35] text-white font-bold'
                          : day
                          ? 'text-gray-500 dark:text-[#9ca3af] hover:bg-gray-100 dark:hover:bg-[#333] cursor-pointer'
                          : ''
                      }`}>
                        {day || ''}
                      </div>
                      {hasInterview && !isToday && (
                        <div className="w-1 h-1 bg-[#FF6B35] rounded-full -mt-0.5" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-white dark:bg-[#242424] border border-gray-200 dark:border-[#333] rounded-xl p-4">
              <h4 className="text-sm font-semibold mb-3">Recent Activity</h4>
              <div className="space-y-3">
                {ACTIVITY_ITEMS.map((item, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#FF6B35]/10 flex items-center justify-center text-[#FF6B35] text-xs font-bold flex-shrink-0 mt-0.5">
                      {item.name.split(' ').map((n) => n[0]).join('')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm">
                        <span className="font-medium">{item.name}</span>{' '}
                        <span className={item.color}>{item.action}</span>
                      </div>
                      <div className="text-[10px] text-gray-500 dark:text-[#9ca3af] uppercase tracking-wider mt-0.5">
                        {item.time}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Stats */}
            <div className="bg-white dark:bg-[#242424] border border-gray-200 dark:border-[#333] rounded-xl p-4">
              <h4 className="text-sm font-semibold mb-3">This Week</h4>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-[#9ca3af]">Scheduled</span>
                  <span className="font-semibold text-[#FF6B35]">5</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-[#9ca3af]">Completed</span>
                  <span className="font-semibold text-[#10b981]">2</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
