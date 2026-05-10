import { timingSafeEqual } from 'node:crypto';

function safeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) {
    timingSafeEqual(bBuf, bBuf);
    return false;
  }
  return timingSafeEqual(aBuf, bBuf);
}

export function verifyBasicAuth(authHeader: string | null | undefined): boolean {
  // Demo / local escape hatch: setting DISABLE_AUTH=1 in the environment
  // bypasses HTTP Basic everywhere — both this middleware check and every
  // server action's requireAuth() (which calls into here). Never set this in
  // production; the dashboard exposes destructive actions and PII.
  if (process.env.DISABLE_AUTH === '1') return true;

  const expectedUser = process.env.BASIC_AUTH_USER;
  const expectedPass = process.env.BASIC_AUTH_PASS;

  if (!expectedUser || !expectedPass) return false;
  if (!authHeader || !authHeader.startsWith('Basic ')) return false;

  let decoded: string;
  try {
    decoded = Buffer.from(authHeader.slice(6), 'base64').toString('utf-8');
  } catch {
    return false;
  }

  const idx = decoded.indexOf(':');
  if (idx === -1) return false;

  const user = decoded.slice(0, idx);
  const pass = decoded.slice(idx + 1);

  return safeEqual(user, expectedUser) && safeEqual(pass, expectedPass);
}

export class UnauthorizedError extends Error {
  constructor() {
    super('Unauthorized');
  }
}

export async function requireAuth(): Promise<void> {
  const { headers } = await import('next/headers');
  const h = await headers();
  if (!verifyBasicAuth(h.get('authorization'))) {
    throw new UnauthorizedError();
  }
}

export async function getCurrentUser(): Promise<string | null> {
  const { headers } = await import('next/headers');
  const h = await headers();
  const authHeader = h.get('authorization');
  if (!authHeader || !authHeader.startsWith('Basic ')) return null;
  try {
    const decoded = Buffer.from(authHeader.slice(6), 'base64').toString('utf-8');
    const idx = decoded.indexOf(':');
    if (idx === -1) return null;
    return decoded.slice(0, idx);
  } catch {
    return null;
  }
}
