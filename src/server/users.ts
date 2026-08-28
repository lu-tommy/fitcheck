import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

/**
 * Accounts, for a household.
 *
 * Two people, one NAS, no cloud service and no monthly bill. Passwords are
 * never stored — only a scrypt hash and its salt — so the file this reads from
 * does not hand anyone a way in if it leaks.
 *
 * Users come from OUTFITAI_USERS, a semicolon-separated list of
 * `name:salt:hash` entries. `npm run add-user` prints one.
 */

export interface Account {
  /** Stable id used for the data directory. Lowercased username. */
  id: string;
  username: string;
  salt: string;
  hash: string;
}

const SCRYPT_KEYLEN = 64;

export function hashPassword(password: string, salt = randomBytes(16).toString('hex')): {
  salt: string;
  hash: string;
} {
  return { salt, hash: scryptSync(password, salt, SCRYPT_KEYLEN).toString('hex') };
}

export function verifyPassword(password: string, account: Account): boolean {
  const attempt = scryptSync(password, account.salt, SCRYPT_KEYLEN);
  const stored = Buffer.from(account.hash, 'hex');
  // Lengths must match before timingSafeEqual, and it must be constant-time.
  if (attempt.length !== stored.length) return false;
  return timingSafeEqual(attempt, stored);
}

let cached: Account[] | null = null;

export function accounts(): Account[] {
  if (cached) return cached;

  const raw = process.env.OUTFITAI_USERS ?? '';
  cached = raw
    .split(';')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [username, salt, hash] = entry.split(':');
      if (!username || !salt || !hash) return null;
      return { id: username.toLowerCase(), username, salt, hash };
    })
    .filter((account): account is Account => account !== null);

  return cached;
}

export function findAccount(username: string): Account | undefined {
  const wanted = username.trim().toLowerCase();
  return accounts().find((account) => account.id === wanted);
}

export function accountsConfigured(): boolean {
  return accounts().length > 0;
}
