'use client';

import type { ComponentProps, ReactNode } from 'react';

import { cn } from '@/lib/cn';

const CONTROL =
  'w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5 ' +
  'text-[0.9375rem] text-[var(--text)] placeholder:text-[var(--text-faint)] ' +
  'focus:border-[var(--brand)] focus:outline-none';

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label?: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn('block', className)}>
      {label ? (
        <span className="text-label mb-1.5 block text-[var(--text-muted)]">{label}</span>
      ) : null}
      {children}
      {hint ? <span className="mt-1 block text-xs text-[var(--text-faint)]">{hint}</span> : null}
    </label>
  );
}

export function Input({ className, ...rest }: ComponentProps<'input'>) {
  return <input className={cn(CONTROL, className)} {...rest} />;
}

export function Textarea({ className, ...rest }: ComponentProps<'textarea'>) {
  return <textarea className={cn(CONTROL, 'resize-none leading-relaxed', className)} {...rest} />;
}

export function Select({ className, children, ...rest }: ComponentProps<'select'>) {
  return (
    <select className={cn(CONTROL, 'appearance-none pr-9', className)} {...rest}>
      {children}
    </select>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="pressable flex w-full items-center justify-between gap-4 py-1 text-left"
    >
      <span className="min-w-0">
        <span className="block text-[0.9375rem] font-medium">{label}</span>
        {hint ? (
          <span className="mt-0.5 block text-[0.8125rem] text-[var(--text-muted)]">{hint}</span>
        ) : null}
      </span>
      <span
        className={cn(
          'relative h-7 w-12 shrink-0 rounded-full transition-colors duration-200',
          checked ? 'bg-[var(--brand)]' : 'bg-[var(--surface-sunken)]',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 size-6 rounded-full bg-white shadow transition-transform duration-200',
            checked ? 'translate-x-[1.375rem]' : 'translate-x-0.5',
          )}
        />
      </span>
    </button>
  );
}
