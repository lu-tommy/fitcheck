'use client';

import { Check, SkipForward } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { ItemImage } from '@/components/closet/ItemImage';
import { PageHeader } from '@/components/PageHeader';
import { ButtonLink } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/Feedback';
import {
  FIT_LABEL,
  FIT_ORDER,
  LENGTH_LABEL,
  LENGTH_ORDER,
  PATTERN_SCALE_LABEL,
  PATTERN_SCALE_ORDER,
  RISE_LABEL,
  RISE_ORDER,
  categoryLabel,
} from '@/domain/taxonomy';
import {
  FIELD_UNLOCKS,
  SHAPE_FIELD_LABEL,
  missingFields,
  readShapeGaps,
  type ShapeField,
} from '@/domain/wardrobeGaps';
import { cn } from '@/lib/cn';
import { useActiveItems, useCloset } from '@/store/closet';
import { toast } from '@/store/toast';
import type { ClothingItem } from '@/types';

/**
 * Answering the questions the score could not.
 *
 * Three of the seven rules need facts nobody has supplied, and the score says
 * so on every outfit rather than guessing. That is the honest behaviour and it
 * is also, on its own, a nag — a request with no route to acting on it turns
 * every morning into a reminder of a chore with no beginning.
 *
 * This is the beginning. One garment at a time, only the questions it can
 * answer, and the ones somebody actually wears first. Answering the last
 * question moves on by itself, because the whole design constraint is the
 * number of taps: a form that opens, scrolls, saves and closes for each of
 * forty garments is the two-to-three hour setup people abandon wardrobe apps
 * over, and it does not become acceptable just because it happens later.
 *
 * Deliberately no "guess them all for me" button. What a garment's cut is
 * cannot be read off a photograph of somebody wearing it — see the note in
 * domain/wardrobeGaps — and a wrong fact here silently corrupts the rules this
 * exists to unblock. Fast and true beats instant and wrong.
 */
export default function ShapePage() {
  const router = useRouter();
  const { hydrated, updateItem } = useCloset();
  const items = useActiveItems();

  /** Skipped for now — kept for this visit only, so nothing is lost for good. */
  const [skipped, setSkipped] = useState<string[]>([]);
  const [answered, setAnswered] = useState(0);

  const report = useMemo(() => readShapeGaps(items), [items]);
  const queue = useMemo(
    () => report.queue.filter((entry) => !skipped.includes(entry.item.id)),
    [report.queue, skipped],
  );

  const current = queue[0];
  const remaining = queue.length;
  const done = answered;
  const total = done + remaining;

  async function answer(item: ClothingItem, field: ShapeField, value: string) {
    const patch = { [field]: value } as Partial<ClothingItem>;
    // Counted before the write, because the write re-runs the queue and this
    // row is about to leave it.
    if (missingFields(item).length === 1) setAnswered((count) => count + 1);
    await updateItem(item.id, patch);
  }

  if (!hydrated) {
    return <div className="skeleton m-5 h-80 rounded-[var(--radius-card)]" />;
  }

  if (!current) {
    return (
      <div className="pb-6">
        <PageHeader title="Shape" back />
        <section className="card mx-5">
          <EmptyState
            icon={<Check size={24} />}
            title={report.queue.length ? 'That is the lot for now' : 'Everything has answered'}
            body={
              report.queue.length
                ? 'The ones you skipped are still here whenever you come back to them.'
                : 'Every garment has said how it fits. Proportion, the waistline and pattern mixing can all be judged now.'
            }
            action={<ButtonLink href="/">Back to today</ButtonLink>}
          />
        </section>
      </div>
    );
  }

  const item = current.item;

  return (
    <div className="pb-6">
      <PageHeader
        title="Shape"
        subtitle={`${done + 1} of ${total}`}
        back
        action={
          <button
            type="button"
            onClick={() => setSkipped((list) => [...list, item.id])}
            className="pressable inline-flex items-center gap-1.5 text-[0.8125rem] text-[var(--text-muted)]"
          >
            <SkipForward size={14} />
            Skip
          </button>
        }
      />

      <div className="px-5">
        <div className="h-1 overflow-hidden rounded-full bg-[var(--surface-alt)]">
          <span
            className="block h-full rounded-full bg-[var(--brand)] transition-[width] duration-300"
            style={{ width: `${total ? (done / total) * 100 : 0}%` }}
          />
        </div>

        <div className="mt-4 flex items-center gap-3.5">
          <ItemImage
            item={item}
            className="size-20 shrink-0 rounded-2xl"
            showLabel={false}
          />
          <div className="min-w-0">
            <h2 className="text-title truncate">{item.name}</h2>
            <p className="text-[0.8125rem] text-[var(--text-muted)]">
              {categoryLabel(item.category)}
              {item.wearCount > 0 ? ` · worn ${item.wearCount} times` : ''}
            </p>
          </div>
        </div>

        <div className="mt-6 space-y-6">
          {current.missing.map((field) => (
            <Question
              key={field}
              field={field}
              onPick={(value) => void answer(item, field, value)}
            />
          ))}
        </div>

        <p className="mt-7 text-[0.8125rem] leading-relaxed text-[var(--text-faint)]">
          Nothing here is guessed. What a garment&rsquo;s cut is cannot be read off a photo of
          somebody wearing it, and a wrong answer would quietly break the rules this is
          here to switch on.
        </p>
      </div>
    </div>
  );
}

/**
 * One question, as chips big enough to hit without looking.
 *
 * The subline says what answering buys rather than what the field is called —
 * "lets the score judge proportion" is a reason, and "Fit" is a label.
 */
function Question({
  field,
  onPick,
}: {
  field: ShapeField;
  onPick: (value: string) => void;
}) {
  const options = OPTIONS[field];
  return (
    <div>
      <span className="text-label block text-[var(--text-muted)]">
        {SHAPE_FIELD_LABEL[field]}
      </span>
      <span className="mt-0.5 block text-[0.8125rem] text-[var(--text-faint)]">
        Unlocks {FIELD_UNLOCKS[field]}
      </span>
      <div className={cn('mt-2.5 flex flex-wrap gap-2')}>
        {options.map((option) => (
          <Chip key={option.value} onClick={() => onPick(option.value)}>
            {option.label}
          </Chip>
        ))}
      </div>
    </div>
  );
}

const OPTIONS: Record<ShapeField, { value: string; label: string }[]> = {
  fit: FIT_ORDER.map((value) => ({ value, label: FIT_LABEL[value] })),
  length: LENGTH_ORDER.map((value) => ({ value, label: LENGTH_LABEL[value] })),
  rise: RISE_ORDER.map((value) => ({ value, label: RISE_LABEL[value] })),
  patternScale: PATTERN_SCALE_ORDER.map((value) => ({
    value,
    label: PATTERN_SCALE_LABEL[value],
  })),
};
