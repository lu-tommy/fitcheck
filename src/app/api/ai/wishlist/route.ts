import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';

import { wishlistSuggestionsSchema } from '@/lib/aiSchemas';
import { MODEL, anthropic, failed, isConfigured, notConfigured } from '@/server/anthropic';
import type { ClosetDigestItem } from '@/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

const SYSTEM = `You find the gaps in a wardrobe.

Suggest at most four pieces, each one chosen because it multiplies what the
person already owns — name the existing items it would combine with. Prefer a
versatile neutral over a statement piece. Do not suggest something they already
have in a similar colour and category. No brands, no prices, no links.`;

interface WishlistBody {
  closet: ClosetDigestItem[];
  goal?: string;
}

export async function POST(request: Request) {
  if (!isConfigured()) return notConfigured();

  const body = (await request.json()) as WishlistBody;
  if (!body.closet?.length) {
    return Response.json({ error: 'bad_request', message: 'Empty closet' }, { status: 400 });
  }

  try {
    const response = await anthropic().messages.parse({
      model: MODEL,
      max_tokens: 4000,
      system: SYSTEM,
      thinking: { type: 'adaptive' },
      output_config: { format: zodOutputFormat(wishlistSuggestionsSchema), effort: 'low' },
      messages: [
        {
          role: 'user',
          content:
            (body.goal ? `They want to be able to: ${body.goal}\n\n` : '') +
            `Closet (JSON):\n${JSON.stringify(body.closet)}`,
        },
      ],
    });

    if (!response.parsed_output) {
      return Response.json(
        { error: 'ai_failed', message: 'No suggestions returned' },
        { status: 502 },
      );
    }
    return Response.json(response.parsed_output);
  } catch (error) {
    return failed(error);
  }
}
