import { badRequest, readJson } from '@/server/request';
import { currentUserId } from '@/server/session';
import { removeSubscription } from '@/server/push';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const userId = await currentUserId();
  if (!userId) return Response.json({ error: 'unauthorised' }, { status: 401 });

  const body = await readJson<{ endpoint?: string }>(request);
  if (!body?.endpoint) return badRequest('No subscription was named.');
  const { endpoint } = body;

  await removeSubscription(userId, endpoint);
  return Response.json({ ok: true });
}
