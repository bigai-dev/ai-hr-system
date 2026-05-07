'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { createJob, updateJob } from '@/app/(dashboard)/actions';
import type { Job } from '@/lib/types';

type Mode = { kind: 'create' } | { kind: 'edit'; job: Job };

export default function JobForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const initial = mode.kind === 'edit' ? mode.job : null;

  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [status, setStatus] = useState<'active' | 'archived'>(initial?.status ?? 'active');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const input = { title, description, status };
      if (mode.kind === 'create') {
        const { id } = await createJob(input);
        router.push(`/jobs/${id}`);
      } else {
        await updateJob(mode.job.id, input);
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
          <p className="text-red-500 text-sm">{error}</p>
        </div>
      )}

      <div>
        <label htmlFor="title" className="block text-sm font-medium mb-1.5">
          Job Title <span className="text-accent">*</span>
        </label>
        <input
          type="text"
          id="title"
          required
          maxLength={200}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Senior Software Engineer"
          className="w-full bg-card border border-card-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
        />
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium mb-1.5">
          Description &amp; Criteria <span className="text-accent">*</span>
        </label>
        <p className="text-xs text-muted mb-2">
          Free-form prose. Include role overview, requirements, nice-to-haves, tech stack — the AI will use this to score candidates.
          Markdown is fine.
        </p>
        <textarea
          id="description"
          required
          rows={20}
          maxLength={20000}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="## About the Role&#10;...&#10;### Requirements&#10;- ..."
          className="w-full bg-card border border-card-border rounded-lg px-4 py-3 text-sm font-mono focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors resize-vertical"
        />
        <p className="text-xs text-muted mt-1">{description.length} / 20,000 characters</p>
      </div>

      <div>
        <label htmlFor="status" className="block text-sm font-medium mb-1.5">Status</label>
        <select
          id="status"
          value={status}
          onChange={(e) => setStatus(e.target.value as 'active' | 'archived')}
          className="bg-card border border-card-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
        >
          <option value="active">Active (visible on apply form)</option>
          <option value="archived">Archived (hidden from candidates)</option>
        </select>
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={submitting}
          className="bg-accent hover:bg-accent/90 disabled:opacity-50 text-white font-medium py-2.5 px-6 rounded-lg text-sm transition-colors"
        >
          {submitting ? 'Saving…' : mode.kind === 'create' ? 'Create Job' : 'Save Changes'}
        </button>
        <button
          type="button"
          onClick={() => router.push('/jobs')}
          className="border border-card-border hover:bg-card font-medium py-2.5 px-6 rounded-lg text-sm transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
