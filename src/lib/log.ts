import { createHash } from 'node:crypto';

type Level = 'info' | 'warn' | 'error';

function hashEmail(email: string): string {
  const at = email.indexOf('@');
  if (at === -1) return 'invalid-email';
  const domain = email.slice(at + 1).toLowerCase();
  const hash = createHash('sha256').update(email.toLowerCase()).digest('hex').slice(0, 8);
  return `${hash}@${domain}`;
}

function scrubValue(v: unknown): unknown {
  if (typeof v === 'string') {
    if (v.includes('@') && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return hashEmail(v);
    return v.length > 500 ? v.slice(0, 500) + '…' : v;
  }
  if (v instanceof Error) return { message: v.message, name: v.name };
  return v;
}

function scrubFields(fields: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (k === 'email' && typeof v === 'string') {
      out.email = hashEmail(v);
    } else if (k === 'phone' || k === 'resume_text' || k === 'cover_letter') {
      out[k] = '[redacted]';
    } else {
      out[k] = scrubValue(v);
    }
  }
  return out;
}

function emit(level: Level, event: string, fields?: Record<string, unknown>) {
  const line = JSON.stringify({
    level,
    event,
    ts: new Date().toISOString(),
    ...(fields ? scrubFields(fields) : {}),
  });
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export const log = {
  info: (event: string, fields?: Record<string, unknown>) => emit('info', event, fields),
  warn: (event: string, fields?: Record<string, unknown>) => emit('warn', event, fields),
  error: (event: string, fields?: Record<string, unknown>) => emit('error', event, fields),
};
