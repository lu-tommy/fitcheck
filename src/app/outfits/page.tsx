'use client';

import { Layers, Plus, Search } from 'lucide-react';
import { useMemo, useState } from 'react';

import { OutfitCard } from '@/components/outfit/OutfitCard';
import { OutfitThumb } from '@/components/outfit/OutfitStack';
import { PageHeader } from '@/components/PageHeader';
import { ButtonLink } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/Feedback';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { formatFriendlyDate } from '@/lib/date';
import { pluralize } from '@/lib/format';
import { useCloset, useResolvedItems } from '@/store/closet';
import { useOutfits } from '@/store/outfits';
import type { Outfit, WearLog } from '@/types';

type Tab = 'saved' | 'favourites' | 'history';

export default function OutfitsPage() {
  const { outfits, wearLogs, hydrated } = useOutfits();
  const [tab, setTab] = useState<Tab>('saved');
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    const base = tab === 'favourites' ? outfits.filter((outfit) => outfit.favorite) : outfits;
    if (!term) return base;
    return base.filter((outfit) =>
      [outfit.name, outfit.occasion, outfit.notes]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(term),
    );
  }, [outfits, tab, query]);

  return (
    <div className="pb-4">
      <PageHeader
        title="Outfits"
        subtitle={hydrated ? pluralize(outfits.length, 'saved outfit') : undefined}
        action={
          <ButtonLink href="/outfits/new" size="sm" icon={<Plus size={16} />}>
            Build
          </ButtonLink>
        }
      />

      <div className="space-y-4 px-5">
        <SegmentedControl<Tab>
          value={tab}
          onChange={setTab}
          options={[
            { value: 'saved', label: 'Saved' },
            { value: 'favourites', label: 'Favourites' },
            { value: 'history', label: 'History' },
          ]}
        />

        {tab !== 'history' ? (
          <div className="relative">
            <Search
              size={17}
              className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-[var(--text-faint)]"
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              type="search"
              placeholder="Search outfits"
              className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] py-2.5 pr-3 pl-10 text-[0.9375rem] placeholder:text-[var(--text-faint)] focus:border-[var(--brand)] focus:outline-none"
            />
          </div>
        ) : null}

        {!hydrated ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="skeleton h-26 rounded-[var(--radius-card)]" />
            ))}
          </div>
        ) : tab === 'history' ? (
          <HistoryList logs={wearLogs} outfits={outfits} />
        ) : !filtered.length ? (
          <EmptyState
            illustration={tab !== 'favourites'}
            icon={tab === 'favourites' ? <Layers size={26} /> : undefined}
            title={tab === 'favourites' ? 'No favourites yet' : 'No saved outfits'}
            body={
              tab === 'favourites'
                ? 'Tap the heart on an outfit to keep it here.'
                : 'Generate one, or build it yourself from pieces you like together.'
            }
            action={
              <div className="flex gap-2">
                <ButtonLink href="/generate">Generate</ButtonLink>
                <ButtonLink href="/outfits/new" variant="secondary">
                  Build
                </ButtonLink>
              </div>
            }
          />
        ) : (
          <div className="space-y-3">
            {filtered.map((outfit) => (
              <OutfitRow key={outfit.id} outfit={outfit} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function OutfitRow({ outfit }: { outfit: Outfit }) {
  const items = useResolvedItems(outfit.itemIds);
  return <OutfitCard outfit={outfit} items={items} />;
}

function HistoryList({ logs, outfits }: { logs: WearLog[]; outfits: Outfit[] }) {
  if (!logs.length) {
    return (
      <EmptyState
        icon={<Layers size={26} />}
        title="Nothing worn yet"
        body="Mark an outfit as worn and it shows up here, with what you wore and when."
      />
    );
  }

  const grouped = new Map<string, WearLog[]>();
  logs.forEach((log) => {
    grouped.set(log.date, [...(grouped.get(log.date) ?? []), log]);
  });

  return (
    <div className="space-y-5">
      {[...grouped.entries()].map(([date, entries]) => (
        <section key={date}>
          <h2 className="text-label mb-2 text-[var(--text-muted)]">{formatFriendlyDate(date)}</h2>
          <div className="space-y-2">
            {entries.map((log) => (
              <HistoryRow
                key={log.id}
                log={log}
                outfit={outfits.find((outfit) => outfit.id === log.outfitId)}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function HistoryRow({ log, outfit }: { log: WearLog; outfit?: Outfit }) {
  const items = useResolvedItems(log.itemIds);
  const body = (
    <>
      <OutfitThumb items={items} className="size-14 shrink-0 rounded-xl" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[0.9375rem] font-medium">
          {outfit?.name ?? 'Individual pieces'}
        </span>
        <span className="block truncate text-[0.8125rem] text-[var(--text-muted)]">
          {items.map((item) => item.name).join(', ') || 'Those pieces are no longer in your closet'}
        </span>
      </span>
    </>
  );

  if (outfit) {
    return (
      <a href={`/outfits/${outfit.id}`} className="card pressable flex items-center gap-3 p-3">
        {body}
      </a>
    );
  }
  return <div className="card flex items-center gap-3 p-3">{body}</div>;
}
