/**
 * Session tokens.
 *
 * One implementation, used by both the route handlers and the middleware, so
 * the two can never drift into disagreeing about who is signed in. It is built
 * on Web Crypto rather than node:crypto because middleware may run on the edge
 * runtime, where node:crypto does not exist.
 *
 * A token is `userId.expiry.signature`, signed with the server secret. Nothing
 * is stored: the server can verify a token without looking anything up.
 */

const encoder = new TextEncoder();

/** Named here rather than in session.ts, which pulls in node-only modules. */
export const SESSION_COOKIE = 'outfitai_session';

export const MAX_AGE_SECONDS = 60 * 60 * 24 * 90;

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function signPayload(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return toHex(await crypto.subtle.sign('HMAC', key, encoder.encode(payload)));
}

/** Constant-time compare, so a wrong signature leaks nothing through timing. */
function equal(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i += 1) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}

export async function createToken(userId: string, secret: string): Promise<string> {
  const expiry = Date.now() + MAX_AGE_SECONDS * 1000;
  const payload = `${userId}.${expiry}`;
  return `${payload}.${await signPayload(payload, secret)}`;
}

export async function readToken(
  token: string | undefined,
  secret: string,
): Promise<string | null> {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [userId, expiry, signature] = parts;

  if (!equal(await signPayload(`${userId}.${expiry}`, secret), signature)) return null;
  if (!Number(expiry) || Number(expiry) < Date.now()) return null;

  return userId;
}
