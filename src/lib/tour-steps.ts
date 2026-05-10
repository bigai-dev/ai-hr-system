// Pipeline-first tour narrative. Each step says where to navigate, what to
// highlight, and what to say. Keep copy short — these render as small floating
// cards next to the spotlighted element during a live demo.
//
// `route` may include a `:candidateId` placeholder which TourContext fills with
// a real id from the seed data when the tour starts.

export type TourPlacement = 'top' | 'bottom' | 'left' | 'right' | 'auto';

export type TourStep = {
  id: string;
  route: string;
  selector: string;
  title: string;
  body: string;
  placement?: TourPlacement;
};

export const TOUR_STEPS: TourStep[] = [
  {
    id: 'pipeline-stats',
    route: '/dashboard',
    selector: '[data-tour="pipeline-stats"]',
    title: 'Your hiring pipeline at a glance',
    body: 'Top-line counts of applicants, AI-screened, and currently scheduled. The dashboard is the daily home base.',
    placement: 'bottom',
  },
  {
    id: 'screening-queue',
    route: '/dashboard',
    selector: '[data-tour="screening-queue"]',
    title: 'AI scores every resume',
    body: 'Resumes are matched against the active job description. High-scoring candidates surface here for human review — no manual triage.',
    placement: 'top',
  },
  {
    id: 'kanban-board',
    route: '/candidates',
    selector: '[data-tour="kanban-board"]',
    title: 'Move candidates through stages',
    body: 'Drag cards between columns on desktop, or tap a card and pick a stage on mobile. Stage changes that affect interviews are handled automatically.',
    placement: 'top',
  },
  {
    id: 'candidate-profile',
    route: '/candidates/:candidateId',
    selector: '[data-tour="candidate-header"]',
    title: 'The full candidate profile',
    body: "Resume, AI insights, scorecards, timeline, and internal notes — everything the team needs to make a hire/no-hire call lives on one page.",
    placement: 'bottom',
  },
  {
    id: 'schedule-actions',
    route: '/candidates/:candidateId',
    selector: '[data-tour="schedule-actions"]',
    title: 'Schedule the interview',
    body: 'Send a self-serve booking link or schedule directly. Real Resend emails go out if RESEND_API_KEY is set; otherwise emails are mock-logged for safe demos.',
    placement: 'top',
  },
  {
    id: 'settings',
    route: '/settings',
    selector: '[data-tour="settings-list"]',
    title: 'Tune the platform to your team',
    body: 'Working hours for self-serve booking, email templates, outgoing email logs — everything is configurable here. End of tour!',
    placement: 'right',
  },
];
