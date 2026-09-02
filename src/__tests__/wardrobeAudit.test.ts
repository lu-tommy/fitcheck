import { describe, expect, it } from 'vitest';

import { scoreOutfit } from '@/domain/fitScore';
import { buildOutfitLocally } from '@/domain/outfitEngine';
import { readIntent } from '@/domain/intent';
import { readWardrobeReport } from '@/domain/wardrobeReport';
import { slotOf } from '@/domain/taxonomy';
import type { ClothingItem, Formality, WeatherSnapshot } from '@/types';

import { REAL_WARDROBE } from './fixtures/realWardrobe';

/**
 * Reading the outfits out loud.
 *
 * Every other test here builds the smallest closet that proves one rule, which
 * is the right way to test a rule and no way at all to answer the question
 * somebody actually has: does this dress me like a person, or like a
 * spreadsheet?
 *
 * So these run the real engine over a real wardrobe and print what comes out,
 * then hold it to the things a person would notice across a room. Run
 * `npx vitest run wardrobeAudit --reporter=verbose` to read the outfits.
 */

const index = new Map(REAL_WARDROBE.map((item) => [item.id, item]));

function weather(temperature: number): WeatherSnapshot {
  return {
    temperature,
    feelsLike: temperature,
    high: temperature + 2,
    low: temperature - 3,
    code: 1,
    condition: 'Clear',
    precipitationChance: 5,
    windSpeed: 8,
    units: 'metric',
    locationLabel: 'Home',
    fetchedAt: '2026-06-01T08:00:00.000Z',
  };
}

interface Look {
  scenario: string;
  worn: ClothingItem[];
  score: ReturnType<typeof scoreOutfit>;
  name: string;
  warnings?: string[];
}

function dress(scenario: string, prompt: string, temperature: number): Look {
  const intent = readIntent(prompt);
  const built = buildOutfitLocally({
    request: {
      prompt,
      occasion: intent?.occasion,
      formality: intent?.formality as Formality | undefined,
      temperature,
      includeItemIds: [],
      excludeItemIds: [],
      cleanOnly: true,
    },
    closet: REAL_WARDROBE,
    weather: weather(temperature),
    season: undefined,
    today: '2026-06-01',
    preferCategories: intent?.prefer,
    avoidCategories: intent?.avoid,
    preferredStyles: intent?.styles,
  });

  const worn = built.itemIds
    .map((id) => index.get(id))
    .filter((item): item is ClothingItem => Boolean(item));

  return { scenario, worn, score: scoreOutfit(worn), name: built.name, warnings: built.warnings };
}

const SCENARIOS: [string, string, number][] = [
  ['A normal Tuesday', 'Something for today', 18],
  ['First day at a new office', "It's my first day at the new office", 16],
  ['Dinner out', 'Dinner out with friends', 14],
  ['A wedding', "I'm going to a wedding", 20],
  ['The gym', "I'm heading to the gym", 19],
  ['Freezing walk', 'Just going for a walk', -2],
  ['Heatwave', 'Something for today', 31],
  ['A date', 'I have a date tonight', 17],
  ['Staying in', "I'm staying home today", 20],
  ['Travelling', "I'm travelling today", 15],
];

const looks = SCENARIOS.map(([scenario, prompt, temperature]) =>
  dress(scenario, prompt, temperature),
);

describe('what it actually puts on her', () => {
  it('reads the outfits out loud', () => {
    const lines: string[] = ['', '='.repeat(78), 'WHAT THE ENGINE ACTUALLY WEARS', '='.repeat(78)];

    looks.forEach((look) => {
      lines.push('');
      lines.push(`── ${look.scenario} ${'─'.repeat(Math.max(0, 60 - look.scenario.length))}`);
      lines.push(`   "${look.name}"   ${look.score.score}/100 · ${look.score.verdict}`);
      look.worn.forEach((item) => {
        lines.push(`     ${slotOf(item.category).padEnd(10)} ${item.name}`);
      });
      look.score.deductions.forEach((note) => lines.push(`     ✗ ${note.points}  ${note.note}`));
      look.score.credits.forEach((note) => lines.push(`     ✓ +${note.points} ${note.note}`));
      (look.warnings ?? []).forEach((warning) => lines.push(`     ! ${warning}`));
    });

    const report = readWardrobeReport(REAL_WARDROBE);
    lines.push('', '='.repeat(78), 'THE WARDROBE ITSELF', '='.repeat(78));
    lines.push(`   Average ${report.average}/100 over ${report.samples} outfits`);
    report.lifting.forEach((entry) =>
      lines.push(`   ✓ +${entry.delta}  ${index.get(entry.itemId)?.name} — ${entry.commonReason ?? ''}`),
    );
    report.harder.forEach((entry) =>
      lines.push(`   ✗ ${entry.delta}  ${index.get(entry.itemId)?.name} — ${entry.commonReason ?? ''}`),
    );

    console.log(lines.join('\n'));
    expect(looks.length).toBe(SCENARIOS.length);
  });

  /* ---------------------------------------------------- the clown checks -- */

  it('always sends her out in a whole outfit', () => {
    looks.forEach((look) => {
      const slots = new Set(look.worn.map((item) => slotOf(item.category)));
      const covered = slots.has('fullbody') || (slots.has('top') && slots.has('bottom'));
      expect(covered, `${look.scenario}: not dressed`).toBe(true);
      expect(slots.has('footwear'), `${look.scenario}: no shoes`).toBe(true);
    });
  });

  it('never wears two of anything that can only be worn once', () => {
    looks.forEach((look) => {
      (['top', 'bottom', 'footwear', 'fullbody', 'outerwear', 'headwear'] as const).forEach(
        (slot) => {
          const count = look.worn.filter((item) => slotOf(item.category) === slot).length;
          expect(count, `${look.scenario}: ${count} things in ${slot}`).toBeLessThanOrEqual(1);
        },
      );
    });
  });

  it('never puts a top and a bottom on under a dress', () => {
    looks.forEach((look) => {
      const slots = look.worn.map((item) => slotOf(item.category));
      if (!slots.includes('fullbody')) return;
      expect(slots, `${look.scenario}: dress with separates`).not.toContain('bottom');
      expect(slots, `${look.scenario}: dress with a top under it`).not.toContain('top');
    });
  });

  /*
   * The clown line. Four steps of formality apart is the thing you notice
   * across a room — a tank top with dress trousers, trainers with a wedding.
   */
  it('never sends her out dressed for two different evenings', () => {
    looks.forEach((look) => {
      const register = look.score.deductions.find((note) => note.rule === 'register');
      expect(register?.points ?? 0, `${look.scenario}: ${register?.note}`).toBeGreaterThan(-20);
    });
  });

  it('never puts three colours in a fight', () => {
    looks.forEach((look) => {
      const anchor = look.score.deductions.find((note) => note.rule === 'anchor');
      expect(anchor?.points ?? 0, `${look.scenario}: ${anchor?.note}`).toBeGreaterThan(-8);
    });
  });

  it('never puts two prints of the same size together', () => {
    looks.forEach((look) => {
      const pattern = look.score.deductions.find((note) => note.rule === 'pattern');
      expect(pattern?.points ?? 0, `${look.scenario}: ${pattern?.note}`).toBeGreaterThan(-6);
    });
  });

  it('never layers wool over shorts, or sends her out cold', () => {
    const hot = looks.find((look) => look.scenario === 'Heatwave')!;
    const heavy = hot.worn.filter((item) =>
      ['sweater', 'hoodie', 'coat', 'parka', 'cardigan'].includes(item.category),
    );
    expect(heavy.map((item) => item.name), 'wool in a heatwave').toEqual([]);

    const cold = looks.find((look) => look.scenario === 'Freezing walk')!;
    const slots = new Set(cold.worn.map((item) => slotOf(item.category)));
    expect(slots.has('outerwear') || slots.has('midlayer'), 'no coat at -2°C').toBe(true);
  });

  it('does not put a blazer on her for the gym', () => {
    const gym = looks.find((look) => look.scenario === 'The gym')!;
    const names = gym.worn.map((item) => item.category);
    expect(names).not.toContain('blazer');
    expect(names).not.toContain('dress-pants');
    expect(names).not.toContain('dress-shoes');
  });

  it('dresses up when it is asked to', () => {
    const wedding = looks.find((look) => look.scenario === 'A wedding')!;
    const casual = wedding.worn.filter(
      (item) =>
        ['top', 'bottom', 'fullbody', 'footwear'].includes(slotOf(item.category)) &&
        (item.formality === 'very-casual' || item.formality === 'casual'),
    );
    expect(casual.map((item) => item.name), 'too casual for a wedding').toEqual([]);
  });

  /*
   * Every one of these is a thing the engine actually did, on this wardrobe,
   * before it was fixed. They are written as scenarios rather than as unit
   * tests because that is how they were found: not by a rule failing in
   * isolation, but by reading ten outfits and wincing.
   */
  it('does not dress her in the shirt she has worn once', () => {
    // Wear count was a straight penalty, so a purple satin shirt bought once
    // and regretted outranked a favourite tee worn forty-two times — and turned
    // up in seven of these ten outfits.
    const appearances = looks.filter((look) =>
      look.worn.some((item) => item.name === 'Purple satin shirt'),
    ).length;
    expect(appearances, 'the regretted shirt is everywhere').toBeLessThanOrEqual(2);

    const favourites = looks.filter((look) =>
      look.worn.some((item) => item.favorite),
    ).length;
    expect(favourites, 'nothing she loves ever gets worn').toBeGreaterThan(3);
  });

  it('does not put fleece and long sleeves on her in a heatwave', () => {
    const hot = looks.find((look) => look.scenario === 'Heatwave')!;
    hot.worn.forEach((item) => {
      expect(
        item.seasons.includes('summer') || item.seasons.length === 0,
        `31°C in a ${item.name}`,
      ).toBe(true);
    });
  });

  it('does not send her out at minus two in heels, or without a coat', () => {
    const cold = looks.find((look) => look.scenario === 'Freezing walk')!;
    const shoes = cold.worn.find((item) => slotOf(item.category) === 'footwear')!;
    expect(shoes.category, 'heels in the snow').not.toBe('dress-shoes');
    expect(shoes.category, 'sandals in the snow').not.toBe('sandals');
    expect(
      cold.worn.some((item) => slotOf(item.category) === 'outerwear'),
      'no coat at -2°C',
    ).toBe(true);
  });

  it('does not accessorise her for the gym', () => {
    const gym = looks.find((look) => look.scenario === 'The gym')!;
    const worn = gym.worn.map((item) => item.category);
    // It came back with a wool scarf, gold hoops, a signet ring and a belt.
    expect(worn, 'a wool scarf to the gym').not.toContain('scarf');
    expect(worn, 'a handbag to the gym').not.toContain('bag');
    expect(
      gym.worn.filter((item) => slotOf(item.category) === 'accessory').length,
    ).toBeLessThanOrEqual(2);
  });

  it('does not offer sunglasses for dinner on a fourteen-degree evening', () => {
    const dinner = looks.find((look) => look.scenario === 'Dinner out')!;
    expect(dinner.worn.map((item) => item.category)).not.toContain('sunglasses');
  });

  it('wears the dress to the wedding, and does not put a wool jumper over it', () => {
    const wedding = looks.find((look) => look.scenario === 'A wedding')!;
    const slots = wedding.worn.map((item) => slotOf(item.category));
    expect(slots, 'a formal dress lost a wedding to an Oxford shirt').toContain('fullbody');
    expect(slots, 'a chunky jumper over a silk wrap dress').not.toContain('midlayer');
  });

  /*
   * The engine and the scorer have to agree. An app that assembles an outfit
   * and then explains why that outfit is wrong reads as arguing with itself.
   */
  it('does not build the outfit its own score is about to mark down', () => {
    looks.forEach((look) => {
      const metals = look.score.deductions.find((note) => note.rule === 'metals');
      expect(metals, `${look.scenario}: ${metals?.note}`).toBeUndefined();
    });
  });

  /* -------------------------------------------------- the display checks -- */

  it('only ever shows pieces that are actually in the outfit', () => {
    looks.forEach((look) => {
      // Every id the engine returned resolves to a real, active garment: the
      // suggestion screen renders exactly this list and nothing else.
      const ids = new Set(look.worn.map((item) => item.id));
      expect(ids.size, `${look.scenario}: a piece appears twice`).toBe(look.worn.length);
      look.worn.forEach((item) => {
        expect(item.archived ?? false, `${look.scenario}: ${item.name} is archived`).toBe(false);
        expect(item.laundry, `${look.scenario}: ${item.name} is dirty`).toBe('clean');
      });
    });
  });

  it('has a picture for every piece it shows', () => {
    looks.forEach((look) => {
      look.worn.forEach((item) => {
        expect(
          Boolean(item.cutoutId ?? item.photoId),
          `${look.scenario}: ${item.name} would render as a colour block`,
        ).toBe(true);
      });
    });
  });

  it('leaves out anything archived or in the wash, on every scenario', () => {
    const shelved = REAL_WARDROBE.map((item) =>
      item.id === 'w17' ? { ...item, archived: true } : item.id === 'w28' ? { ...item, laundry: 'dirty' as const } : item,
    );
    const built = buildOutfitLocally({
      request: {
        prompt: 'Something for today',
        includeItemIds: [],
        excludeItemIds: [],
        cleanOnly: true,
      },
      closet: shelved.filter((item) => !item.archived),
      weather: weather(18),
    });
    expect(built.itemIds).not.toContain('w17');
    expect(built.itemIds).not.toContain('w28');
  });
});
