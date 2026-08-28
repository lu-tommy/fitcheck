'use client';

import { Check, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { use, useState } from 'react';

import { ItemImage } from '@/components/closet/ItemImage';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/Button';
import { EmptyState, SectionHeader } from '@/components/ui/Feedback';
import { Sheet } from '@/components/ui/Sheet';
import { SLOT_LABEL, slotOf } from '@/domain/taxonomy';
import { cn } from '@/lib/cn';
import { pluralize } from '@/lib/format';
import { useResolvedItems } from '@/store/closet';
import { usePlanner } from '@/store/planner';
import { toast } from '@/store/toast';
import type { Slot } from '@/types';

export default function PackingDetailPage({ params }: PageProps<'/packing/[id]'>) {
  const { id } = use(params);
  const router = useRouter();
  const { packingLists, togglePacked, deletePackingList, hydrated } = usePlanner();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const list = packingLists.find((entry) => entry.id === id);
  const items = useResolvedItems(list?.itemIds);

  if (!hydrated) return <div className="skeleton m-5 h-96 rounded-[var(--radius-card)]" />;

  if (!list) {
    return (
      <>
        <PageHeader title="Not found" back large={false} />
        <EmptyState
          title="That packing list is gone"
          action={<Button onClick={() => router.push('/packing')}>Back to packing</Button>}
        />
      </>
    );
  }

  const grouped = new Map<Slot, typeof items>();
  items.forEach((item) => {
    const slot = slotOf(item.category);
    grouped.set(slot, [...(grouped.get(slot) ?? []), item]);
  });

  const packed = list.packedItemIds.length;
  const progress = items.length ? packed / items.length : 0;

  return (
    <div className="pb-6">
      <PageHeader
        title={list.destination}
        back
        large={false}
        subtitle={`${pluralize(list.days, 'day')}${
          list.activities.length ? ` · ${list.activities.join(', ')}` : ''
        }`}
      />

      <div className="space-y-6 px-5">
        <section className="card p-4">
          <div className="mb-2 flex items-baseline justify-between">
            <span className="text-[0.875rem] text-[var(--text-muted)]">Packed</span>
            <span className="text-[0.9375rem] font-semibold tabular-nums">
              {packed} / {items.length}
            </span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-l-[1px] bg-[var(--surface-sunken)]">
            <div
              className="h-full rounded-r-[4px] bg-[var(--brand)] transition-[width] duration-300"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
          {list.notes ? (
            <p className="mt-3 text-[0.875rem] leading-relaxed text-[var(--text-muted)]">
              {list.notes}
            </p>
          ) : null}
        </section>

        <section>
          <SectionHeader title="The bag" />
          <div className="space-y-4">
            {[...grouped.entries()].map(([slot, slotItems]) => (
              <div key={slot}>
                <h3 className="text-label mb-2 text-[var(--text-muted)]">{SLOT_LABEL[slot]}</h3>
                <ul className="space-y-2">
                  {slotItems.map((item) => {
                    const isPacked = list.packedItemIds.includes(item.id);
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => void togglePacked(list.id, item.id)}
                          className={cn(
                            'card pressable flex w-full items-center gap-3 p-2.5 text-left',
                            isPacked && 'opacity-60',
                          )}
                        >
                          <span className="size-11 shrink-0 overflow-hidden rounded-lg bg-[var(--surface-alt)]">
                            <ItemImage item={item} className="size-full" />
                          </span>
                          <span
                            className={cn(
                              'min-w-0 flex-1 truncate text-[0.9375rem]',
                              isPacked && 'line-through',
                            )}
                          >
                            {item.name}
                          </span>
                          <span
                            className={cn(
                              'grid size-6 shrink-0 place-items-center rounded-full',
                              isPacked
                                ? 'bg-[var(--success)] text-white'
                                : 'bg-[var(--surface-sunken)] text-transparent',
                            )}
                          >
                            <Check size={14} />
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {list.dayPlans.length ? (
          <section>
            <SectionHeader title="Day by day" />
            <div className="card divide-y divide-[var(--border)]">
              {list.dayPlans.map((plan) => (
                <DayPlanRow key={plan.day} day={plan.day} label={plan.label} ids={plan.itemIds} />
              ))}
            </div>
          </section>
        ) : null}

        <Button
          variant="danger"
          full
          icon={<Trash2 size={16} />}
          onClick={() => setConfirmDelete(true)}
        >
          Delete packing list
        </Button>
      </div>

      <Sheet
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete this list?"
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" full onClick={() => setConfirmDelete(false)}>
              Keep it
            </Button>
            <Button
              variant="danger"
              full
              onClick={async () => {
                await deletePackingList(list.id);
                toast('Deleted');
                router.replace('/packing');
              }}
            >
              Delete
            </Button>
          </div>
        }
      >
        <p className="py-2 text-[0.9375rem] text-[var(--text-muted)]">
          Your clothes are unaffected — only the list goes.
        </p>
      </Sheet>
    </div>
  );
}

function DayPlanRow({ day, label, ids }: { day: number; label: string; ids: string[] }) {
  const items = useResolvedItems(ids);
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className="text-label w-14 shrink-0 text-[var(--text-faint)]">Day {day}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[0.9375rem]">{label}</span>
        <span className="block truncate text-[0.8125rem] text-[var(--text-muted)]">
          {items.map((item) => item.name).join(', ') || 'Nothing assigned'}
        </span>
      </span>
    </div>
  );
}
