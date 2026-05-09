'use client';

import { useEffect, useState } from 'react';
import TopBar from '@/components/TopBar';
import {
  listOutgoingEmails,
  getEmailProviderStatus,
  type OutgoingEmail,
} from '@/app/(dashboard)/actions';

const CATEGORY_LABELS: Record<string, string> = {
  application_acknowledgement: 'Acknowledgement',
  rejection: 'Rejection',
  interview_invite: 'Interview Invite',
  scorecard_reminder: 'Scorecard Reminder',
  weekly_digest: 'Weekly Digest',
  other: 'Other',
};

const STATUS_STYLES: Record<string, string> = {
  sent: 'bg-success/20 text-success',
  mocked: 'bg-amber-500/20 text-amber-500',
  failed: 'bg-red-500/20 text-red-500',
};

function formatTimestamp(iso: string): string {
  // libSQL returns "YYYY-MM-DD HH:MM:SS" — render as a relative + absolute combo.
  const t = new Date(iso.replace(' ', 'T') + 'Z').getTime();
  if (Number.isNaN(t)) return iso;
  const diff = Date.now() - t;
  if (diff < 60_000) return 'Just now';
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

export default function OutgoingEmailsPage() {
  const [emails, setEmails] = useState<OutgoingEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'sent' | 'mocked' | 'failed'>('all');
  const [selected, setSelected] = useState<OutgoingEmail | null>(null);
  const [provider, setProvider] = useState<{ configured: boolean; fromAddress: string | null } | null>(null);

  useEffect(() => {
    fetchEmails();
    getEmailProviderStatus().then(setProvider).catch(() => setProvider(null));
  }, []);

  async function fetchEmails() {
    setLoading(true);
    const data = await listOutgoingEmails(200);
    setEmails(data);
    setLoading(false);
  }

  const filtered = emails.filter((e) =>
    filter === 'all' ? true : e.delivery_status === filter,
  );

  const counts = {
    all: emails.length,
    sent: emails.filter((e) => e.delivery_status === 'sent').length,
    mocked: emails.filter((e) => e.delivery_status === 'mocked').length,
    failed: emails.filter((e) => e.delivery_status === 'failed').length,
  };

  return (
    <div className="min-h-screen">
      <TopBar title="Outgoing Emails" />
      <div className="p-4 md:p-6 space-y-4">
        {provider && !provider.configured && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-xs text-amber-500">
            <strong>Mock-log mode:</strong> RESEND_API_KEY is not set, so no real emails are being sent.
            Records here show what would have gone out. Set RESEND_API_KEY in <code>.env.local</code> to enable real delivery.
          </div>
        )}
        {provider && provider.configured && (
          <div className="bg-success/10 border border-success/30 rounded-lg p-3 text-xs text-success">
            <strong>Live delivery:</strong> Resend is configured. Sending from{' '}
            <code className="font-mono">{provider.fromAddress ?? '(default)'}</code>.
            {counts.mocked > 0 && (
              <> Older <em>mocked</em> rows below were recorded before the key was added.</>
            )}
          </div>
        )}

        {/* Filter pills */}
        <div className="flex gap-1 bg-card border border-card-border rounded-lg p-0.5 w-fit">
          {(['all', 'sent', 'mocked', 'failed'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                filter === f
                  ? 'bg-accent text-white'
                  : 'text-muted hover:text-foreground'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)} <span className="opacity-60">{counts[f]}</span>
            </button>
          ))}
          <button
            onClick={fetchEmails}
            className="px-3 py-1.5 text-xs font-semibold rounded-md text-muted hover:text-foreground transition-colors"
            title="Refresh"
          >
            ↻
          </button>
        </div>

        {/* Two-pane: list + detail */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.3fr] gap-4">
          {/* List */}
          <div className="bg-card border border-card-border rounded-xl overflow-hidden">
            {loading ? (
              <div className="p-10 flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-10 text-center text-sm text-muted">
                {emails.length === 0
                  ? 'No emails sent yet. They will show up here once applications are submitted or candidates are rejected.'
                  : 'No emails match this filter.'}
              </div>
            ) : (
              <ul>
                {filtered.map((e) => (
                  <li
                    key={e.id}
                    onClick={() => setSelected(e)}
                    className={`px-4 py-3 border-b border-card-border last:border-0 cursor-pointer transition-colors ${
                      selected?.id === e.id
                        ? 'bg-accent/5'
                        : 'hover:bg-background/50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${
                          STATUS_STYLES[e.delivery_status] ?? ''
                        }`}
                      >
                        {e.delivery_status}
                      </span>
                      <span className="text-[10px] text-muted">{formatTimestamp(e.created_at)}</span>
                    </div>
                    <div className="text-sm font-medium truncate">{e.subject}</div>
                    <div className="text-xs text-muted truncate flex items-center gap-2">
                      <span>{e.to_email}</span>
                      <span>·</span>
                      <span>{CATEGORY_LABELS[e.category] ?? e.category}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Detail */}
          <div className="bg-card border border-card-border rounded-xl overflow-hidden">
            {selected ? (
              <div className="flex flex-col h-full">
                <div className="px-5 py-4 border-b border-card-border">
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${
                        STATUS_STYLES[selected.delivery_status] ?? ''
                      }`}
                    >
                      {selected.delivery_status}
                    </span>
                    <span className="text-[10px] text-muted uppercase tracking-wider">
                      {CATEGORY_LABELS[selected.category] ?? selected.category}
                    </span>
                  </div>
                  <div className="text-base font-semibold mb-1">{selected.subject}</div>
                  <div className="text-xs text-muted">
                    To: <span className="font-mono">{selected.to_email}</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-1">
                    {selected.created_at} {selected.provider_id && `· id: ${selected.provider_id}`}
                  </div>
                </div>
                {selected.error && (
                  <div className="m-4 rounded-lg bg-red-500/10 border border-red-500/30 p-3 text-xs text-red-500">
                    <strong>Error:</strong> {selected.error}
                  </div>
                )}
                <pre className="px-5 py-4 text-sm whitespace-pre-wrap font-sans leading-relaxed flex-1 overflow-auto">
                  {selected.body}
                </pre>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-muted p-10">
                Pick an email from the list to preview its content.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
