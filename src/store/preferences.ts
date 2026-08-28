'use client';

import { create } from 'zustand';

import { readMeta, writeMeta } from '@/db';
import type { Preferences, ThemeMode } from '@/types';

export const DEFAULT_PREFERENCES: Preferences = {
  themeMode: 'system',
  units: 'metric',
  preferredStyles: [],
  avoidColors: [],
  dailySuggestion: { enabled: false, hour: 7, minute: 30 },
  backgroundRemoval: 'local',
};

/**
 * The theme is mirrored into localStorage as well as IndexedDB. IndexedDB is
 * async, so only a synchronous store can be read by the blocking script in
 * <head> that stamps the theme before first paint.
 */
export const THEME_STORAGE_KEY = 'outfitai:theme';

interface PreferencesState {
  preferences: Preferences;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  update: (patch: Partial<Preferences>) => Promise<void>;
  setTheme: (mode: ThemeMode) => Promise<void>;
}

export function applyTheme(mode: ThemeMode): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (mode === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', mode);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch {
    // Private windows can refuse storage; the theme still applies for this visit.
  }
}

export const usePreferences = create<PreferencesState>((set, get) => ({
  preferences: DEFAULT_PREFERENCES,
  hydrated: false,

  hydrate: async () => {
    if (get().hydrated) return;
    const stored = await readMeta('preferences');
    const preferences = { ...DEFAULT_PREFERENCES, ...stored };
    applyTheme(preferences.themeMode);
    set({ preferences, hydrated: true });
  },

  update: async (patch) => {
    const preferences = { ...get().preferences, ...patch };
    set({ preferences });
    await writeMeta('preferences', preferences);
  },

  setTheme: async (mode) => {
    applyTheme(mode);
    await get().update({ themeMode: mode });
  },
}));
