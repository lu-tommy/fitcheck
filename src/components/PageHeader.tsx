'use client';

import { ChevronLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

/**
 * The standard screen top. `back` renders a chevron that uses real history, so
 * it matches what the phone's own back gesture does rather than forcing a route.
 */
export function PageHeader({
  title,
  subtitle,
  back,
  action,
  large = true,
  className,
}: {
  title: string;
  subtitle?: string;
  back?: boolean;
  action?: ReactNode;
  large?: boolean;
  className?: string;
}) {
  const router = useRouter();

  return (
    <header
      className={cn('px-5 pb-3', className)}
      style={{ paddingTop: 'calc(env(safe-area-inset-top) + 1.25rem)' }}
    >
      <div className="flex items-start gap-3">
        {back ? (
          <button
            type="button"
            onClick={() => router.back()}
            aria-label="Back"
            className="pressable -ml-1 mt-0.5 grid size-9 shrink-0 place-items-center rounded-full bg-[var(--surface-alt)] text-[var(--text)]"
          >
            <ChevronLeft size={20} />
          </button>
        ) : null}
        <div className="min-w-0 flex-1">
          <h1 className={large ? 'text-display' : 'text-title'}>{title}</h1>
          {subtitle ? (
            <p className="mt-1 text-[0.9375rem] text-[var(--text-muted)]">{subtitle}</p>
          ) : null}
        </div>
        {action ? <div className="mt-0.5 shrink-0">{action}</div> : null}
      </div>
    </header>
  );
}
