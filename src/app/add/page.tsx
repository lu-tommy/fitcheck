'use client';

import { Camera, ImagePlus, Loader2, PenLine, Scissors, Sparkles, Trash2, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useMemo, useRef, useState } from 'react';

import { EMPTY_DRAFT, ItemForm, draftLabel, type ItemDraft } from '@/components/closet/ItemForm';
import { MultiCrop } from '@/components/closet/MultiCrop';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Sheet } from '@/components/ui/Sheet';
import { hexForColorName } from '@/domain/color';
import { availableBrands } from '@/domain/filters';
import { CATEGORIES, categoryLabel, slotOf } from '@/domain/taxonomy';
import { countBySlot, progressLine } from '@/domain/wardrobeProgress';
import { putPhoto } from '@/db';
import { removeBackground } from '@/lib/backgroundRemoval';
import { guessCategoryFromCutout } from '@/lib/silhouette';
import { trimToGarment } from '@/lib/trim';
import { CONFIDENT, type CategoryGuess } from '@/domain/silhouette';
import { cropToBlob, type CropBox } from '@/lib/crop';
import { cn } from '@/lib/cn';
import { createId } from '@/lib/id';
import { processPhoto } from '@/lib/image';
import { nowIso } from '@/lib/date';
import { titleCase } from '@/lib/format';
import { useCloset, type NewClothingItem } from '@/store/closet';
import { usePreferences } from '@/store/preferences';
import { toast } from '@/store/toast';

type Stage = 'processing' | 'ready' | 'failed';

interface Pending {
  key: string;
  stage: Stage;
  error?: string;
  previewUrl?: string;
  photo?: { blob: Blob; width: number; height: number };
  cutout?: { blob: Blob; width: number; height: number };
  useCutout: boolean;
  /** What the outline suggested, so the form can show it and be disagreed with. */
  guess?: CategoryGuess;
  /** The photo as it arrived, so cropping starts from the best pixels available. */
  source?: Blob;
  /**
   * The cut-out, ready to show. The row used to render the ORIGINAL photo with
   * a transparency grid behind it whenever a cut-out existed, so what she saw
   * while deciding was never what went into the closet — a garment shot from
   * across the room still looked like a room.
   */
  cutoutUrl?: string;
  /**
   * True when the background removal barely removed anything — a mirror selfie,
   * a patterned duvet, a busy room. The cut-out is useless there and, worse,
   * silently useless, so the row says so and offers the crop.
   */
  busyBackground?: boolean;
  /**
   * The photo and the box this piece was cut from, kept so the cut-out can be
   * corrected by hand later without going back and drawing the box again.
   */
  origin?: CropOrigin;
  draft: ItemDraft;
  taggedByAi: boolean;
}

/** One garment's provenance: which photo, and which part of it. */
interface CropOrigin {
  source: Blob;
  box: CropBox;
}

export default function AddPage() {
  const router = useRouter();
  const addItems = useCloset((state) => state.addItems);
  const closet = useCloset((state) => state.items);
  const knownBrands = useMemo(() => availableBrands(closet), [closet]);
  const backgroundRemoval = usePreferences((state) => state.preferences.backgroundRemoval);
  const [queue, setQueue] = useState<Pending[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [cropSource, setCropSource] = useState<Blob | null>(null);
  /*
   * Cropping used to exist only behind "one photo, several pieces". Any other
   * photo went in whole — so a mirror selfie became an "item" that was mostly
   * bedroom, and every collage inherited it. The same boxing tool now opens on
   * a queued row; this remembers which row so it can be replaced by what comes
   * back out.
   */
  const [recropKey, setRecropKey] = useState<string | null>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const outfitInput = useRef<HTMLInputElement>(null);

  const patch = useCallback((key: string, next: Partial<Pending>) => {
    setQueue((current) =>
      current.map((entry) => (entry.key === key ? { ...entry, ...next } : entry)),
    );
  }, []);

  const ingest = useCallback(
    async (
      accepted: Blob[],
      options?: {
        autoCutout?: boolean;
        /** Aligned with `accepted`: where each one came from. */
        origins?: (CropOrigin | undefined)[];
      },
    ) => {
      if (!accepted.length) return;

      const seeded: Pending[] = accepted.map((file, index) => ({
        key: createId('pending'),
        origin: options?.origins?.[index],
        stage: 'processing',
        useCutout: false,
        taggedByAi: false,
        draft: { ...EMPTY_DRAFT, name: '' },
        source: file,
        previewUrl: URL.createObjectURL(file),
      }));
      setQueue((current) => [...current, ...seeded]);

      // Sequential rather than parallel: decoding several multi-megapixel
      // photos at once locks up a phone browser for seconds.
      for (let index = 0; index < accepted.length; index += 1) {
        const file = accepted[index];
        const entry = seeded[index];
        try {
          const processed = await processPhoto(file);
          const draft: ItemDraft = {
            ...EMPTY_DRAFT,
            primaryColor: processed.dominantName,
            primaryColorHex: processed.dominantHex,
            name: '',
          };
          patch(entry.key, {
            stage: 'ready',
            photo: { blob: processed.blob, width: processed.width, height: processed.height },
            draft,
          });
          if (backgroundRemoval !== 'off') {
            const cutout = await removeBackground(processed.blob, backgroundRemoval);

            /*
             * A photo the fill could not read is the whole reason this screen
             * needs a crop, so it has to be said out loud. This check sits
             * OUTSIDE the branch below on purpose: it used to live inside it,
             * where an unreadable photo — which is exactly the case that
             * produces no cut-out — could never reach it, so a mirror selfie
             * failed silently and went into the closet whole.
             */
            if (!cutout || !cutout.usable) {
              patch(entry.key, { busyBackground: true, useCutout: false });
            }

            if (cutout && cutout.usable) {
              /*
               * Order matters here. The guess reads coverage of the WHOLE frame
               * to tell a ring from a coat, and trimming sets that to roughly
               * one — so ask the shape what it is BEFORE cropping it.
               */
              const shapeGuess = await guessCategoryFromCutout(cutout.blob);

              /*
               * Then crop to the garment. The flood fill clears the background
               * but keeps the frame the camera chose, so a jumper shot from
               * across the room stayed a small object adrift in a big
               * transparent canvas — and every tile, collage and shared image
               * inherited that framing. This is what makes a closet read as a
               * rail of clothes rather than a pile of snapshots.
               */
              const trimmed = await trimToGarment(cutout.blob);

              const shownBlob = trimmed?.blob ?? cutout.blob;
              patch(entry.key, {
                cutoutUrl: URL.createObjectURL(shownBlob),
                cutout: {
                  blob: shownBlob,
                  width: trimmed?.width ?? processed.width,
                  height: trimmed?.height ?? processed.height,
                },
                // A crop out of a worn outfit rarely has a backdrop worth
                // removing, so the cut-out is offered rather than applied.
                useCutout: options?.autoCutout ?? true,
              });

              /*
               * The cut-out is a garment-shaped mask, so the shape can say which
               * SLOT this is — a top, trousers, a shoe — and that turns a
               * 42-option picker into a handful. It does not claim to know a
               * t-shirt from a polo, because an outline does not: it offers the
               * most ordinary member of the slot as a starting point and says
               * why, so disagreeing is one tap.
               * Below CONFIDENT it says nothing and the picker is left alone; a
               * wrong category costs more than an unset one.
               */
              if (shapeGuess && shapeGuess.confidence >= CONFIDENT) {
                patch(entry.key, {
                  guess: shapeGuess,
                  draft: { ...draft, category: shapeGuess.category },
                });
              }
            }
          }

        } catch (error) {
          patch(entry.key, { stage: 'failed', error: (error as Error).message });
        }
      }
    },
    [backgroundRemoval, patch],
  );

  /** Files arriving from a picker still have to be filtered before they queue. */
  const ingestFiles = useCallback(
    (files: FileList | null) => {
      if (!files?.length) return;
      const images = Array.from(files).filter((file) => file.type.startsWith('image/'));
      if (!images.length) {
        toast('Those files are not images', { tone: 'danger' });
        return;
      }
      if (images.length < files.length) {
        toast(`Skipped ${files.length - images.length} file that is not an image`);
      }
      void ingest(images);
    },
    [ingest],
  );

  /** One photo, several boxes: crop each region and queue it as its own piece. */
  const ingestCrops = useCallback(
    async (source: Blob, boxes: CropBox[]) => {
      setCropSource(null);
      try {
        const bitmap = await createImageBitmap(source, { imageOrientation: 'from-image' });
        const crops: Blob[] = [];
        for (const box of boxes) {
          crops.push(await cropToBlob(bitmap, box));
        }
        bitmap.close();
        // A crop taken FROM a queued row replaces it; the boxes are the piece now.
        if (recropKey) {
          discard(recropKey);
          setRecropKey(null);
        }
        /*
         * autoCutout stays FALSE here, and that is the whole point of cropping.
         * A crop out of a worn photo has skin, a wall and a phone around the
         * garment rather than a plain backdrop, so a flood fill seeded from its
         * edges eats into the person: cropping a mirror selfie to a tank top and
         * then cutting it out took half an arm with it. The crop IS the item.
         * The cut-out is still one toggle away for the rare crop that happens to
         * sit on a plain surface.
         */
        /*
         * autoCutout stays FALSE, and that is the whole point of cropping.
         * A crop out of a worn photo has skin, a wall and a phone around the
         * garment rather than a plain backdrop, so nothing seeded from its
         * edges can find the difference: it eats into the person instead.
         * Separating the garment from the room is not this screen's job. The
         * crop IS the item, and the only thing that matters is that the box was
         * easy to place exactly where she meant it.
         */
        await ingest(crops, { autoCutout: false, origins: boxes.map((box) => ({ source, box })) });
      } catch (error) {
        toast((error as Error).message || 'Could not cut that photo up', { tone: 'danger' });
      }
    },
    [ingest],
  );

  function addBlank() {
    setQueue((current) => [
      ...current,
      {
        key: createId('pending'),
        stage: 'ready',
        useCutout: false,
        taggedByAi: false,
        draft: { ...EMPTY_DRAFT },
      },
    ]);
  }

  function discard(key: string) {
    setQueue((current) => {
      const going = current.find((entry) => entry.key === key);
      if (going?.previewUrl?.startsWith('blob:')) URL.revokeObjectURL(going.previewUrl);
      if (going?.cutoutUrl?.startsWith('blob:')) URL.revokeObjectURL(going.cutoutUrl);
      return current.filter((entry) => entry.key !== key);
    });
  }

  async function saveAll() {
    const ready = queue.filter((entry) => entry.stage === 'ready');
    if (!ready.length) return;
    setSaving(true);

    const drafts: NewClothingItem[] = [];
    for (const entry of ready) {
      let photoId: string | undefined;
      let cutoutId: string | undefined;

      if (entry.photo) {
        photoId = createId('photo');
        await putPhoto({
          id: photoId,
          blob: entry.photo.blob,
          width: entry.photo.width,
          height: entry.photo.height,
          createdAt: nowIso(),
        });
      }
      if (entry.cutout && entry.useCutout) {
        cutoutId = createId('photo');
        await putPhoto({
          id: cutoutId,
          blob: entry.cutout.blob,
          width: entry.cutout.width,
          height: entry.cutout.height,
          createdAt: nowIso(),
        });
      }

      const price = Number.parseFloat(entry.draft.purchasePrice);
      drafts.push({
        photoId,
        cutoutId,
        name: draftLabel(entry.draft),
        category: entry.draft.category,
        primaryColor: entry.draft.primaryColor,
        primaryColorHex: entry.draft.primaryColorHex,
        secondaryColors: entry.draft.secondaryColors,
        pattern: entry.draft.pattern,
        patternScale: entry.draft.patternScale || undefined,
        fit: entry.draft.fit || undefined,
        length: entry.draft.length || undefined,
        rise: entry.draft.rise || undefined,
        material: entry.draft.material || undefined,
        brand: entry.draft.brand || undefined,
        formality: entry.draft.formality,
        seasons: entry.draft.seasons,
        styles: entry.draft.styles,
        notes: entry.draft.notes || undefined,
        care: entry.draft.care ?? undefined,
        purchasePrice: Number.isFinite(price) ? price : undefined,
        detection: {
          source: entry.taggedByAi ? 'ai' : 'manual',
          editedByUser: false,
        },
      });
    }

    await addItems(drafts);
    setSaving(false);
    toast(`Added ${drafts.length} ${drafts.length === 1 ? 'piece' : 'pieces'}`, { tone: 'success' });
    router.push('/closet');
  }

  const editingEntry = queue.find((entry) => entry.key === editing) ?? null;


  /*
   * Counted across the closet AND the queue, so the number moves as she works
   * rather than only after saving — that is the whole point of showing it.
   */
  const progress = useMemo(() => {
    const categories = [
      ...closet.filter((item) => !item.archivedAt).map((item) => item.category),
      ...queue.filter((entry) => entry.stage === 'ready').map((entry) => entry.draft.category),
    ];
    return progressLine(countBySlot(categories));
  }, [closet, queue]);
  const readyCount = queue.filter((entry) => entry.stage === 'ready').length;
  const working = queue.some((entry) => entry.stage === 'processing');

  return (
    <div className="flex min-h-dvh flex-col">
      <header
        className="flex items-center justify-between gap-3 px-5 pb-3"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 1.25rem)' }}
      >
        <h1 className="text-title">Add clothing</h1>
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Close"
          className="pressable grid size-9 place-items-center rounded-full bg-[var(--surface-alt)]"
        >
          <X size={18} />
        </button>
      </header>

      <input
        ref={cameraInput}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(event) => {
          ingestFiles(event.target.files);
          event.target.value = '';
        }}
      />
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(event) => {
          ingestFiles(event.target.files);
          event.target.value = '';
        }}
      />
      <input
        ref={outfitInput}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file?.type.startsWith('image/')) setCropSource(file);
        }}
      />

      <div className="flex-1 space-y-5 px-5">
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => cameraInput.current?.click()}
            className="card pressable flex flex-col items-center gap-2 p-5"
          >
            <Camera size={22} className="text-[var(--brand)]" />
            <span className="text-[0.875rem] font-medium">Take a photo</span>
          </button>
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            className="card pressable flex flex-col items-center gap-2 p-5"
          >
            <ImagePlus size={22} className="text-[var(--brand)]" />
            <span className="text-[0.875rem] font-medium">Choose images</span>
          </button>
        </div>

        <button
          type="button"
          onClick={() => outfitInput.current?.click()}
          className="card pressable flex w-full items-center gap-3 border-[var(--brand)] p-4 text-left"
        >
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--brand)] text-[var(--on-brand)]">
            <Scissors size={18} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[0.9375rem] font-medium">
              One photo, several pieces{' '}
              <span className="text-[0.75rem] font-semibold text-[var(--brand)]">FASTEST</span>
            </span>
            <span className="block text-[0.8125rem] leading-relaxed text-[var(--text-muted)]">
              Photograph a whole outfit, or use a picture you liked, and box each garment out of it.
            </span>
          </span>
        </button>

        {queue.length ? null : (
          <section className="card p-4">
            <h2 className="text-heading">Getting a good photo</h2>
            <ul className="mt-3 space-y-2.5">
              {[
                'Lay the piece on a plain floor, bed or wall — the plainer the background, the cleaner the cut-out.',
                'Fill most of the frame with the garment, and shoot straight down rather than at an angle.',
                'In a hurry? Lay several things out together and use “one photo, several pieces”.',
              ].map((tip, index) => (
                <li key={tip} className="flex gap-3 text-[0.875rem] leading-relaxed">
                  <span className="grid size-5 shrink-0 place-items-center rounded-full bg-[var(--surface-alt)] text-[0.75rem] font-semibold text-[var(--text-muted)]">
                    {index + 1}
                  </span>
                  <span className="text-[var(--text-muted)]">{tip}</span>
                </li>
              ))}
            </ul>
            {backgroundRemoval === 'off' ? (
              <p className="mt-3 border-t border-[var(--border)] pt-3 text-[0.8125rem] leading-relaxed text-[var(--text-muted)]">
                Background removal is off — turn it on under{' '}
                <span className="text-[var(--text)]">You → Photos</span>.
              </p>
            ) : null}
          </section>
        )}

        {queue.length ? (
          <ul className="space-y-3">
            {queue.map((entry) => (
              <li key={entry.key} className="card flex items-center gap-3 p-3">
                <div
                  className={cn(
                    'size-16 shrink-0 overflow-hidden rounded-xl bg-[var(--surface-alt)]',
                    entry.useCutout && 'alpha-grid',
                  )}
                >
                  {entry.useCutout && entry.cutoutUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- blob: URL
                    <img
                      src={entry.cutoutUrl}
                      alt=""
                      // contain, not cover: a cut-out is the garment and nothing
                      // else, so cropping it again would clip the shoulders off
                      // the very thing she is being asked to approve.
                      className="size-full object-contain"
                    />
                  ) : entry.previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- blob: URL
                    <img
                      src={entry.previewUrl}
                      alt=""
                      className="size-full object-cover"
                    />
                  ) : (
                    <div
                      className="size-full"
                      style={{ background: entry.draft.primaryColorHex }}
                    />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  {entry.stage === 'processing' ? (
                    <p className="flex items-center gap-2 text-[0.875rem] text-[var(--text-muted)]">
                      <Loader2 size={14} className="animate-spin" /> Reading the photo…
                    </p>
                  ) : entry.stage === 'failed' ? (
                    <p className="text-[0.875rem] text-[var(--danger)]">
                      {entry.error ?? 'Could not read that image'}
                    </p>
                  ) : (
                    <>
                      <p className="truncate text-[0.9375rem] font-medium">
                        {draftLabel(entry.draft)}
                      </p>
                      <p className="truncate text-[0.8125rem] text-[var(--text-muted)]">
                        {categoryLabel(entry.draft.category)} ·{' '}
                        {titleCase(entry.draft.primaryColor)}
                      </p>
                      {/*
                       * Say that the category was guessed and what from. An
                       * unlabelled guess is worse than none: it reads as a fact,
                       * so nobody checks it, and a wrong word ends up in the
                       * closet. Named as a guess, correcting it is one tap.
                       */}
                      {/*
                       * Not truncated. The whole value of naming this a guess is
                       * the reason attached to it — "Guessed from the photo — …"
                       * with the reason clipped tells the reader nothing they can
                       * judge, so it wraps instead.
                       */}
                      {entry.guess ? (
                        <p className="text-[0.75rem] leading-snug text-[var(--text-muted)] opacity-80">
                          Guessed from the photo — {entry.guess.because}. Tap to change.
                        </p>
                      ) : null}
                      {/*
                       * Correcting a guess used to mean: pencil, sheet, a
                       * forty-two option select, close. Four moves and a scroll,
                       * per wrong item, on a phone — which is exactly the tax
                       * that makes cataloguing feel like a second job.
                       * The shape already narrowed it to a slot, so the six
                       * plausible answers fit on one row. One tap, no sheet.
                       * The pencil is still there for everything else.
                       */}
                      {entry.stage === 'ready' ? (
                        <div className="scroll-row -mx-1 mt-1.5 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
                          {CATEGORIES.filter(
                            (meta) => meta.slot === slotOf(entry.draft.category),
                          ).map((meta) => (
                            <Chip
                              key={meta.category}
                              selected={meta.category === entry.draft.category}
                              className="shrink-0 text-[0.75rem]"
                              onClick={() =>
                                patch(entry.key, {
                                  draft: { ...entry.draft, category: meta.category },
                                })
                              }
                            >
                              {meta.label}
                            </Chip>
                          ))}
                        </div>
                      ) : null}
                      {entry.busyBackground ? (
                        <p className="mt-1 text-[0.75rem] leading-snug text-[var(--text-muted)]">
                          Busy background — the cut-out could not find the edges. Crop to just
                          the garment and it will look like the rest.
                        </p>
                      ) : null}
                      {entry.photo ? (
                        <span className="mt-1 inline-flex items-center gap-1 text-[0.75rem] text-[var(--text-faint)]">
                          <Sparkles size={11} /> Colour read from the photo
                        </span>
                      ) : null}
                    </>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  {entry.stage === 'ready' && (entry.source || entry.photo) ? (
                    <button
                      type="button"
                      onClick={() => {
                        setRecropKey(entry.key);
                        setCropSource(entry.source ?? entry.photo!.blob);
                      }}
                      aria-label="Crop to the garment"
                      className={cn(
                        'pressable grid size-9 place-items-center rounded-full',
                        entry.busyBackground
                          ? 'bg-[var(--brand)] text-[var(--on-brand)]'
                          : 'bg-[var(--surface-alt)]',
                      )}
                    >
                      <Scissors size={16} />
                    </button>
                  ) : null}
                  {entry.stage === 'ready' ? (
                    <button
                      type="button"
                      onClick={() => setEditing(entry.key)}
                      aria-label="Edit details"
                      className="pressable grid size-9 place-items-center rounded-full bg-[var(--surface-alt)]"
                    >
                      <PenLine size={16} />
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => discard(entry.key)}
                    aria-label="Remove"
                    className="pressable grid size-9 place-items-center rounded-full text-[var(--text-faint)]"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : null}

        <button
          type="button"
          onClick={addBlank}
          className="pressable w-full rounded-2xl border border-dashed border-[var(--border-strong)] py-3 text-[0.875rem] text-[var(--text-muted)]"
        >
          Add a piece without a photo
        </button>
      </div>

      <div
        className={cn(
          'sticky bottom-0 mt-6 border-t border-[var(--border)] bg-[var(--bg)]/92 px-5 pt-3 backdrop-blur-xl',
          // Nothing queued means nothing to save; an inert button just looks broken.
          queue.length ? '' : 'hidden',
        )}
        style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
      >
        {/*
         * What the photographing is buying, in a number that is true.
         * Cataloguing is the tedious half of any wardrobe app and the usual
         * reason people stop; the antidote is not a badge but the fact that
         * outfits multiply — the tenth piece really is worth more than the
         * ninth. It counts COMBINATIONS and says so: whether a given pairing
         * looks good is the outfit engine's job, and it is not flattered here.
         * When nothing combines yet it names the one slot that would change
         * that, which is a nudge that happens to be arithmetic.
         */}
        {progress ? (
          <p className="mb-2 text-center text-[0.8125rem] text-[var(--text-muted)]">{progress}</p>
        ) : null}
        <Button full size="lg" onClick={saveAll} disabled={!readyCount || saving || working}>
          {saving
            ? 'Saving…'
            : working
              ? 'Still reading photos…'
              : readyCount
                ? `Add ${readyCount} to closet`
                : 'Add to closet'}
        </Button>
      </div>
      {cropSource ? (
        <MultiCrop
          file={cropSource}
          onCancel={() => setCropSource(null)}
          onConfirm={(boxes) => void ingestCrops(cropSource, boxes)}
        />
      ) : null}

      <Sheet
        open={Boolean(editingEntry)}
        onClose={() => setEditing(null)}
        title="Item details"
        footer={
          <Button full onClick={() => setEditing(null)}>
            Done
          </Button>
        }
      >
        {editingEntry ? (
          <>
            {editingEntry.cutout ? (
              <label className="mb-4 flex items-center justify-between gap-3 rounded-2xl bg-[var(--surface-alt)] p-3">
                <span className="text-[0.875rem]">Use the cut-out image</span>
                <input
                  type="checkbox"
                  checked={editingEntry.useCutout}
                  onChange={(event) =>
                    patch(editingEntry.key, { useCutout: event.target.checked })
                  }
                  className="size-5 accent-[var(--brand)]"
                />
              </label>
            ) : null}
            <ItemForm
              draft={editingEntry.draft}
              knownBrands={knownBrands}
              onChange={(next) =>
                patch(editingEntry.key, { draft: { ...editingEntry.draft, ...next } })
              }
            />
          </>
        ) : null}
      </Sheet>
    </div>
  );
}
