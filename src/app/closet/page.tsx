'use client';

import { Archive, ChevronRight, Plus, Search, SlidersHorizontal, Shirt } from 'lucide-react';
import { useMemo, useState } from 'react';

import { ItemTile } from '@/components/closet/ItemTile';
import { PageHeader } from '@/components/PageHeader';
import Link from 'next/link';

import { ButtonLink, Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/Feedback';
import { Sheet } from '@/components/ui/Sheet';
import {
  EMPTY_FILTERS,
  applyFilters,
  availableBrands,
  availableColors,
  countActiveFilters,
  type ClosetFilters,
  type ClosetSort,
} from '@/domain/filters';
import {
  ACCESSORY_POSITION_LABEL,
  ACCESSORY_POSITION_ORDER,
  SEASONS,
  SEASON_LABEL,
  SLOT_BROWSE_ORDER,
  SLOT_LABEL_PLURAL,
  STYLES,
  STYLE_LABEL,
  accessoryPosition,
  slotOf,
} from '@/domain/taxonomy';
import { cn } from '@/lib/cn';
import { useDebounced } from '@/lib/hooks';
import { titleCase, pluralize } from '@/lib/format';
import { swatches } from '@/lib/palette';
import { useCloset, useActiveItems } from '@/store/closet';
import type { Season, Slot, Style } from '@/types';

const SORTS: { value: ClosetSort; label: string }[] = [
  { value: 'recent', label: 'Recently added' },
  { value: 'most-worn', label: 'Most worn' },
  { value: 'least-worn', label: 'Least worn' },
  { value: 'name', label: 'Name' },
];

export default function ClosetPage() {
  const { hydrated } = useCloset();
  const items = useActiveItems();
  const [filters, setFilters] = useState<ClosetFilters>(EMPTY_FILTERS);
  const [query, setQuery] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);
  const debouncedQuery = useDebounced(query, 180);

  const archivedCount = useCloset((state) => state.items).filter((item) => item.archived).length;
  const colors = useMemo(() => availableColors(items), [items]);
  const brands = useMemo(() => availableBrands(items), [items]);

  const visible = useMemo(
    () => applyFilters(items, { ...filters, query: debouncedQuery }),
    [items, filters, debouncedQuery],
  );

  const activeCount = countActiveFilters(filters);
  /*
   * A flat grid of eighty squares is a pile, not a wardrobe. Grouping by slot
   * gives it shape — but only while nothing is narrowing the view, because a
   * filtered result is already a specific question and headings just get in
   * the way of the answer.
   */
  const grouped =
    !debouncedQuery && filters.slots.length === 0 && filters.sort === 'recent' && visible.length > 8;

  /*
   * One shelf per kind — and accessories get a shelf each by where they are
   * worn, because a single row holding glasses, three rings, two watches and a
   * belt is a drawer, not a shelf.
   */
  const shelves = useMemo(() => {
    const out: { key: string; label: string; slot: Slot; items: typeof visible }[] = [];
    SLOT_BROWSE_ORDER.forEach((slot) => {
      const inSlot = visible.filter((item) => slotOf(item.category) === slot);
      if (!inSlot.length) return;

      if (slot !== 'accessory') {
        out.push({ key: slot, label: SLOT_LABEL_PLURAL[slot], slot, items: inSlot });
        return;
      }

      ACCESSORY_POSITION_ORDER.forEach((position) => {
        const atPosition = inSlot.filter((item) => accessoryPosition(item.category) === position);
        if (!atPosition.length) return;
        out.push({
          key: `accessory-${position}`,
          label: ACCESSORY_POSITION_LABEL[position],
          slot,
          items: atPosition,
        });
      });
    });
    return out;
  }, [visible]);
  const update = (patch: Partial<ClosetFilters>) =>
    setFilters((current) => ({ ...current, ...patch }));
  const toggle = <T,>(list: T[], value: T): T[] =>
    list.includes(value) ? list.filter((entry) => entry !== value) : [...list, value];

  return (
    <div className="pb-4">
      <PageHeader
        title="Closet"
        subtitle={
          hydrated
            ? `${pluralize(items.length, 'piece')} · ${items.filter((item) => item.laundry === 'clean').length} clean`
            : undefined
        }
        action={
          <ButtonLink href="/add" size="sm" icon={<Plus size={16} />}>
            Add
          </ButtonLink>
        }
      />

      <div className="px-5">
        <div className="flex gap-2">
          <div className="relative min-w-0 flex-1">
            <Search
              size={17}
              className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-[var(--text-faint)]"
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              type="search"
              placeholder="Search your closet"
              className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] py-2.5 pr-3 pl-10 text-[0.9375rem] placeholder:text-[var(--text-faint)] focus:border-[var(--brand)] focus:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            aria-label="Filters"
            className={cn(
              'pressable relative grid size-11 shrink-0 place-items-center rounded-2xl border',
              activeCount
                ? 'border-transparent bg-[var(--brand)] text-[var(--on-brand)]'
                : 'border-[var(--border)] bg-[var(--surface)]',
            )}
          >
            <SlidersHorizontal size={18} />
            {activeCount ? (
              <span className="absolute -top-1 -right-1 grid size-5 place-items-center rounded-full bg-[var(--text)] text-[0.625rem] font-bold text-[var(--bg)]">
                {activeCount}
              </span>
            ) : null}
          </button>
        </div>

        <div className="scroll-row -mx-5 mt-3 flex gap-2 px-5">
          <Chip selected={filters.favoritesOnly} onClick={() => update({ favoritesOnly: !filters.favoritesOnly })}>
            Favourites
          </Chip>
          <Chip selected={filters.cleanOnly} onClick={() => update({ cleanOnly: !filters.cleanOnly })}>
            Clean only
          </Chip>
          {SLOT_BROWSE_ORDER.map((slot) => (
            <Chip
              key={slot}
              selected={filters.slots.includes(slot)}
              onClick={() => update({ slots: toggle(filters.slots, slot) })}
            >
              {SLOT_LABEL_PLURAL[slot]}
            </Chip>
          ))}
        </div>
      </div>

      <div className="mt-4 px-5">
        {!hydrated ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {Array.from({ length: 6 }, (_, index) => (
              <div key={index} className="skeleton aspect-4/5 rounded-[var(--radius-tile)]" />
            ))}
          </div>
        ) : !items.length ? (
          <EmptyState
            icon={<Shirt size={26} />}
            title="Nothing here yet"
            body="Add the clothes you own and everything else in the app starts working."
            action={<ButtonLink href="/add">Add clothing</ButtonLink>}
          />
        ) : !visible.length ? (
          <EmptyState
            icon={<Search size={24} />}
            title="No matches"
            body="Nothing in your closet fits those filters."
            action={
              <Button
                variant="secondary"
                onClick={() => {
                  setFilters(EMPTY_FILTERS);
                  setQuery('');
                }}
              >
                Clear filters
              </Button>
            }
          />
        ) : (
          <>
            <p className="mb-3 text-[0.8125rem] text-[var(--text-muted)]">
              {pluralize(visible.length, 'piece')}
              {grouped ? ' · tap a heading to see all of one kind' : ''}
            </p>

            {grouped ? (
              /*
               * Shelves, not one long grid. Eighteen pieces in a two-column
               * grid is already a 6,000px scroll; a hundred and fifty is
               * unusable. A row per kind gives the whole wardrobe at a glance,
               * and the heading opens that shelf in full.
               */
              <div className="space-y-6">
                {shelves.map(({ key, label, items: inSlot, slot }) => {
                  if (!inSlot.length) return null;
                  return (
                    <section key={key}>
                      <button
                        type="button"
                        onClick={() => update({ slots: [slot] })}
                        className="pressable mb-2.5 flex w-full items-baseline justify-between gap-3"
                      >
                        <span className="text-label text-[var(--text-muted)]">{label}</span>
                        <span className="flex items-center gap-1 text-[0.75rem] text-[var(--text-faint)]">
                          {inSlot.length}
                          <ChevronRight size={13} />
                        </span>
                      </button>
                      <div className="scroll-row -mx-5 flex gap-3 px-5 pb-1">
                        {inSlot.map((item) => (
                          <ItemTile
                            key={item.id}
                            item={item}
                            href={`/closet/${item.id}`}
                            className="w-28 shrink-0"
                          />
                        ))}
                      </div>
                    </section>
                  );
                })}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                {visible.map((item) => (
                  <ItemTile key={item.id} item={item} href={`/closet/${item.id}`} />
                ))}
              </div>
            )}
          </>
        )}

        {archivedCount ? (
          <Link
            href="/closet/archive"
            className="pressable mt-6 flex items-center justify-center gap-2 rounded-2xl border border-dashed border-[var(--border-strong)] py-3 text-[0.875rem] text-[var(--text-muted)]"
          >
            <Archive size={15} />
            {pluralize(archivedCount, 'archived piece')}
          </Link>
        ) : null}
      </div>

      <Sheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="Filters"
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" full onClick={() => setFilters(EMPTY_FILTERS)}>
              Clear all
            </Button>
            <Button full onClick={() => setSheetOpen(false)}>
              Show {visible.length}
            </Button>
          </div>
        }
      >
        <div className="space-y-6 pt-1">
          <Group title="Sort by">
            {SORTS.map((sort) => (
              <Chip
                key={sort.value}
                selected={filters.sort === sort.value}
                onClick={() => update({ sort: sort.value })}
              >
                {sort.label}
              </Chip>
            ))}
          </Group>

          <Group title="Type">
            {SLOT_BROWSE_ORDER.map((slot) => (
              <Chip
                key={slot}
                selected={filters.slots.includes(slot)}
                onClick={() => update({ slots: toggle<Slot>(filters.slots, slot) })}
              >
                {SLOT_LABEL_PLURAL[slot]}
              </Chip>
            ))}
          </Group>

          {colors.length ? (
            <Group title="Colour">
              {colors.map((color) => (
                <Chip
                  key={color}
                  swatch={swatches[color] ?? undefined}
                  selected={filters.colors.includes(color)}
                  onClick={() => update({ colors: toggle(filters.colors, color) })}
                >
                  {titleCase(color)}
                </Chip>
              ))}
            </Group>
          ) : null}

          <Group title="Season">
            {SEASONS.map((season) => (
              <Chip
                key={season}
                selected={filters.seasons.includes(season)}
                onClick={() => update({ seasons: toggle<Season>(filters.seasons, season) })}
              >
                {SEASON_LABEL[season]}
              </Chip>
            ))}
          </Group>

          <Group title="Style">
            {STYLES.map((style) => (
              <Chip
                key={style}
                selected={filters.styles.includes(style)}
                onClick={() => update({ styles: toggle<Style>(filters.styles, style) })}
              >
                {STYLE_LABEL[style]}
              </Chip>
            ))}
          </Group>

          {brands.length ? (
            <Group title="Brand">
              {brands.map((brand) => (
                <Chip
                  key={brand}
                  selected={filters.brands.includes(brand)}
                  onClick={() => update({ brands: toggle(filters.brands, brand) })}
                >
                  {brand}
                </Chip>
              ))}
            </Group>
          ) : null}

          <Group title="Status">
            <Chip
              selected={filters.favoritesOnly}
              onClick={() => update({ favoritesOnly: !filters.favoritesOnly })}
            >
              Favourites
            </Chip>
            <Chip
              selected={filters.cleanOnly}
              onClick={() => update({ cleanOnly: !filters.cleanOnly })}
            >
              Clean only
            </Chip>
          </Group>
        </div>
      </Sheet>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-label mb-2 text-[var(--text-muted)]">{title}</h3>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}
