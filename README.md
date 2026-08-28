# OutfitAI — web

Photograph the clothes you already own, and get outfits built from that closet
and nothing else. No shopping suggestions dressed up as styling.

Next.js 16 · React 19 · TypeScript · Tailwind v4 · Zustand · IndexedDB.
No AI, no API keys, no third-party services.

---

## Run it

```sh
npm install
npm run dev        # http://localhost:3000
npm test           # 90 tests over the domain logic
npm run typecheck
```

**Nothing needs configuring to run it.** Adding clothes, generating outfits,
planning a week, packing a trip, laundry, stats and weather all work out of the
box. `.env.local` only adds accounts and backup — see below.

To look around before photographing anything, tap **try a demo wardrobe** on the
home screen (or **You → Load a demo wardrobe**). Demo pieces have no photo and
render as colour blocks, so it stays obvious which ones are placeholders.

Open it on your phone with `npm run dev -- -H 0.0.0.0` and visit the Network URL
it prints. It installs to the home screen as a PWA.

---

## What runs where

There is no AI in this app and no API key to buy. Outfits, packing lists,
colour reasoning and the wash planner all come from rules in `src/domain`, which
run instantly, work offline, and can be read and argued with. Weather comes from
Open-Meteo, which needs no key either.

---

## Accounts on your own server

Sign in and the wardrobe is copied to a folder on your own machine — a lost
phone stops being a fresh start, and the same account works on a phone and a
tablet. There is no third party involved and nothing to pay for. **The app works
fully without an account**, signed out and offline; an account is additive, not
a wall in front of the door.

### Setting it up

```sh
cp .env.example .env.local
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"   # OUTFITAI_SECRET
npm run add-user -- lia      # prints a name:salt:hash line for OUTFITAI_USERS
npm run add-user -- tommy    # entries are separated by ;
```

Passwords are never stored — only a scrypt hash and its salt — so `.env.local`
does not hand anyone a way in if it leaks. Sessions are an httpOnly cookie
signed with `OUTFITAI_SECRET`, so page scripts cannot read them and nobody can
forge one. Ten wrong guesses for a name locks it out for ten minutes.

### Running it on a NAS

```sh
echo "OUTFITAI_SECRET=..." > .env
echo "OUTFITAI_USERS=..." >> .env
sh deploy/nas-setup.sh
```

The script builds, starts, waits for the app to answer, and fixes one thing
that is easy to miss: the image runs as uid 1001, but a bind-mounted folder
keeps the host's ownership, so a `data` directory created by root is read-only
to the app and **every sync fails with a 500 while the app otherwise looks
perfectly healthy**.

The container listens on `127.0.0.1:3210` only, so nginx is the only way in.
`deploy/nginx-fitcheck.conf` is a ready site config for
`fitcheck.tommyluhome.duckdns.org` — it terminates TLS, forwards
`X-Forwarded-For` (the login rate limiter needs it), allows 32 MB uploads for
photo imports, and asks search engines to stay away.

Everything lives in `./data`, one folder per person:

```
data/users/lia/wardrobe.json     her clothes, outfits, plans — readable JSON
data/users/lia/photos/           one file per photo
```

Back that folder up and nothing else matters. Every write goes to a temporary
file and is renamed over the real one, so a power cut leaves the old file or the
new one, never a half-written one.

### How sync behaves

The local database stays the source of truth, so every screen reads IndexedDB
and the app is instant with or without a connection. The engine reconciles that
copy with the server after a change, when the app comes back to the foreground,
when the connection returns, and on a slow heartbeat.

Three properties it holds, because losing someone's clothes is not a recoverable
error:

- **It never removes local data** except when a strictly newer deletion says to.
- **It is safe to interrupt.** There is no two-phase commit anywhere; incoming
  records are written before anything is removed, and the sync cursor is written
  last, so a run that dies halfway leaves both sides consistent and the next run
  finishes the job.
- **It is idempotent.** Running it again changes nothing.

Deletions leave tombstones. Without them a delete is invisible to sync — the
other device still holds the record, pushes it back, and the thing you deleted
reappears. Conflicts are resolved by taking the newest fact for each id, where a
deletion is a fact with a timestamp exactly like an edit.

### Two people, one device

If somebody signs in on a device that already holds another account's wardrobe,
sync goes pull-only and says so: nothing local is uploaded and nothing is
deleted, and there are two buttons — keep only mine, or merge it in.

Two bugs in that path were found by driving the real app, and both are now
covered by tests:

- The client cached "you are Tommy" in localStorage while the session cookie had
  become Lia's, so the guard compared Tommy to Tommy, saw no mismatch, and
  uploaded one person's wardrobe into the other's account. **Identity now comes
  from the server**, and the engine refuses to run if the two disagree.
- The guard was a one-shot: the first pull-only run recorded the new account id,
  so the next run — triggered by the writes the pull itself made — saw matching
  ids and uploaded everything. **The flag is now sticky** until somebody
  deliberately resolves it.

## Where your data lives

In this browser, in IndexedDB — items, outfits, plans, and the photos themselves
as blobs. Signed out there is no server copy at all. That means:

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
    collage       Laying an outfit out as a flat lay
    memories      What the wear log is for — a year ago today, and so on
    weekPlanner   Seven days at once, each against its own forecast
    color         HSL harmony analysis, neutrals, pairing suggestions
    outfitEngine  The rule-based outfit builder (and the AI fallback)
    packingEngine Re-wear planner
    filters       Closet search, filtering, sorting
    stats         Wear counts, colour shares, cost per wear
  db/            IndexedDB: one store per collection, photos kept separate so
                 listing a closet never deserialises an image; migrations/ is a
                 versioned, additive upgrade path — a migration that throws
                 leaves the app unable to open at all
  sync/          merge.ts holds every rule about what wins, as pure functions;
                 engine.ts orchestrates; transport.ts is the seam that lets the
                 whole thing be tested without a server
  store/         Zustand stores, one per concern, hydrated once by AppShell
  lib/           Image processing, background removal, weather, backup, the
                 client half of the AI layer
  server/        Accounts, sessions and the wardrobe files on disk. Nothing
                 here is ever bundled into the browser.
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

## The outfit as a picture

A generated outfit renders as a flat lay, not a list: pieces laid out the way
they fall on a bed, sized by how much of the outfit they carry, tilted so it
reads as cloth rather than a grid. The composition is deterministic — pieces are
placed by slot — and can be rearranged by dragging, in which case the
arrangement is saved with the outfit.

The same placements drive `lib/outfitImage`, which paints the outfit onto a
canvas and hands it to the share sheet, so **what you arrange is exactly what
you send**. Nothing is uploaded and it works offline. Rendering a five-piece
outfit from real photos takes about 300ms on a throttled phone.

**Which one?** — the generator can build a second option, excluding everything
in the first so the two are genuinely different, and share both as a single
picture. This is the one feature in the roadmap that the commercial apps
structurally cannot copy: their user is one person alone with an app.

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

## Archiving, planning, remembering

- **Archive, not delete.** A piece can be taken out of circulation while keeping
  its photo and its wear history. Archived items leave the closet, the
  generator, the stats and the laundry planner — every screen goes through
  `useActiveItems()` rather than the raw store.
- **Plan the week.** One tap fills seven days from what is clean, each against
  that day's forecast. Pieces worn recently carry a scoring penalty rather than
  an exclusion — with one pair of shoes you should still get shoes every day,
  and the rule that survives longest is the one that matters most, which is not
  repeating a top.
- **Memories.** What you wore a year ago today, the coat you have not touched
  since spring, the jeans out four times this fortnight. All of it from records
  already kept, which is what makes logging an outfit worth the tap.

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
