'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { ItemTile } from '@/components/closet/ItemTile';
import { OutfitStack } from '@/components/outfit/OutfitStack';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/Feedback';
import { Field, Input } from '@/components/ui/Field';
import { analyzeHarmony } from '@/domain/color';
import { SLOT_LABEL, SLOT_ORDER, slotOf } from '@/domain/taxonomy';
import { useActiveItems, useResolvedItems } from '@/store/closet';
import { useOutfits } from '@/store/outfits';
import { toast } from '@/store/toast';
import type { Slot } from '@/types';

export default function OutfitBuilderPage() {
  const router = useRouter();
  const items = useActiveItems();
  const saveOutfit = useOutfits((state) => state.saveOutfit);

  const [selected, setSelected] = useState<string[]>([]);
  const [slot, setSlot] = useState<Slot | 'all'>('all');
  const [name, setName] = useState('');
  const [occasion, setOccasion] = useState('');

  const chosen = useResolvedItems(selected);
  const harmony = useMemo(
    () => (chosen.length > 1 ? analyzeHarmony(chosen.map((item) => item.primaryColorHex)) : null),
    [chosen],
  );

  const visible = slot === 'all' ? items : items.filter((item) => slotOf(item.category) === slot);

  function toggle(id: string) {
    setSelected((current) =>
      current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id],
    );
  }

  if (!items.length) {
    return (
      <>
        <PageHeader title="Build an outfit" back large={false} />
        <EmptyState
          title="Your closet is empty"
          body="Add some clothes first and they will show up here to combine."
          action={<Button onClick={() => router.push('/add')}>Add clothing</Button>}
        />
      </>
    );
  }

  return (
    <div className="pb-6">
      <PageHeader
        title="Build an outfit"
        back
        large={false}
        subtitle="Pick the pieces yourself"
      />

      <div className="space-y-5 px-5">
        {chosen.length ? (
          <section>
            <OutfitStack items={chosen} onSelect={(item) => toggle(item.id)} />
            {harmony ? (
              <p className="mt-3 rounded-2xl bg-[var(--surface-alt)] p-3 text-[0.875rem] leading-relaxed text-[var(--text-muted)]">
                {harmony.summary}
                {harmony.clashes.length ? ` ${harmony.clashes[0]}` : ''}
              </p>
            ) : null}
          </section>
        ) : (
          <p className="rounded-2xl border border-dashed border-[var(--border-strong)] p-5 text-center text-[0.875rem] text-[var(--text-muted)]">
            Tap pieces below to build the outfit. Tap again to remove.
          </p>
        )}

        <div className="scroll-row -mx-5 flex gap-2 px-5">
          <Chip selected={slot === 'all'} onClick={() => setSlot('all')}>
            All
          </Chip>
          {SLOT_ORDER.map((entry) => (
            <Chip key={entry} selected={slot === entry} onClick={() => setSlot(entry)}>
              {SLOT_LABEL[entry]}
            </Chip>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-3">
          {visible.map((item) => (
            <ItemTile
              key={item.id}
              item={item}
              selected={selected.includes(item.id)}
              onClick={() => toggle(item.id)}
            />
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Name">
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Airport outfit"
            />
          </Field>
          <Field label="Occasion">
            <Input
              value={occasion}
              onChange={(event) => setOccasion(event.target.value)}
              placeholder="Travel"
            />
          </Field>
        </div>

        <Button
          full
          size="lg"
          disabled={selected.length < 2}
          onClick={async () => {
            const outfit = await saveOutfit({
              name: name.trim() || 'Untitled outfit',
              itemIds: selected,
              occasion: occasion.trim() || undefined,
              source: 'manual',
            });
            toast('Outfit saved', { tone: 'success' });
            router.replace(`/outfits/${outfit.id}`);
          }}
        >
          {selected.length < 2 ? 'Pick at least two pieces' : `Save outfit (${selected.length})`}
        </Button>
      </div>
    </div>
  );
}
