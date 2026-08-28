'use client';

import { useCallback, useMemo, useRef, useState } from 'react';

import { ItemImage } from '@/components/closet/ItemImage';
import { resolveLayout } from '@/domain/collage';
import { cn } from '@/lib/cn';
import type { CollagePlacement, ClothingItem } from '@/types';

/**
 * The outfit as a flat lay.
 *
 * Read-only by default. When `onChange` is supplied the pieces can be dragged
 * and resized, and the arrangement is handed back so it can be saved with the
 * outfit — the same numbers then drive the shared image, so what you arrange is
 * exactly what you send.
 */
export function OutfitCollage({
  items,
  layout,
  onChange,
  onSelect,
  className,
}: {
  items: ClothingItem[];
  layout?: CollagePlacement[];
  onChange?: (next: CollagePlacement[]) => void;
  onSelect?: (item: ClothingItem) => void;
  className?: string;
}) {
  const surface = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: string; mode: 'move' | 'size'; grabX: number; grabY: number } | null>(
    null,
  );
  const moved = useRef(false);
  const [active, setActive] = useState<string | null>(null);

  const placements = useMemo(() => resolveLayout(items, layout), [items, layout]);
  const byId = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
  const editable = Boolean(onChange);
  /*
   * A read-only collage renders plain elements, not buttons. It is often
   * dropped inside something else clickable — the two options on the compare
   * screen, for one — and a button inside a button is invalid HTML that React
   * refuses to hydrate.
   */
  const interactive = editable || Boolean(onSelect);

  const fraction = useCallback((event: React.PointerEvent) => {
    const rect = surface.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: (event.clientX - rect.left) / rect.width,
      y: (event.clientY - rect.top) / rect.height,
    };
  }, []);

  function onPointerMove(event: React.PointerEvent) {
    const state = drag.current;
    if (!state || !onChange) return;
    event.preventDefault();
    moved.current = true;
    const { x, y } = fraction(event);

    onChange(
      placements.map((entry) => {
        if (entry.itemId !== state.id) return entry;
        if (state.mode === 'size') {
          const dx = Math.abs(x - entry.x) * 2;
          const dy = Math.abs(y - entry.y) * 2;
          return { ...entry, size: clamp(Math.max(dx, dy * 0.8), 0.08, 0.72) };
        }
        return {
          ...entry,
          x: clamp(x - state.grabX, 0.05, 0.95),
          y: clamp(y - state.grabY, 0.05, 0.95),
        };
      }),
    );
  }

  function endDrag() {
    drag.current = null;
  }

  return (
    <div
      ref={surface}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      className={cn(
        'relative aspect-4/5 w-full overflow-hidden rounded-[var(--radius-card)]',
        'border border-[var(--border)] bg-[var(--surface-alt)]',
        editable && 'touch-none',
        className,
      )}
    >
      {placements
        .slice()
        .sort((a, b) => a.z - b.z)
        .map((entry) => {
          const item = byId.get(entry.itemId);
          if (!item) return null;
          const selected = active === entry.itemId;

          return (
            <div
              key={entry.itemId}
              className="absolute"
              style={{
                left: `${entry.x * 100}%`,
                top: `${entry.y * 100}%`,
                width: `${entry.size * 100}%`,
                transform: `translate(-50%, -50%) rotate(${entry.rotation}deg)`,
                zIndex: entry.z,
              }}
            >
              {(() => {
                const face = (
                  <span className="block aspect-4/5 w-full bg-[var(--surface)]">
                    <ItemImage
                      item={item}
                      className="size-full"
                      fit={item.cutoutId ? 'contain' : 'cover'}
                      showLabel={entry.size > 0.2}
                    />
                  </span>
                );
                const shell = cn(
                  'block w-full overflow-hidden rounded-xl',
                  'shadow-[0_8px_20px_-10px_rgba(0,0,0,0.35)]',
                  selected && 'ring-2 ring-[var(--brand)]',
                );

                if (!interactive) {
                  return (
                    <span className={shell} aria-label={item.name} role="img">
                      {face}
                    </span>
                  );
                }

                return (
                  <button
                    type="button"
                    aria-label={item.name}
                    onPointerDown={(event) => {
                      if (!editable) return;
                      moved.current = false;
                      const { x, y } = fraction(event);
                      drag.current = {
                        id: entry.itemId,
                        mode: 'move',
                        grabX: x - entry.x,
                        grabY: y - entry.y,
                      };
                      setActive(entry.itemId);
                      (event.target as Element).setPointerCapture?.(event.pointerId);
                    }}
                    onClick={() => {
                      if (moved.current) return;
                      if (editable) setActive(entry.itemId);
                      else onSelect?.(item);
                    }}
                    className={shell}
                  >
                    {face}
                  </button>
                );
              })()}

              {editable && selected ? (
                <span
                  role="presentation"
                  onPointerDown={(event) => {
                    event.stopPropagation();
                    drag.current = { id: entry.itemId, mode: 'size', grabX: 0, grabY: 0 };
                    (event.target as Element).setPointerCapture?.(event.pointerId);
                  }}
                  className="absolute -right-2 -bottom-2 size-6 cursor-nwse-resize rounded-full border-2 border-white bg-[var(--brand)] shadow"
                />
              ) : null}
            </div>
          );
        })}

      {editable ? (
        <p className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/45 to-transparent p-3 text-center text-[0.75rem] text-white">
          Drag to move · tap a piece then use the corner to resize
        </p>
      ) : null}
    </div>
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
