import { isConfigured } from '@/server/anthropic';

export const runtime = 'nodejs';

/** The client asks once per session whether to bother calling the AI routes. */
export function GET() {
  return Response.json({ configured: isConfigured() });
}
