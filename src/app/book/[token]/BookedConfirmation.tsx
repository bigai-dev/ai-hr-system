'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { cancelBooking } from './actions';

export default function BookedConfirmation({
  token,
  startISO,
  durationMinutes,
}: {
  token: string;
  startISO: string;
  durationMinutes: number;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const start = new Date(startISO);

  async function handleReschedule() {
    if (
      !confirm(
        'Cancel this interview and pick a new time? Your previous slot will be released.',
      )
    ) {
      return;
    }
    setSubmitting(true);
    setError(null);
    const result = await cancelBooking(token);
    if (result.ok) {
      // Re-fetch the page so it re-renders in 'available' state with slots.
      router.refresh();
    } else {
      setError(result.error ?? 'Could not cancel the booking.');
      setSubmitting(false);
    }
  }

  return (
    <div className="bg-card border border-card-border rounded-xl p-8">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-success/15 text-success flex items-center justify-center">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div>
          <div className="text-base font-semibold">Confirmed</div>
          <div className="text-xs text-muted">A confirmation email has been sent.</div>
        </div>
      </div>
      <div className="rounded-lg bg-background border border-card-border p-4">
        <div className="text-[10px] text-muted uppercase tracking-wider font-semibold mb-1">
          When
        </div>
        <div className="text-base font-medium">
          {start.toLocaleString(undefined, {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            timeZoneName: 'short',
          })}
        </div>
        <div className="text-xs text-muted mt-2">{durationMinutes} minutes</div>
      </div>

      <div className="mt-6 flex items-center justify-between gap-3">
        <p className="text-xs text-muted">
          Need a different time? You can reschedule using this same link.
        </p>
        <button
          onClick={handleReschedule}
          disabled={submitting}
          className="px-4 py-2 text-sm font-semibold border border-card-border rounded-lg hover:border-accent hover:text-accent transition-colors disabled:opacity-50 shrink-0"
        >
          {submitting ? 'Cancelling…' : 'Reschedule'}
        </button>
      </div>

      {error && (
        <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-500">
          {error}
        </div>
      )}
    </div>
  );
}
