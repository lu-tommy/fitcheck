'use client';

import { hexForColorName } from '@/domain/color';
import {
  CATEGORIES,
  FORMALITY_LABEL,
  FORMALITY_ORDER,
  PATTERNS,
  PATTERN_LABEL,
  SEASONS,
  SEASON_LABEL,
  STYLES,
  STYLE_LABEL,
  categoryLabel,
} from '@/domain/taxonomy';
import { COLOR_NAMES, swatches } from '@/lib/palette';
import { titleCase } from '@/lib/format';
import type { Category, Formality, Pattern, Season, Style } from '@/types';

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
  material: string;
  brand: string;
  formality: Formality;
  seasons: Season[];
  styles: Style[];
  purchasePrice: string;
  notes: string;
}

export const EMPTY_DRAFT: ItemDraft = {
  name: '',
  category: 'tshirt',
  primaryColor: 'black',
  primaryColorHex: swatches.black,
  secondaryColors: [],
  pattern: 'solid',
  material: '',
  brand: '',
  formality: 'casual',
  seasons: ['spring', 'summer', 'fall', 'winter'],
  styles: ['casual'],
  purchasePrice: '',
  notes: '',
};

export function ItemForm({
  draft,
  onChange,
}: {
  draft: ItemDraft;
  onChange: (patch: Partial<ItemDraft>) => void;
}) {
  const toggle = <T,>(list: T[], value: T): T[] =>
    list.includes(value) ? list.filter((entry) => entry !== value) : [...list, value];

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
          onChange={(event) => onChange({ category: event.target.value as Category })}
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
          onChange={(event) => onChange({ pattern: event.target.value as Pattern })}
        >
          {PATTERNS.map((pattern) => (
            <option key={pattern} value={pattern}>
              {PATTERN_LABEL[pattern]}
            </option>
          ))}
        </Select>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Material">
          <Input
            value={draft.material}
            onChange={(event) => onChange({ material: event.target.value })}
            placeholder="Cotton"
          />
        </Field>
        <Field label="Brand">
          <Input
            value={draft.brand}
            onChange={(event) => onChange({ brand: event.target.value })}
            placeholder="Optional"
          />
        </Field>
      </div>

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

      <Field label="What it cost" hint="Optional — powers cost-per-wear in your stats.">
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
  );
}

export function draftLabel(draft: ItemDraft): string {
  return draft.name.trim() || `${titleCase(draft.primaryColor)} ${categoryLabel(draft.category).toLowerCase()}`;
}
