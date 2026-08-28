'use client';

import { create } from 'zustand';

import { createId } from '@/lib/id';

export interface Toast {
  id: string;
  message: string;
  tone: 'neutral' | 'success' | 'danger';
  action?: { label: string; run: () => void };
}

interface ToastState {
  toasts: Toast[];
  show: (message: string, options?: Partial<Omit<Toast, 'id' | 'message'>>) => void;
  dismiss: (id: string) => void;
}

export const useToasts = create<ToastState>((set) => ({
  toasts: [],
  show: (message, options) => {
    const toast: Toast = { id: createId('toast'), message, tone: 'neutral', ...options };
    set((state) => ({ toasts: [...state.toasts, toast] }));
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((entry) => entry.id !== toast.id) }));
    }, toast.action ? 6000 : 3200);
  },
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),
}));

/** Convenience so callers do not have to reach into the store. */
export const toast = (message: string, options?: Parameters<ToastState['show']>[1]) =>
  useToasts.getState().show(message, options);
