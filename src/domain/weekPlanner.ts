import { buildOutfitLocally } from './outfitEngine';
import { currentSeason } from '@/lib/date';
import type {
  ClothingItem,
  DailyForecast,
  GeneratedOutfit,
  Style,
  Units,
  WeatherSnapshot,
} from '@/types';

/**
 * A week, planned on a Sunday.
 *
 * The thing that turns a wardrobe app into a habit is not a better outfit — it
 * is not having to decide on a Tuesday morning. Each day is built against its
 * own forecast, and pieces used in the previous two days are held back so the
 * week does not collapse into the same three garments.
 */

export interface PlannedDay {
  /** YYYY-MM-DD. */
  date: string;
  outfit: GeneratedOutfit;
  /** The forecast this day was built against, where one was available. */
  forecast?: DailyForecast;
}

export interface WeekPlanContext {
  closet: ClothingItem[];
  weather?: WeatherSnapshot | null;
  preferredStyles?: Style[];
  avoidColors?: string[];
  /** Dates to plan, in order. */
  dates: string[];
  units?: Units;
}

/** How many days a piece is discouraged from reappearing. */
const REST_DAYS = 2;

export function planWeek(context: WeekPlanContext): PlannedDay[] {
  const clean = context.closet.filter((item) => !item.archived && item.laundry === 'clean');
  if (clean.length < 3) return [];

  const forecastByDate = new Map(
    (context.weather?.daily ?? []).map((entry) => [entry.date, entry]),
  );

  // itemId -> index of the day it was last used, so a rest window can be applied.
  const lastUsed = new Map<string, number>();
  const days: PlannedDay[] = [];

  context.dates.forEach((date, index) => {
    const forecast = forecastByDate.get(date);
    const temperature = forecast ? (forecast.high + forecast.low) / 2 : undefined;

    const resting = [...lastUsed.entries()]
      .filter(([, dayIndex]) => index - dayIndex <= REST_DAYS)
      .map(([itemId]) => itemId);

    const outfit = buildOutfitLocally({
      request: {
        prompt: 'Something for the day',
        temperature,
        weatherCondition: forecast?.condition,
        includeItemIds: [],
        excludeItemIds: [],
        cleanOnly: true,
      },
      closet: clean,
      weather: null,
      season: currentSeason(new Date(`${date}T12:00:00`)),
      preferredStyles: context.preferredStyles,
      avoidColors: context.avoidColors,
      restingItemIds: resting,
      units: context.units,
    });

    outfit.itemIds.forEach((itemId) => lastUsed.set(itemId, index));
    days.push({ date, outfit, forecast });
  });

  return days;
}

/** How much of the week actually differs, 0–1. Below about 0.5 reads repetitive. */
export function planVariety(days: PlannedDay[]): number {
  if (days.length < 2) return 1;
  const seen = new Set<string>();
  let total = 0;
  days.forEach((day) => {
    day.outfit.itemIds.forEach((id) => {
      seen.add(id);
      total += 1;
    });
  });
  return total ? seen.size / total : 1;
}
