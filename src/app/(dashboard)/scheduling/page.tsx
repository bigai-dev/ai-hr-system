'use client';

import { useEffect, useState, useMemo } from 'react';
import TopBar from '@/components/TopBar';
import { supabase } from '@/lib/supabase';
import type { Interview } from '@/lib/types';

const HOURS = [9, 10, 11, 12, 13, 14, 15, 16];
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const SAMPLE_INTERVIEWS = [
  { name: 'Alex Rivera', type: 'Technical Screen', day: 1, hour: 10, duration: 60 },
  { name: 'Sarah Chen', type: 'HR Interview', day: 2, hour: 14, duration: 45 },
  { name: 'James Wilson', type: 'Portfolio Review', day: 3, hour: 11, duration: 30 },
  { name: 'Priya Patel', type: 'Technical Screen', day: 4, hour: 9, duration: 60 },
  { name: 'Marcus Lee', type: 'Final Round', day: 0, hour: 15, duration: 45 },
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

  // Interview dates for orange dots on mini calendar
  const interviewDays = new Set(SAMPLE_INTERVIEWS.map((i) => weekDates[i.day]?.getDate()));

  useEffect(() => {
    async function fetchInterviews() {
      const { data } = await supabase
        .from('interviews')
        .select('*, applicant:applicants(*)')
        .order('scheduled_date', { ascending: true });
      if (data) setInterviews(data);
    }
    fetchInterviews();
  }, []);

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
            <div className="overflow-x-auto">
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
                      const interview = SAMPLE_INTERVIEWS.find((s) => s.day === dayIdx && s.hour === hour);

                      return (
                        <div key={dayIdx} className="border-l border-gray-200/50 dark:border-[#333333]/50 relative px-1 py-0.5">
                          {interview && (
                            <div className="absolute inset-x-1 top-1 bg-[#FF6B35]/15 border border-[#FF6B35]/30 rounded-md p-1.5 cursor-pointer hover:bg-[#FF6B35]/25 transition-colors z-10" style={{ height: Math.max(30, (interview.duration / 60) * 68) }}>
                              <div className="text-xs font-semibold text-[#FF6B35] truncate">{interview.name}</div>
                              <div className="text-[10px] text-[#FF6B35]/70 truncate">{interview.type}</div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
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
