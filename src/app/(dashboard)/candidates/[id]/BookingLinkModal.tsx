'use client';

import { useState } from 'react';
import { createBookingLink } from '@/app/(dashboard)/actions';

interface Props {
  applicantId: string;
  applicantName: string;
  onClose: () => void;
}

const TYPES = [
  'Phone Screen',
  'Technical Screen',
  'HR Interview',
  'Portfolio Review',
  'Onsite',
  'Final Round',
];

export default function BookingLinkModal({ applicantId, applicantName, onClose }: Props) {
  const [interviewType, setInterviewType] = useState('Phone Screen');
  const [duration, setDuration] = useState(30);
  const [expiresInDays, setExpiresInDays] = useState(7);
  const [generated, setGenerated] = useState<{ token: string; url: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setSubmitting(true);
    setError(null);
    try {
      const link = await createBookingLink({
        applicant_id: applicantId,
        interview_type: interviewType,
        duration_minutes: duration,
        expires_in_days: expiresInDays,
      });
      const url = `${window.location.origin}/book/${link.token}`;
      setGenerated({ token: link.token, url });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate link');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCopy() {
    if (!generated) return;
    try {
      await navigator.clipboard.writeText(generated.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Some browsers may block clipboard access; fall back silently.
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-card-border rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-card-border flex items-center justify-between">
          <h2 className="text-base font-bold">
            {generated ? 'Booking link ready' : `Send booking link to ${applicantName}`}
          </h2>
          <button onClick={onClose} className="p-1 text-muted hover:text-foreground transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {generated ? (
          <div className="px-6 py-5 space-y-4">
            <p className="text-sm text-muted">
              Copy this link and send it to {applicantName} via email, Slack, or however you usually reach them. They'll pick a time and the interview will appear in your scheduling page automatically.
            </p>
            <div className="rounded-lg bg-background border border-card-border p-3 break-all text-xs font-mono">
              {generated.url}
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleCopy}
                className="flex-1 px-4 py-2.5 text-sm font-semibold bg-accent hover:bg-accent-hover text-white rounded-lg transition-colors"
              >
                {copied ? 'Copied' : 'Copy link'}
              </button>
              <a
                href={generated.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 px-4 py-2.5 text-sm font-medium border border-card-border rounded-lg text-center hover:bg-background transition-colors"
              >
                Preview
              </a>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Single-use. Becomes inactive once the candidate books a time, or after the expiry above.
            </p>
          </div>
        ) : (
          <div className="px-6 py-5 space-y-4">
            {error && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-3 text-xs text-red-500">
                {error}
              </div>
            )}

            <p className="text-sm text-muted">
              We'll generate a one-time URL the candidate can open to pick a time within the next 14 days.
            </p>

            <div>
              <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">
                Interview type
              </label>
              <select
                value={interviewType}
                onChange={(e) => setInterviewType(e.target.value)}
                className="w-full bg-background border border-card-border rounded-lg px-3 py-2 text-sm outline-none focus:border-accent transition-colors"
              >
                {TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">
                  Duration
                </label>
                <select
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  className="w-full bg-background border border-card-border rounded-lg px-3 py-2 text-sm outline-none focus:border-accent transition-colors"
                >
                  <option value={15}>15 min</option>
                  <option value={30}>30 min</option>
                  <option value={45}>45 min</option>
                  <option value={60}>60 min</option>
                  <option value={90}>90 min</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">
                  Link expires
                </label>
                <select
                  value={expiresInDays}
                  onChange={(e) => setExpiresInDays(Number(e.target.value))}
                  className="w-full bg-background border border-card-border rounded-lg px-3 py-2 text-sm outline-none focus:border-accent transition-colors"
                >
                  <option value={3}>in 3 days</option>
                  <option value={7}>in 7 days</option>
                  <option value={14}>in 14 days</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {!generated && (
          <div className="px-6 py-4 border-t border-card-border flex items-center justify-end gap-3">
            <button
              onClick={onClose}
              disabled={submitting}
              className="px-5 py-2.5 text-sm font-medium border border-card-border rounded-lg hover:bg-background transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleGenerate}
              disabled={submitting}
              className="px-5 py-2.5 text-sm font-bold bg-accent hover:bg-accent-hover disabled:opacity-50 text-white rounded-lg transition-colors"
            >
              {submitting ? 'Generating…' : 'Generate link'}
            </button>
          </div>
        )}

        {generated && (
          <div className="px-6 py-3 border-t border-card-border flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium border border-card-border rounded-lg hover:bg-background transition-colors"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
