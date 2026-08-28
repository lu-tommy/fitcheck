import { cookies, headers } from 'next/headers';

import {
  createToken,
  recordAttempt,
  sessionCookie,
  tooManyAttempts,
} from '@/server/session';
import { accountsConfigured, findAccount, verifyPassword } from '@/server/users';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  if (!accountsConfigured()) {
    return Response.json(
      {
        error: 'no_accounts',
        message: 'No accounts are set up on the server yet. See OUTFITAI_USERS in .env.example.',
      },
      { status: 503 },
    );
  }

  const { username, password } = (await request.json()) as {
    username?: string;
    password?: string;
  };
  if (!username || !password) {
    return Response.json(
      { error: 'bad_request', message: 'Enter a name and a password.' },
      { status: 400 },
    );
  }

  // Behind nginx the client address arrives in a header; fall back to the name
  // so a single account still cannot be hammered.
  const forwarded = (await headers()).get('x-forwarded-for') ?? 'local';
  const key = `${forwarded}|${username.toLowerCase()}`;

  if (tooManyAttempts(key)) {
    return Response.json(
      { error: 'rate_limited', message: 'Too many attempts. Wait ten minutes and try again.' },
      { status: 429 },
    );
  }

  const account = findAccount(username);
  const ok = Boolean(account) && verifyPassword(password, account!);
  recordAttempt(key, ok);

  if (!account || !ok) {
    // Never say which half was wrong — that tells an attacker which names exist.
    return Response.json(
      { error: 'invalid', message: 'That name and password do not match an account.' },
      { status: 401 },
    );
  }

  (await cookies()).set(sessionCookie(createToken(account.id)));
  return Response.json({ userId: account.id, username: account.username });
}
