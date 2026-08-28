'use client';

import { isStandalone, platform } from '@/lib/persistence';

/**
 * Turning the daily reminder on.
 *
 * Three things have to line up, and the UI has to be able to say which one is
 * missing rather than showing a switch that quietly does nothing: the browser
 * must support push, the person must grant permission, and on iOS the app must
 * be on the home screen — Safari refuses push to a site open in a tab.
 */

export type ReminderState =
  | 'ready'
  | 'off'
  | 'needs-permission'
  | 'denied'
  | 'needs-install'
  | 'unsupported'
  | 'not-configured';

export function pushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/** Why the reminder cannot be switched on, if it cannot. */
export function blockedBy(): ReminderState | null {
  if (!pushSupported()) {
    // iOS only exposes push to an installed app, so the honest answer there is
    // "add it to your home screen", not "your browser cannot do this".
    return platform() === 'ios' && !isStandalone() ? 'needs-install' : 'unsupported';
  }
  if (platform() === 'ios' && !isStandalone()) return 'needs-install';
  if (Notification.permission === 'denied') return 'denied';
  return null;
}

async function serverKey(): Promise<string | null> {
  try {
    const response = await fetch('/api/push/subscribe', { credentials: 'same-origin' });
    if (!response.ok) return null;
    const data = (await response.json()) as { configured: boolean; publicKey: string | null };
    return data.configured ? data.publicKey : null;
  } catch {
    return null;
  }
}

/** The push service wants the key as bytes, not as the base64url it ships in. */
function decodeKey(base64: string): ArrayBuffer {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4))
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const raw = atob(padded);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes.buffer;
}

export async function currentState(): Promise<ReminderState> {
  const blocker = blockedBy();
  if (blocker) return blocker;
  if (!(await serverKey())) return 'not-configured';
  if (Notification.permission !== 'granted') return 'needs-permission';

  const registration = await navigator.serviceWorker.getRegistration();
  const existing = await registration?.pushManager.getSubscription();
  return existing ? 'ready' : 'off';
}

export async function enableReminder(hour: number, minute: number): Promise<ReminderState> {
  const blocker = blockedBy();
  if (blocker) return blocker;

  const key = await serverKey();
  if (!key) return 'not-configured';

  if (Notification.permission !== 'granted') {
    const outcome = await Notification.requestPermission();
    if (outcome !== 'granted') return outcome === 'denied' ? 'denied' : 'needs-permission';
  }

  const registration = await navigator.serviceWorker.ready;
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      // Required by every browser: a push must always show something.
      userVisibleOnly: true,
      applicationServerKey: decodeKey(key),
    }));

  const response = await fetch('/api/push/subscribe', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      subscription: subscription.toJSON(),
      // Sent so "half past seven" means their half past seven, not the NAS's.
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      hour,
      minute,
    }),
  });

  return response.ok ? 'ready' : 'not-configured';
}

export async function disableReminder(): Promise<void> {
  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return;

  await fetch('/api/push/unsubscribe', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ endpoint: subscription.endpoint }),
  }).catch(() => undefined);

  await subscription.unsubscribe();
}
