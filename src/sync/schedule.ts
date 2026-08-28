'use client';

import { onLocalWrite } from '@/db';
import { useSync } from '@/store/sync';

/**
 * When to sync.
 *
 * Aggressively enough that her phone and her iPad are never meaningfully out of
 * step, gently enough that it is not a battery complaint: shortly after a
 * change, whenever the app comes back to the foreground, when the connection
 * returns, and on a slow heartbeat while it is open.
 */

const AFTER_A_CHANGE_MS = 4000;
const HEARTBEAT_MS = 5 * 60 * 1000;
/** Do not re-sync on every glance at the screen. */
const FOREGROUND_THROTTLE_MS = 60 * 1000;

export function startSyncSchedule(userId: string): () => void {
  let changeTimer: ReturnType<typeof setTimeout> | null = null;
  let lastForegroundSync = 0;

  const sync = () => void useSync.getState().sync(userId);

  const afterChange = () => {
    if (changeTimer) clearTimeout(changeTimer);
    changeTimer = setTimeout(sync, AFTER_A_CHANGE_MS);
  };

  const onForeground = () => {
    if (document.visibilityState !== 'visible') return;
    if (Date.now() - lastForegroundSync < FOREGROUND_THROTTLE_MS) return;
    lastForegroundSync = Date.now();
    sync();
  };

  const stopWrites = onLocalWrite(afterChange);
  const heartbeat = setInterval(() => {
    if (document.visibilityState === 'visible') sync();
  }, HEARTBEAT_MS);

  document.addEventListener('visibilitychange', onForeground);
  window.addEventListener('online', sync);

  // First run, as soon as we know who is signed in.
  sync();

  return () => {
    if (changeTimer) clearTimeout(changeTimer);
    clearInterval(heartbeat);
    stopWrites();
    document.removeEventListener('visibilitychange', onForeground);
    window.removeEventListener('online', sync);
  };
}
