/**
 * Reading a request body without trusting it.
 *
 * These routes face the open internet, where a malformed body is not an edge
 * case but a matter of time — a scanner, a bot, a half-written client. Letting
 * JSON.parse throw turns that into a 500 and an unhandled exception in the log
 * for every one of them.
 */
export async function readJson<T>(request: Request): Promise<T | null> {
  try {
    const body = await request.json();
    return body && typeof body === 'object' ? (body as T) : null;
  } catch {
    return null;
  }
}

export function badRequest(message = 'That request could not be read.'): Response {
  return Response.json({ error: 'bad_request', message }, { status: 400 });
}
