import { planVariety, planWeek } from '@/domain/weekPlanner';
import type { ClothingItem } from '@/types';

import { makeItem } from './factories';

const dates = ['2026-08-31', '2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04'];

/** A wardrobe with enough of everything that repeats are a choice, not a limit. */
function wideCloset(): ClothingItem[] {
  const tops = ['white', 'black', 'navy', 'green', 'grey'].map((color, index) =>
    makeItem({ id: `top-${index}`, category: 'tshirt', primaryColor: color }),
  );
  const bottoms = ['denim', 'black', 'tan'].map((color, index) =>
    makeItem({ id: `bottom-${index}`, category: 'chinos', primaryColor: color }),
  );
  const shoes = ['white', 'brown'].map((color, index) =>
    makeItem({ id: `shoe-${index}`, category: 'sneakers', primaryColor: color }),
  );
  return [...tops, ...bottoms, ...shoes];
}

describe('planWeek', () => {
  it('plans one outfit per date, in order', () => {
    const plan = planWeek({ closet: wideCloset(), dates });
    expect(plan).toHaveLength(dates.length);
    expect(plan.map((day) => day.date)).toEqual(dates);
  });

  it('dresses every day fully', () => {
    planWeek({ closet: wideCloset(), dates }).forEach((day) => {
      expect(day.outfit.itemIds.length).toBeGreaterThanOrEqual(3);
    });
  });

  it('does not put the same top on two days running, even in a thin wardrobe', () => {
    const plan = planWeek({ closet: wideCloset(), dates });
    for (let i = 1; i < plan.length; i += 1) {
      const previous = plan[i - 1].outfit.itemIds.filter((id) => id.startsWith('top-'));
      const current = plan[i].outfit.itemIds.filter((id) => id.startsWith('top-'));
      expect(current.some((id) => previous.includes(id))).toBe(false);
    }
  });

  it('ignores anything dirty or archived', () => {
    const closet = wideCloset();
    closet[0].laundry = 'dirty';
    closet[1].archived = true;
    const used = new Set(planWeek({ closet, dates }).flatMap((day) => day.outfit.itemIds));
    expect(used.has(closet[0].id)).toBe(false);
    expect(used.has(closet[1].id)).toBe(false);
  });

  it('gives up the rest window one step at a time, not all at once', () => {
    // Three tops, two bottoms, one pair of shoes: the shoes must repeat every
    // day, but the tops should still never land back to back.
    const closet = [
      ...['white', 'black', 'navy'].map((color, i) =>
        makeItem({ id: `top-${i}`, category: 'tshirt', primaryColor: color }),
      ),
      ...['denim', 'tan'].map((color, i) =>
        makeItem({ id: `bottom-${i}`, category: 'chinos', primaryColor: color }),
      ),
      makeItem({ id: 'shoe-0', category: 'sneakers' }),
    ];
    const plan = planWeek({ closet, dates });
    plan.forEach((day) => expect(day.outfit.itemIds).toContain('shoe-0'));
    for (let i = 1; i < plan.length; i += 1) {
      const previous = plan[i - 1].outfit.itemIds.filter((id) => id.startsWith('top-'));
      const current = plan[i].outfit.itemIds.filter((id) => id.startsWith('top-'));
      expect(current.some((id) => previous.includes(id))).toBe(false);
    }
  });

  it('still dresses a wardrobe with exactly one of everything', () => {
    const tiny = [
      makeItem({ id: 'tee', category: 'tshirt' }),
      makeItem({ id: 'jeans', category: 'jeans' }),
      makeItem({ id: 'shoes', category: 'sneakers' }),
    ];
    const plan = planWeek({ closet: tiny, dates });
    expect(plan).toHaveLength(dates.length);
    plan.forEach((day) => expect(day.outfit.itemIds).toHaveLength(3));
  });

  it('returns nothing when there is not enough to dress anyone', () => {
    expect(planWeek({ closet: [makeItem({ category: 'tshirt' })], dates })).toEqual([]);
  });

  it('builds each day against that day’s forecast', () => {
    const closet = [
      ...wideCloset(),
      makeItem({ id: 'coat', category: 'coat', seasons: ['winter'] }),
    ];
    const plan = planWeek({
      closet,
      weather: {
        temperature: 20,
        feelsLike: 20,
        high: 22,
        low: 18,
        code: 0,
        condition: 'Clear',
        precipitationChance: 0,
        windSpeed: 5,
        units: 'metric',
        locationLabel: 'Test',
        fetchedAt: '2026-08-30T00:00:00.000Z',
        daily: [
          { date: '2026-08-31', high: 26, low: 22, code: 0, condition: 'Clear', precipitationChance: 0 },
          { date: '2026-09-01', high: 2, low: -4, code: 71, condition: 'Snow', precipitationChance: 80 },
        ],
      },
      dates: ['2026-08-31', '2026-09-01'],
    });
    expect(plan[0].forecast?.high).toBe(26);
    // The freezing day should reach for the coat; the warm one should not.
    expect(plan[0].outfit.itemIds).not.toContain('coat');
    expect(plan[1].outfit.itemIds).toContain('coat');
  });
});

describe('planVariety', () => {
  it('scores a varied week higher than a repetitive one', () => {
    const varied = planWeek({ closet: wideCloset(), dates });
    const tiny = planWeek({
      closet: [
        makeItem({ id: 'tee', category: 'tshirt' }),
        makeItem({ id: 'jeans', category: 'jeans' }),
        makeItem({ id: 'shoes', category: 'sneakers' }),
      ],
      dates,
    });
    expect(planVariety(varied)).toBeGreaterThan(planVariety(tiny));
  });
});
