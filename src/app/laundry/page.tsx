'use client';

import { WashingMachine } from 'lucide-react';
import { useMemo, useState } from 'react';

import { ItemImage } from '@/components/closet/ItemImage';
import { PageHeader } from '@/components/PageHeader';
import { Button, ButtonLink } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/Feedback';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { categoryLabel } from '@/domain/taxonomy';
import { cn } from '@/lib/cn';
import { pluralize } from '@/lib/format';
import { useCloset } from '@/store/closet';
import { toast } from '@/store/toast';
import type { ClothingItem, LaundryStatus } from '@/types';

const NEXT: Record<LaundryStatus, LaundryStatus> = {
  clean: 'dirty',
  dirty: 'washing',
  washing: 'clean',
};

export default function LaundryPage() {
  const { items, setLaundry, washAll } = useCloset();
  const [tab, setTab] = useState<LaundryStatus>('dirty');

  const buckets = useMemo(
    () => ({
      clean: items.filter((item) => item.laundry === 'clean'),
      dirty: items.filter((item) => item.laundry === 'dirty'),
      washing: items.filter((item) => item.laundry === 'washing'),
    }),
    [items],
  );

  const shown = buckets[tab];
  const outOfPlay = buckets.dirty.length + buckets.washing.length;

  return (
    <div className="pb-4">
      <PageHeader
        title="Laundry"
        subtitle={
          outOfPlay
            ? `${pluralize(outOfPlay, 'piece')} out of play`
            : 'Everything is clean and available'
        }
      />

      <div className="space-y-4 px-5">
        <SegmentedControl<LaundryStatus>
          value={tab}
          onChange={setTab}
          options={[
            { value: 'dirty', label: `Dirty (${buckets.dirty.length})` },
            { value: 'washing', label: `Washing (${buckets.washing.length})` },
            { value: 'clean', label: `Clean (${buckets.clean.length})` },
          ]}
        />

        {tab === 'dirty' && buckets.dirty.length ? (
          <Button
            full
            variant="secondary"
            onClick={async () => {
              const count = buckets.dirty.length;
              await Promise.all(buckets.dirty.map((item) => setLaundry(item.id, 'washing')));
              toast(`${pluralize(count, 'piece')} in the machine`);
            }}
          >
            Put all dirty items in the wash
          </Button>
        ) : null}

        {tab === 'washing' && buckets.washing.length ? (
          <Button
            full
            onClick={async () => {
              const count = buckets.washing.length;
              await washAll();
              toast(`${pluralize(count, 'piece')} back in circulation`, { tone: 'success' });
            }}
          >
            Mark the wash as done
          </Button>
        ) : null}

        {!shown.length ? (
          <EmptyState
            icon={<WashingMachine size={24} />}
            title={
              tab === 'dirty'
                ? 'Nothing dirty'
                : tab === 'washing'
                  ? 'Nothing in the machine'
                  : 'Nothing clean'
            }
            body={
              tab === 'clean'
                ? 'Every piece you own is dirty or in the wash.'
                : 'Wearing an outfit moves its pieces here automatically.'
            }
            action={tab === 'clean' ? undefined : <ButtonLink href="/closet" variant="secondary">Open closet</ButtonLink>}
          />
        ) : (
          <ul className="space-y-2">
            {shown.map((item) => (
              <LaundryRow
                key={item.id}
                item={item}
                onCycle={() => {
                  void setLaundry(item.id, NEXT[item.laundry]);
                }}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function LaundryRow({ item, onCycle }: { item: ClothingItem; onCycle: () => void }) {
  const label = { clean: 'Clean', dirty: 'Dirty', washing: 'Washing' }[item.laundry];
  return (
    <li>
      <button
        type="button"
        onClick={onCycle}
        className="card pressable flex w-full items-center gap-3 p-3 text-left"
      >
        <span className="size-12 shrink-0 overflow-hidden rounded-xl bg-[var(--surface-alt)]">
          <ItemImage item={item} className="size-full" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[0.9375rem] font-medium">{item.name}</span>
          <span className="block truncate text-[0.8125rem] text-[var(--text-muted)]">
            {categoryLabel(item.category)}
          </span>
        </span>
        <span
          className={cn(
            'shrink-0 rounded-full px-3 py-1 text-[0.75rem] font-semibold',
            item.laundry === 'clean'
              ? 'bg-[var(--success-soft)] text-[var(--success)]'
              : item.laundry === 'dirty'
                ? 'bg-[var(--danger-soft)] text-[var(--danger)]'
                : 'bg-[var(--info-soft)] text-[var(--info)]',
          )}
        >
          {label}
        </span>
      </button>
    </li>
  );
}
