'use client';

import { Check, Plus, X } from 'lucide-react';
import { useState } from 'react';

import { Chip } from '@/components/ui/Chip';
import { Input } from '@/components/ui/Field';

/**
 * Choosing a brand.
 *
 * A free text box means "Levi's", "Levis" and "levi's" become three brands and
 * the filter stops working. Picking from what is already in the wardrobe keeps
 * them consistent, and adding a new one stays one tap away — most people own a
 * handful of labels and type each of them many times.
 */
export function BrandPicker({
  value,
  known,
  onChange,
}: {
  value: string;
  /** Brands already used in the wardrobe, most common first. */
  known: string[];
  onChange: (brand: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');

  // Anything typed before this list existed still deserves to be selectable.
  const options = known.includes(value) || !value ? known : [value, ...known];

  const commit = () => {
    const clean = draft.trim().replace(/\s+/g, ' ');
    if (!clean) {
      setAdding(false);
      return;
    }
    // Match an existing brand regardless of case, so it never doubles up.
    const existing = options.find((brand) => brand.toLowerCase() === clean.toLowerCase());
    onChange(existing ?? clean);
    setDraft('');
    setAdding(false);
  };

  return (
    <div>
      <span className="text-label mb-2 block text-[var(--text-muted)]">
        Brand <span className="normal-case opacity-70">(optional)</span>
      </span>

      <div className="flex flex-wrap gap-2">
        {options.map((brand) => (
          <Chip
            key={brand}
            selected={value === brand}
            onClick={() => onChange(value === brand ? '' : brand)}
          >
            {value === brand ? <Check size={13} /> : null}
            {brand}
          </Chip>
        ))}

        {adding ? null : (
          <Chip onClick={() => setAdding(true)} className={options.length ? 'border-dashed' : undefined}>
            <Plus size={13} />
            {options.length ? 'Another' : 'Add a brand'}
          </Chip>
        )}
      </div>

      {adding ? (
        <div className="mt-2 flex gap-2">
          <Input
            value={draft}
            autoFocus
            placeholder="Uniqlo"
            autoCapitalize="words"
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                commit();
              }
              if (event.key === 'Escape') {
                setDraft('');
                setAdding(false);
              }
            }}
            onBlur={commit}
          />
          <button
            type="button"
            aria-label="Cancel"
            onClick={() => {
              setDraft('');
              setAdding(false);
            }}
            className="pressable grid size-11 shrink-0 place-items-center rounded-2xl bg-[var(--surface-alt)] text-[var(--text-muted)]"
          >
            <X size={17} />
          </button>
        </div>
      ) : null}
    </div>
  );
}
