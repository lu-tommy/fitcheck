'use client';

import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';
import { WardrobeMark } from '@/components/WardrobeMark';

export function EmptyState({
  icon,
  illustration,
  title,
  body,
  action,
  className,
}: {
  icon?: ReactNode;
  /**
   * Use on the screens somebody actually lands on with nothing yet — a lay of
   * line-drawn garments says "this is what goes here" where an icon in a grey
   * square only says "empty".
   */
  illustration?: boolean;
  title: string;
  body?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center px-6 py-14 text-center', className)}>
      {illustration ? (
        <WardrobeMark className="mb-6 max-w-[13rem] text-[var(--border-strong)]" />
      ) : icon ? (
        <div className="mb-4 grid size-14 place-items-center rounded-2xl bg-[var(--surface-alt)] text-[var(--text-faint)]">
          {icon}
        </div>
      ) : null}
      <h3 className="text-title">{title}</h3>
      {body ? (
        <p className="mt-1.5 max-w-xs text-[0.9375rem] leading-relaxed text-[var(--text-muted)]">
          {body}
        </p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function Spinner({ className, label }: { className?: string; label?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)} role="status">
      <span
        aria-hidden
        className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent opacity-70"
      />
      {label ? <span className="text-[0.8125rem]">{label}</span> : null}
      <span className="sr-only">{label ?? 'Loading'}</span>
    </span>
  );
}

export function SkeletonTile({ className }: { className?: string }) {
  return <div className={cn('skeleton rounded-[var(--radius-tile)]', className)} />;
}

export function SectionHeader({
  title,
  action,
  className,
}: {
  title: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('mb-3 flex items-baseline justify-between gap-3', className)}>
      <h2 className="text-heading">{title}</h2>
      {action}
    </div>
  );
}
