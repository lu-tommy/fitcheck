'use client';

import { create } from 'zustand';

import { readMeta, writeMeta } from '@/db';
import { fetchForecast, reverseGeocode } from '@/lib/weather';
import type { WeatherSnapshot } from '@/types';

import { usePreferences } from './preferences';

type Status = 'idle' | 'locating' | 'loading' | 'ready' | 'denied' | 'error';

interface WeatherState {
  snapshot: WeatherSnapshot | null;
  status: Status;
  error?: string;
  hydrate: () => Promise<void>;
  /** Ask the browser for a location, then fetch. Safe to call repeatedly. */
  refresh: (options?: { force?: boolean }) => Promise<void>;
  setManualLocation: (latitude: number, longitude: number, label: string) => Promise<void>;
}

const STALE_AFTER_MS = 30 * 60 * 1000;

export const useWeather = create<WeatherState>((set, get) => ({
  snapshot: null,
  status: 'idle',

  hydrate: async () => {
    const cached = await readMeta('weather');
    if (cached) set({ snapshot: cached, status: 'ready' });
  },

  refresh: async (options) => {
    const { snapshot, status } = get();
    if (status === 'loading' || status === 'locating') return;
    const fresh =
      snapshot && Date.now() - new Date(snapshot.fetchedAt).getTime() < STALE_AFTER_MS;
    if (fresh && !options?.force) return;

    const remembered = usePreferences.getState().preferences.lastLocation;
    let coords = remembered
      ? { latitude: remembered.latitude, longitude: remembered.longitude, label: remembered.label }
      : null;

    if (!coords || options?.force) {
      set({ status: 'locating' });
      const located = await requestPosition();
      if (located) {
        const label = await reverseGeocode(located.latitude, located.longitude);
        coords = { ...located, label };
        await usePreferences.getState().update({ lastLocation: coords });
      } else if (!coords) {
        set({ status: 'denied' });
        return;
      }
    }

    set({ status: 'loading' });
    try {
      const units = usePreferences.getState().preferences.units;
      const next = await fetchForecast(coords.latitude, coords.longitude, coords.label, units);
      await writeMeta('weather', next);
      set({ snapshot: next, status: 'ready', error: undefined });
    } catch (error) {
      set({ status: 'error', error: (error as Error).message });
    }
  },

  setManualLocation: async (latitude, longitude, label) => {
    await usePreferences.getState().update({ lastLocation: { latitude, longitude, label } });
    set({ status: 'idle' });
    await get().refresh({ force: false });
  },
}));

function requestPosition(): Promise<{ latitude: number; longitude: number } | null> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return Promise.resolve(null);
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        }),
      () => resolve(null),
      { timeout: 8000, maximumAge: 10 * 60 * 1000 },
    );
  });
}
