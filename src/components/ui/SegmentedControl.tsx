'use client';

import { cn } from '@/lib/cn';

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      className={cn(
        'flex gap-1 rounded-2xl border border-[var(--border)] bg-[var(--surface-alt)] p-1',
        className,
      )}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            role="tab"
            aria-selected={active}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              'pressable min-w-0 flex-1 truncate rounded-xl px-3 py-2 text-[0.8125rem] font-medium transition-colors',
              active
                ? 'bg-[var(--surface)] text-[var(--text)] shadow-sm'
                : 'text-[var(--text-muted)]',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
