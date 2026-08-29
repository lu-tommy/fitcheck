import type { MetadataRoute } from 'next';

/**
 * Installable as a home-screen app, which is the point of building the web
 * version first: on a phone it opens without browser chrome and behaves like
 * the native app this is a rehearsal for.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'OutfitAI',
    short_name: 'OutfitAI',
    description: 'Build outfits from the clothes you already own.',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f4f4f2',
    theme_color: '#1f4a3d',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
