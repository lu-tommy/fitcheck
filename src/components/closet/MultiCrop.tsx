'use client';

import { Trash2, Undo2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { MIN_BOX, normaliseBox, type CropBox } from '@/lib/crop';
import { createId } from '@/lib/id';
import { cn } from '@/lib/cn';
import { pluralize } from '@/lib/format';

type Drag =
  | { mode: 'draw'; id: string; originX: number; originY: number }
  | { mode: 'move'; id: string; grabX: number; grabY: number }
  | { mode: 'resize'; id: string };

/**
 * Draw a box around each garment in a photo.
 *
 * Deliberately manual. The person holding the phone already knows which shape
 * is the jacket, and asking them to drag four boxes is faster — and far more
 * reliable — than asking a model to guess and then correcting it.
 */
export function MultiCrop({
  file,
  onCancel,
  onConfirm,
}: {
  file: Blob;
  onCancel: () => void;
  onConfirm: (boxes: CropBox[]) => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [aspect, setAspect] = useState(3 / 4);
  const [boxes, setBoxes] = useState<CropBox[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const drag = useRef<Drag | null>(null);
  const surface = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    let cancelled = false;
    void createImageBitmap(file, { imageOrientation: 'from-image' }).then((bitmap) => {
      if (!cancelled) setAspect(bitmap.width / bitmap.height);
      bitmap.close();
    });
    return () => {
      cancelled = true;
      URL.revokeObjectURL(objectUrl);
    };
  }, [file]);

  /** Pointer position as a fraction of the image, which is what boxes store. */
  const pointToFraction = useCallback((event: React.PointerEvent) => {
    const rect = surface.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)),
    };
  }, []);

  function onPointerDown(event: React.PointerEvent) {
    if (event.button !== 0 && event.pointerType === 'mouse') return;
    const { x, y } = pointToFraction(event);
    const id = createId('box');
    drag.current = { mode: 'draw', id, originX: x, originY: y };
    setBoxes((current) => [...current, { id, x, y, width: 0, height: 0 }]);
    setActive(id);
    (event.target as Element).setPointerCapture?.(event.pointerId);
  }

  function onPointerMove(event: React.PointerEvent) {
    const state = drag.current;
    if (!state) return;
    event.preventDefault();
    const { x, y } = pointToFraction(event);

    setBoxes((current) =>
      current.map((box) => {
        if (box.id !== state.id) return box;
        if (state.mode === 'draw') {
          return { ...box, x: state.originX, y: state.originY, width: x - state.originX, height: y - state.originY };
        }
        if (state.mode === 'resize') {
          return { ...box, width: Math.max(MIN_BOX, x - box.x), height: Math.max(MIN_BOX, y - box.y) };
        }
        return {
          ...box,
          x: Math.max(0, Math.min(1 - box.width, x - state.grabX)),
          y: Math.max(0, Math.min(1 - box.height, y - state.grabY)),
        };
      }),
    );
  }

  function onPointerUp() {
    const state = drag.current;
    drag.current = null;
    if (!state) return;
    // A tap that never became a box is a tap, not an empty selection.
    setBoxes((current) =>
      current
        .map(normaliseBox)
        .filter((box) => box.width >= MIN_BOX && box.height >= MIN_BOX),
    );
  }

  const ready = boxes.filter((box) => box.width >= MIN_BOX && box.height >= MIN_BOX);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[var(--surface-sunken)]">
      <header
        className="flex items-center justify-between gap-3 px-5 pb-3"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 1rem)' }}
      >
        <div className="min-w-0">
          <h2 className="text-title truncate">Box each piece</h2>
          <p className="text-[0.8125rem] text-[var(--text-muted)]">
            {ready.length
              ? `${pluralize(ready.length, 'piece')} marked`
              : 'Drag a rectangle around one garment'}
          </p>
        </div>
        <div className="flex shrink-0 gap-1">
          {boxes.length ? (
            <button
              type="button"
              onClick={() => setBoxes((current) => current.slice(0, -1))}
              aria-label="Undo last box"
              className="pressable grid size-9 place-items-center rounded-full bg-[var(--surface-alt)]"
            >
              <Undo2 size={17} />
            </button>
          ) : null}
          <button
            type="button"
            onClick={onCancel}
            className="pressable rounded-full bg-[var(--surface-alt)] px-3.5 text-[0.875rem]"
          >
            Cancel
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 items-center justify-center px-4">
        <div
          ref={surface}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className="relative max-h-full w-full touch-none overflow-hidden rounded-2xl bg-black/20 select-none"
          style={{ aspectRatio: String(aspect) }}
        >
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element -- blob: URL
            <img
              src={url}
              alt="Photo being divided into pieces"
              draggable={false}
              className="pointer-events-none size-full object-contain"
            />
          ) : null}

          {boxes.map((box, index) => {
            const shape = normaliseBox(box);
            const selected = active === box.id;
            return (
              <div
                key={box.id}
                className={cn(
                  'absolute border-2',
                  selected ? 'border-[var(--brand)]' : 'border-white/90',
                )}
                style={{
                  left: `${shape.x * 100}%`,
                  top: `${shape.y * 100}%`,
                  width: `${shape.width * 100}%`,
                  height: `${shape.height * 100}%`,
                  boxShadow: '0 0 0 9999px rgba(0,0,0,0.02)',
                }}
                onPointerDown={(event) => {
                  event.stopPropagation();
                  const { x, y } = pointToFraction(event);
                  drag.current = {
                    mode: 'move',
                    id: box.id,
                    grabX: x - shape.x,
                    grabY: y - shape.y,
                  };
                  setActive(box.id);
                  (event.target as Element).setPointerCapture?.(event.pointerId);
                }}
              >
                <span className="absolute -top-px -left-px bg-[var(--brand)] px-1.5 py-0.5 text-[0.6875rem] font-semibold text-[var(--on-brand)]">
                  {index + 1}
                </span>

                <button
                  type="button"
                  aria-label={`Remove box ${index + 1}`}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation();
                    setBoxes((current) => current.filter((entry) => entry.id !== box.id));
                  }}
                  className="absolute -top-3 -right-3 grid size-7 place-items-center rounded-full bg-[var(--danger)] text-white shadow"
                >
                  <Trash2 size={13} />
                </button>

                <span
                  role="presentation"
                  onPointerDown={(event) => {
                    event.stopPropagation();
                    drag.current = { mode: 'resize', id: box.id };
                    setActive(box.id);
                    (event.target as Element).setPointerCapture?.(event.pointerId);
                  }}
                  className="absolute -right-2.5 -bottom-2.5 size-6 cursor-nwse-resize rounded-full border-2 border-white bg-[var(--brand)] shadow"
                />
              </div>
            );
          })}
        </div>
      </div>

      <div
        className="border-t border-[var(--border)] bg-[var(--bg)] px-5 pt-3"
        style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
      >
        <p className="mb-2.5 text-center text-[0.8125rem] leading-relaxed text-[var(--text-muted)]">
          Each box becomes its own item. Drag to move, use the corner to resize.
        </p>
        <Button
          full
          size="lg"
          disabled={!ready.length}
          onClick={() => onConfirm(ready.map(normaliseBox))}
        >
          {ready.length ? `Add ${pluralize(ready.length, 'piece')}` : 'Draw a box to start'}
        </Button>
      </div>
    </div>
  );
}
