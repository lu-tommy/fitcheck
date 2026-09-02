'use client';

import { Check, ShoppingBag } from 'lucide-react';
import { useState } from 'react';

import { SLOT_LABEL, categoryLabel } from '@/domain/taxonomy';
import { cn } from '@/lib/cn';
import { useWishlist } from '@/store/wishlist';
import { toast } from '@/store/toast';
import type { MissingPiece } from '@/types';

/**
 * What the wardrobe could not supply, said out loud.
 *
 * The engine used to improvise: asked to dress for a wedding out of a casual
 * wardrobe it produced a white t-shirt with charcoal dress trousers and
 * trainers, scored it 48, called it "something in here is fighting" — and
 * presented it as the answer with the real problem in a warning underneath.
 *
 * This is the opposite of that card. It is not an apology and it is not an
 * error state: it is the most useful thing a wardrobe app can tell somebody,
 * because it is the one thing only a wardrobe app knows. And it ends in an
 * action, since a gap somebody cannot do anything about is just bad news.
 */
export function MissingPieces({
  missing,
  occasion,
  className,
}: {
  missing: MissingPiece[];
  occasion?: string;
  className?: string;
}) {
  const add = useWishlist((state) => state.add);
  const [added, setAdded] = useState<string[]>([]);

  if (!missing.length) return null;

  return (
    <section className={cn('card overflow-hidden', className)}>
      <div className="border-b border-[var(--border)] bg-[var(--warning-soft)] px-4 py-3">
        <p className="text-[0.9375rem] font-medium text-[var(--warning)]">
          {missing.length === 1
            ? 'One thing you do not own'
            : `${missing.length} things you do not own`}
        </p>
        <p className="mt-0.5 text-[0.8125rem] leading-relaxed text-[var(--warning)]">
          Everything above is built from your closet. These are the gaps
          {occasion ? ` ${occasion}` : ''} left — filling any one of them changes
          what this app can dress you for.
        </p>
      </div>

      <ul className="divide-y divide-[var(--border)]">
        {missing.map((piece) => {
          const isAdded = added.includes(piece.slot);
          return (
            <li key={piece.slot} className="px-4 py-3.5">
              <p className="text-label text-[var(--text-faint)]">{SLOT_LABEL[piece.slot]}</p>
              <p className="mt-0.5 text-[0.9375rem] leading-snug">{piece.suggestion}</p>
              <p className="mt-1 text-[0.8125rem] leading-relaxed text-[var(--text-muted)]">
                {piece.because}
              </p>

              {piece.categories.length ? (
                <button
                  type="button"
                  disabled={isAdded}
                  onClick={async () => {
                    /*
                     * The first category is the most ordinary member of the
                     * slot, which is the right thing to write down: somebody
                     * shopping for "a shirt" will recognise a blouse when they
                     * see one, and a wishlist entry that hedges is not a list.
                     */
                    const category = piece.categories[0];
                    await add({
                      name: categoryLabel(category),
                      category,
                      source: 'ai',
                      reason: piece.suggestion,
                    });
                    setAdded((current) => [...current, piece.slot]);
                    toast('On your wishlist', { tone: 'success' });
                  }}
                  className={cn(
                    'pressable mt-2.5 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5',
                    'text-[0.8125rem] font-semibold',
                    isAdded
                      ? 'bg-[var(--surface-alt)] text-[var(--text-muted)]'
                      : 'bg-[var(--brand)] text-[var(--on-brand)]',
                  )}
                >
                  {isAdded ? <Check size={13} /> : <ShoppingBag size={13} />}
                  {isAdded ? 'On your wishlist' : 'Add to wishlist'}
                </button>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
