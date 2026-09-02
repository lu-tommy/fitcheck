'use client';

import { Share2 } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { OutfitCollage } from '@/components/outfit/OutfitCollage';
import { PageHeader } from '@/components/PageHeader';
import { Button, ButtonLink } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/Feedback';
import { tenWays, type Way } from '@/domain/tenWays';
import { renderWaysImage, shareImage } from '@/lib/outfitImage';
import { pluralize } from '@/lib/format';
import { useActiveItems, useCloset, useResolvedItems } from '@/store/closet';
import { useOutfits } from '@/store/outfits';
import { toast } from '@/store/toast';

/**
 * Everything else in the wardrobe that goes with this.
 *
 * The app is a very good ten seconds in the morning and, until this, a thin
 * reason to open at any other time. Ten ways is the one styling format that
 * reliably outperforms a fit check — and the only version worth looking at
 * twice is the one built from clothes somebody already owns, which is exactly
 * the half a mood board cannot copy.
 *
 * Each look is a real outfit: tapping one saves it, so the screen is a way into
 * the wardrobe rather than a poster of it.
 */
export default function WaysPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { hydrated } = useCloset();
  const items = useActiveItems();
  const saveOutfit = useOutfits((state) => state.saveOutfit);
  const [sharing, setSharing] = useState(false);

  const hero = items.find((item) => item.id === params.id);
  const ways = useMemo(
    () => (hero ? tenWays(hero, items) : []),
    [hero, items],
  );

  if (!hydrated) return <div className="skeleton m-5 h-80 rounded-[var(--radius-card)]" />;

  if (!hero) {
    return (
      <div className="pb-6">
        <PageHeader title="Ways to wear it" back />
        <section className="card mx-5">
          <EmptyState
            title="That piece is not here"
            body="It may have been archived or deleted."
            action={<ButtonLink href="/closet">Back to the closet</ButtonLink>}
          />
        </section>
      </div>
    );
  }

  async function share() {
    if (sharing || !hero) return;
    setSharing(true);
    let blob: Blob;
    try {
      blob = await renderWaysImage(
        hero.name,
        ways.map((way) => ({
          label: way.label,
          items: way.itemIds
            .map((id) => items.find((item) => item.id === id))
            .filter((item): item is NonNullable<typeof item> => Boolean(item)),
        })),
      );
    } catch (error) {
      toast((error as Error).message, { tone: 'danger' });
      setSharing(false);
      return;
    }
    // The spinner covers the render, not the share sheet: once the OS has the
    // file the button must work again even if the sheet never reports back.
    setSharing(false);
    const result = await shareImage(blob, 'ways-to-wear.png', `${ways.length} ways to wear it`);
    if (result === 'downloaded') toast('Saved to your downloads');
  }

  return (
    <div className="pb-6">
      <PageHeader
        title="Ways to wear it"
        subtitle={hero.name}
        back
        action={
          ways.length ? (
            <button
              type="button"
              onClick={() => void share()}
              disabled={sharing}
              className="pressable -my-3 inline-flex items-center gap-1.5 px-1.5 py-3 text-[0.8125rem] font-medium text-[var(--brand)] disabled:opacity-50"
            >
              <Share2 size={14} />
              {sharing ? 'Rendering…' : 'Share'}
            </button>
          ) : undefined
        }
      />

      {ways.length === 0 ? (
        <section className="card mx-5">
          <EmptyState
            title="Not enough around it yet"
            body="A few more pieces — a bottom, a pair of shoes, something to layer — and this fills with outfits built from what you own."
            action={<ButtonLink href="/add">Add clothing</ButtonLink>}
          />
        </section>
      ) : (
        <div className="px-5">
          <p className="text-[0.9375rem] leading-relaxed text-[var(--text-muted)]">
            {pluralize(ways.length, 'outfit')} for the {hero.name.toLowerCase()}, all
            from clothes you already own. Tap one to keep it.
          </p>

          <div className="mt-4 grid grid-cols-2 gap-3">
            {ways.map((way) => (
              <WayCard
                key={way.label}
                way={way}
                onKeep={async () => {
                  const outfit = await saveOutfit({
                    name: `${hero.name} · ${way.label.toLowerCase()}`,
                    itemIds: way.itemIds,
                    source: 'ai',
                    occasion: way.label,
                  });
                  toast('Saved to your outfits', { tone: 'success' });
                  router.push(`/outfits/${outfit.id}`);
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function WayCard({ way, onKeep }: { way: Way; onKeep: () => void }) {
  const items = useResolvedItems(way.itemIds);
  return (
    <button
      type="button"
      onClick={onKeep}
      className="card pressable overflow-hidden p-0 text-left"
    >
      <OutfitCollage items={items} ratio="4 / 4.4" className="rounded-none" />
      <span className="block px-3 pt-2.5 pb-3">
        <span className="flex items-baseline justify-between gap-2">
          <span className="truncate text-[0.9375rem] font-medium">{way.label}</span>
          <span className="shrink-0 text-[0.8125rem] font-semibold tabular-nums text-[var(--brand)]">
            {way.score}
          </span>
        </span>
        <span className="mt-0.5 block text-[0.8125rem] leading-snug text-[var(--text-muted)]">
          {way.note}
        </span>
      </span>
    </button>
  );
}
