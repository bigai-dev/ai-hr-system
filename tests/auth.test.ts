import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { verifyBasicAuth } from '@/lib/auth';

describe('verifyBasicAuth', () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    process.env.BASIC_AUTH_USER = 'admin';
    process.env.BASIC_AUTH_PASS = 'correct-horse-battery-staple';
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  function basicHeader(user: string, pass: string): string {
    return 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64');
  }

  it('accepts valid credentials', () => {
    expect(verifyBasicAuth(basicHeader('admin', 'correct-horse-battery-staple'))).toBe(true);
  });

  it('rejects wrong password', () => {
    expect(verifyBasicAuth(basicHeader('admin', 'wrong'))).toBe(false);
  });

  it('rejects wrong username', () => {
    expect(verifyBasicAuth(basicHeader('root', 'correct-horse-battery-staple'))).toBe(false);
  });

  it('rejects missing header', () => {
    expect(verifyBasicAuth(null)).toBe(false);
    expect(verifyBasicAuth(undefined)).toBe(false);
    expect(verifyBasicAuth('')).toBe(false);
  });

  it('rejects non-Basic auth schemes', () => {
    expect(verifyBasicAuth('Bearer xyz')).toBe(false);
  });

  it('rejects malformed base64', () => {
    expect(verifyBasicAuth('Basic !!!not-base64')).toBe(false);
  });

  it('rejects credentials with no colon', () => {
    const encoded = Buffer.from('justusername').toString('base64');
    expect(verifyBasicAuth(`Basic ${encoded}`)).toBe(false);
  });

  it('fails closed when env vars are missing', () => {
    delete process.env.BASIC_AUTH_USER;
    delete process.env.BASIC_AUTH_PASS;
    expect(verifyBasicAuth(basicHeader('admin', 'correct-horse-battery-staple'))).toBe(false);
  });

  it('handles passwords containing colons', () => {
    process.env.BASIC_AUTH_PASS = 'pa:ss:word';
    expect(verifyBasicAuth(basicHeader('admin', 'pa:ss:word'))).toBe(true);
  });

  it('compares user and password independently (constant-time path)', () => {
    expect(verifyBasicAuth(basicHeader('a', 'correct-horse-battery-staple'))).toBe(false);
    expect(verifyBasicAuth(basicHeader('admin', 'short'))).toBe(false);
  });
});
