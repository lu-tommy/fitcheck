import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';

/**
 * Sessions, without a database.
 *
 * A cookie holds `userId.expiry.signature`, signed with a server secret. The
 * server can verify it without storing anything, and nobody can forge one
 * without the secret. httpOnly keeps it away from page scripts, so an injected
 * script cannot read it.
 */

export const SESSION_COOKIE = 'outfitai_session';
const MAX_AGE_SECONDS = 60 * 60 * 24 * 90;

/**
 * A generated secret keeps development working, but it changes on every
 * restart — which signs everyone out. Production must set OUTFITAI_SECRET.
 */
let fallbackSecret: string | null = null;

function secret(): string {
  const configured = process.env.OUTFITAI_SECRET;
  if (configured && configured.length >= 16) return configured;
  if (!fallbackSecret) {
    fallbackSecret = randomBytes(32).toString('hex');
    console.warn(
      '[outfitai] OUTFITAI_SECRET is not set. Using a temporary one, so everybody is signed ' +
        'out whenever the server restarts. Set it in .env.local before deploying.',
    );
  }
  return fallbackSecret;
}

function sign(payload: string): string {
  return createHmac('sha256', secret()).update(payload).digest('hex');
}

export function createToken(userId: string): string {
  const expiry = Date.now() + MAX_AGE_SECONDS * 1000;
  const payload = `${userId}.${expiry}`;
  return `${payload}.${sign(payload)}`;
}

export function readToken(token: string | undefined): string | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [userId, expiry, signature] = parts;

  const expected = Buffer.from(sign(`${userId}.${expiry}`));
  const provided = Buffer.from(signature);
  if (expected.length !== provided.length) return null;
  if (!timingSafeEqual(expected, provided)) return null;
  if (Number(expiry) < Date.now()) return null;

  return userId;
}

export async function currentUserId(): Promise<string | null> {
  const store = await cookies();
  return readToken(store.get(SESSION_COOKIE)?.value);
}

export function sessionCookie(token: string) {
  return {
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: MAX_AGE_SECONDS,
    // Behind nginx with TLS this is https; over plain http on the LAN a secure
    // cookie would never be sent, so it follows the deployment.
    secure: process.env.NODE_ENV === 'production' && process.env.OUTFITAI_INSECURE !== 'true',
  };
}

export function clearedCookie() {
  return { ...sessionCookie(''), maxAge: 0 };
}

/** Crude but effective: slow down guessing on a URL anyone can reach. */
const attempts = new Map<string, { count: number; first: number }>();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 10;

export function tooManyAttempts(key: string): boolean {
  const record = attempts.get(key);
  if (!record) return false;
  if (Date.now() - record.first > WINDOW_MS) {
    attempts.delete(key);
    return false;
  }
  return record.count >= MAX_ATTEMPTS;
}

export function recordAttempt(key: string, success: boolean): void {
  if (success) {
    attempts.delete(key);
    return;
  }
  const record = attempts.get(key);
  if (!record || Date.now() - record.first > WINDOW_MS) {
    attempts.set(key, { count: 1, first: Date.now() });
    return;
  }
  record.count += 1;
}
