'use client';

import { Check, Layers, Plus, Search, Split, X } from 'lucide-react';
import { useMemo, useState } from 'react';

import { OutfitCard } from '@/components/outfit/OutfitCard';
import { OutfitThumb } from '@/components/outfit/OutfitStack';
import { PageHeader } from '@/components/PageHeader';
import { Button, ButtonLink } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/Feedback';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { renderComparisonImage, shareImage } from '@/lib/outfitImage';
import { formatFriendlyDate } from '@/lib/date';
import { cn } from '@/lib/cn';
import { toast } from '@/store/toast';
import { pluralize } from '@/lib/format';
import { useCloset, useResolvedItems } from '@/store/closet';
import { useOutfits } from '@/store/outfits';
import type { Outfit, WearLog } from '@/types';

type Tab = 'saved' | 'favourites' | 'history';

export default function OutfitsPage() {
  const { outfits, wearLogs, hydrated } = useOutfits();
  const items = useCloset((state) => state.items);
  const [tab, setTab] = useState<Tab>('saved');
  const [query, setQuery] = useState('');

  /*
   * "Which one?" as a verb.
   *
   * The comparison has always been the one thing the commercial apps
   * structurally cannot copy — their user is one person alone with an app —
   * and it was buried inside the generator, reachable only for an outfit that
   * had just been invented and never for the two hanging up that somebody is
   * actually torn between. Picking two saved outfits is the whole feature.
   */
  const [duel, setDuel] = useState<string[] | null>(null);
  const [sharing, setSharing] = useState(false);

  const toggleDuel = (id: string) => {
    setDuel((current) => {
      if (!current) return [id];
      if (current.includes(id)) return current.filter((entry) => entry !== id);
      // Two is the question. A third would be a poll, which is a different one.
      return current.length >= 2 ? [current[1], id] : [...current, id];
    });
  };

  async function sendDuel() {
    if (!duel || duel.length !== 2 || sharing) return;
    const picked = duel
      .map((id) => outfits.find((outfit) => outfit.id === id))
      .filter((outfit): outfit is Outfit => Boolean(outfit));
    if (picked.length !== 2) return;

    const resolve = (outfit: Outfit) =>
      outfit.itemIds
        .map((id) => items.find((item) => item.id === id))
        .filter((item): item is NonNullable<typeof item> => Boolean(item));

    setSharing(true);
    let blob: Blob;
    try {
      blob = await renderComparisonImage(
        { items: resolve(picked[0]), label: picked[0].name, layout: picked[0].layout },
        { items: resolve(picked[1]), label: picked[1].name, layout: picked[1].layout },
      );
    } catch (error) {
      toast((error as Error).message, { tone: 'danger' });
      setSharing(false);
      return;
    }
    setSharing(false);
    const result = await shareImage(blob, 'which-one.png', 'A or B?');
    if (result === 'downloaded') toast('Saved to your downloads');
    setDuel(null);
  }

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
          duel ? (
            <button
              type="button"
              onClick={() => setDuel(null)}
              className="pressable inline-flex items-center gap-1.5 text-[0.8125rem] text-[var(--text-muted)]"
            >
              <X size={14} />
              Cancel
            </button>
          ) : (
            <ButtonLink href="/outfits/new" size="sm" icon={<Plus size={16} />}>
              Build
            </ButtonLink>
          )
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
              <OutfitRow
                key={outfit.id}
                outfit={outfit}
                picking={Boolean(duel)}
                picked={duel?.includes(outfit.id) ?? false}
                onPick={() => toggleDuel(outfit.id)}
              />
            ))}
          </div>
        )}

        {/*
          * Offered where the outfits are, and only once there are two to
          * choose between — a duel with one contender is not a question.
          */}
        {!duel && tab !== 'history' && filtered.length >= 2 ? (
          <Button
            variant="secondary"
            full
            icon={<Split size={16} />}
            onClick={() => setDuel([])}
          >
            Ask someone which one
          </Button>
        ) : null}
      </div>

      {duel ? (
        <div
          className="fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-2xl border-t border-[var(--border)] bg-[var(--surface)]/95 px-5 pt-3 backdrop-blur-xl"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 5.25rem)' }}
        >
          <p className="mb-2.5 text-center text-[0.8125rem] text-[var(--text-muted)]">
            {duel.length === 0
              ? 'Pick the two you are torn between.'
              : duel.length === 1
                ? 'One more.'
                : 'Send it and let them decide.'}
          </p>
          <Button
            full
            size="lg"
            disabled={duel.length !== 2 || sharing}
            icon={<Split size={17} />}
            onClick={() => void sendDuel()}
          >
            {sharing ? 'Rendering…' : 'Send the question'}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function OutfitRow({
  outfit,
  picking,
  picked,
  onPick,
}: {
  outfit: Outfit;
  picking: boolean;
  picked: boolean;
  onPick: () => void;
}) {
  const items = useResolvedItems(outfit.itemIds);

  if (!picking) return <OutfitCard outfit={outfit} items={items} />;

  /*
   * While picking, the card stops being a link. Navigating away mid-choice
   * loses the first pick, and a row that sometimes opens an outfit and
   * sometimes selects it is the kind of ambiguity people tap twice to test.
   */
  return (
    <button
      type="button"
      onClick={onPick}
      aria-pressed={picked}
      className={cn(
        'pressable relative block w-full rounded-[var(--radius-card)] text-left transition-shadow',
        picked && 'ring-2 ring-[var(--brand)]',
      )}
    >
      <span className="pointer-events-none block">
        <OutfitCard outfit={outfit} items={items} />
      </span>
      {picked ? (
        <span className="absolute top-3 right-3 grid size-7 place-items-center rounded-full bg-[var(--brand)] text-[var(--on-brand)]">
          <Check size={15} />
        </span>
      ) : null}
    </button>
  );
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
