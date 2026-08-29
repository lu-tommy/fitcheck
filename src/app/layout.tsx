import type { Metadata, Viewport } from 'next';
import { Fraunces, Instrument_Sans } from 'next/font/google';

import { AppShell } from '@/components/AppShell';
import { LEGACY_THEME_STORAGE_KEY, THEME_STORAGE_KEY } from '@/store/preferences';

import './globals.css';

/*
 * Fraunces is variable on three axes. opsz is the one that matters — at a
 * headline size the default text optical size looks blunt — and a little SOFT
 * and WONK is what stops it reading as yet another elegant fashion serif.
 */
const display = Fraunces({
  variable: '--font-display-stack',
  subsets: ['latin'],
  axes: ['SOFT', 'WONK', 'opsz'],
  display: 'swap',
});
const sans = Instrument_Sans({
  variable: '--font-sans-stack',
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'FitCheck',
  description: 'Digitise your wardrobe and build outfits from the clothes you already own.',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'FitCheck', statusBarStyle: 'default' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f4f4f2' },
    { media: '(prefers-color-scheme: dark)', color: '#101211' },
  ],
};

/**
 * The theme is stamped by a blocking script before first paint. Preferences
 * live in IndexedDB, which is async — reading them in an effect would show one
 * light frame to every dark-mode user.
 */
const THEME_SCRIPT = `(function(){try{var m=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)})||localStorage.getItem(${JSON.stringify(
  LEGACY_THEME_STORAGE_KEY,
)});if(m==='dark'||m==='light'){document.documentElement.setAttribute('data-theme',m);}}catch(e){}})();`;

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={`${sans.variable} ${display.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-full">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
