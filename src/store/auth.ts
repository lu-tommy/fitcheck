'use client';

import { create } from 'zustand';

export type AuthStatus = 'loading' | 'unconfigured' | 'signed-out' | 'signed-in';

/**
 * Who is signed in.
 *
 * The session itself is an httpOnly cookie the browser holds and page scripts
 * cannot read, so this only mirrors what the server says. The last known
 * identity is cached so a reload with no connection still shows the app signed
 * in rather than throwing someone out because the NAS was asleep.
 */

const CACHE_KEY = 'fitcheck:account';

interface Cached {
  userId: string;
  username: string;
}

function readCache(): Cached | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as Cached) : null;
  } catch {
    return null;
  }
}

function writeCache(value: Cached | null): void {
  try {
    if (value) localStorage.setItem(CACHE_KEY, JSON.stringify(value));
    else localStorage.removeItem(CACHE_KEY);
  } catch {
    // Private windows refuse storage; the session cookie still works.
  }
}

interface AuthState {
  status: AuthStatus;
  userId: string | null;
  username: string | null;
  /**
   * True once the server has confirmed who is signed in. The cached identity
   * gets the UI on screen instantly, but it can be stale — a different person
   * may have signed in since — so nothing that writes data acts on it.
   */
  confirmed: boolean;
  error: string | null;
  busy: boolean;
  watch: () => void;
  signIn: (username: string, password: string) => Promise<boolean>;
  leave: () => Promise<void>;
  clearError: () => void;
}

let checked = false;

export const useAuth = create<AuthState>((set) => ({
  status: 'loading',
  userId: null,
  username: null,
  confirmed: false,
  error: null,
  busy: false,

  watch: () => {
    if (checked) return;
    checked = true;

    const cached = readCache();
    if (cached) set({ status: 'signed-in', userId: cached.userId, username: cached.username });

    void fetch('/api/auth/me', { credentials: 'same-origin' })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { configured: boolean; userId: string | null; username: string | null } | null) => {
        if (!data) return;
        if (!data.configured) {
          set({ status: 'unconfigured', userId: null, username: null, confirmed: false });
          writeCache(null);
          return;
        }
        if (data.userId && data.username) {
          writeCache({ userId: data.userId, username: data.username });
          set({
            status: 'signed-in',
            userId: data.userId,
            username: data.username,
            confirmed: true,
          });
        } else {
          writeCache(null);
          set({ status: 'signed-out', userId: null, username: null, confirmed: false });
        }
      })
      .catch(() => {
        // Offline. Keep whatever the cache said rather than signing someone out
        // because their NAS was unreachable for a moment.
        // Offline. Keep showing the cached identity, but leave it unconfirmed
        // so nothing writes to an account we have not verified.
        if (!cached) set({ status: 'signed-out', confirmed: false });
      });
  },

  signIn: async (username, password) => {
    set({ busy: true, error: null });
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = (await response.json()) as {
        userId?: string;
        username?: string;
        message?: string;
      };

      if (!response.ok || !data.userId || !data.username) {
        set({ busy: false, error: data.message ?? 'Could not sign in.' });
        return false;
      }

      writeCache({ userId: data.userId, username: data.username });
      // A fresh sign-in is as authoritative as the /me check.
      set({
        busy: false,
        status: 'signed-in',
        userId: data.userId,
        username: data.username,
        confirmed: true,
        error: null,
      });
      return true;
    } catch {
      set({ busy: false, error: 'Could not reach the server. Check the connection and retry.' });
      return false;
    }
  },

  /** Signing out never touches the wardrobe on this device. */
  leave: async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' }).catch(
      () => undefined,
    );
    writeCache(null);
    set({ status: 'signed-out', userId: null, username: null, confirmed: false, error: null });
  },

  clearError: () => set({ error: null }),
}));
