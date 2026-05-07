import { getBookingContext } from './actions';
import BookingClient from './BookingClient';
import BookedConfirmation from './BookedConfirmation';

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function BookingPage({ params }: PageProps) {
  const { token } = await params;
  const ctx = await getBookingContext(token);

  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        <header className="mb-6">
          <h1 className="text-2xl font-bold">
            {ctx.status === 'available' && 'Pick a time'}
            {ctx.status === 'booked' && 'Interview confirmed'}
            {ctx.status === 'expired' && 'Booking link expired'}
            {ctx.status === 'not_found' && 'Booking link not found'}
          </h1>
          {ctx.applicant_name && ctx.job_title && (
            <p className="text-sm text-muted mt-1">
              {ctx.interview_type} · {ctx.duration_minutes} min · {ctx.applicant_name} for {ctx.job_title}
            </p>
          )}
        </header>

        {ctx.status === 'not_found' && (
          <div className="bg-card border border-card-border rounded-xl p-8 text-center">
            <p className="text-sm text-muted">
              We couldn't find that booking link. It may have been mistyped or revoked. Please contact the recruiter who sent it.
            </p>
          </div>
        )}

        {ctx.status === 'expired' && (
          <div className="bg-card border border-card-border rounded-xl p-8 text-center">
            <p className="text-sm text-muted">
              This booking link has expired. Please reply to the recruiter's email to request a new one.
            </p>
          </div>
        )}

        {ctx.status === 'booked' && ctx.booked_start_iso && (
          <BookedConfirmation
            token={token}
            startISO={ctx.booked_start_iso}
            durationMinutes={ctx.duration_minutes ?? 30}
          />
        )}

        {ctx.status === 'available' && ctx.slots && (
          <BookingClient
            token={token}
            slots={ctx.slots}
            durationMinutes={ctx.duration_minutes ?? 30}
            interviewType={ctx.interview_type ?? 'Interview'}
          />
        )}
      </div>
    </main>
  );
}

