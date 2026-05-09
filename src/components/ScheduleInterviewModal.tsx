'use client';

import { useState } from 'react';
import { Applicant } from '@/lib/types';

export interface ScheduleValues {
  date: string;
  time: string;
  type: string;
  durationMinutes: number;
}

const INTERVIEW_TYPES = [
  'Phone Screen',
  'Technical Round',
  'Onsite',
  'Final Round',
  'Hiring Manager',
];

const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120];

export function buildScheduleDefaults(): ScheduleValues {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return {
    date: tomorrow.toISOString().split('T')[0],
    time: '14:00',
    type: 'Technical Round',
    durationMinutes: 60,
  };
}

export default function ScheduleInterviewModal({
  applicant,
  defaults,
  onCancel,
  onConfirm,
}: {
  applicant: Pick<Applicant, 'id' | 'name'>;
  defaults: ScheduleValues;
  onCancel: () => void;
  onConfirm: (values: ScheduleValues) => Promise<void> | void;
}) {
  const [date, setDate] = useState(defaults.date);
  const [time, setTime] = useState(defaults.time);
  const [type, setType] = useState(defaults.type);
  const [durationMinutes, setDurationMinutes] = useState(defaults.durationMinutes);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = new Date().toISOString().split('T')[0];
  const isPast = date < today;

  async function handleSubmit() {
    if (!date || !time) {
      setError('Pick a date and time.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onConfirm({ date, time, type, durationMinutes });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to schedule.');
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-card-border rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-card-border flex items-center justify-between">
          <h2 className="text-base font-bold">Schedule Interview</h2>
          <button onClick={onCancel} className="p-1 text-muted hover:text-foreground transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="px-6 py-5 space-y-4 text-sm">
          <div>
            <span className="text-muted text-xs">Candidate</span>
            <div className="font-medium">{applicant.name}</div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-muted mb-1">Date</label>
              <input
                type="date"
                value={date}
                min={today}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-background border border-card-border rounded-lg px-3 py-2 text-base md:text-sm outline-none focus:border-accent transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">Time</label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full bg-background border border-card-border rounded-lg px-3 py-2 text-base md:text-sm outline-none focus:border-accent transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full bg-background border border-card-border rounded-lg px-3 py-2 text-base md:text-sm outline-none focus:border-accent transition-colors"
              >
                {INTERVIEW_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">Duration</label>
              <select
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
                className="w-full bg-background border border-card-border rounded-lg px-3 py-2 text-base md:text-sm outline-none focus:border-accent transition-colors"
              >
                {DURATION_OPTIONS.map((d) => (
                  <option key={d} value={d}>{d} min</option>
                ))}
              </select>
            </div>
          </div>
          {isPast && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-500">
              Heads up: this date is in the past.
            </div>
          )}
          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-500">
              {error}
            </div>
          )}
          <div className="rounded-lg border border-card-border bg-background/40 px-3 py-2 text-xs text-muted">
            {isPast ? (
              <>
                Recording a past interview — the candidate will <strong>not</strong> be emailed.
              </>
            ) : (
              <>
                Use this when you&apos;ve already agreed a slot. The candidate will receive a confirmation email with the time and details. To let them pick instead, send a booking link.
              </>
            )}
          </div>
        </div>
        <div className="px-6 py-4 border-t border-card-border flex items-center justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={submitting}
            className="px-5 py-2.5 text-sm font-medium border border-card-border rounded-lg hover:bg-background transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="px-5 py-2.5 text-sm font-bold bg-accent hover:bg-accent-hover disabled:opacity-50 text-white rounded-lg transition-colors"
          >
            {submitting ? 'Scheduling…' : 'Schedule Interview'}
          </button>
        </div>
      </div>
    </div>
  );
}
