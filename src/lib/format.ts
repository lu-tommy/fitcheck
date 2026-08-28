import type { Units } from '@/types';

export function titleCase(value: string): string {
  return value
    .split(/[\s-_]+/)
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(' ');
}

export function formatTemperature(celsius: number, units: Units): string {
  const value = units === 'imperial' ? celsius * (9 / 5) + 32 : celsius;
  return `${Math.round(value)}°`;
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
