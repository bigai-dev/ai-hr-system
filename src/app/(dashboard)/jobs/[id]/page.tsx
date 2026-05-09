import Link from 'next/link';
import { notFound } from 'next/navigation';
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
  if (!job) notFound();

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
