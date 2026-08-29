import { readIntent } from '@/domain/intent';
import { buildOutfitLocally } from '@/domain/outfitEngine';
import { slotOf } from '@/domain/taxonomy';
import type { ClothingItem } from '@/types';

import { makeItem } from './factories';

/**
 * The box you type into has to change the clothes you get. Until this existed
 * the engine never read it at all: "I'm going for a run" and "first day at the
 * office" produced identical outfits.
 */

/** A wardrobe with a genuine choice for every occasion below. */
function fullCloset(): ClothingItem[] {
  return [
    makeItem({ id: 'tee', category: 'tshirt', name: 'White tee', primaryColor: 'white', styles: ['casual'] }),
    makeItem({ id: 'tank', category: 'tank', name: 'Running vest', primaryColor: 'grey', styles: ['athletic'] }),
    makeItem({ id: 'shirt', category: 'shirt', name: 'Oxford shirt', primaryColor: 'light blue', formality: 'business-casual', styles: ['business-casual'] }),
    makeItem({ id: 'blazer', category: 'blazer', name: 'Navy blazer', primaryColor: 'navy', formality: 'formal', styles: ['formal'] }),
    makeItem({ id: 'hoodie', category: 'hoodie', name: 'Grey hoodie', primaryColor: 'grey', styles: ['athletic'] }),
    makeItem({ id: 'jeans', category: 'jeans', name: 'Blue jeans', primaryColor: 'denim' }),
    makeItem({ id: 'chinos', category: 'chinos', name: 'Stone chinos', primaryColor: 'tan', formality: 'smart-casual' }),
    makeItem({ id: 'trousers', category: 'dress-pants', name: 'Charcoal trousers', primaryColor: 'charcoal', formality: 'formal' }),
    makeItem({ id: 'shorts', category: 'shorts', name: 'Running shorts', primaryColor: 'black', styles: ['athletic'] }),
    makeItem({ id: 'joggers', category: 'joggers', name: 'Track joggers', primaryColor: 'navy', styles: ['athletic'] }),
    makeItem({ id: 'trainers', category: 'sneakers', name: 'Running trainers', primaryColor: 'white', styles: ['athletic'] }),
    makeItem({ id: 'derbies', category: 'dress-shoes', name: 'Black derbies', primaryColor: 'black', formality: 'formal' }),
    makeItem({ id: 'boots', category: 'boots', name: 'Walking boots', primaryColor: 'brown', styles: ['outdoor'] }),
  ];
}

/** What the app does end to end: read the words, then dress the person. */
function dressFor(prompt: string, closet = fullCloset()) {
  const intent = readIntent(prompt);
  const outfit = buildOutfitLocally({
    request: {
      prompt,
      formality: intent?.formality,
      temperature: intent?.temperature ?? 18,
      includeItemIds: [],
      excludeItemIds: [],
      cleanOnly: true,
    },
    closet,
    preferredStyles: intent?.styles,
    preferCategories: intent?.prefer,
    avoidCategories: intent?.avoid,
  });
  const worn = outfit.itemIds
    .map((id) => closet.find((item) => item.id === id))
    .filter((item): item is ClothingItem => Boolean(item));
  return { intent, outfit, worn, ids: outfit.itemIds };
}

describe('readIntent', () => {
  it('recognises a run', () => {
    const intent = readIntent('I am going for a run');
    expect(intent?.occasion).toBe('a run');
    expect(intent?.formality).toBe('very-casual');
    expect(intent?.styles).toContain('athletic');
  });

  it('recognises the office', () => {
    expect(readIntent('going to work')?.occasion).toBe('work');
    expect(readIntent('I have a meeting at the office')?.formality).toBe('business-casual');
  });

  it('dresses a first day up a notch', () => {
    const ordinary = readIntent('going to work');
    const firstDay = readIntent('first day at my new job');
    expect(firstDay?.formality).toBe('formal');
    expect(ordinary?.formality).toBe('business-casual');
  });

  it('reads the weather out of the sentence', () => {
    expect(readIntent('walking to work, it is freezing')?.temperature).toBeLessThan(0);
    expect(readIntent('work, going to be hot today')?.temperature).toBeGreaterThan(25);
  });

  it('does not find a word inside another word', () => {
    // "errands" contains "run"; it is a day at home, not a workout.
    expect(readIntent('doing some errands')?.occasion).toBe('a day at home');
  });

  it('says nothing rather than guessing', () => {
    expect(readIntent('qwertyuiop')).toBeNull();
    expect(readIntent('')).toBeNull();
  });

  it('explains what it understood', () => {
    expect(readIntent('going for a run')?.summary).toMatch(/a run/i);
  });
});

describe('the clothes actually change', () => {
  it('dresses a run in athletic kit, not office wear', () => {
    const { worn, ids } = dressFor('I am going for a run');
    const names = worn.map((item) => item.name).join(', ');
    expect(ids).toContain('trainers');
    expect(ids).not.toContain('derbies');
    expect(ids).not.toContain('blazer');
    expect(ids).not.toContain('chinos');
    expect(ids).not.toContain('jeans');
    expect(names).toMatch(/shorts|joggers|vest|tee|hoodie/i);
  });

  it('dresses a first day at the office properly', () => {
    const { ids } = dressFor('first day at my new job in the office');
    expect(ids).toContain('shirt');
    expect(ids.some((id) => ['trousers', 'chinos'].includes(id))).toBe(true);
    expect(ids.some((id) => ['derbies', 'loafers'].includes(id))).toBe(true);
    expect(ids).not.toContain('shorts');
    expect(ids).not.toContain('joggers');
    expect(ids).not.toContain('tank');
  });

  it('gives genuinely different clothes for a run and for work', () => {
    const run = dressFor('going for a run').ids.sort();
    const work = dressFor('going to the office').ids.sort();
    expect(run).not.toEqual(work);
    expect(run.filter((id) => work.includes(id))).toHaveLength(0);
  });

  it('dresses a wedding formally', () => {
    const { ids } = dressFor('I am going to a wedding');
    expect(ids).not.toContain('hoodie');
    expect(ids).not.toContain('shorts');
    expect(ids.some((id) => ['blazer', 'trousers', 'derbies', 'shirt'].includes(id))).toBe(true);
  });

  it('puts boots on for a hike', () => {
    expect(dressFor('going hiking this weekend').ids).toContain('boots');
  });

  it('still dresses you when the wardrobe cannot cover the occasion', () => {
    // Nothing athletic at all — office clothes and nothing else.
    const officeOnly = [
      makeItem({ id: 'shirt', category: 'shirt', name: 'Oxford shirt', primaryColor: 'light blue' }),
      makeItem({ id: 'trousers', category: 'dress-pants', name: 'Charcoal trousers', primaryColor: 'charcoal' }),
      makeItem({ id: 'derbies', category: 'dress-shoes', name: 'Black derbies', primaryColor: 'black' }),
    ];
    const { outfit, ids } = dressFor('going for a run', officeOnly);
    expect(ids).toHaveLength(3);
    // And it admits the wardrobe was the limit rather than pretending.
    expect(outfit.warnings?.join(' ')).toMatch(/do not own anything better suited/i);
  });

  it('leaves an unrecognised sentence to the ordinary engine', () => {
    const { intent, ids } = dressFor('something for the thing later');
    expect(intent).toBeNull();
    expect(ids.length).toBeGreaterThanOrEqual(3);
  });
});

describe('stepping through a slot', () => {
  const context = (closet: ClothingItem[]) => ({
    request: { prompt: '', includeItemIds: [], excludeItemIds: [], cleanOnly: true },
    closet,
  });

  it('changes only the piece that was stepped', async () => {
    const { cycleSlot } = await import('@/domain/outfitEngine');
    const closet = fullCloset();
    const { ids } = dressFor('going to the office', closet);
    const shoes = ids.find((id) => slotOf(closet.find((i) => i.id === id)!.category) === 'footwear')!;

    const next = cycleSlot(context(closet), ids, shoes, 1);

    expect(next).not.toContain(shoes);
    expect(next).toHaveLength(ids.length);
    ids.filter((id) => id !== shoes).forEach((id) => expect(next).toContain(id));
  });

  it('goes back to where it started', async () => {
    const { cycleSlot } = await import('@/domain/outfitEngine');
    const closet = fullCloset();
    const { ids } = dressFor('going to the office', closet);
    const shoes = ids.find((id) => slotOf(closet.find((i) => i.id === id)!.category) === 'footwear')!;

    const forward = cycleSlot(context(closet), ids, shoes, 1);
    const stepped = forward.find((id) => !ids.includes(id))!;
    const back = cycleSlot(context(closet), forward, stepped, -1);

    expect(back.sort()).toEqual(ids.sort());
  });

  it('wraps rather than running out', async () => {
    const { cycleSlot, slotAlternatives } = await import('@/domain/outfitEngine');
    const closet = fullCloset();
    const { ids } = dressFor('going to the office', closet);
    const shoes = ids.find((id) => slotOf(closet.find((i) => i.id === id)!.category) === 'footwear')!;
    const options = slotAlternatives(context(closet), ids, shoes).length;

    let current = ids;
    let stepped = shoes;
    for (let i = 0; i < options; i += 1) {
      current = cycleSlot(context(closet), current, stepped, 1);
      stepped = current.find((id) => !ids.includes(id)) ?? shoes;
    }
    // A full lap lands back on what it started with.
    expect(current.sort()).toEqual(ids.sort());
  });

  it('stays put when a slot holds only one garment', async () => {
    const { cycleSlot } = await import('@/domain/outfitEngine');
    const closet = [
      makeItem({ id: 'tee', category: 'tshirt' }),
      makeItem({ id: 'jeans', category: 'jeans' }),
      makeItem({ id: 'only-shoes', category: 'sneakers' }),
    ];
    const ids = ['tee', 'jeans', 'only-shoes'];
    expect(cycleSlot(context(closet), ids, 'only-shoes', 1)).toEqual(ids);
    expect(cycleSlot(context(closet), ids, 'only-shoes', -1)).toEqual(ids);
  });

  it('never offers a garment already worn elsewhere in the outfit', async () => {
    const { slotAlternatives } = await import('@/domain/outfitEngine');
    const closet = fullCloset();
    const { ids } = dressFor('going to the office', closet);
    const top = ids.find((id) => slotOf(closet.find((i) => i.id === id)!.category) === 'top')!;
    const options = slotAlternatives(context(closet), ids, top).map((item) => item.id);
    ids.filter((id) => id !== top).forEach((id) => expect(options).not.toContain(id));
  });
});
