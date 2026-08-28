import { buildPackingLocally } from '@/domain/packingEngine';
import { slotOf } from '@/domain/taxonomy';

import { basicCloset, makeItem } from './factories';

const request = {
  destination: 'Lisbon',
  days: 5,
  activities: ['Sightseeing', 'Dinners out'],
};

describe('buildPackingLocally', () => {
  it('plans one look per day', () => {
    const result = buildPackingLocally(request, basicCloset());
    expect(result.dayPlans).toHaveLength(5);
    expect(result.dayPlans.map((plan) => plan.day)).toEqual([1, 2, 3, 4, 5]);
  });

  it('packs only things that exist in the closet', () => {
    const closet = basicCloset();
    const ids = new Set(closet.map((item) => item.id));
    const result = buildPackingLocally(request, closet);
    result.itemIds.forEach((id) => expect(ids.has(id)).toBe(true));
  });

  it('re-wears bottoms rather than packing one pair per day', () => {
    const closet = basicCloset();
    const result = buildPackingLocally(request, closet);
    const bottoms = result.itemIds
      .map((id) => closet.find((item) => item.id === id)!)
      .filter((item) => slotOf(item.category) === 'bottom');
    expect(bottoms.length).toBeLessThan(request.days);
  });

  it('leaves dirty laundry at home', () => {
    const closet = basicCloset().map((item) =>
      item.id === 'jeans' ? { ...item, laundry: 'dirty' as const } : item,
    );
    const result = buildPackingLocally(request, closet);
    expect(result.itemIds).not.toContain('jeans');
  });

  it('names the destination and length in the summary', () => {
    const result = buildPackingLocally(request, basicCloset());
    expect(result.summary).toContain('Lisbon');
    expect(result.summary).toContain('5 days');
  });

  it('flags a genuine gap instead of padding the list', () => {
    const closet = [makeItem({ id: 'tee', category: 'tshirt' })];
    const result = buildPackingLocally(request, closet);
    expect(result.notes).toContain('no bottoms');
    expect(result.notes).toContain('no shoes');
  });

  it('handles a one-day trip', () => {
    const result = buildPackingLocally({ ...request, days: 1 }, basicCloset());
    expect(result.dayPlans).toHaveLength(1);
    expect(result.summary).toContain('1 day');
  });

  it('never returns duplicate day numbers for a long trip', () => {
    const result = buildPackingLocally({ ...request, days: 14 }, basicCloset());
    const days = result.dayPlans.map((plan) => plan.day);
    expect(new Set(days).size).toBe(days.length);
  });
});
