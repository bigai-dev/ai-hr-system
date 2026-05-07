import Link from 'next/link';

export const metadata = {
  title: 'Privacy & Data Handling — RECRUIT.AI',
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-50 px-4 py-12">
      <div className="mx-auto max-w-2xl bg-white rounded-2xl border border-gray-200 p-8 md:p-10 text-gray-800">
        <h1 className="text-2xl font-bold text-gray-900">Privacy & Data Handling</h1>
        <p className="mt-3 text-sm text-gray-500">
          Last updated: 2026-05-06
        </p>

        <section className="mt-8 space-y-3">
          <h2 className="text-lg font-semibold text-gray-900">What we collect</h2>
          <p className="text-sm leading-relaxed">
            When you submit an application via{' '}
            <Link href="/apply" className="text-accent hover:underline">
              /apply
            </Link>
            , we collect: your name, email, phone, current job title, years of
            experience, the cover letter you write, and the PDF resume you
            upload.
          </p>
        </section>

        <section className="mt-6 space-y-3">
          <h2 className="text-lg font-semibold text-gray-900">How we use it</h2>
          <p className="text-sm leading-relaxed">
            Your application is read by a generative AI model
            (Anthropic&rsquo;s Claude) to score your fit against the open role.
            The score, a short reasoning summary, and an extracted skill list
            are stored alongside your submission and reviewed by our hiring
            team.
          </p>
        </section>

        <section className="mt-6 space-y-3">
          <h2 className="text-lg font-semibold text-gray-900">Where it&rsquo;s stored</h2>
          <p className="text-sm leading-relaxed">
            Your data is stored in Turso (a managed SQLite service) and your
            resume PDF is stored in Vercel Blob. Both are private and accessed
            only by our hiring team via an authenticated dashboard.
          </p>
        </section>

        <section className="mt-6 space-y-3">
          <h2 className="text-lg font-semibold text-gray-900">Your rights (GDPR / CCPA)</h2>
          <p className="text-sm leading-relaxed">
            You have the right to request access, correction, or deletion of
            your data at any time. To request deletion, email us with the
            subject line &ldquo;Data deletion request&rdquo; and the email
            address you used to apply. We will permanently remove your record
            and resume PDF within 30 days.
          </p>
        </section>

        <section className="mt-6 space-y-3">
          <h2 className="text-lg font-semibold text-gray-900">Retention</h2>
          <p className="text-sm leading-relaxed">
            We retain rejected applications for up to 12 months for
            anti-discrimination audit purposes, then permanently delete them.
            Hired candidates&rsquo; data is migrated to our HR system per
            employment law.
          </p>
        </section>

        <p className="mt-10 text-center">
          <Link href="/apply" className="text-sm text-accent hover:underline">
            ← Back to application
          </Link>
        </p>
      </div>
    </div>
  );
}
