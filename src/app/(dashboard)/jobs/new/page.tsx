import Link from 'next/link';
import TopBar from '@/components/TopBar';
import JobForm from '../JobForm';

export default function NewJobPage() {
  return (
    <div className="flex-1">
      <TopBar />
      <div className="p-6 md:p-8 max-w-3xl">
        <div className="mb-6">
          <Link href="/jobs" className="text-sm text-muted hover:text-foreground">
            ← Back to jobs
          </Link>
          <h1 className="text-2xl font-semibold mt-2">New Job</h1>
          <p className="text-sm text-muted mt-1">
            Create a new role candidates can apply to. The description below is what the AI uses to score applicants.
          </p>
        </div>
        <div className="bg-card border border-card-border rounded-2xl p-6 md:p-8">
          <JobForm mode={{ kind: 'create' }} />
        </div>
      </div>
    </div>
  );
}
