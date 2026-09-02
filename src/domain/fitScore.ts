import type { ClothingItem, Slot } from '@/types';

import { hexForColorName, hexToHsl, hueDistance, isNeutral } from './color';
import {
  VISUAL_AREA,
  accessoryFocalWeight,
  categoryLabel,
  formalityScore,
  hasMetal,
  slotOf,
} from './taxonomy';

/**
 * Whether an outfit is any good, and why.
 *
 * The engine could already tell whether an outfit was VALID — right slots,
 * warm enough, pitched at the right formality, made only of things you own.
 * None of that is the question a person is asking in front of a mirror. They
 * are asking whether it works, and the things that decide it are proportion,
 * texture, pattern scale, focal points and whether there is a third piece —
 * none of which the app had any way to see.
 *
 * Seven rules, then. Each one returns a credit, a deduction, or an admission
 * that it could not tell — and every one of them names itself in plain words,
 * because a score nobody can interrogate is a gimmick and a score that says why
 * is a stylist. Nothing here guesses: a rule with missing data says what would
 * let it answer instead of scoring the outfit against an assumption.
 */

export type FitRule =
  | 'anchor'
  | 'volume'
  | 'waistline'
  | 'pattern'
  | 'third-piece'
  | 'matchy'
  | 'metals'
  | 'register';

export interface ScoreNote {
  rule: FitRule;
  /** What the app says out loud. One sentence, no jargon. */
  note: string;
  /** Positive for a credit, negative for a deduction. Never zero. */
  points: number;
  /** The pieces it is about, so a screen can point at them. */
  itemIds: string[];
}

export interface Unjudged {
  rule: FitRule;
  /** What would let it answer — phrased as something the reader can go and do. */
  because: string;
}

export interface FitScore {
  /** 0–100. */
  score: number;
  /** One line, and the only place this app gets to be funny once a day. */
  verdict: string;
  credits: ScoreNote[];
  deductions: ScoreNote[];
  unjudged: Unjudged[];
}

/**
 * Where an outfit starts before anything is judged.
 *
 * Deliberately middling. A wardrobe with nothing filled in should land near
 * here and be told the questions it could not answer — not be marked down for
 * facts nobody has supplied, and not be flattered either.
 */
const BASE = 60;

/** The slots that set the register, and that the proportion rules read. */
const UPPER: Slot[] = ['outerwear', 'midlayer', 'top'];
const REGISTER: Slot[] = ['top', 'bottom', 'fullbody'];

/** Fits that read as volume rather than as a line. */
const VOLUME = new Set(['relaxed', 'oversized']);

export function scoreOutfit(items: ClothingItem[]): FitScore {
  const notes: ScoreNote[] = [];
  const unjudged: Unjudged[] = [];

  const add = (note: ScoreNote | null) => {
    if (note) notes.push(note);
  };
  const cannot = (rule: FitRule, because: string) => unjudged.push({ rule, because });

  add(anchor(items));
  add(volume(items, cannot));
  add(waistline(items, cannot));
  add(pattern(items, cannot));
  add(thirdPiece(items));
  add(matchy(items));
  add(metals(items, cannot));
  add(register(items));

  const total = notes.reduce((sum, note) => sum + note.points, BASE);
  const score = Math.max(0, Math.min(100, Math.round(total)));

  return {
    score,
    verdict: verdictFor(score),
    credits: notes.filter((note) => note.points > 0),
    deductions: notes.filter((note) => note.points < 0),
    unjudged,
  };
}

/* ------------------------------------------------------------- 1. anchor -- */

/**
 * 60/30/10 is a rule about AREA, so it is judged on area.
 *
 * Harmony was counted one garment one vote, which lets a scarf argue with a
 * coat on equal terms and calls an outfit "two-thirds accent" when the accent
 * is a pair of socks.
 */
function anchor(items: ClothingItem[]): ScoreNote | null {
  if (items.length < 2) return null;

  const accents = items.filter((item) => !isNeutral(hexOf(item)));
  const totalArea = items.reduce((sum, item) => sum + areaOf(item), 0);
  if (!totalArea) return null;

  const accentShare = accents.reduce((sum, item) => sum + areaOf(item), 0) / totalArea;
  const families = hueFamilies(accents);
  const ids = accents.map((item) => item.id);

  if (families >= 3) {
    return {
      rule: 'anchor',
      points: -14,
      itemIds: ids,
      // Deduped, because "purple, yellow, burgundy and yellow" is what it said
      // before, and a sentence that repeats itself reads as a machine talking.
      note: `${list([...new Set(accents.map(colourWord))])} are all fighting for the same job. Let one of them be the colour and put the rest back.`,
    };
  }

  if (families === 0) {
    return {
      rule: 'anchor',
      points: 6,
      itemIds: items.map((item) => item.id),
      note: 'All neutrals. Quiet, and very hard to get wrong.',
    };
  }

  const led = accents.slice().sort((a, b) => areaOf(b) - areaOf(a))[0];

  /*
   * One colour over most of the outfit is tonal dressing, which is a structure
   * rather than a mistake — this rule used to mark it down as "too much
   * saturated colour", and green trousers under a green jacket is not a clash.
   * Two colours over most of it is where the eye stops knowing where to go.
   */
  if (families === 1) {
    return {
      rule: 'anchor',
      points: 12,
      itemIds: ids,
      note:
        accentShare > 0.45
          ? `Tonal — ${colourWord(led)} nearly all the way through, which always reads deliberate.`
          : `Neutral-anchored, with the ${led.name.toLowerCase()} carrying the colour.`,
    };
  }

  if (accentShare > 0.45) {
    return {
      rule: 'anchor',
      points: -8,
      itemIds: ids,
      note: `${capitalise(colourWord(led))} and ${colourWord(
        accents.find((item) => item.id !== led.id) ?? led,
      )} are both covering a lot of ground, with nothing neutral to hold them down. One of the big pieces wants to be quieter.`,
    };
  }

  return {
    rule: 'anchor',
    points: 8,
    itemIds: ids,
    note: 'Neutrals doing the work with two colours on top. About the limit, and it holds.',
  };
}

/* ------------------------------------------------------------- 2. volume -- */

/** Volume against volume reads as pyjamas; fitted against fitted as a costume. */
function volume(items: ClothingItem[], cannot: Cannot): ScoreNote | null {
  const lower = items.find((item) => slotOf(item.category) === 'bottom');
  const upper = firstBySlot(items, UPPER);
  // A dress has one volume, so there is nothing here to balance.
  if (!lower || !upper) return null;

  if (!upper.fit || !lower.fit) {
    const missing = [upper, lower].filter((item) => !item.fit);
    cannot(
      'volume',
      `Say how the ${list(missing.map((item) => item.name.toLowerCase()))} ${
        missing.length === 1 ? 'fits' : 'fit'
      } and the proportions can be judged.`,
    );
    return null;
  }

  const ids = [upper.id, lower.id];
  const loose = VOLUME.has(upper.fit) && VOLUME.has(lower.fit);
  const tight = upper.fit === 'fitted' && lower.fit === 'fitted';

  if (loose) {
    return {
      rule: 'volume',
      points: -10,
      itemIds: ids,
      note: 'Loose on top and loose below, so the whole shape goes soft. Something fitted at one end is all it needs.',
    };
  }
  if (tight) {
    return {
      rule: 'volume',
      points: -8,
      itemIds: ids,
      note: 'Fitted top to toe. It reads more like a costume than an outfit — let one end breathe.',
    };
  }
  if (VOLUME.has(upper.fit) !== VOLUME.has(lower.fit)) {
    return {
      rule: 'volume',
      points: 10,
      itemIds: ids,
      note: 'Volume against something fitted, which is the balance stylists reach for first.',
    };
  }
  return null;
}

/* ---------------------------------------------------------- 3. waistline -- */

/**
 * Cutting the body in half shortens the whole silhouette. Roughly a third to
 * two-thirds — via a tuck, a crop, or a high rise — is what makes the same two
 * garments look considered.
 */
function waistline(items: ClothingItem[], cannot: Cannot): ScoreNote | null {
  const lower = items.find((item) => slotOf(item.category) === 'bottom');
  const upper = firstBySlot(items, ['top', 'midlayer']);
  if (!lower || !upper) return null;

  if (!upper.length || !lower.rise) {
    cannot(
      'waistline',
      `Say where the ${upper.name.toLowerCase()} ends and where the ${lower.name.toLowerCase()} sits, and the waistline can be judged.`,
    );
    return null;
  }

  const ids = [upper.id, lower.id];
  if (upper.length === 'long' && lower.rise !== 'high') {
    return {
      rule: 'waistline',
      points: -8,
      itemIds: ids,
      note: `A long ${upper.name.toLowerCase()} over a ${lower.rise} rise cuts you straight across the middle. Tuck it, or wear it with something higher.`,
    };
  }
  if (upper.length === 'cropped' || lower.rise === 'high') {
    return {
      rule: 'waistline',
      points: 8,
      itemIds: ids,
      note: 'The waist reads high, which is the rule of thirds doing its work.',
    };
  }
  return null;
}

/* ------------------------------------------------------------ 4. pattern -- */

/** Pattern mixing works on scale contrast. Two prints the same size fight. */
function pattern(items: ClothingItem[], cannot: Cannot): ScoreNote | null {
  const printed = items.filter((item) => item.pattern !== 'solid');
  if (printed.length === 0) return null;
  const ids = printed.map((item) => item.id);

  if (printed.length === 1) {
    return {
      rule: 'pattern',
      points: 4,
      itemIds: ids,
      note: `One print and everything else plain, so the ${printed[0].name.toLowerCase()} gets to be the thing people notice.`,
    };
  }

  if (printed.length >= 3) {
    return {
      rule: 'pattern',
      points: -12,
      itemIds: ids,
      note: `Three prints is past the line. Two of these want to be plain.`,
    };
  }

  const [a, b] = printed;
  if (!a.patternScale || !b.patternScale) {
    const missing = printed.filter((item) => !item.patternScale);
    cannot(
      'pattern',
      `Say how big the print is on the ${list(
        missing.map((item) => item.name.toLowerCase()),
      )} — two prints only work together at different sizes.`,
    );
    return null;
  }

  if (a.patternScale === b.patternScale) {
    return {
      rule: 'pattern',
      points: -6,
      itemIds: ids,
      note: `Two ${a.patternScale} prints, both asking for the same attention. Drop one, or swap it for a much smaller print.`,
    };
  }

  return {
    rule: 'pattern',
    points: 4,
    itemIds: ids,
    note: 'Two prints at different scales, which is how pattern mixing actually works.',
  };
}

/* -------------------------------------------------------- 5. third piece -- */

/**
 * Top, bottom and shoes is an outfit that looks unfinished. The single
 * highest-leverage suggestion this app can make, and the reason the accessory
 * work earns its place.
 */
function thirdPiece(items: ClothingItem[]): ScoreNote | null {
  const core: Slot[] = ['top', 'bottom', 'footwear', 'fullbody'];
  if (!items.some((item) => core.includes(slotOf(item.category)))) return null;

  const extras = items.filter((item) => {
    const slot = slotOf(item.category);
    if (slot === 'midlayer' || slot === 'outerwear' || slot === 'headwear') return true;
    // A watch and a belt are not a third piece. Something you would remark on is.
    return slot === 'accessory' && accessoryFocalWeight(item.category) >= 0.5;
  });

  if (extras.length === 0) {
    return {
      rule: 'third-piece',
      points: -8,
      itemIds: [],
      note: 'Top, bottom, shoes — and it stops there, which reads unfinished. A jacket, a knit or one real piece of jewellery is the whole difference.',
    };
  }

  const hero = extras[0];
  return {
    rule: 'third-piece',
    points: 8,
    itemIds: extras.map((item) => item.id),
    note: `The ${hero.name.toLowerCase()} is the third piece, and it is what makes this read as put together rather than thrown on.`,
  };
}

/* -------------------------------------------------------------- 6. matchy -- */

/** Matching a bag to the shoes to the belt reads dated. Harmony, not matching. */
function matchy(items: ClothingItem[]): ScoreNote | null {
  const trim = items.filter((item) => {
    const slot = slotOf(item.category);
    return slot === 'footwear' || slot === 'accessory';
  });
  if (trim.length < 3) return null;

  const hsls = trim.map((item) => hexToHsl(hexOf(item)));
  const lightnessSpread =
    Math.max(...hsls.map((c) => c.l)) - Math.min(...hsls.map((c) => c.l));
  if (lightnessSpread > 18) return null;

  /*
   * Hue only counts where there is a hue to compare.
   *
   * A warm grey watch face measures about thirty-three degrees, which sits it
   * next to tan and gold — so a steel watch, a gold ring and tan sandals came
   * back reported as "all the same colour", which is not a thing anybody would
   * say. Below a real saturation a piece is not matching anything; it is grey.
   *
   * A set of near-neutrals CAN still be matchy, and is the canonical case — a
   * black bag with black shoes and a black belt is exactly the look the rule
   * was written for — so those are judged on lightness alone. What is never a
   * set is a mixture of the two.
   */
  const saturated = hsls.filter((c) => c.s >= 20);
  if (saturated.length !== 0 && saturated.length !== hsls.length) return null;

  if (saturated.length) {
    const hueSpread = Math.max(
      ...saturated.flatMap((a) => saturated.map((b) => hueDistance(a.h, b.h))),
    );
    if (hueSpread > 18) return null;
  }

  return {
    rule: 'matchy',
    points: -5,
    itemIds: trim.map((item) => item.id),
    note: `The ${list(trim.map((item) => categoryLabel(item.category).toLowerCase()))} are all the same colour. Matching a set exactly stopped reading as elegant a while ago — let one of them differ.`,
  };
}

/* -------------------------------------------------------------- 7. metals -- */

/**
 * Mixing metals, the way it is actually done.
 *
 * The old rule was never mix them, and it is gone — brands now design pieces
 * meant to be worn in gold and silver together. What replaced it is specific
 * rather than permissive: repeat each metal at least twice. One lone silver
 * ring among gold reads as an accident; two reads as a decision.
 *
 * This cannot be folded into the colour rules, and that is why it exists. To a
 * colour analyser gold is a warm yellow and silver is a light grey, so it sees
 * a neutral with a small warm accent and approves — which is exactly the outfit
 * somebody looks at later and cannot say what is wrong with.
 */
function metals(items: ClothingItem[], cannot: Cannot): ScoreNote | null {
  /*
   * A watch is not jewellery for this purpose, and including it made the rule
   * wrong far more often than right. A steel watch worn with gold rings is
   * what a very large number of people wear every day — it is a functional
   * object somebody owns one of, not a piece chosen to go with an outfit — and
   * counting it fired a deduction on nearly every otherwise good outfit in a
   * real wardrobe. A rule that cries wolf on the ordinary case teaches people
   * to stop reading the card.
   */
  const jewellery = items.filter(
    (item) => hasMetal(item.category) && item.category !== 'watch',
  );
  if (jewellery.length < 2) return null;

  const known = jewellery.filter((item) => item.metal && item.metal !== 'other');
  if (known.length < 2) {
    cannot(
      'metals',
      `Say what the ${list(
        jewellery
          .filter((item) => !item.metal)
          .map((item) => item.name.toLowerCase()),
      )} ${jewellery.filter((item) => !item.metal).length === 1 ? 'is' : 'are'} made of, and the metals can be judged.`,
    );
    return null;
  }

  const counts = new Map<string, number>();
  known.forEach((item) => {
    // A piece that is itself mixed carries both, so it can never be the lone
    // one — which is the whole reason those pieces are made.
    const key = item.metal!;
    counts.set(key, (counts.get(key) ?? 0) + (key === 'mixed' ? 2 : 1));
  });

  if (counts.size < 2) return null;

  const lonely = [...counts.entries()].filter(([, count]) => count < 2).map(([metal]) => metal);
  const ids = known.map((item) => item.id);

  if (lonely.length === 0) {
    return {
      rule: 'metals',
      points: 4,
      itemIds: ids,
      note: 'Two metals, each of them repeated — which is the difference between mixing them and forgetting.',
    };
  }

  // With one of each there is no odd one out, and naming either is arbitrary —
  // it used to report whichever the Map happened to hold first, so the same
  // pairing was blamed on gold in one outfit and silver in the next.
  if (lonely.length === counts.size) {
    return {
      rule: 'metals',
      points: -5,
      itemIds: ids,
      note: `One ${lonely.map((metal) => metal.replace('-', ' ')).join(' piece and one ')} piece. A second of either would make it read as a decision rather than an accident.`,
    };
  }

  return {
    rule: 'metals',
    points: -5,
    itemIds: ids,
    note: `One lone ${lonely[0].replace('-', ' ')} piece among the rest. Two of it reads as a decision; one reads as an accident.`,
  };
}

/* ------------------------------------------------------------ 8. register -- */

/** A very-casual tank with formal trousers is what you notice across a room. */
function register(items: ClothingItem[]): ScoreNote | null {
  const anchors = items.filter((item) => REGISTER.includes(slotOf(item.category)));
  if (anchors.length < 2) return null;

  const scores = anchors.map((item) => formalityScore(item.formality));
  const spread = Math.max(...scores) - Math.min(...scores);
  const ids = anchors.map((item) => item.id);

  if (spread >= 4) {
    return {
      rule: 'register',
      points: -20,
      itemIds: ids,
      note: `The ${anchors[0].name.toLowerCase()} and the ${anchors[1].name.toLowerCase()} are dressed for different evenings.`,
    };
  }
  if (spread === 3) {
    return {
      rule: 'register',
      points: -10,
      itemIds: ids,
      note: 'One of these is dressed up and one is dressed down, by enough that it shows.',
    };
  }
  if (spread <= 1) {
    return {
      rule: 'register',
      points: 6,
      itemIds: ids,
      note: 'Everything pitched at the same level, so nothing looks borrowed from another outfit.',
    };
  }
  return null;
}

/* -------------------------------------------------------------- verdicts -- */

/**
 * The line under the number.
 *
 * Warm, never scolding — an app that calls somebody's clothes bad gets deleted,
 * and the deductions underneath already say precisely what to change.
 */
function verdictFor(score: number): string {
  if (score >= 90) return 'Immaculate.';
  if (score >= 80) return 'Sharp.';
  if (score >= 70) return 'This works.';
  if (score >= 60) return 'Fine, if a bit quiet.';
  if (score >= 45) return 'Something in here is fighting.';
  return 'Worth another look.';
}

/* --------------------------------------------------------------- helpers -- */

type Cannot = (rule: FitRule, because: string) => void;

function hexOf(item: ClothingItem): string {
  return item.primaryColorHex || hexForColorName(item.primaryColor);
}

function areaOf(item: ClothingItem): number {
  return VISUAL_AREA[slotOf(item.category)];
}

function colourWord(item: ClothingItem): string {
  return item.primaryColor.toLowerCase();
}

function capitalise(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/**
 * How many separate colours are in play, rather than how many coloured pieces.
 *
 * Navy trousers with a navy jacket is one colour, not two, and counting garments
 * would have called it a clash.
 */
function hueFamilies(accents: ClothingItem[]): number {
  const hues = accents.map((item) => hexToHsl(hexOf(item)).h);
  const seen: number[] = [];
  hues.forEach((hue) => {
    if (seen.some((other) => hueDistance(hue, other) <= 40)) return;
    seen.push(hue);
  });
  return seen.length;
}

/** The outermost thing in a list of slots — a coat speaks for the top under it. */
function firstBySlot(items: ClothingItem[], slots: Slot[]): ClothingItem | undefined {
  for (const slot of slots) {
    const found = items.find((item) => slotOf(item.category) === slot);
    if (found) return found;
  }
  return undefined;
}

/** "a", "a and b", "a, b and c" — written out, because a list reads as a list. */
export function list(words: string[]): string {
  if (words.length <= 1) return words[0] ?? '';
  if (words.length === 2) return `${words[0]} and ${words[1]}`;
  return `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`;
}
