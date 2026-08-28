'use client';

import { X } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

import { cn } from '@/lib/cn';

/**
 * A bottom sheet — the phone-shaped answer to a modal. It closes on Escape, on
 * a backdrop tap, and on the Back gesture, and it locks the page behind it so
 * scrolling the sheet does not scroll the list underneath.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // A sheet opened by a tap should take focus, or the next Tab lands behind it.
    panel.current?.focus();

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
        style={{ animation: 'rise 180ms ease both' }}
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cn(
          'relative flex max-h-[88dvh] w-full flex-col rounded-t-[1.75rem] border border-[var(--border)]',
          'bg-[var(--surface)] shadow-[var(--shadow-raised)] outline-none',
          'sm:max-w-lg sm:rounded-[1.75rem]',
        )}
        style={{ animation: 'rise 240ms cubic-bezier(0.2,0,0,1) both' }}
      >
        <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-2">
          <span aria-hidden className="absolute inset-x-0 top-2 mx-auto h-1 w-10 rounded-full bg-[var(--border-strong)] sm:hidden" />
          <h2 className="text-title mt-2 min-w-0 flex-1 truncate">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="pressable mt-2 grid size-9 shrink-0 place-items-center rounded-full bg-[var(--surface-alt)] text-[var(--text-muted)]"
          >
            <X size={17} />
          </button>
        </div>
        <div
          className="min-h-0 flex-1 overflow-y-auto px-5 pb-4"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {children}
        </div>
        {footer ? (
          <div
            className="border-t border-[var(--border)] px-5 pt-3"
            style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
          >
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
