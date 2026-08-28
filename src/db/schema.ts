import type { DBSchema } from 'idb';

import type {
  CalendarEntry,
  ClothingItem,
  Outfit,
  PackingList,
  Preferences,
  StylistMessage,
  SyncState,
  Tombstone,
  WearLog,
  WeatherSnapshot,
  WishlistItem,
} from '@/types';

/** A photo blob. Kept out of the item record so lists never deserialise images. */
export interface StoredPhoto {
  id: string;
  blob: Blob;
  width: number;
  height: number;
  createdAt: string;
}

/**
 * `meta` is the small-and-singular store: preferences, the cached forecast, the
 * stylist thread. Everything with a real identity gets its own store.
 */
export interface MetaRecord {
  key: 'preferences' | 'weather' | 'stylist' | 'sync';
  value: unknown;
}

export interface OutfitAIDB extends DBSchema {
  items: {
    key: string;
    value: ClothingItem;
    indexes: { createdAt: string; category: string };
  };
  outfits: {
    key: string;
    value: Outfit;
    indexes: { createdAt: string };
  };
  wearLogs: {
    key: string;
    value: WearLog;
    indexes: { date: string };
  };
  calendar: {
    key: string;
    value: CalendarEntry;
    indexes: { date: string };
  };
  packing: {
    key: string;
    value: PackingList;
    indexes: { createdAt: string };
  };
  wishlist: {
    key: string;
    value: WishlistItem;
    indexes: { createdAt: string };
  };
  photos: {
    key: string;
    value: StoredPhoto;
  };
  deletions: {
    key: string;
    value: Tombstone;
    indexes: { deletedAt: string };
  };
  meta: {
    key: MetaRecord['key'];
    value: MetaRecord;
  };
}

export type MetaShapes = {
  preferences: Preferences;
  weather: WeatherSnapshot;
  stylist: StylistMessage[];
  sync: SyncState;
};
