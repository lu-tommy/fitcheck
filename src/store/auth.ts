'use client';

import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth';
import { create } from 'zustand';

import { auth, describeAuthError, firebaseReady } from '@/sync/firebase';

export type AuthStatus = 'unconfigured' | 'loading' | 'signed-out' | 'signed-in';

interface AuthState {
  status: AuthStatus;
  userId: string | null;
  email: string | null;
  error: string | null;
  busy: boolean;
  watch: () => void;
  signIn: (email: string, password: string) => Promise<boolean>;
  register: (email: string, password: string) => Promise<boolean>;
  resetPassword: (email: string) => Promise<boolean>;
  leave: () => Promise<void>;
  clearError: () => void;
}

let watching = false;

export const useAuth = create<AuthState>((set, get) => ({
  status: firebaseReady() ? 'loading' : 'unconfigured',
  userId: null,
  email: null,
  error: null,
  busy: false,

  /** Subscribe once; Firebase restores the session from its own storage. */
  watch: () => {
    if (watching || !firebaseReady()) return;
    watching = true;
    onAuthStateChanged(auth(), (user: User | null) => {
      set({
        status: user ? 'signed-in' : 'signed-out',
        userId: user?.uid ?? null,
        email: user?.email ?? null,
      });
    });
  },

  signIn: async (email, password) => {
    if (!firebaseReady()) return false;
    set({ busy: true, error: null });
    try {
      await signInWithEmailAndPassword(auth(), email.trim(), password);
      set({ busy: false });
      return true;
    } catch (error) {
      set({ busy: false, error: describeAuthError(error) });
      return false;
    }
  },

  register: async (email, password) => {
    if (!firebaseReady()) return false;
    set({ busy: true, error: null });
    try {
      await createUserWithEmailAndPassword(auth(), email.trim(), password);
      set({ busy: false });
      return true;
    } catch (error) {
      set({ busy: false, error: describeAuthError(error) });
      return false;
    }
  },

  resetPassword: async (email) => {
    if (!firebaseReady()) return false;
    set({ busy: true, error: null });
    try {
      await sendPasswordResetEmail(auth(), email.trim());
      set({ busy: false });
      return true;
    } catch (error) {
      set({ busy: false, error: describeAuthError(error) });
      return false;
    }
  },

  /**
   * Signing out never touches the local wardrobe. Deleting someone's clothes
   * because they logged out would be indefensible, and the data is still theirs
   * — it is on their device.
   */
  leave: async () => {
    if (!firebaseReady()) return;
    await signOut(auth());
    set({ status: 'signed-out', userId: null, email: null, error: null });
  },

  clearError: () => set({ error: null }),
}));
