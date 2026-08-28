import { currentUserId } from '@/server/session';
import { publicKey, pushConfigured, saveSubscription } from '@/server/push';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** The public key the browser needs before it can subscribe. */
export async function GET() {
  return Response.json({ configured: pushConfigured(), publicKey: publicKey() });
}

export async function POST(request: Request) {
  const userId = await currentUserId();
  if (!userId) return Response.json({ error: 'unauthorised' }, { status: 401 });
  if (!pushConfigured()) {
    return Response.json(
      { error: 'not_configured', message: 'Reminders are not set up on this server.' },
      { status: 503 },
    );
  }

  const body = (await request.json()) as {
    subscription?: PushSubscriptionJSON;
    timeZone?: string;
    hour?: number;
    minute?: number;
  };

  if (!body.subscription?.endpoint) {
    return Response.json({ error: 'bad_request' }, { status: 400 });
  }

  await saveSubscription(userId, {
    subscription: body.subscription as never,
    timeZone: body.timeZone || 'UTC',
    hour: Math.min(23, Math.max(0, Math.round(body.hour ?? 7))),
    minute: Math.min(59, Math.max(0, Math.round(body.minute ?? 30))),
  });

  return Response.json({ ok: true });
}
