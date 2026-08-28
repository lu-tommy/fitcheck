import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';

import { taggedItemSchema } from '@/lib/aiSchemas';
import { MODEL, anthropic, failed, isConfigured, notConfigured } from '@/server/anthropic';

export const runtime = 'nodejs';
export const maxDuration = 60;

const SYSTEM = `You tag photographs of individual clothing items for a wardrobe app.

Describe only the garment, never the person, background or hanger. Colour names
must be ordinary words a shopper would use — "navy", "olive", "cream" — not
paint-chart names. If a detail is not visible, do not invent it: leave material
and brand empty rather than guessing. Formality is where the piece sits on its
own, not what it could be styled into.`;

interface TagRequestBody {
  /** Raw base64, no data: prefix. */
  imageBase64?: string;
  mediaType?: 'image/jpeg' | 'image/png' | 'image/webp';
  hint?: string;
}

export async function POST(request: Request) {
  if (!isConfigured()) return notConfigured();

  const body = (await request.json()) as TagRequestBody;
  if (!body.imageBase64) {
    return Response.json({ error: 'bad_request', message: 'No image supplied' }, { status: 400 });
  }

  try {
    const response = await anthropic().messages.parse({
      model: MODEL,
      max_tokens: 4000,
      system: SYSTEM,
      thinking: { type: 'adaptive' },
      output_config: { format: zodOutputFormat(taggedItemSchema), effort: 'low' },
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: body.mediaType ?? 'image/jpeg',
                data: body.imageBase64,
              },
            },
            {
              type: 'text',
              text: body.hint
                ? `Tag this clothing item. The owner adds: ${body.hint}`
                : 'Tag this clothing item.',
            },
          ],
        },
      ],
    });

    if (!response.parsed_output) {
      return Response.json({ error: 'ai_failed', message: 'No tags returned' }, { status: 502 });
    }
    return Response.json(response.parsed_output);
  } catch (error) {
    return failed(error);
  }
}
