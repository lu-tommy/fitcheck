'use client';

import { RotateCw } from 'lucide-react';
import { useEffect } from 'react';

import { Button, ButtonLink } from '@/components/ui/Button';

/**
 * A render crash used to show a blank page, which is indistinguishable from
 * losing everything. It is not: the wardrobe is in IndexedDB and this screen
 * never touches it. Saying so is most of the job.
 */
export default function ErrorScreen({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[outfitai] screen crashed:', error);
  }, [error]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-5 px-6 text-center">
      <div className="grid size-14 place-items-center rounded-2xl bg-[var(--danger-soft)] text-[var(--danger)]">
        <RotateCw size={24} />
      </div>
      <div className="space-y-2">
        <h1 className="text-title">This screen stopped working</h1>
        <p className="mx-auto max-w-sm text-[0.9375rem] leading-relaxed text-[var(--text-muted)]">
          Your closet is safe — it lives in this browser&rsquo;s storage and nothing here can touch
          it. Only this screen failed.
        </p>
      </div>
      <div className="flex w-full max-w-xs flex-col gap-2">
        <Button full onClick={reset}>
          Try again
        </Button>
        <ButtonLink href="/" variant="secondary" full>
          Go to the home screen
        </ButtonLink>
      </div>
      {error.digest ? (
        <p className="font-mono text-[0.75rem] text-[var(--text-faint)]">{error.digest}</p>
      ) : null}
    </div>
  );
}
