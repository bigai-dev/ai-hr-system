'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import TopBar from '@/components/TopBar';
import { getEmailTemplate, updateEmailTemplate } from '@/app/(dashboard)/actions';
import {
  EDITABLE_TEMPLATES,
  substituteVariables,
  type EditableTemplateId,
} from '@/lib/email-templates-shared';

// Sample values used to render the live preview. They mirror what the system
// would substitute at send time, so what you see is exactly what candidates get.
const SAMPLE_VALUES: Record<string, string | number> = {
  Candidate_Name: 'Alex Tan',
  Job_Title: 'Senior Product Designer',
  Company_Name: 'Recruit.AI',
  Rejection_Reason:
    'After reviewing your background against the role requirements, we have decided to move forward with candidates whose experience aligns more closely with the specific skills the team is looking for.',
  Custom_Note: '',
  Interview_Type: 'Phone Screen',
  Interview_Type_Lower: 'phone screen',
  When: 'Monday, May 12, 2026, 9:00 AM GMT+8',
  Duration_Minutes: 30,
};

function HighlightedText({ text }: { text: string }) {
  // Split into runs of literal text and {Variable} placeholders for visual emphasis.
  const parts = text.split(/(\{[A-Za-z_][A-Za-z0-9_]*\})/g);
  return (
    <>
      {parts.map((part, i) => {
        const m = part.match(/^\{([A-Za-z_][A-Za-z0-9_]*)\}$/);
        if (m && m[1] in SAMPLE_VALUES) {
          return (
            <span
              key={i}
              className="text-accent font-semibold bg-accent/10 px-0.5 rounded"
            >
              {String(SAMPLE_VALUES[m[1]])}
            </span>
          );
        }
        if (m) {
          return (
            <span
              key={i}
              className="text-red-500 bg-red-500/10 px-0.5 rounded"
              title="Unknown variable — will pass through to the email as-is"
            >
              {part}
            </span>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

export default function EmailTemplatePage() {
  const [selectedId, setSelectedId] = useState<EditableTemplateId>('application_acknowledgement');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [original, setOriginal] = useState<{ subject: string; body: string }>({
    subject: '',
    body: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedTick, setSavedTick] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const meta = EDITABLE_TEMPLATES.find((t) => t.id === selectedId)!;
  const dirty = subject !== original.subject || body !== original.body;

  const fetchTemplate = useCallback(async (id: EditableTemplateId) => {
    setLoading(true);
    setError(null);
    try {
      const tpl = await getEmailTemplate(id);
      setSubject(tpl.subject);
      setBody(tpl.body);
      setOriginal({ subject: tpl.subject, body: tpl.body });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load template');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplate(selectedId);
  }, [selectedId, fetchTemplate]);

  function selectTemplate(id: EditableTemplateId) {
    if (dirty && !confirm('You have unsaved changes. Discard?')) return;
    setSelectedId(id);
  }

  function insertVariable(name: string) {
    const ta = textareaRef.current;
    const placeholder = `{${name}}`;
    if (!ta) {
      setBody((prev) => prev + placeholder);
      return;
    }
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const next = body.substring(0, start) + placeholder + body.substring(end);
    setBody(next);
    setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(start + placeholder.length, start + placeholder.length);
    }, 0);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await updateEmailTemplate(selectedId, subject, body);
      setOriginal({ subject, body });
      setSavedTick(true);
      setTimeout(() => setSavedTick(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  function handleRevert() {
    if (!dirty) return;
    if (!confirm('Discard unsaved changes?')) return;
    setSubject(original.subject);
    setBody(original.body);
  }

  return (
    <div className="flex flex-col min-h-screen">
      <TopBar title="Email Templates" />
      <div className="flex-1 p-6">
        <div className="text-xs text-muted mb-1">
          <Link href="/settings" className="hover:text-foreground transition-colors">
            ← All settings
          </Link>
        </div>
        <h2 className="text-xl font-bold mb-1">Email templates</h2>
        <p className="text-sm text-muted mb-6">
          Edit the copy the system uses for candidate-facing auto-emails. Subject and body support
          <code className="bg-card px-1.5 py-0.5 mx-1 rounded text-[11px]">{`{Variable_Name}`}</code>
          placeholders that get substituted at send time. Changes apply immediately to all future emails.
        </p>

        {/* Template tabs */}
        <div className="flex gap-2 mb-5 border-b border-card-border">
          {EDITABLE_TEMPLATES.map((t) => (
            <button
              key={t.id}
              onClick={() => selectTemplate(t.id)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                selectedId === t.id
                  ? 'border-accent text-accent'
                  : 'border-transparent text-muted hover:text-foreground'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <p className="text-xs text-muted mb-4">{meta.description}</p>

        {error && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-3 text-xs text-red-500 mb-4">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-10">
            <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_480px] gap-6">
            {/* Editor */}
            <div className="space-y-5">
              {/* Subject */}
              <div>
                <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">
                  Subject
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  maxLength={300}
                  className="w-full bg-background border border-card-border rounded-lg px-3 py-2.5 text-sm outline-none focus:border-accent transition-colors"
                />
              </div>

              {/* Variables */}
              <div>
                <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-2">
                  Variables (click to insert into body)
                </label>
                <div className="flex flex-wrap gap-2">
                  {meta.variables.map((v) => (
                    <button
                      key={v.name}
                      onClick={() => insertVariable(v.name)}
                      title={v.description}
                      className="bg-accent/10 text-accent border border-accent/30 px-2.5 py-1 rounded-full text-xs font-mono hover:bg-accent/20 transition-colors"
                    >
                      {`{${v.name}}`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Body */}
              <div>
                <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">
                  Body
                </label>
                <textarea
                  ref={textareaRef}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={16}
                  maxLength={10_000}
                  className="w-full bg-background border border-card-border rounded-lg px-3 py-2.5 text-sm outline-none focus:border-accent transition-colors font-mono leading-relaxed resize-y"
                />
                <p className="text-[11px] text-muted mt-1">
                  Plain text. Newlines are preserved.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={handleSave}
                  disabled={saving || !dirty}
                  className="px-5 py-2.5 text-sm font-bold bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                >
                  {saving ? 'Saving…' : 'Save changes'}
                </button>
                <button
                  onClick={handleRevert}
                  disabled={!dirty || saving}
                  className="px-4 py-2.5 text-sm font-medium border border-card-border rounded-lg hover:bg-background transition-colors disabled:opacity-50"
                >
                  Discard
                </button>
                {savedTick && (
                  <span className="text-xs text-success font-semibold">✓ Saved</span>
                )}
                {dirty && !savedTick && (
                  <span className="text-xs text-muted">Unsaved changes</span>
                )}
              </div>
            </div>

            {/* Preview */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 bg-success rounded-full animate-pulse" />
                <span className="text-xs font-semibold text-muted uppercase tracking-wider">
                  Live preview · sample values
                </span>
              </div>
              <div className="bg-card border border-card-border rounded-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-card-border">
                  <div className="text-[10px] text-muted uppercase tracking-wider mb-1">Subject</div>
                  <div className="text-sm font-semibold leading-snug">
                    <HighlightedText text={subject} />
                  </div>
                </div>
                <div className="px-5 py-4 max-h-[480px] overflow-y-auto">
                  <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed">
                    <HighlightedText text={body} />
                  </pre>
                </div>
                <div className="px-5 py-2 border-t border-card-border text-[10px] text-muted">
                  Rendered with: {Object.keys(SAMPLE_VALUES)
                    .filter((k) => meta.variables.some((v) => v.name === k))
                    .map((k) =>
                      typeof SAMPLE_VALUES[k] === 'string' && (SAMPLE_VALUES[k] as string).length > 30
                        ? `${k}=…`
                        : `${k}=${SAMPLE_VALUES[k] || '∅'}`,
                    )
                    .join(' · ')}
                </div>
              </div>
              <p className="text-[11px] text-muted mt-3">
                Final body sent to candidates uses {' '}
                <code className="bg-card px-1 py-0.5 rounded">substituteVariables()</code>; unknown
                placeholders are left literal so misconfigurations are visible.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
