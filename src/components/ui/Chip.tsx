'use client';

import type { ComponentProps, ReactNode } from 'react';

import { cn } from '@/lib/cn';

interface ChipProps extends Omit<ComponentProps<'button'>, 'children'> {
  selected?: boolean;
  children: ReactNode;
  /** A colour swatch shown before the label, for colour filters. */
  swatch?: string;
}

export function Chip({ selected, children, swatch, className, ...rest }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        'pressable inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5',
        'text-[0.8125rem] font-medium whitespace-nowrap',
        selected
          ? 'border-transparent bg-[var(--brand)] text-[var(--on-brand)]'
          : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)]',
        className,
      )}
      {...rest}
    >
      {swatch ? (
        <span
          aria-hidden
          className="size-3 rounded-full border border-[var(--border-strong)]"
          style={{ background: swatch }}
        />
      ) : null}
      {children}
    </button>
  );
}

export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode;
  tone?: 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info';
  className?: string;
}) {
  const tones = {
    neutral: 'bg-[var(--surface-alt)] text-[var(--text-muted)]',
    brand: 'bg-[var(--brand-soft)] text-[var(--brand)]',
    success: 'bg-[var(--success-soft)] text-[var(--success)]',
    warning: 'bg-[var(--warning-soft)] text-[var(--warning)]',
    danger: 'bg-[var(--danger-soft)] text-[var(--danger)]',
    info: 'bg-[var(--info-soft)] text-[var(--info)]',
  } as const;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
