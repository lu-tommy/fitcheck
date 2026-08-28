'use client';

import { Check, Heart, Plus, Sparkles, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { PageHeader } from '@/components/PageHeader';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Chip';
import { EmptyState, Spinner } from '@/components/ui/Feedback';
import { Field, Input, Select } from '@/components/ui/Field';
import { Sheet } from '@/components/ui/Sheet';
import { CATEGORIES, categoryLabel } from '@/domain/taxonomy';
import { aiConfigured, suggestWishlist } from '@/lib/ai';
import { cn } from '@/lib/cn';
import { titleCase } from '@/lib/format';
import { useActiveItems } from '@/store/closet';
import { toast } from '@/store/toast';
import { useWishlist } from '@/store/wishlist';
import type { Category } from '@/types';

export default function WishlistPage() {
  const items = useActiveItems();
  const { items: wishes, add, removeItem, togglePurchased } = useWishlist();

  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<Category>('tshirt');
  const [colorName, setColorName] = useState('');
  const [brand, setBrand] = useState('');
  const [price, setPrice] = useState('');
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);

  async function findGaps() {
    if (!items.length) return;
    setBusy(true);
    const configured = await aiConfigured();
    if (!configured) {
      setBusy(false);
      toast('Gap analysis needs an Anthropic API key on the server', { tone: 'danger' });
      return;
    }
    const suggestions = await suggestWishlist(items);
    setBusy(false);
    if (!suggestions?.length) {
      toast('No suggestions came back', { tone: 'danger' });
      return;
    }
    for (const suggestion of suggestions) {
      await add({
        name: suggestion.name,
        category: suggestion.category,
        colorName: suggestion.colorName,
        reason: suggestion.reason,
        source: 'ai',
      });
    }
    toast(`Added ${suggestions.length} suggestions`, { tone: 'success' });
  }

  const open = wishes.filter((wish) => !wish.purchased);
  const bought = wishes.filter((wish) => wish.purchased);

  return (
    <div className="pb-6">
      <PageHeader
        title="Wishlist"
        subtitle="Pieces that would earn their place"
        action={
          <Button size="sm" icon={<Plus size={16} />} onClick={() => setAdding(true)}>
            Add
          </Button>
        }
      />

      <div className="space-y-5 px-5">
        <Button
          variant="secondary"
          full
          icon={<Sparkles size={16} />}
          onClick={findGaps}
          disabled={busy || !items.length}
        >
          {busy ? <Spinner label="Reading your closet" /> : 'Find the gaps in my wardrobe'}
        </Button>

        {!wishes.length ? (
          <EmptyState
            icon={<Heart size={26} />}
            title="Nothing on the list"
            body="Save things you are thinking of buying, and check them against what you already own before you do."
            action={
              items.length ? undefined : <ButtonLink href="/add">Add your closet first</ButtonLink>
            }
          />
        ) : (
          <>
            {open.length ? (
              <ul className="space-y-3">
                {open.map((wish) => (
                  <li key={wish.id} className="card p-4">
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-[0.9375rem] font-semibold">{wish.name}</p>
                        <p className="mt-0.5 text-[0.8125rem] text-[var(--text-muted)]">
                          {[
                            categoryLabel(wish.category),
                            wish.colorName ? titleCase(wish.colorName) : null,
                            wish.brand,
                            wish.price ? String(wish.price) : null,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <button
                          type="button"
                          onClick={() => void togglePurchased(wish.id)}
                          aria-label="Mark as bought"
                          className="pressable grid size-9 place-items-center rounded-full bg-[var(--surface-alt)] text-[var(--text-muted)]"
                        >
                          <Check size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => void removeItem(wish.id)}
                          aria-label="Remove"
                          className="pressable grid size-9 place-items-center rounded-full text-[var(--text-faint)]"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                    {wish.reason ? (
                      <p className="mt-2 text-[0.875rem] leading-relaxed text-[var(--text-muted)]">
                        {wish.reason}
                      </p>
                    ) : null}
                    <div className="mt-2 flex items-center gap-2">
                      {wish.source === 'ai' ? (
                        <Badge tone="brand">
                          <Sparkles size={11} /> Suggested
                        </Badge>
                      ) : null}
                      {wish.url ? (
                        <a
                          href={wish.url}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="text-[0.8125rem] text-[var(--brand)] underline underline-offset-2"
                        >
                          Open link
                        </a>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}

            {bought.length ? (
              <section>
                <h2 className="text-label mb-2 text-[var(--text-muted)]">Bought</h2>
                <ul className="space-y-2">
                  {bought.map((wish) => (
                    <li
                      key={wish.id}
                      className={cn(
                        'card flex items-center gap-3 p-3 opacity-60',
                      )}
                    >
                      <span className="min-w-0 flex-1 truncate text-[0.9375rem] line-through">
                        {wish.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => void togglePurchased(wish.id)}
                        className="pressable shrink-0 text-[0.8125rem] text-[var(--brand)]"
                      >
                        Undo
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </>
        )}
      </div>

      <Sheet
        open={adding}
        onClose={() => setAdding(false)}
        title="Add to wishlist"
        footer={
          <Button
            full
            disabled={!name.trim()}
            onClick={async () => {
              const parsed = Number.parseFloat(price);
              await add({
                name: name.trim(),
                category,
                colorName: colorName.trim() || undefined,
                brand: brand.trim() || undefined,
                price: Number.isFinite(parsed) ? parsed : undefined,
                url: url.trim() || undefined,
                source: 'manual',
              });
              setName('');
              setColorName('');
              setBrand('');
              setPrice('');
              setUrl('');
              setAdding(false);
              toast('Added to your wishlist', { tone: 'success' });
            }}
          >
            Add
          </Button>
        }
      >
        <div className="space-y-4 pt-1">
          <Field label="What is it?">
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Camel overcoat"
            />
          </Field>
          <Field label="Category">
            <Select
              value={category}
              onChange={(event) => setCategory(event.target.value as Category)}
            >
              {CATEGORIES.map((meta) => (
                <option key={meta.category} value={meta.category}>
                  {meta.label}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Colour">
              <Input value={colorName} onChange={(event) => setColorName(event.target.value)} />
            </Field>
            <Field label="Brand">
              <Input value={brand} onChange={(event) => setBrand(event.target.value)} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Price">
              <Input
                value={price}
                inputMode="decimal"
                onChange={(event) => setPrice(event.target.value.replace(/[^0-9.]/g, ''))}
              />
            </Field>
            <Field label="Link">
              <Input
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="https://"
                inputMode="url"
              />
            </Field>
          </div>
        </div>
      </Sheet>
    </div>
  );
}
