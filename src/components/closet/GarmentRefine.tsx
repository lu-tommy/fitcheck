'use client';

import { Eraser, Loader2, RotateCcw, Undo2, Wand2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';
import type { CropBox } from '@/lib/crop';
import { analyseGarment, renderGarment, type Analysis } from '@/lib/segment';
import type { Scribble } from '@/domain/segment';

/** Brush radius as a fraction of the photo's short side. */
const BRUSH = 0.035;
/** How far a finger travels before another dab is recorded during one stroke. */
const DAB_SPACING = 0.02;

type Brush = 'keep' | 'drop';

/**
 * Fixing a cut-out by pointing at it.
 *
 * The colour models behind this are built from a guess — the middle of the box
 * is garment, outside it is not — and a guess is wrong sometimes. A grey hem
 * reads as bathroom tile; a hand resting on a hip reads as the jumper it is
 * touching. Rather than expose thresholds, this exposes the two sentences a
 * person actually wants to say: "that bit is the shirt" and "that bit isn't".
 *
 * Each dab does two things. It pins those pixels, and it feeds their colour
 * into the model, so pointing at one corner of a hem usually claims the whole
 * hem. That is why it feels like selecting an object rather than painting a
 * mask, and it is the entire reason this beats a brush.
 */
export function GarmentRefine({
  file,
  box,
  onCancel,
  onConfirm,
  onFallback,
}: {
  file: Blob;
  box: CropBox;
  onCancel: () => void;
  onConfirm: (blob: Blob) => void;
  /** "Just use the rectangle" — always reachable, because this can fail. */
  onFallback: () => void;
}) {
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [scribbles, setScribbles] = useState<Scribble[]>([]);
  const [brush, setBrush] = useState<Brush>('keep');
  const [thinking, setThinking] = useState(true);
  const [saving, setSaving] = useState(false);

  const bitmap = useRef<ImageBitmap | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const surface = useRef<HTMLDivElement>(null);
  const stroke = useRef<{ last: { x: number; y: number } | null }>({ last: null });
  const generation = useRef(0);

  useEffect(() => {
    let cancelled = false;
    void createImageBitmap(file, { imageOrientation: 'from-image' }).then((loaded) => {
      if (cancelled) {
        loaded.close();
        return;
      }
      bitmap.current = loaded;
      void run([]);
    });
    return () => {
      cancelled = true;
      bitmap.current?.close();
      bitmap.current = null;
    };
    // Deliberately once per photo: `run` reads its inputs from refs and state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]);

  const run = useCallback(
    async (marks: Scribble[]) => {
      const source = bitmap.current;
      if (!source) return;
      const ticket = (generation.current += 1);
      setThinking(true);
      const next = await analyseGarment(source, box, { scribbles: marks });
      if (ticket !== generation.current) return;
      setAnalysis(next);
      setThinking(false);
    },
    [box],
  );

  /* Redraw whenever the mask or the marks change. */
  useEffect(() => {
    const source = bitmap.current;
    const target = canvas.current;
    if (!source || !target || !analysis) return;
    paint(target, source, analysis, scribbles);
  }, [analysis, scribbles]);

  /** Pointer position as a fraction of the whole photo, which is what marks store. */
  const toImageFraction = useCallback(
    (event: React.PointerEvent) => {
      const rect = surface.current?.getBoundingClientRect();
      const source = bitmap.current;
      if (!rect || !source || !analysis) return null;
      const withinRegion = {
        x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
        y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)),
      };
      return {
        x: (analysis.region.x + withinRegion.x * analysis.region.width) / source.width,
        y: (analysis.region.y + withinRegion.y * analysis.region.height) / source.height,
      };
    },
    [analysis],
  );

  function dab(event: React.PointerEvent) {
    const point = toImageFraction(event);
    if (!point) return;
    const last = stroke.current.last;
    if (last && Math.hypot(point.x - last.x, point.y - last.y) < DAB_SPACING) return;
    stroke.current.last = point;
    setScribbles((current) => [...current, { ...point, label: brush, radius: BRUSH }]);
  }

  function onPointerDown(event: React.PointerEvent) {
    if (thinking && !analysis) return;
    (event.target as Element).setPointerCapture?.(event.pointerId);
    stroke.current.last = null;
    dab(event);
  }

  function onPointerMove(event: React.PointerEvent) {
    if (!stroke.current.last) return;
    event.preventDefault();
    dab(event);
  }

  function onPointerUp() {
    if (!stroke.current.last) return;
    stroke.current.last = null;
    // Segment on release, not on every dab: the person is still drawing, and a
    // mask that flickers under a moving finger is unreadable.
    setScribbles((current) => {
      void run(current);
      return current;
    });
  }

  async function confirm() {
    const source = bitmap.current;
    if (!source || !analysis) return;
    setSaving(true);
    const blob = await renderGarment(source, analysis);
    if (!blob) {
      setSaving(false);
      onFallback();
      return;
    }
    onConfirm(blob);
  }

  const empty = analysis ? analysis.coverage < 0.02 : false;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[var(--surface-sunken)]">
      <header
        className="flex items-center justify-between gap-3 px-5 pb-3"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 1rem)' }}
      >
        <div className="min-w-0">
          <h2 className="text-title truncate">Tidy the edges</h2>
          <p className="text-[0.8125rem] text-[var(--text-muted)]">
            {thinking
              ? 'Finding the garment…'
              : empty
                ? 'Tap the garment to show what to keep'
                : 'Tap anything it got wrong'}
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="pressable shrink-0 rounded-full bg-[var(--surface-alt)] px-3.5 text-[0.875rem]"
        >
          Cancel
        </button>
      </header>

      <div className="flex min-h-0 flex-1 items-center justify-center px-4">
        <div
          ref={surface}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className="relative max-h-full touch-none overflow-hidden rounded-2xl select-none"
          style={{
            aspectRatio: analysis ? String(analysis.region.width / analysis.region.height) : '3 / 4',
            // A chequerboard, so transparency reads as transparency rather than
            // as a white garment on a white card.
            backgroundImage:
              'linear-gradient(45deg, rgba(128,128,128,.18) 25%, transparent 25%, transparent 75%, rgba(128,128,128,.18) 75%), linear-gradient(45deg, rgba(128,128,128,.18) 25%, transparent 25%, transparent 75%, rgba(128,128,128,.18) 75%)',
            backgroundSize: '18px 18px',
            backgroundPosition: '0 0, 9px 9px',
          }}
        >
          <canvas ref={canvas} className="block h-full w-full" />
          {thinking ? (
            <div className="absolute inset-0 grid place-items-center bg-black/15">
              <Loader2 className="animate-spin text-white" size={26} />
            </div>
          ) : null}
        </div>
      </div>

      <div
        className="border-t border-[var(--border)] bg-[var(--bg)] px-5 pt-3"
        style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
      >
        <div className="mb-3 flex items-center gap-2">
          <div className="flex flex-1 gap-1.5 rounded-full bg-[var(--surface-alt)] p-1">
            <BrushButton
              active={brush === 'keep'}
              onClick={() => setBrush('keep')}
              icon={<Wand2 size={15} />}
              label="Keep"
            />
            <BrushButton
              active={brush === 'drop'}
              onClick={() => setBrush('drop')}
              icon={<Eraser size={15} />}
              label="Remove"
            />
          </div>
          <button
            type="button"
            aria-label="Undo last tap"
            disabled={!scribbles.length}
            onClick={() =>
              setScribbles((current) => {
                const next = current.slice(0, -1);
                void run(next);
                return next;
              })
            }
            className="pressable grid size-10 shrink-0 place-items-center rounded-full bg-[var(--surface-alt)] disabled:opacity-40"
          >
            <Undo2 size={17} />
          </button>
          <button
            type="button"
            aria-label="Start again"
            disabled={!scribbles.length}
            onClick={() => {
              setScribbles([]);
              void run([]);
            }}
            className="pressable grid size-10 shrink-0 place-items-center rounded-full bg-[var(--surface-alt)] disabled:opacity-40"
          >
            <RotateCcw size={17} />
          </button>
        </div>

        <Button full size="lg" disabled={thinking || saving || empty} onClick={() => void confirm()}>
          {saving ? 'Saving…' : 'Use this'}
        </Button>
        <button
          type="button"
          onClick={onFallback}
          className="mt-2 w-full py-2 text-center text-[0.8125rem] text-[var(--text-muted)] underline decoration-[var(--border)] underline-offset-4"
        >
          Keep the whole rectangle instead
        </button>
      </div>
    </div>
  );
}

function BrushButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'flex flex-1 items-center justify-center gap-1.5 rounded-full py-2 text-[0.875rem] font-semibold transition-colors',
        active ? 'bg-[var(--brand)] text-[var(--on-brand)]' : 'text-[var(--text-muted)]',
      )}
    >
      {icon}
      {label}
    </button>
  );
}

/**
 * Draw the region with everything outside the mask knocked back.
 *
 * Dropped pixels are dimmed rather than erased, because a person correcting a
 * mistake needs to see the thing they are pointing at. Erasing them outright
 * would hide the very sleeve they were about to reclaim.
 */
function paint(
  target: HTMLCanvasElement,
  source: ImageBitmap,
  analysis: Analysis,
  scribbles: Scribble[],
): void {
  const { region } = analysis;
  const width = analysis.width;
  const height = analysis.height;
  if (target.width !== width || target.height !== height) {
    target.width = width;
    target.height = height;
  }
  const context = target.getContext('2d');
  if (!context) return;

  context.clearRect(0, 0, width, height);
  context.drawImage(source, region.x, region.y, region.width, region.height, 0, 0, width, height);

  const frame = context.getImageData(0, 0, width, height);
  for (let i = 0; i < width * height; i += 1) {
    if (analysis.alpha[i]) continue;
    const p = i * 4;
    const grey = (frame.data[p] * 0.3 + frame.data[p + 1] * 0.59 + frame.data[p + 2] * 0.11) * 0.55;
    frame.data[p] = grey;
    frame.data[p + 1] = grey;
    frame.data[p + 2] = grey;
    frame.data[p + 3] = 70;
  }
  context.putImageData(frame, 0, 0);

  // The marks themselves, so a tap is visibly a tap even before it takes effect.
  for (const mark of scribbles) {
    const x = (mark.x * source.width - region.x) * analysis.scale;
    const y = (mark.y * source.height - region.y) * analysis.scale;
    const radius = mark.radius * Math.min(source.width, source.height) * analysis.scale;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.strokeStyle = mark.label === 'keep' ? 'rgba(255,255,255,.9)' : 'rgba(255,90,90,.9)';
    context.lineWidth = Math.max(1, radius * 0.12);
    context.stroke();
  }
}
