'use client';

import { db, readAll, readMeta, writeMeta } from '@/db';
import type { StoredPhoto } from '@/db/schema';
import type {
  CalendarEntry,
  ClothingItem,
  Outfit,
  PackingList,
  Preferences,
  WearLog,
  WishlistItem,
} from '@/types';

/**
 * Export and import.
 *
 * Everything lives in this browser, so a backup file is the only way the data
 * survives a cleared cache or moves to another device. Photos go in as base64,
 * which makes the file large but makes it a real backup rather than a list of
 * names pointing at pictures that are gone.
 */

const FORMAT = 'outfitai-backup';
const VERSION = 1;

export interface Backup {
  format: typeof FORMAT;
  version: number;
  exportedAt: string;
  items: ClothingItem[];
  outfits: Outfit[];
  wearLogs: WearLog[];
  calendar: CalendarEntry[];
  packing: PackingList[];
  wishlist: WishlistItem[];
  preferences?: Preferences;
  photos: { id: string; width: number; height: number; type: string; data: string }[];
}

export async function exportBackup(): Promise<Blob> {
  const database = await db();
  const [items, outfits, wearLogs, calendar, packing, wishlist, storedPhotos] = await Promise.all([
    readAll('items'),
    readAll('outfits'),
    readAll('wearLogs'),
    readAll('calendar'),
    readAll('packing'),
    readAll('wishlist'),
    database.getAll('photos'),
  ]);

  const photos = await Promise.all(
    storedPhotos.map(async (photo) => ({
      id: photo.id,
      width: photo.width,
      height: photo.height,
      type: photo.blob.type || 'image/jpeg',
      data: await blobToBase64(photo.blob),
    })),
  );

  const backup: Backup = {
    format: FORMAT,
    version: VERSION,
    exportedAt: new Date().toISOString(),
    items,
    outfits,
    wearLogs,
    calendar,
    packing,
    wishlist,
    preferences: await readMeta('preferences'),
    photos,
  };

  return new Blob([JSON.stringify(backup)], { type: 'application/json' });
}

export interface ImportSummary {
  items: number;
  outfits: number;
  photos: number;
}

/** Merges into what is already there; ids collide only if the same backup is imported twice. */
export async function importBackup(file: File): Promise<ImportSummary> {
  const parsed = JSON.parse(await file.text()) as Backup;
  if (parsed.format !== FORMAT) {
    throw new Error('That file is not an OutfitAI backup.');
  }
  if (parsed.version > VERSION) {
    throw new Error('That backup was made by a newer version of OutfitAI.');
  }

  const database = await db();
  const tx = database.transaction(
    ['items', 'outfits', 'wearLogs', 'calendar', 'packing', 'wishlist', 'photos'],
    'readwrite',
  );

  parsed.items?.forEach((item) => tx.objectStore('items').put(item));
  parsed.outfits?.forEach((outfit) => tx.objectStore('outfits').put(outfit));
  parsed.wearLogs?.forEach((log) => tx.objectStore('wearLogs').put(log));
  parsed.calendar?.forEach((entry) => tx.objectStore('calendar').put(entry));
  parsed.packing?.forEach((list) => tx.objectStore('packing').put(list));
  parsed.wishlist?.forEach((wish) => tx.objectStore('wishlist').put(wish));

  (parsed.photos ?? []).forEach((photo) => {
    const stored: StoredPhoto = {
      id: photo.id,
      blob: base64ToBlob(photo.data, photo.type),
      width: photo.width,
      height: photo.height,
      createdAt: parsed.exportedAt,
    };
    tx.objectStore('photos').put(stored);
  });

  await tx.done;

  if (parsed.preferences) await writeMeta('preferences', parsed.preferences);

  return {
    items: parsed.items?.length ?? 0,
    outfits: parsed.outfits?.length ?? 0,
    photos: parsed.photos?.length ?? 0,
  };
}

async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

function base64ToBlob(data: string, type: string): Blob {
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type });
}

/**
 * Export, download, and record that it happened — one call, because a backup
 * the app cannot see is a backup it cannot remind you about.
 */
export async function runBackup(): Promise<string> {
  const blob = await exportBackup();
  const stamp = new Date().toISOString();
  downloadBlob(blob, `outfitai-${stamp.slice(0, 10)}.json`);
  return stamp;
}

/** How overdue a backup is. `null` means there has never been one. */
export function daysSinceBackup(lastBackupAt: string | undefined): number | null {
  if (!lastBackupAt) return null;
  return Math.floor((Date.now() - new Date(lastBackupAt).getTime()) / 86_400_000);
}

export const BACKUP_STALE_DAYS = 14;

/** Trigger a download of a blob under a given filename. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Revoke on the next tick so the download has already started.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
