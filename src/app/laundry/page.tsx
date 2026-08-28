'use client';

import { AlertTriangle, Info, WashingMachine } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { ItemImage } from '@/components/closet/ItemImage';
import { PageHeader } from '@/components/PageHeader';
import { Button, ButtonLink } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/Feedback';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { CYCLE_LABEL, careSummary, loadActionLabel, planWashLoads } from '@/domain/care';
import { categoryLabel } from '@/domain/taxonomy';
import { cn } from '@/lib/cn';
import { pluralize } from '@/lib/format';
import { useCloset, useActiveItems } from '@/store/closet';
import { toast } from '@/store/toast';
import type { ClothingItem, LaundryStatus } from '@/types';

const NEXT: Record<LaundryStatus, LaundryStatus> = {
  clean: 'dirty',
  dirty: 'washing',
  washing: 'clean',
};

export default function LaundryPage() {
  const { setLaundry, washAll } = useCloset();
  const items = useActiveItems();
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

  // The reason care instructions are worth recording: a dirty pile becomes a
  // set of loads that will not destroy anything.
  const plan = useMemo(() => planWashLoads(items), [items]);

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

        {tab === 'dirty' && plan.loads.length ? (
          <section className="space-y-3">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-heading">
                {plan.loads.length === 1 ? 'One load' : `${plan.loads.length} loads`}
              </h2>
              <span className="text-[0.8125rem] text-[var(--text-muted)]">
                Sorted by what the labels say
              </span>
            </div>

            {plan.loads.map((load) => (
              <article key={load.key} className="card overflow-hidden">
                <header className="flex items-baseline justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
                  <span className="min-w-0">
                    <span className="block truncate text-[0.9375rem] font-semibold">
                      {load.title}
                    </span>
                    <span className="block text-[0.8125rem] text-[var(--text-muted)]">
                      {pluralize(load.items.length, 'piece')}
                      {load.temperature !== null && load.cycle !== 'normal'
                        ? ` · ${CYCLE_LABEL[load.cycle].toLowerCase()} cycle`
                        : ''}
                    </span>
                  </span>
                  <Button
                    size="sm"
                    onClick={async () => {
                      await Promise.all(
                        load.items.map((item) => setLaundry(item.id, 'washing')),
                      );
                      toast(`${pluralize(load.items.length, 'piece')} in the machine`);
                    }}
                  >
                    {loadActionLabel(load.method)}
                  </Button>
                </header>

                <ul className="divide-y divide-[var(--border)]">
                  {load.items.map((item) => (
                    <li key={item.id}>
                      <Link
                        href={`/closet/${item.id}`}
                        className="pressable flex items-center gap-3 px-4 py-2.5"
                      >
                        <span className="size-9 shrink-0 overflow-hidden rounded-lg bg-[var(--surface-alt)]">
                          <ItemImage item={item} className="size-full" showLabel={false} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[0.875rem]">{item.name}</span>
                          <span className="block truncate text-[0.75rem] text-[var(--text-faint)]">
                            {careSummary(item.care) ?? 'No care label recorded'}
                          </span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>

                {load.warnings.length ? (
                  <div className="space-y-2 border-t border-[var(--border)] bg-[var(--warning-soft)] px-4 py-3">
                    {load.warnings.map((warning) => (
                      <p
                        key={warning}
                        className="flex items-start gap-2 text-[0.8125rem] leading-relaxed text-[var(--warning)]"
                      >
                        <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                        {warning}
                      </p>
                    ))}
                  </div>
                ) : null}
              </article>
            ))}

            {plan.unlabelled.length ? (
              <p className="flex items-start gap-2 rounded-2xl bg-[var(--surface-alt)] p-3 text-[0.8125rem] leading-relaxed text-[var(--text-muted)]">
                <Info size={14} className="mt-0.5 shrink-0" />
                {pluralize(plan.unlabelled.length, 'piece')} here {plan.unlabelled.length === 1 ? 'has' : 'have'}{' '}
                no care label recorded, so {plan.unlabelled.length === 1 ? 'it was' : 'they were'} sorted on a
                safe guess. Add the label on the item and the grouping gets sharper.
              </p>
            ) : null}

            <Button
              full
              variant="secondary"
              onClick={async () => {
                const count = buckets.dirty.length;
                await Promise.all(buckets.dirty.map((item) => setLaundry(item.id, 'washing')));
                toast(`${pluralize(count, 'piece')} in the machine`);
              }}
            >
              Wash everything in one load anyway
            </Button>
          </section>
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

        {tab === 'dirty' && plan.loads.length ? null : !shown.length ? (
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
