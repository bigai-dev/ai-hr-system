'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { createJob, updateJob } from '@/app/(dashboard)/actions';
import type { Job } from '@/lib/types';

type Mode = { kind: 'create' } | { kind: 'edit'; job: Job };

function SkillsField({
  id,
  label,
  value,
  onChange,
  placeholder,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  hint: string;
}) {
  const chips = value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium mb-1.5">
        {label}
      </label>
      <input
        id={id}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-card border border-card-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
      />
      <p className="text-xs text-muted mt-1">{hint}</p>
      {chips.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {chips.map((skill, i) => (
            <span
              key={`${skill}-${i}`}
              className="inline-flex items-center px-2.5 py-1 rounded-full text-xs bg-accent/10 text-accent border border-accent/20"
            >
              {skill}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function JobForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const initial = mode.kind === 'edit' ? mode.job : null;

  const [title, setTitle] = useState(initial?.title ?? '');
  const [summary, setSummary] = useState(initial?.summary ?? '');
  const [responsibilities, setResponsibilities] = useState(initial?.responsibilities ?? '');
  const [requiredSkills, setRequiredSkills] = useState(initial?.required_skills ?? '');
  const [niceToHaveSkills, setNiceToHaveSkills] = useState(initial?.nice_to_have_skills ?? '');
  const [minYears, setMinYears] = useState(String(initial?.min_years_experience ?? 0));
  const [additionalNotes, setAdditionalNotes] = useState(initial?.additional_notes ?? '');
  const [status, setStatus] = useState<'active' | 'archived'>(initial?.status ?? 'active');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const input = {
        title,
        summary,
        responsibilities,
        required_skills: requiredSkills,
        nice_to_have_skills: niceToHaveSkills,
        min_years_experience: Number(minYears) || 0,
        additional_notes: additionalNotes,
        status,
      };
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
    <form onSubmit={handleSubmit} className="space-y-6">
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
        <label htmlFor="summary" className="block text-sm font-medium mb-1.5">
          Role Summary <span className="text-accent">*</span>
        </label>
        <textarea
          id="summary"
          required
          rows={3}
          maxLength={2000}
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          placeholder="One or two sentences about the role: what the team does, location, type of work."
          className="w-full bg-card border border-card-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors resize-vertical"
        />
      </div>

      <div>
        <label htmlFor="responsibilities" className="block text-sm font-medium mb-1.5">
          Responsibilities
        </label>
        <textarea
          id="responsibilities"
          rows={6}
          maxLength={4000}
          value={responsibilities}
          onChange={(e) => setResponsibilities(e.target.value)}
          placeholder={'- Build and ship features on the platform\n- Design and own backend services\n- Collaborate with product and design'}
          className="w-full bg-card border border-card-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors resize-vertical"
        />
        <p className="text-xs text-muted mt-1">One per line. Bullet points (- ) optional.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <SkillsField
          id="required_skills"
          label="Required Skills"
          value={requiredSkills}
          onChange={setRequiredSkills}
          placeholder="React, TypeScript, Node.js, PostgreSQL"
          hint="Comma-separated. These are must-haves."
        />
        <SkillsField
          id="nice_to_have_skills"
          label="Nice-to-Have Skills"
          value={niceToHaveSkills}
          onChange={setNiceToHaveSkills}
          placeholder="Python, GraphQL, AWS, Docker"
          hint="Comma-separated. Bonus, not required."
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div>
          <label htmlFor="min_years_experience" className="block text-sm font-medium mb-1.5">
            Minimum Years of Experience
          </label>
          <input
            type="number"
            id="min_years_experience"
            min={0}
            max={60}
            value={minYears}
            onChange={(e) => setMinYears(e.target.value)}
            className="w-full bg-card border border-card-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
          />
        </div>
        <div>
          <label htmlFor="status" className="block text-sm font-medium mb-1.5">Status</label>
          <select
            id="status"
            value={status}
            onChange={(e) => setStatus(e.target.value as 'active' | 'archived')}
            className="w-full bg-card border border-card-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
          >
            <option value="active">Active (visible on apply form)</option>
            <option value="archived">Archived (hidden from candidates)</option>
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="additional_notes" className="block text-sm font-medium mb-1.5">
          Additional Notes <span className="text-muted text-xs">(optional)</span>
        </label>
        <textarea
          id="additional_notes"
          rows={4}
          maxLength={4000}
          value={additionalNotes}
          onChange={(e) => setAdditionalNotes(e.target.value)}
          placeholder="Anything else the AI should know — tech stack details, team culture, deal-breakers, etc."
          className="w-full bg-card border border-card-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors resize-vertical"
        />
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
