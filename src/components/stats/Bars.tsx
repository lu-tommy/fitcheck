'use client';

import { hexToHsl } from '@/domain/color';
import { cn } from '@/lib/cn';

/**
 * A horizontal bar row.
 *
 * Single-series throughout the stats screen, so there is no legend: every row
 * carries its own label and the value sits at the tip. The bar is capped thin,
 * rounded only at the data end, and grows from one baseline.
 */
export function BarRow({
  label,
  sublabel,
  value,
  max,
  display,
  color,
  swatch,
}: {
  label: string;
  sublabel?: string;
  value: number;
  max: number;
  display?: string;
  /** Fill colour. Defaults to the brand accent. */
  color?: string;
  /** Shown before the label when the colour itself is the datum. */
  swatch?: string;
}) {
  const share = max > 0 ? Math.max(value > 0 ? 0.035 : 0, value / max) : 0;
  // A bar drawn in the colour it counts disappears when that colour is the
  // surface — black in dark mode, white in light. A hairline keeps it readable
  // without changing the fill, which is the datum.
  const needsEdge = color ? isExtremeLightness(color) : false;

  return (
    <div className="py-2">
      <div className="mb-1.5 flex items-baseline gap-2">
        {swatch ? (
          <span
            aria-hidden
            className="size-3 shrink-0 translate-y-px rounded-full border border-[var(--border-strong)]"
            style={{ background: swatch }}
          />
        ) : null}
        <span className="min-w-0 flex-1 truncate text-[0.875rem]">{label}</span>
        {sublabel ? (
          <span className="shrink-0 text-[0.75rem] text-[var(--text-faint)]">{sublabel}</span>
        ) : null}
        <span className="shrink-0 text-[0.8125rem] font-semibold tabular-nums text-[var(--text-muted)]">
          {display ?? value}
        </span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-l-[1px] bg-[var(--surface-sunken)]">
        <div
          className="h-full rounded-r-[4px]"
          style={{
            width: `${share * 100}%`,
            background: color ?? 'var(--brand)',
            boxShadow: needsEdge ? 'inset 0 0 0 1px var(--border-strong)' : undefined,
          }}
        />
      </div>
    </div>
  );
}

function isExtremeLightness(hex: string): boolean {
  try {
    const { l } = hexToHsl(hex);
    return l < 24 || l > 86;
  } catch {
    return false;
  }
}

export function StatTile({
  label,
  value,
  hint,
  className,
}: {
  label: string;
  value: string;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={cn('card p-4', className)}>
      <p className="text-[0.8125rem] text-[var(--text-muted)]">{label}</p>
      <p className="mt-1 text-[1.75rem] leading-none font-semibold">{value}</p>
      {hint ? <p className="mt-1.5 text-[0.75rem] text-[var(--text-faint)]">{hint}</p> : null}
    </div>
  );
}
