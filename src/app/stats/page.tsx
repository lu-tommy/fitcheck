'use client';

import { BarChart3 } from 'lucide-react';
import Link from 'next/link';
import { useMemo } from 'react';

import { ItemImage } from '@/components/closet/ItemImage';
import { PageHeader } from '@/components/PageHeader';
import { BarRow, StatTile } from '@/components/stats/Bars';
import { WardrobeScore } from '@/components/stats/WardrobeScore';
import { ButtonLink } from '@/components/ui/Button';
import { EmptyState, SectionHeader } from '@/components/ui/Feedback';
import { computeStats } from '@/domain/stats';
import { pluralize, titleCase } from '@/lib/format';
import { useCloset, useActiveItems } from '@/store/closet';
import { useOutfits } from '@/store/outfits';

export default function StatsPage() {
  const { hydrated } = useCloset();
  const items = useActiveItems();
  const { outfits, wearLogs } = useOutfits();

  const stats = useMemo(
    () => computeStats(items, outfits, wearLogs),
    [items, outfits, wearLogs],
  );

  if (hydrated && !items.length) {
    return (
      <>
        <PageHeader title="Statistics" />
        <EmptyState
          icon={<BarChart3 size={26} />}
          title="Nothing to measure yet"
          body="Once you have added clothes and worn a few outfits, this is where the wardrobe tells on itself."
          action={<ButtonLink href="/add">Add clothing</ButtonLink>}
        />
      </>
    );
  }

  const mostWornMax = stats.mostWorn[0]?.wearCount ?? 1;
  const colorMax = stats.colorShares[0]?.count ?? 1;
  const slotMax = stats.slotShares[0]?.count ?? 1;

  return (
    <div className="pb-6">
      <PageHeader title="Statistics" subtitle="What you actually wear" />

      <div className="space-y-7 px-5">
        <section className="card p-5 text-center">
          <p className="text-[0.8125rem] text-[var(--text-muted)]">Average wears per piece</p>
          <p className="mt-1 text-[3rem] leading-none font-semibold">
            {stats.averageWears.toFixed(1)}
          </p>
          <p className="mt-2 text-[0.8125rem] leading-relaxed text-[var(--text-muted)]">
            {stats.neverWorn.length
              ? `${pluralize(stats.neverWorn.length, 'piece')} you own ${
                  stats.neverWorn.length === 1 ? 'has' : 'have'
                } never been worn.`
              : 'Everything in your closet has been worn at least once.'}
          </p>
        </section>

        {/*
          * Above the counts on purpose. How many things you own is inventory;
          * how they score together is the only figure on this screen anybody
          * can act on.
          */}
        <WardrobeScore />

        <section className="grid grid-cols-2 gap-3">
          <StatTile label="Pieces" value={String(stats.totalItems)} />
          <StatTile label="Outfits" value={String(stats.totalOutfits)} />
          <StatTile label="Total wears" value={String(stats.totalWears)} />
          <StatTile
            label="Clean right now"
            value={String(stats.cleanCount)}
            hint={`of ${stats.totalItems}`}
          />
        </section>

        {stats.mostWorn.some((item) => item.wearCount > 0) ? (
          <section>
            <SectionHeader title="Most worn" />
            <div className="card px-4 py-2">
              {stats.mostWorn
                .filter((item) => item.wearCount > 0)
                .map((item) => (
                  <BarRow
                    key={item.id}
                    label={item.name}
                    value={item.wearCount}
                    max={mostWornMax}
                    display={pluralize(item.wearCount, 'wear')}
                  />
                ))}
            </div>
          </section>
        ) : null}

        {stats.colorShares.length ? (
          <section>
            <SectionHeader title="Your palette" />
            <div className="card px-4 py-2">
              {stats.colorShares.slice(0, 8).map((share) => (
                <BarRow
                  key={share.color}
                  label={titleCase(share.color)}
                  swatch={share.hex}
                  color={share.hex}
                  value={share.count}
                  max={colorMax}
                  display={`${Math.round(share.share * 100)}%`}
                />
              ))}
            </div>
            <p className="mt-2 px-1 text-[0.8125rem] leading-relaxed text-[var(--text-muted)]">
              Each bar is drawn in the colour it counts, so the chart reads as the wardrobe
              itself.
            </p>
          </section>
        ) : null}

        {stats.slotShares.length ? (
          <section>
            <SectionHeader title="What it is made of" />
            <div className="card px-4 py-2">
              {stats.slotShares.map((share) => (
                <BarRow
                  key={share.slot}
                  label={share.label}
                  value={share.count}
                  max={slotMax}
                  display={String(share.count)}
                />
              ))}
            </div>
          </section>
        ) : null}

        {stats.costPerWear.length ? (
          <section>
            <SectionHeader title="Cost per wear" />
            <div className="card divide-y divide-[var(--border)]">
              {stats.costPerWear.slice(0, 6).map((entry) => (
                <Link
                  key={entry.item.id}
                  href={`/closet/${entry.item.id}`}
                  className="pressable flex items-center gap-3 px-4 py-3"
                >
                  <span className="size-10 shrink-0 overflow-hidden rounded-lg bg-[var(--surface-alt)]">
                    <ItemImage item={entry.item} className="size-full" showLabel={false} />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[0.9375rem]">
                    {entry.item.name}
                  </span>
                  <span className="shrink-0 text-[0.9375rem] font-semibold tabular-nums">
                    {entry.costPerWear.toFixed(2)}
                  </span>
                </Link>
              ))}
            </div>
            <p className="mt-2 px-1 text-[0.8125rem] text-[var(--text-muted)]">
              Cheapest per wear first — the honest measure of whether a piece earned its place.
            </p>
          </section>
        ) : null}

        {stats.neverWorn.length ? (
          <section>
            <SectionHeader
              title="Never worn"
              action={
                <span className="text-[0.8125rem] text-[var(--text-muted)]">
                  {stats.neverWorn.length}
                </span>
              }
            />
            <div className="scroll-row -mx-5 flex gap-3 px-5">
              {stats.neverWorn.slice(0, 12).map((item) => (
                <Link key={item.id} href={`/closet/${item.id}`} className="pressable w-24 shrink-0">
                  <span className="block aspect-4/5 overflow-hidden rounded-[var(--radius-tile)] bg-[var(--surface-alt)]">
                    <ItemImage item={item} className="size-full" />
                  </span>
                  <span className="mt-1.5 block truncate text-[0.75rem]">{item.name}</span>
                </Link>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
