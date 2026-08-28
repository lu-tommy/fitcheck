import { currentUserId } from '@/server/session';
import { removeSubscription } from '@/server/push';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const userId = await currentUserId();
  if (!userId) return Response.json({ error: 'unauthorised' }, { status: 401 });

  const { endpoint } = (await request.json()) as { endpoint?: string };
  if (!endpoint) return Response.json({ error: 'bad_request' }, { status: 400 });

  await removeSubscription(userId, endpoint);
  return Response.json({ ok: true });
}
