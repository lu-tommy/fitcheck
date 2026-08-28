'use client';

import { Camera, MessageCircleQuestion, Shirt, Sparkles, WashingMachine } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { OutfitPill } from '@/components/outfit/OutfitCard';
import { SafetyCard } from '@/components/SafetyCard';
import { OutfitStack } from '@/components/outfit/OutfitStack';
import { WeatherCard } from '@/components/WeatherCard';
import { Button, ButtonLink } from '@/components/ui/Button';
import { EmptyState, SectionHeader } from '@/components/ui/Feedback';
import { buildOutfitLocally } from '@/domain/outfitEngine';
import { demoWardrobe } from '@/domain/seed';
import { formatFriendlyDate, todayKey } from '@/lib/date';
import { pluralize } from '@/lib/format';
import { useCloset, useResolvedItems } from '@/store/closet';
import { useOutfits } from '@/store/outfits';
import { usePlanner } from '@/store/planner';
import { usePreferences } from '@/store/preferences';
import { toast } from '@/store/toast';
import { useWeather } from '@/store/weather';
import type { Outfit } from '@/types';

export default function HomePage() {
  const { items, hydrated, addItems } = useCloset();
  const { outfits, wearLogs, saveOutfit, wearOutfit } = useOutfits();
  const entryFor = usePlanner((state) => state.entryFor);
  const preferences = usePreferences((state) => state.preferences);
  const weather = useWeather((state) => state.snapshot);
  const [loadingDemo, setLoadingDemo] = useState(false);

  const today = todayKey();
  const planned = entryFor(today);
  const plannedOutfit = outfits.find((outfit) => outfit.id === planned?.outfitId);

  /**
   * The home suggestion always comes from the on-device engine, even when a
   * key is configured. Opening the app should not spend money, and the picker
   * on the Generate screen is where a considered suggestion belongs.
   */
  const suggestion = useMemo(() => {
    if (items.length < 3 || plannedOutfit) return null;
    return buildOutfitLocally({
      request: {
        prompt: 'Something for today',
        includeItemIds: [],
        excludeItemIds: [],
        cleanOnly: true,
      },
      closet: items,
      weather,
      preferredStyles: preferences.preferredStyles,
      avoidColors: preferences.avoidColors,
    });
  }, [items, weather, preferences.preferredStyles, preferences.avoidColors, plannedOutfit]);

  const suggestionItems = useResolvedItems(suggestion?.itemIds);
  const plannedItems = useResolvedItems(plannedOutfit?.itemIds);

  const recentlyWorn = useMemo(() => {
    const seen = new Set<string>();
    return wearLogs
      .filter((log) => log.outfitId && !seen.has(log.outfitId) && seen.add(log.outfitId))
      .map((log) => outfits.find((outfit) => outfit.id === log.outfitId))
      .filter((outfit): outfit is NonNullable<typeof outfit> => Boolean(outfit))
      .slice(0, 8);
  }, [wearLogs, outfits]);

  const favourites = outfits.filter((outfit) => outfit.favorite).slice(0, 8);
  const dirtyCount = items.filter((item) => item.laundry !== 'clean').length;

  async function loadDemo() {
    setLoadingDemo(true);
    await addItems(demoWardrobe());
    setLoadingDemo(false);
    toast('Demo wardrobe loaded — 22 pieces', { tone: 'success' });
  }

  async function saveSuggestion() {
    if (!suggestion) return;
    const outfit = await saveOutfit({
      name: suggestion.name,
      itemIds: suggestion.itemIds,
      explanation: suggestion.explanation,
      colorNotes: suggestion.colorNotes,
      source: 'ai',
      occasion: 'Today',
    });
    await wearOutfit(outfit.id);
    toast('Saved and logged as worn today', { tone: 'success' });
  }

  return (
    <div className="pb-6">
      <header
        className="px-5 pb-4"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 1.5rem)' }}
      >
        <p className="text-label text-[var(--text-faint)]">{formatFriendlyDate(today)}</p>
        <h1 className="text-display mt-1">{greeting()}</h1>
      </header>

      <div className="space-y-6 px-5">
        <SafetyCard />
        <WeatherCard />

        {!hydrated ? (
          <div className="skeleton h-56 rounded-[var(--radius-card)]" />
        ) : items.length === 0 ? (
          <section className="card">
            <EmptyState
              icon={<Shirt size={26} />}
              title="Your closet is empty"
              body="Photograph the clothes you own and OutfitAI will build outfits from them — and only from them."
              action={
                <div className="flex flex-col items-stretch gap-2">
                  <ButtonLink href="/add" icon={<Camera size={17} />}>
                    Add your first piece
                  </ButtonLink>
                  <Button variant="ghost" onClick={loadDemo} disabled={loadingDemo}>
                    {loadingDemo ? 'Loading…' : 'Or try a demo wardrobe'}
                  </Button>
                </div>
              }
            />
          </section>
        ) : plannedOutfit ? (
          <section>
            <SectionHeader
              title="Planned for today"
              action={
                <Link href="/calendar" className="text-[0.8125rem] text-[var(--brand)]">
                  Calendar
                </Link>
              }
            />
            <div className="card p-4">
              <p className="text-title">{plannedOutfit.name}</p>
              <OutfitStack items={plannedItems} className="mt-3" />
              <Button
                full
                className="mt-3"
                onClick={() => {
                  void wearOutfit(plannedOutfit.id);
                  toast('Logged as worn today', { tone: 'success' });
                }}
              >
                Wear this today
              </Button>
            </div>
          </section>
        ) : suggestion ? (
          <section>
            <SectionHeader
              title="Suggested for today"
              action={
                <Link href="/generate" className="text-[0.8125rem] text-[var(--brand)]">
                  Change
                </Link>
              }
            />
            <div className="card p-4">
              <OutfitStack items={suggestionItems} />
              <p className="mt-3 text-[0.875rem] leading-relaxed text-[var(--text-muted)]">
                {suggestion.explanation}
              </p>
              <div className="mt-3 flex gap-2">
                <Button full onClick={saveSuggestion}>
                  Wear this
                </Button>
                <ButtonLink href="/generate" variant="secondary" full>
                  Something else
                </ButtonLink>
              </div>
            </div>
          </section>
        ) : (
          <section className="card">
            <EmptyState
              icon={<Sparkles size={24} />}
              title="A few more pieces"
              body="Add at least a top, a bottom and a pair of shoes and OutfitAI can start suggesting outfits."
              action={<ButtonLink href="/add">Add clothing</ButtonLink>}
            />
          </section>
        )}

        {items.length > 0 ? (
          <section className="grid grid-cols-2 gap-3">
            <ButtonLink href="/add" variant="secondary" icon={<Camera size={17} />} className="h-12">
              Add clothing
            </ButtonLink>
            <ButtonLink
              href="/stylist"
              variant="secondary"
              icon={<MessageCircleQuestion size={17} />}
              className="h-12"
            >
              Ask stylist
            </ButtonLink>
          </section>
        ) : null}

        {dirtyCount > 0 ? (
          <Link
            href="/laundry"
            className="card pressable flex items-center gap-3 p-4"
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--warning-soft)] text-[var(--warning)]">
              <WashingMachine size={19} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[0.9375rem] font-medium">
                {pluralize(dirtyCount, 'piece')} in the wash
              </span>
              <span className="block text-[0.8125rem] text-[var(--text-muted)]">
                They are excluded from suggestions until they are clean.
              </span>
            </span>
          </Link>
        ) : null}

        {recentlyWorn.length ? (
          <Row title="Recently worn" outfits={recentlyWorn} />
        ) : null}
        {favourites.length ? <Row title="Favourites" outfits={favourites} /> : null}
      </div>
    </div>
  );
}

function Row({ title, outfits }: { title: string; outfits: Outfit[] }) {
  return (
    <section>
      <SectionHeader
        title={title}
        action={
          <Link href="/outfits" className="text-[0.8125rem] text-[var(--brand)]">
            See all
          </Link>
        }
      />
      <div className="scroll-row -mx-5 flex gap-3 px-5 pb-1">
        {outfits.map((outfit) => (
          <OutfitRowItem key={outfit.id} outfit={outfit} />
        ))}
      </div>
    </section>
  );
}

function OutfitRowItem({ outfit }: { outfit: Outfit }) {
  const items = useResolvedItems(outfit.itemIds);
  return <OutfitPill outfit={outfit} items={items} />;
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 5) return 'Still up?';
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}
