import type { IDBPDatabase, IDBPTransaction, StoreNames } from 'idb';

import type { OutfitAIDB } from './schema';

/**
 * Schema migrations.
 *
 * Every version is a step that must run in order and must be safe to run
 * against real data. An app that stores everything on the user's device has no
 * second chance here: a migration that throws leaves the database wedged at the
 * old version and the app unable to open it, which to the person holding the
 * phone is indistinguishable from losing everything.
 *
 * So: steps are small, additive, and never destructive. Adding a field means
 * backfilling it; removing one means leaving it in place and ignoring it.
 */

export interface Migration {
  version: number;
  describe: string;
  run: (
    database: IDBPDatabase<OutfitAIDB>,
    transaction: IDBPTransaction<OutfitAIDB, StoreNames<OutfitAIDB>[], 'versionchange'>,
  ) => void | Promise<void>;
}

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    describe: 'the original stores',
    run(database) {
      const items = database.createObjectStore('items', { keyPath: 'id' });
      items.createIndex('createdAt', 'createdAt');
      items.createIndex('category', 'category');

      const outfits = database.createObjectStore('outfits', { keyPath: 'id' });
      outfits.createIndex('createdAt', 'createdAt');

      const wearLogs = database.createObjectStore('wearLogs', { keyPath: 'id' });
      wearLogs.createIndex('date', 'date');

      const calendar = database.createObjectStore('calendar', { keyPath: 'id' });
      calendar.createIndex('date', 'date');

      const packing = database.createObjectStore('packing', { keyPath: 'id' });
      packing.createIndex('createdAt', 'createdAt');

      const wishlist = database.createObjectStore('wishlist', { keyPath: 'id' });
      wishlist.createIndex('createdAt', 'createdAt');

      database.createObjectStore('photos', { keyPath: 'id' });
      database.createObjectStore('meta', { keyPath: 'key' });
    },
  },
  {
    version: 2,
    describe: 'tombstones, and an updatedAt on every record',
    async run(database, transaction) {
      if (!database.objectStoreNames.contains('deletions')) {
        const deletions = database.createObjectStore('deletions', { keyPath: 'id' });
        deletions.createIndex('deletedAt', 'deletedAt');
      }

      // Records written before sync existed carry only a creation stamp.
      // Seeding updatedAt from it makes every one of them eligible to push
      // without pretending they changed just now.
      const stores = ['wearLogs', 'calendar', 'packing', 'wishlist'] as const;
      for (const name of stores) {
        const store = transaction.objectStore(name);
        let cursor = await store.openCursor();
        while (cursor) {
          const record = cursor.value as { createdAt?: string; updatedAt?: string };
          if (!record.updatedAt) {
            await cursor.update({
              ...record,
              updatedAt: record.createdAt ?? new Date(0).toISOString(),
            } as never);
          }
          cursor = await cursor.continue();
        }
      }
    },
  },
];

/** The version the code expects. Derived, so it can never drift from the list. */
export const DB_VERSION = MIGRATIONS.reduce(
  (highest, migration) => Math.max(highest, migration.version),
  0,
);

export async function runMigrations(
  database: IDBPDatabase<OutfitAIDB>,
  transaction: IDBPTransaction<OutfitAIDB, StoreNames<OutfitAIDB>[], 'versionchange'>,
  fromVersion: number,
): Promise<void> {
  const pending = MIGRATIONS.filter((migration) => migration.version > fromVersion).sort(
    (a, b) => a.version - b.version,
  );

  for (const migration of pending) {
    try {
      await migration.run(database, transaction);
    } catch (error) {
      // Surface which step failed; a silent upgrade failure is the worst
      // possible outcome because the app just stops opening.
      throw new Error(
        `Database migration to v${migration.version} (${migration.describe}) failed: ${
          (error as Error).message
        }`,
      );
    }
  }
}
