'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import TopBar from '@/components/TopBar';
import {
  getSchedulingConfig,
  updateSchedulingConfig,
} from '@/app/(dashboard)/actions';
import type { SchedulingConfig } from '@/lib/scheduling-config';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const COMMON_TIMEZONES = [
  'Asia/Kuala_Lumpur',
  'Asia/Singapore',
  'Asia/Jakarta',
  'Asia/Bangkok',
  'Asia/Hong_Kong',
  'Asia/Tokyo',
  'Asia/Kolkata',
  'Europe/London',
  'Europe/Berlin',
  'America/New_York',
  'America/Los_Angeles',
  'UTC',
];

const HOUR_OPTIONS = Array.from({ length: 25 }, (_, i) => i);

function formatHourLabel(h: number): string {
  if (h === 0) return '12:00 AM';
  if (h === 12) return '12:00 PM';
  if (h === 24) return '12:00 AM (next day)';
  return h < 12 ? `${h}:00 AM` : `${h - 12}:00 PM`;
}

export default function SchedulingSettingsPage() {
  const [config, setConfig] = useState<SchedulingConfig | null>(null);
  const [tzInput, setTzInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedTick, setSavedTick] = useState(false);

  useEffect(() => {
    getSchedulingConfig().then((c) => {
      setConfig(c);
      setTzInput(c.timezone);
    });
  }, []);

  if (!config) {
    return (
      <div className="min-h-screen">
        <TopBar title="Scheduling settings" />
        <div className="p-10 flex justify-center">
          <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  function update<K extends keyof SchedulingConfig>(key: K, value: SchedulingConfig[K]) {
    setConfig((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  function toggleDay(d: number) {
    if (!config) return;
    const set = new Set(config.workingDays);
    if (set.has(d)) set.delete(d);
    else set.add(d);
    update('workingDays', Array.from(set).sort((a, b) => a - b));
  }

  async function handleSave() {
    if (!config) return;
    setSaving(true);
    setError(null);
    try {
      await updateSchedulingConfig({
        timezone: tzInput.trim(),
        workingDays: config.workingDays,
        startHour: config.startHour,
        endHour: config.endHour,
        slotIntervalMinutes: config.slotIntervalMinutes,
        bufferHoursFromNow: config.bufferHoursFromNow,
        lookaheadDays: config.lookaheadDays,
      });
      setSavedTick(true);
      setTimeout(() => setSavedTick(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  // Live preview: a representative working slot today, formatted in the chosen TZ.
  const tzPreview = (() => {
    try {
      const fmt = new Intl.DateTimeFormat('en-US', {
        timeZone: tzInput.trim(),
        hour: 'numeric',
        minute: '2-digit',
        timeZoneName: 'short',
      });
      const sampleStart = new Date();
      sampleStart.setHours(config.startHour, 0, 0, 0);
      const sampleEnd = new Date();
      sampleEnd.setHours(config.endHour, 0, 0, 0);
      return `${fmt.format(sampleStart)} – ${fmt.format(sampleEnd)} (host clock: ${config.startHour}:00 – ${config.endHour}:00)`;
    } catch {
      return null;
    }
  })();

  return (
    <div className="min-h-screen">
      <TopBar title="Scheduling settings" />
      <div className="p-6 max-w-3xl">
        <div className="text-xs text-muted mb-1">
          <Link href="/settings" className="hover:text-foreground transition-colors">
            ← All settings
          </Link>
        </div>
        <h2 className="text-xl font-bold mb-1">Self-serve scheduling</h2>
        <p className="text-sm text-muted mb-6">
          Controls the slots offered when a candidate opens a booking link. Changes apply to every job and every recruiter.
        </p>

        {error && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-3 text-xs text-red-500 mb-4">
            {error}
          </div>
        )}

        <div className="bg-card border border-card-border rounded-xl p-6 space-y-6">
          {/* Timezone */}
          <div>
            <label className="block text-sm font-medium mb-1.5">Timezone</label>
            <input
              list="tz-list"
              type="text"
              value={tzInput}
              onChange={(e) => setTzInput(e.target.value)}
              placeholder="Asia/Kuala_Lumpur"
              className="w-full bg-background border border-card-border rounded-lg px-3 py-2 text-sm outline-none focus:border-accent transition-colors font-mono"
            />
            <datalist id="tz-list">
              {COMMON_TIMEZONES.map((tz) => (
                <option key={tz} value={tz} />
              ))}
            </datalist>
            <p className="text-xs text-muted mt-1">
              IANA timezone name. Working hours are interpreted in this zone, and interviews are stored as wall-clock time here.
            </p>
            {tzPreview && (
              <p className="text-xs text-accent mt-1">Preview: {tzPreview}</p>
            )}
          </div>

          {/* Working days */}
          <div>
            <label className="block text-sm font-medium mb-2">Working days</label>
            <div className="flex flex-wrap gap-2">
              {DAY_LABELS.map((label, i) => {
                const active = config.workingDays.includes(i);
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => toggleDay(i)}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold border transition-colors ${
                      active
                        ? 'bg-accent border-accent text-white'
                        : 'bg-background border-card-border text-muted hover:border-accent/50'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Working hours */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Day starts</label>
              <select
                value={config.startHour}
                onChange={(e) => update('startHour', Number(e.target.value))}
                className="w-full bg-background border border-card-border rounded-lg px-3 py-2 text-sm outline-none focus:border-accent transition-colors"
              >
                {HOUR_OPTIONS.slice(0, 24).map((h) => (
                  <option key={h} value={h}>
                    {formatHourLabel(h)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Day ends</label>
              <select
                value={config.endHour}
                onChange={(e) => update('endHour', Number(e.target.value))}
                className="w-full bg-background border border-card-border rounded-lg px-3 py-2 text-sm outline-none focus:border-accent transition-colors"
              >
                {HOUR_OPTIONS.slice(1).map((h) => (
                  <option key={h} value={h}>
                    {formatHourLabel(h)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Slot interval */}
          <div>
            <label className="block text-sm font-medium mb-1.5">Slot interval</label>
            <select
              value={config.slotIntervalMinutes}
              onChange={(e) => update('slotIntervalMinutes', Number(e.target.value))}
              className="w-full bg-background border border-card-border rounded-lg px-3 py-2 text-sm outline-none focus:border-accent transition-colors"
            >
              {[15, 20, 30, 45, 60].map((n) => (
                <option key={n} value={n}>
                  Every {n} minutes
                </option>
              ))}
            </select>
            <p className="text-xs text-muted mt-1">
              How often slots can start. Doesn't have to match interview duration; a 60-min interview with 30-min interval offers slots at :00 and :30.
            </p>
          </div>

          {/* Buffer + lookahead */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Earliest booking</label>
              <select
                value={config.bufferHoursFromNow}
                onChange={(e) => update('bufferHoursFromNow', Number(e.target.value))}
                className="w-full bg-background border border-card-border rounded-lg px-3 py-2 text-sm outline-none focus:border-accent transition-colors"
              >
                <option value={0}>No minimum (book asap)</option>
                <option value={2}>2 hours from now</option>
                <option value={6}>6 hours from now</option>
                <option value={12}>12 hours from now</option>
                <option value={24}>24 hours from now</option>
                <option value={48}>48 hours from now</option>
                <option value={72}>3 days from now</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Lookahead window</label>
              <select
                value={config.lookaheadDays}
                onChange={(e) => update('lookaheadDays', Number(e.target.value))}
                className="w-full bg-background border border-card-border rounded-lg px-3 py-2 text-sm outline-none focus:border-accent transition-colors"
              >
                <option value={7}>7 days</option>
                <option value={14}>14 days</option>
                <option value={21}>21 days</option>
                <option value={30}>30 days</option>
              </select>
            </div>
          </div>
        </div>

        <div className="mt-5 flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2.5 text-sm font-bold bg-accent hover:bg-accent-hover disabled:opacity-50 text-white rounded-lg transition-colors"
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
          {savedTick && (
            <span className="text-xs text-success font-semibold">✓ Saved</span>
          )}
        </div>
      </div>
    </div>
  );
}
