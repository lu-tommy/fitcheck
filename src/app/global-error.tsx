'use client';

import { useEffect } from 'react';

import './globals.css';

/**
 * The last line of defence: a crash in the root layout itself, where none of
 * the app's own components are available. Deliberately dependency-free.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[outfitai] root layout crashed:', error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          minHeight: '100dvh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1rem',
          padding: '1.5rem',
          textAlign: 'center',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <h1 style={{ fontSize: '1.3rem', fontWeight: 600, margin: 0 }}>OutfitAI could not start</h1>
        <p style={{ maxWidth: '24rem', lineHeight: 1.6, margin: 0, opacity: 0.75 }}>
          Your wardrobe is still stored in this browser and has not been touched. Reloading usually
          fixes this.
        </p>
        <button
          type="button"
          onClick={reset}
          style={{
            padding: '0.7rem 1.2rem',
            borderRadius: '1rem',
            border: 0,
            background: '#c8553d',
            color: '#fff',
            fontSize: '0.95rem',
            fontWeight: 500,
          }}
        >
          Reload
        </button>
      </body>
    </html>
  );
}
