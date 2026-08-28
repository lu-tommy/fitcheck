import type { SyncedStore, Tombstone } from '@/types';

/**
 * Deciding what wins.
 *
 * Sync is where data gets lost, and it gets lost in a handful of specific ways:
 * a delete on one device that the other device pushes back; an edit overwritten
 * by an older copy; a record recreated after deletion and then deleted again by
 * the tombstone that killed the original.
 *
 * All of that is decided here, in pure functions over plain objects, so every
 * case can be written down as a test rather than discovered on someone's phone.
 *
 * The rule is one line: for each id, the newest fact wins — where a deletion is
 * a fact with a timestamp, exactly like an edit.
 */

export interface SyncRecord {
  id: string;
  updatedAt: string;
}

export type Resolution<T> =
  | { action: 'write-local'; record: T }
  | { action: 'delete-local'; id: string }
  | { action: 'push'; record: T }
  | { action: 'push-tombstone'; tombstone: Tombstone }
  | { action: 'none' };

export interface MergePlan<T> {
  /** Remote records that should replace or create the local copy. */
  writeLocal: T[];
  /** Local records to remove because a newer deletion won. */
  deleteLocal: string[];
  /** Local records the server has not got, or has an older copy of. */
  push: T[];
  /** Deletions the server has not been told about. */
  pushTombstones: Tombstone[];
  /** Remote deletions to record locally so this device stops pushing them back. */
  adoptTombstones: Tombstone[];
}

interface Sides<T> {
  local?: T;
  remote?: T;
  localTombstone?: Tombstone;
  remoteTombstone?: Tombstone;
}

/** Later of two ISO stamps; `undefined` sorts before everything. */
function newest(...stamps: (string | undefined)[]): string | undefined {
  return stamps.filter(Boolean).sort().at(-1);
}

/**
 * Resolve one id.
 *
 * Ties go to the remote copy. Two writes in the same millisecond on two devices
 * is close enough to impossible that the tie-break only matters for the case
 * where the same record round-trips unchanged, and preferring remote there
 * makes the operation idempotent.
 */
export function resolveOne<T extends SyncRecord>(sides: Sides<T>): Resolution<T>[] {
  const { local, remote, localTombstone, remoteTombstone } = sides;

  const deletedAt = newest(localTombstone?.deletedAt, remoteTombstone?.deletedAt);
  const winner = newest(local?.updatedAt, remote?.updatedAt, deletedAt);
  if (!winner) return [{ action: 'none' }];

  // A deletion is the newest fact: the record goes, and both sides must know.
  if (deletedAt === winner) {
    const tombstone = (localTombstone?.deletedAt === deletedAt ? localTombstone : remoteTombstone)!;
    const out: Resolution<T>[] = [];
    if (local) out.push({ action: 'delete-local', id: local.id });
    if (!remoteTombstone) out.push({ action: 'push-tombstone', tombstone });
    else if (!localTombstone) out.push({ action: 'none' });
    return out.length ? out : [{ action: 'none' }];
  }

  if (remote && remote.updatedAt === winner) {
    // Identical stamps and both sides present means nothing to do.
    if (local && local.updatedAt === remote.updatedAt) return [{ action: 'none' }];
    return [{ action: 'write-local', record: remote }];
  }

  if (local) return [{ action: 'push', record: local }];
  return [{ action: 'none' }];
}

/**
 * Merge one collection.
 *
 * `remoteTombstones` are the deletions the server knows about; `localTombstones`
 * are the ones this device recorded. Both are keyed by record id.
 */
export function mergeCollection<T extends SyncRecord>(input: {
  store: SyncedStore;
  local: T[];
  remote: T[];
  localTombstones: Tombstone[];
  remoteTombstones: Tombstone[];
}): MergePlan<T> {
  const localById = new Map(input.local.map((record) => [record.id, record]));
  const remoteById = new Map(input.remote.map((record) => [record.id, record]));
  const localTombById = new Map(
    input.localTombstones.filter((t) => t.store === input.store).map((t) => [t.recordId, t]),
  );
  const remoteTombById = new Map(
    input.remoteTombstones.filter((t) => t.store === input.store).map((t) => [t.recordId, t]),
  );

  const ids = new Set([
    ...localById.keys(),
    ...remoteById.keys(),
    ...localTombById.keys(),
    ...remoteTombById.keys(),
  ]);

  const plan: MergePlan<T> = {
    writeLocal: [],
    deleteLocal: [],
    push: [],
    pushTombstones: [],
    adoptTombstones: [],
  };

  ids.forEach((id) => {
    const localTombstone = localTombById.get(id);
    const remoteTombstone = remoteTombById.get(id);

    resolveOne<T>({
      local: localById.get(id),
      remote: remoteById.get(id),
      localTombstone,
      remoteTombstone,
    }).forEach((resolution) => {
      switch (resolution.action) {
        case 'write-local':
          plan.writeLocal.push(resolution.record);
          break;
        case 'delete-local':
          plan.deleteLocal.push(resolution.id);
          break;
        case 'push':
          plan.push.push(resolution.record);
          break;
        case 'push-tombstone':
          plan.pushTombstones.push(resolution.tombstone);
          break;
        default:
          break;
      }
    });

    // A remote deletion this device has not recorded must be adopted, or the
    // next run treats the record as merely missing and pushes it back.
    if (remoteTombstone && !localTombstone) plan.adoptTombstones.push(remoteTombstone);
  });

  return plan;
}

/**
 * Which photos need moving.
 *
 * Photos are content-addressed and never edited, so there are no conflicts —
 * only presence. Anything an item refers to must exist on both sides.
 */
export function planPhotoSync(input: {
  referencedIds: string[];
  localIds: string[];
  remoteIds: string[];
}): { upload: string[]; download: string[] } {
  const referenced = new Set(input.referencedIds.filter(Boolean));
  const local = new Set(input.localIds);
  const remote = new Set(input.remoteIds);

  return {
    upload: [...referenced].filter((id) => local.has(id) && !remote.has(id)),
    download: [...referenced].filter((id) => !local.has(id) && remote.has(id)),
  };
}

/** Photo ids no item refers to any more — safe to delete once nothing needs them. */
export function orphanedPhotoIds(referencedIds: string[], localIds: string[]): string[] {
  const referenced = new Set(referencedIds.filter(Boolean));
  return localIds.filter((id) => !referenced.has(id));
}
