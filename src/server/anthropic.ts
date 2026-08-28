import Anthropic from '@anthropic-ai/sdk';

/**
 * The key lives on the server and never reaches the browser. Every AI route
 * goes through here, and every one of them has a rule-based counterpart on the
 * client, so an unconfigured deployment is a working deployment.
 */

export const MODEL = 'claude-opus-5';

export function isConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

let client: Anthropic | null = null;

export function anthropic(): Anthropic {
  if (!client) client = new Anthropic();
  return client;
}

/** Uniform 501 so the client knows to fall back rather than show an error. */
export function notConfigured(): Response {
  return Response.json(
    {
      error: 'not_configured',
      message:
        'No ANTHROPIC_API_KEY is set on the server, so this feature is using the built-in engine instead.',
    },
    { status: 501 },
  );
}

export function failed(error: unknown): Response {
  const message = error instanceof Error ? error.message : 'Unknown error';
  console.error('[outfitai] AI request failed:', message);
  return Response.json({ error: 'ai_failed', message }, { status: 502 });
}
