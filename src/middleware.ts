import { NextResponse, type NextRequest } from 'next/server';

import { LEGACY_SESSION_COOKIE, SESSION_COOKIE, readToken } from '@/server/token';
import { readEnv } from '@/server/env';

/**
 * The front door.
 *
 * Nothing is reachable without signing in — the same shape as Jellyfin, where
 * the app itself is behind the login rather than the login being an optional
 * extra. The check happens here, before any page renders, so a signed-out
 * request never receives a wardrobe screen at all.
 *
 * Offline still works for somebody already signed in: the service worker serves
 * the cached shell and the wardrobe is in IndexedDB, so a phone with no signal
 * opens exactly as before. The gate only applies to requests that reach the
 * server.
 */

/** Paths that must stay open, or nobody could ever sign in. */
const PUBLIC_PATHS = ['/account'];

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
  if (PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))) return true;
  if (PUBLIC_API.includes(pathname)) return true;
  if (PUBLIC_FILES.includes(pathname)) return true;
  // Next's own assets, which are hashed and carry no wardrobe data.
  return pathname.startsWith('/_next/');
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (isPublic(pathname)) return NextResponse.next();

  const secret = readEnv('SECRET');
  if (!secret || secret.length < 16) {
    // Without a secret no token can be verified, so nothing can be trusted.
    // Failing closed is the only safe answer.
    return pathname.startsWith('/api/')
      ? NextResponse.json({ error: 'server_misconfigured' }, { status: 503 })
      : NextResponse.redirect(new URL('/account', request.url));
  }

  // Either name — see LEGACY_SESSION_COOKIE. The token itself is unchanged,
  // so a cookie set before the rename still verifies.
  const cookie =
    request.cookies.get(SESSION_COOKIE)?.value ??
    request.cookies.get(LEGACY_SESSION_COOKIE)?.value;
  const userId = await readToken(cookie, secret);
  if (userId) return NextResponse.next();

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
  }

  // Remember where they were headed, so signing in lands them there.
  const target = new URL('/account', request.url);
  if (pathname !== '/') target.searchParams.set('next', `${pathname}${search}`);
  return NextResponse.redirect(target);
}

export const config = {
  // Everything except Next's internals and the static files listed above; those
  // are re-checked in isPublic so the two lists cannot drift apart.
  matcher: ['/((?!_next/static|_next/image).*)'],
};
