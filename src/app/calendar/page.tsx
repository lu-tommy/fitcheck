'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useMemo, useState } from 'react';

import { OutfitThumb } from '@/components/outfit/OutfitStack';
import { PageHeader } from '@/components/PageHeader';
import { Button, ButtonLink } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/Feedback';
import { Sheet } from '@/components/ui/Sheet';
import {
  addDays,
  format,
  formatFriendlyDate,
  monthGrid,
  startOfMonth,
  toDateKey,
  todayKey,
} from '@/lib/date';
import { cn } from '@/lib/cn';
import { useResolvedItems } from '@/store/closet';
import { useOutfits } from '@/store/outfits';
import { usePlanner } from '@/store/planner';
import { toast } from '@/store/toast';
import type { Outfit } from '@/types';

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export default function CalendarPage() {
  const { outfits } = useOutfits();
  const { calendar, assign, unassign } = usePlanner();
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [picking, setPicking] = useState<string | null>(null);

  const days = useMemo(() => monthGrid(month), [month]);
  const byDate = useMemo(() => {
    const map = new Map<string, Outfit>();
    calendar.forEach((entry) => {
      const outfit = outfits.find((candidate) => candidate.id === entry.outfitId);
      if (outfit) map.set(entry.date, outfit);
    });
    return map;
  }, [calendar, outfits]);

  const today = todayKey();
  const upcoming = useMemo(
    () =>
      Array.from({ length: 14 }, (_, index) => toDateKey(addDays(new Date(), index)))
        .map((date) => ({ date, outfit: byDate.get(date) }))
        .filter((entry) => entry.outfit),
    [byDate],
  );

  return (
    <div className="pb-4">
      <PageHeader title="Calendar" subtitle="Decide tonight what you wear tomorrow" />

      <div className="space-y-6 px-5">
        <section className="card p-4">
          <div className="mb-3 flex items-center justify-between">
            <button
              type="button"
              aria-label="Previous month"
              onClick={() => setMonth(startOfMonth(addDays(month, -1)))}
              className="pressable grid size-9 place-items-center rounded-full bg-[var(--surface-alt)]"
            >
              <ChevronLeft size={17} />
            </button>
            <h2 className="text-heading">{format(month, 'MMMM yyyy')}</h2>
            <button
              type="button"
              aria-label="Next month"
              onClick={() => setMonth(startOfMonth(addDays(month, 33)))}
              className="pressable grid size-9 place-items-center rounded-full bg-[var(--surface-alt)]"
            >
              <ChevronRight size={17} />
            </button>
          </div>

          <div className="mb-1 grid grid-cols-7 gap-1">
            {WEEKDAYS.map((day, index) => (
              <span
                key={`${day}-${index}`}
                className="text-center text-[0.6875rem] font-semibold text-[var(--text-faint)]"
              >
                {day}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {days.map((day) => {
              const key = toDateKey(day);
              const outfit = byDate.get(key);
              const inMonth = day.getMonth() === month.getMonth();
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setPicking(key)}
                  className={cn(
                    'pressable relative aspect-square overflow-hidden rounded-xl border text-[0.75rem]',
                    key === today
                      ? 'border-[var(--brand)]'
                      : 'border-transparent bg-[var(--surface-alt)]',
                    !inMonth && 'opacity-35',
                  )}
                >
                  {outfit ? <DayThumb outfit={outfit} /> : null}
                  <span
                    className={cn(
                      'absolute inset-x-0 top-1 text-center font-semibold',
                      outfit ? 'text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.7)]' : '',
                      key === today && !outfit ? 'text-[var(--brand)]' : '',
                    )}
                  >
                    {day.getDate()}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section>
          <h2 className="text-heading mb-3">Next two weeks</h2>
          {upcoming.length ? (
            <div className="space-y-2">
              {upcoming.map((entry) => (
                <button
                  key={entry.date}
                  type="button"
                  onClick={() => setPicking(entry.date)}
                  className="card pressable flex w-full items-center gap-3 p-3 text-left"
                >
                  <span className="w-20 shrink-0 text-[0.8125rem] font-semibold text-[var(--text-muted)]">
                    {formatFriendlyDate(entry.date)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[0.9375rem]">
                    {entry.outfit?.name}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <EmptyState
              title="Nothing planned"
              body="Tap a day to assign one of your saved outfits to it."
              action={<ButtonLink href="/outfits" variant="secondary">Browse outfits</ButtonLink>}
            />
          )}
        </section>
      </div>

      <Sheet
        open={picking !== null}
        onClose={() => setPicking(null)}
        title={picking ? formatFriendlyDate(picking) : ''}
        footer={
          picking && byDate.get(picking) ? (
            <Button
              variant="danger"
              full
              onClick={async () => {
                await unassign(picking);
                setPicking(null);
                toast('Cleared');
              }}
            >
              Clear this day
            </Button>
          ) : null
        }
      >
        {outfits.length ? (
          <div className="space-y-2 pt-1">
            {outfits.map((outfit) => (
              <PickRow
                key={outfit.id}
                outfit={outfit}
                selected={picking ? byDate.get(picking)?.id === outfit.id : false}
                onPick={async () => {
                  if (!picking) return;
                  await assign(picking, outfit.id, outfit.occasion);
                  setPicking(null);
                  toast('Added to your calendar', { tone: 'success' });
                }}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            title="No saved outfits"
            body="Save an outfit and you can plan it here."
            action={<ButtonLink href="/generate">Generate one</ButtonLink>}
          />
        )}
      </Sheet>
    </div>
  );
}

function DayThumb({ outfit }: { outfit: Outfit }) {
  const items = useResolvedItems(outfit.itemIds);
  return <OutfitThumb items={items} className="absolute inset-0 size-full" />;
}

function PickRow({
  outfit,
  selected,
  onPick,
}: {
  outfit: Outfit;
  selected: boolean;
  onPick: () => void;
}) {
  const items = useResolvedItems(outfit.itemIds);
  return (
    <button
      type="button"
      onClick={onPick}
      className={cn(
        'pressable flex w-full items-center gap-3 rounded-2xl border p-2.5 text-left',
        selected ? 'border-[var(--brand)] bg-[var(--brand-soft)]' : 'border-[var(--border)]',
      )}
    >
      <OutfitThumb items={items} className="size-12 shrink-0 rounded-lg" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[0.9375rem] font-medium">{outfit.name}</span>
        <span className="block truncate text-[0.8125rem] text-[var(--text-muted)]">
          {outfit.occasion ?? `${items.length} pieces`}
        </span>
      </span>
    </button>
  );
}
