import { currentUserId } from '@/server/session';
import { pull } from '@/server/wardrobeStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const userId = await currentUserId();
  if (!userId) return Response.json({ error: 'unauthorised' }, { status: 401 });

  const since = Number(new URL(request.url).searchParams.get('since') ?? 0);
  try {
    const page = await pull(userId, Number.isFinite(since) ? since : 0);
    // The client uses this to confirm it is syncing the account it thinks it is.
    return Response.json({ userId, ...page });
  } catch (error) {
    return Response.json({ error: 'read_failed', message: (error as Error).message }, { status: 500 });
  }
}
