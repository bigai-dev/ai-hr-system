// Read/write the org-wide scheduling configuration.
//
// Single global row keyed by id='default'. The migration seeds it; this
// module never inserts a fresh row. If the row is missing for any reason
// we fall back to env vars / hardcoded defaults so the booking flow is
// resilient to a misapplied migration.
import { turso } from '@/lib/turso';
import { BOOKING_DEFAULTS } from '@/lib/booking';

export interface SchedulingConfig {
  timezone: string;
  workingDays: number[];          // 0=Sun..6=Sat
  startHour: number;
  endHour: number;
  slotIntervalMinutes: number;
  bufferHoursFromNow: number;
  lookaheadDays: number;
}

const ALLOWED_INTERVALS = [15, 20, 30, 45, 60] as const;

function parseWorkingDaysCsv(s: string): number[] {
  return s
    .split(',')
    .map((x) => parseInt(x.trim(), 10))
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
}

function fallbackConfig(): SchedulingConfig {
  return {
    timezone: process.env.BOOKING_TIMEZONE || BOOKING_DEFAULTS.timezone,
    workingDays: BOOKING_DEFAULTS.workingDays,
    startHour: BOOKING_DEFAULTS.startHour,
    endHour: BOOKING_DEFAULTS.endHour,
    slotIntervalMinutes: BOOKING_DEFAULTS.slotIntervalMinutes,
    bufferHoursFromNow: BOOKING_DEFAULTS.bufferHoursFromNow,
    lookaheadDays: BOOKING_DEFAULTS.lookaheadDays,
  };
}

export async function loadSchedulingConfig(): Promise<SchedulingConfig> {
  try {
    const { rows } = await turso.execute(
      `SELECT timezone, working_days, start_hour, end_hour,
              slot_interval_minutes, buffer_hours_from_now, lookahead_days
         FROM scheduling_config WHERE id = 'default' LIMIT 1`,
    );
    if (rows.length === 0) return fallbackConfig();
    const r = rows[0] as Record<string, unknown>;
    return {
      timezone: (r.timezone as string) || BOOKING_DEFAULTS.timezone,
      workingDays: parseWorkingDaysCsv((r.working_days as string) ?? '1,2,3,4,5'),
      startHour: Number(r.start_hour ?? BOOKING_DEFAULTS.startHour),
      endHour: Number(r.end_hour ?? BOOKING_DEFAULTS.endHour),
      slotIntervalMinutes: Number(r.slot_interval_minutes ?? BOOKING_DEFAULTS.slotIntervalMinutes),
      bufferHoursFromNow: Number(r.buffer_hours_from_now ?? BOOKING_DEFAULTS.bufferHoursFromNow),
      lookaheadDays: Number(r.lookahead_days ?? BOOKING_DEFAULTS.lookaheadDays),
    };
  } catch {
    return fallbackConfig();
  }
}

export interface SchedulingConfigInput {
  timezone: string;
  workingDays: number[];
  startHour: number;
  endHour: number;
  slotIntervalMinutes: number;
  bufferHoursFromNow: number;
  lookaheadDays: number;
}

export function validateSchedulingConfig(input: SchedulingConfigInput): string | null {
  if (!input.timezone || typeof input.timezone !== 'string') return 'Timezone is required';
  // Smoke-test the IANA name by asking Intl to format with it; throws if invalid.
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: input.timezone }).format(new Date());
  } catch {
    return `Unknown timezone: ${input.timezone}`;
  }
  if (!Array.isArray(input.workingDays) || input.workingDays.length === 0) {
    return 'Pick at least one working day';
  }
  if (!input.workingDays.every((d) => Number.isInteger(d) && d >= 0 && d <= 6)) {
    return 'Working days must be 0-6';
  }
  if (input.startHour < 0 || input.startHour > 23) return 'startHour out of range';
  if (input.endHour < 1 || input.endHour > 24) return 'endHour out of range';
  if (input.endHour <= input.startHour) return 'endHour must be after startHour';
  if (!ALLOWED_INTERVALS.includes(input.slotIntervalMinutes as 15 | 20 | 30 | 45 | 60)) {
    return 'Slot interval must be 15, 20, 30, 45, or 60 minutes';
  }
  if (input.bufferHoursFromNow < 0 || input.bufferHoursFromNow > 168) {
    return 'Buffer must be 0-168 hours';
  }
  if (input.lookaheadDays < 1 || input.lookaheadDays > 60) {
    return 'Lookahead must be 1-60 days';
  }
  return null;
}

export async function writeSchedulingConfig(input: SchedulingConfigInput): Promise<void> {
  const err = validateSchedulingConfig(input);
  if (err) throw new Error(err);

  const workingDaysCsv = [...new Set(input.workingDays)].sort((a, b) => a - b).join(',');

  await turso.execute({
    sql: `UPDATE scheduling_config
            SET timezone = ?,
                working_days = ?,
                start_hour = ?,
                end_hour = ?,
                slot_interval_minutes = ?,
                buffer_hours_from_now = ?,
                lookahead_days = ?,
                updated_at = datetime('now')
          WHERE id = 'default'`,
    args: [
      input.timezone,
      workingDaysCsv,
      input.startHour,
      input.endHour,
      input.slotIntervalMinutes,
      input.bufferHoursFromNow,
      input.lookaheadDays,
    ],
  });
}
