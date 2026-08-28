'use client';

import { useEffect, useState } from 'react';

import { photoUrl } from '@/db';

/**
 * Photos live in IndexedDB as blobs, so a src is resolved asynchronously and
 * cached by id. Returns null until it is ready, and while the id is undefined.
 */
export function usePhotoUrl(id: string | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!id) {
      setUrl(null);
      return;
    }
    void photoUrl(id).then((resolved) => {
      if (!cancelled) setUrl(resolved);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  return url;
}

/** True once the component has mounted in the browser. */
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

/** Debounce a value — used by the closet search field. */
export function useDebounced<T>(value: T, delay = 200): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}
