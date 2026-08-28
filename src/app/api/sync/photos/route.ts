import { currentUserId } from '@/server/session';
import { listPhotos } from '@/server/wardrobeStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const userId = await currentUserId();
  if (!userId) return Response.json({ error: 'unauthorised' }, { status: 401 });
  return Response.json({ ids: await listPhotos(userId) });
}
