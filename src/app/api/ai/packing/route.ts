import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';

import { packingPlanSchema } from '@/lib/aiSchemas';
import { MODEL, anthropic, failed, isConfigured, notConfigured } from '@/server/anthropic';
import type { ClosetDigestItem, PackingRequest } from '@/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

const SYSTEM = `You pack a suitcase from one specific wardrobe, supplied as JSON.

Every itemId must come from that list. Pack light: bottoms and shoes should be
re-worn across several days, tops should not repeat two days running. One outer
layer unless the weather demands two. Give every day a plan.

If something obvious is missing for the destination — no rain layer, no shoes
that suit the activities — say so in notes.`;

interface PackingBody {
  request: PackingRequest;
  closet: ClosetDigestItem[];
}

export async function POST(request: Request) {
  if (!isConfigured()) return notConfigured();

  const body = (await request.json()) as PackingBody;
  if (!body.closet?.length) {
    return Response.json({ error: 'bad_request', message: 'Empty closet' }, { status: 400 });
  }

  const { destination, days, activities, weatherSummary } = body.request;

  try {
    const response = await anthropic().messages.parse({
      model: MODEL,
      max_tokens: 8000,
      system: SYSTEM,
      thinking: { type: 'adaptive' },
      output_config: { format: zodOutputFormat(packingPlanSchema), effort: 'medium' },
      messages: [
        {
          role: 'user',
          content:
            `Trip: ${days} ${days === 1 ? 'day' : 'days'} in ${destination}.\n` +
            `Activities: ${activities.length ? activities.join(', ') : 'unspecified'}.\n` +
            `Weather: ${weatherSummary || 'unknown'}.\n\n` +
            `Closet (JSON):\n${JSON.stringify(body.closet)}`,
        },
      ],
    });

    if (!response.parsed_output) {
      return Response.json({ error: 'ai_failed', message: 'No plan returned' }, { status: 502 });
    }
    return Response.json(response.parsed_output);
  } catch (error) {
    return failed(error);
  }
}
