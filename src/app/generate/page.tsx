'use client';

import { ArrowLeftRight, Check, ChevronDown, Share2, Sparkles, Split, X } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';

import { ItemTile } from '@/components/closet/ItemTile';
import { OutfitCollage } from '@/components/outfit/OutfitCollage';
import { OutfitStack } from '@/components/outfit/OutfitStack';
import { PageHeader } from '@/components/PageHeader';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { EmptyState, SectionHeader, Spinner } from '@/components/ui/Feedback';
import { Field, Select, Textarea } from '@/components/ui/Field';
import { Sheet } from '@/components/ui/Sheet';
import { analyzeHarmony } from '@/domain/color';
import { readIntent } from '@/domain/intent';
import { buildOutfitLocally } from '@/domain/outfitEngine';
import {
  FORMALITY_LABEL,
  FORMALITY_ORDER,
  OCCASIONS,
  SLOT_LABEL,
  SLOT_LABEL_PLURAL,
  STYLES,
  STYLE_LABEL,
  slotOf,
} from '@/domain/taxonomy';
import { renderComparisonImage, shareImage } from '@/lib/outfitImage';
import { todayKey } from '@/lib/date';
import { COLOR_NAMES, swatches } from '@/lib/palette';
import { formatTemperatureLong, titleCase } from '@/lib/format';
import { useActiveItems, useCloset, useResolvedItems } from '@/store/closet';
import { useOutfits } from '@/store/outfits';
import { usePreferences } from '@/store/preferences';
import { toast } from '@/store/toast';
import { useWeather } from '@/store/weather';
import type { ClothingItem, Formality, GeneratedOutfit, Style } from '@/types';

export default function GeneratePage() {
  return (
    <Suspense fallback={<div className="skeleton m-5 h-80 rounded-[var(--radius-card)]" />}>
      <Generator />
    </Suspense>
  );
}

function Generator() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { hydrated } = useCloset();
  const items = useActiveItems();
  const saveGenerated = useOutfits((state) => state.saveGenerated);
  const wearOutfit = useOutfits((state) => state.wearOutfit);
  const preferences = usePreferences((state) => state.preferences);
  const weather = useWeather((state) => state.snapshot);

  const [prompt, setPrompt] = useState('');
  const [occasion, setOccasion] = useState<string | undefined>();
  const [formality, setFormality] = useState<Formality | ''>('');
  const [style, setStyle] = useState<Style | ''>('');
  const [colorPreference, setColorPreference] = useState('');
  const [cleanOnly, setCleanOnly] = useState(true);
  const [includeIds, setIncludeIds] = useState<string[]>([]);
  const [excludeIds, setExcludeIds] = useState<string[]>([]);
  const [picker, setPicker] = useState<'include' | 'exclude' | null>(null);

  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ outfit: GeneratedOutfit } | null>(null);
  const [rival, setRival] = useState<GeneratedOutfit | null>(null);
  /*
   * The engine is deterministic, so the same closet and the same question give
   * the same answer — and "Try again" returned the identical outfit however
   * many times it was pressed, which reads as the app ignoring you. Holding
   * back what has just been shown makes a retry mean something. It is a
   * penalty, not an exclusion, so a small wardrobe still gets dressed.
   */
  const [alreadySeen, setAlreadySeen] = useState<string[]>([]);
  const [sharing, setSharing] = useState(false);

  // "Style this" from an item page arrives as a query parameter.
  const preselected = searchParams.get('include');
  useEffect(() => {
    if (preselected) setIncludeIds((current) => (current.includes(preselected) ? current : [...current, preselected]));
  }, [preselected]);

  const resultItems = useResolvedItems(result?.outfit.itemIds);
  const rivalItems = useResolvedItems(rival?.itemIds);
  const includeItems = useResolvedItems(includeIds);
  const excludeItems = useResolvedItems(excludeIds);

  /** What the collapsed panel says, so a set option is never hidden silently. */
  const refinementSummary = [
    formality ? FORMALITY_LABEL[formality] : null,
    style ? STYLE_LABEL[style] : null,
    colorPreference ? titleCase(colorPreference) : null,
    includeIds.length ? `${includeIds.length} must-have` : null,
    excludeIds.length ? `${excludeIds.length} excluded` : null,
    cleanOnly ? null : 'including dirty',
  ]
    .filter(Boolean)
    .join(' · ');

  const harmony = useMemo(
    () =>
      resultItems.length
        ? analyzeHarmony(resultItems.map((item) => item.primaryColorHex))
        : null,
    [resultItems],
  );

  /** What the typed sentence means, if anything. Updated as she types. */
  const intent = useMemo(() => readIntent(prompt || occasion || ''), [prompt, occasion]);

  async function run(options?: { fresh?: boolean }) {
    if (!items.length) return;
    setBusy(true);
    const resting = options?.fresh ? [] : alreadySeen;
    const generated = { outfit: buildOutfitLocally({
      request: {
        prompt: prompt.trim() || occasion || 'Something good for today',
        occasion: occasion ?? intent?.occasion,
        // An explicit choice always beats a reading of the sentence.
        formality: formality || intent?.formality,
        style: style || undefined,
        // An explicit choice wins; otherwise the day may ask for one, as a
        // funeral asks for black.
        colorPreference: colorPreference || intent?.colorPreference || undefined,
        temperature: intent?.temperature ?? weather?.temperature,
        weatherCondition: weather?.condition,
        includeItemIds: includeIds,
        excludeItemIds: excludeIds,
        cleanOnly,
      },
      closet: cleanOnly ? items.filter((item) => item.laundry === 'clean') : items,
      // A stated temperature in the sentence outranks the forecast: she knows
      // whether she will be indoors.
      weather: intent?.temperature != null ? null : weather,
      preferredStyles: style ? [style] : (intent?.styles ?? preferences.preferredStyles),
      avoidColors: preferences.avoidColors,
      units: preferences.units,
      today: todayKey(),
      restingItemIds: resting,
      preferCategories: intent?.prefer,
      avoidCategories: intent?.avoid,
    }) };
    setResult(generated);
    setRival(null);
    // Remember the last two looks, so retries move on without exhausting a
    // small wardrobe after a couple of presses.
    setAlreadySeen((current) =>
      [...generated.outfit.itemIds, ...current].slice(0, generated.outfit.itemIds.length * 2),
    );
    setBusy(false);
  }

  /**
   * A second opinion. The pieces already chosen are excluded so the engine has
   * to reach for something genuinely different rather than shuffling the same
   * outfit — a comparison between two near-identical looks helps nobody.
   */
  async function runRival() {
    if (!result) return;
    setBusy(true);
    const pool = cleanOnly ? items.filter((item) => item.laundry === 'clean') : items;
    const generated = { outfit: buildOutfitLocally({
      request: {
        prompt: prompt.trim() || occasion || 'Something good for today',
        occasion: occasion ?? intent?.occasion,
        formality: formality || intent?.formality,
        style: style || undefined,
        // An explicit choice wins; otherwise the day may ask for one, as a
        // funeral asks for black.
        colorPreference: colorPreference || intent?.colorPreference || undefined,
        temperature: intent?.temperature ?? weather?.temperature,
        weatherCondition: weather?.condition,
        includeItemIds: includeIds,
        excludeItemIds: [...excludeIds, ...result.outfit.itemIds],
        cleanOnly,
      },
      closet: pool,
      weather: intent?.temperature != null ? null : weather,
      preferredStyles: style ? [style] : (intent?.styles ?? preferences.preferredStyles),
      avoidColors: preferences.avoidColors,
      units: preferences.units,
      today: todayKey(),
      preferCategories: intent?.prefer,
      avoidCategories: intent?.avoid,
    }) };
    setBusy(false);
    if (generated.outfit.itemIds.length < 2) {
      toast('Not enough clean clothes left for a second option', { tone: 'danger' });
      return;
    }
    setRival(generated.outfit);
  }

  async function askSomeone() {
    if (!result || !rival) return;
    setSharing(true);
    let blob: Blob;
    try {
      blob = await renderComparisonImage(
        { items: resultItems, label: 'A' },
        { items: rivalItems, label: 'B' },
        { title: occasion ? `Which one for ${occasion.toLowerCase()}?` : 'Which one?' },
      );
    } catch (error) {
      toast((error as Error).message, { tone: 'danger' });
      setSharing(false);
      return;
    }
    // Rendering is the slow part and the part that can fail; handing the file
    // to the OS is neither. Releasing the button here means a share sheet the
    // user ignores cannot leave the screen stuck.
    setSharing(false);
    const outcome = await shareImage(blob, 'which-one.png', 'A or B?');
    if (outcome === 'downloaded') toast('Saved to your downloads — send it on');
  }

  async function save(alsoWear: boolean) {
    if (!result) return;
    const outfit = await saveGenerated(result.outfit, {
      occasion,
      weatherContext: weather
        ? `${formatTemperatureLong(weather.temperature, preferences.units)}, ${weather.condition}`
        : undefined,
    });
    if (alsoWear) await wearOutfit(outfit.id);
    toast(alsoWear ? 'Saved and logged as worn' : 'Saved to your outfits', { tone: 'success' });
    router.push(`/outfits/${outfit.id}`);
  }

  function swap(slot: string, itemId: string) {
    if (!result) return;
    const replaced = result.outfit.itemIds.filter((id) => {
      const current = items.find((item) => item.id === id);
      return !current || slotOf(current.category) !== slot;
    });
    setResult({
      ...result,
      outfit: { ...result.outfit, itemIds: [...replaced, itemId] },
    });
  }

  /*
   * An outfit needs something up top, something below and shoes. With less than
   * that the engine returns a single garment and a list of warnings, which the
   * screen then dresses up with a colour score — worse than admitting it cannot
   * do the job yet.
   */
  const wearable = ['top', 'fullbody'].some((slot) =>
    items.some((item) => slotOf(item.category) === slot),
  )
    ? items.some((item) => slotOf(item.category) === 'footwear')
    : false;
  const missingSlots = (['top', 'bottom', 'footwear'] as const).filter(
    (slot) => !items.some((item) => slotOf(item.category) === slot),
  );

  if (hydrated && (!items.length || !wearable)) {
    return (
      <>
        <PageHeader title="Generate" />
        <EmptyState
          icon={<Sparkles size={26} />}
          title={items.length ? 'Not quite enough to dress you' : 'Nothing to work with yet'}
          body={
            items.length
              ? `An outfit needs something up top, something below and shoes. You are missing ${missingSlots
                  .map((slot) => SLOT_LABEL_PLURAL[slot].toLowerCase())
                  .join(' and ')}.`
              : 'FitCheck only ever suggests clothes you actually own, so it needs a closet first.'
          }
          action={<ButtonLink href="/add">Add clothing</ButtonLink>}
        />
      </>
    );
  }

  if (result) {
    return (
      <div className="pb-6">
        <PageHeader
          title={result.outfit.name}
          large={false}
          subtitle={occasion ? titleCase(occasion) : undefined}
          action={
            <button
              type="button"
              onClick={() => setResult(null)}
              aria-label="Back to options"
              className="pressable grid size-9 place-items-center rounded-full bg-[var(--surface-alt)]"
            >
              <X size={18} />
            </button>
          }
        />

        <div className="space-y-5 px-5">
          {rival ? (
            <section className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Option
                  label="A"
                  items={resultItems}
                  onChoose={() => setRival(null)}
                />
                <Option
                  label="B"
                  items={rivalItems}
                  onChoose={() => {
                    setResult({ outfit: rival });
                    setRival(null);
                  }}
                />
              </div>
              <Button
                full
                variant="secondary"
                icon={<Share2 size={16} />}
                disabled={sharing}
                onClick={askSomeone}
              >
                {sharing ? 'Rendering…' : 'Ask someone which'}
              </Button>
              <p className="text-center text-[0.8125rem] text-[var(--text-muted)]">
                Sends one picture of both. Tap a look to go with it.
              </p>
            </section>
          ) : (
            <>
              <OutfitCollage
                items={resultItems}
                onSelect={(item) => router.push(`/closet/${item.id}`)}
              />
              <OutfitStack
                items={resultItems}
                onSelect={(item) => router.push(`/closet/${item.id}`)}
              />
            </>
          )}

          {!rival && result.outfit.warnings?.length ? (
            <div className="rounded-2xl bg-[var(--warning-soft)] p-3 text-[0.8125rem] text-[var(--warning)]">
              {result.outfit.warnings.join(' ')}
            </div>
          ) : null}

          {rival ? null : (
          <section className="card p-4">
            <h2 className="text-heading">Why this works</h2>
            <p className="mt-2 text-[0.9375rem] leading-relaxed text-[var(--text-muted)]">
              {result.outfit.explanation}
            </p>
            {harmony ? (
              <div className="mt-3 border-t border-[var(--border)] pt-3">
                <div className="mb-1.5 flex items-center justify-between gap-3">
                  <span className="text-label text-[var(--text-muted)]">Colour</span>
                  <span className="text-[0.75rem] tabular-nums text-[var(--text-faint)]">
                    {harmony.score}/100
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-[var(--surface-sunken)]">
                  <div
                    className="h-full rounded-full bg-[var(--brand)]"
                    style={{ width: `${harmony.score}%` }}
                  />
                </div>
                <p className="mt-2 text-[0.875rem] leading-relaxed text-[var(--text-muted)]">
                  {result.outfit.colorNotes || harmony.summary}
                </p>
                {harmony.clashes.map((clash) => (
                  <p key={clash} className="mt-1.5 text-[0.8125rem] text-[var(--warning)]">
                    {clash}
                  </p>
                ))}
              </div>
            ) : null}
          </section>
          )}

          {!rival && result.outfit.alternatives?.length ? (
            <section>
              <SectionHeader title="Swap something" />
              <div className="space-y-2">
                {result.outfit.alternatives.map((alternative) => {
                  const item = items.find((entry) => entry.id === alternative.itemId);
                  if (!item) return null;
                  return (
                    <button
                      key={alternative.itemId}
                      type="button"
                      onClick={() => swap(alternative.slot, alternative.itemId)}
                      className="card pressable flex w-full items-center gap-3 p-3 text-left"
                    >
                      <ArrowLeftRight size={16} className="shrink-0 text-[var(--text-faint)]" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[0.9375rem] font-medium">
                          {item.name}
                        </span>
                        <span className="block truncate text-[0.8125rem] text-[var(--text-muted)]">
                          {alternative.why}
                        </span>
                      </span>
                      <span className="text-label shrink-0 text-[var(--text-faint)]">
                        {SLOT_LABEL[alternative.slot as keyof typeof SLOT_LABEL] ?? alternative.slot}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          ) : null}

          {rival ? null : (
            <Button
              variant="secondary"
              full
              icon={<Split size={16} />}
              disabled={busy}
              onClick={() => void runRival()}
            >
              {busy ? 'Building a second option…' : 'Can\u2019t decide? Compare two'}
            </Button>
          )}

          <div className="flex gap-2">
            <Button variant="secondary" full onClick={() => void run()} disabled={busy}>
              {busy ? 'Thinking…' : 'Try again'}
            </Button>
            <Button full onClick={() => save(false)}>
              Save outfit
            </Button>
          </div>
          <Button variant="ghost" full icon={<Check size={16} />} onClick={() => save(true)}>
            Save and wear today
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-6">
      <PageHeader title="Generate" subtitle="Describe the day. It picks from your closet." />

      <div className="space-y-6 px-5">
        <Field label="Where are you going?">
          <Textarea
            rows={3}
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="First date at a wine bar, walking there, might get cold later"
          />
        </Field>

        {intent ? (
          <p className="flex items-start gap-2 rounded-2xl bg-[var(--info-soft)] p-3 text-[0.8125rem] leading-relaxed text-[var(--info)]">
            <Sparkles size={14} className="mt-0.5 shrink-0" />
            {intent.summary}.
          </p>
        ) : null}

        <div>
          <div className="flex flex-wrap gap-2">
            {OCCASIONS.map((entry) => (
              <Chip
                key={entry.key}
                selected={occasion === entry.label}
                onClick={() => {
                  if (occasion === entry.label) {
                    setOccasion(undefined);
                    return;
                  }
                  setOccasion(entry.label);
                  setPrompt(entry.prompt);
                  setFormality(entry.formality);
                }}
              >
                {entry.label}
              </Chip>
            ))}
          </div>
        </div>

        <details className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
          <summary className="pressable flex cursor-pointer list-none items-center justify-between gap-3">
            <span>
              <span className="block text-[0.9375rem] font-medium">Anything else?</span>
              <span className="mt-0.5 block text-[0.8125rem] text-[var(--text-muted)]">
                {refinementSummary || 'Formality, colour, pieces to include or leave out'}
              </span>
            </span>
            <ChevronDown size={17} className="shrink-0 text-[var(--text-faint)]" />
          </summary>

          <div className="mt-4 space-y-5 border-t border-[var(--border)] pt-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Formality">
            <Select
              value={formality}
              onChange={(event) => setFormality(event.target.value as Formality | '')}
            >
              <option value="">Any</option>
              {FORMALITY_ORDER.map((entry) => (
                <option key={entry} value={entry}>
                  {FORMALITY_LABEL[entry]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Style">
            <Select value={style} onChange={(event) => setStyle(event.target.value as Style | '')}>
              <option value="">Any</option>
              {STYLES.map((entry) => (
                <option key={entry} value={entry}>
                  {STYLE_LABEL[entry]}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div>
          <span className="text-label mb-2 block text-[var(--text-muted)]">
            Lean into a colour <span className="normal-case opacity-70">(optional)</span>
          </span>
          <div className="flex flex-wrap gap-2">
            {COLOR_NAMES.slice(0, 12).map((color) => (
              <Chip
                key={color}
                swatch={swatches[color]}
                selected={colorPreference === color}
                onClick={() => setColorPreference(colorPreference === color ? '' : color)}
              >
                {titleCase(color)}
              </Chip>
            ))}
          </div>
        </div>

        <section className="card divide-y divide-[var(--border)]">
          <PickerRow
            label="Must include"
            count={includeItems.length}
            summary={includeItems.map((item) => item.name).join(', ')}
            onClick={() => setPicker('include')}
          />
          <PickerRow
            label="Leave out"
            count={excludeItems.length}
            summary={excludeItems.map((item) => item.name).join(', ')}
            onClick={() => setPicker('exclude')}
          />
          <button
            type="button"
            onClick={() => setCleanOnly(!cleanOnly)}
            className="pressable flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
          >
            <span className="text-[0.9375rem]">Only use clean clothes</span>
            <span
              className={`grid size-6 place-items-center rounded-full ${
                cleanOnly
                  ? 'bg-[var(--brand)] text-[var(--on-brand)]'
                  : 'bg-[var(--surface-sunken)] text-transparent'
              }`}
            >
              <Check size={14} />
            </span>
          </button>
        </section>

          </div>
        </details>

        {weather ? (
          <p className="text-center text-[0.8125rem] text-[var(--text-muted)]">
            Using today&rsquo;s forecast:{' '}
            {formatTemperatureLong(weather.temperature, preferences.units)},{' '}
            {weather.condition.toLowerCase()} in {weather.locationLabel}.
          </p>
        ) : null}

        <Button
          full
          size="lg"
          onClick={() => {
            setAlreadySeen([]);
            void run({ fresh: true });
          }}
          disabled={busy}
        >
          {busy ? <Spinner label="Building your outfit" /> : 'Generate outfit'}
        </Button>
      </div>

      <Sheet
        open={picker !== null}
        onClose={() => setPicker(null)}
        title={picker === 'include' ? 'Must include' : 'Leave out'}
        footer={
          <Button full onClick={() => setPicker(null)}>
            Done
          </Button>
        }
      >
        <div className="grid grid-cols-3 gap-3 pt-1">
          {items.map((item) => {
            const list = picker === 'include' ? includeIds : excludeIds;
            const setList = picker === 'include' ? setIncludeIds : setExcludeIds;
            return (
              <ItemTile
                key={item.id}
                item={item}
                selected={list.includes(item.id)}
                onClick={() =>
                  setList(
                    list.includes(item.id)
                      ? list.filter((id) => id !== item.id)
                      : [...list, item.id],
                  )
                }
              />
            );
          })}
        </div>
      </Sheet>
    </div>
  );
}

function Option({
  label,
  items,
  onChoose,
}: {
  label: string;
  items: ClothingItem[];
  onChoose: () => void;
}) {
  return (
    <button type="button" onClick={onChoose} className="pressable text-left">
      <OutfitCollage items={items} />
      <span className="mt-2 flex items-center gap-2 px-0.5">
        <span className="grid size-6 place-items-center rounded-full bg-[var(--brand)] text-[0.75rem] font-bold text-[var(--on-brand)]">
          {label}
        </span>
        <span className="min-w-0 truncate text-[0.8125rem] text-[var(--text-muted)]">
          {items.map((item) => item.name).join(', ')}
        </span>
      </span>
    </button>
  );
}

function PickerRow({
  label,
  count,
  summary,
  onClick,
}: {
  label: string;
  count: number;
  summary: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="pressable flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
    >
      <span className="min-w-0">
        <span className="block text-[0.9375rem]">{label}</span>
        {count ? (
          <span className="mt-0.5 block truncate text-[0.8125rem] text-[var(--text-muted)]">
            {summary}
          </span>
        ) : null}
      </span>
      <span className="shrink-0 text-[0.875rem] text-[var(--text-faint)]">
        {count ? count : 'Any'}
      </span>
    </button>
  );
}
