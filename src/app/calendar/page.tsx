'use client';

import { CalendarRange, ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { OutfitThumb } from '@/components/outfit/OutfitStack';
import { PageHeader } from '@/components/PageHeader';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Feedback';
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
import { formatTemperatureRange, pluralize } from '@/lib/format';
import { planWeek } from '@/domain/weekPlanner';
import { useActiveItems, useResolvedItems } from '@/store/closet';
import { useOutfits } from '@/store/outfits';
import { usePreferences } from '@/store/preferences';
import { useWeather } from '@/store/weather';
import { usePlanner } from '@/store/planner';
import { toast } from '@/store/toast';
import type { Outfit } from '@/types';

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export default function CalendarPage() {
  const { outfits, saveOutfit } = useOutfits();
  const { calendar, assign, unassign } = usePlanner();
  const items = useActiveItems();
  const weather = useWeather((state) => state.snapshot);
  const preferences = usePreferences((state) => state.preferences);
  /*
   * Every value on this screen is derived from "now" — the month grid, today's
   * highlight, the next fourteen days. Next prerenders this route at build time,
   * so all of it was computed against the BUILD date and then corrected on
   * hydration: that mismatch is the React #418 this page logged on every visit.
   * Hold the render until mounted so the server and the first client render
   * agree, and the dates are the real ones rather than the build's.
   */
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [picking, setPicking] = useState<string | null>(null);
  const [planning, setPlanning] = useState(false);

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

  // hooks are all above this line, so the early return keeps their order stable
  if (!mounted) return null;

  return (
    <div className="pb-4">
      <PageHeader title="Calendar" subtitle="Decide tonight what you wear tomorrow" />

      <div className="space-y-6 px-5">
        <Button
          full
          icon={<CalendarRange size={17} />}
          disabled={planning || items.length < 3}
          onClick={async () => {
            setPlanning(true);
            const dates = Array.from({ length: 7 }, (_, index) =>
              toDateKey(addDays(new Date(), index)),
            );
            const week = planWeek({
              closet: items,
              weather,
              preferredStyles: preferences.preferredStyles,
              avoidColors: preferences.avoidColors,
              units: preferences.units,
              dates,
            });
            if (!week.length) {
              setPlanning(false);
              toast('Not enough clean clothes to plan a week', { tone: 'danger' });
              return;
            }
            for (const day of week) {
              const saved = await saveOutfit({
                name: day.outfit.name,
                itemIds: day.outfit.itemIds,
                explanation: day.outfit.explanation,
                colorNotes: day.outfit.colorNotes,
                weatherContext: day.forecast
                  ? `${formatTemperatureRange(day.forecast.low, day.forecast.high, preferences.units)}, ${day.forecast.condition}`
                  : undefined,
                source: 'ai',
              });
              await assign(day.date, saved.id);
            }
            setPlanning(false);
            toast(`Next ${week.length} days planned`, { tone: 'success' });
          }}
        >
          {planning ? <Spinner label="Planning your week" /> : 'Plan the next 7 days'}
        </Button>

        <p className="-mt-3 text-center text-[0.8125rem] leading-relaxed text-[var(--text-muted)]">
          Builds a week from what is clean, using each day&rsquo;s forecast and keeping pieces off
          back-to-back days. Anything already planned is replaced.
        </p>

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
                className="text-center text-[0.75rem] font-semibold text-[var(--text-faint)]"
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
