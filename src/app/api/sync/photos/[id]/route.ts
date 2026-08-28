import { currentUserId } from '@/server/session';
import { readPhoto, writePhoto } from '@/server/wardrobeStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Photos are downscaled to 1400px before upload; this is a runaway guard. */
const MAX_BYTES = 8 * 1024 * 1024;

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const userId = await currentUserId();
  if (!userId) return new Response('Unauthorised', { status: 401 });

  const { id } = await context.params;
  const bytes = await readPhoto(userId, id);
  if (!bytes) return new Response('Not found', { status: 404 });

  return new Response(new Uint8Array(bytes), {
    headers: {
      'content-type': 'image/jpeg',
      // Photos are immutable once written, so they can be cached hard.
      'cache-control': 'private, max-age=31536000, immutable',
    },
  });
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const userId = await currentUserId();
  if (!userId) return Response.json({ error: 'unauthorised' }, { status: 401 });

  const { id } = await context.params;
  const buffer = Buffer.from(await request.arrayBuffer());
  if (buffer.byteLength > MAX_BYTES) {
    return Response.json({ error: 'too_large' }, { status: 413 });
  }

  try {
    await writePhoto(userId, id, buffer);
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: 'write_failed', message: (error as Error).message }, { status: 400 });
  }
}
