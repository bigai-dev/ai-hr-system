'use client';

import { useState } from 'react';
import { Applicant } from '@/lib/types';
import {
  REJECTION_REASON_LABELS,
  type RejectionReason,
} from '@/lib/email-templates-shared';

export default function RejectReasonModal({
  targets,
  onCancel,
  onConfirm,
}: {
  targets: Pick<Applicant, 'id' | 'name' | 'email'>[];
  onCancel: () => void;
  onConfirm: (reason: RejectionReason, customNote: string) => void;
}) {
  const [reason, setReason] = useState<RejectionReason>('skills_mismatch');
  const [customNote, setCustomNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isBulk = targets.length > 1;
  const reasons = Object.entries(REJECTION_REASON_LABELS) as [
    RejectionReason,
    string,
  ][];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-card-border rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-card-border flex items-center justify-between">
          <h2 className="text-base font-bold">
            Reject {isBulk ? `${targets.length} candidates` : targets[0]?.name ?? 'candidate'}
          </h2>
          <button
            onClick={onCancel}
            className="p-1 text-muted hover:text-foreground transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div className="rounded-lg bg-background border border-card-border p-3 text-xs text-muted">
            A rejection email will be sent to {isBulk ? 'each candidate' : 'the candidate'} using
            the language for the reason category below. The decision and reason are written to the audit log.
          </div>

          {isBulk && (
            <details className="text-xs text-muted">
              <summary className="cursor-pointer hover:text-foreground">
                Show recipients ({targets.length})
              </summary>
              <ul className="mt-2 space-y-0.5 max-h-32 overflow-y-auto">
                {targets.map((t) => (
                  <li key={t.id} className="truncate">
                    {t.name} <span className="text-muted-foreground">· {t.email}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}

          <div>
            <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">
              Reason
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value as RejectionReason)}
              className="w-full bg-background border border-card-border rounded-lg px-3 py-2 text-sm outline-none focus:border-accent transition-colors"
            >
              {reasons.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">
              Optional personal note
            </label>
            <textarea
              value={customNote}
              onChange={(e) => setCustomNote(e.target.value)}
              rows={3}
              maxLength={1000}
              placeholder="Adds a paragraph to the email. Skip if not needed."
              className="w-full bg-background border border-card-border rounded-lg px-3 py-2 text-sm outline-none focus:border-accent transition-colors resize-none"
            />
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
            onClick={() => {
              setSubmitting(true);
              onConfirm(reason, customNote);
            }}
            disabled={submitting}
            className="px-5 py-2.5 text-sm font-bold bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            {submitting
              ? 'Sending…'
              : isBulk
                ? `Reject ${targets.length} & email`
                : 'Reject & email'}
          </button>
        </div>
      </div>
    </div>
  );
}
