'use client';

import { Download, Share, ShieldCheck, X } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/Button';
import {
  BACKUP_STALE_DAYS,
  daysSinceBackup,
  runBackup,
} from '@/lib/backup';
import {
  captureInstallPrompt,
  hasInstallPrompt,
  isStandalone,
  platform,
  showInstallPrompt,
  type Platform,
} from '@/lib/persistence';
import { pluralize } from '@/lib/format';
import { useAuth } from '@/store/auth';
import { useCloset } from '@/store/closet';
import { usePreferences } from '@/store/preferences';
import { toast } from '@/store/toast';

/**
 * The one card that stands between a wardrobe and losing it.
 *
 * Two jobs, shown one at a time so the home screen never turns into a nag
 * board: get the app onto the home screen — which is what exempts it from
 * Safari's seven-day storage sweep — and keep a recent backup on disk.
 */
export function SafetyCard() {
  const items = useCloset((state) => state.items);
  const signedIn = useAuth((state) => state.status === 'signed-in');
  const { preferences, update } = usePreferences();
  const [standalone, setStandalone] = useState(true);
  const [promptable, setPromptable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setStandalone(isStandalone());
    setPromptable(hasInstallPrompt());
    return captureInstallPrompt(() => setPromptable(true));
  }, []);

  // Nothing to protect yet — do not ask for anything on an empty closet.
  if (items.length < 5) return null;

  const showInstall = !standalone && !preferences.installPromptDismissed;
  const age = daysSinceBackup(preferences.lastBackupAt);
  // With an account, the wardrobe is already copied off the device; nagging for
  // a manual export on top of that is noise.
  const backupOverdue =
    !signedIn && (age === null ? items.length >= 12 : age >= BACKUP_STALE_DAYS);

  if (showInstall) {
    return (
      <InstallCard
        platform={platform()}
        promptable={promptable}
        expanded={expanded}
        onExpand={() => setExpanded(true)}
        onInstall={async () => {
          const outcome = await showInstallPrompt();
          if (outcome === 'accepted') {
            toast('Installed — your wardrobe is safe from browser clean-ups', { tone: 'success' });
            setStandalone(true);
          }
        }}
        onDismiss={() => void update({ installPromptDismissed: true })}
      />
    );
  }

  if (!backupOverdue) return null;

  return (
    <section className="card border-[var(--warning)] p-4">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--warning-soft)] text-[var(--warning)]">
          <Download size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[0.9375rem] font-semibold">
            {age === null ? 'Back up your closet' : `Last backup was ${pluralize(age, 'day')} ago`}
          </h2>
          <p className="mt-1 text-[0.875rem] leading-relaxed text-[var(--text-muted)]">
            {pluralize(items.length, 'piece')} live only in this browser. One file keeps a copy of
            all of it, photos included.
          </p>
        </div>
      </div>
      <Button
        full
        className="mt-3"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            const stamp = await runBackup();
            await update({ lastBackupAt: stamp });
            toast('Backup saved to your downloads', { tone: 'success' });
          } catch {
            toast('Could not write the backup file', { tone: 'danger' });
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? 'Writing the file…' : 'Back up now'}
      </Button>
    </section>
  );
}

function InstallCard({
  platform: os,
  promptable,
  expanded,
  onExpand,
  onInstall,
  onDismiss,
}: {
  platform: Platform;
  promptable: boolean;
  expanded: boolean;
  onExpand: () => void;
  onInstall: () => void;
  onDismiss: () => void;
}) {
  /*
   * A slim bar, not a card. This matters — it is important, but it was the
   * largest thing on the home screen, pushing the actual product below the
   * fold on first run. Explaining why only once it has been tapped keeps the
   * reason available without spending the whole screen on it.
   */
  if (!expanded) {
    return (
      <section className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5">
        <ShieldCheck size={16} className="shrink-0 text-[var(--brand)]" />
        <span className="min-w-0 flex-1 text-[0.8125rem] leading-snug">
          Add to your home screen so nothing clears your wardrobe.
        </span>
        <button
          type="button"
          onClick={promptable ? onInstall : onExpand}
          className="pressable -my-3 shrink-0 px-2 py-3 text-[0.8125rem] font-semibold text-[var(--brand)]"
        >
          {promptable ? 'Install' : 'How'}
        </button>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Not now"
          className="pressable -my-2 -mr-1 grid size-10 shrink-0 place-items-center rounded-full text-[var(--text-faint)]"
        >
          <X size={15} />
        </button>
      </section>
    );
  }

  return (
    <section className="card p-4">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand)]">
          <ShieldCheck size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[0.9375rem] font-semibold">Add FitCheck to your home screen</h2>
          <p className="mt-1 text-[0.875rem] leading-relaxed text-[var(--text-muted)]">
            Browsers clear the storage of sites you have not opened in a while, and an installed
            app is exempt. It also opens without a connection, and it is the only way iOS will
            send you a reminder.
          </p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Not now"
          className="pressable -mt-1 -mr-1 grid size-8 shrink-0 place-items-center rounded-full text-[var(--text-faint)]"
        >
          <X size={16} />
        </button>
      </div>

      {promptable ? (
        <Button full className="mt-3" onClick={onInstall}>
          Install
        </Button>
      ) : os === 'ios' ? (
        expanded ? (
          <ol className="mt-3 space-y-2 rounded-2xl bg-[var(--surface-alt)] p-3.5 text-[0.875rem] leading-relaxed">
            <li className="flex gap-2.5">
              <span className="font-semibold text-[var(--brand)]">1</span>
              <span className="flex flex-wrap items-center gap-1.5">
                Tap the Share button
                <Share size={14} className="inline text-[var(--text-muted)]" />
                at the bottom of Safari.
              </span>
            </li>
            <li className="flex gap-2.5">
              <span className="font-semibold text-[var(--brand)]">2</span>
              <span>Scroll down and choose <strong>Add to Home Screen</strong>.</span>
            </li>
            <li className="flex gap-2.5">
              <span className="font-semibold text-[var(--brand)]">3</span>
              <span>Tap <strong>Add</strong>. Open it from the icon from now on.</span>
            </li>
          </ol>
        ) : (
          <Button full variant="secondary" className="mt-3" onClick={onExpand}>
            Show me how
          </Button>
        )
      ) : (
        <p className="mt-3 rounded-2xl bg-[var(--surface-alt)] p-3 text-[0.8125rem] leading-relaxed text-[var(--text-muted)]">
          In your browser&rsquo;s menu, look for <strong>Install</strong> or{' '}
          <strong>Add to Home screen</strong>.
        </p>
      )}
    </section>
  );
}
