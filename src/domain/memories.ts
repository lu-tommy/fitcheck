import { slotOf } from './taxonomy';
import type { ClothingItem, Outfit, WearLog } from '@/types';

/**
 * What the wear log is actually for.
 *
 * Logging outfits is a chore that only pays off later, so it should pay off
 * visibly: what you wore a year ago today, the coat you have not touched since
 * spring, the jeans you have worn four times this fortnight. All of it comes
 * from records the app already keeps — nothing here asks for more work.
 */

export type MemoryKind = 'anniversary' | 'last-month' | 'forgotten' | 'on-repeat' | 'never-worn';

export interface Memory {
  kind: MemoryKind;
  title: string;
  body: string;
  itemIds: string[];
  outfitId?: string;
  /** Ranking weight — the home screen shows the strongest one. */
  weight: number;
}

const DAY = 86_400_000;

function daysBetween(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / DAY);
}

function parseDay(key: string): Date {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
}

function listNames(items: ClothingItem[], limit = 3): string {
  const names = items.slice(0, limit).map((item) => item.name.toLowerCase());
  const extra = items.length - names.length;
  const joined =
    names.length <= 1
      ? (names[0] ?? '')
      : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  return extra > 0 ? `${joined} and ${extra} more` : joined;
}

export function findMemories(
  items: ClothingItem[],
  outfits: Outfit[],
  wearLogs: WearLog[],
  today = new Date(),
): Memory[] {
  const live = items.filter((item) => !item.archived);
  const byId = new Map(live.map((item) => [item.id, item]));
  const resolve = (ids: string[]) =>
    ids.map((id) => byId.get(id)).filter((item): item is ClothingItem => Boolean(item));

  const memories: Memory[] = [];

  /* ---------------------------------------------------------- this day, before */

  const anniversaries: { log: WearLog; years: number }[] = [];
  const lastMonth: WearLog[] = [];

  wearLogs.forEach((log) => {
    const age = daysBetween(today, parseDay(log.date));
    if (age < 20) return;
    // A few days either side, so a Tuesday outfit still surfaces on a Thursday.
    const years = Math.round(age / 365);
    if (years >= 1 && Math.abs(age - years * 365) <= 3) {
      anniversaries.push({ log, years });
    } else if (Math.abs(age - 30) <= 2) {
      lastMonth.push(log);
    }
  });

  anniversaries.forEach(({ log, years }) => {
    const worn = resolve(log.itemIds);
    if (!worn.length) return;
    const outfit = outfits.find((entry) => entry.id === log.outfitId);
    memories.push({
      kind: 'anniversary',
      title: years === 1 ? 'A year ago today' : `${years} years ago today`,
      body: outfit
        ? `You wore ${outfit.name.toLowerCase()}${log.occasion ? ` for ${log.occasion.toLowerCase()}` : ''}.`
        : `You wore ${listNames(worn)}.`,
      itemIds: worn.map((item) => item.id),
      outfitId: log.outfitId,
      weight: 100 + years,
    });
  });

  lastMonth.slice(0, 1).forEach((log) => {
    const worn = resolve(log.itemIds);
    if (!worn.length) return;
    memories.push({
      kind: 'last-month',
      title: 'A month ago today',
      body: `You wore ${listNames(worn)}.`,
      itemIds: worn.map((item) => item.id),
      outfitId: log.outfitId,
      weight: 60,
    });
  });

  /* --------------------------------------------------------------- neglected */

  const forgotten = live
    .filter((item) => {
      if (!item.lastWornAt || item.wearCount === 0) return false;
      if (slotOf(item.category) === 'accessory') return false;
      return daysBetween(today, new Date(item.lastWornAt)) >= 90;
    })
    .sort((a, b) => (a.lastWornAt ?? '').localeCompare(b.lastWornAt ?? ''));

  if (forgotten.length) {
    const oldest = forgotten[0];
    const months = Math.round(daysBetween(today, new Date(oldest.lastWornAt!)) / 30);
    memories.push({
      kind: 'forgotten',
      title: 'Back of the wardrobe',
      body: `You have not worn ${oldest.name.toLowerCase()} in about ${months} months. It is still clean and it still fits the season.`,
      itemIds: [oldest.id],
      weight: 70,
    });
  }

  /* ---------------------------------------------------------------- on repeat */

  const recent = wearLogs.filter((log) => daysBetween(today, parseDay(log.date)) <= 14);
  const counts = new Map<string, number>();
  recent.forEach((log) => {
    log.itemIds.forEach((id) => counts.set(id, (counts.get(id) ?? 0) + 1));
  });
  const heaviest = [...counts.entries()]
    .filter(([id, count]) => count >= 4 && byId.has(id))
    .sort((a, b) => b[1] - a[1])[0];

  if (heaviest) {
    const item = byId.get(heaviest[0])!;
    memories.push({
      kind: 'on-repeat',
      title: 'On repeat',
      body: `${item.name} has been out ${heaviest[1]} times in the last fortnight. Worth a rest, or worth buying a second one.`,
      itemIds: [item.id],
      weight: 50,
    });
  }

  /* --------------------------------------------------------------- never worn */

  const neglected = live
    .filter((item) => item.wearCount === 0)
    .filter((item) => daysBetween(today, new Date(item.createdAt)) >= 30);

  if (neglected.length) {
    memories.push({
      kind: 'never-worn',
      title: neglected.length === 1 ? 'Still with the tags on' : `${neglected.length} never worn`,
      body:
        neglected.length === 1
          ? `${neglected[0].name} has been in your closet a month and has never been out.`
          : `${listNames(neglected)} have been in your closet a month without being worn.`,
      itemIds: neglected.slice(0, 6).map((item) => item.id),
      weight: 40,
    });
  }

  return memories.sort((a, b) => b.weight - a.weight);
}
