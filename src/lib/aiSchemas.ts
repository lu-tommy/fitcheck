import { z } from 'zod';

import { CATEGORIES, FORMALITY_ORDER, PATTERNS, SEASONS, STYLES } from '@/domain/taxonomy';

/**
 * Shapes shared by the AI routes and their callers.
 *
 * The enums are built from the taxonomy so the model can only answer with
 * values the rest of the app already understands — a category it invented would
 * break filtering, slot assignment and the outfit engine at once.
 */

const nonEmpty = <T extends string>(values: readonly T[]) => values as [T, ...T[]];

export const categoryEnum = z.enum(nonEmpty(CATEGORIES.map((meta) => meta.category)));
export const patternEnum = z.enum(nonEmpty(PATTERNS));
export const formalityEnum = z.enum(nonEmpty(FORMALITY_ORDER));
export const seasonEnum = z.enum(nonEmpty(SEASONS));
export const styleEnum = z.enum(nonEmpty(STYLES));

export const taggedItemSchema = z.object({
  name: z.string().describe('Short, human name for the piece, e.g. "Navy merino crewneck"'),
  category: categoryEnum,
  primaryColor: z.string().describe('A common colour name, lowercase, e.g. "navy"'),
  secondaryColors: z.array(z.string()).describe('Other colours present, lowercase names'),
  pattern: patternEnum,
  material: z.string().describe('Best guess at the fabric, or an empty string'),
  brand: z.string().describe('Brand if a logo or label is legible, otherwise an empty string'),
  formality: formalityEnum,
  seasons: z.array(seasonEnum).describe('Seasons this piece is comfortable in'),
  styles: z.array(styleEnum).describe('Style families this piece belongs to'),
  confidence: z.number().describe('0 to 1, how sure you are overall'),
});

export type TaggedItem = z.infer<typeof taggedItemSchema>;

export const generatedOutfitSchema = z.object({
  name: z.string().describe('A short name for the outfit'),
  itemIds: z.array(z.string()).describe('Ids of the chosen pieces, from the closet you were given'),
  explanation: z.string().describe('Two or three sentences on why this works'),
  colorNotes: z.string().describe('One sentence on how the colours relate'),
  alternatives: z.array(
    z.object({
      slot: z.string(),
      itemId: z.string(),
      why: z.string(),
    }),
  ),
});

export const stylistReplySchema = z.object({
  answer: z.string().describe('The reply, in plain prose. No markdown headings.'),
  referencedItemIds: z.array(z.string()).describe('Closet ids you referred to'),
});

export const packingPlanSchema = z.object({
  summary: z.string(),
  itemIds: z.array(z.string()),
  dayPlans: z.array(
    z.object({
      day: z.number(),
      label: z.string(),
      itemIds: z.array(z.string()),
    }),
  ),
  notes: z.string().describe('Gaps in the wardrobe, or anything worth buying before the trip'),
});

export const wishlistSuggestionsSchema = z.object({
  suggestions: z.array(
    z.object({
      name: z.string(),
      category: categoryEnum,
      colorName: z.string(),
      reason: z.string().describe('Which existing pieces this would unlock, and how many outfits'),
    }),
  ),
});
