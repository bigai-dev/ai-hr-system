'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTour } from './TourContext';
import type { TourPlacement } from '@/lib/tour-steps';

type Rect = { top: number; left: number; width: number; height: number };

const SPOTLIGHT_PADDING = 8; // px around the target for breathing room
const TOOLTIP_GAP = 16; // px between target and tooltip
const TOOLTIP_WIDTH = 320;
const TOOLTIP_MAX_HEIGHT_GUESS = 220; // used only for placement decisions

// How long to wait for the target element to mount after a route change
// before falling back to a "centered tooltip, no spotlight" state. The
// kanban does an extra DB round-trip on mount so we err on the generous side.
const TARGET_WAIT_MS = 4000;
const POLL_MS = 80;

export default function Tour() {
  const { isActive, step, stepIndex, totalSteps, next, prev, end } = useTour();
  const [targetRect, setTargetRect] = useState<Rect | null>(null);
  const [missing, setMissing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Find the target on every step change + retry until it appears or we
  // give up. Re-runs whenever the step or active state changes.
  useEffect(() => {
    if (!isActive || !step) {
      setTargetRect(null);
      setMissing(false);
      return;
    }

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const startedAt = Date.now();
    setMissing(false);

    const tryFind = () => {
      if (cancelled) return;
      const el = document.querySelector(step.selector) as HTMLElement | null;
      if (el) {
        // Scroll the element into view so the spotlight is visible. 'center'
        // works for both horizontally-scrollable kanban and vertical pages.
        el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
        const rect = el.getBoundingClientRect();
        setTargetRect({
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
        });
        return;
      }
      if (Date.now() - startedAt > TARGET_WAIT_MS) {
        // Target never showed up — render a fallback centered tooltip with
        // no spotlight so the demo doesn't get stuck.
        setMissing(true);
        return;
      }
      timeoutId = setTimeout(tryFind, POLL_MS);
    };

    tryFind();

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [isActive, step]);

  // Reposition on scroll / resize. Capture-phase scroll listener picks up
  // nested scrollable containers (the kanban, modal scroll areas).
  useLayoutEffect(() => {
    if (!isActive || !step || missing) return;

    const reposition = () => {
      const el = document.querySelector(step.selector) as HTMLElement | null;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setTargetRect({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      });
    };

    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => {
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    };
  }, [isActive, step, missing]);

  if (!isActive || !step) return null;

  const isFirst = stepIndex === 0;
  const isLast = stepIndex === totalSteps - 1;

  // Spotlight rectangle, padded for breathing room.
  const spotRect = targetRect
    ? {
        top: targetRect.top - SPOTLIGHT_PADDING,
        left: targetRect.left - SPOTLIGHT_PADDING,
        width: targetRect.width + SPOTLIGHT_PADDING * 2,
        height: targetRect.height + SPOTLIGHT_PADDING * 2,
      }
    : null;

  const tooltipPos = spotRect
    ? computeTooltipPosition(spotRect, step.placement ?? 'auto')
    : centeredTooltip();

  return (
    <div ref={containerRef} className="fixed inset-0 z-[100] pointer-events-none">
      {/* Backdrop with cutout — pointer-events-auto so a stray click on the
          backdrop doesn't fall through to the page underneath. */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-auto"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <mask id="tour-mask">
            <rect width="100%" height="100%" fill="white" />
            {spotRect && (
              <rect
                x={spotRect.left}
                y={spotRect.top}
                width={spotRect.width}
                height={spotRect.height}
                rx="12"
                ry="12"
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="rgba(0, 0, 0, 0.65)"
          mask="url(#tour-mask)"
        />
        {/* Accent ring around the spotlight to direct the eye. */}
        {spotRect && (
          <rect
            x={spotRect.left}
            y={spotRect.top}
            width={spotRect.width}
            height={spotRect.height}
            rx="12"
            ry="12"
            fill="none"
            stroke="#FF6B35"
            strokeWidth="2"
            className="pointer-events-none"
          />
        )}
      </svg>

      {/* Tooltip card */}
      <div
        role="dialog"
        aria-live="polite"
        className="absolute pointer-events-auto bg-card border border-card-border rounded-xl shadow-2xl p-4 w-[320px]"
        style={{ top: tooltipPos.top, left: tooltipPos.left }}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-accent">
            Step {stepIndex + 1} / {totalSteps}
          </span>
          <button
            onClick={() => void end()}
            className="text-xs text-muted hover:text-foreground transition-colors"
            aria-label="Close tour"
          >
            ✕
          </button>
        </div>
        <h3 className="text-sm font-bold mb-1">{step.title}</h3>
        <p className="text-xs text-muted leading-relaxed mb-4">{step.body}</p>
        {missing && (
          <p className="text-[11px] text-amber-500 mb-3">
            Couldn&apos;t find the target on this page — skipping ahead is fine.
          </p>
        )}
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={() => void end()}
            className="text-xs text-muted hover:text-foreground transition-colors"
          >
            Skip tour
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={prev}
              disabled={isFirst}
              className="px-3 py-1.5 text-xs font-medium border border-card-border rounded-md hover:bg-background transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Back
            </button>
            <button
              onClick={next}
              className="px-3 py-1.5 text-xs font-bold bg-accent hover:bg-accent-hover text-white rounded-md transition-colors"
            >
              {isLast ? 'Finish' : 'Next →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Position the tooltip relative to the spotlight rectangle. 'auto' picks the
// side with the most available space; explicit placements try first but fall
// back if there's no room.
function computeTooltipPosition(
  rect: Rect,
  placement: TourPlacement,
): { top: number; left: number } {
  const vw = typeof window === 'undefined' ? 1024 : window.innerWidth;
  const vh = typeof window === 'undefined' ? 768 : window.innerHeight;

  const spaceTop = rect.top;
  const spaceBottom = vh - (rect.top + rect.height);
  const spaceLeft = rect.left;
  const spaceRight = vw - (rect.left + rect.width);

  const fitsBelow = spaceBottom > TOOLTIP_MAX_HEIGHT_GUESS + TOOLTIP_GAP;
  const fitsAbove = spaceTop > TOOLTIP_MAX_HEIGHT_GUESS + TOOLTIP_GAP;
  const fitsRight = spaceRight > TOOLTIP_WIDTH + TOOLTIP_GAP;
  const fitsLeft = spaceLeft > TOOLTIP_WIDTH + TOOLTIP_GAP;

  let chosen: TourPlacement = placement;
  if (chosen === 'auto') {
    if (fitsBelow) chosen = 'bottom';
    else if (fitsAbove) chosen = 'top';
    else if (fitsRight) chosen = 'right';
    else chosen = 'left';
  } else {
    // Honor the explicit placement only if it actually fits; otherwise fall
    // back to the largest available side.
    const fits =
      (chosen === 'top' && fitsAbove) ||
      (chosen === 'bottom' && fitsBelow) ||
      (chosen === 'left' && fitsLeft) ||
      (chosen === 'right' && fitsRight);
    if (!fits) {
      const sides = [
        { side: 'bottom' as const, space: spaceBottom },
        { side: 'top' as const, space: spaceTop },
        { side: 'right' as const, space: spaceRight },
        { side: 'left' as const, space: spaceLeft },
      ];
      sides.sort((a, b) => b.space - a.space);
      chosen = sides[0].side;
    }
  }

  let top = 0;
  let left = 0;
  switch (chosen) {
    case 'top':
      top = rect.top - TOOLTIP_GAP - TOOLTIP_MAX_HEIGHT_GUESS;
      left = rect.left + rect.width / 2 - TOOLTIP_WIDTH / 2;
      break;
    case 'bottom':
      top = rect.top + rect.height + TOOLTIP_GAP;
      left = rect.left + rect.width / 2 - TOOLTIP_WIDTH / 2;
      break;
    case 'left':
      top = rect.top + rect.height / 2 - TOOLTIP_MAX_HEIGHT_GUESS / 2;
      left = rect.left - TOOLTIP_WIDTH - TOOLTIP_GAP;
      break;
    case 'right':
      top = rect.top + rect.height / 2 - TOOLTIP_MAX_HEIGHT_GUESS / 2;
      left = rect.left + rect.width + TOOLTIP_GAP;
      break;
  }

  // Clamp inside viewport so the tooltip never bleeds off-screen.
  const margin = 12;
  left = Math.max(margin, Math.min(left, vw - TOOLTIP_WIDTH - margin));
  top = Math.max(margin, Math.min(top, vh - margin - 80));
  return { top, left };
}

function centeredTooltip(): { top: number; left: number } {
  const vw = typeof window === 'undefined' ? 1024 : window.innerWidth;
  const vh = typeof window === 'undefined' ? 768 : window.innerHeight;
  return {
    top: vh / 2 - TOOLTIP_MAX_HEIGHT_GUESS / 2,
    left: vw / 2 - TOOLTIP_WIDTH / 2,
  };
}
