'use client';

import { ArrowRight, Heart, ShoppingBag } from 'lucide-react';
import { useMemo, useState } from 'react';

import { ItemImage } from '@/components/closet/ItemImage';
import { PageHeader } from '@/components/PageHeader';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { EmptyState, SectionHeader } from '@/components/ui/Feedback';
import { Field, Input } from '@/components/ui/Field';
import { hexForColorName } from '@/domain/color';
import { assessPurchase, weakestSlots } from '@/domain/shopping';
import { CATEGORIES, SLOT_LABEL, categoryLabel, slotOf } from '@/domain/taxonomy';
import { cn } from '@/lib/cn';
import { COLOR_NAMES, swatches } from '@/lib/palette';
import { pluralize, titleCase } from '@/lib/format';
import { useActiveItems } from '@/store/closet';
import { toast } from '@/store/toast';
import { useWishlist } from '@/store/wishlist';
import type { Category } from '@/types';

/**
 * Before you buy it.
 *
 * The question a wardrobe app can answer and a shop cannot: not whether it is
 * nice, but whether anything you own goes with it. Everything here runs on the
 * same rules that build outfits, so the number it gives back is the number of
 * outfits it actually completed.
 */
export default function ShopPage() {
  const items = useActiveItems();
  const addToWishlist = useWishlist((state) => state.add);

  const [category, setCategory] = useState<Category>('sweater');
  const [color, setColor] = useState('navy');
  const [price, setPrice] = useState('');
  const [checked, setChecked] = useState(false);

  const verdict = useMemo(() => {
    const parsed = Number.parseFloat(price);
    return assessPurchase(
      {
        name: `${titleCase(color)} ${categoryLabel(category).toLowerCase()}`,
        category,
        primaryColor: color,
        primaryColorHex: hexForColorName(color),
        price: Number.isFinite(parsed) && parsed > 0 ? parsed : undefined,
      },
      items,
    );
  }, [category, color, price, items]);

  const gaps = useMemo(() => weakestSlots(items).slice(0, 2), [items]);

  if (!items.length) {
    return (
      <>
        <PageHeader title="Before you buy" back large={false} />
        <EmptyState
          icon={<ShoppingBag size={26} />}
          title="Add your closet first"
          body="This works by checking a new piece against what you already own, so it needs something to check against."
          action={<ButtonLink href="/add">Add clothing</ButtonLink>}
        />
      </>
    );
  }

  const tone =
    verdict.score >= 75 ? 'success' : verdict.score >= 45 ? 'warning' : 'danger';

  return (
    <div className="pb-6">
      <PageHeader
        title="Before you buy"
        back
        large={false}
        subtitle="Does it go with what you already own?"
      />

      <div className="space-y-6 px-5">
        <section className="space-y-4">
          <div>
            <span className="text-label mb-2 block text-[var(--text-muted)]">What is it?</span>
            <div className="scroll-row -mx-5 flex gap-2 px-5">
              {CATEGORIES.map((meta) => (
                <Chip
                  key={meta.category}
                  selected={category === meta.category}
                  onClick={() => {
                    setCategory(meta.category);
                    setChecked(false);
                  }}
                >
                  {meta.label}
                </Chip>
              ))}
            </div>
          </div>

          <div>
            <span className="text-label mb-2 block text-[var(--text-muted)]">What colour?</span>
            <div className="flex flex-wrap gap-2">
              {COLOR_NAMES.map((name) => (
                <Chip
                  key={name}
                  swatch={swatches[name]}
                  selected={color === name}
                  onClick={() => {
                    setColor(name);
                    setChecked(false);
                  }}
                >
                  {titleCase(name)}
                </Chip>
              ))}
            </div>
          </div>

          <Field label="Price" hint="Optional — turns the answer into cost per wear.">
            <Input
              value={price}
              inputMode="decimal"
              placeholder="0"
              onChange={(event) => setPrice(event.target.value.replace(/[^0-9.]/g, ''))}
            />
          </Field>

          <Button full size="lg" onClick={() => setChecked(true)}>
            Check it against my closet
          </Button>
        </section>

        {checked ? (
          <>
            <section className="card overflow-hidden">
              <div
                className={cn(
                  'flex items-baseline justify-between gap-3 px-4 py-3',
                  tone === 'success' && 'bg-[var(--success-soft)] text-[var(--success)]',
                  tone === 'warning' && 'bg-[var(--warning-soft)] text-[var(--warning)]',
                  tone === 'danger' && 'bg-[var(--danger-soft)] text-[var(--danger)]',
                )}
              >
                <p className="text-[0.9375rem] font-semibold">{verdict.headline}</p>
                <p className="shrink-0 text-[0.8125rem] font-semibold tabular-nums">
                  {verdict.score}/100
                </p>
              </div>

              <div className="space-y-3 p-4">
                <p className="text-[0.9375rem] leading-relaxed text-[var(--text-muted)]">
                  {verdict.detail}
                </p>

                {verdict.costPerWearEstimate ? (
                  <p className="text-[0.8125rem] text-[var(--text-faint)]">
                    Worn once a week, that is about{' '}
                    {verdict.costPerWearEstimate.toFixed(2)} a wear in the first year.
                  </p>
                ) : null}

                <Button
                  variant="secondary"
                  full
                  icon={<Heart size={16} />}
                  onClick={async () => {
                    await addToWishlist({
                      name: `${titleCase(color)} ${categoryLabel(category).toLowerCase()}`,
                      category,
                      colorName: color,
                      price: Number.parseFloat(price) || undefined,
                      reason: verdict.detail,
                      source: 'manual',
                    });
                    toast('Added to your wishlist', { tone: 'success' });
                  }}
                >
                  Save it to the wishlist
                </Button>
              </div>
            </section>

            {verdict.duplicates.length ? (
              <section>
                <SectionHeader title="You already have" />
                <div className="space-y-2">
                  {verdict.duplicates.map((item) => (
                    <a
                      key={item.id}
                      href={`/closet/${item.id}`}
                      className="card pressable flex items-center gap-3 p-3"
                    >
                      <span className="size-12 shrink-0 overflow-hidden rounded-lg bg-[var(--surface-alt)]">
                        <ItemImage item={item} className="size-full" showLabel={false} />
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[0.9375rem]">{item.name}</span>
                    </a>
                  ))}
                </div>
              </section>
            ) : null}

            {verdict.pairings.length ? (
              <section>
                <SectionHeader title="What it would go with" />
                <div className="space-y-2">
                  {verdict.pairings.map((pairing) => (
                    <div key={pairing.item.id} className="card flex items-center gap-3 p-3">
                      <span
                        aria-hidden
                        className="size-10 shrink-0 rounded-lg border border-[var(--border-strong)]"
                        style={{ background: hexForColorName(color) }}
                      />
                      <ArrowRight size={14} className="shrink-0 text-[var(--text-faint)]" />
                      <span className="size-10 shrink-0 overflow-hidden rounded-lg bg-[var(--surface-alt)]">
                        <ItemImage item={pairing.item} className="size-full" showLabel={false} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[0.875rem] font-medium">
                          {pairing.item.name}
                        </span>
                        <span className="block text-[0.75rem] leading-snug text-[var(--text-muted)]">
                          {pairing.why}
                        </span>
                      </span>
                      <span className="shrink-0 text-[0.8125rem] font-semibold tabular-nums text-[var(--text-muted)]">
                        {pairing.score}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
          </>
        ) : (
          <section className="card p-4">
            <h2 className="text-heading">Where your wardrobe is thin</h2>
            <p className="mt-1.5 text-[0.875rem] leading-relaxed text-[var(--text-muted)]">
              Counted from what you own, not from what is in fashion.
            </p>
            <ul className="mt-3 space-y-2">
              {gaps.map((gap) => (
                <li key={gap.slot} className="flex items-baseline justify-between gap-3">
                  <span className="text-[0.9375rem]">{SLOT_LABEL[gap.slot]}</span>
                  <span className="text-[0.8125rem] text-[var(--text-muted)]">
                    {gap.count === 0 ? 'none at all' : pluralize(gap.count, 'piece')}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[0.8125rem] leading-relaxed text-[var(--text-faint)]">
              A piece in one of those slots will almost always beat another{' '}
              {SLOT_LABEL[slotOf(category)].toLowerCase()}.
            </p>
          </section>
        )}
      </div>
    </div>
  );
}
