'use client';

import { Heart, PenLine, Sparkles, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { use, useMemo, useState } from 'react';

import { ItemImage } from '@/components/closet/ItemImage';
import { EMPTY_DRAFT, ItemForm, type ItemDraft } from '@/components/closet/ItemForm';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/Feedback';
import { Sheet } from '@/components/ui/Sheet';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { hexForColorName, suggestPairings } from '@/domain/color';
import {
  FORMALITY_LABEL,
  PATTERN_LABEL,
  SEASON_LABEL,
  STYLE_LABEL,
  categoryLabel,
} from '@/domain/taxonomy';
import { cn } from '@/lib/cn';
import { formatRelative } from '@/lib/date';
import { titleCase, pluralize } from '@/lib/format';
import { swatches } from '@/lib/palette';
import { useCloset } from '@/store/closet';
import { toast } from '@/store/toast';
import type { LaundryStatus } from '@/types';

export default function ItemDetailPage({ params }: PageProps<'/closet/[id]'>) {
  const { id } = use(params);
  const router = useRouter();
  const { items, updateItem, deleteItem, toggleFavorite, setLaundry, hydrated } = useCloset();
  const item = items.find((entry) => entry.id === id);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<ItemDraft | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const pairings = useMemo(
    () => (item ? suggestPairings(item.primaryColorHex, item.primaryColor) : []),
    [item],
  );

  if (!hydrated) {
    return <div className="skeleton m-5 h-96 rounded-[var(--radius-card)]" />;
  }

  if (!item) {
    return (
      <>
        <PageHeader title="Not found" back large={false} />
        <EmptyState
          title="That piece is gone"
          body="It may have been deleted from another tab."
          action={<Button onClick={() => router.push('/closet')}>Back to closet</Button>}
        />
      </>
    );
  }

  function startEditing() {
    if (!item) return;
    setDraft({
      ...EMPTY_DRAFT,
      name: item.name,
      category: item.category,
      primaryColor: item.primaryColor,
      primaryColorHex: item.primaryColorHex,
      secondaryColors: item.secondaryColors,
      pattern: item.pattern,
      material: item.material ?? '',
      brand: item.brand ?? '',
      formality: item.formality,
      seasons: item.seasons,
      styles: item.styles,
      purchasePrice: item.purchasePrice != null ? String(item.purchasePrice) : '',
      notes: item.notes ?? '',
    });
    setEditing(true);
  }

  async function saveEdits() {
    if (!draft || !item) return;
    const price = Number.parseFloat(draft.purchasePrice);
    await updateItem(item.id, {
      name: draft.name.trim() || item.name,
      category: draft.category,
      primaryColor: draft.primaryColor,
      primaryColorHex: draft.primaryColorHex || hexForColorName(draft.primaryColor),
      secondaryColors: draft.secondaryColors,
      pattern: draft.pattern,
      material: draft.material || undefined,
      brand: draft.brand || undefined,
      formality: draft.formality,
      seasons: draft.seasons,
      styles: draft.styles,
      notes: draft.notes || undefined,
      purchasePrice: Number.isFinite(price) ? price : undefined,
      detection: { ...item.detection, editedByUser: true },
    });
    setEditing(false);
    toast('Saved', { tone: 'success' });
  }

  return (
    <div className="pb-6">
      <PageHeader
        title={item.name}
        back
        large={false}
        subtitle={categoryLabel(item.category)}
        action={
          <button
            type="button"
            onClick={() => void toggleFavorite(item.id)}
            aria-label={item.favorite ? 'Remove from favourites' : 'Add to favourites'}
            className={cn(
              'pressable grid size-9 place-items-center rounded-full',
              item.favorite
                ? 'bg-[var(--brand-soft)] text-[var(--brand)]'
                : 'bg-[var(--surface-alt)] text-[var(--text-muted)]',
            )}
          >
            <Heart size={17} fill={item.favorite ? 'currentColor' : 'none'} />
          </button>
        }
      />

      <div className="space-y-5 px-5">
        <div
          className={cn(
            'overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface-alt)]',
            item.cutoutId && 'alpha-grid',
          )}
        >
          <div className="aspect-4/5 w-full">
            <ItemImage
              item={item}
              className="size-full"
              fit={item.cutoutId ? 'contain' : 'cover'}
            />
          </div>
        </div>

        <div>
          <span className="text-label mb-2 block text-[var(--text-muted)]">Laundry</span>
          <SegmentedControl<LaundryStatus>
            value={item.laundry}
            onChange={(next) => void setLaundry(item.id, next)}
            options={[
              { value: 'clean', label: 'Clean' },
              { value: 'dirty', label: 'Dirty' },
              { value: 'washing', label: 'Washing' },
            ]}
          />
          {item.laundry !== 'clean' ? (
            <p className="mt-2 text-[0.8125rem] text-[var(--text-muted)]">
              Left out of outfit suggestions until it is clean again.
            </p>
          ) : null}
        </div>

        <section className="card divide-y divide-[var(--border)]">
          <Row label="Colour">
            <span className="flex items-center gap-2">
              <span
                className="size-4 rounded-full border border-[var(--border-strong)]"
                style={{ background: item.primaryColorHex }}
              />
              {titleCase(item.primaryColor)}
              {item.secondaryColors.length
                ? ` · ${item.secondaryColors.map(titleCase).join(', ')}`
                : ''}
            </span>
          </Row>
          <Row label="Pattern">{PATTERN_LABEL[item.pattern]}</Row>
          {item.material ? <Row label="Material">{item.material}</Row> : null}
          {item.brand ? <Row label="Brand">{item.brand}</Row> : null}
          <Row label="Formality">{FORMALITY_LABEL[item.formality]}</Row>
          <Row label="Seasons">
            {item.seasons.length
              ? item.seasons.map((season) => SEASON_LABEL[season]).join(', ')
              : 'Any'}
          </Row>
          <Row label="Style">
            {item.styles.length ? item.styles.map((style) => STYLE_LABEL[style]).join(', ') : '—'}
          </Row>
          <Row label="Worn">
            {item.wearCount > 0
              ? `${pluralize(item.wearCount, 'time')} · last ${formatRelative(item.lastWornAt).toLowerCase()}`
              : 'Never'}
          </Row>
          {item.purchasePrice ? (
            <Row label="Cost per wear">
              {(item.purchasePrice / Math.max(1, item.wearCount)).toFixed(2)}
            </Row>
          ) : null}
        </section>

        {item.notes ? (
          <section className="card p-4">
            <h2 className="text-label mb-1.5 text-[var(--text-muted)]">Notes</h2>
            <p className="text-[0.9375rem] leading-relaxed">{item.notes}</p>
          </section>
        ) : null}

        <section className="card p-4">
          <h2 className="text-heading">Goes with</h2>
          <p className="mt-1 text-[0.875rem] text-[var(--text-muted)]">
            Colours that reliably sit next to {titleCase(item.primaryColor).toLowerCase()}.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {pairings.map((color) => (
              <span
                key={color}
                className="inline-flex items-center gap-1.5 rounded-full bg-[var(--surface-alt)] px-3 py-1.5 text-[0.8125rem]"
              >
                <span
                  className="size-3 rounded-full border border-[var(--border-strong)]"
                  style={{ background: swatches[color] ?? hexForColorName(color) }}
                />
                {titleCase(color)}
              </span>
            ))}
          </div>
        </section>

        {item.detection.source === 'ai' ? (
          <Badge tone="brand">
            <Sparkles size={11} />
            {item.detection.editedByUser ? 'Detected, then edited by you' : 'Detected from the photo'}
          </Badge>
        ) : null}

        <div className="flex gap-2">
          <Button
            variant="secondary"
            full
            icon={<PenLine size={16} />}
            onClick={startEditing}
          >
            Edit details
          </Button>
          <Button
            variant="secondary"
            full
            icon={<Sparkles size={16} />}
            onClick={() => router.push(`/generate?include=${item.id}`)}
          >
            Style this
          </Button>
        </div>

        <Button
          variant="danger"
          full
          icon={<Trash2 size={16} />}
          onClick={() => setConfirmDelete(true)}
        >
          Delete from closet
        </Button>
      </div>

      <Sheet
        open={editing}
        onClose={() => setEditing(false)}
        title="Edit item"
        footer={
          <Button full onClick={saveEdits}>
            Save changes
          </Button>
        }
      >
        {draft ? (
          <ItemForm draft={draft} onChange={(patch) => setDraft({ ...draft, ...patch })} />
        ) : null}
      </Sheet>

      <Sheet
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete this piece?"
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" full onClick={() => setConfirmDelete(false)}>
              Keep it
            </Button>
            <Button
              variant="danger"
              full
              onClick={async () => {
                await deleteItem(item.id);
                toast('Deleted');
                router.replace('/closet');
              }}
            >
              Delete
            </Button>
          </div>
        }
      >
        <p className="py-2 text-[0.9375rem] leading-relaxed text-[var(--text-muted)]">
          {item.name} and its photo will be removed. Saved outfits that used it will show one
          fewer piece. This cannot be undone.
        </p>
      </Sheet>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <span className="text-[0.875rem] text-[var(--text-muted)]">{label}</span>
      <span className="min-w-0 text-right text-[0.9375rem]">{children}</span>
    </div>
  );
}
