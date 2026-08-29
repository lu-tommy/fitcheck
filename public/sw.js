/*
 * FitCheck service worker.
 *
 * The job is narrow: make the app open when there is no signal. Wardrobe data
 * never comes over the network — it is already in IndexedDB — so this only has
 * to cache the shell and the static bundle.
 *
 * Navigations are network-first so a deploy is picked up immediately, falling
 * back to the cached shell when offline. Hashed build assets are cache-first,
 * because their URL changes whenever their content does.
 */

const VERSION = 'v1';
const SHELL = `fitcheck-shell-${VERSION}`;
const ASSETS = `fitcheck-assets-${VERSION}`;
const OFFLINE_URL = '/';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL).then((cache) => cache.addAll([OFFLINE_URL])).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            // Both prefixes: a device that ran the app before the rename is
            // still holding outfitai-* caches, and nothing else will clear them.
            .filter(
              (key) =>
                (key.startsWith('fitcheck-') || key.startsWith('outfitai-')) &&
                !key.endsWith(VERSION),
            )
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // The AI routes must never be served stale, and must never be cached.
  if (url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Only cache a real page. A signed-out request is a redirect to the
          // sign-in screen, and caching that would strand an offline app there.
          if (response.ok && !response.redirected && response.type === 'basic') {
            const copy = response.clone();
            caches.open(SHELL).then((cache) => cache.put(OFFLINE_URL, copy));
          }
          return response;
        })
        .catch(() => caches.match(OFFLINE_URL).then((cached) => cached || Response.error())),
    );
    return;
  }

  if (url.pathname.startsWith('/_next/static') || url.pathname.startsWith('/icon')) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            const copy = response.clone();
            caches.open(ASSETS).then((cache) => cache.put(request, copy));
            return response;
          }),
      ),
    );
  }
});

/* ------------------------------------------------------------ reminders -- */

self.addEventListener('push', (event) => {
  let payload = { title: 'FitCheck', body: 'Time to pick today’s outfit.', url: '/' };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch {
    // A malformed payload still deserves a notification; the defaults do.
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      // One reminder at a time: a new one replaces yesterday's rather than
      // stacking up unread in the shade.
      tag: 'fitcheck-daily',
      renotify: true,
      data: { url: payload.url },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      // Reuse a tab that is already open rather than piling up new ones.
      for (const client of windows) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(target);
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});
