'use client';

import { CalendarPlus, Check, Copy, Heart, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { use, useState } from 'react';

import { OutfitStack } from '@/components/outfit/OutfitStack';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/Feedback';
import { Field, Input, Textarea } from '@/components/ui/Field';
import { Sheet } from '@/components/ui/Sheet';
import { formatFriendlyDate, formatRelative, todayKey } from '@/lib/date';
import { cn } from '@/lib/cn';
import { pluralize } from '@/lib/format';
import { useResolvedItems } from '@/store/closet';
import { useOutfits } from '@/store/outfits';
import { usePlanner } from '@/store/planner';
import { toast } from '@/store/toast';

export default function OutfitDetailPage({ params }: PageProps<'/outfits/[id]'>) {
  const { id } = use(params);
  const router = useRouter();
  const { outfits, hydrated, updateOutfit, deleteOutfit, toggleFavorite, duplicate, wearOutfit } =
    useOutfits();
  const assign = usePlanner((state) => state.assign);

  const outfit = outfits.find((entry) => entry.id === id);
  const items = useResolvedItems(outfit?.itemIds);

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [occasion, setOccasion] = useState('');
  const [notes, setNotes] = useState('');
  const [planning, setPlanning] = useState(false);
  const [planDate, setPlanDate] = useState(todayKey());
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!hydrated) return <div className="skeleton m-5 h-96 rounded-[var(--radius-card)]" />;

  if (!outfit) {
    return (
      <>
        <PageHeader title="Not found" back large={false} />
        <EmptyState
          title="That outfit is gone"
          action={<Button onClick={() => router.push('/outfits')}>Back to outfits</Button>}
        />
      </>
    );
  }

  const missing = outfit.itemIds.length - items.length;

  return (
    <div className="pb-6">
      <PageHeader
        title={outfit.name}
        back
        large={false}
        subtitle={outfit.occasion}
        action={
          <button
            type="button"
            onClick={() => void toggleFavorite(outfit.id)}
            aria-label={outfit.favorite ? 'Remove from favourites' : 'Add to favourites'}
            className={cn(
              'pressable grid size-9 place-items-center rounded-full',
              outfit.favorite
                ? 'bg-[var(--brand-soft)] text-[var(--brand)]'
                : 'bg-[var(--surface-alt)] text-[var(--text-muted)]',
            )}
          >
            <Heart size={17} fill={outfit.favorite ? 'currentColor' : 'none'} />
          </button>
        }
      />

      <div className="space-y-5 px-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={outfit.source === 'ai' ? 'brand' : 'neutral'}>
            {outfit.source === 'ai' ? 'Generated' : 'Built by you'}
          </Badge>
          <Badge>
            {outfit.timesWorn === 0
              ? 'Never worn'
              : outfit.lastWornAt
                ? `Worn ${pluralize(outfit.timesWorn, 'time')} · last ${formatRelative(outfit.lastWornAt).toLowerCase()}`
                : `Worn ${pluralize(outfit.timesWorn, 'time')}`}
          </Badge>
        </div>

        <OutfitStack items={items} onSelect={(item) => router.push(`/closet/${item.id}`)} />

        {missing > 0 ? (
          <p className="rounded-2xl bg-[var(--warning-soft)] p-3 text-[0.8125rem] text-[var(--warning)]">
            {pluralize(missing, 'piece')} in this outfit {missing === 1 ? 'is' : 'are'} no longer in
            your closet.
          </p>
        ) : null}

        {outfit.explanation ? (
          <section className="card p-4">
            <h2 className="text-heading">Why this works</h2>
            <p className="mt-2 text-[0.9375rem] leading-relaxed text-[var(--text-muted)]">
              {outfit.explanation}
            </p>
            {outfit.colorNotes ? (
              <p className="mt-2 text-[0.875rem] leading-relaxed text-[var(--text-muted)]">
                {outfit.colorNotes}
              </p>
            ) : null}
            {outfit.weatherContext ? (
              <p className="mt-3 text-[0.8125rem] text-[var(--text-faint)]">
                Built for {outfit.weatherContext}.
              </p>
            ) : null}
          </section>
        ) : null}

        {outfit.notes ? (
          <section className="card p-4">
            <h2 className="text-label mb-1.5 text-[var(--text-muted)]">Notes</h2>
            <p className="text-[0.9375rem] leading-relaxed">{outfit.notes}</p>
          </section>
        ) : null}

        <Button
          full
          size="lg"
          icon={<Check size={17} />}
          onClick={() => {
            void wearOutfit(outfit.id);
            toast('Logged as worn today — its pieces are now in the wash', { tone: 'success' });
          }}
        >
          Wear this today
        </Button>

        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="secondary"
            icon={<CalendarPlus size={16} />}
            onClick={() => setPlanning(true)}
          >
            Plan a day
          </Button>
          <Button
            variant="secondary"
            icon={<Copy size={16} />}
            onClick={async () => {
              const copy = await duplicate(outfit.id);
              if (copy) {
                toast('Duplicated');
                router.push(`/outfits/${copy.id}`);
              }
            }}
          >
            Duplicate
          </Button>
        </div>

        <Button
          variant="secondary"
          full
          onClick={() => {
            setName(outfit.name);
            setOccasion(outfit.occasion ?? '');
            setNotes(outfit.notes ?? '');
            setEditing(true);
          }}
        >
          Rename or add notes
        </Button>

        <Button
          variant="danger"
          full
          icon={<Trash2 size={16} />}
          onClick={() => setConfirmDelete(true)}
        >
          Delete outfit
        </Button>
      </div>

      <Sheet
        open={editing}
        onClose={() => setEditing(false)}
        title="Edit outfit"
        footer={
          <Button
            full
            onClick={async () => {
              await updateOutfit(outfit.id, {
                name: name.trim() || outfit.name,
                occasion: occasion.trim() || undefined,
                notes: notes.trim() || undefined,
              });
              setEditing(false);
              toast('Saved', { tone: 'success' });
            }}
          >
            Save
          </Button>
        }
      >
        <div className="space-y-4 pt-1">
          <Field label="Name">
            <Input value={name} onChange={(event) => setName(event.target.value)} />
          </Field>
          <Field label="Occasion">
            <Input
              value={occasion}
              onChange={(event) => setOccasion(event.target.value)}
              placeholder="Office, wedding, airport…"
            />
          </Field>
          <Field label="Notes">
            <Textarea
              rows={4}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Wore this to the Ellis wedding — the jacket was too warm."
            />
          </Field>
        </div>
      </Sheet>

      <Sheet
        open={planning}
        onClose={() => setPlanning(false)}
        title="Plan this outfit"
        footer={
          <Button
            full
            onClick={async () => {
              await assign(planDate, outfit.id, outfit.occasion);
              setPlanning(false);
              toast(`Planned for ${formatFriendlyDate(planDate)}`, { tone: 'success' });
            }}
          >
            Add to calendar
          </Button>
        }
      >
        <Field label="Date" className="pt-1">
          <Input
            type="date"
            value={planDate}
            min={todayKey()}
            onChange={(event) => setPlanDate(event.target.value)}
          />
        </Field>
        <p className="mt-3 text-[0.8125rem] text-[var(--text-muted)]">
          One outfit per day — planning over an existing day replaces it.
        </p>
      </Sheet>

      <Sheet
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete this outfit?"
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" full onClick={() => setConfirmDelete(false)}>
              Keep it
            </Button>
            <Button
              variant="danger"
              full
              onClick={async () => {
                await deleteOutfit(outfit.id);
                toast('Deleted');
                router.replace('/outfits');
              }}
            >
              Delete
            </Button>
          </div>
        }
      >
        <p className="py-2 text-[0.9375rem] leading-relaxed text-[var(--text-muted)]">
          The outfit is removed. The clothes in it stay in your closet, and your wear history keeps
          its record.
        </p>
      </Sheet>
    </div>
  );
}
