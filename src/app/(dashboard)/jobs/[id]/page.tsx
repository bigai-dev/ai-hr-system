import Link from 'next/link';
import TopBar from '@/components/TopBar';
import { getJob } from '@/app/(dashboard)/actions';
import JobForm from '../JobForm';

export default async function EditJobPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const job = await getJob(id);

  if (!job) {
    return (
      <div className="flex-1">
        <TopBar />
        <div className="p-4 md:p-6 lg:p-8 max-w-3xl">
          <div className="bg-card border border-card-border rounded-2xl p-8 text-center">
            <h1 className="text-xl font-semibold">This job no longer exists</h1>
            <p className="text-sm text-muted mt-2">
              It may have been removed, or it was demo data that was cleaned up when the
              tour ended. Head back to the jobs list to pick another one.
            </p>
            <Link
              href="/jobs"
              className="inline-block mt-6 px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:opacity-90"
            >
              Back to jobs
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1">
      <TopBar />
      <div className="p-4 md:p-6 lg:p-8 max-w-3xl">
        <div className="mb-6">
          <Link href="/jobs" className="text-sm text-muted hover:text-foreground">
            ← Back to jobs
          </Link>
          <h1 className="text-2xl font-semibold mt-2">Edit Job</h1>
          <p className="text-sm text-muted mt-1">
            Updates apply to future screenings. Existing applicants keep their previous scores until rescreened.
          </p>
        </div>
        <div className="bg-card border border-card-border rounded-2xl p-6 md:p-8">
          <JobForm mode={{ kind: 'edit', job }} />
        </div>
      </div>
    </div>
  );
}
