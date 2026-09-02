'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';

import { ItemImage } from '@/components/closet/ItemImage';
import { SectionHeader } from '@/components/ui/Feedback';
import { readWardrobeReport, type ItemStanding } from '@/domain/wardrobeReport';
import { cn } from '@/lib/cn';
import { pluralize } from '@/lib/format';
import { useActiveItems } from '@/store/closet';
import type { ClothingItem } from '@/types';

/**
 * How the wardrobe scores, rather than how today's outfit does.
 *
 * The Fit Score answers "is this good". This answers "why is getting dressed
 * hard on Tuesdays" — a fact about the wardrobe rather than about a morning,
 * and the only one of the two anybody can act on when they are next in a shop.
 *
 * Everything here is a real number over real outfits: the wardrobe is dressed
 * against itself, every pairing is scored the same way the home screen scores
 * today, and the count of outfits behind each figure travels with it. A verdict
 * on three samples is an anecdote and should read as one.
 */
export function WardrobeScore() {
  const router = useRouter();
  const items = useActiveItems();
  const report = useMemo(() => readWardrobeReport(items), [items]);
  const index = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);

  if (report.note) {
    return (
      <section>
        <SectionHeader title="How it all scores" />
        <p className="card p-4 text-[0.9375rem] leading-relaxed text-[var(--text-muted)]">
          {report.note}
        </p>
      </section>
    );
  }

  const best = report.best[0];
  const bestItems = best?.itemIds
    .map((id) => index.get(id))
    .filter((item): item is ClothingItem => Boolean(item));

  return (
    <section>
      <SectionHeader title="How it all scores" />

      <div className="card overflow-hidden">
        <div className="flex items-center gap-4 border-b border-[var(--border)] px-4 py-4">
          <p
            className="text-display shrink-0 tabular-nums"
            style={{ fontSize: '2.75rem', lineHeight: 1 }}
          >
            {report.average}
          </p>
          <p className="min-w-0 text-[0.875rem] leading-relaxed text-[var(--text-muted)]">
            The average Fit Score across{' '}
            {pluralize(report.samples, 'outfit')} built from what you own — every
            top against every bottom, not just the ones you have worn.
          </p>
        </div>

        {best && bestItems && bestItems.length === 2 ? (
          <div className="flex items-center gap-3 border-b border-[var(--border)] px-4 py-3.5">
            <div className="flex shrink-0 -space-x-3">
              {bestItems.map((item) => (
                <ItemImage
                  key={item.id}
                  item={item}
                  showLabel={false}
                  className="size-11 rounded-xl border-2 border-[var(--surface)]"
                />
              ))}
            </div>
            <p className="min-w-0 flex-1 text-[0.875rem] leading-snug">
              <span className="font-medium">Your best pairing</span>
              <span className="mt-0.5 block text-[var(--text-muted)]">
                {bestItems[0].name} with {bestItems[1].name.toLowerCase()}
              </span>
            </p>
            <span className="shrink-0 text-[0.9375rem] font-semibold tabular-nums text-[var(--brand)]">
              {best.score}
            </span>
          </div>
        ) : null}

        <Standings
          title="Lifts what it is put with"
          standings={report.lifting}
          index={index}
          tone="good"
          onOpen={(id) => router.push(`/closet/${id}`)}
        />
        <Standings
          title="Harder to place"
          standings={report.harder}
          index={index}
          tone="warn"
          onOpen={(id) => router.push(`/closet/${id}`)}
        />
      </div>
    </section>
  );
}

/**
 * A run of pieces with how they did.
 *
 * "Harder to place" rather than anything sharper, because that is the accurate
 * statement as well as the kind one: a garment scores low here because of what
 * is *around* it in this wardrobe, and the same coat in a different closet
 * would be fine. Where one rule fires around a piece notably more than it fires
 * elsewhere, the reason is named — and it always names the pairing, never the
 * garment.
 */
function Standings({
  title,
  standings,
  index,
  tone,
  onOpen,
}: {
  title: string;
  standings: ItemStanding[];
  index: Map<string, ClothingItem>;
  tone: 'good' | 'warn';
  onOpen: (id: string) => void;
}) {
  if (!standings.length) return null;

  return (
    <div className="border-b border-[var(--border)] last:border-b-0">
      <p className="text-label px-4 pt-3.5 pb-1 text-[var(--text-faint)]">{title}</p>
      <ul>
        {standings.map((standing) => {
          const item = index.get(standing.itemId);
          if (!item) return null;
          return (
            <li key={standing.itemId}>
              <button
                type="button"
                onClick={() => onOpen(standing.itemId)}
                className="pressable flex w-full items-center gap-3 px-4 py-2.5 text-left"
              >
                <ItemImage
                  item={item}
                  showLabel={false}
                  className="size-9 shrink-0 rounded-lg"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[0.9375rem]">{item.name}</span>
                  <span className="block truncate text-[0.8125rem] text-[var(--text-muted)]">
                    {standing.commonReason ??
                      `across ${pluralize(standing.appearances, 'outfit')}`}
                  </span>
                </span>
                <span
                  className={cn(
                    'shrink-0 text-[0.875rem] font-semibold tabular-nums',
                    tone === 'good' ? 'text-[var(--success)]' : 'text-[var(--warning)]',
                  )}
                >
                  {standing.delta > 0 ? `+${standing.delta}` : standing.delta}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
