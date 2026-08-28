import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';

import { stylistReplySchema } from '@/lib/aiSchemas';
import { MODEL, anthropic, failed, isConfigured, notConfigured } from '@/server/anthropic';
import type { ClosetDigestItem } from '@/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

const SYSTEM = `You are a personal stylist answering questions about one specific
wardrobe, supplied below as JSON.

Ground every suggestion in pieces that are actually in the closet, and put their
ids in referencedItemIds. If the honest answer is "you do not own anything that
works for that", say it — and then say what the nearest workable option is.

Speak plainly and briefly. Two short paragraphs at most. No markdown headings,
no bullet lists, no emoji.`;

interface StylistBody {
  messages: { role: 'user' | 'assistant'; text: string }[];
  closet: ClosetDigestItem[];
  weatherSummary?: string;
}

export async function POST(request: Request) {
  if (!isConfigured()) return notConfigured();

  const body = (await request.json()) as StylistBody;
  if (!body.messages?.length) {
    return Response.json({ error: 'bad_request', message: 'No question' }, { status: 400 });
  }

  // The closet goes in the system prompt so it stays put across the thread and
  // can be cached; only the conversation itself varies per request.
  const system = [
    { type: 'text' as const, text: SYSTEM },
    {
      type: 'text' as const,
      text: `Closet (JSON):\n${JSON.stringify(body.closet)}${
        body.weatherSummary ? `\n\nToday's weather: ${body.weatherSummary}` : ''
      }`,
      cache_control: { type: 'ephemeral' as const },
    },
  ];

  try {
    const response = await anthropic().messages.parse({
      model: MODEL,
      max_tokens: 4000,
      system,
      thinking: { type: 'adaptive' },
      output_config: { format: zodOutputFormat(stylistReplySchema), effort: 'low' },
      messages: body.messages.map((message) => ({
        role: message.role,
        content: message.text,
      })),
    });

    if (!response.parsed_output) {
      return Response.json({ error: 'ai_failed', message: 'No reply returned' }, { status: 502 });
    }
    return Response.json(response.parsed_output);
  } catch (error) {
    return failed(error);
  }
}
