'use client';

import { Trash2, Undo2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { MIN_BOX, normaliseBox, type CropBox } from '@/lib/crop';
import { createId } from '@/lib/id';
import { cn } from '@/lib/cn';
import { pluralize } from '@/lib/format';

/** Which edges a handle moves. Corners move two. */
type Edge = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

type Drag =
  | { mode: 'draw'; id: string; originX: number; originY: number }
  | { mode: 'move'; id: string; grabX: number; grabY: number }
  | { mode: 'resize'; id: string; edge: Edge };

const HANDLES: { edge: Edge; style: React.CSSProperties; cursor: string }[] = [
  { edge: 'nw', style: { left: 0, top: 0 }, cursor: 'nwse-resize' },
  { edge: 'n', style: { left: '50%', top: 0 }, cursor: 'ns-resize' },
  { edge: 'ne', style: { left: '100%', top: 0 }, cursor: 'nesw-resize' },
  { edge: 'e', style: { left: '100%', top: '50%' }, cursor: 'ew-resize' },
  { edge: 'se', style: { left: '100%', top: '100%' }, cursor: 'nwse-resize' },
  { edge: 's', style: { left: '50%', top: '100%' }, cursor: 'ns-resize' },
  { edge: 'sw', style: { left: 0, top: '100%' }, cursor: 'nesw-resize' },
  { edge: 'w', style: { left: 0, top: '50%' }, cursor: 'ew-resize' },
];

const LOUPE = 112;
const LOUPE_ZOOM = 2.6;

/**
 * Draw a box around each garment in a photo.
 *
 * Deliberately manual. The person holding the phone already knows which shape
 * is the jacket, and asking them to drag four boxes is faster — and far more
 * reliable — than asking a model to guess and then correcting it.
 *
 * Two things make that box land where they meant it to. Every edge and corner
 * can be dragged, so a box that came out slightly wrong is nudged rather than
 * deleted and redrawn — it previously had a single bottom-right handle, which
 * meant the top edge could not be corrected at all. And a loupe follows the
 * drag, because on a phone the fingertip covers roughly a hundred pixels of the
 * source image: you were aiming at an edge you could not see.
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
  const [loupe, setLoupe] = useState<{ x: number; y: number } | null>(null);
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

  function begin(event: React.PointerEvent, state: Drag) {
    drag.current = state;
    setActive(state.id);
    setLoupe(pointToFraction(event));
    (event.target as Element).setPointerCapture?.(event.pointerId);
  }

  function onPointerDown(event: React.PointerEvent) {
    if (event.button !== 0 && event.pointerType === 'mouse') return;
    const { x, y } = pointToFraction(event);
    const id = createId('box');
    setBoxes((current) => [...current, { id, x, y, width: 0, height: 0 }]);
    begin(event, { mode: 'draw', id, originX: x, originY: y });
  }

  function onPointerMove(event: React.PointerEvent) {
    const state = drag.current;
    if (!state) return;
    event.preventDefault();
    const { x, y } = pointToFraction(event);
    setLoupe({ x, y });

    setBoxes((current) =>
      current.map((box) => {
        if (box.id !== state.id) return box;
        if (state.mode === 'draw') {
          return {
            ...box,
            x: state.originX,
            y: state.originY,
            width: x - state.originX,
            height: y - state.originY,
          };
        }
        if (state.mode === 'resize') return resize(box, state.edge, x, y);
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
    setLoupe(null);
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
                  begin(event, {
                    mode: 'move',
                    id: box.id,
                    grabX: x - shape.x,
                    grabY: y - shape.y,
                  });
                }}
              >
                <span className="absolute -top-px -left-px bg-[var(--brand)] px-1.5 py-0.5 text-[0.75rem] font-semibold text-[var(--on-brand)]">
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

                {HANDLES.map((handle) => (
                  <span
                    key={handle.edge}
                    role="presentation"
                    aria-label={`Drag the ${handle.edge} edge`}
                    onPointerDown={(event) => {
                      event.stopPropagation();
                      begin(event, { mode: 'resize', id: box.id, edge: handle.edge });
                    }}
                    style={{ ...handle.style, cursor: handle.cursor }}
                    /*
                     * The touch target is 28px but the dot is 12px: on a phone a
                     * handle you can see is not a handle you can hit.
                     */
                    className="absolute grid size-7 -translate-x-1/2 -translate-y-1/2 place-items-center"
                  >
                    <span className="size-3 rounded-full border-2 border-white bg-[var(--brand)] shadow" />
                  </span>
                ))}
              </div>
            );
          })}

          {loupe && url ? (
            <div
              aria-hidden
              className="pointer-events-none absolute z-10 overflow-hidden rounded-full border-2 border-white shadow-lg"
              style={{
                width: LOUPE,
                height: LOUPE,
                left: `calc(${loupe.x * 100}% - ${LOUPE / 2}px)`,
                // Sit above the finger, and flip below it near the top edge.
                top: `calc(${loupe.y * 100}% + ${loupe.y < 0.28 ? 56 : -(LOUPE + 56)}px)`,
                backgroundImage: `url(${url})`,
                backgroundSize: `${LOUPE_ZOOM * 100}% ${LOUPE_ZOOM * 100}%`,
                backgroundPosition: `${loupe.x * 100}% ${loupe.y * 100}%`,
                backgroundRepeat: 'no-repeat',
              }}
            >
              <span className="absolute top-1/2 left-0 h-px w-full bg-white/70" />
              <span className="absolute top-0 left-1/2 h-full w-px bg-white/70" />
            </div>
          ) : null}
        </div>
      </div>

      <div
        className="border-t border-[var(--border)] bg-[var(--bg)] px-5 pt-3"
        style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
      >
        <p className="mb-2.5 text-center text-[0.8125rem] leading-relaxed text-[var(--text-muted)]">
          Each box becomes its own item. Drag any edge or corner to adjust it.
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

/**
 * Move whichever edges a handle owns, keeping the box at least MIN_BOX across.
 *
 * Dragging past the opposite edge clamps rather than flipping: a box that turns
 * inside out under your finger and renames its own handles is disorienting.
 */
export function resize(box: CropBox, edge: Edge, x: number, y: number): CropBox {
  let left = box.x;
  let top = box.y;
  let right = box.x + box.width;
  let bottom = box.y + box.height;

  if (edge.includes('w')) left = Math.min(x, right - MIN_BOX);
  if (edge.includes('e')) right = Math.max(x, left + MIN_BOX);
  if (edge.includes('n')) top = Math.min(y, bottom - MIN_BOX);
  if (edge.includes('s')) bottom = Math.max(y, top + MIN_BOX);

  return { id: box.id, x: left, y: top, width: right - left, height: bottom - top };
}
