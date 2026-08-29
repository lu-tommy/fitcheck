'use client';

import {
  Camera,
  Check,
  Layers,
  Shirt,
  Sparkles,
  Undo2,
  WashingMachine,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { OutfitPill } from '@/components/outfit/OutfitCard';
import { MemoryCard } from '@/components/MemoryCard';
import { SafetyCard } from '@/components/SafetyCard';
import { OutfitCollage } from '@/components/outfit/OutfitCollage';
import { SlotPicker } from '@/components/outfit/SlotPicker';
import { OutfitStack } from '@/components/outfit/OutfitStack';
import { WeatherCard } from '@/components/WeatherCard';
import { Button, ButtonLink } from '@/components/ui/Button';
import { EmptyState, SectionHeader } from '@/components/ui/Feedback';
import { buildOutfitLocally, cycleSlot, slotAlternatives } from '@/domain/outfitEngine';
import { demoWardrobe } from '@/domain/seed';
import { putPhoto } from '@/db';
import { demoPhoto } from '@/lib/demoImages';
import { createId } from '@/lib/id';
import { nowIso } from '@/lib/date';
import { todayKey } from '@/lib/date';
import { formatTemperature } from '@/lib/format';
import { weatherKind } from '@/lib/weather';
import { pluralize } from '@/lib/format';
import { useActiveItems, useCloset, useResolvedItems } from '@/store/closet';
import { useOutfits } from '@/store/outfits';
import { usePlanner } from '@/store/planner';
import { usePreferences } from '@/store/preferences';
import { toast } from '@/store/toast';
import { useWeather } from '@/store/weather';
import type { ClothingItem, Outfit } from '@/types';

export default function HomePage() {
  const router = useRouter();
  const { hydrated, addItems } = useCloset();
  const items = useActiveItems();
  const { outfits, wearLogs, saveOutfit, wearOutfit, undoWear } = useOutfits();
  const entryFor = usePlanner((state) => state.entryFor);
  const preferences = usePreferences((state) => state.preferences);
  const weather = useWeather((state) => state.snapshot);
  const [loadingDemo, setLoadingDemo] = useState(false);

  const today = todayKey();
  const planned = entryFor(today);
  const plannedOutfit = outfits.find((outfit) => outfit.id === planned?.outfitId);

  /*
   * Today has three states, and they are the whole shape of this screen: worn
   * already, planned but not yet worn, or open. Tapping "wear this" used to
   * silently regenerate the suggestion, which read as the app overruling you.
   * Now it settles the day.
   */
  const wornToday = wearLogs.find((log) => log.date === today) ?? null;
  const wornOutfit = outfits.find((outfit) => outfit.id === wornToday?.outfitId) ?? null;

  /**
   * The home suggestion always comes from the on-device engine, even when a
   * key is configured. Opening the app should not spend money, and the picker
   * on the Generate screen is where a considered suggestion belongs.
   */
  const suggestion = useMemo(() => {
    if (items.length < 3 || plannedOutfit || wornToday) return null;
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
      units: preferences.units,
    });
  }, [
    items,
    weather,
    preferences.preferredStyles,
    preferences.avoidColors,
    preferences.units,
    plannedOutfit,
    wornToday,
  ]);

  /*
   * The suggestion is a starting point, not a verdict. Swiping one piece away
   * replaces only that slot and keeps the rest, because rerolling the whole
   * outfit to change the shoes throws away the four pieces she liked.
   */
  const [swappedIds, setSwappedIds] = useState<string[] | null>(null);
  const shownIds = swappedIds ?? suggestion?.itemIds;
  const suggestionItems = useResolvedItems(shownIds);
  const plannedItems = useResolvedItems(plannedOutfit?.itemIds);

  const engineContext = useMemo(
    () => ({
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
      units: preferences.units,
    }),
    [items, weather, preferences.preferredStyles, preferences.avoidColors, preferences.units],
  );

  // A fresh suggestion replaces anything swapped by hand.
  useEffect(() => {
    setSwappedIds(null);
  }, [suggestion?.itemIds.join(',')]);

  /** How many garments could fill each slot, so a lone option reads as fixed. */
  const optionCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    (shownIds ?? []).forEach((id) => {
      counts[id] = slotAlternatives(engineContext, shownIds ?? [], id).length;
    });
    return counts;
  }, [engineContext, shownIds]);

  const cycle = (item: ClothingItem, direction: 1 | -1) => {
    const next = cycleSlot(engineContext, shownIds ?? [], item.id, direction);
    if (next.join(',') === (shownIds ?? []).join(',')) {
      toast('Nothing else in your closet fits that slot');
      return;
    }
    setSwappedIds(next);
  };
  const wornItems = useResolvedItems(wornToday?.itemIds);
  // Shoes, outerwear and accessories survive a wear, so "logged" and "in the
  // wash" are different numbers and the card should not conflate them.
  const wornInTheWash = wornItems.filter((item) => item.laundry !== 'clean').length;

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
    const drafts = demoWardrobe();

    // Give every demo piece an illustration, drawn here rather than shipped.
    const withPictures = await Promise.all(
      drafts.map(async (draft) => {
        const blob = await demoPhoto(draft.category, draft.primaryColorHex);
        if (!blob) return draft;
        const photoId = createId('photo');
        await putPhoto({ id: photoId, blob, width: 400, height: 500, createdAt: nowIso() });
        /*
         * The same picture serves as both, because a drawn garment on a
         * transparent ground *is* the cut-out — there is no original photo it
         * was lifted out of. Every screen that prefers a cut-out then treats
         * the demo the way it will treat a real photographed wardrobe.
         */
        return { ...draft, photoId, cutoutId: photoId };
      }),
    );

    await addItems(withPictures);
    setLoadingDemo(false);
    toast(`Demo wardrobe loaded — ${withPictures.length} pieces`, { tone: 'success' });
  }

  async function saveSuggestion() {
    if (!suggestion) return;
    const outfit = await saveOutfit({
      name: suggestion.name,
      itemIds: shownIds ?? suggestion.itemIds,
      explanation: suggestion.explanation,
      colorNotes: suggestion.colorNotes,
      source: 'ai',
      occasion: 'Today',
    });
    await wearOutfit(outfit.id);
    toast('That is today sorted', { tone: 'success' });
  }

  return (
    <div className="pb-6">
      <header
        className="px-5 pb-4"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 1.25rem)' }}
      >
        {/*
          The date and the greeting depend on the reader's clock and timezone,
          so the server — which renders in UTC, in a container — cannot get them
          right. suppressHydrationWarning lets the client's answer win without
          React treating the difference as a bug, and without the flicker a
          mount-guard would cause.
        */}
        <h1 className="text-display" suppressHydrationWarning>
          {greeting()}
        </h1>
        <p
          className="mt-1.5 text-[0.9375rem] text-[var(--text-muted)]"
          suppressHydrationWarning
        >
          {longDate(today)}
          {weather
            ? ` · ${formatTemperature(weather.temperature, preferences.units)} ${describeSky(
                weather.code,
              )}`
            : ''}
        </p>
      </header>

      <div className="space-y-6 px-5">
        {!hydrated ? (
          <div className="skeleton h-56 rounded-[var(--radius-card)]" />
        ) : items.length === 0 ? (
          <section className="card">
            <EmptyState
              illustration
              title="Nothing in here yet"
              body="Photograph the clothes you own, and every outfit this app suggests will be made of them — and only of them."
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
        ) : wornToday ? (
          <section>
            <SectionHeader
              title="Today"
              action={
                <button
                  type="button"
                  onClick={async () => {
                    await undoWear(wornToday.id);
                    toast('Undone — today is open again');
                  }}
                  className="pressable inline-flex items-center gap-1.5 text-[0.8125rem] text-[var(--text-muted)]"
                >
                  <Undo2 size={14} />
                  Undo
                </button>
              }
            />
            <div className="card overflow-hidden">
              <div className="flex items-center gap-2.5 border-b border-[var(--border)] bg-[var(--success-soft)] px-4 py-2.5">
                <Check size={16} className="shrink-0 text-[var(--success)]" />
                <p className="text-[0.875rem] font-medium text-[var(--success)]">
                  {wornOutfit ? `Wearing ${wornOutfit.name.toLowerCase()}` : 'Wearing this today'}
                </p>
              </div>
              <div className="p-4">
                <OutfitCollage
                  items={wornItems}
                  layout={wornOutfit?.layout}
                  onSelect={(item) => router.push(`/closet/${item.id}`)}
                />
                <p className="mt-3 text-[0.875rem] leading-relaxed text-[var(--text-muted)]">
                  {pluralize(wornItems.length, 'piece')} logged.{' '}
                  {wornInTheWash
                    ? `${wornInTheWash} went in the wash, so ${
                        wornInTheWash === 1 ? 'it will' : 'they will'
                      } not be suggested again tomorrow.`
                    : 'Nothing here needs washing after one wear.'}
                </p>
                <div className="mt-3 flex gap-2">
                  {wornOutfit ? (
                    <ButtonLink href={`/outfits/${wornOutfit.id}`} variant="secondary" full>
                      Open outfit
                    </ButtonLink>
                  ) : null}
                  <ButtonLink href="/generate" variant="secondary" full>
                    Change your mind
                  </ButtonLink>
                </div>
              </div>
            </div>
          </section>
        ) : plannedOutfit ? (
          <section>
            <SectionHeader
              title="Planned for today"
              action={
                <Link
                  href="/calendar"
                  className="pressable -my-3 px-1.5 py-3 text-[0.8125rem] text-[var(--brand)]"
                >
                  Calendar
                </Link>
              }
            />
            <div className="card p-4">
              <p className="text-title">{plannedOutfit.name}</p>
              <OutfitCollage
                items={plannedItems}
                layout={plannedOutfit.layout}
                onSelect={(item) => router.push(`/closet/${item.id}`)}
                className="mt-3"
              />
              <Button
                full
                className="mt-3"
                icon={<Check size={17} />}
                onClick={async () => {
                  await wearOutfit(plannedOutfit.id);
                  toast('That is today sorted', { tone: 'success' });
                }}
              >
                Wear this today
              </Button>
            </div>
          </section>
        ) : suggestion ? (
          /*
           * The outfit is the whole point of this screen, so it stops being one
           * card in a stack of cards and becomes the plate: edge to edge, its
           * name set over the lay, and the decision directly underneath where a
           * thumb already is. Everything that used to compete with it — the
           * install prompt, the weather, the laundry note — now sits below it.
           */
          <section className="-mx-5">
            <div className="flex items-baseline justify-between px-5">
              <p className="text-label text-[var(--text-faint)]">Suggested for today</p>
              <Link
                href="/generate"
                className="pressable -my-3 px-1.5 py-3 text-[0.8125rem] font-medium text-[var(--brand)]"
              >
                Change
              </Link>
            </div>

            <OutfitCollage
              items={suggestionItems}
              ratio="4 / 4.5"
              onSelect={(item) => router.push(`/closet/${item.id}`)}
              onSwap={(item, direction) => cycle(item, direction)}
              className="mt-1 rounded-none"
            />

            <div className="px-5">
              <h2 className="text-title mt-3.5">{suggestion.name}</h2>
              <div className="mt-3 flex gap-2">
                <Button full icon={<Check size={17} />} onClick={saveSuggestion}>
                  Wear this
                </Button>
                <ButtonLink href="/generate" variant="secondary" full>
                  Something else
                </ButtonLink>
              </div>

              <SlotPicker
                items={suggestionItems}
                onCycle={cycle}
                optionCounts={optionCounts}
                className="mt-4"
              />
              <p className="mt-1 text-center text-[0.75rem] text-[var(--text-faint)]">
                Swipe a piece on the picture, or use the arrows, to change just that one
              </p>
              <p className="mt-4 text-[0.875rem] leading-relaxed text-[var(--text-muted)]">
                {suggestion.explanation}
              </p>
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

        {/*
          Below the fold on purpose. A permission prompt and an install banner
          asked for before the app has shown anything are two chores stacked in
          front of the first thing she opened it to see.
        */}
        {items.length ? <WeatherCard /> : null}
        <SafetyCard />

        {items.length > 0 ? (
          <section className="grid grid-cols-2 gap-3">
            <ButtonLink href="/add" variant="secondary" icon={<Camera size={17} />} className="h-12">
              Add clothing
            </ButtonLink>
            <ButtonLink
              href="/outfits/new"
              variant="secondary"
              icon={<Layers size={17} />}
              className="h-12"
            >
              Build an outfit
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

        <MemoryCard />

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
          <Link
            href="/outfits"
            className="pressable -my-3 px-1.5 py-3 text-[0.8125rem] text-[var(--brand)]"
          >
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

/*
 * "Today" was the whole subline, which told her nothing she did not already
 * know. The actual day and the actual weather is the context the suggestion
 * below was built from, so it belongs here.
 */
function longDate(key: string): string {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

/** Plain words for the sky, so the date line reads as a sentence. */
const SKY: Record<string, string> = {
  clear: 'and clear',
  cloud: 'and cloudy',
  rain: 'and raining',
  snow: 'and snowing',
  storm: 'with storms',
  fog: 'and foggy',
};

function describeSky(code: number): string {
  return SKY[weatherKind(code)] ?? '';
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 5) return 'Still up?';
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}
