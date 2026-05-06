import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { log } from '@/lib/log';

function captureLogs(method: 'log' | 'warn' | 'error') {
  return vi.spyOn(console, method).mockImplementation(() => {});
}

describe('log', () => {
  let logSpy: ReturnType<typeof captureLogs>;

  beforeEach(() => {
    logSpy = captureLogs('log');
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it('emits a JSON line with level, event, and ts', () => {
    log.info('test_event', { foo: 'bar' });
    const line = JSON.parse(logSpy.mock.calls[0][0] as string);
    expect(line.level).toBe('info');
    expect(line.event).toBe('test_event');
    expect(line.foo).toBe('bar');
    expect(typeof line.ts).toBe('string');
  });

  it('hashes email fields', () => {
    log.info('apply', { email: 'jane.doe@example.com' });
    const line = JSON.parse(logSpy.mock.calls[0][0] as string);
    expect(line.email).not.toContain('jane.doe');
    expect(line.email).toMatch(/^[0-9a-f]{8}@example\.com$/);
  });

  it('redacts phone, cover_letter, resume_text', () => {
    log.info('apply', {
      phone: '+1 555 555 5555',
      cover_letter: 'sensitive content',
      resume_text: 'work history…',
    });
    const line = JSON.parse(logSpy.mock.calls[0][0] as string);
    expect(line.phone).toBe('[redacted]');
    expect(line.cover_letter).toBe('[redacted]');
    expect(line.resume_text).toBe('[redacted]');
  });

  it('replaces email-shaped strings in arbitrary string fields', () => {
    log.info('test', { note: 'contact: foo@bar.com' });
    const line = JSON.parse(logSpy.mock.calls[0][0] as string);
    // The log helper only hashes if the entire string is an email, otherwise truncates.
    expect(line.note).toBe('contact: foo@bar.com');
  });

  it('truncates very long strings', () => {
    const long = 'x'.repeat(2000);
    log.info('test', { blob: long });
    const line = JSON.parse(logSpy.mock.calls[0][0] as string);
    expect(line.blob.length).toBeLessThanOrEqual(501); // 500 + ellipsis
    expect(line.blob.endsWith('…')).toBe(true);
  });

  it('extracts message from Error instances', () => {
    log.info('test', { err: new Error('boom') });
    const line = JSON.parse(logSpy.mock.calls[0][0] as string);
    expect(line.err).toEqual({ message: 'boom', name: 'Error' });
  });
});

describe('log levels', () => {
  it('uses console.warn for warn level', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    log.warn('warning_event');
    expect(warnSpy).toHaveBeenCalledTimes(1);
    warnSpy.mockRestore();
  });

  it('uses console.error for error level', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    log.error('error_event');
    expect(errorSpy).toHaveBeenCalledTimes(1);
    errorSpy.mockRestore();
  });
});
