import type { Units } from '@/types';

export function titleCase(value: string): string {
  return value
    .split(/[\s-_]+/)
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(' ');
}

export function formatTemperature(celsius: number, units: Units): string {
  return `${Math.round(toDisplayTemperature(celsius, units))}°`;
}

/** Everything is stored in Celsius; only the display ever changes. */
export function toDisplayTemperature(celsius: number, units: Units): number {
  return units === 'imperial' ? celsius * (9 / 5) + 32 : celsius;
}

/** With the unit spelled out — for prose, where a bare degree sign is ambiguous. */
export function formatTemperatureLong(celsius: number, units: Units): string {
  return `${Math.round(toDisplayTemperature(celsius, units))}${temperatureUnitLabel(units)}`;
}

/** A low-to-high range, with the unit named once. */
export function formatTemperatureRange(low: number, high: number, units: Units): string {
  return `${Math.round(toDisplayTemperature(low, units))}–${formatTemperatureLong(high, units)}`;
}

export function temperatureUnitLabel(units: Units): string {
  return units === 'imperial' ? '°F' : '°C';
}

export function pluralize(count: number, singular: string, plural?: string): string {
  return `${count} ${count === 1 ? singular : plural ?? `${singular}s`}`;
}

export function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 1).trimEnd()}…`;
}
