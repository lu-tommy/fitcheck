'use client';

/**
 * Keeping the wardrobe alive.
 *
 * Everything this app knows lives in IndexedDB, and browsers treat that as
 * disposable by default: WebKit deletes all script-writable storage for an
 * origin it has not seen you interact with for seven days. That is not a
 * hypothetical for a wardrobe app — a fortnight away is enough to lose the
 * lot. Two things opt out of it, and this module does both.
 */

export type PersistenceState = 'persisted' | 'denied' | 'unsupported' | 'unknown';

/**
 * Ask the browser to keep our data. Chrome grants this silently once the site
 * looks used (installed, bookmarked, engaged); Safari grants it on install.
 * Calling it repeatedly is harmless and it never prompts.
 */
export async function requestPersistence(): Promise<PersistenceState> {
  if (typeof navigator === 'undefined' || !navigator.storage?.persist) return 'unsupported';
  try {
    if (await navigator.storage.persisted()) return 'persisted';
    return (await navigator.storage.persist()) ? 'persisted' : 'denied';
  } catch {
    return 'unknown';
  }
}

export async function persistenceState(): Promise<PersistenceState> {
  if (typeof navigator === 'undefined' || !navigator.storage?.persisted) return 'unsupported';
  try {
    return (await navigator.storage.persisted()) ? 'persisted' : 'denied';
  } catch {
    return 'unknown';
  }
}

/* ---------------------------------------------------------------- install -- */

export type Platform = 'ios' | 'android' | 'desktop';

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari predates the standard and still reports it here.
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function platform(): Platform {
  if (typeof navigator === 'undefined') return 'desktop';
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return 'ios';
  // iPadOS reports itself as a Mac, so the touch count is the giveaway.
  if (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'desktop';
}

/**
 * Chrome fires this once and expects you to hold it until the user asks to
 * install. Safari fires nothing at all, which is why iOS gets instructions
 * instead of a button.
 */
export interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferredPrompt: InstallPromptEvent | null = null;

export function captureInstallPrompt(onAvailable: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const handler = (event: Event) => {
    event.preventDefault();
    deferredPrompt = event as InstallPromptEvent;
    onAvailable();
  };
  window.addEventListener('beforeinstallprompt', handler);
  return () => window.removeEventListener('beforeinstallprompt', handler);
}

export function hasInstallPrompt(): boolean {
  return deferredPrompt !== null;
}

export async function showInstallPrompt(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!deferredPrompt) return 'unavailable';
  await deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  deferredPrompt = null;
  return outcome;
}

/* --------------------------------------------------------- service worker -- */

export function registerServiceWorker(): void {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  if (process.env.NODE_ENV !== 'production') return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error) => {
      // An offline app that fails to go offline is a degraded app, not a broken
      // one — never let this take the page down with it.
      console.warn('[outfitai] service worker registration failed:', error);
    });
  });
}
