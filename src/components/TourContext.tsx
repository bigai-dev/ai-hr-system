'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useRouter } from 'next/navigation';
import { TOUR_STEPS, type TourStep } from '@/lib/tour-steps';
import { seedDemoData, cleanupDemoData } from '@/app/(dashboard)/actions';

type TourValue = {
  isActive: boolean;
  isStarting: boolean;
  stepIndex: number;
  step: TourStep | null;
  totalSteps: number;
  start: () => Promise<void>;
  next: () => void;
  prev: () => void;
  end: () => Promise<void>;
};

const TourContext = createContext<TourValue | null>(null);

export function TourProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [isActive, setIsActive] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [seededCandidateId, setSeededCandidateId] = useState<string | null>(null);

  // Resolve route placeholders against the seeded candidate id. Steps that
  // reference :candidateId before seeding has produced one are left as-is
  // (the tour shouldn't be active in that state anyway).
  const resolveRoute = useCallback(
    (route: string): string => {
      if (!seededCandidateId) return route;
      return route.replace(':candidateId', seededCandidateId);
    },
    [seededCandidateId],
  );

  const navigateForStep = useCallback(
    (idx: number) => {
      const step = TOUR_STEPS[idx];
      if (!step) return;
      router.push(resolveRoute(step.route));
    },
    [router, resolveRoute],
  );

  const start = useCallback(async () => {
    if (isActive || isStarting) return;
    setIsStarting(true);
    try {
      const seed = await seedDemoData();
      // Pick the candidate at index 1 (Daniel Park, 'screened') — they have an
      // ai_match_score, ai_reasoning, and ai_extracted_skills set, which makes
      // the candidate-profile step in the tour visually rich.
      const target = seed.candidateIds[1] ?? seed.candidateIds[0] ?? null;
      setSeededCandidateId(target);
      setStepIndex(0);
      setIsActive(true);
      router.push(TOUR_STEPS[0].route);
    } catch (err) {
      console.error('Tour seed failed', err);
      setIsStarting(false);
      throw err;
    } finally {
      setIsStarting(false);
    }
  }, [isActive, isStarting, router]);

  const end = useCallback(async () => {
    setIsActive(false);
    setStepIndex(0);
    try {
      await cleanupDemoData();
    } catch (err) {
      console.error('Tour cleanup failed', err);
    } finally {
      setSeededCandidateId(null);
    }
  }, []);

  // next/prev compute the target index from current state, then call
  // setStepIndex + router.push as separate side effects in the event handler.
  // Doing the router.push inside a setState updater is a React invariant
  // violation — updaters must be pure, but router.push triggers a setState
  // on the Router component, which throws "Cannot update a component while
  // rendering a different component" in strict mode.
  const next = useCallback(() => {
    const nextIdx = stepIndex + 1;
    if (nextIdx >= TOUR_STEPS.length) {
      void end();
      return;
    }
    const currStep = TOUR_STEPS[stepIndex];
    const nextStep = TOUR_STEPS[nextIdx];
    setStepIndex(nextIdx);
    if (currStep && nextStep && resolveRoute(currStep.route) !== resolveRoute(nextStep.route)) {
      navigateForStep(nextIdx);
    }
  }, [stepIndex, end, navigateForStep, resolveRoute]);

  const prev = useCallback(() => {
    const prevIdx = stepIndex - 1;
    if (prevIdx < 0) return;
    const currStep = TOUR_STEPS[stepIndex];
    const prevStep = TOUR_STEPS[prevIdx];
    setStepIndex(prevIdx);
    if (currStep && prevStep && resolveRoute(currStep.route) !== resolveRoute(prevStep.route)) {
      navigateForStep(prevIdx);
    }
  }, [stepIndex, navigateForStep, resolveRoute]);

  // Esc key ends the tour. Wired at the provider level so it works regardless
  // of which page the user is currently on when they press it.
  const endRef = useRef(end);
  endRef.current = end;
  useEffect(() => {
    if (!isActive) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        void endRef.current();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isActive]);

  const value = useMemo<TourValue>(
    () => ({
      isActive,
      isStarting,
      stepIndex,
      step: isActive ? TOUR_STEPS[stepIndex] ?? null : null,
      totalSteps: TOUR_STEPS.length,
      start,
      next,
      prev,
      end,
    }),
    [isActive, isStarting, stepIndex, start, next, prev, end],
  );

  return <TourContext.Provider value={value}>{children}</TourContext.Provider>;
}

export function useTour(): TourValue {
  const ctx = useContext(TourContext);
  if (!ctx) {
    // Outside the provider (e.g. public /apply, /book) — return a no-op so
    // shared components like TopBar can be reused there safely.
    return {
      isActive: false,
      isStarting: false,
      stepIndex: 0,
      step: null,
      totalSteps: 0,
      start: async () => {},
      next: () => {},
      prev: () => {},
      end: async () => {},
    };
  }
  return ctx;
}
