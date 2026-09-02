'use client';

import { ChevronDown } from 'lucide-react';

import { careSummary, suggestedCare } from '@/domain/care';
import { hexForColorName } from '@/domain/color';
import { categoryMeta,
  CATEGORIES,
  FIT_LABEL,
  FIT_ORDER,
  FORMALITY_LABEL,
  FORMALITY_ORDER,
  LENGTH_LABEL,
  LENGTH_ORDER,
  MATERIALS,
  PATTERNS,
  PATTERN_LABEL,
  PATTERN_SCALE_LABEL,
  PATTERN_SCALE_ORDER,
  RISE_LABEL,
  RISE_ORDER,
  SEASONS,
  SEASON_LABEL,
  STYLES,
  STYLE_LABEL,
  categoryLabel,
  hasFit,
  hasLength,
  hasRise,
} from '@/domain/taxonomy';
import { COLOR_NAMES, swatches } from '@/lib/palette';
import { titleCase } from '@/lib/format';
import type {
  CareInstructions,
  Category,
  Fit,
  Formality,
  Length,
  Pattern,
  PatternScale,
  Rise,
  Season,
  Style,
} from '@/types';

import { BrandPicker } from '@/components/closet/BrandPicker';
import { CareForm, EMPTY_CARE } from '@/components/closet/CareForm';
import { Chip } from '@/components/ui/Chip';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';

/** The editable half of a clothing item — everything the AI guesses or you type. */
export interface ItemDraft {
  name: string;
  category: Category;
  primaryColor: string;
  primaryColorHex: string;
  secondaryColors: string[];
  pattern: Pattern;
  /** Empty string means unset — the draft's version of undefined. */
  patternScale: PatternScale | '';
  fit: Fit | '';
  length: Length | '';
  rise: Rise | '';
  material: string;
  brand: string;
  formality: Formality;
  seasons: Season[];
  styles: Style[];
  purchasePrice: string;
  notes: string;
  /** Null until someone records the label. Kept out of the required path. */
  care: CareInstructions | null;
}

export const EMPTY_DRAFT: ItemDraft = {
  name: '',
  category: 'tshirt',
  primaryColor: 'black',
  primaryColorHex: swatches.black,
  secondaryColors: [],
  pattern: 'solid',
  patternScale: '',
  fit: '',
  length: '',
  rise: '',
  material: '',
  brand: '',
  formality: 'casual',
  seasons: ['spring', 'summer', 'fall', 'winter'],
  styles: ['casual'],
  purchasePrice: '',
  notes: '',
  care: null,
};

export function ItemForm({
  draft,
  onChange,
  knownBrands = [],
}: {
  draft: ItemDraft;
  onChange: (patch: Partial<ItemDraft>) => void;
  /** Brands already in the wardrobe, so the same label is not typed twice. */
  knownBrands?: string[];
}) {
  const toggle = <T,>(list: T[], value: T): T[] =>
    list.includes(value) ? list.filter((entry) => entry !== value) : [...list, value];

  // Offered, never applied silently: a guess from the material is only ever a
  // starting point, and the wearer is the one holding the label.
  const suggestion = suggestedCare({ category: draft.category, material: draft.material });

  /*
   * Only the category and the colour actually change what the app can do, and
   * the colour arrives already filled in from the photo. Everything else is
   * refinement — and a form of fourteen inputs and sixty-four chips per garment
   * is precisely what the reviews of these apps describe people quitting over.
   */
  const detailSummary = [
    draft.pattern !== 'solid' ? PATTERN_LABEL[draft.pattern] : null,
    draft.material || null,
    draft.brand || null,
    draft.styles.length === 1 && draft.styles[0] === 'casual' ? null : `${draft.styles.length} styles`,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="space-y-5">
      <Field label="Name">
        <Input
          value={draft.name}
          onChange={(event) => onChange({ name: event.target.value })}
          placeholder="Navy merino crewneck"
          autoCapitalize="sentences"
        />
      </Field>

      <Field label="Category">
        <Select
          value={draft.category}
          onChange={(event) => {
            /*
             * Dressiness follows from what the thing IS. The draft used to keep
             * a hardcoded 'casual' whatever was chosen, so a tank top was filed
             * as casual rather than very-casual — and the outfit engine, which
             * reads formality, then saw nothing wrong with putting it under a
             * pair of dress trousers. Changing the category moves the formality
             * with it; it stays editable underneath.
             */
            const category = event.target.value as Category;
            onChange({ category, formality: categoryMeta(category).formality });
          }}
        >
          {CATEGORIES.map((meta) => (
            <option key={meta.category} value={meta.category}>
              {meta.label}
            </option>
          ))}
        </Select>
      </Field>

      <div>
        <span className="text-label mb-2 block text-[var(--text-muted)]">Colour</span>
        <div className="flex flex-wrap gap-2">
          {COLOR_NAMES.map((name) => (
            <Chip
              key={name}
              swatch={swatches[name]}
              selected={draft.primaryColor === name}
              onClick={() =>
                onChange({ primaryColor: name, primaryColorHex: hexForColorName(name) })
              }
            >
              {titleCase(name)}
            </Chip>
          ))}
        </div>
      </div>

      <details className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
        <summary className="pressable flex cursor-pointer list-none items-center justify-between gap-3">
          <span>
            <span className="block text-[0.9375rem] font-medium">More detail</span>
            <span className="mt-0.5 block text-[0.8125rem] text-[var(--text-muted)]">
              {detailSummary || 'Pattern, material, brand, formality, season, style'}
            </span>
          </span>
          <ChevronDown size={17} className="shrink-0 text-[var(--text-faint)]" />
        </summary>

        <div className="mt-4 space-y-5 border-t border-[var(--border)] pt-4">
      <div>
        <span className="text-label mb-2 block text-[var(--text-muted)]">
          Other colours <span className="normal-case opacity-70">(optional)</span>
        </span>
        <div className="flex flex-wrap gap-2">
          {COLOR_NAMES.filter((name) => name !== draft.primaryColor).map((name) => (
            <Chip
              key={name}
              swatch={swatches[name]}
              selected={draft.secondaryColors.includes(name)}
              onClick={() => onChange({ secondaryColors: toggle(draft.secondaryColors, name) })}
            >
              {titleCase(name)}
            </Chip>
          ))}
        </div>
      </div>

      <Field label="Pattern">
        <Select
          value={draft.pattern}
          onChange={(event) => {
            // Scale is a fact about a print. Going back to solid should not
            // leave a stale "bold" behind for the scorer to reason from.
            const pattern = event.target.value as Pattern;
            onChange(pattern === 'solid' ? { pattern, patternScale: '' } : { pattern });
          }}
        >
          {PATTERNS.map((pattern) => (
            <option key={pattern} value={pattern}>
              {PATTERN_LABEL[pattern]}
            </option>
          ))}
        </Select>
      </Field>

      {/* Only worth asking about a garment that has a print on it. */}
      {draft.pattern !== 'solid' ? (
        <Picker
          label="How big is the print?"
          hint="Two prints of the same size fight; a wide stripe with a micro check does not."
          options={PATTERN_SCALE_ORDER.map((scale) => ({
            value: scale,
            label: PATTERN_SCALE_LABEL[scale],
          }))}
          value={draft.patternScale}
          onPick={(patternScale) => onChange({ patternScale })}
        />
      ) : null}

      {/*
        * Shape. The wardrobe knew colour, warmth and formality and nothing at
        * all about how a thing is cut, which is the first thing anybody looks
        * at — volume against volume reads as pyjamas. Each question only
        * appears on a garment that can answer it, so a pair of sunglasses is
        * never asked how it fits.
        */}
      {hasFit(draft.category) ? (
        <Picker
          label="How it fits"
          hint="Balance is the rule: volume wants something fitted next to it."
          options={FIT_ORDER.map((fit) => ({ value: fit, label: FIT_LABEL[fit] }))}
          value={draft.fit}
          onPick={(fit) => onChange({ fit })}
        />
      ) : null}

      {hasLength(draft.category) ? (
        <Picker
          label="Where it ends"
          options={LENGTH_ORDER.map((length) => ({
            value: length,
            label: LENGTH_LABEL[length],
          }))}
          value={draft.length}
          onPick={(length) => onChange({ length })}
        />
      ) : null}

      {hasRise(draft.category) ? (
        <Picker
          label="Where it sits"
          options={RISE_ORDER.map((rise) => ({ value: rise, label: RISE_LABEL[rise] }))}
          value={draft.rise}
          onPick={(rise) => onChange({ rise })}
        />
      ) : null}

      <div>
        <span className="text-label mb-2 block text-[var(--text-muted)]">Material</span>
        <div className="flex flex-wrap gap-2">
          {MATERIALS.map((material) => (
            <Chip
              key={material}
              selected={draft.material === material}
              onClick={() => onChange({ material: draft.material === material ? '' : material })}
            >
              {material}
            </Chip>
          ))}
        </div>
      </div>

      <BrandPicker
        value={draft.brand}
        known={knownBrands}
        onChange={(brand) => onChange({ brand })}
      />

      <Field label="Formality">
        <Select
          value={draft.formality}
          onChange={(event) => onChange({ formality: event.target.value as Formality })}
        >
          {FORMALITY_ORDER.map((formality) => (
            <option key={formality} value={formality}>
              {FORMALITY_LABEL[formality]}
            </option>
          ))}
        </Select>
      </Field>

      <div>
        <span className="text-label mb-2 block text-[var(--text-muted)]">Seasons</span>
        <div className="flex flex-wrap gap-2">
          {SEASONS.map((season) => (
            <Chip
              key={season}
              selected={draft.seasons.includes(season)}
              onClick={() => onChange({ seasons: toggle(draft.seasons, season) })}
            >
              {SEASON_LABEL[season]}
            </Chip>
          ))}
        </div>
      </div>

      <div>
        <span className="text-label mb-2 block text-[var(--text-muted)]">Style</span>
        <div className="flex flex-wrap gap-2">
          {STYLES.map((style) => (
            <Chip
              key={style}
              selected={draft.styles.includes(style)}
              onClick={() => onChange({ styles: toggle(draft.styles, style) })}
            >
              {STYLE_LABEL[style]}
            </Chip>
          ))}
        </div>
      </div>

        </div>
      </details>

      <details className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
        <summary className="pressable flex cursor-pointer list-none items-center justify-between gap-3">
          <span>
            <span className="block text-[0.9375rem] font-medium">Care instructions</span>
            <span className="mt-0.5 block text-[0.8125rem] text-[var(--text-muted)]">
              {careSummary(draft.care ?? undefined) ?? 'How to wash it without ruining it'}
            </span>
          </span>
          <ChevronDown size={17} className="shrink-0 text-[var(--text-faint)]" />
        </summary>

        <div className="mt-4 border-t border-[var(--border)] pt-4">
          {!draft.care && suggestion ? (
            <button
              type="button"
              onClick={() => onChange({ care: suggestion })}
              className="pressable mb-4 w-full rounded-2xl border border-dashed border-[var(--border-strong)] px-4 py-3 text-left"
            >
              <span className="block text-[0.875rem] font-medium">
                Use standard {draft.material.trim().toLowerCase() || 'care'} care
              </span>
              <span className="mt-0.5 block text-[0.8125rem] text-[var(--text-muted)]">
                {careSummary(suggestion)}
              </span>
            </button>
          ) : null}

          <CareForm
            care={draft.care ?? EMPTY_CARE}
            onChange={(care) => onChange({ care })}
            suggested={draft.care?.source === 'material-default'}
          />

          {draft.care ? (
            <button
              type="button"
              onClick={() => onChange({ care: null })}
              className="pressable mt-4 text-[0.8125rem] text-[var(--text-muted)] underline underline-offset-2"
            >
              Clear care instructions
            </button>
          ) : null}
        </div>
      </details>

      <details className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
        <summary className="pressable flex cursor-pointer list-none items-center justify-between gap-3">
          <span>
            <span className="block text-[0.9375rem] font-medium">Price and notes</span>
            <span className="mt-0.5 block text-[0.8125rem] text-[var(--text-muted)]">
              {draft.purchasePrice || draft.notes ? 'Set' : 'For cost per wear, and anything to remember'}
            </span>
          </span>
          <ChevronDown size={17} className="shrink-0 text-[var(--text-faint)]" />
        </summary>

        <div className="mt-4 space-y-5 border-t border-[var(--border)] pt-4">
          <Field label="What it cost" hint="Powers cost-per-wear in your stats.">
            <Input
              value={draft.purchasePrice}
              onChange={(event) =>
                onChange({ purchasePrice: event.target.value.replace(/[^0-9.]/g, '') })
              }
              inputMode="decimal"
              placeholder="0"
            />
          </Field>

          <Field label="Notes">
            <Textarea
              rows={3}
              value={draft.notes}
              onChange={(event) => onChange({ notes: event.target.value })}
              placeholder="Runs small, only fits over a tee…"
            />
          </Field>
        </div>
      </details>
    </div>
  );
}

/**
 * One optional choice out of three or four.
 *
 * Tapping the selected chip clears it, because "I do not know" and "regular"
 * are different answers and the scorer treats them differently: unset means the
 * proportion question is reported as unjudged rather than scored on a guess.
 */
function Picker<T extends string>({
  label,
  hint,
  options,
  value,
  onPick,
}: {
  label: string;
  hint?: string;
  options: { value: T; label: string }[];
  value: T | '';
  onPick: (value: T | '') => void;
}) {
  return (
    <div>
      <span className="text-label mb-2 block text-[var(--text-muted)]">
        {label} <span className="normal-case opacity-70">(optional)</span>
      </span>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <Chip
            key={option.value}
            selected={value === option.value}
            onClick={() => onPick(value === option.value ? '' : option.value)}
          >
            {option.label}
          </Chip>
        ))}
      </div>
      {hint ? (
        <p className="mt-1.5 text-[0.8125rem] text-[var(--text-faint)]">{hint}</p>
      ) : null}
    </div>
  );
}

export function draftLabel(draft: ItemDraft): string {
  return draft.name.trim() || `${titleCase(draft.primaryColor)} ${categoryLabel(draft.category).toLowerCase()}`;
}
