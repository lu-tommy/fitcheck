import { describe, expect, it } from 'vitest';

import { list, scoreOutfit, type FitRule } from '@/domain/fitScore';
import type { ClothingItem } from '@/types';

import { makeItem } from './factories';

/**
 * The engine could always say whether an outfit was VALID. None of that is the
 * question somebody is asking in front of a mirror, which is whether it works —
 * and proportion, pattern scale, focal points and the third piece are what
 * decide that.
 */

const ruleOf = (notes: { rule: FitRule }[]) => notes.map((note) => note.rule);

/** Top, bottom, shoes and nothing else: the outfit every rule has an opinion on. */
function plain(overrides: Partial<ClothingItem>[] = []): ClothingItem[] {
  return [
    makeItem({ id: 'top', category: 'tshirt', name: 'White tee', primaryColor: 'white', ...overrides[0] }),
    makeItem({ id: 'bottom', category: 'jeans', name: 'Indigo jeans', primaryColor: 'denim', ...overrides[1] }),
    makeItem({ id: 'shoes', category: 'sneakers', name: 'White sneakers', primaryColor: 'white', ...overrides[2] }),
  ];
}

describe('scoreOutfit', () => {
  it('returns a score, a verdict and a reason for every point moved', () => {
    const report = scoreOutfit(plain());
    expect(report.score).toBeGreaterThanOrEqual(0);
    expect(report.score).toBeLessThanOrEqual(100);
    expect(report.verdict).toMatch(/\S/);
    [...report.credits, ...report.deductions].forEach((note) => {
      expect(note.note).toMatch(/\S/);
      expect(note.points).not.toBe(0);
    });
  });

  it('never leaves the 0–100 range, however badly it goes', () => {
    const disaster = [
      makeItem({ id: 'a', category: 'tank', name: 'Neon tank', primaryColor: 'orange', formality: 'very-casual', pattern: 'floral', patternScale: 'bold', fit: 'oversized' }),
      makeItem({ id: 'b', category: 'dress-pants', name: 'Dress trousers', primaryColor: 'green', formality: 'black-tie', pattern: 'plaid', patternScale: 'bold', fit: 'relaxed' }),
      makeItem({ id: 'c', category: 'sneakers', name: 'Purple trainers', primaryColor: 'purple', pattern: 'camo', patternScale: 'bold' }),
    ];
    const report = scoreOutfit(disaster);
    expect(report.score).toBeGreaterThanOrEqual(0);
    expect(report.score).toBeLessThanOrEqual(100);
    expect(report.deductions.length).toBeGreaterThan(2);
  });
});

describe('the third piece', () => {
  it('marks down a top, a bottom and shoes with nothing else', () => {
    const report = scoreOutfit(plain());
    expect(ruleOf(report.deductions)).toContain('third-piece');
  });

  it('is satisfied by a jacket', () => {
    const report = scoreOutfit([
      ...plain(),
      makeItem({ id: 'jacket', category: 'jacket', name: 'Olive field jacket', primaryColor: 'olive' }),
    ]);
    expect(ruleOf(report.credits)).toContain('third-piece');
  });

  it('is satisfied by one real piece of jewellery, but not by a belt', () => {
    const withBelt = scoreOutfit([
      ...plain(),
      makeItem({ id: 'belt', category: 'belt', name: 'Tan belt', primaryColor: 'tan' }),
    ]);
    expect(ruleOf(withBelt.deductions)).toContain('third-piece');

    const withChain = scoreOutfit([
      ...plain(),
      makeItem({ id: 'chain', category: 'necklace', name: 'Gold chain', primaryColor: 'yellow' }),
    ]);
    expect(ruleOf(withChain.credits)).toContain('third-piece');
  });
});

describe('proportion', () => {
  it('says it cannot judge volume rather than guessing at it', () => {
    const report = scoreOutfit(plain());
    expect(ruleOf(report.unjudged)).toContain('volume');
    expect(ruleOf(report.credits)).not.toContain('volume');
    expect(ruleOf(report.deductions)).not.toContain('volume');
  });

  it('names the pieces whose fit is missing, so it can be gone and filled in', () => {
    const report = scoreOutfit(plain([{ fit: 'oversized' }]));
    const because = report.unjudged.find((entry) => entry.rule === 'volume')?.because ?? '';
    expect(because).toContain('indigo jeans');
    expect(because).not.toContain('white tee');
  });

  it('rewards volume against something fitted', () => {
    const report = scoreOutfit(plain([{ fit: 'oversized' }, { fit: 'fitted' }]));
    expect(ruleOf(report.credits)).toContain('volume');
  });

  it('marks down loose over loose, and fitted over fitted', () => {
    expect(ruleOf(scoreOutfit(plain([{ fit: 'relaxed' }, { fit: 'oversized' }])).deductions))
      .toContain('volume');
    expect(ruleOf(scoreOutfit(plain([{ fit: 'fitted' }, { fit: 'fitted' }])).deductions))
      .toContain('volume');
  });

  it('leaves a dress alone, because one piece has one volume', () => {
    const report = scoreOutfit([
      makeItem({ id: 'dress', category: 'dress', name: 'Black dress', primaryColor: 'black' }),
      makeItem({ id: 'shoes', category: 'boots', name: 'Black boots', primaryColor: 'black' }),
    ]);
    expect(ruleOf(report.unjudged)).not.toContain('volume');
    expect(ruleOf(report.deductions)).not.toContain('volume');
  });

  it('marks down a long top over a low rise, and rewards a high one', () => {
    const cut = scoreOutfit(plain([{ length: 'long' }, { rise: 'mid' }]));
    expect(ruleOf(cut.deductions)).toContain('waistline');

    const thirds = scoreOutfit(plain([{ length: 'regular' }, { rise: 'high' }]));
    expect(ruleOf(thirds.credits)).toContain('waistline');
  });
});

describe('pattern', () => {
  it('rewards one print with everything else plain', () => {
    const report = scoreOutfit(plain([{ pattern: 'striped', patternScale: 'bold' }]));
    expect(ruleOf(report.credits)).toContain('pattern');
  });

  it('marks down two prints at the same scale', () => {
    const report = scoreOutfit(
      plain([
        { pattern: 'striped', patternScale: 'medium' },
        { pattern: 'checked', patternScale: 'medium' },
      ]),
    );
    expect(ruleOf(report.deductions)).toContain('pattern');
  });

  it('rewards two prints at different scales — the way mixing actually works', () => {
    const report = scoreOutfit(
      plain([
        { pattern: 'striped', patternScale: 'bold' },
        { pattern: 'checked', patternScale: 'micro' },
      ]),
    );
    expect(ruleOf(report.credits)).toContain('pattern');
  });

  it('asks for the scale rather than assuming two prints clash', () => {
    const report = scoreOutfit(
      plain([{ pattern: 'striped' }, { pattern: 'checked', patternScale: 'micro' }]),
    );
    expect(ruleOf(report.unjudged)).toContain('pattern');
    expect(ruleOf(report.deductions)).not.toContain('pattern');
  });

  it('draws the line at three', () => {
    const report = scoreOutfit(
      plain([{ pattern: 'striped' }, { pattern: 'plaid' }, { pattern: 'floral' }]),
    );
    expect(ruleOf(report.deductions)).toContain('pattern');
  });
});

describe('colour', () => {
  /*
   * Harmony was counted one garment one vote, which lets a pair of socks argue
   * with a coat on equal terms. 60/30/10 is a rule about area, so it is judged
   * on area.
   */
  it('weights by how much of the outfit a piece actually covers', () => {
    const smallAccent = scoreOutfit([
      makeItem({ id: 'top', category: 'tshirt', name: 'White tee', primaryColor: 'white' }),
      makeItem({ id: 'bottom', category: 'jeans', name: 'Black jeans', primaryColor: 'black' }),
      makeItem({ id: 'shoes', category: 'sneakers', name: 'Red trainers', primaryColor: 'red' }),
    ]);
    expect(ruleOf(smallAccent.credits)).toContain('anchor');

    // The same red, now over the top half, with a second colour under it.
    const wholeOutfit = scoreOutfit([
      makeItem({ id: 'top', category: 'tshirt', name: 'Red tee', primaryColor: 'red' }),
      makeItem({ id: 'bottom', category: 'jeans', name: 'Green jeans', primaryColor: 'green' }),
      makeItem({ id: 'shoes', category: 'sneakers', name: 'White trainers', primaryColor: 'white' }),
    ]);
    expect(ruleOf(wholeOutfit.deductions)).toContain('anchor');
  });

  it('reads one colour over most of the outfit as tonal, not as a clash', () => {
    // Navy trousers under a navy jacket is one colour. Counting pieces would
    // have called it a clash.
    const report = scoreOutfit([
      makeItem({ id: 'top', category: 'tshirt', name: 'White tee', primaryColor: 'white' }),
      makeItem({ id: 'bottom', category: 'chinos', name: 'Green chinos', primaryColor: 'green' }),
      makeItem({ id: 'coat', category: 'jacket', name: 'Olive jacket', primaryColor: 'green' }),
      makeItem({ id: 'shoes', category: 'sneakers', name: 'White trainers', primaryColor: 'white' }),
    ]);
    expect(ruleOf(report.deductions)).not.toContain('anchor');
  });

  it('marks down three colours competing', () => {
    const report = scoreOutfit([
      makeItem({ id: 'top', category: 'tshirt', name: 'Red tee', primaryColor: 'red' }),
      makeItem({ id: 'bottom', category: 'jeans', name: 'Green jeans', primaryColor: 'green' }),
      makeItem({ id: 'shoes', category: 'sneakers', name: 'Purple trainers', primaryColor: 'purple' }),
    ]);
    expect(ruleOf(report.deductions)).toContain('anchor');
  });
});

describe('register and matching', () => {
  it('marks down a very-casual top with formal trousers', () => {
    const report = scoreOutfit([
      makeItem({ id: 'top', category: 'tank', name: 'Tank top', formality: 'very-casual' }),
      makeItem({ id: 'bottom', category: 'dress-pants', name: 'Dress trousers', formality: 'formal' }),
      makeItem({ id: 'shoes', category: 'sneakers', name: 'Trainers' }),
    ]);
    expect(ruleOf(report.deductions)).toContain('register');
  });

  it('marks down a bag, a belt and shoes in exactly the same colour', () => {
    const report = scoreOutfit([
      ...plain(),
      makeItem({ id: 'bag', category: 'bag', name: 'Black tote', primaryColor: 'black' }),
      makeItem({ id: 'belt', category: 'belt', name: 'Black belt', primaryColor: 'black' }),
    ].map((item) =>
      item.id === 'shoes'
        ? { ...item, name: 'Black boots', primaryColor: 'black', primaryColorHex: '#16161a' }
        : item,
    ));
    expect(ruleOf(report.deductions)).toContain('matchy');
  });

  it('leaves a bag that differs from the shoes alone', () => {
    const report = scoreOutfit([
      ...plain(),
      makeItem({ id: 'bag', category: 'bag', name: 'Burgundy tote', primaryColor: 'burgundy' }),
      makeItem({ id: 'belt', category: 'belt', name: 'Tan belt', primaryColor: 'tan' }),
    ]);
    expect(ruleOf(report.deductions)).not.toContain('matchy');
  });
});

describe('list', () => {
  it('writes a list out the way somebody would say it', () => {
    expect(list([])).toBe('');
    expect(list(['red'])).toBe('red');
    expect(list(['red', 'green'])).toBe('red and green');
    expect(list(['red', 'green', 'blue'])).toBe('red, green and blue');
  });
});
