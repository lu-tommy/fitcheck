# OutfitAI — web

Photograph the clothes you already own, and get outfits built from that closet
and nothing else. No shopping suggestions dressed up as styling.

Next.js 16 · React 19 · TypeScript · Tailwind v4 · Zustand · IndexedDB.

---

## Run it

```sh
npm install
npm run dev        # http://localhost:3000
npm test           # 90 tests over the domain logic
npm run typecheck
```

**No keys are required.** With nothing configured everything works: adding
clothes, generating outfits, planning a week, packing a trip, laundry, stats and
the weather all run locally. Adding a key (see `.env.example`) upgrades tagging
and styling from rule-based to Claude-powered.

To look around before photographing anything, tap **try a demo wardrobe** on the
home screen (or **You → Load a demo wardrobe**). Demo pieces have no photo and
render as colour blocks, so it stays obvious which ones are placeholders.

Open it on your phone with `npm run dev -- -H 0.0.0.0` and visit the Network URL
it prints. It installs to the home screen as a PWA.

---

## What runs where

| Feature | Without a key | With a key |
|---|---|---|
| Tagging a photo | Colour is detected on-device; you fill in the rest | Claude reads the photo and fills the fields in |
| Outfit generation | On-device scoring engine, with written reasoning | Claude, grounded in your closet |
| Stylist | Answers by running the engine and narrating it | Claude, answering your actual question |
| Packing lists | Heuristic re-wear planner | Claude |
| Wishlist gap analysis | Unavailable | Claude |
| Background removal | On-device flood fill (plain backgrounds) | Cut-out provider, if configured |
| Weather | Works — Open-Meteo, no key needed | — |

The home screen's daily suggestion **always** uses the on-device engine, even
when a key is present. Opening the app should not cost money; the Generate
screen is where a considered suggestion belongs.

---

## Where your data lives

In this browser, in IndexedDB — items, outfits, plans, and the photos themselves
as blobs. There is no account and no server copy. That means:

- it works offline and starts instantly;
- clearing site data deletes everything;
- **You → Export** writes a single JSON backup including the photos, and
  **Import** restores it, which is how you move to another browser or device.

### Why the app asks to be installed

Browsers treat script-written storage as disposable. WebKit deletes *all* of it
— IndexedDB included — for an origin it has not seen you interact with in the
last seven days, which for a wardrobe app means a fortnight away is enough to
lose the lot. Three things guard against that, and the app does all three:

- `navigator.storage.persist()` is requested on first load, which opts the
  origin out of eviction where the browser grants it;
- an installed home-screen app is exempt from the seven-day sweep entirely,
  which is why the home screen nudges you to add it — iOS never offers this by
  itself, so the app has to teach the gesture;
- backups are nagged for rather than remembered, with the last backup date
  shown under **You → Your data**.

Both guards report their real state on that screen. If it says storage can be
cleared automatically and you have never backed up, believe it.

Photos are downscaled to 1400px and re-encoded before they are stored, so a
200-piece closet stays inside the browser's quota.

---

## Architecture

```
src/
  types/         The domain model. Slots are the backbone: they decide how an
                 outfit stacks and which pieces can coexist.
  domain/        Pure, framework-free, fully tested.
    taxonomy      Categories → slot, warmth, default formality
    care          Care labels, material defaults, and the wash-load planner
    color         HSL harmony analysis, neutrals, pairing suggestions
    outfitEngine  The rule-based outfit builder (and the AI fallback)
    packingEngine Re-wear planner
    filters       Closet search, filtering, sorting
    stats         Wear counts, colour shares, cost per wear
  db/            IndexedDB: one store per collection, photos kept separate so
                 listing a closet never deserialises an image
  store/         Zustand stores, one per concern, hydrated once by AppShell
  lib/           Image processing, background removal, weather, backup, the
                 client half of the AI layer
  server/        The Anthropic client. The key never leaves this directory.
  app/           Routes. Every screen is a client component, because the data
                 lives in the browser.
  components/    ui/ primitives, then closet/, outfit/, stats/
```

## Getting a wardrobe in

Cataloguing is where wardrobe apps lose their users, so there are three ways in
and none of them require a key:

- **One photo, several pieces.** Photograph a whole outfit — laid on the bed, or
  a picture you liked — and drag a box around each garment. Every box is cropped
  to the same 4:5 frame with a little padding, and where the frame runs past the
  edge of the photo it is filled with the crop's own border colour rather than a
  black bar, so pieces cut from different photos still look like a set.
- **A batch of photos**, processed one at a time so a phone browser does not
  lock up decoding six 12-megapixel images at once.
- **By hand**, with no photo at all.

Colour is detected without any model: the outer ring of the frame is read as the
backdrop, and pixels matching it are discarded before the middle of the frame is
binned. That is what stops a pair of shoes photographed on a duvet coming back
the colour of the duvet. If discarding the backdrop leaves almost nothing, the
garment fills the frame and *is* that colour, so the filter is dropped.

## Care instructions

Each item can carry its label — wash, cycle, dry, iron, bleach, plus the short
warnings that actually ruin clothes (bleeds, shrinks, wash separately, mesh bag).
Where the material implies an answer the fields arrive pre-filled and say so, so
a guess never looks like something read off the garment.

The point is not the record. The laundry screen turns the dirty pile into loads
that will not destroy anything: hand wash separated from machine, delicates from
normal, coolest load first, and anything marked *wash separately* on its own.
Two warnings fire from data the app already has — a piece that bleeds sharing a
drum with something pale, and a load mixing lights with darks — so they work
whether or not a label has been filled in.

### Two rules worth knowing before you edit

**Every AI path has a local counterpart.** `lib/ai.ts` is the only place that
decides which one runs, and it never throws: a missing key, a network failure or
a hallucinated item id all fall back to the engine and report `source: 'local'`.
The UI labels which one produced a result rather than hiding it.

**Resolve item ids with `useResolvedItems`, not a selector.** Zustand v5 compares
snapshots by reference, so a selector that maps ids to a fresh array on every
call re-renders forever. The hook memoises on the id string.

---

## Testing

`npm test` covers the domain layer — the outfit engine's slot rules and
layering coherence, colour harmony and neutral detection, care labels and wash
grouping, filters, packing and stats. The interesting cases are in `src/__tests__/coherence.test.ts`: both bugs
it covers (a wool jumper layered over shorts, and cream being called an orange
accent) were invisible to the code and to the tests until a real outfit was
rendered and looked at.

---

## Relationship to the native app

This is the web rehearsal for a React Native / Expo app. The `domain/`, `types/`
and `lib/` layers are deliberately framework-free and port across unchanged; only
`app/`, `components/`, `db/` and the photo pipeline are web-specific.
