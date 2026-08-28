/**
 * Weather comes from Open-Meteo and place names from BigDataCloud. Both are
 * keyless and CORS-enabled, so the browser can call them directly and the app
 * has no server dependency for its forecast.
 */

import type { DailyForecast, Units, WeatherSnapshot } from '@/types';

const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const GEOCODE_URL = 'https://api.bigdatacloud.net/data/reverse-geocode-client';
const SEARCH_URL = 'https://geocoding-api.open-meteo.com/v1/search';

/** WMO weather interpretation codes, collapsed to what a person would say. */
export function describeWeatherCode(code: number): string {
  if (code === 0) return 'Clear';
  if (code <= 2) return 'Partly cloudy';
  if (code === 3) return 'Overcast';
  if (code <= 48) return 'Fog';
  if (code <= 57) return 'Drizzle';
  if (code <= 67) return 'Rain';
  if (code <= 77) return 'Snow';
  if (code <= 82) return 'Rain showers';
  if (code <= 86) return 'Snow showers';
  return 'Thunderstorm';
}

/** Coarse bucket used to pick an icon and to phrase outfit advice. */
export type WeatherKind = 'clear' | 'cloud' | 'rain' | 'snow' | 'storm' | 'fog';

export function weatherKind(code: number): WeatherKind {
  if (code === 0 || code === 1) return 'clear';
  if (code <= 3) return 'cloud';
  if (code <= 48) return 'fog';
  if (code <= 67 || (code >= 80 && code <= 82)) return 'rain';
  if (code <= 77 || (code >= 85 && code <= 86)) return 'snow';
  return 'storm';
}

interface OpenMeteoResponse {
  current?: {
    temperature_2m: number;
    apparent_temperature: number;
    weather_code: number;
    wind_speed_10m: number;
  };
  daily?: {
    time: string[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    weather_code: number[];
    precipitation_probability_max: (number | null)[];
  };
}

export async function fetchForecast(
  latitude: number,
  longitude: number,
  locationLabel: string,
  units: Units,
): Promise<WeatherSnapshot> {
  const params = new URLSearchParams({
    latitude: latitude.toFixed(4),
    longitude: longitude.toFixed(4),
    current: 'temperature_2m,apparent_temperature,weather_code,wind_speed_10m',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
    timezone: 'auto',
    forecast_days: '7',
  });

  const response = await fetch(`${FORECAST_URL}?${params}`);
  if (!response.ok) throw new Error(`Weather service returned ${response.status}`);
  const data = (await response.json()) as OpenMeteoResponse;
  if (!data.current || !data.daily) throw new Error('Weather service returned no forecast');

  const daily: DailyForecast[] = data.daily.time.map((date, index) => ({
    date,
    high: data.daily!.temperature_2m_max[index],
    low: data.daily!.temperature_2m_min[index],
    code: data.daily!.weather_code[index],
    condition: describeWeatherCode(data.daily!.weather_code[index]),
    precipitationChance: data.daily!.precipitation_probability_max[index] ?? 0,
  }));

  return {
    temperature: data.current.temperature_2m,
    feelsLike: data.current.apparent_temperature,
    high: daily[0]?.high ?? data.current.temperature_2m,
    low: daily[0]?.low ?? data.current.temperature_2m,
    code: data.current.weather_code,
    condition: describeWeatherCode(data.current.weather_code),
    precipitationChance: daily[0]?.precipitationChance ?? 0,
    windSpeed: data.current.wind_speed_10m,
    units,
    locationLabel,
    fetchedAt: new Date().toISOString(),
    daily,
  };
}

export async function reverseGeocode(latitude: number, longitude: number): Promise<string> {
  try {
    const params = new URLSearchParams({
      latitude: String(latitude),
      longitude: String(longitude),
      localityLanguage: 'en',
    });
    const response = await fetch(`${GEOCODE_URL}?${params}`);
    if (!response.ok) throw new Error(String(response.status));
    const data = (await response.json()) as { city?: string; locality?: string; countryName?: string };
    return data.city || data.locality || data.countryName || 'Your location';
  } catch {
    // A missing place name is cosmetic — the forecast itself still works.
    return 'Your location';
  }
}

export interface PlaceResult {
  name: string;
  label: string;
  latitude: number;
  longitude: number;
}

/** City search for Settings and for packing a trip to somewhere you are not. */
export async function searchPlaces(query: string): Promise<PlaceResult[]> {
  if (query.trim().length < 2) return [];
  const params = new URLSearchParams({ name: query.trim(), count: '6', language: 'en' });
  const response = await fetch(`${SEARCH_URL}?${params}`);
  if (!response.ok) return [];
  const data = (await response.json()) as {
    results?: { name: string; admin1?: string; country?: string; latitude: number; longitude: number }[];
  };
  return (data.results ?? []).map((result) => ({
    name: result.name,
    label: [result.name, result.admin1, result.country].filter(Boolean).join(', '),
    latitude: result.latitude,
    longitude: result.longitude,
  }));
}
