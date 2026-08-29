import { readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

import { pushConfigured, sendDueReminders } from './push';
import { readEnv } from './env';

/**
 * The daily reminder loop.
 *
 * Ticks once a minute and sends whatever is due. A minute is enough resolution
 * because a reminder is due within a five-minute window and records the day it
 * went out: a missed tick delays it rather than losing it, and a slow one
 * cannot send it twice.
 */

const TICK_MS = 60 * 1000;
let timer: ReturnType<typeof setInterval> | null = null;

async function everyone(): Promise<string[]> {
  const dir = path.join(readEnv('DATA_DIR') ?? path.join(process.cwd(), 'data'), 'users');
  if (!existsSync(dir)) return [];
  try {
    return await readdir(dir);
  } catch {
    return [];
  }
}

export function startReminderLoop(): void {
  if (timer) return;
  if (!pushConfigured()) {
    console.log('[fitcheck] reminders are off — no VAPID keys configured');
    return;
  }

  timer = setInterval(async () => {
    try {
      const sent = await sendDueReminders(await everyone());
      if (sent) console.log(`[fitcheck] sent ${sent} reminder(s)`);
    } catch (error) {
      // A failed tick must never take the server down with it.
      console.warn('[fitcheck] reminder tick failed:', (error as Error).message);
    }
  }, TICK_MS);

  // Do not hold the process open on this timer's account.
  timer.unref?.();
  console.log('[fitcheck] reminder loop started');
}

export function stopReminderLoop(): void {
  if (timer) clearInterval(timer);
  timer = null;
}
