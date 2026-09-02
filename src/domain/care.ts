import { hexToHsl } from './color';
import { slotOf } from './taxonomy';
import type {
  BleachRule,
  CareFlag,
  CareInstructions,
  ClothingItem,
  DryMethod,
  IronSetting,
  WashCycle,
  WashMethod,
} from '@/types';

/**
 * Care labels, and what to do with them.
 *
 * The point of storing care instructions is not the record — it is that the
 * laundry screen can then group a dirty pile into loads that will not destroy
 * anything. Everything here is a lookup or a rule; none of it guesses.
 */

/* ------------------------------------------------------------- vocabulary -- */

export const WASH_METHODS: WashMethod[] = [
  'machine-cold',
  'machine-warm',
  'machine-hot',
  'hand-wash',
  'dry-clean',
  'do-not-wash',
];

export const WASH_LABEL: Record<WashMethod, string> = {
  'machine-cold': 'Machine, cold',
  'machine-warm': 'Machine, warm',
  'machine-hot': 'Machine, hot',
  'hand-wash': 'Hand wash',
  'dry-clean': 'Dry clean only',
  'do-not-wash': 'Do not wash',
};

/** Rough degrees, for the load header. Null where a temperature is meaningless. */
export const WASH_TEMPERATURE: Record<WashMethod, number | null> = {
  'machine-cold': 30,
  'machine-warm': 40,
  'machine-hot': 60,
  'hand-wash': null,
  'dry-clean': null,
  'do-not-wash': null,
};

export const CYCLES: WashCycle[] = ['normal', 'permanent-press', 'delicate'];

export const CYCLE_LABEL: Record<WashCycle, string> = {
  normal: 'Normal',
  'permanent-press': 'Permanent press',
  delicate: 'Delicate',
};

export const DRY_METHODS: DryMethod[] = [
  'tumble-low',
  'tumble-normal',
  'line-dry',
  'dry-flat',
  'do-not-tumble',
];

export const DRY_LABEL: Record<DryMethod, string> = {
  'tumble-low': 'Tumble, low heat',
  'tumble-normal': 'Tumble, normal',
  'line-dry': 'Hang to dry',
  'dry-flat': 'Dry flat',
  'do-not-tumble': 'Do not tumble dry',
};

export const IRON_SETTINGS: IronSetting[] = ['high', 'medium', 'low', 'steam-only', 'do-not-iron'];

export const IRON_LABEL: Record<IronSetting, string> = {
  high: 'Iron hot',
  medium: 'Iron warm',
  low: 'Iron cool',
  'steam-only': 'Steam only',
  'do-not-iron': 'Do not iron',
};

export const BLEACH_RULES: BleachRule[] = ['any', 'non-chlorine', 'do-not-bleach'];

export const BLEACH_LABEL: Record<BleachRule, string> = {
  any: 'Bleach is fine',
  'non-chlorine': 'Non-chlorine bleach only',
  'do-not-bleach': 'Do not bleach',
};

export const CARE_FLAGS: CareFlag[] = [
  'bleeds',
  'shrinks',
  'wash-separately',
  'wash-inside-out',
  'no-fabric-softener',
  'use-a-mesh-bag',
  'reshape-while-damp',
  'do-not-wring',
];

export const FLAG_LABEL: Record<CareFlag, string> = {
  bleeds: 'Colour bleeds',
  shrinks: 'Shrinks',
  'wash-separately': 'Wash separately',
  'wash-inside-out': 'Wash inside out',
  'no-fabric-softener': 'No fabric softener',
  'use-a-mesh-bag': 'Use a mesh bag',
  'reshape-while-damp': 'Reshape while damp',
  'do-not-wring': 'Do not wring',
};

/** The one-line version, for a card or a load note. */
export const FLAG_ADVICE: Record<CareFlag, string> = {
  bleeds: 'Keep it away from anything pale, at least for the first few washes.',
  shrinks: 'Cold water and no tumble dryer, or it comes back a size smaller.',
  'wash-separately': 'Give this one its own load.',
  'wash-inside-out': 'Turn it inside out first to protect the face of the fabric.',
  'no-fabric-softener': 'Softener coats the fibres and ruins how this performs.',
  'use-a-mesh-bag': 'A mesh bag stops it snagging on everything else.',
  'reshape-while-damp': 'Pull it back into shape while damp and dry it flat.',
  'do-not-wring': 'Press the water out rather than twisting it.',
};

export function careSummary(care: CareInstructions | undefined): string | null {
  if (!care) return null;
  const parts = [
    care.wash ? WASH_LABEL[care.wash] : null,
    care.cycle && care.cycle !== 'normal' ? CYCLE_LABEL[care.cycle].toLowerCase() : null,
    care.dry ? DRY_LABEL[care.dry].toLowerCase() : null,
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}

/* -------------------------------------------------------------- defaults -- */

const MATERIAL_DEFAULTS: Record<string, Omit<CareInstructions, 'source'>> = {
  wool: { wash: 'hand-wash', cycle: 'delicate', dry: 'dry-flat', iron: 'low', bleach: 'do-not-bleach', flags: ['shrinks', 'reshape-while-damp', 'do-not-wring'] },
  cashmere: { wash: 'hand-wash', cycle: 'delicate', dry: 'dry-flat', iron: 'low', bleach: 'do-not-bleach', flags: ['shrinks', 'reshape-while-damp', 'do-not-wring'] },
  silk: { wash: 'hand-wash', cycle: 'delicate', dry: 'line-dry', iron: 'low', bleach: 'do-not-bleach', flags: ['do-not-wring', 'no-fabric-softener'] },
  linen: { wash: 'machine-cold', cycle: 'delicate', dry: 'line-dry', iron: 'medium', bleach: 'non-chlorine', flags: [] },
  denim: { wash: 'machine-cold', cycle: 'normal', dry: 'line-dry', iron: 'medium', bleach: 'do-not-bleach', flags: ['bleeds', 'wash-inside-out'] },
  leather: { wash: 'do-not-wash', dry: 'do-not-tumble', iron: 'do-not-iron', bleach: 'do-not-bleach', flags: [] },
  suede: { wash: 'do-not-wash', dry: 'do-not-tumble', iron: 'do-not-iron', bleach: 'do-not-bleach', flags: [] },
  down: { wash: 'machine-cold', cycle: 'delicate', dry: 'tumble-low', iron: 'do-not-iron', bleach: 'do-not-bleach', flags: ['no-fabric-softener'] },
  fleece: { wash: 'machine-cold', cycle: 'normal', dry: 'tumble-low', iron: 'do-not-iron', bleach: 'do-not-bleach', flags: ['no-fabric-softener'] },
  cotton: { wash: 'machine-warm', cycle: 'normal', dry: 'tumble-normal', iron: 'high', bleach: 'any', flags: [] },
  polyester: { wash: 'machine-cold', cycle: 'permanent-press', dry: 'tumble-low', iron: 'low', bleach: 'non-chlorine', flags: [] },
  nylon: { wash: 'machine-cold', cycle: 'delicate', dry: 'tumble-low', iron: 'do-not-iron', bleach: 'do-not-bleach', flags: ['use-a-mesh-bag'] },
  corduroy: { wash: 'machine-cold', cycle: 'normal', dry: 'line-dry', iron: 'medium', bleach: 'do-not-bleach', flags: ['wash-inside-out'] },
  canvas: { wash: 'machine-warm', cycle: 'normal', dry: 'line-dry', iron: 'medium', bleach: 'any', flags: [] },
  knit: { wash: 'hand-wash', cycle: 'delicate', dry: 'dry-flat', iron: 'low', bleach: 'do-not-bleach', flags: ['reshape-while-damp'] },
};

/**
 * The hard objects, which never see water whatever they are made of.
 *
 * This named the watch alone, which was fair when a watch was the only such
 * thing the wardrobe could hold. It is not any more: a brooch, a pair of hoops
 * or a signet ring sorted into a delicates load is the kind of advice that
 * costs somebody something they cannot replace.
 */
const NEVER_WASHED: ClothingItem['category'][] = [
  'watch',
  'ring',
  'necklace',
  'earrings',
  'bracelet',
  'brooch',
  'sunglasses',
];

/**
 * A starting point from the material, offered as a suggestion the wearer can
 * overrule. Marked `material-default` so the UI never presents a guess with
 * the same confidence as something read off the label.
 */
export function suggestedCare(item: {
  material?: string;
  category: ClothingItem['category'];
}): CareInstructions | null {
  if (slotOf(item.category) === 'footwear' || NEVER_WASHED.includes(item.category)) {
    return { wash: 'do-not-wash', flags: [], source: 'material-default' };
  }
  const key = item.material?.trim().toLowerCase();
  if (!key) return null;
  const match = Object.keys(MATERIAL_DEFAULTS).find((name) => key.includes(name));
  if (!match) return null;
  return { ...MATERIAL_DEFAULTS[match], source: 'material-default' };
}

/* --------------------------------------------------------- wash planning -- */

export interface WashLoad {
  key: string;
  title: string;
  /** The wash method the whole load shares — decides what the action is called. */
  method: WashMethod;
  /** Machine settings for the load, or null where it does not go in the machine. */
  temperature: number | null;
  cycle: WashCycle;
  items: ClothingItem[];
  /** Things to do before pressing start. */
  warnings: string[];
}

export interface WashPlan {
  loads: WashLoad[];
  /** Items with no care information at all — the planner had to assume. */
  unlabelled: ClothingItem[];
}

/** Anything not going in the machine is a load of its own, by method. */
const HAND_METHODS: WashMethod[] = ['hand-wash', 'dry-clean', 'do-not-wash'];

/**
 * Sort a dirty pile into loads.
 *
 * The rules are the ones a careful person already follows: never wash a hot
 * load with something that shrinks, keep the delicates apart, and keep anything
 * that bleeds away from anything pale. The last of those is decided from the
 * colours already stored on each item, so it works whether or not the label
 * has been filled in.
 */
export function planWashLoads(items: ClothingItem[]): WashPlan {
  const dirty = items.filter((item) => item.laundry === 'dirty');
  const buckets = new Map<string, ClothingItem[]>();
  const unlabelled: ClothingItem[] = [];

  dirty.forEach((item) => {
    const care = item.care ?? suggestedCare(item);
    if (!item.care) unlabelled.push(item);

    const wash = care?.wash ?? 'machine-warm';
    const cycle = care?.cycle ?? (wash === 'hand-wash' ? 'delicate' : 'normal');
    // A piece that must go alone gets a bucket keyed to itself.
    const separate = care?.flags.includes('wash-separately');
    const key = separate ? `solo:${item.id}` : `${wash}|${cycle}`;
    buckets.set(key, [...(buckets.get(key) ?? []), item]);
  });

  const loads: WashLoad[] = [...buckets.entries()].map(([key, loadItems]) => {
    const first = loadItems[0];
    const care = first.care ?? suggestedCare(first);
    const wash = care?.wash ?? 'machine-warm';
    const cycle = care?.cycle ?? 'normal';

    return {
      key,
      title: key.startsWith('solo:') ? `${first.name} — on its own` : loadTitle(wash, cycle),
      method: wash,
      temperature: WASH_TEMPERATURE[wash],
      cycle,
      items: loadItems,
      warnings: warningsFor(loadItems, wash),
    };
  });

  // Machine loads first and coolest first, which is the order you would
  // actually run them; everything done by hand or by someone else goes last.
  loads.sort((a, b) => {
    const aHand = a.temperature === null ? 1 : 0;
    const bHand = b.temperature === null ? 1 : 0;
    if (aHand !== bHand) return aHand - bHand;
    if (a.temperature !== null && b.temperature !== null && a.temperature !== b.temperature) {
      return a.temperature - b.temperature;
    }
    return b.items.length - a.items.length;
  });

  return { loads, unlabelled };
}

/** What the button on a load should say. Not everything goes in a machine. */
export function loadActionLabel(method: WashMethod): string {
  switch (method) {
    case 'dry-clean':
      return 'Dropped off';
    case 'do-not-wash':
      return 'Spot cleaned';
    case 'hand-wash':
      return 'Soaking';
    default:
      return 'Start';
  }
}

function loadTitle(wash: WashMethod, cycle: WashCycle): string {
  if (wash === 'do-not-wash') return 'Not for the wash';
  if (HAND_METHODS.includes(wash)) return WASH_LABEL[wash];
  const temperature = WASH_TEMPERATURE[wash];
  const cycleName = cycle === 'normal' ? '' : ` · ${CYCLE_LABEL[cycle].toLowerCase()}`;
  return `${temperature}° wash${cycleName}`;
}

function warningsFor(items: ClothingItem[], wash: WashMethod): string[] {
  const warnings: string[] = [];

  // Colour transfer, decided from the colours we already store: a dark or
  // saturated piece in the same drum as something pale is the classic ruin.
  const lightness = (item: ClothingItem) => {
    try {
      return hexToHsl(item.primaryColorHex).l;
    } catch {
      return 50;
    }
  };
  const pale = items.filter((item) => lightness(item) > 78);
  const dark = items.filter((item) => lightness(item) < 38);
  const bleeders = items.filter((item) => item.care?.flags.includes('bleeds'));

  if (bleeders.length && pale.length) {
    warnings.push(
      `${listNames(bleeders)} ${bleeders.length === 1 ? 'bleeds' : 'bleed'} — pull ${
        bleeders.length === 1 ? 'it' : 'them'
      } out, or ${listNames(pale)} will come back tinted.`,
    );
  } else if (pale.length && dark.length) {
    warnings.push(
      `This load mixes ${listNames(pale)} with ${listNames(dark)}. Splitting lights from darks is the safer call.`,
    );
  }

  if (wash === 'machine-hot' && items.some((item) => item.care?.flags.includes('shrinks'))) {
    warnings.push('Something in here shrinks — a hot wash will cost you a size.');
  }

  const flags = new Set<string>();
  items.forEach((item) => item.care?.flags.forEach((flag) => flags.add(flag)));
  ['use-a-mesh-bag', 'wash-inside-out', 'no-fabric-softener'].forEach((flag) => {
    if (flags.has(flag)) warnings.push(FLAG_ADVICE[flag as CareFlag]);
  });

  return warnings;
}

function listNames(items: ClothingItem[]): string {
  const names = items.map((item) => item.name);
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, 2).join(', ')} and ${names.length - 2} more`;
}

/** Everything worth saying before this specific piece goes in the wash. */
export function careWarningsFor(item: ClothingItem): string[] {
  const care = item.care;
  if (!care) return [];
  return care.flags.map((flag) => FLAG_ADVICE[flag]);
}
