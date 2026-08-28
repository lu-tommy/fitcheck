import { careSummary, loadActionLabel, planWashLoads, suggestedCare } from '@/domain/care';
import type { CareInstructions, ClothingItem } from '@/types';

import { makeItem } from './factories';

const dirty = (item: ClothingItem): ClothingItem => ({ ...item, laundry: 'dirty' });

const care = (overrides: Partial<CareInstructions>): CareInstructions => ({
  flags: [],
  source: 'label',
  ...overrides,
});

describe('suggestedCare', () => {
  it('reads sensible defaults off the material', () => {
    const wool = suggestedCare({ category: 'sweater', material: 'Merino wool' });
    expect(wool?.wash).toBe('hand-wash');
    expect(wool?.flags).toContain('shrinks');
    expect(wool?.source).toBe('material-default');
  });

  it('knows shoes do not go in the machine', () => {
    expect(suggestedCare({ category: 'boots' })?.wash).toBe('do-not-wash');
  });

  it('returns nothing rather than guessing when the material is unknown', () => {
    expect(suggestedCare({ category: 'tshirt' })).toBeNull();
    expect(suggestedCare({ category: 'tshirt', material: 'Unobtanium' })).toBeNull();
  });
});

describe('careSummary', () => {
  it('reads like a label', () => {
    expect(careSummary(care({ wash: 'machine-cold', cycle: 'delicate', dry: 'dry-flat' })))
      .toBe('Machine, cold · delicate · dry flat');
  });

  it('is null when nothing has been recorded', () => {
    expect(careSummary(undefined)).toBeNull();
    expect(careSummary(care({}))).toBeNull();
  });
});

describe('planWashLoads', () => {
  it('only plans what is actually dirty', () => {
    const plan = planWashLoads([
      makeItem({ category: 'tshirt', material: 'Cotton' }),
      dirty(makeItem({ category: 'tshirt', material: 'Cotton' })),
    ]);
    expect(plan.loads.flatMap((load) => load.items)).toHaveLength(1);
  });

  it('separates a hand wash from a machine load', () => {
    const plan = planWashLoads([
      dirty(makeItem({ category: 'tshirt', care: care({ wash: 'machine-warm' }) })),
      dirty(makeItem({ category: 'sweater', care: care({ wash: 'hand-wash', cycle: 'delicate' }) })),
    ]);
    expect(plan.loads).toHaveLength(2);
    expect(plan.loads.map((load) => load.title)).toContain('Hand wash');
  });

  it('gives a wash-separately piece its own load', () => {
    const plan = planWashLoads([
      dirty(makeItem({ category: 'tshirt', care: care({ wash: 'machine-warm' }) })),
      dirty(makeItem({ category: 'tshirt', care: care({ wash: 'machine-warm' }) })),
      dirty(
        makeItem({
          category: 'shirt',
          name: 'Red silk shirt',
          care: care({ wash: 'machine-warm', flags: ['wash-separately'] }),
        }),
      ),
    ]);
    const solo = plan.loads.find((load) => load.key.startsWith('solo:'));
    expect(solo?.items).toHaveLength(1);
    expect(solo?.title).toContain('Red silk shirt');
  });

  it('warns when something that bleeds is in with something pale', () => {
    const plan = planWashLoads([
      dirty(
        makeItem({
          category: 'jeans',
          name: 'Raw denim',
          primaryColor: 'navy',
          care: care({ wash: 'machine-cold', flags: ['bleeds'] }),
        }),
      ),
      dirty(
        makeItem({
          category: 'tshirt',
          name: 'White tee',
          primaryColor: 'white',
          care: care({ wash: 'machine-cold' }),
        }),
      ),
    ]);
    const warnings = plan.loads.flatMap((load) => load.warnings).join(' ');
    expect(warnings).toMatch(/Raw denim/);
    expect(warnings).toMatch(/White tee/);
  });

  it('warns about mixing lights and darks even with no care labels filled in', () => {
    const plan = planWashLoads([
      dirty(makeItem({ category: 'tshirt', name: 'White tee', primaryColor: 'white' })),
      dirty(makeItem({ category: 'tshirt', name: 'Black tee', primaryColor: 'black' })),
    ]);
    expect(plan.loads.flatMap((load) => load.warnings).join(' ')).toMatch(/lights from darks/i);
  });

  it('flags a hot wash that would shrink something', () => {
    const plan = planWashLoads([
      dirty(
        makeItem({
          category: 'sweater',
          care: care({ wash: 'machine-hot', flags: ['shrinks'] }),
        }),
      ),
    ]);
    expect(plan.loads[0].warnings.join(' ')).toMatch(/shrinks/i);
  });

  it('reports which pieces it had to guess for', () => {
    const plan = planWashLoads([
      dirty(makeItem({ category: 'tshirt', name: 'Unknown tee' })),
      dirty(makeItem({ category: 'tshirt', care: care({ wash: 'machine-cold' }) })),
    ]);
    expect(plan.unlabelled.map((item) => item.name)).toEqual(['Unknown tee']);
  });

  it('puts machine loads before the by-hand piles', () => {
    const plan = planWashLoads([
      dirty(makeItem({ category: 'sweater', care: care({ wash: 'dry-clean' }) })),
      dirty(makeItem({ category: 'tshirt', care: care({ wash: 'machine-warm' }) })),
      dirty(makeItem({ category: 'tshirt', care: care({ wash: 'machine-warm' }) })),
    ]);
    expect(plan.loads[0].temperature).not.toBeNull();
    expect(plan.loads.at(-1)?.title).toBe('Dry clean only');
  });
});

describe('load actions', () => {
  it('never offers to start a load that does not go in a machine', () => {
    expect(loadActionLabel('dry-clean')).toBe('Dropped off');
    expect(loadActionLabel('do-not-wash')).toBe('Spot cleaned');
    expect(loadActionLabel('hand-wash')).toBe('Soaking');
    expect(loadActionLabel('machine-cold')).toBe('Start');
  });

  it('runs the cool loads before the hot ones', () => {
    const plan = planWashLoads(
      ['machine-hot', 'machine-cold', 'machine-warm'].map((wash, index) => ({
        ...makeItem({ category: 'tshirt', name: `Tee ${index}` }),
        laundry: 'dirty' as const,
        care: care({ wash: wash as CareInstructions['wash'] }),
      })),
    );
    expect(plan.loads.map((load) => load.temperature)).toEqual([30, 40, 60]);
  });
});
