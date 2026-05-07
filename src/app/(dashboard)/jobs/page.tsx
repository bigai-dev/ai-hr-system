'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import TopBar from '@/components/TopBar';
import { listJobs, setJobStatus } from '@/app/(dashboard)/actions';
import type { Job } from '@/lib/types';

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    refresh();
  }, []);

  async function refresh() {
    setLoading(true);
    const data = await listJobs();
    setJobs(data);
    setLoading(false);
  }

  async function toggleStatus(job: Job) {
    const next = job.status === 'active' ? 'archived' : 'active';
    await setJobStatus(job.id, next);
    refresh();
  }

  return (
    <div className="flex-1">
      <TopBar />
      <div className="p-6 md:p-8 max-w-5xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold">Jobs</h1>
            <p className="text-sm text-muted mt-1">
              Open roles candidates can apply to. Only active jobs appear on the apply form.
            </p>
          </div>
          <Link
            href="/jobs/new"
            className="bg-accent hover:bg-accent/90 text-white font-medium py-2.5 px-5 rounded-lg text-sm transition-colors"
          >
            + New Job
          </Link>
        </div>

        {loading ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : jobs.length === 0 ? (
          <div className="bg-card border border-card-border rounded-2xl p-10 text-center">
            <p className="text-muted text-sm">No jobs yet. Create one to start receiving applications.</p>
          </div>
        ) : (
          <div className="bg-card border border-card-border rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-sidebar/50">
                <tr className="text-left text-xs uppercase tracking-wider text-muted">
                  <th className="px-5 py-3 font-medium">Title</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Created</th>
                  <th className="px-5 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-card-border">
                {jobs.map((job) => (
                  <tr key={job.id} className="hover:bg-sidebar/30 transition-colors">
                    <td className="px-5 py-4">
                      <Link href={`/jobs/${job.id}`} className="font-medium hover:text-accent">
                        {job.title}
                      </Link>
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          job.status === 'active'
                            ? 'bg-green-500/10 text-green-500'
                            : 'bg-muted/10 text-muted'
                        }`}
                      >
                        {job.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-muted">
                      {new Date(job.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-4 text-right space-x-3">
                      <Link href={`/jobs/${job.id}`} className="text-accent hover:underline text-xs font-medium">
                        Edit
                      </Link>
                      <button
                        onClick={() => toggleStatus(job)}
                        className="text-muted hover:text-foreground text-xs font-medium"
                      >
                        {job.status === 'active' ? 'Archive' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
