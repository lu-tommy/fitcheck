/**
 * Domain model for FitCheck.
 *
 * Everything the app persists or sends to the AI is described here. Slots are
 * the backbone: they decide how an outfit stacks visually and which pieces can
 * coexist (you cannot wear two pairs of shoes, but you can layer a hoodie under
 * a jacket).
 */

export type Slot =
  | 'headwear'
  | 'top'
  | 'midlayer'
  | 'outerwear'
  | 'fullbody'
  | 'bottom'
  | 'footwear'
  | 'accessory';

export type Category =
  // headwear
  | 'hat'
  | 'cap'
  | 'beanie'
  // tops
  | 'tshirt'
  | 'polo'
  | 'shirt'
  | 'blouse'
  | 'tank'
  | 'longsleeve'
  | 'turtleneck'
  // mid layers
  | 'sweater'
  | 'hoodie'
  | 'cardigan'
  | 'vest'
  | 'overshirt'
  // outerwear
  | 'jacket'
  | 'coat'
  | 'blazer'
  | 'parka'
  | 'raincoat'
  // full body
  | 'dress'
  | 'jumpsuit'
  | 'suit'
  | 'swimwear'
  // bottoms
  | 'jeans'
  | 'chinos'
  | 'dress-pants'
  | 'shorts'
  | 'joggers'
  | 'leggings'
  | 'skirt'
  // footwear
  | 'sneakers'
  | 'boots'
  | 'dress-shoes'
  | 'loafers'
  | 'sandals'
  | 'flats'
  | 'rain-boots'
  // accessories
  | 'watch'
  | 'belt'
  | 'necklace'
  | 'earrings'
  | 'bracelet'
  | 'ring'
  | 'brooch'
  | 'sunglasses'
  | 'scarf'
  | 'tie'
  | 'bow-tie'
  | 'pocket-square'
  | 'headband'
  | 'hair-clip'
  | 'socks'
  | 'tights'
  | 'bag'
  | 'gloves'
  | 'umbrella'
  | 'other';

export type Pattern =
  | 'solid'
  | 'striped'
  | 'checked'
  | 'plaid'
  | 'floral'
  | 'graphic'
  | 'camo'
  | 'polka-dot'
  | 'houndstooth'
  | 'textured'
  | 'other';

/**
 * How much room a garment takes up on the body.
 *
 * The wardrobe knew colour, warmth, formality, season and style, and nothing at
 * all about SHAPE — which is the first thing a stylist looks at. Volume against
 * volume reads as pyjamas and fitted against fitted reads as a costume, and no
 * amount of colour reasoning can see either. Optional on purpose: an outfit
 * with nothing filled in is told the proportion question could not be judged,
 * rather than being scored against a guess.
 */
export type Fit = 'fitted' | 'regular' | 'relaxed' | 'oversized';

/** How far down a top, layer or dress reaches. Half of where the waist reads. */
export type Length = 'cropped' | 'regular' | 'long';

/** Where a bottom sits. The other half of where the waist reads. */
export type Rise = 'low' | 'mid' | 'high';

/**
 * How big the print is.
 *
 * Pattern mixing works on scale contrast — a wide stripe with a micro check.
 * Two prints of the same size fight, which is why the pattern name alone was
 * never enough to judge an outfit carrying two of them.
 */
export type PatternScale = 'micro' | 'medium' | 'bold';

/**
 * What a piece of jewellery is made of.
 *
 * Mixing metals stopped being a mistake some time ago, but the guidance that
 * replaced the old rule is specific: repeat each metal at least twice. One lone
 * silver ring among gold reads as an accident; two reads as a decision. That is
 * a distinction no amount of colour reasoning can make, because to a colour
 * analyser gold is simply a warm yellow.
 */
export type Metal = 'gold' | 'silver' | 'rose-gold' | 'mixed' | 'other';

export type Formality =
  | 'very-casual'
  | 'casual'
  | 'smart-casual'
  | 'business-casual'
  | 'formal'
  | 'black-tie';

export type Season = 'spring' | 'summer' | 'fall' | 'winter';

export type Style =
  | 'casual'
  | 'streetwear'
  | 'business-casual'
  | 'formal'
  | 'athletic'
  | 'minimalist'
  | 'outdoor'
  | 'preppy'
  | 'vintage';

export type LaundryStatus = 'clean' | 'dirty' | 'washing';

/* ------------------------------------------------------------------ care -- */

/** The wash symbol on the label, in the order a person would read it. */
export type WashMethod =
  | 'machine-cold'
  | 'machine-warm'
  | 'machine-hot'
  | 'hand-wash'
  | 'dry-clean'
  | 'do-not-wash';

export type WashCycle = 'normal' | 'permanent-press' | 'delicate';

export type DryMethod =
  | 'tumble-low'
  | 'tumble-normal'
  | 'line-dry'
  | 'dry-flat'
  | 'do-not-tumble';

export type IronSetting = 'high' | 'medium' | 'low' | 'steam-only' | 'do-not-iron';

export type BleachRule = 'any' | 'non-chlorine' | 'do-not-bleach';

/**
 * The short warnings that actually ruin clothes — the things you only learn
 * once, expensively. Kept as a fixed list rather than free text so the laundry
 * planner can reason about them.
 */
export type CareFlag =
  | 'bleeds'
  | 'shrinks'
  | 'wash-separately'
  | 'wash-inside-out'
  | 'no-fabric-softener'
  | 'use-a-mesh-bag'
  | 'reshape-while-damp'
  | 'do-not-wring';

export interface CareInstructions {
  wash?: WashMethod;
  cycle?: WashCycle;
  dry?: DryMethod;
  iron?: IronSetting;
  bleach?: BleachRule;
  flags: CareFlag[];
  /** Anything the label says that the fields above cannot hold. */
  notes?: string;
  /** Where these came from, so a guess can be shown as a guess. */
  source: 'label' | 'material-default' | 'manual';
}

export interface ClothingItem {
  id: string;
  /**
   * Keys into the `photos` object store, not URLs. Blobs live in IndexedDB and
   * are turned into object URLs on demand, so nothing here goes stale when the
   * page reloads.
   */
  photoId?: string;
  /** Background-removed PNG, when available. Preferred for outfit previews. */
  cutoutId?: string;
  name: string;
  category: Category;
  primaryColor: string;
  primaryColorHex: string;
  secondaryColors: string[];
  pattern: Pattern;
  /** Only meaningful when `pattern` is not solid. Undefined means nobody said. */
  patternScale?: PatternScale;
  /** Shape — see Fit. All three stay undefined until somebody says. */
  fit?: Fit;
  length?: Length;
  rise?: Rise;
  /** Jewellery only. Undefined means nobody has said, not that it has none. */
  metal?: Metal;
  /**
   * Whether it keeps the rain off.
   *
   * A property rather than a list of coat names: a trench, a raincoat, a shell
   * and a pair of rubber boots are all waterproof and nothing about their
   * categories says so. Undefined falls back to what the category implies, so
   * nobody has to tag a raincoat as waterproof.
   */
  waterproof?: boolean;
  material?: string;
  brand?: string;
  formality: Formality;
  seasons: Season[];
  styles: Style[];
  favorite: boolean;
  laundry: LaundryStatus;
  /**
   * Kept, but out of circulation — the piece you no longer wear and cannot
   * bring yourself to bin. Archived items keep their history and stay out of
   * the closet, the generator and the stats.
   */
  archived?: boolean;
  archivedAt?: string;
  wearCount: number;
  lastWornAt?: string;
  notes?: string;
  /** How to wash it without ruining it. Undefined means nobody has said. */
  care?: CareInstructions;
  purchasePrice?: number;
  createdAt: string;
  updatedAt: string;
  /** Provenance of the attributes above. */
  detection: {
    source: 'ai' | 'manual' | 'seed';
    model?: string;
    confidence?: number;
    /** True once the user has edited any AI-detected field. */
    editedByUser: boolean;
  };
}

/** The subset of an item the AI is allowed to see when picking outfits. */
export interface ClosetDigestItem {
  id: string;
  name: string;
  category: Category;
  slot: Slot;
  primaryColor: string;
  secondaryColors: string[];
  pattern: Pattern;
  material?: string;
  brand?: string;
  formality: Formality;
  seasons: Season[];
  styles: Style[];
  favorite: boolean;
  wearCount: number;
}

/** Where one piece sits on the collage. All values are fractions of the canvas. */
export interface CollagePlacement {
  itemId: string;
  /** Centre of the piece. */
  x: number;
  y: number;
  /** Width as a fraction of the canvas width. */
  size: number;
  /** Stacking order, low to high. */
  z: number;
  /** Slight tilt, in degrees — what stops a flat lay looking like a spreadsheet. */
  rotation: number;
}

export interface Outfit {
  id: string;
  name: string;
  itemIds: string[];
  /** Hand-adjusted collage. Absent means the automatic composition is used. */
  layout?: CollagePlacement[];
  occasion?: string;
  notes?: string;
  favorite: boolean;
  /** Why the AI put these together — shown on the outfit detail screen. */
  explanation?: string;
  colorNotes?: string;
  weatherContext?: string;
  source: 'ai' | 'manual';
  timesWorn: number;
  lastWornAt?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * One thing the wearer did that says something about what they like.
 *
 * The app had exactly one source of preference — `favorite`, a flag almost
 * nobody sets — and one source of history, the wear log, which it used only as
 * a penalty to stop the same three pieces coming up every day. Everything else
 * was thrown away: the strongest signal in the whole product is somebody being
 * offered a garment for a slot and deliberately walking to a different one, and
 * that happened on the home screen several times a week and was never written
 * down.
 *
 * Deliberately NOT recorded: shuffling past an outfit. That means "not today",
 * not "not ever", and treating the two the same would teach the app to hide
 * clothes somebody likes for reasons it invented.
 */
export type SignalKind =
  /** Offered for a slot and swapped away from. */
  | 'passed'
  /** Swapped TO — a direct comparison, and the strongest signal there is. */
  | 'chosen'
  /** Actually worn, and logged. */
  | 'worn';

export interface StyleSignal {
  id: string;
  itemId: string;
  kind: SignalKind;
  /** The other side of a swap, when there was one. */
  againstItemId?: string;
  /** YYYY-MM-DD, local — signals decay, so when matters. */
  date: string;
  createdAt: string;
  updatedAt: string;
}

/** A record of an outfit actually being worn. Drives history and stats. */
export interface WearLog {
  id: string;
  outfitId?: string;
  itemIds: string[];
  date: string;
  occasion?: string;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CalendarEntry {
  id: string;
  /** YYYY-MM-DD, local. */
  date: string;
  outfitId: string;
  label?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PackingDayPlan {
  day: number;
  label: string;
  itemIds: string[];
}

export interface PackingList {
  id: string;
  destination: string;
  days: number;
  startDate?: string;
  activities: string[];
  weatherSummary?: string;
  itemIds: string[];
  dayPlans: PackingDayPlan[];
  notes?: string;
  packedItemIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface WishlistItem {
  id: string;
  name: string;
  category: Category;
  colorName?: string;
  brand?: string;
  price?: number;
  url?: string;
  imageUri?: string;
  /** Why this piece would earn its place — AI-suggested or user-written. */
  reason?: string;
  source: 'ai' | 'manual';
  purchased: boolean;
  createdAt: string;
  updatedAt: string;
}

export type ThemeMode = 'light' | 'dark' | 'system';
export type Units = 'metric' | 'imperial';

export interface Preferences {
  displayName?: string;
  themeMode: ThemeMode;
  units: Units;
  preferredStyles: Style[];
  avoidColors: string[];
  dailySuggestion: {
    enabled: boolean;
    hour: number;
    minute: number;
  };
  /** Cached so the home screen can render weather before location resolves. */
  lastLocation?: {
    latitude: number;
    longitude: number;
    label: string;
  };
  /** How new photos get their background removed. See lib/backgroundRemoval. */
  backgroundRemoval: BackgroundRemovalMode;
  /** ISO timestamp of the last successful export. Drives the backup reminder. */
  lastBackupAt?: string;
  /** Set once the install card has been dismissed, so it asks only once. */
  installPromptDismissed?: boolean;
  /**
   * Today's Outfit of the Day, written down so it stops changing underneath
   * whoever is looking at it. See domain/ootd.
   */
  outfitOfTheDay?: { date: string; itemIds: string[] };
  /**
   * Whether the garment parser may download its weights.
   *
   * Unset until asked. The download is 27 MB from a third party, which is a
   * real departure for an app that otherwise needs no keys and talks to
   * nobody — so it is a question with an answer, not a default.
   */
  garmentParsing?: 'on' | 'off';
  /**
   * Observations the wearer has told the app it has wrong. Keys, not text, so
   * a dismissal survives the wording being improved.
   */
  dismissedObservations?: string[];
}

/**
 * `off` keeps the original photo. `local` runs the in-browser edge flood-fill,
 * which is instant and private but only works against a plain backdrop. `api`
 * posts to /api/cutout, which needs a cutout provider key on the server.
 */
export type BackgroundRemovalMode = 'off' | 'local' | 'api';

export interface WeatherSnapshot {
  temperature: number;
  feelsLike: number;
  high: number;
  low: number;
  /** WMO weather code from Open-Meteo. */
  code: number;
  condition: string;
  precipitationChance: number;
  windSpeed: number;
  units: Units;
  locationLabel: string;
  fetchedAt: string;
  /** Next few days, used by the calendar and packing mode. */
  daily?: DailyForecast[];
}

export interface DailyForecast {
  /** YYYY-MM-DD, local to the forecast location. */
  date: string;
  high: number;
  low: number;
  code: number;
  condition: string;
  precipitationChance: number;
}

/** Everything the generator screen collects before asking the AI. */
export interface OutfitRequest {
  prompt: string;
  occasion?: string;
  formality?: Formality;
  temperature?: number;
  weatherCondition?: string;
  colorPreference?: string;
  style?: Style;
  includeItemIds: string[];
  excludeItemIds: string[];
  /** Skip anything not marked clean. */
  cleanOnly: boolean;
}

export interface OutfitAlternative {
  slot: Slot;
  itemId: string;
  why: string;
}

/**
 * A garment the wardrobe could not supply.
 *
 * An engine that only ever uses clothes you own has to be willing to say you do
 * not own something. Otherwise the promise quietly becomes "wear the wrong
 * thing": asked to dress for a wedding out of a casual wardrobe, it produced a
 * white t-shirt with charcoal dress trousers and trainers, scored it 48 out of
 * 100, called it "something in here is fighting" — and presented it as the
 * answer anyway, with the real problem in a warning underneath.
 *
 * Naming what is missing is more useful than any outfit it could have improvised,
 * and it is the one thing a wardrobe app is uniquely placed to know.
 */
export interface MissingPiece {
  slot: Slot;
  /** Why nothing already owned would do, in plain words. */
  because: string;
  /** What to look for. Concrete enough to shop with. */
  suggestion: string;
  /** Categories that would fill it, so it can go straight on the wishlist. */
  categories: Category[];
}

export interface GeneratedOutfit {
  name: string;
  itemIds: string[];
  explanation: string;
  colorNotes: string;
  alternatives: OutfitAlternative[];
  /** Populated locally when the model references an item that no longer exists. */
  warnings?: string[];
  /** Slots the wardrobe could not fill for this occasion. See MissingPiece. */
  missing?: MissingPiece[];
}

export interface StylistMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  createdAt: string;
  /** Items the assistant referenced, resolved to real closet ids. */
  referencedItemIds?: string[];
}

export interface PackingRequest {
  destination: string;
  days: number;
  startDate?: string;
  activities: string[];
  weatherSummary?: string;
}


/* ------------------------------------------------------------------ sync -- */

/** The collections that synchronise. Photos and settings travel separately. */
export type SyncedStore =
  | 'items'
  | 'outfits'
  | 'wearLogs'
  | 'calendar'
  | 'packing'
  | 'wishlist'
  | 'signals';

/**
 * A record of something being deleted.
 *
 * Without these a delete is invisible to sync: the other device still holds the
 * record, pushes it back, and the deleted item reappears. Tombstones are the
 * only way a deletion survives a round trip.
 */
export interface Tombstone {
  /** `${store}:${recordId}` — unique across every collection. */
  id: string;
  store: SyncedStore;
  recordId: string;
  deletedAt: string;
}

/** Everything the sync engine remembers between runs. */
export interface SyncState {
  /** Firestore document path prefix — the signed-in user. */
  userId?: string;
  /** Highest local updatedAt already pushed. */
  lastPushedAt?: string;
  /** Newest server stamp already pulled, as milliseconds since the epoch. */
  lastPulledAt?: number;
  lastSyncedAt?: string;
  lastError?: string;
  /**
   * Set when this device holds a wardrobe belonging to a different account.
   *
   * Sticky on purpose. It cannot be re-derived each run by comparing account
   * ids, because the first pull-only run records the new id and the next run
   * would then see no mismatch and upload the other person's clothes. It stays
   * set until somebody deliberately merges or clears.
   */
  foreignWardrobe?: boolean;
  /** Photo ids known to exist in cloud storage, so uploads are not repeated. */
  uploadedPhotoIds: string[];
}
