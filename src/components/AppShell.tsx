'use client';

import { Home, Shirt, Sparkles, Layers, User } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';

import { cn } from '@/lib/cn';
import { registerServiceWorker, requestPersistence } from '@/lib/persistence';
import { Toaster } from '@/components/ui/Toaster';
import { useCloset } from '@/store/closet';
import { useOutfits } from '@/store/outfits';
import { usePlanner } from '@/store/planner';
import { usePreferences } from '@/store/preferences';
import { useStylist } from '@/store/stylist';
import { useWeather } from '@/store/weather';
import { useWishlist } from '@/store/wishlist';

const TABS = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/closet', label: 'Closet', icon: Shirt },
  { href: '/generate', label: 'Generate', icon: Sparkles, accent: true },
  { href: '/outfits', label: 'Outfits', icon: Layers },
  { href: '/profile', label: 'You', icon: User },
] as const;

/** Full-screen flows that own the whole viewport and hide the tab bar. */
const IMMERSIVE = ['/add'];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const immersive = IMMERSIVE.some((route) => pathname.startsWith(route));

  // One hydration pass for the whole app. Each store guards against a second
  // run, so mounting this once at the root is enough.
  useEffect(() => {
    // Ask the browser to stop treating the wardrobe as disposable. Silent when
    // granted, silent when refused — the Profile screen reports the outcome.
    void requestPersistence();
    registerServiceWorker();

    void usePreferences.getState().hydrate();
    void useCloset.getState().hydrate();
    void useOutfits.getState().hydrate();
    void usePlanner.getState().hydrate();
    void useWishlist.getState().hydrate();
    void useStylist.getState().hydrate();
    void useWeather.getState().hydrate();
  }, []);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col">
      <main
        className="flex-1"
        style={{
          paddingBottom: immersive
            ? 'env(safe-area-inset-bottom)'
            : 'calc(env(safe-area-inset-bottom) + 4.75rem)',
        }}
      >
        {children}
      </main>
      {immersive ? null : <TabBar pathname={pathname} />}
      <Toaster />
    </div>
  );
}

function TabBar({ pathname }: { pathname: string }) {
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-2xl border-t border-[var(--border)] bg-[var(--surface)]/92 backdrop-blur-xl"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="flex items-stretch">
        {TABS.map((tab) => {
          const active = tab.href === '/' ? pathname === '/' : pathname.startsWith(tab.href);
          const Icon = tab.icon;
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'pressable flex h-[4.25rem] flex-col items-center justify-center gap-1',
                  active ? 'text-[var(--brand)]' : 'text-[var(--text-faint)]',
                )}
              >
                <span
                  className={cn(
                    'grid place-items-center rounded-full transition-colors',
                    'accent' in tab && tab.accent
                      ? cn(
                          'size-9 -mt-1',
                          active
                            ? 'bg-[var(--brand)] text-[var(--on-brand)]'
                            : 'bg-[var(--surface-alt)] text-[var(--text-muted)]',
                        )
                      : 'size-6',
                  )}
                >
                  <Icon size={'accent' in tab && tab.accent ? 19 : 22} strokeWidth={active ? 2.2 : 1.8} />
                </span>
                <span className="text-[0.6875rem] font-medium">{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
