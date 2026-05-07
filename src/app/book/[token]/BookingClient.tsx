'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { bookSlot } from './actions';
import type { Slot } from '@/lib/booking';

function groupByDay(slots: Slot[]): { dayLabel: string; dayKey: string; slots: Slot[] }[] {
  const map = new Map<string, Slot[]>();
  for (const s of slots) {
    const date = new Date(s.startISO);
    const key = date.toISOString().slice(0, 10);
    const list = map.get(key) ?? [];
    list.push(s);
    map.set(key, list);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, list]) => {
      const d = new Date(key + 'T00:00:00');
      const dayLabel = d.toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
      });
      return { dayKey: key, dayLabel, slots: list };
    });
}

function formatTimeSlot(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function BookingClient({
  token,
  slots,
  durationMinutes,
  interviewType,
}: {
  token: string;
  slots: Slot[];
  durationMinutes: number;
  interviewType: string;
}) {
  const router = useRouter();
  const [selectedISO, setSelectedISO] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const grouped = useMemo(() => groupByDay(slots), [slots]);

  async function handleConfirm() {
    if (!selectedISO) return;
    setSubmitting(true);
    setError(null);
    const result = await bookSlot(token, selectedISO);
    if (result.ok) {
      // Re-fetch the page so it shows the booked confirmation state.
      router.refresh();
    } else {
      setError(result.error ?? 'Could not book that time. Please try another.');
      setSubmitting(false);
    }
  }

  if (slots.length === 0) {
    return (
      <div className="bg-card border border-card-border rounded-xl p-8 text-center">
        <p className="text-sm text-muted">
          No available times in the next two weeks. Please contact the recruiter who sent you this link to coordinate manually.
        </p>
      </div>
    );
  }

  const tzLabel = Intl.DateTimeFormat(undefined, { timeZoneName: 'short' })
    .formatToParts(new Date())
    .find((p) => p.type === 'timeZoneName')?.value;

  return (
    <div className="bg-card border border-card-border rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-card-border flex items-center justify-between">
        <div className="text-xs text-muted">
          Times shown in your local timezone{tzLabel ? ` (${tzLabel})` : ''}.
        </div>
        <div className="text-xs font-semibold uppercase tracking-wider text-accent">
          {durationMinutes} min · {interviewType}
        </div>
      </div>

      <div className="max-h-[60vh] overflow-y-auto divide-y divide-card-border">
        {grouped.map((group) => (
          <div key={group.dayKey} className="px-5 py-4">
            <div className="text-sm font-semibold mb-3">{group.dayLabel}</div>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
              {group.slots.map((s) => {
                const isSelected = selectedISO === s.startISO;
                return (
                  <button
                    key={s.startISO}
                    onClick={() => setSelectedISO(s.startISO)}
                    className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                      isSelected
                        ? 'bg-accent border-accent text-white font-semibold'
                        : 'bg-background border-card-border text-foreground hover:border-accent/50'
                    }`}
                  >
                    {formatTimeSlot(s.startISO)}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="px-5 py-4 border-t border-card-border flex items-center justify-between gap-3">
        <div className="text-sm text-muted min-w-0 truncate">
          {selectedISO ? (
            <>
              <span className="text-muted-foreground">Selected:</span>{' '}
              <span className="font-semibold">
                {new Date(selectedISO).toLocaleString(undefined, {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </span>
            </>
          ) : (
            'Pick a time slot above.'
          )}
        </div>
        <button
          onClick={handleConfirm}
          disabled={!selectedISO || submitting}
          className="px-5 py-2.5 text-sm font-bold bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors shrink-0"
        >
          {submitting ? 'Booking…' : 'Confirm'}
        </button>
      </div>

      {error && (
        <div className="px-5 py-3 border-t border-red-500/30 bg-red-500/5 text-xs text-red-500">
          {error}
        </div>
      )}
    </div>
  );
}
