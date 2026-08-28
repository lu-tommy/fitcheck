'use client';

import { Luggage, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { PageHeader } from '@/components/PageHeader';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { EmptyState, Spinner } from '@/components/ui/Feedback';
import { Field, Input } from '@/components/ui/Field';
import { Sheet } from '@/components/ui/Sheet';
import { planPacking } from '@/lib/ai';
import { pluralize } from '@/lib/format';
import { formatRelative } from '@/lib/date';
import { useActiveItems } from '@/store/closet';
import { usePlanner } from '@/store/planner';
import { toast } from '@/store/toast';
import { useWeather } from '@/store/weather';

const ACTIVITIES = [
  'Sightseeing',
  'Beach',
  'Hiking',
  'Business',
  'Dinners out',
  'Wedding',
  'Gym',
  'Cold weather',
];

export default function PackingPage() {
  const router = useRouter();
  const items = useActiveItems();
  const { packingLists, savePackingList } = usePlanner();
  const weather = useWeather((state) => state.snapshot);

  const [open, setOpen] = useState(false);
  const [destination, setDestination] = useState('');
  const [days, setDays] = useState('4');
  const [startDate, setStartDate] = useState('');
  const [activities, setActivities] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  async function build() {
    if (!destination.trim() || !items.length) return;
    setBusy(true);
    const dayCount = Math.max(1, Math.min(30, Number.parseInt(days, 10) || 1));
    const result = await planPacking(
      {
        destination: destination.trim(),
        days: dayCount,
        startDate: startDate || undefined,
        activities,
        weatherSummary: weather
          ? `${Math.round(weather.low)}–${Math.round(weather.high)}°C, ${weather.condition}`
          : undefined,
      },
      items,
    );
    const list = await savePackingList({
      destination: destination.trim(),
      days: dayCount,
      startDate: startDate || undefined,
      activities,
      weatherSummary: weather?.condition,
      itemIds: result.itemIds,
      dayPlans: result.dayPlans,
      notes: [result.summary, result.notes].filter(Boolean).join(' '),
    });
    setBusy(false);
    setOpen(false);
    toast('Packing list ready', { tone: 'success' });
    router.push(`/packing/${list.id}`);
  }

  return (
    <div className="pb-4">
      <PageHeader
        title="Packing"
        subtitle="A suitcase built from your own wardrobe"
        action={
          <Button size="sm" icon={<Plus size={16} />} onClick={() => setOpen(true)}>
            New
          </Button>
        }
      />

      <div className="px-5">
        {!packingLists.length ? (
          <EmptyState
            icon={<Luggage size={26} />}
            title="No trips yet"
            body="Tell it where you are going and for how long. It packs from what you own, re-wearing bottoms and shoes so the bag stays light."
            action={
              items.length ? (
                <Button onClick={() => setOpen(true)}>Plan a trip</Button>
              ) : (
                <ButtonLink href="/add">Add clothing first</ButtonLink>
              )
            }
          />
        ) : (
          <ul className="space-y-3">
            {packingLists.map((list) => (
              <li key={list.id}>
                <ButtonLink
                  href={`/packing/${list.id}`}
                  variant="secondary"
                  className="card h-auto w-full flex-col items-start gap-1 p-4 text-left"
                >
                  <span className="text-[1rem] font-semibold">{list.destination}</span>
                  <span className="text-[0.8125rem] font-normal text-[var(--text-muted)]">
                    {pluralize(list.days, 'day')} · {pluralize(list.itemIds.length, 'piece')} ·{' '}
                    {list.packedItemIds.length} packed
                  </span>
                  <span className="text-[0.75rem] font-normal text-[var(--text-faint)]">
                    Created {formatRelative(list.createdAt).toLowerCase()}
                  </span>
                </ButtonLink>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Plan a trip"
        footer={
          <Button full onClick={build} disabled={!destination.trim() || busy}>
            {busy ? <Spinner label="Packing" /> : 'Build packing list'}
          </Button>
        }
      >
        <div className="space-y-4 pt-1">
          <Field label="Destination">
            <Input
              value={destination}
              onChange={(event) => setDestination(event.target.value)}
              placeholder="Lisbon"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Days">
              <Input
                value={days}
                onChange={(event) => setDays(event.target.value.replace(/[^0-9]/g, ''))}
                inputMode="numeric"
              />
            </Field>
            <Field label="Leaving">
              <Input
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
              />
            </Field>
          </div>
          <div>
            <span className="text-label mb-2 block text-[var(--text-muted)]">
              What will you be doing?
            </span>
            <div className="flex flex-wrap gap-2">
              {ACTIVITIES.map((activity) => (
                <Chip
                  key={activity}
                  selected={activities.includes(activity)}
                  onClick={() =>
                    setActivities((current) =>
                      current.includes(activity)
                        ? current.filter((entry) => entry !== activity)
                        : [...current, activity],
                    )
                  }
                >
                  {activity}
                </Chip>
              ))}
            </div>
          </div>
        </div>
      </Sheet>
    </div>
  );
}
