'use client';

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import Link from 'next/link';
import TopBar from '@/components/TopBar';
import {
  getInterviews,
  deleteInterview,
  insertInterview,
  updateApplicantStatus,
  getApplicants,
} from '@/app/(dashboard)/actions';
import type { Interview, Applicant } from '@/lib/types';

const HOURS = [9, 10, 11, 12, 13, 14, 15, 16];
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

interface CalendarInterview {
  id: string;
  name: string;
  type: string;
  day: number;          // 0=Mon to 6=Sun (relative to anchor week)
  hour: number;
  duration: number;     // minutes
  dbInterview: Interview;
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function getMondayOf(d: Date): Date {
  const dayOfWeek = d.getDay();
  const monday = new Date(d);
  monday.setDate(d.getDate() - ((dayOfWeek + 6) % 7));
  return startOfDay(monday);
}

function getWeekDates(anchor: Date): Date[] {
  const monday = getMondayOf(anchor);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function getMonthGrid(year: number, month: number): (number | null)[] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDay = (firstDay.getDay() + 6) % 7; // 0=Mon
  const totalDays = lastDay.getDate();
  const grid: (number | null)[] = [];
  for (let i = 0; i < startDay; i++) grid.push(null);
  for (let d = 1; d <= totalDays; d++) grid.push(d);
  while (grid.length % 7 !== 0) grid.push(null);
  return grid;
}

function sameYMD(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function parseInterviewDate(iv: Interview): Date {
  return new Date(iv.scheduled_date + 'T00:00:00');
}

function formatRange(start: Date, end: Date): string {
  const s = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const e = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return `${s} - ${e}`;
}

function formatHour(h: number): string {
  if (h === 0) return '12:00 AM';
  if (h === 12) return '12:00 PM';
  return h < 12 ? `${h}:00 AM` : `${h - 12}:00 PM`;
}

type ViewMode = 'week' | 'month' | 'agenda';

export default function SchedulingPage() {
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [currentDate, setCurrentDate] = useState<Date>(() => startOfDay(new Date()));
  const today = useMemo(() => startOfDay(new Date()), []);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  function showToast(msg: string, ms = 3000) {
    setToast(msg);
    setTimeout(() => setToast(null), ms);
  }

  const weekDates = useMemo(() => getWeekDates(currentDate), [currentDate]);
  const monthGrid = useMemo(
    () => getMonthGrid(currentDate.getFullYear(), currentDate.getMonth()),
    [currentDate],
  );
  const monthName = currentDate.toLocaleString('default', { month: 'long' });
  const weekRangeStr = formatRange(weekDates[0], weekDates[6]);

  // Popup state for click-to-manage
  const [selectedInterview, setSelectedInterview] = useState<CalendarInterview | null>(null);
  const [popupPos, setPopupPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const [actionLoading, setActionLoading] = useState(false);
  const popupRef = useRef<HTMLDivElement>(null);

  const fetchInterviews = useCallback(async () => {
    const data = await getInterviews();
    if (data) setInterviews(data as Interview[]);
  }, []);

  useEffect(() => {
    fetchInterviews();
  }, [fetchInterviews]);

  // Interviews for the currently visible week, mapped to calendar grid coords.
  const calendarInterviews = useMemo<CalendarInterview[]>(() => {
    const monday = weekDates[0];
    const sunday = weekDates[6];
    return interviews
      .map((iv) => {
        const dateObj = parseInterviewDate(iv);
        if (dateObj < monday || dateObj > sunday) return null;
        const dayIndex = (dateObj.getDay() + 6) % 7;
        const hour = parseInt((iv.scheduled_time ?? '09:00').split(':')[0], 10);
        return {
          id: iv.id,
          name: iv.applicant?.name || 'Unknown',
          type: iv.type || 'Interview',
          day: dayIndex,
          hour,
          duration: iv.duration_minutes || 30,
          dbInterview: iv,
        } as CalendarInterview;
      })
      .filter((x): x is CalendarInterview => x !== null);
  }, [interviews, weekDates]);

  // Map of YYYY-MM-DD → count for the month preview pips.
  const interviewsByDateKey = useMemo(() => {
    const map = new Map<string, number>();
    for (const iv of interviews) {
      map.set(iv.scheduled_date, (map.get(iv.scheduled_date) ?? 0) + 1);
    }
    return map;
  }, [interviews]);

  // Interview counts/items for the month being viewed (used by Month + mini-cal).
  const interviewsByDayInMonth = useMemo(() => {
    const map = new Map<number, Interview[]>();
    for (const iv of interviews) {
      const d = parseInterviewDate(iv);
      if (
        d.getFullYear() === currentDate.getFullYear() &&
        d.getMonth() === currentDate.getMonth()
      ) {
        const day = d.getDate();
        const list = map.get(day) ?? [];
        list.push(iv);
        map.set(day, list);
      }
    }
    return map;
  }, [interviews, currentDate]);

  // Agenda: upcoming interviews from currentDate onward, chronologically.
  const agendaItems = useMemo(() => {
    const anchor = startOfDay(currentDate);
    return [...interviews]
      .filter((iv) => parseInterviewDate(iv) >= anchor)
      .sort((a, b) =>
        (a.scheduled_date + a.scheduled_time).localeCompare(b.scheduled_date + b.scheduled_time),
      );
  }, [interviews, currentDate]);

  // Handlers
  const handleInterviewClick = useCallback(
    (interview: CalendarInterview, e: React.MouseEvent) => {
      e.stopPropagation();
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      // Position popup using viewport coordinates so it stays visible
      // regardless of page scroll. Conservative size estimates so the popup
      // never spills off-screen even before its real height is measured.
      const POPUP_W = 288; // w-72
      const POPUP_H = 360; // worst case with full action area
      const margin = 12;
      // Prefer below-and-right of the clicked tile; flip when there's no room.
      const desiredLeft = rect.right + 8 > window.innerWidth - POPUP_W - margin
        ? rect.left - POPUP_W - 8
        : rect.right + 8;
      const desiredTop = rect.bottom + 8;
      const left = Math.max(margin, Math.min(desiredLeft, window.innerWidth - POPUP_W - margin));
      const top = Math.max(margin, Math.min(desiredTop, window.innerHeight - POPUP_H - margin));
      setPopupPos({ top, left });
      setSelectedInterview(interview);
    },
    [],
  );

  const handleDelete = useCallback(
    async (interview: CalendarInterview) => {
      setActionLoading(true);
      try {
        await deleteInterview(interview.id);
        if (interview.dbInterview.applicant_id) {
          await updateApplicantStatus(interview.dbInterview.applicant_id, 'screened');
        }
        await fetchInterviews();
        setSelectedInterview(null);
        showToast(`Removed ${interview.name}'s ${interview.type}`);
      } catch (err) {
        showToast(
          `Could not remove interview: ${err instanceof Error ? err.message : 'unknown error'}`,
          4000,
        );
      } finally {
        setActionLoading(false);
      }
    },
    [fetchInterviews],
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

  // Navigation: prev/next units depend on view mode.
  function shiftDate(direction: -1 | 1) {
    setCurrentDate((prev) => {
      const next = new Date(prev);
      if (viewMode === 'month') {
        next.setMonth(next.getMonth() + direction);
      } else if (viewMode === 'week') {
        next.setDate(next.getDate() + direction * 7);
      } else {
        // agenda: page by 14 days
        next.setDate(next.getDate() + direction * 14);
      }
      return startOfDay(next);
    });
  }

  function goToToday() {
    setCurrentDate(today);
  }

  // Click on a mini-calendar date → set currentDate to that date in the
  // currently-viewed month. This shifts week / agenda accordingly.
  function selectMiniCalDay(day: number) {
    const d = new Date(currentDate);
    d.setDate(day);
    setCurrentDate(startOfDay(d));
  }

  return (
    <div className="flex flex-col h-screen">
      <TopBar title="INTERVIEW SCHEDULING" />
      {toast && (
        <div className="fixed top-6 right-6 z-50 bg-card border border-card-border rounded-lg shadow-lg px-5 py-3 text-sm">
          {toast}
        </div>
      )}
      <div className="flex-1 overflow-auto p-4 md:p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-6 gap-4">
          <div>
            <h2 className="text-xl font-bold">Interview Scheduling</h2>
            <p className="text-sm text-gray-500 dark:text-[#9ca3af] mt-1">
              Interviews booked from candidate profiles. Click a block to manage, or schedule a new one.
            </p>
          </div>
          <button
            onClick={() => setScheduleModalOpen(true)}
            className="bg-accent hover:bg-accent-hover text-white px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 shrink-0"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Schedule Meeting
          </button>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Main calendar area */}
          <div className="flex-1 bg-white dark:bg-[#242424] border border-gray-200 dark:border-[#333] rounded-xl overflow-hidden">
            {/* Calendar header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-[#333] gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <h3 className="text-base font-semibold">
                  {viewMode === 'week'
                    ? 'Weekly Availability'
                    : viewMode === 'month'
                      ? `${monthName} ${currentDate.getFullYear()}`
                      : 'Agenda'}
                </h3>
                <p className="text-xs text-gray-500 dark:text-[#9ca3af]">
                  {viewMode === 'week' && weekRangeStr}
                  {viewMode === 'agenda' && `From ${currentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {/* Prev / Today / Next */}
                <button
                  onClick={() => shiftDate(-1)}
                  aria-label="Previous"
                  className="px-2 py-1.5 text-xs rounded-md bg-gray-50 dark:bg-[#1a1a1a] hover:bg-gray-100 dark:hover:bg-[#2a2a2a] text-gray-700 dark:text-[#9ca3af] transition-colors"
                >
                  ‹
                </button>
                <button
                  onClick={goToToday}
                  className="px-3 py-1.5 text-xs font-medium rounded-md bg-gray-50 dark:bg-[#1a1a1a] hover:bg-gray-100 dark:hover:bg-[#2a2a2a] text-gray-700 dark:text-[#9ca3af] transition-colors"
                >
                  Today
                </button>
                <button
                  onClick={() => shiftDate(1)}
                  aria-label="Next"
                  className="px-2 py-1.5 text-xs rounded-md bg-gray-50 dark:bg-[#1a1a1a] hover:bg-gray-100 dark:hover:bg-[#2a2a2a] text-gray-700 dark:text-[#9ca3af] transition-colors"
                >
                  ›
                </button>

                {/* View toggle */}
                <div className="flex items-center gap-1 bg-gray-50 dark:bg-[#1a1a1a] rounded-lg p-1 ml-2">
                  {(['week', 'month', 'agenda'] as ViewMode[]).map((m) => (
                    <button
                      key={m}
                      onClick={() => setViewMode(m)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                        viewMode === m
                          ? 'bg-accent text-white'
                          : 'text-gray-500 dark:text-[#9ca3af] hover:text-gray-900 dark:hover:text-white'
                      }`}
                    >
                      {m.charAt(0).toUpperCase() + m.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* View body */}
            {viewMode === 'week' && (
              <WeekView
                weekDates={weekDates}
                today={today}
                calendarInterviews={calendarInterviews}
                onInterviewClick={handleInterviewClick}
                selectedInterview={selectedInterview}
                popupPos={popupPos}
                popupRef={popupRef}
                onClosePopup={() => setSelectedInterview(null)}
                onDelete={handleDelete}
                actionLoading={actionLoading}
              />
            )}

            {viewMode === 'month' && (
              <MonthView
                year={currentDate.getFullYear()}
                month={currentDate.getMonth()}
                today={today}
                interviewsByDay={interviewsByDayInMonth}
                onDayClick={(day) => {
                  selectMiniCalDay(day);
                  setViewMode('week');
                }}
              />
            )}

            {viewMode === 'agenda' && (
              <AgendaView
                items={agendaItems}
                today={today}
                onDelete={async (iv) => {
                  setActionLoading(true);
                  try {
                    await deleteInterview(iv.id);
                    if (iv.applicant_id) {
                      await updateApplicantStatus(iv.applicant_id, 'screened');
                    }
                    await fetchInterviews();
                    showToast(`Removed ${iv.applicant?.name ?? 'interview'} from the schedule`);
                  } catch (err) {
                    showToast(
                      `Could not remove: ${err instanceof Error ? err.message : 'unknown error'}`,
                      4000,
                    );
                  } finally {
                    setActionLoading(false);
                  }
                }}
                actionLoading={actionLoading}
              />
            )}
          </div>

          {/* Right sidebar */}
          <div className="w-72 flex-shrink-0 space-y-5">
            {/* Mini calendar */}
            <div className="bg-white dark:bg-[#242424] border border-gray-200 dark:border-[#333] rounded-xl p-4">
              <h4 className="text-sm font-semibold mb-3">Month Preview</h4>
              <div className="flex items-center justify-between mb-3">
                <button
                  onClick={() =>
                    setCurrentDate((prev) => {
                      const d = new Date(prev);
                      d.setMonth(d.getMonth() - 1);
                      return startOfDay(d);
                    })
                  }
                  className="text-xs text-gray-500 dark:text-[#9ca3af] hover:text-gray-900 dark:hover:text-white px-1"
                  aria-label="Previous month"
                >
                  ‹
                </button>
                <div className="text-xs text-gray-500 dark:text-[#9ca3af] font-medium">
                  {monthName} {currentDate.getFullYear()}
                </div>
                <button
                  onClick={() =>
                    setCurrentDate((prev) => {
                      const d = new Date(prev);
                      d.setMonth(d.getMonth() + 1);
                      return startOfDay(d);
                    })
                  }
                  className="text-xs text-gray-500 dark:text-[#9ca3af] hover:text-gray-900 dark:hover:text-white px-1"
                  aria-label="Next month"
                >
                  ›
                </button>
              </div>
              <div className="grid grid-cols-7 gap-y-1 text-center">
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                  <div
                    key={i}
                    className="text-[10px] text-gray-500 dark:text-[#9ca3af] font-semibold pb-1"
                  >
                    {d}
                  </div>
                ))}
                {monthGrid.map((day, i) => {
                  if (day === null) return <div key={i} />;
                  const dateObj = new Date(currentDate);
                  dateObj.setDate(day);
                  const isToday = sameYMD(dateObj, today);
                  const isSelected = sameYMD(dateObj, currentDate);
                  const ymdKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                  const hasInterview = interviewsByDateKey.has(ymdKey);
                  return (
                    <button
                      key={i}
                      onClick={() => selectMiniCalDay(day)}
                      className="relative flex flex-col items-center group"
                    >
                      <div
                        className={`w-7 h-7 flex items-center justify-center text-xs rounded-full transition-colors ${
                          isToday
                            ? 'bg-accent text-white font-bold'
                            : isSelected
                              ? 'bg-accent/20 text-accent font-semibold'
                              : 'text-gray-500 dark:text-[#9ca3af] hover:bg-gray-100 dark:hover:bg-[#333] cursor-pointer'
                        }`}
                      >
                        {day}
                      </div>
                      {hasInterview && !isToday && (
                        <div className="w-1 h-1 bg-accent rounded-full -mt-0.5" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Stats */}
            <div className="bg-white dark:bg-[#242424] border border-gray-200 dark:border-[#333] rounded-xl p-4">
              <h4 className="text-sm font-semibold mb-3">This Week</h4>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-[#9ca3af]">Scheduled</span>
                  <span className="font-semibold text-accent">{calendarInterviews.length}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {scheduleModalOpen && (
        <ScheduleMeetingModal
          onCancel={() => setScheduleModalOpen(false)}
          onScheduled={async (info) => {
            setScheduleModalOpen(false);
            await fetchInterviews();
            const emailNote = info.emailSent ? ' · candidate emailed' : '';
            showToast(
              `${info.candidateName} scheduled for ${info.date} at ${info.time}${emailNote}`,
              4000,
            );
          }}
        />
      )}
    </div>
  );
}

// ── Week View ──────────────────────────────────────────────────────────────

function WeekView({
  weekDates,
  today,
  calendarInterviews,
  onInterviewClick,
  selectedInterview,
  popupPos,
  popupRef,
  onClosePopup,
  onDelete,
  actionLoading,
}: {
  weekDates: Date[];
  today: Date;
  calendarInterviews: CalendarInterview[];
  onInterviewClick: (i: CalendarInterview, e: React.MouseEvent) => void;
  selectedInterview: CalendarInterview | null;
  popupPos: { top: number; left: number };
  popupRef: React.RefObject<HTMLDivElement | null>;
  onClosePopup: () => void;
  onDelete: (i: CalendarInterview) => void;
  actionLoading: boolean;
}) {
  return (
    <div className="overflow-x-auto relative">
      <div className="min-w-[700px]">
        {/* Day headers */}
        <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-gray-200 dark:border-[#333]">
          <div className="p-2" />
          {DAY_LABELS.map((label, i) => {
            const date = weekDates[i];
            const isToday = sameYMD(date, today);
            return (
              <div
                key={label}
                className="p-2 text-center border-l border-gray-200 dark:border-[#333]"
              >
                <div
                  className={`text-xs font-medium uppercase tracking-wider ${
                    isToday ? 'text-accent' : 'text-gray-500 dark:text-[#9ca3af]'
                  }`}
                >
                  {label}
                </div>
                <div
                  className={`text-lg font-bold mt-0.5 ${
                    isToday ? 'text-accent' : 'text-gray-900 dark:text-white'
                  }`}
                >
                  {date.getDate()}
                </div>
                {isToday && <div className="w-1.5 h-1.5 bg-accent rounded-full mx-auto mt-1" />}
              </div>
            );
          })}
        </div>

        {/* Time rows */}
        {HOURS.map((hour) => (
          <div
            key={hour}
            className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-gray-200/50 dark:border-[#333333]/50 relative"
            style={{ height: 72 }}
          >
            <div className="p-2 text-xs text-gray-500 dark:text-[#9ca3af] text-right pr-3 pt-1">
              {formatHour(hour)}
            </div>
            {DAY_LABELS.map((_, dayIdx) => {
              const matching = calendarInterviews.filter(
                (s) => s.day === dayIdx && s.hour === hour,
              );
              return (
                <div
                  key={dayIdx}
                  className="border-l border-gray-200/50 dark:border-[#333333]/50 relative px-1 py-0.5"
                >
                  {matching.map((interview, idx) => {
                    // Tile events that share an hour cell side-by-side so
                    // labels don't overlap. Each tile takes 1/N of the width.
                    const widthPct = 100 / matching.length;
                    const leftPct = idx * widthPct;
                    return (
                      <div
                        key={interview.id}
                        onClick={(e) => onInterviewClick(interview, e)}
                        className="absolute top-1 rounded-md px-1.5 py-1 cursor-pointer transition-colors z-10 bg-[#3b82f6]/15 border border-[#3b82f6]/30 hover:bg-[#3b82f6]/25 overflow-hidden flex flex-col"
                        style={{
                          left: `calc(${leftPct}% + 2px)`,
                          width: `calc(${widthPct}% - 4px)`,
                          height: Math.max(38, (interview.duration / 60) * 68),
                        }}
                        title={`${interview.name} — ${interview.type}`}
                      >
                        <div className="text-[11px] font-semibold truncate text-[#3b82f6] leading-tight">
                          {interview.type}
                        </div>
                        <div className="text-[10px] truncate text-[#3b82f6]/70 leading-tight">
                          {interview.name}
                        </div>
                      </div>
                    );
                  })}
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
          className="fixed z-50 w-72 max-h-[calc(100vh-24px)] overflow-y-auto bg-white dark:bg-[#2a2a2a] border border-gray-200 dark:border-[#444] rounded-xl shadow-2xl p-4"
          style={{
            top: popupPos.top,
            left: popupPos.left,
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-bold text-gray-900 dark:text-white">Interview Details</h4>
            <button
              onClick={onClosePopup}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          <div className="space-y-2 mb-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 bg-[#3b82f6]/10 text-[#3b82f6]">
                {selectedInterview.name
                  .split(' ')
                  .map((n) => n[0])
                  .join('')}
              </div>
              <div>
                <div className="text-sm font-semibold text-gray-900 dark:text-white">
                  {selectedInterview.name}
                </div>
                <div className="text-xs text-gray-500 dark:text-[#9ca3af]">
                  {selectedInterview.type}
                </div>
              </div>
            </div>
            <div className="text-xs text-gray-500 dark:text-[#9ca3af] space-y-1 pl-9">
              <div className="flex items-center gap-1.5">
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                {DAY_LABELS[selectedInterview.day]},{' '}
                {weekDates[selectedInterview.day]?.toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })}
              </div>
              <div className="flex items-center gap-1.5">
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                {formatHour(selectedInterview.hour)} - {selectedInterview.duration}min
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => onDelete(selectedInterview)}
              disabled={actionLoading}
              className="flex-1 px-3 py-2 text-xs font-semibold rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors disabled:opacity-50"
            >
              {actionLoading ? 'Deleting…' : 'Delete'}
            </button>
            <Link
              href={`/candidates/${selectedInterview.dbInterview.applicant_id}`}
              className="flex-1 px-3 py-2 text-xs font-semibold rounded-lg bg-accent/10 text-accent hover:bg-accent/20 transition-colors text-center"
            >
              Open profile
            </Link>
            <button
              onClick={onClosePopup}
              disabled={actionLoading}
              className="flex-1 px-3 py-2 text-xs font-semibold rounded-lg bg-gray-100 dark:bg-[#333] text-gray-600 dark:text-[#9ca3af] hover:bg-gray-200 dark:hover:bg-[#444] transition-colors disabled:opacity-50"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Month View ─────────────────────────────────────────────────────────────

function MonthView({
  year,
  month,
  today,
  interviewsByDay,
  onDayClick,
}: {
  year: number;
  month: number;
  today: Date;
  interviewsByDay: Map<number, Interview[]>;
  onDayClick: (day: number) => void;
}) {
  const grid = getMonthGrid(year, month);
  return (
    <div className="p-2">
      <div className="grid grid-cols-7 border-b border-gray-200 dark:border-[#333] mb-1">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
          <div
            key={d}
            className="p-2 text-center text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-[#9ca3af]"
          >
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 auto-rows-fr gap-1">
        {grid.map((day, i) => {
          if (day === null) {
            return (
              <div
                key={i}
                className="min-h-[88px] rounded bg-gray-50/40 dark:bg-[#1a1a1a]/40"
              />
            );
          }
          const dateObj = new Date(year, month, day);
          const isToday = sameYMD(dateObj, today);
          const items = interviewsByDay.get(day) ?? [];
          return (
            <button
              key={i}
              onClick={() => onDayClick(day)}
              className={`text-left min-h-[88px] rounded border p-1.5 transition-colors ${
                isToday
                  ? 'border-accent bg-accent/5'
                  : 'border-gray-200 dark:border-[#333] hover:border-accent/50 hover:bg-gray-50 dark:hover:bg-[#1a1a1a]'
              }`}
            >
              <div
                className={`text-xs font-bold mb-1 ${
                  isToday ? 'text-accent' : 'text-gray-900 dark:text-white'
                }`}
              >
                {day}
              </div>
              <div className="space-y-0.5">
                {items.slice(0, 3).map((iv) => (
                  <div
                    key={iv.id}
                    className="truncate text-[10px] bg-[#3b82f6]/15 text-[#3b82f6] rounded px-1 py-0.5"
                  >
                    {iv.scheduled_time?.slice(0, 5)} {iv.applicant?.name ?? '—'}
                  </div>
                ))}
                {items.length > 3 && (
                  <div className="text-[10px] text-gray-500 dark:text-[#9ca3af] px-1">
                    +{items.length - 3} more
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Agenda View ────────────────────────────────────────────────────────────

function AgendaView({
  items,
  today,
  onDelete,
  actionLoading,
}: {
  items: Interview[];
  today: Date;
  onDelete: (iv: Interview) => Promise<void>;
  actionLoading: boolean;
}) {
  if (items.length === 0) {
    return (
      <div className="p-10 text-center text-sm text-gray-500 dark:text-[#9ca3af]">
        No upcoming interviews from this date forward.
      </div>
    );
  }

  // Group by date.
  const groups = new Map<string, Interview[]>();
  for (const iv of items) {
    const list = groups.get(iv.scheduled_date) ?? [];
    list.push(iv);
    groups.set(iv.scheduled_date, list);
  }

  return (
    <div className="divide-y divide-gray-200 dark:divide-[#333]">
      {Array.from(groups.entries()).map(([date, list]) => {
        const d = new Date(date + 'T00:00:00');
        const isToday = sameYMD(d, today);
        const dateLabel = d.toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'short',
          day: 'numeric',
          year: d.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
        });
        return (
          <div key={date} className="px-5 py-4">
            <div className="flex items-center gap-2 mb-3">
              <h4
                className={`text-sm font-bold ${
                  isToday ? 'text-accent' : 'text-gray-900 dark:text-white'
                }`}
              >
                {dateLabel}
              </h4>
              {isToday && (
                <span className="text-[10px] font-semibold uppercase tracking-wider text-accent bg-accent/10 px-1.5 py-0.5 rounded">
                  Today
                </span>
              )}
            </div>
            <div className="space-y-2">
              {list.map((iv) => (
                <div
                  key={iv.id}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg bg-gray-50 dark:bg-[#1a1a1a] border border-gray-200 dark:border-[#333]"
                >
                  <div className="text-xs font-mono text-gray-500 dark:text-[#9ca3af] w-14 shrink-0">
                    {iv.scheduled_time?.slice(0, 5)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {iv.applicant?.name ?? 'Unknown'}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-[#9ca3af] truncate">
                      {iv.type} · {iv.duration_minutes}min
                    </div>
                  </div>
                  <Link
                    href={`/candidates/${iv.applicant_id}`}
                    className="text-xs px-2.5 py-1 rounded-md bg-accent/10 text-accent hover:bg-accent/20 transition-colors"
                  >
                    Open
                  </Link>
                  <button
                    onClick={() => onDelete(iv)}
                    disabled={actionLoading}
                    className="text-xs px-2.5 py-1 rounded-md bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors disabled:opacity-50"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Schedule Meeting Modal ─────────────────────────────────────────────────

function ScheduleMeetingModal({
  onCancel,
  onScheduled,
}: {
  onCancel: () => void;
  onScheduled: (info: {
    candidateName: string;
    date: string;
    time: string;
    emailSent: boolean;
  }) => void;
}) {
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [search, setSearch] = useState('');
  const [applicantId, setApplicantId] = useState('');
  const [date, setDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  });
  const [time, setTime] = useState('14:00');
  const [type, setType] = useState('Phone Screen');
  const [duration, setDuration] = useState(60);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getApplicants().then((data) => {
      // Hide terminal-state candidates from the picker.
      setApplicants(
        data.filter((a) => !['rejected', 'archived', 'withdrawn', 'hired'].includes(a.status)),
      );
    });
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return applicants.slice(0, 20);
    return applicants
      .filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.email.toLowerCase().includes(q) ||
          a.job_title?.toLowerCase().includes(q),
      )
      .slice(0, 20);
  }, [applicants, search]);

  const selected = applicants.find((a) => a.id === applicantId) ?? null;

  async function handleSubmit() {
    if (!applicantId) {
      setError('Pick a candidate first');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const result = await insertInterview({
        applicant_id: applicantId,
        scheduled_date: date,
        scheduled_time: time,
        duration_minutes: duration,
        type,
      });
      // Move candidate to phone_screen if they were earlier in the pipeline.
      if (selected && ['new', 'screening', 'screened'].includes(selected.status)) {
        await updateApplicantStatus(applicantId, 'phone_screen');
      }
      onScheduled({
        candidateName: selected?.name ?? 'Candidate',
        date,
        time,
        emailSent: result.email_sent,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to schedule');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#242424] border border-gray-200 dark:border-[#333] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-[#333] flex items-center justify-between">
          <h2 className="text-base font-bold">Schedule Meeting</h2>
          <button
            onClick={onCancel}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {error && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-3 text-xs text-red-500">
              {error}
            </div>
          )}

          {/* Candidate picker */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-[#9ca3af] uppercase tracking-wider mb-1.5">
              Candidate
            </label>
            {selected ? (
              <div className="flex items-center gap-3 bg-gray-50 dark:bg-[#1a1a1a] border border-gray-200 dark:border-[#333] rounded-lg px-3 py-2">
                <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-accent text-xs font-bold">
                  {selected.name
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .toUpperCase()
                    .slice(0, 2)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{selected.name}</div>
                  <div className="text-xs text-gray-500 dark:text-[#9ca3af] truncate">
                    {selected.email}
                  </div>
                </div>
                <button
                  onClick={() => setApplicantId('')}
                  className="text-xs text-gray-500 dark:text-[#9ca3af] hover:text-gray-900 dark:hover:text-white"
                >
                  Change
                </button>
              </div>
            ) : (
              <>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name, email, or current role…"
                  className="w-full bg-gray-50 dark:bg-[#1a1a1a] border border-gray-200 dark:border-[#333] rounded-lg px-3 py-2 text-base md:text-sm outline-none focus:border-accent transition-colors"
                />
                <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-gray-200 dark:border-[#333] divide-y divide-gray-200 dark:divide-[#333]">
                  {filtered.length === 0 ? (
                    <div className="px-3 py-6 text-center text-xs text-gray-500 dark:text-[#9ca3af]">
                      No candidates match.
                    </div>
                  ) : (
                    filtered.map((a) => (
                      <button
                        key={a.id}
                        onClick={() => setApplicantId(a.id)}
                        className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-[#1a1a1a] transition-colors"
                      >
                        <div className="text-sm font-medium truncate">{a.name}</div>
                        <div className="text-xs text-gray-500 dark:text-[#9ca3af] truncate">
                          {a.email} · {a.job_title || '—'}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-[#9ca3af] uppercase tracking-wider mb-1.5">
                Date
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-gray-50 dark:bg-[#1a1a1a] border border-gray-200 dark:border-[#333] rounded-lg px-3 py-2 text-base md:text-sm outline-none focus:border-accent transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-[#9ca3af] uppercase tracking-wider mb-1.5">
                Time
              </label>
              <select
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full bg-gray-50 dark:bg-[#1a1a1a] border border-gray-200 dark:border-[#333] rounded-lg px-3 py-2 text-base md:text-sm outline-none focus:border-accent transition-colors"
              >
                {HOURS.flatMap((h) => [
                  `${String(h).padStart(2, '0')}:00`,
                  `${String(h).padStart(2, '0')}:30`,
                ]).map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-[#9ca3af] uppercase tracking-wider mb-1.5">
                Type
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full bg-gray-50 dark:bg-[#1a1a1a] border border-gray-200 dark:border-[#333] rounded-lg px-3 py-2 text-base md:text-sm outline-none focus:border-accent transition-colors"
              >
                <option>Phone Screen</option>
                <option>Technical Screen</option>
                <option>HR Interview</option>
                <option>Portfolio Review</option>
                <option>Onsite</option>
                <option>Final Round</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-[#9ca3af] uppercase tracking-wider mb-1.5">
                Duration
              </label>
              <select
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="w-full bg-gray-50 dark:bg-[#1a1a1a] border border-gray-200 dark:border-[#333] rounded-lg px-3 py-2 text-base md:text-sm outline-none focus:border-accent transition-colors"
              >
                <option value={15}>15 min</option>
                <option value={30}>30 min</option>
                <option value={45}>45 min</option>
                <option value={60}>60 min</option>
                <option value={90}>90 min</option>
              </select>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-200 dark:border-[#333] flex items-center justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={submitting}
            className="px-5 py-2.5 text-sm font-medium border border-gray-200 dark:border-[#333] rounded-lg hover:bg-gray-100 dark:hover:bg-[#1a1a1a] transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !applicantId}
            className="px-5 py-2.5 text-sm font-bold bg-accent hover:bg-accent-hover disabled:opacity-50 text-white rounded-lg transition-colors"
          >
            {submitting ? 'Scheduling…' : 'Schedule'}
          </button>
        </div>
      </div>
    </div>
  );
}
