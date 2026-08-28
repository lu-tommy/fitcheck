'use client';

import { AlertTriangle, Check, CloudUpload, RefreshCw, TriangleAlert } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { formatRelative } from '@/lib/date';
import { cn } from '@/lib/cn';
import { useAuth } from '@/store/auth';
import { useSync } from '@/store/sync';

/** The honest answer to "is her stuff safe right now?". */
export function SyncStatus({ className }: { className?: string }) {
  const userId = useAuth((state) => state.userId);
  const { status, lastSyncedAt, lastReport, error, foreignWardrobe, sync, adoptLocalWardrobe } =
    useSync();
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  if (!userId) return null;

  const tone =
    status === 'error' ? 'danger' : status === 'syncing' ? 'info' : !online ? 'warning' : 'success';

  return (
    <div className={cn('card p-4', className)}>
      <div className="flex items-start gap-3">
        <span
          className={cn(
            'grid size-9 shrink-0 place-items-center rounded-xl',
            tone === 'danger' && 'bg-[var(--danger-soft)] text-[var(--danger)]',
            tone === 'info' && 'bg-[var(--info-soft)] text-[var(--info)]',
            tone === 'warning' && 'bg-[var(--warning-soft)] text-[var(--warning)]',
            tone === 'success' && 'bg-[var(--success-soft)] text-[var(--success)]',
          )}
        >
          {status === 'syncing' ? (
            <RefreshCw size={17} className="animate-spin" />
          ) : status === 'error' ? (
            <AlertTriangle size={17} />
          ) : !online ? (
            <CloudUpload size={17} />
          ) : (
            <Check size={17} />
          )}
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-[0.9375rem] font-medium">
            {status === 'syncing'
              ? 'Backing up…'
              : status === 'error'
                ? 'Last backup did not finish'
                : !online
                  ? 'Offline — will back up when you reconnect'
                  : lastSyncedAt
                    ? `Backed up ${formatRelative(lastSyncedAt).toLowerCase()}`
                    : 'Waiting to back up'}
          </p>
          <p className="mt-0.5 text-[0.8125rem] leading-relaxed text-[var(--text-muted)]">
            {status === 'error'
              ? `${error} Your wardrobe on this device is untouched — nothing has been lost.`
              : lastReport
                ? `${lastReport.pushed} sent, ${lastReport.pulled} received, ${lastReport.photosUploaded} photos uploaded.`
                : 'Everything you add is copied to your account automatically.'}
          </p>
        </div>
      </div>

      {foreignWardrobe ? (
        <div className="mt-3 space-y-2 rounded-2xl bg-[var(--warning-soft)] p-3">
          <p className="flex items-start gap-2 text-[0.8125rem] leading-relaxed text-[var(--warning)]">
            <TriangleAlert size={15} className="mt-0.5 shrink-0" />
            This device still holds a wardrobe from a different account, so nothing local is being
            uploaded. Nothing has been deleted.
          </p>
          <Button size="sm" full onClick={() => void adoptLocalWardrobe(userId)}>
            Merge it into this account
          </Button>
        </div>
      ) : null}

      {status === 'error' || (!lastSyncedAt && online) ? (
        <Button
          variant="secondary"
          full
          size="sm"
          className="mt-3"
          disabled={status === 'syncing'}
          onClick={() => void sync(userId)}
        >
          Back up now
        </Button>
      ) : null}
    </div>
  );
}
