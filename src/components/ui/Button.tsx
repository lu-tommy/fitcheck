'use client';

import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';

import { cn } from '@/lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-[var(--brand)] text-[var(--on-brand)] border-transparent active:bg-[var(--brand-press)]',
  secondary: 'bg-[var(--surface)] text-[var(--text)] border-[var(--border-strong)]',
  ghost: 'bg-transparent text-[var(--text-muted)] border-transparent',
  danger: 'bg-[var(--danger-soft)] text-[var(--danger)] border-transparent',
};

const SIZES: Record<Size, string> = {
  sm: 'h-9 px-3.5 text-[0.8125rem] rounded-xl',
  md: 'h-11 px-4 text-[0.9375rem] rounded-2xl',
  lg: 'h-13 px-5 text-base rounded-2xl',
};

interface Shared {
  variant?: Variant;
  size?: Size;
  full?: boolean;
  icon?: ReactNode;
  children?: ReactNode;
  className?: string;
}

function classes({ variant = 'primary', size = 'md', full, className }: Shared): string {
  return cn(
    'pressable inline-flex items-center justify-center gap-2 border font-medium select-none',
    'disabled:opacity-45 disabled:pointer-events-none',
    VARIANTS[variant],
    SIZES[size],
    full && 'w-full',
    className,
  );
}

export function Button({
  variant,
  size,
  full,
  icon,
  children,
  className,
  ...rest
}: Shared & ComponentProps<'button'>) {
  return (
    <button className={classes({ variant, size, full, className })} {...rest}>
      {icon}
      {children}
    </button>
  );
}

export function ButtonLink({
  variant,
  size,
  full,
  icon,
  children,
  className,
  ...rest
}: Shared & ComponentProps<typeof Link>) {
  return (
    <Link className={classes({ variant, size, full, className })} {...rest}>
      {icon}
      {children}
    </Link>
  );
}
