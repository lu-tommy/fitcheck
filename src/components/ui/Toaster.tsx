'use client';

import { cn } from '@/lib/cn';
import { useToasts } from '@/store/toast';

export function Toaster() {
  const toasts = useToasts((state) => state.toasts);
  const dismiss = useToasts((state) => state.dismiss);

  if (!toasts.length) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-60 flex flex-col items-center gap-2 px-4"
      style={{ bottom: 'calc(env(safe-area-inset-bottom) + 5.75rem)' }}
      aria-live="polite"
    >
      {toasts.map((entry) => (
        <div
          key={entry.id}
          className={cn(
            'rise pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-2xl border px-4 py-3',
            'shadow-[var(--shadow-raised)]',
            entry.tone === 'success'
              ? 'border-transparent bg-[var(--success)] text-white'
              : entry.tone === 'danger'
                ? 'border-transparent bg-[var(--danger)] text-white'
                : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text)]',
          )}
        >
          <span className="min-w-0 flex-1 text-[0.875rem]">{entry.message}</span>
          {entry.action ? (
            <button
              type="button"
              className="pressable shrink-0 text-[0.8125rem] font-semibold underline underline-offset-2"
              onClick={() => {
                entry.action?.run();
                dismiss(entry.id);
              }}
            >
              {entry.action.label}
            </button>
          ) : null}
        </div>
      ))}
    </div>
  );
}
