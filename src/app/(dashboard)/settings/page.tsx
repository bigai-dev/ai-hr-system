import Link from 'next/link';
import TopBar from '@/components/TopBar';

interface SettingCard {
  href: string;
  title: string;
  description: string;
}

const SETTINGS: SettingCard[] = [
  {
    href: '/settings/scheduling',
    title: 'Scheduling',
    description:
      'Booking timezone, working days and hours, slot interval, and lookahead window for self-serve interview booking links.',
  },
  {
    href: '/settings/email-template',
    title: 'Email Template',
    description: 'Edit the templated copy used when contacting candidates.',
  },
  {
    href: '/settings/outgoing-emails',
    title: 'Outgoing Emails',
    description:
      'Inspect every email the system has sent or mocked, with status and full body for each.',
  },
];

export default function SettingsIndexPage() {
  return (
    <div className="min-h-screen">
      <TopBar title="Settings" />
      <div className="p-4 md:p-6 max-w-4xl">
        <p className="text-sm text-muted mb-6">
          Configure how the platform talks to candidates and how interviews get scheduled.
        </p>

        <div data-tour="settings-list" className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {SETTINGS.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className="block bg-card border border-card-border rounded-xl p-5 hover:border-accent/50 hover:bg-background/40 transition-colors"
            >
              <div className="flex items-center gap-2 mb-1.5">
                <h3 className="text-base font-semibold">{s.title}</h3>
                <span className="text-muted text-sm">→</span>
              </div>
              <p className="text-xs text-muted leading-relaxed">{s.description}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
