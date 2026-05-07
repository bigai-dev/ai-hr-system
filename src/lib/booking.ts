// Pure helpers for the booking flow.
//
// All slot generation runs in BOOKING_TIMEZONE (Asia/Kuala_Lumpur by default).
// We do the IANA math explicitly via Intl APIs so this works regardless of the
// host process's TZ — Vercel functions default to UTC, and setting `TZ` via
// .env.local does not affect Date operations because Node reads TZ at process
// start. To override, set `BOOKING_TIMEZONE` as a real env var (Vercel project
// env, or `BOOKING_TIMEZONE=… npm run dev` locally).
//
// Storage convention going forward: scheduled_date + scheduled_time on the
// `interviews` table represent wall-clock time in BOOKING_TIMEZONE.

export const BOOKING_TIMEZONE = process.env.BOOKING_TIMEZONE || 'Asia/Kuala_Lumpur';

export const BOOKING_DEFAULTS = {
  workingDays: [1, 2, 3, 4, 5] as number[], // 0=Sun, 1=Mon, … 6=Sat (in target TZ)
  startHour: 9,
  endHour: 17,
  slotIntervalMinutes: 30,
  bufferHoursFromNow: 24,
  lookaheadDays: 14,
  timezone: BOOKING_TIMEZONE,
};

export interface BookedRange {
  start: Date;
  end: Date;
}

export interface SlotGenerationInput {
  durationMinutes: number;
  bookedRanges: BookedRange[];
  now: Date;
  expiresAt: Date;
  workingDays?: number[];
  startHour?: number;
  endHour?: number;
  slotIntervalMinutes?: number;
  bufferHoursFromNow?: number;
  lookaheadDays?: number;
  timezone?: string;
}

export interface Slot {
  startISO: string;
  endISO: string;
}

// ── IANA timezone helpers (no library — Intl APIs only) ───────────────────

/** Returns the offset in minutes (e.g. 480 for MYT) at the given instant in tz. */
export function getOffsetMinutes(tz: string, atDate: Date): number {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    timeZoneName: 'longOffset',
  });
  const part = fmt.formatToParts(atDate).find((p) => p.type === 'timeZoneName');
  if (!part) return 0;
  // "GMT+08:00" or "GMT-05:00" or "GMT" (zero offset)
  const m = part.value.match(/GMT([+-])(\d{2}):(\d{2})/);
  if (!m) return 0;
  const sign = m[1] === '+' ? 1 : -1;
  return sign * (parseInt(m[2], 10) * 60 + parseInt(m[3], 10));
}

interface WallClockParts {
  year: number;
  month: number;   // 1-12
  day: number;
  weekday: number; // 0=Sun … 6=Sat
  hour: number;
  minute: number;
}

const WEEKDAY_LOOKUP: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
};

export function getWallClockInTZ(d: Date, tz: string): WallClockParts {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = fmt.formatToParts(d);
  const grab = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  const hourStr = grab('hour');
  return {
    year: parseInt(grab('year'), 10),
    month: parseInt(grab('month'), 10),
    day: parseInt(grab('day'), 10),
    weekday: WEEKDAY_LOOKUP[grab('weekday')] ?? 0,
    hour: hourStr === '24' ? 0 : parseInt(hourStr, 10),
    minute: parseInt(grab('minute'), 10),
  };
}

/**
 * Convert wall-clock time in `tz` (year/month/day/hour/minute) → UTC Date.
 * Two-pass to handle DST transitions correctly (the offset depends on the
 * date itself). Asia/Kuala_Lumpur has no DST so a single pass would suffice,
 * but doing it right means swapping timezones works without code changes.
 */
export function tzWallClockToUTC(
  year: number,
  month: number, // 1-12
  day: number,
  hour: number,
  minute: number,
  tz: string,
): Date {
  // First guess: treat the wall-clock as UTC.
  const guess = new Date(Date.UTC(year, month - 1, day, hour, minute));
  // Compute the offset that applies AT that guess.
  let offsetMinutes = getOffsetMinutes(tz, guess);
  let utc = new Date(guess.getTime() - offsetMinutes * 60_000);
  // Re-check offset at the corrected instant in case we crossed a DST edge.
  const offset2 = getOffsetMinutes(tz, utc);
  if (offset2 !== offsetMinutes) {
    offsetMinutes = offset2;
    utc = new Date(guess.getTime() - offsetMinutes * 60_000);
  }
  return utc;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * Format a UTC Date as { date: 'YYYY-MM-DD', time: 'HH:MM' } in `tz`.
 * Used for storing wall-clock times on the interviews table.
 */
export function formatInTZ(d: Date, tz: string): { date: string; time: string } {
  const wc = getWallClockInTZ(d, tz);
  return {
    date: `${wc.year}-${pad2(wc.month)}-${pad2(wc.day)}`,
    time: `${pad2(wc.hour)}:${pad2(wc.minute)}`,
  };
}

// ── Slot generation ───────────────────────────────────────────────────────

function rangesOverlap(a: BookedRange, b: BookedRange): boolean {
  return a.start < b.end && b.start < a.end;
}

export function generateSlots(input: SlotGenerationInput): Slot[] {
  const cfg = { ...BOOKING_DEFAULTS, ...input };
  const earliestBookable = new Date(cfg.now.getTime() + cfg.bufferHoursFromNow * 3600_000);
  const lookahead = new Date(cfg.now.getTime() + cfg.lookaheadDays * 86_400_000);
  const horizon = cfg.expiresAt < lookahead ? cfg.expiresAt : lookahead;

  const slots: Slot[] = [];

  // Walk by calendar day in the target timezone, starting from "today in tz".
  const startWC = getWallClockInTZ(cfg.now, cfg.timezone);
  let cursorY = startWC.year;
  let cursorM = startWC.month;
  let cursorD = startWC.day;

  // Hard cap iterations to avoid runaway loops if a caller passes a huge horizon.
  const maxDays = Math.max(1, Math.min(60, cfg.lookaheadDays + 2));

  for (let dayOffset = 0; dayOffset < maxDays; dayOffset++) {
    // Compute the UTC instant for midnight of this day in tz, just so we can
    // ask "what weekday is it" reliably and bail if past horizon.
    const dayStartUTC = tzWallClockToUTC(cursorY, cursorM, cursorD, 0, 0, cfg.timezone);
    if (dayStartUTC > horizon) break;

    const weekday = getWallClockInTZ(dayStartUTC, cfg.timezone).weekday;

    if (cfg.workingDays.includes(weekday)) {
      for (
        let mins = cfg.startHour * 60;
        mins + cfg.durationMinutes <= cfg.endHour * 60;
        mins += cfg.slotIntervalMinutes
      ) {
        const slotHour = Math.floor(mins / 60);
        const slotMin = mins % 60;
        const start = tzWallClockToUTC(
          cursorY,
          cursorM,
          cursorD,
          slotHour,
          slotMin,
          cfg.timezone,
        );
        const end = new Date(start.getTime() + cfg.durationMinutes * 60_000);

        if (start < earliestBookable) continue;
        if (end > horizon) continue;

        const conflict = cfg.bookedRanges.some((r) => rangesOverlap(r, { start, end }));
        if (conflict) continue;

        slots.push({ startISO: start.toISOString(), endISO: end.toISOString() });
      }
    }

    // Advance one day in the target tz (handle month/year rollover via Date math).
    const next = new Date(Date.UTC(cursorY, cursorM - 1, cursorD + 1));
    cursorY = next.getUTCFullYear();
    cursorM = next.getUTCMonth() + 1;
    cursorD = next.getUTCDate();
  }

  return slots;
}

// ── Tokens ─────────────────────────────────────────────────────────────────

export function bookingLinkURL(token: string, baseUrl: string | undefined): string {
  const base = (baseUrl ?? '').replace(/\/$/, '');
  return `${base}/book/${token}`;
}

export function generateBookingToken(): string {
  const buf = new Uint8Array(24);
  crypto.getRandomValues(buf);
  return btoa(String.fromCharCode(...buf))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}
