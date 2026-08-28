import { existsSync } from 'node:fs';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

import webpush, { type PushSubscription } from 'web-push';

/**
 * Daily reminders.
 *
 * Web push, sent from this server, with no third party in the middle and
 * nothing to pay for. The browser's push service does the delivery; the VAPID
 * keys are what let it trust that the message came from us.
 *
 * Deliberately a nudge rather than a prediction: the server holds the wardrobe
 * but not the weather or the reader's units, so an outfit named here would
 * differ from the one the app shows on open. Saying "your outfit is ready" and
 * opening the app is honest; naming the wrong outfit is not.
 */

export interface StoredSubscription {
  subscription: PushSubscription;
  /** IANA zone, so "half past seven" means their half past seven. */
  timeZone: string;
  hour: number;
  minute: number;
  createdAt: string;
  /** YYYY-MM-DD of the last send, so a reminder goes out once a day. */
  lastSentOn?: string;
}

interface PushFile {
  version: 1;
  subscriptions: Record<string, StoredSubscription>;
}

const EMPTY: PushFile = { version: 1, subscriptions: {} };

function root(): string {
  return process.env.OUTFITAI_DATA_DIR ?? path.join(process.cwd(), 'data');
}

function safeId(userId: string): string {
  if (!/^[a-z0-9_-]{1,64}$/i.test(userId)) throw new Error('Invalid user id');
  return userId.toLowerCase();
}

const pushFile = (userId: string) => path.join(root(), 'users', safeId(userId), 'push.json');

export function pushConfigured(): boolean {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

export function publicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY ?? null;
}

let configured = false;

function ensureConfigured(): boolean {
  if (!pushConfigured()) return false;
  if (!configured) {
    webpush.setVapidDetails(
      // A contact for the push service to reach if something goes wrong. It is
      // never shown to anyone and never receives mail in practice.
      process.env.VAPID_SUBJECT ?? 'mailto:outfitai@localhost',
      process.env.VAPID_PUBLIC_KEY!,
      process.env.VAPID_PRIVATE_KEY!,
    );
    configured = true;
  }
  return true;
}

async function read(userId: string): Promise<PushFile> {
  const file = pushFile(userId);
  if (!existsSync(file)) return structuredClone(EMPTY);
  try {
    return JSON.parse(await readFile(file, 'utf8')) as PushFile;
  } catch {
    // A corrupt reminder file costs reminders, not clothes. Start over.
    return structuredClone(EMPTY);
  }
}

async function write(userId: string, value: PushFile): Promise<void> {
  const file = pushFile(userId);
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  await writeFile(temporary, JSON.stringify(value));
  await rename(temporary, file);
}

/** Endpoints are long; a short stable key keeps the file readable. */
function keyFor(subscription: PushSubscription): string {
  return Buffer.from(subscription.endpoint).toString('base64url').slice(-32);
}

export async function saveSubscription(
  userId: string,
  entry: Omit<StoredSubscription, 'createdAt'>,
): Promise<void> {
  const file = await read(userId);
  file.subscriptions[keyFor(entry.subscription)] = {
    ...entry,
    createdAt: new Date().toISOString(),
  };
  await write(userId, file);
}

export async function removeSubscription(userId: string, endpoint: string): Promise<void> {
  const file = await read(userId);
  delete file.subscriptions[keyFor({ endpoint } as PushSubscription)];
  await write(userId, file);
}

export async function listSubscriptions(userId: string): Promise<StoredSubscription[]> {
  return Object.values((await read(userId)).subscriptions);
}

/** The reader's own wall-clock time and date, wherever they are. */
export function localNow(timeZone: string): { hour: number; minute: number; date: string } {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).formatToParts(new Date());
    const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '00';
    return {
      hour: Number(get('hour')) % 24,
      minute: Number(get('minute')),
      date: `${get('year')}-${get('month')}-${get('day')}`,
    };
  } catch {
    const now = new Date();
    return {
      hour: now.getHours(),
      minute: now.getMinutes(),
      date: now.toISOString().slice(0, 10),
    };
  }
}

/**
 * Is this reminder due?
 *
 * A window rather than an instant, because the scheduler ticks on a timer and a
 * tick can be late. Once per day is enforced by the date it last went out.
 */
export function isDue(entry: StoredSubscription, windowMinutes = 5): boolean {
  const now = localNow(entry.timeZone);
  if (entry.lastSentOn === now.date) return false;
  const wanted = entry.hour * 60 + entry.minute;
  const current = now.hour * 60 + now.minute;
  return current >= wanted && current - wanted < windowMinutes;
}

export async function sendDueReminders(userIds: string[]): Promise<number> {
  if (!ensureConfigured()) return 0;
  let sent = 0;

  for (const userId of userIds) {
    const file = await read(userId);
    let changed = false;

    for (const [key, entry] of Object.entries(file.subscriptions)) {
      if (!isDue(entry)) continue;
      try {
        await webpush.sendNotification(
          entry.subscription,
          JSON.stringify({
            title: 'Today’s outfit is ready',
            body: 'Open OutfitAI to see what to wear.',
            url: '/',
          }),
        );
        entry.lastSentOn = localNow(entry.timeZone).date;
        changed = true;
        sent += 1;
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        // 404 and 410 mean the browser threw the subscription away — the person
        // cleared their data or removed the app. Stop trying forever.
        if (status === 404 || status === 410) {
          delete file.subscriptions[key];
          changed = true;
        } else {
          console.warn(`[outfitai] reminder for ${userId} failed:`, status ?? error);
        }
      }
    }

    if (changed) await write(userId, file);
  }

  return sent;
}
