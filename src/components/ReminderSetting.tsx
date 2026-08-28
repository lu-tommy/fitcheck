'use client';

import { useCallback, useEffect, useState } from 'react';

import { Select } from '@/components/ui/Field';
import { Switch } from '@/components/ui/Field';
import {
  currentState,
  disableReminder,
  enableReminder,
  type ReminderState,
} from '@/lib/notifications';
import { useAuth } from '@/store/auth';
import { usePreferences } from '@/store/preferences';
import { toast } from '@/store/toast';

/**
 * The daily reminder.
 *
 * Every state says what is actually true. A toggle that turns on and does
 * nothing is worse than no toggle at all, so where it cannot work this explains
 * which of the three requirements is missing.
 */

const EXPLANATION: Record<ReminderState, string> = {
  ready: 'You will get one notification a day at this time.',
  off: 'A single notification each morning, to pick the day’s outfit.',
  'needs-permission': 'A single notification each morning. Your browser will ask first.',
  denied:
    'Notifications are blocked for this site. Turn them back on in your browser settings, then come back.',
  'needs-install':
    'Add OutfitAI to your home screen first — iOS only allows notifications for installed apps.',
  unsupported: 'This browser cannot do notifications.',
  'not-configured':
    'Reminders are not set up on the server. Add VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY and restart.',
};

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);
const MINUTES = [0, 15, 30, 45];

export function ReminderSetting() {
  const signedIn = useAuth((state) => state.status === 'signed-in');
  const { preferences, update } = usePreferences();
  const [state, setState] = useState<ReminderState>('off');
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => {
    void currentState().then(setState);
  }, []);

  useEffect(refresh, [refresh]);

  const { hour, minute } = preferences.dailySuggestion;
  const usable = state === 'ready' || state === 'off' || state === 'needs-permission';

  async function toggle(next: boolean) {
    setBusy(true);
    try {
      if (!next) {
        await disableReminder();
        await update({ dailySuggestion: { ...preferences.dailySuggestion, enabled: false } });
        setState('off');
        toast('Daily reminder off');
        return;
      }
      const outcome = await enableReminder(hour, minute);
      setState(outcome);
      if (outcome === 'ready') {
        await update({ dailySuggestion: { ...preferences.dailySuggestion, enabled: true } });
        toast('Reminder set', { tone: 'success' });
      } else {
        toast(EXPLANATION[outcome], { tone: 'danger' });
      }
    } finally {
      setBusy(false);
    }
  }

  async function reschedule(nextHour: number, nextMinute: number) {
    await update({
      dailySuggestion: { ...preferences.dailySuggestion, hour: nextHour, minute: nextMinute },
    });
    // Re-subscribing is how the server learns the new time.
    if (state === 'ready') await enableReminder(nextHour, nextMinute);
  }

  if (!signedIn) {
    return (
      <div className="py-1">
        <p className="text-[0.9375rem] font-medium">Daily reminder</p>
        <p className="mt-0.5 text-[0.8125rem] leading-relaxed text-[var(--text-muted)]">
          Sign in to get one — the reminder is sent by the server, so it needs to know who you are.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Switch
        checked={state === 'ready'}
        onChange={(next) => void toggle(next)}
        label={busy ? 'Just a moment…' : 'Daily reminder'}
        hint={EXPLANATION[state]}
      />

      {state === 'ready' ? (
        <div className="grid grid-cols-2 gap-3">
          <Select
            aria-label="Hour"
            value={String(hour)}
            onChange={(event) => void reschedule(Number(event.target.value), minute)}
          >
            {HOURS.map((value) => (
              <option key={value} value={value}>
                {String(value).padStart(2, '0')}
              </option>
            ))}
          </Select>
          <Select
            aria-label="Minute"
            value={String(minute)}
            onChange={(event) => void reschedule(hour, Number(event.target.value))}
          >
            {MINUTES.map((value) => (
              <option key={value} value={value}>
                {String(value).padStart(2, '0')}
              </option>
            ))}
          </Select>
        </div>
      ) : null}
    </div>
  );
}
