import { cookies } from 'next/headers';

import { clearedCookie } from '@/server/session';

export const runtime = 'nodejs';

export async function POST() {
  (await cookies()).set(clearedCookie());
  return Response.json({ ok: true });
}
