import { badRequest, readJson } from '@/server/request';
import { currentUserId } from '@/server/session';
import { push } from '@/server/wardrobeStore';
import type { SyncedStore, Tombstone } from '@/types';

export const runtime = 'nodejs';

interface Body {
  records?: { store: SyncedStore; data: Record<string, unknown> }[];
  tombstones?: Tombstone[];
}

export async function POST(request: Request) {
  const userId = await currentUserId();
  if (!userId) return Response.json({ error: 'unauthorised' }, { status: 401 });

  const body = await readJson<Body>(request);
  if (!body) return badRequest();
  try {
    return Response.json(await push(userId, body));
  } catch (error) {
    return Response.json({ error: 'write_failed', message: (error as Error).message }, { status: 500 });
  }
}
