import { buildOutfitLocally } from '@/domain/outfitEngine';
import {
  formatTemperature,
  formatTemperatureLong,
  formatTemperatureRange,
  toDisplayTemperature,
} from '@/lib/format';

import { basicCloset } from './factories';

/**
 * Temperature is stored in Celsius everywhere and converted only for display.
 * These exist because the app once told a Fahrenheit user it was 18 degrees.
 */
describe('temperature display', () => {
  it('converts for display without touching what is stored', () => {
    expect(toDisplayTemperature(0, 'imperial')).toBe(32);
    expect(toDisplayTemperature(100, 'imperial')).toBe(212);
    expect(toDisplayTemperature(18, 'metric')).toBe(18);
  });

  it('names the unit in prose', () => {
    expect(formatTemperatureLong(18, 'metric')).toBe('18°C');
    expect(formatTemperatureLong(18, 'imperial')).toBe('64°F');
  });

  it('leaves the unit off where a column of numbers makes it obvious', () => {
    expect(formatTemperature(18, 'imperial')).toBe('64°');
  });

  it('names the unit once in a range', () => {
    expect(formatTemperatureRange(10, 20, 'imperial')).toBe('50–68°F');
    expect(formatTemperatureRange(10, 20, 'metric')).toBe('10–20°C');
  });
});

describe('the outfit engine speaks the reader’s units', () => {
  const build = (units: 'metric' | 'imperial') =>
    buildOutfitLocally({
      request: {
        prompt: 'Something for today',
        temperature: 18,
        includeItemIds: [],
        excludeItemIds: [],
        cleanOnly: true,
      },
      closet: basicCloset(),
      units,
    });

  it('writes Fahrenheit for a Fahrenheit reader', () => {
    const explanation = build('imperial').explanation;
    expect(explanation).toContain('64°F');
    expect(explanation).not.toContain('°C');
  });

  it('writes Celsius by default', () => {
    expect(build('metric').explanation).toContain('18°C');
  });

  it('picks the same clothes either way — only the words change', () => {
    expect(build('imperial').itemIds).toEqual(build('metric').itemIds);
  });
});
