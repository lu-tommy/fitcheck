import type { Metadata, Viewport } from 'next';
import { Geist } from 'next/font/google';

import { AppShell } from '@/components/AppShell';
import { THEME_STORAGE_KEY } from '@/store/preferences';

import './globals.css';

const sans = Geist({ variable: '--font-sans-stack', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'OutfitAI',
  description: 'Digitise your wardrobe and build outfits from the clothes you already own.',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'OutfitAI', statusBarStyle: 'default' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#faf8f5' },
    { media: '(prefers-color-scheme: dark)', color: '#131211' },
  ],
};

/**
 * The theme is stamped by a blocking script before first paint. Preferences
 * live in IndexedDB, which is async — reading them in an effect would show one
 * light frame to every dark-mode user.
 */
const THEME_SCRIPT = `(function(){try{var m=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)});if(m==='dark'||m==='light'){document.documentElement.setAttribute('data-theme',m);}}catch(e){}})();`;

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={`${sans.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-full">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
