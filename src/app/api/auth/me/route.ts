import { currentUserId } from '@/server/session';
import { accountsConfigured, accounts } from '@/server/users';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Who is signed in, and whether accounts exist at all. */
export async function GET() {
  const configured = accountsConfigured();
  const userId = await currentUserId();
  const account = accounts().find((entry) => entry.id === userId);

  return Response.json({
    configured,
    userId: account ? account.id : null,
    username: account ? account.username : null,
  });
}
