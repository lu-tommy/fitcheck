import type { ClothingItem, SignalKind, StyleSignal, WearLog } from '@/types';

import { categoryLabel } from './taxonomy';

/**
 * What the app has worked out about the person using it.
 *
 * Every wardrobe app claims to learn your style and almost none of them can
 * tell you what they learned, because the answer is a vector. This one is a
 * tally: a handful of things somebody did, weighted, decayed, and turned into
 * sentences they can read, disagree with, and delete.
 *
 * That constraint is the point rather than a limitation. The whole promise of
 * this app is that its reasoning can be argued with — an engine of rules rather
 * than a model — and a preference system that cannot explain itself would be
 * the one place that promise quietly stopped being true. So nothing here is
 * allowed to influence an outfit unless it can also be said out loud on the
 * "what it has learned" screen, and unset by one tap.
 *
 * Two more rules it holds to:
 *
 * - **It never states an opinion it cannot evidence.** An observation needs a
 *   minimum number of occasions before it is offered at all, and it always
 *   shows the count it is based on. "You have put this back four times out of
 *   five" is a fact; "you don't like olive" is a guess wearing a fact's coat.
 * - **It suggests, and never acts.** Nothing is archived, hidden or added to
 *   the avoid list on the app's own initiative. The affinity nudge below is
 *   small on purpose — comparable to marking something a favourite, nowhere
 *   near enough to override the weather or the occasion.
 */

/**
 * What each kind of signal is worth.
 *
 * A swap is a direct comparison — you were shown one garment for that slot and
 * walked to another — which makes it worth more than a wear, where the alternatives
 * were never on screen. Passing is weighted a little under choosing because it
 * has more innocent explanations: it is in the wash tomorrow, it is the wrong
 * colour for the meeting, it needs an iron.
 */
const WEIGHT: Record<SignalKind, number> = {
  chosen: 1,
  passed: -0.8,
  worn: 0.6,
};

/**
 * How long a signal keeps its full meaning, in days.
 *
 * Taste moves. Something worn to death last winter should not still be
 * outvoting this month, and a jacket somebody has come back around to should be
 * able to climb back. Sixty days puts a season's worth of evidence at half
 * strength, which is roughly how long it takes to change your mind about a coat.
 */
const HALF_LIFE_DAYS = 60;

/** Below this many occasions, the app has an anecdote rather than a pattern. */
const MIN_EVIDENCE = 4;

/** How hard affinity is allowed to push the outfit engine. See the note above. */
export const AFFINITY_WEIGHT = 25;

export interface Taste {
  /** Item id → −1 (put back every time) to 1 (reached for every time). */
  affinity: Map<string, number>;
  /** What it would say out loud, strongest first. */
  observations: Observation[];
  /** How many signals it is working from at all — the honest confidence line. */
  evidence: number;
}

export type ObservationKind = 'avoided' | 'favoured' | 'colour' | 'pairing';

export interface Observation {
  /** Stable across recomputes, so a dismissal survives the wording improving. */
  key: string;
  kind: ObservationKind;
  /** The claim, in the words somebody would use. */
  headline: string;
  /** The evidence it rests on. Always a count, never an adjective. */
  detail: string;
  itemIds: string[];
  /** What it offers to do. Always optional, and never done automatically. */
  action?: ObservationAction;
}

export type ObservationAction =
  | { kind: 'archive'; itemId: string; label: string }
  | { kind: 'favourite'; itemId: string; label: string }
  | { kind: 'avoid-colour'; colour: string; label: string };

export function readTaste(
  signals: StyleSignal[],
  items: ClothingItem[],
  wearLogs: WearLog[],
  today: string,
  dismissed: string[] = [],
): Taste {
  const byId = new Map(items.map((item) => [item.id, item]));
  const live = signals.filter((signal) => byId.has(signal.itemId));

  /** Decayed totals per item, plus the raw counts an observation has to cite. */
  const tally = new Map<string, Tally>();
  live.forEach((signal) => {
    const entry =
      tally.get(signal.itemId) ?? { score: 0, chosen: 0, passed: 0, worn: 0 };
    entry.score += WEIGHT[signal.kind] * decay(signal.date, today);
    entry[signal.kind] += 1;
    tally.set(signal.itemId, entry);
  });

  const affinity = new Map<string, number>();
  tally.forEach((entry, id) => {
    // tanh keeps a run of ten passes from being ten times an opinion, which is
    // what stops one bad fortnight burying a garment for good.
    affinity.set(id, Math.tanh(entry.score / 3));
  });

  const observations = [
    ...avoided(tally, byId),
    ...favoured(tally, byId),
    ...colours(tally, byId),
    ...pairings(wearLogs, byId),
  ]
    .filter((observation) => !dismissed.includes(observation.key))
    .sort((a, b) => rank(b) - rank(a));

  return { affinity, observations, evidence: live.length };
}

interface Tally {
  score: number;
  chosen: number;
  passed: number;
  worn: number;
}

/** Recent evidence counts for more than old evidence. Nothing ever hits zero. */
function decay(date: string, today: string): number {
  const days = Math.max(0, daysBetween(date, today));
  return 0.5 ** (days / HALF_LIFE_DAYS);
}

function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00`);
  const b = Date.parse(`${to}T00:00:00`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / 86_400_000);
}

/* ---------------------------------------------------------- observations -- */

/**
 * The piece the app keeps offering and the wearer keeps putting back.
 *
 * This is the one that earns the whole feature. Everybody owns one, nobody
 * enjoys admitting it, and the wardrobe is the only thing in the house holding
 * the receipts.
 */
function avoided(tally: Map<string, Tally>, byId: Map<string, ClothingItem>): Observation[] {
  const out: Observation[] = [];
  tally.forEach((entry, id) => {
    const item = byId.get(id);
    if (!item || item.archived) return;
    const offered = entry.passed + entry.chosen + entry.worn;
    if (offered < MIN_EVIDENCE) return;
    if (entry.passed / offered < 0.7) return;

    out.push({
      key: `avoided:${id}`,
      kind: 'avoided',
      headline: `You keep putting the ${item.name.toLowerCase()} back.`,
      detail: `Offered ${offered} times, and swapped away from ${entry.passed} of them.`,
      itemIds: [id],
      action: { kind: 'archive', itemId: id, label: 'Archive it' },
    });
  });
  return out;
}

/** The one that gets reached for. Worth naming, and worth marking. */
function favoured(tally: Map<string, Tally>, byId: Map<string, ClothingItem>): Observation[] {
  const out: Observation[] = [];
  tally.forEach((entry, id) => {
    const item = byId.get(id);
    if (!item || item.archived) return;
    const total = entry.passed + entry.chosen + entry.worn;
    const kept = entry.chosen + entry.worn;
    if (total < MIN_EVIDENCE || kept < 3) return;
    if (kept / total < 0.75) return;

    out.push({
      key: `favoured:${id}`,
      kind: 'favoured',
      headline: `The ${item.name.toLowerCase()} is your reach-for.`,
      detail:
        entry.chosen > 0
          ? `Chosen over something else ${entry.chosen} times, and worn ${entry.worn}.`
          : `Worn ${entry.worn} times and never swapped out.`,
      itemIds: [id],
      action: item.favorite
        ? undefined
        : { kind: 'favourite', itemId: id, label: 'Mark it a favourite' },
    });
  });
  return out;
}

/**
 * A colour that gets put back whatever it is attached to.
 *
 * Needs two different garments before it will say anything: one avoided orange
 * shirt is a fact about a shirt, and calling it a fact about orange is exactly
 * the sort of overreach that makes people stop believing an app.
 */
function colours(tally: Map<string, Tally>, byId: Map<string, ClothingItem>): Observation[] {
  const byColour = new Map<string, { items: Set<string>; passed: number; kept: number }>();

  tally.forEach((entry, id) => {
    const item = byId.get(id);
    if (!item || item.archived) return;
    const colour = item.primaryColor.toLowerCase();
    const bucket = byColour.get(colour) ?? { items: new Set<string>(), passed: 0, kept: 0 };
    bucket.items.add(id);
    bucket.passed += entry.passed;
    bucket.kept += entry.chosen + entry.worn;
    byColour.set(colour, bucket);
  });

  const out: Observation[] = [];
  byColour.forEach((bucket, colour) => {
    const total = bucket.passed + bucket.kept;
    if (bucket.items.size < 2 || total < MIN_EVIDENCE + 2) return;
    if (bucket.passed / total < 0.75) return;

    out.push({
      key: `colour:${colour}`,
      kind: 'colour',
      headline: `Anything ${colour} goes back on the rail.`,
      detail: `${bucket.passed} of ${total} times, across ${bucket.items.size} different pieces.`,
      itemIds: [...bucket.items],
      action: { kind: 'avoid-colour', colour, label: `Stop suggesting ${colour}` },
    });
  });
  return out;
}

/**
 * Two pieces that keep turning up together.
 *
 * Read from the wear log rather than from signals, because this is about what
 * was actually worn out of the house and not about what was tapped. It is the
 * one observation that tells somebody something nice rather than something
 * corrective, which matters more than it sounds on a screen full of critique.
 */
function pairings(wearLogs: WearLog[], byId: Map<string, ClothingItem>): Observation[] {
  const together = new Map<string, number>();

  wearLogs.forEach((log) => {
    const ids = [...new Set(log.itemIds)].filter((id) => byId.has(id)).sort();
    for (let i = 0; i < ids.length; i += 1) {
      for (let j = i + 1; j < ids.length; j += 1) {
        const key = `${ids[i]}|${ids[j]}`;
        together.set(key, (together.get(key) ?? 0) + 1);
      }
    }
  });

  const best = [...together.entries()]
    .filter(([, count]) => count >= 3)
    .sort((a, b) => b[1] - a[1])[0];
  if (!best) return [];

  const [key, count] = best;
  const [a, b] = key.split('|').map((id) => byId.get(id)!);
  // Two shoes in the same log is a data artefact, not a pairing.
  if (!a || !b) return [];

  return [
    {
      key: `pairing:${key}`,
      kind: 'pairing',
      headline: `The ${a.name.toLowerCase()} and the ${b.name.toLowerCase()} are a pair.`,
      detail: `Worn together ${count} times — more than any other two things you own.`,
      itemIds: [a.id, b.id],
    },
  ];
}

/** Corrective observations first: those are the ones with something to do. */
function rank(observation: Observation): number {
  const order: Record<ObservationKind, number> = {
    avoided: 3,
    colour: 2,
    favoured: 1,
    pairing: 0,
  };
  return order[observation.kind];
}

/** A one-line summary of what it is working from, for the top of the screen. */
export function describeEvidence(taste: Taste, items: ClothingItem[]): string {
  if (taste.evidence === 0) {
    return 'Nothing yet. Swap a piece on the Outfit of the Day, or log what you wore, and this fills in.';
  }
  const strongest = [...taste.affinity.entries()].sort((a, b) => b[1] - a[1])[0];
  const item = strongest ? items.find((entry) => entry.id === strongest[0]) : undefined;
  const kinds = new Set(items.map((entry) => categoryLabel(entry.category)));
  return item
    ? `${taste.evidence} decisions so far, across ${kinds.size} kinds of garment.`
    : `${taste.evidence} decisions so far.`;
}
