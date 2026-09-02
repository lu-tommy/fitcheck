'use client';

import { Crop, Hand, Maximize2, Minus, Plus, Trash2, Undo2 } from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { MIN_BOX, MIN_DRAG_PX, isDrawnBox, normaliseBox, type CropBox } from '@/lib/crop';
import { createId } from '@/lib/id';
import { cn } from '@/lib/cn';
import { pluralize } from '@/lib/format';

/** Which edges a handle moves. Corners move two. */
export type Edge = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

type Drag =
  | { mode: 'draw'; id: string; originX: number; originY: number }
  | { mode: 'move'; id: string; grabX: number; grabY: number }
  | { mode: 'resize'; id: string; edge: Edge }
  | { mode: 'pan'; fromX: number; fromY: number; panX: number; panY: number };

/**
 * What one finger on the photo does.
 *
 * Drawing and panning both want the same gesture, and which one you want
 * depends entirely on how far in you are: zoomed out you are composing, so a
 * drag is a box; zoomed in you are refining an edge you can finally see, so a
 * drag is the photo moving under it. Before this, a one-finger drag was always
 * a new box — which meant that at 6x the only way to reach another part of the
 * picture was to pinch out and pinch back in, and the whole "precision comes
 * from zoom" argument this component is built on collapsed the moment you took
 * it up on the offer.
 *
 * So the mode follows the zoom, and the toggle SHOWS which one is live rather
 * than leaving it to be discovered. Touching the toggle pins it, because a
 * control that quietly overrules the person using it is worse than no control.
 */
export type Mode = 'draw' | 'pan';

/** Past this the photo is being examined rather than framed, so a drag pans. */
const PAN_FROM_ZOOM = 1.05;

interface Pinch {
  distance: number;
  /** The image point under the pinch's midpoint, which must not move. */
  fx: number;
  fy: number;
  zoom: number;
}

const HANDLES: { edge: Edge; left: string; top: string; cursor: string }[] = [
  { edge: 'nw', left: '0%', top: '0%', cursor: 'nwse-resize' },
  { edge: 'n', left: '50%', top: '0%', cursor: 'ns-resize' },
  { edge: 'ne', left: '100%', top: '0%', cursor: 'nesw-resize' },
  { edge: 'e', left: '100%', top: '50%', cursor: 'ew-resize' },
  { edge: 'se', left: '100%', top: '100%', cursor: 'nwse-resize' },
  { edge: 's', left: '50%', top: '100%', cursor: 'ns-resize' },
  { edge: 'sw', left: '0%', top: '100%', cursor: 'nesw-resize' },
  { edge: 'w', left: '0%', top: '50%', cursor: 'ew-resize' },
];

/** Visual aspect ratios, as width ÷ height. `null` is free-form. */
const SHAPES: { label: string; aspect: number | null }[] = [
  { label: 'Free', aspect: null },
  { label: 'Tile', aspect: 4 / 5 },
  { label: 'Square', aspect: 1 },
];

const MIN_ZOOM = 1;
const MAX_ZOOM = 10;
const LOUPE = 108;
const LOUPE_ZOOM = 2.4;

/**
 * Box each garment in a photo, precisely.
 *
 * The precision comes from zoom, not from a steadier hand. Fitted to a phone
 * screen a 960-pixel-wide photo shows at about a third of its size, so one
 * screen pixel is three source pixels and a fingertip covers a hundred of
 * them — at that scale nobody can place an edge on a hem, and no amount of
 * handle polish changes the arithmetic. Pinching to 6× makes the same gesture
 * six times finer, which is why every serious cropper is built around it.
 *
 * The rest is what stops a careful box from being undone afterwards:
 *
 * - Every edge and corner drags. There used to be one handle, bottom-right,
 *   resizing with the top-left pinned, so a box whose top edge came out wrong
 *   could only be deleted and drawn again.
 * - An edge handle moves ONLY that edge. This is the long-standing complaint
 *   about the iOS cropper, where dragging a corner shifts the other handles
 *   and the workaround is to use the middle of an edge instead.
 * - A loupe follows the drag, because the finger is on top of the very edge
 *   being aligned.
 * - The crop that comes out is the box that was drawn, to the pixel. It used
 *   to be padded by 6% and then grown to the tile's shape, which quietly put
 *   the bathroom back into a carefully framed tank top.
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
  const [image, setImage] = useState({ width: 0, height: 0 });
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [boxes, setBoxes] = useState<CropBox[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [shape, setShape] = useState<number | null>(null);
  const [loupe, setLoupe] = useState<{ x: number; y: number } | null>(null);
  /** The box being drawn right now — the only one not yet held to the tap test. */
  const [drawingId, setDrawingId] = useState<string | null>(null);
  /** Set once somebody uses the toggle, after which the zoom stops deciding. */
  const [pinnedMode, setPinnedMode] = useState<Mode | null>(null);

  const drag = useRef<Drag | null>(null);
  const pinch = useRef<Pinch | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const lastTap = useRef(0);
  /** Whether this gesture has travelled far enough to be a drag and not a tap. */
  const moved = useRef(false);
  const frame = useRef<HTMLDivElement>(null);

  const mode: Mode = pinnedMode ?? (zoom > PAN_FROM_ZOOM ? 'pan' : 'draw');

  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    let cancelled = false;
    void createImageBitmap(file, { imageOrientation: 'from-image' }).then((bitmap) => {
      if (!cancelled) setImage({ width: bitmap.width, height: bitmap.height });
      bitmap.close();
    });
    return () => {
      cancelled = true;
      URL.revokeObjectURL(objectUrl);
    };
  }, [file]);

  useLayoutEffect(() => {
    const node = frame.current;
    if (!node) return;
    const measure = () =>
      setViewport({ width: node.clientWidth, height: node.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  /* ---------------------------------------------------------------- geometry */

  const fit =
    image.width && viewport.width
      ? Math.min(viewport.width / image.width, viewport.height / image.height)
      : 0;
  const displayWidth = image.width * fit * zoom;
  const displayHeight = image.height * fit * zoom;
  const originX = place(viewport.width, displayWidth, pan.x);
  const originY = place(viewport.height, displayHeight, pan.y);

  /** Screen point → fraction of the photo, which is what boxes store. */
  const toFraction = useCallback(
    (clientX: number, clientY: number) => {
      const rect = frame.current?.getBoundingClientRect();
      if (!rect || !displayWidth) return { x: 0, y: 0 };
      return {
        x: clamp01((clientX - rect.left - originX) / displayWidth),
        y: clamp01((clientY - rect.top - originY) / displayHeight),
      };
    },
    [displayWidth, displayHeight, originX, originY],
  );

  const local = useCallback((clientX: number, clientY: number) => {
    const rect = frame.current?.getBoundingClientRect();
    return { x: clientX - (rect?.left ?? 0), y: clientY - (rect?.top ?? 0) };
  }, []);

  /** Zoom about a point on screen, keeping whatever is under it still. */
  const zoomAbout = useCallback(
    (next: number, screenX: number, screenY: number) => {
      const wanted = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, next));
      const fx = (screenX - originX) / displayWidth;
      const fy = (screenY - originY) / displayHeight;
      const width = image.width * fit * wanted;
      const height = image.height * fit * wanted;
      setZoom(wanted);
      setPan({
        x: clampPan(viewport.width, width, screenX - fx * width - (viewport.width - width) / 2),
        y: clampPan(viewport.height, height, screenY - fy * height - (viewport.height - height) / 2),
      });
    },
    [displayWidth, displayHeight, originX, originY, image, fit, viewport],
  );

  /* ---------------------------------------------------------------- gestures */

  function begin(event: React.PointerEvent, state: Drag) {
    drag.current = state;
    moved.current = false;
    if (state.mode !== 'pan') {
      setActive(state.id);
      setLoupe(state.mode === 'move' ? null : toFraction(event.clientX, event.clientY));
    }
    (event.target as Element).setPointerCapture?.(event.pointerId);
  }

  function track(event: React.PointerEvent) {
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
  }

  function onPointerDown(event: React.PointerEvent) {
    track(event);
    if (pointers.current.size === 2) {
      // Two fingers is always the photo, never a box: dropping the half-drawn
      // one avoids leaving a stray speck behind every pinch.
      const half = drag.current;
      if (half?.mode === 'draw') setBoxes((current) => current.filter((box) => box.id !== half.id));
      drag.current = null;
      setDrawingId(null);
      setLoupe(null);
      startPinch();
      return;
    }
    if (pointers.current.size > 1 || event.button !== 0) return;

    // Zoomed in, one finger drags the photo. The handles on an existing box
    // stop propagation before they get here, so refining an edge still works
    // exactly as it did — which is the whole reason to be zoomed in.
    if (mode === 'pan') {
      begin(event, {
        mode: 'pan',
        fromX: event.clientX,
        fromY: event.clientY,
        panX: pan.x,
        panY: pan.y,
      });
      return;
    }

    const { x, y } = toFraction(event.clientX, event.clientY);
    const id = createId('box');
    setBoxes((current) => [...current, { id, x, y, width: 0, height: 0 }]);
    setDrawingId(id);
    begin(event, { mode: 'draw', id, originX: x, originY: y });
  }

  function startPinch() {
    const [a, b] = [...pointers.current.values()];
    if (!a || !b) return;
    const midX = (a.x + b.x) / 2;
    const midY = (a.y + b.y) / 2;
    const point = local(midX, midY);
    pinch.current = {
      distance: Math.hypot(a.x - b.x, a.y - b.y) || 1,
      fx: (point.x - originX) / displayWidth,
      fy: (point.y - originY) / displayHeight,
      zoom,
    };
  }

  function onPointerMove(event: React.PointerEvent) {
    if (!pointers.current.has(event.pointerId)) return;
    track(event);

    const gesture = pinch.current;
    if (gesture && pointers.current.size >= 2) {
      event.preventDefault();
      const [a, b] = [...pointers.current.values()];
      const distance = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, (gesture.zoom * distance) / gesture.distance));
      const mid = local((a.x + b.x) / 2, (a.y + b.y) / 2);
      const width = image.width * fit * next;
      const height = image.height * fit * next;
      setZoom(next);
      // Pan comes free: the midpoint moving IS the drag.
      setPan({
        x: clampPan(viewport.width, width, mid.x - gesture.fx * width - (viewport.width - width) / 2),
        y: clampPan(viewport.height, height, mid.y - gesture.fy * height - (viewport.height - height) / 2),
      });
      return;
    }

    const state = drag.current;
    if (!state) return;
    event.preventDefault();

    if (state.mode === 'pan') {
      const dx = event.clientX - state.fromX;
      const dy = event.clientY - state.fromY;
      if (Math.hypot(dx, dy) >= MIN_DRAG_PX) moved.current = true;
      setPan({
        x: clampPan(viewport.width, displayWidth, state.panX + dx),
        y: clampPan(viewport.height, displayHeight, state.panY + dy),
      });
      return;
    }

    const { x, y } = toFraction(event.clientX, event.clientY);
    if (state.mode !== 'move') setLoupe({ x, y });

    setBoxes((current) =>
      current.map((box) => {
        if (box.id !== state.id) return box;
        if (state.mode === 'draw') {
          const drawn = draw(box, state.originX, state.originY, x, y, ratio);
          if (isDrawnBox(drawn, displayWidth, displayHeight)) moved.current = true;
          return drawn;
        }
        if (state.mode === 'resize') return resize(box, state.edge, x, y, ratio);
        return {
          ...box,
          x: clamp01(Math.min(1 - box.width, x - state.grabX)),
          y: clamp01(Math.min(1 - box.height, y - state.grabY)),
        };
      }),
    );
  }

  function onPointerUp(event: React.PointerEvent) {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    if (pointers.current.size === 1) startPinch();

    const state = drag.current;
    if (pointers.current.size === 0) {
      drag.current = null;
      setDrawingId(null);
    }
    setLoupe(null);
    if (!state) return;

    /*
     * Only the box this gesture drew is held to the tap test, and only against
     * the screen it was drawn on. Every other box is kept exactly as it is,
     * however small — a ring or a pair of earrings is a legitimately tiny box,
     * and the old rule threw all of them away for looking like stray taps.
     */
    const drawnId = state.mode === 'draw' ? state.id : null;
    setBoxes((current) =>
      current
        .map(normaliseBox)
        .filter((box) => box.id !== drawnId || isDrawnBox(box, displayWidth, displayHeight)),
    );

    // A gesture that never travelled is a tap, and two taps in a row are a
    // zoom. True in both modes: panning leaves no box behind to stand in for it.
    if ((state.mode !== 'draw' && state.mode !== 'pan') || moved.current) return;
    const now = Date.now();
    if (now - lastTap.current < 320) {
      const point = local(event.clientX, event.clientY);
      zoomAbout(zoom > 1.6 ? 1 : 3, point.x, point.y);
      lastTap.current = 0;
    } else {
      lastTap.current = now;
    }
  }

  function onWheel(event: React.WheelEvent) {
    if (!displayWidth) return;
    const point = local(event.clientX, event.clientY);
    zoomAbout(zoom * (event.deltaY < 0 ? 1.12 : 1 / 1.12), point.x, point.y);
  }

  /* ------------------------------------------------------------------ render */

  // Boxes are fractions of the photo, so a visually square box is only square
  // in fractions when the photo is. Every ratio has to go through the image.
  const imageAspect = image.width && image.height ? image.width / image.height : 1;
  const ratio = shape === null ? null : shape / imageAspect;

  // Everything except the box under the finger, which has not yet been asked
  // whether it is a drawing or a tap.
  const ready = boxes.filter(
    (box) => box.id !== drawingId || isDrawnBox(box, displayWidth, displayHeight),
  );
  const selected = ready.find((box) => box.id === active) ?? null;
  const toScreen = (box: CropBox) => ({
    left: originX + box.x * displayWidth,
    top: originY + box.y * displayHeight,
    width: box.width * displayWidth,
    height: box.height * displayHeight,
  });

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
              : 'Pinch to zoom in, then drag a box'}
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

      <div className="relative min-h-0 flex-1">
        <div
          ref={frame}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onWheel={onWheel}
          className={cn(
            'absolute inset-0 touch-none overflow-hidden select-none',
            mode === 'pan' ? 'cursor-grab active:cursor-grabbing' : 'cursor-crosshair',
          )}
        >
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element -- blob: URL
            <img
              src={url}
              alt="Photo being divided into pieces"
              draggable={false}
              className="pointer-events-none absolute max-w-none"
              style={{
                left: originX,
                top: originY,
                width: displayWidth || undefined,
                height: displayHeight || undefined,
              }}
            />
          ) : null}

          {/* Everything outside the boxes, dimmed, so the crops read as the subject. */}
          {ready.length ? (
            <svg
              aria-hidden
              className="pointer-events-none absolute top-0 left-0"
              width={viewport.width}
              height={viewport.height}
            >
              <defs>
                <mask id="fitcheck-crop-mask">
                  <rect width={viewport.width} height={viewport.height} fill="white" />
                  {ready.map((box) => {
                    const r = toScreen(normaliseBox(box));
                    return (
                      <rect
                        key={box.id}
                        x={r.left}
                        y={r.top}
                        width={r.width}
                        height={r.height}
                        fill="black"
                      />
                    );
                  })}
                </mask>
              </defs>
              <rect
                width={viewport.width}
                height={viewport.height}
                fill="rgba(0,0,0,0.45)"
                mask="url(#fitcheck-crop-mask)"
              />
            </svg>
          ) : null}

          {boxes.map((box, index) => {
            const shapeBox = normaliseBox(box);
            const rect = toScreen(shapeBox);
            const isActive = active === box.id;
            const dragging = isActive && Boolean(loupe);
            return (
              <div
                key={box.id}
                data-piece={index + 1}
                // The one under the finger, not "is anything selected" — which
                // lit every box at once and disagreed with its own handles.
                className={cn(
                  'absolute border-2',
                  isActive ? 'border-[var(--brand)]' : 'border-white/90',
                )}
                style={rect}
                onPointerDown={(event) => {
                  if (pointers.current.size >= 1) return;
                  event.stopPropagation();
                  track(event);
                  const { x, y } = toFraction(event.clientX, event.clientY);
                  begin(event, {
                    mode: 'move',
                    id: box.id,
                    grabX: x - shapeBox.x,
                    grabY: y - shapeBox.y,
                  });
                }}
              >
                <span className="absolute -top-px -left-px bg-[var(--brand)] px-1.5 py-0.5 text-[0.75rem] font-semibold text-[var(--on-brand)]">
                  {index + 1}
                </span>

                {/* Thirds, only while it is being placed — a permanent grid is noise. */}
                {dragging ? (
                  <>
                    <span className="absolute top-1/3 left-0 h-px w-full bg-white/35" />
                    <span className="absolute top-2/3 left-0 h-px w-full bg-white/35" />
                    <span className="absolute top-0 left-1/3 h-full w-px bg-white/35" />
                    <span className="absolute top-0 left-2/3 h-full w-px bg-white/35" />
                  </>
                ) : null}

                {HANDLES.map((handle) => (
                  <span
                    key={handle.edge}
                    role="presentation"
                    onPointerDown={(event) => {
                      if (pointers.current.size >= 1) return;
                      event.stopPropagation();
                      track(event);
                      begin(event, { mode: 'resize', id: box.id, edge: handle.edge });
                    }}
                    style={{ left: handle.left, top: handle.top, cursor: handle.cursor }}
                    /*
                     * An 11px dot inside a 44px target. Apple's minimum exists
                     * because a finger is not a cursor, and a handle you can see
                     * but cannot hit is worse than no handle.
                     */
                    className="absolute grid size-11 -translate-x-1/2 -translate-y-1/2 place-items-center"
                  >
                    <span
                      className={cn(
                        'rounded-full border-2 border-white shadow',
                        handle.edge.length === 2 ? 'size-3' : 'size-2.5',
                        isActive ? 'bg-[var(--brand)]' : 'bg-white/70',
                      )}
                    />
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
                left: clampTo(originX + loupe.x * displayWidth - LOUPE / 2, viewport.width - LOUPE),
                // Above the finger, flipping below it near the top of the frame.
                top: clampTo(
                  originY + loupe.y * displayHeight + (loupe.y * displayHeight < 150 ? 60 : -(LOUPE + 60)),
                  viewport.height - LOUPE,
                ),
                backgroundImage: `url(${url})`,
                backgroundSize: `${displayWidth * LOUPE_ZOOM}px ${displayHeight * LOUPE_ZOOM}px`,
                backgroundPosition: `${LOUPE / 2 - loupe.x * displayWidth * LOUPE_ZOOM}px ${LOUPE / 2 - loupe.y * displayHeight * LOUPE_ZOOM}px`,
                backgroundRepeat: 'no-repeat',
              }}
            >
              <span className="absolute top-1/2 left-0 h-px w-full bg-white/70" />
              <span className="absolute top-0 left-1/2 h-full w-px bg-white/70" />
            </div>
          ) : null}
        </div>

        {/* What a finger does, then zoom — for one hand and for a mouse. */}
        <div className="pointer-events-none absolute right-3 bottom-3 flex flex-col items-end gap-1.5">
          <div className="pointer-events-auto flex flex-col overflow-hidden rounded-full bg-black/55">
            <ModeButton label="Draw boxes" active={mode === 'draw'} onClick={() => setPinnedMode('draw')}>
              <Crop size={15} />
            </ModeButton>
            <ModeButton label="Move the photo" active={mode === 'pan'} onClick={() => setPinnedMode('pan')}>
              <Hand size={15} />
            </ModeButton>
          </div>
          {zoom > 1.02 ? (
            <span className="rounded-full bg-black/55 px-2 py-0.5 text-[0.6875rem] font-semibold text-white tabular-nums">
              {zoom.toFixed(1)}×
            </span>
          ) : null}
          <div className="pointer-events-auto flex flex-col overflow-hidden rounded-full bg-black/55">
            <ZoomButton
              label="Zoom in"
              onClick={() => zoomAbout(zoom * 1.5, viewport.width / 2, viewport.height / 2)}
            >
              <Plus size={16} />
            </ZoomButton>
            <ZoomButton
              label="Zoom out"
              onClick={() => zoomAbout(zoom / 1.5, viewport.width / 2, viewport.height / 2)}
            >
              <Minus size={16} />
            </ZoomButton>
            <ZoomButton
              label="Fit the whole photo"
              onClick={() => {
                setZoom(1);
                setPan({ x: 0, y: 0 });
              }}
            >
              <Maximize2 size={15} />
            </ZoomButton>
          </div>
        </div>
      </div>

      <div
        className="border-t border-[var(--border)] bg-[var(--bg)] px-5 pt-3"
        style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
      >
        <div className="mb-2.5 flex gap-1.5 rounded-full bg-[var(--surface-alt)] p-1">
          {SHAPES.map((option) => (
            <button
              key={option.label}
              type="button"
              aria-pressed={shape === option.aspect}
              onClick={() => {
                setShape(option.aspect);
                if (option.aspect === null) return;
                const next = option.aspect / imageAspect;
                setBoxes((current) => current.map((box) => resize(normaliseBox(box), 'se', 1, 1, next, true)));
              }}
              className={cn(
                'flex-1 rounded-full py-1.5 text-[0.8125rem] font-semibold transition-colors',
                shape === option.aspect
                  ? 'bg-[var(--brand)] text-[var(--on-brand)]'
                  : 'text-[var(--text-muted)]',
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
        {/*
          * Removing a piece lives here rather than on the box itself. Eight
          * 44px handles cover the whole perimeter of a small box, so a delete
          * button anywhere on that edge is either unreachable — the handle wins
          * the hit test, which is what happened — or it steals the corner drag.
          */}
        {selected ? (
          <div className="mb-2.5 flex items-center justify-center gap-3 text-[0.8125rem]">
            <span className="text-[var(--text-muted)]">
              Piece {boxes.findIndex((box) => box.id === selected.id) + 1} selected
            </span>
            <button
              type="button"
              onClick={() => {
                setBoxes((current) => current.filter((entry) => entry.id !== selected.id));
                setActive(null);
              }}
              className="pressable inline-flex items-center gap-1.5 rounded-full bg-[var(--surface-alt)] px-3 py-1 font-semibold text-[var(--danger)]"
            >
              <Trash2 size={13} /> Remove
            </button>
          </div>
        ) : (
          <p className="mb-2.5 text-center text-[0.8125rem] leading-relaxed text-[var(--text-muted)]">
            {mode === 'pan'
              ? 'Zoomed in, dragging moves the photo. Handles still resize — tap the crop icon to draw another box.'
              : 'Each box becomes its own item. Pinch to zoom, drag any edge to adjust.'}
          </p>
        )}
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

/** The live mode, shown rather than left to be inferred from behaviour. */
function ModeButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'grid size-10 place-items-center transition-colors',
        active ? 'bg-white text-black' : 'text-white active:bg-white/20',
      )}
    >
      {children}
    </button>
  );
}

function ZoomButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="grid size-10 place-items-center text-white active:bg-white/20"
    >
      {children}
    </button>
  );
}

/** Centre the photo when it fits, and stop it being dragged off when it does not. */
function place(view: number, display: number, pan: number): number {
  if (!display) return 0;
  if (display <= view) return (view - display) / 2;
  return Math.min(0, Math.max(view - display, (view - display) / 2 + pan));
}

/**
 * Hold pan inside the range `place` would honour.
 *
 * Without this, dragging past the edge banks slack that has to be paid back
 * before the photo moves again — you push right, nothing happens for an inch,
 * and the control feels broken rather than bounded.
 */
export function clampPan(view: number, display: number, pan: number): number {
  if (!display || display <= view) return 0;
  const slack = (display - view) / 2;
  return Math.max(-slack, Math.min(slack, pan));
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function clampTo(value: number, max: number): number {
  return Math.max(4, Math.min(max - 4, value));
}

/** Drawing a fresh box, honouring a locked shape from the first moment. */
export function draw(
  box: CropBox,
  originX: number,
  originY: number,
  x: number,
  y: number,
  ratio?: number | null,
): CropBox {
  if (!ratio) return { ...box, x: originX, y: originY, width: x - originX, height: y - originY };
  // The longer drag wins, so the box follows the direction of the gesture.
  const width = Math.abs(x - originX);
  const height = Math.abs(y - originY);
  const size = width / ratio > height ? width : height * ratio;
  return {
    ...box,
    x: originX,
    y: originY,
    width: Math.sign(x - originX || 1) * size,
    height: Math.sign(y - originY || 1) * (size / ratio),
  };
}

/**
 * Move whichever edges a handle owns.
 *
 * An edge handle moves that edge alone — the fix for the cropper complaint
 * everyone has about iOS, where dragging one corner shifts the others and the
 * only reliable way to nudge a single side is the middle of an edge. Dragging
 * past the opposite side clamps rather than flipping, because a box that turns
 * inside out under a finger renames its own handles mid-gesture.
 */
export function resize(
  box: CropBox,
  edge: Edge,
  x: number,
  y: number,
  ratio?: number | null,
  /** Re-shaping an existing box rather than dragging it: hold its size, not the pointer. */
  reshape = false,
): CropBox {
  let left = box.x;
  let top = box.y;
  let right = box.x + box.width;
  let bottom = box.y + box.height;

  if (!reshape) {
    if (edge.includes('w')) left = Math.min(x, right - MIN_BOX);
    if (edge.includes('e')) right = Math.max(x, left + MIN_BOX);
    if (edge.includes('n')) top = Math.min(y, bottom - MIN_BOX);
    if (edge.includes('s')) bottom = Math.max(y, top + MIN_BOX);
  }

  if (ratio) {
    let width = right - left;
    let height = bottom - top;
    if (!reshape && (edge === 'e' || edge === 'w')) {
      // The width was driven; grow or shrink the height about the centre.
      height = width / ratio;
      const middle = (top + bottom) / 2;
      top = middle - height / 2;
      bottom = middle + height / 2;
    } else if (!reshape && (edge === 'n' || edge === 's')) {
      width = height * ratio;
      const middle = (left + right) / 2;
      left = middle - width / 2;
      right = middle + width / 2;
    } else {
      // A corner keeps the opposite corner still; re-shaping keeps the centre.
      if (width / ratio > height) height = width / ratio;
      else width = height * ratio;
      if (reshape) {
        const midX = (left + right) / 2;
        const midY = (top + bottom) / 2;
        left = midX - width / 2;
        right = midX + width / 2;
        top = midY - height / 2;
        bottom = midY + height / 2;
      } else {
        if (edge.includes('w')) left = right - width;
        else right = left + width;
        if (edge.includes('n')) top = bottom - height;
        else bottom = top + height;
      }
    }
  }

  // Slide back inside the photo rather than distorting the shape to fit.
  if (left < 0) {
    right -= left;
    left = 0;
  }
  if (top < 0) {
    bottom -= top;
    top = 0;
  }
  if (right > 1) {
    left -= right - 1;
    right = 1;
  }
  if (bottom > 1) {
    top -= bottom - 1;
    bottom = 1;
  }

  return {
    id: box.id,
    x: clamp01(left),
    y: clamp01(top),
    width: clamp01(right) - clamp01(left),
    height: clamp01(bottom) - clamp01(top),
  };
}
