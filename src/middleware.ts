import { NextResponse, type NextRequest } from 'next/server';

import { LEGACY_SESSION_COOKIE, SESSION_COOKIE, readToken } from '@/server/token';
import { readEnv } from '@/server/env';

/**
 * The front door.
 *
 * The gate is on the DATA, not on the shell.
 *
 * Every page in this app is a client component and none of them read a wardrobe
 * on the server — the local database is the source of truth, and everything
 * real arrives through /api. So a page is an empty shell until IndexedDB fills
 * it, and serving that shell to a stranger discloses nothing about anybody.
 *
 * What must stay closed is /api: that is where one person's clothes and photos
 * actually live, and an unauthenticated request there is still refused with a
 * 401. Nobody can read another account's wardrobe, which is the property that
 * matters.
 *
 * What this buys: someone can open the app, load the demo wardrobe and use the
 * whole thing without an account. The app was already built to run that way —
 * `AppShell` notes that signed out it is "exactly the same minus sync", and the
 * sync store already treats a 401 as NotSignedIn rather than an error — so this
 * removes a gate the rest of the code had already been written around.
 *
 * Offline is unchanged: the service worker serves the cached shell and the
 * wardrobe is in IndexedDB, so a phone with no signal opens exactly as before.
 */

/**
 * Pages are open. They carry no wardrobe data of their own; see the note above.
 * The one thing that stays closed is /api, handled below.
 */
const PUBLIC_API = ['/api/auth/login', '/api/auth/me', '/api/auth/logout'];

/** Files the browser fetches before, or instead of, a page. */
const PUBLIC_FILES = [
  '/manifest.webmanifest',
  '/sw.js',
  '/icon.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/favicon.ico',
];

function isPublic(pathname: string): boolean {
  // Anything that is not an API call is a shell, and shells are public.
  if (!pathname.startsWith('/api/')) return true;
  if (PUBLIC_API.includes(pathname)) return true;
  if (PUBLIC_FILES.includes(pathname)) return true;
  // Next's own assets, which are hashed and carry no wardrobe data.
  return pathname.startsWith('/_next/');
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (isPublic(pathname)) return NextResponse.next();

  const secret = readEnv('SECRET');
  if (!secret || secret.length < 16) {
    // Without a secret no token can be verified, so nothing can be trusted.
    // Failing closed is the only safe answer.
    return NextResponse.json({ error: 'server_misconfigured' }, { status: 503 });
  }

  // Either name — see LEGACY_SESSION_COOKIE. The token itself is unchanged,
  // so a cookie set before the rename still verifies.
  const cookie =
    request.cookies.get(SESSION_COOKIE)?.value ??
    request.cookies.get(LEGACY_SESSION_COOKIE)?.value;
  const userId = await readToken(cookie, secret);
  if (userId) return NextResponse.next();

  // Only /api reaches here now: isPublic() lets every page through. An
  // unauthenticated data request is refused outright rather than redirected,
  // because a redirect to HTML is a confusing answer to a fetch.
  return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
}

export const config = {
  // Everything except Next's internals and the static files listed above; those
  // are re-checked in isPublic so the two lists cannot drift apart.
  matcher: ['/((?!_next/static|_next/image).*)'],
};
