import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';

import { generatedOutfitSchema } from '@/lib/aiSchemas';
import { MODEL, anthropic, failed, isConfigured, notConfigured } from '@/server/anthropic';
import type { ClosetDigestItem, OutfitRequest, WeatherSnapshot } from '@/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

const SYSTEM = `You are a stylist who works only with the wardrobe you are given.

Absolute rule: every itemId you return must appear in the closet list. Never
invent a piece, never suggest buying anything, never describe a garment that is
not there. If the closet cannot cover the occasion, say so plainly in the
explanation and return the best available combination anyway.

Build a complete, wearable outfit: a top and a bottom (or one full-body piece),
shoes, and layers only when the temperature calls for them. At most two
accessories. Do not put two pieces in the same slot.

Write the explanation the way a friend would — what the outfit does, why these
colours sit together, and one thing to watch. No bullet points, no headings.`;

interface OutfitRequestBody {
  request: OutfitRequest;
  closet: ClosetDigestItem[];
  weather?: WeatherSnapshot | null;
  avoidColors?: string[];
  preferredStyles?: string[];
}

export async function POST(request: Request) {
  if (!isConfigured()) return notConfigured();

  const body = (await request.json()) as OutfitRequestBody;
  if (!body.closet?.length) {
    return Response.json({ error: 'bad_request', message: 'Empty closet' }, { status: 400 });
  }

  const constraints: string[] = [];
  if (body.request.occasion) constraints.push(`Occasion: ${body.request.occasion}`);
  if (body.request.formality) constraints.push(`Formality: ${body.request.formality}`);
  if (body.request.colorPreference) constraints.push(`Colour wish: ${body.request.colorPreference}`);
  if (body.request.style) constraints.push(`Preferred style: ${body.request.style}`);
  if (body.preferredStyles?.length) {
    constraints.push(`Usually wears: ${body.preferredStyles.join(', ')}`);
  }
  if (body.avoidColors?.length) constraints.push(`Avoids: ${body.avoidColors.join(', ')}`);
  if (body.request.includeItemIds.length) {
    constraints.push(`Must include these ids: ${body.request.includeItemIds.join(', ')}`);
  }
  if (body.request.excludeItemIds.length) {
    constraints.push(`Must not use these ids: ${body.request.excludeItemIds.join(', ')}`);
  }
  if (body.request.cleanOnly) constraints.push('Only clean items were sent — use anything listed.');
  if (body.weather) {
    constraints.push(
      `Weather: ${Math.round(body.weather.temperature)}°C, feels like ` +
        `${Math.round(body.weather.feelsLike)}°C, ${body.weather.condition}, ` +
        `${body.weather.precipitationChance}% chance of rain, high ` +
        `${Math.round(body.weather.high)}°C / low ${Math.round(body.weather.low)}°C.`,
    );
  } else if (typeof body.request.temperature === 'number') {
    constraints.push(`Temperature: ${body.request.temperature}°C`);
  }

  try {
    const response = await anthropic().messages.parse({
      model: MODEL,
      max_tokens: 8000,
      system: SYSTEM,
      thinking: { type: 'adaptive' },
      output_config: { format: zodOutputFormat(generatedOutfitSchema), effort: 'medium' },
      messages: [
        {
          role: 'user',
          content: [
            `What they said: ${body.request.prompt || 'Pick something good for today.'}`,
            constraints.length ? `\nConstraints:\n${constraints.join('\n')}` : '',
            `\nThe closet (JSON):\n${JSON.stringify(body.closet)}`,
          ].join('\n'),
        },
      ],
    });

    if (!response.parsed_output) {
      return Response.json({ error: 'ai_failed', message: 'No outfit returned' }, { status: 502 });
    }
    return Response.json(response.parsed_output);
  } catch (error) {
    return failed(error);
  }
}
