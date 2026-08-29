'use client';

import {
  Archive,
  BarChart3,
  CalendarDays,
  ChevronRight,
  CloudOff,
  Download,
  Heart,
  LogOut,
  Luggage,
  Scissors,
  ShoppingBag,
  Upload,
  UserRound,
  WashingMachine,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

import { PageHeader } from '@/components/PageHeader';
import { ReminderSetting } from '@/components/ReminderSetting';
import { SyncStatus } from '@/components/SyncStatus';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { SectionHeader } from '@/components/ui/Feedback';
import { Field, Input, Switch } from '@/components/ui/Field';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Sheet } from '@/components/ui/Sheet';
import { STYLES, STYLE_LABEL } from '@/domain/taxonomy';
import { demoWardrobe } from '@/domain/seed';
import { clearAll, estimateUsage } from '@/db';
import { BACKUP_STALE_DAYS, daysSinceBackup, importBackup, runBackup } from '@/lib/backup';
import { persistenceState, type PersistenceState } from '@/lib/persistence';
import { useAuth } from '@/store/auth';
import { COLOR_NAMES, swatches } from '@/lib/palette';
import { titleCase, pluralize } from '@/lib/format';
import { useCloset } from '@/store/closet';
import { useOutfits } from '@/store/outfits';
import { usePreferences } from '@/store/preferences';
import { toast } from '@/store/toast';
import type { BackgroundRemovalMode, Style, ThemeMode, Units } from '@/types';

const LINKS = [
  { href: '/calendar', label: 'Calendar', hint: 'Plan what you wear', icon: CalendarDays },
  { href: '/packing', label: 'Packing', hint: 'Build a suitcase', icon: Luggage },
  { href: '/laundry', label: 'Laundry', hint: 'What is clean', icon: WashingMachine },
  { href: '/stats', label: 'Statistics', hint: 'What you actually wear', icon: BarChart3 },
  { href: '/shop', label: 'Before you buy', hint: 'Will it go with what you own?', icon: ShoppingBag },
  { href: '/wishlist', label: 'Wishlist', hint: 'Things you are thinking of buying', icon: Heart },
  { href: '/closet/archive', label: 'Archive', hint: 'Kept, but out of rotation', icon: Archive },
] as const;

export default function ProfilePage() {
  const { items, addItems } = useCloset();
  const outfits = useOutfits((state) => state.outfits);
  const { preferences, update, setTheme } = usePreferences();
  const { status: authStatus, username: accountName, leave } = useAuth();

  const [usage, setUsage] = useState<{ usage: number; quota: number } | null>(null);
  const [persisted, setPersisted] = useState<PersistenceState>('unknown');
  const [confirmClear, setConfirmClear] = useState(false);
  const [working, setWorking] = useState(false);
  const importInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void estimateUsage().then(setUsage);
    void persistenceState().then(setPersisted);
  }, [items.length]);

  const backupAge = daysSinceBackup(preferences.lastBackupAt);

  const toggleStyle = (style: Style) =>
    update({
      preferredStyles: preferences.preferredStyles.includes(style)
        ? preferences.preferredStyles.filter((entry) => entry !== style)
        : [...preferences.preferredStyles, style],
    });

  const toggleAvoid = (color: string) =>
    update({
      avoidColors: preferences.avoidColors.includes(color)
        ? preferences.avoidColors.filter((entry) => entry !== color)
        : [...preferences.avoidColors, color],
    });

  return (
    <div className="pb-6">
      <PageHeader
        title={preferences.displayName ? `Hi, ${preferences.displayName}` : 'You'}
        subtitle={`${pluralize(items.length, 'piece')} · ${pluralize(outfits.length, 'outfit')}`}
      />

      <div className="space-y-7 px-5">
        <section>
          <SectionHeader title="Account" />
          {authStatus === 'signed-in' ? (
            <div className="space-y-3">
              <SyncStatus />
              <div className="card flex items-center gap-3 p-4">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[var(--surface-alt)] text-[var(--text-muted)]">
                  <UserRound size={17} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[0.9375rem] font-medium">
                    {accountName}
                  </span>
                  <span className="block text-[0.8125rem] text-[var(--text-muted)]">
                    Signed in on this device
                  </span>
                </span>
                <Button
                  size="sm"
                  variant="secondary"
                  icon={<LogOut size={15} />}
                  onClick={async () => {
                    await leave();
                    toast('Signed out — your wardrobe stays on this device');
                  }}
                >
                  Sign out
                </Button>
              </div>
            </div>
          ) : (
            <div className="card flex items-start gap-3 p-4">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[var(--surface-alt)] text-[var(--text-muted)]">
                <CloudOff size={17} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[0.9375rem] font-medium">Checking your account…</span>
                <span className="mt-0.5 block text-[0.8125rem] leading-relaxed text-[var(--text-muted)]">
                  If this stays here, the connection to the server dropped. Your wardrobe on this
                  device is untouched.
                </span>
              </span>
            </div>
          )}
        </section>

        <nav className="card divide-y divide-[var(--border)]">
          {LINKS.map((link) => {
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className="pressable flex items-center gap-3 px-4 py-3.5"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[var(--surface-alt)] text-[var(--text-muted)]">
                  <Icon size={17} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[0.9375rem] font-medium">{link.label}</span>
                  <span className="block text-[0.8125rem] text-[var(--text-muted)]">
                    {link.hint}
                  </span>
                </span>
                <ChevronRight size={17} className="shrink-0 text-[var(--text-faint)]" />
              </Link>
            );
          })}
        </nav>

        <section>
          <SectionHeader title="Appearance" />
          <div className="card space-y-4 p-4">
            <Field label="Theme">
              <SegmentedControl<ThemeMode>
                value={preferences.themeMode}
                onChange={(mode) => void setTheme(mode)}
                options={[
                  { value: 'light', label: 'Light' },
                  { value: 'dark', label: 'Dark' },
                  { value: 'system', label: 'System' },
                ]}
              />
            </Field>
            <Field label="Temperature">
              <SegmentedControl<Units>
                value={preferences.units}
                onChange={(units) => void update({ units })}
                options={[
                  { value: 'metric', label: 'Celsius' },
                  { value: 'imperial', label: 'Fahrenheit' },
                ]}
              />
            </Field>
            <Field label="Your name" hint="Only used to say hello.">
              <Input
                value={preferences.displayName ?? ''}
                onChange={(event) => void update({ displayName: event.target.value })}
                placeholder="Optional"
              />
            </Field>
          </div>
        </section>

        <section>
          <SectionHeader title="Styling" />
          <div className="card space-y-5 p-4">
            <div>
              <span className="text-label mb-2 block text-[var(--text-muted)]">
                Styles you lean towards
              </span>
              <div className="flex flex-wrap gap-2">
                {STYLES.map((style) => (
                  <Chip
                    key={style}
                    selected={preferences.preferredStyles.includes(style)}
                    onClick={() => void toggleStyle(style)}
                  >
                    {STYLE_LABEL[style]}
                  </Chip>
                ))}
              </div>
            </div>
            <div>
              <span className="text-label mb-2 block text-[var(--text-muted)]">
                Colours to avoid
              </span>
              <div className="flex flex-wrap gap-2">
                {COLOR_NAMES.map((color) => (
                  <Chip
                    key={color}
                    swatch={swatches[color]}
                    selected={preferences.avoidColors.includes(color)}
                    onClick={() => void toggleAvoid(color)}
                  >
                    {titleCase(color)}
                  </Chip>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section>
          <SectionHeader title="Photos" />
          <div className="card space-y-4 p-4">
            <Field
              label="Background removal"
              hint="On-device works against a plain wall or floor and never uploads anything. The provider option needs CUTOUT_API_URL and CUTOUT_API_KEY on the server."
            >
              <SegmentedControl<BackgroundRemovalMode>
                value={preferences.backgroundRemoval}
                onChange={(mode) => void update({ backgroundRemoval: mode })}
                options={[
                  { value: 'off', label: 'Off' },
                  { value: 'local', label: 'On device' },
                  { value: 'api', label: 'Provider' },
                ]}
              />
            </Field>
            <p className="flex items-start gap-2 text-[0.8125rem] leading-relaxed text-[var(--text-muted)]">
              <Scissors size={15} className="mt-0.5 shrink-0" />
              Photos are downscaled to 1400px before they are stored, so a large closet still fits
              in the browser.
            </p>
          </div>
        </section>

        <section>
          <SectionHeader title="Your data" />
          <div className="card space-y-4 p-4">
            <p className="text-[0.875rem] leading-relaxed text-[var(--text-muted)]">
              Everything lives in this browser — no account, no server copy. Clearing site data
              deletes it, so export a backup before you do.
              {usage
                ? ` Currently using ${formatBytes(usage.usage)}${
                    usage.quota ? ` of about ${formatBytes(usage.quota)}` : ''
                  }.`
                : ''}
            </p>

            <div className="space-y-2 rounded-2xl bg-[var(--surface-alt)] p-3">
              <StatusLine
                ok={persisted === 'persisted'}
                label={
                  persisted === 'persisted'
                    ? 'Storage marked as permanent'
                    : persisted === 'unsupported'
                      ? 'This browser cannot mark storage permanent'
                      : 'Storage can be cleared automatically'
                }
                hint={
                  persisted === 'persisted'
                    ? 'The browser will not clear it to reclaim space.'
                    : 'Add FitCheck to your home screen and this usually flips on.'
                }
              />
              <StatusLine
                ok={backupAge !== null && backupAge < BACKUP_STALE_DAYS}
                label={
                  backupAge === null
                    ? 'Never backed up'
                    : backupAge === 0
                      ? 'Backed up today'
                      : `Backed up ${pluralize(backupAge, 'day')} ago`
                }
                hint={
                  backupAge !== null && backupAge < BACKUP_STALE_DAYS
                    ? 'Recent enough.'
                    : 'Export a copy — it is the only thing that survives a cleared browser.'
                }
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="secondary"
                icon={<Download size={16} />}
                disabled={working}
                onClick={async () => {
                  setWorking(true);
                  try {
                    const stamp = await runBackup();
                    await update({ lastBackupAt: stamp });
                    toast('Backup downloaded', { tone: 'success' });
                  } catch {
                    toast('Could not write the backup file', { tone: 'danger' });
                  } finally {
                    setWorking(false);
                  }
                }}
              >
                Export
              </Button>
              <Button
                variant="secondary"
                icon={<Upload size={16} />}
                disabled={working}
                onClick={() => importInput.current?.click()}
              >
                Import
              </Button>
            </div>

            <input
              ref={importInput}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                event.target.value = '';
                if (!file) return;
                setWorking(true);
                try {
                  const summary = await importBackup(file);
                  toast(
                    `Imported ${pluralize(summary.items, 'piece')} and ${pluralize(summary.outfits, 'outfit')} — reloading`,
                    { tone: 'success' },
                  );
                  setTimeout(() => window.location.reload(), 900);
                } catch (error) {
                  toast((error as Error).message, { tone: 'danger' });
                } finally {
                  setWorking(false);
                }
              }}
            />

            <ReminderSetting />

            {!items.length ? (
              <Button
                variant="secondary"
                full
                onClick={async () => {
                  await addItems(demoWardrobe());
                  toast('Demo wardrobe loaded', { tone: 'success' });
                }}
              >
                Load a demo wardrobe
              </Button>
            ) : null}

            <Button variant="danger" full onClick={() => setConfirmClear(true)}>
              Delete everything
            </Button>
          </div>
        </section>

        <p className="pb-2 text-center text-[0.75rem] text-[var(--text-faint)]">
          FitCheck — web preview
        </p>
      </div>

      <Sheet
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        title="Delete everything?"
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" full onClick={() => setConfirmClear(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              full
              onClick={async () => {
                await clearAll();
                window.location.href = '/';
              }}
            >
              Delete it all
            </Button>
          </div>
        }
      >
        <p className="py-2 text-[0.9375rem] leading-relaxed text-[var(--text-muted)]">
          Every piece, photo, outfit, plan and setting is removed from this browser. There is no
          server copy, so this cannot be undone unless you exported a backup first.
        </p>
      </Sheet>
    </div>
  );
}

function StatusLine({ ok, label, hint }: { ok: boolean; label: string; hint: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <span
        aria-hidden
        className={`mt-1.5 size-2 shrink-0 rounded-full ${
          ok ? 'bg-[var(--success)]' : 'bg-[var(--warning)]'
        }`}
      />
      <span className="min-w-0">
        <span className="block text-[0.875rem] font-medium">{label}</span>
        <span className="block text-[0.8125rem] text-[var(--text-muted)]">{hint}</span>
      </span>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}
