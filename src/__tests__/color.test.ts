import {
  analyzeHarmony,
  hexForColorName,
  hexToHsl,
  hueDistance,
  isNeutral,
  readableTextOn,
} from '@/domain/color';

describe('hexForColorName', () => {
  it('resolves known colour names', () => {
    expect(hexForColorName('navy')).toBe('#1F3557');
    expect(hexForColorName('NAVY')).toBe('#1F3557');
  });

  it('falls back to the last recognisable word', () => {
    // The model often returns "washed denim" or "dark olive".
    expect(hexForColorName('washed denim')).toBe(hexForColorName('denim'));
    expect(hexForColorName('dark olive')).toBe(hexForColorName('olive'));
  });

  it('accepts a raw hex', () => {
    expect(hexForColorName('#ABC')).toBe('#aabbcc');
  });

  it('degrades to grey rather than throwing on nonsense', () => {
    expect(hexForColorName('zzzz')).toBe(hexForColorName('grey'));
  });
});

describe('hexToHsl', () => {
  it('reads pure red', () => {
    const { h, s, l } = hexToHsl('#ff0000');
    expect(h).toBe(0);
    expect(Math.round(s)).toBe(100);
    expect(Math.round(l)).toBe(50);
  });

  it('reports zero saturation for greys', () => {
    expect(Math.round(hexToHsl('#808080').s)).toBe(0);
  });
});

describe('hueDistance', () => {
  it('takes the shorter way round the wheel', () => {
    expect(hueDistance(10, 350)).toBe(20);
    expect(hueDistance(0, 180)).toBe(180);
  });
});

describe('isNeutral', () => {
  it.each(['black', 'white', 'grey', 'charcoal', 'beige', 'tan', 'navy'])(
    'treats %s as a neutral',
    (color) => {
      expect(isNeutral(hexForColorName(color))).toBe(true);
    },
  );

  it.each(['red', 'orange', 'green', 'purple'])('treats %s as an accent', (color) => {
    expect(isNeutral(hexForColorName(color))).toBe(false);
  });
});

describe('readableTextOn', () => {
  it('picks dark ink on light backgrounds and light ink on dark', () => {
    expect(readableTextOn('#ffffff')).toBe('#16161A');
    expect(readableTextOn('#000000')).toBe('#FFFFFF');
  });
});

describe('analyzeHarmony', () => {
  it('handles an empty outfit without throwing', () => {
    expect(analyzeHarmony([]).kind).toBe('neutral');
  });

  it('calls an all-neutral outfit neutral', () => {
    const report = analyzeHarmony(['#16161A', '#F7F5F2', '#9A9691'].map(String));
    expect(report.kind).toBe('neutral');
    expect(report.clashes).toHaveLength(0);
  });

  it('rewards a single accent anchored by neutrals', () => {
    const report = analyzeHarmony([
      hexForColorName('burgundy'),
      hexForColorName('black'),
      hexForColorName('white'),
    ]);
    expect(report.kind).toBe('neutral-anchored');
    expect(report.score).toBeGreaterThan(85);
  });

  it('identifies a complementary pairing', () => {
    // Blue against orange sits across the wheel.
    const report = analyzeHarmony(['#2166A8', '#D2762F']);
    expect(report.kind).toBe('complementary');
  });

  it('flags two saturated hues at an awkward middle distance', () => {
    // ~60 degrees apart and both vivid: the combination that reads accidental.
    const report = analyzeHarmony(['#c81e1e', '#c8a01e']);
    expect(report.clashes.length).toBeGreaterThan(0);
    expect(report.score).toBeLessThan(60);
  });

  it('penalises piling on more accent colours', () => {
    const two = analyzeHarmony(['#2166A8', '#16161A', '#F7F5F2']);
    const many = analyzeHarmony(['#2166A8', '#B23A31', '#4B7A50', '#6E5495']);
    expect(many.score).toBeLessThan(two.score);
  });
});
