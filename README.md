# FitCheck — web

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

**You need an account before the app will open.** Create one with
`npm run add-user` and put the line it prints into `.env.local`; the steps are
under *Accounts on your own server* below. Everything after that — clothes,
outfits, planning, packing, laundry, stats, weather — needs no further setup and
no keys.

To look around before photographing anything, tap **try a demo wardrobe** on the
home screen (or **You → Load a demo wardrobe**). Demo pieces have no photo and
render as colour blocks, so it stays obvious which ones are placeholders.

Open it on your phone with `npm run dev -- -H 0.0.0.0` and visit the Network URL
it prints. It installs to the home screen as a PWA.

---

## What runs where

**What you type changes what you get.** "I'm going for a run" and "first day at
the new office" produce different clothes, from a keyword table of occasions
that each say how dressed up they are, which styles suit them, and which
garments belong or definitely do not. It is a matcher, not a model: it runs
instantly, works offline, and when it does not recognise a sentence it says
nothing rather than guessing. When the wardrobe cannot cover the occasion it
says that too, rather than quietly putting a blazer on you for the gym.

There is no AI in this app and no API key to buy. Outfits, packing lists,
colour reasoning and the wash planner all come from rules in `src/domain`, which
run instantly, work offline, and can be read and argued with. Weather comes from
Open-Meteo, which needs no key either.

---

## Accounts on your own server

**Nothing is reachable without signing in.** The same shape as Jellyfin: the app
is behind the login rather than the login being an optional extra. A signed-out
request is stopped by `src/middleware.ts` before any page renders, and the data
endpoints refuse outright with a 401.

Signing in also copies the wardrobe to a folder on your own machine, so a lost
phone stops being a fresh start and the same account works on a phone and a
tablet. There is no third party involved and nothing to pay for.

Once signed in it still works offline: the service worker serves the shell, the
wardrobe is in IndexedDB, and the gate only applies to requests that reach the
server. The service worker deliberately refuses to cache a signed-out redirect,
which would otherwise strand an offline app on the sign-in screen.

### Setting it up

```sh
cp .env.example .env.local
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"   # FITCHECK_SECRET
npm run add-user -- lia      # prints a name:salt:hash line for FITCHECK_USERS
npm run add-user -- tommy    # entries are separated by ;
```

Passwords are never stored — only a scrypt hash and its salt — so `.env.local`
does not hand anyone a way in if it leaks. Sessions are an httpOnly cookie
signed with `FITCHECK_SECRET`, so page scripts cannot read them and nobody can
forge one. Ten wrong guesses for a name locks it out for ten minutes.

### Running it on a NAS

```sh
echo "FITCHECK_SECRET=..." > .env
echo "FITCHECK_USERS=..." >> .env
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
    shopping      Whether a piece you are thinking of buying earns its place
    intent        Reading what somebody typed — a run, a wedding, a first day
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

## Outfit of the Day

The home screen's suggestion was labelled *"Suggested for today"*, which is a
hedge on the one screen where confidence is the entire product. It is the
**Outfit of the Day** now — and the name only earns itself because three things
changed behind it.

**It holds still.** The suggestion was rebuilt whenever its inputs moved, and
the weather is one of those inputs, so an outfit could quietly become a
different outfit between breakfast and the front door. The day's pick is
written down and fed back into the engine as pieces to *include*, rather than
laid over the top of the result — which is what keeps the name, the explanation
and the colour notes describing the outfit actually on screen. A pin goes stale
in more ways than by being yesterday's, so a piece archived, deleted or thrown
in the wash drops the lot and the day is picked again: half an outfit is worse
than a fresh one.

**Shuffle rerolls in place.** "Something else" used to be a link to the
generator, which is a whole screen away for what is usually just *not that
one*. It remembers what it has already shown, as a penalty rather than a ban,
so pressing it twice means something and a small wardrobe still gets dressed.

**It has a name worth reading.** `localName` returned "Everyday navy" — a
category with a colour stuck on the end. The engine already knows the hero
piece, what is under it and what the weather is doing, which is enough for
"Cream over indigo", "Navy under the olive" or "Charcoal, wrapped up". Still
deterministic: same closet, same day, same name.

## Changing one piece

The suggestion is a starting point, not a verdict. Each piece can be stepped
forwards or backwards through the other things that would fill that slot —
arrows on every row, and a sideways swipe on the picture itself, because a swipe
is invisible until somebody finds it and a mouse has no swipe at all. Only the
piece you touch changes; the rest of the outfit stays put. A slot with one
garment in it says "only one" rather than offering a dead arrow.

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

The Outfit of the Day carries a **Share** button of its own. The share card was
reachable only from an outfit already saved, which is two screens past the
moment somebody wants to send it — and the picture now carries the Fit Score
badge and the verdict, because a flat lay is a photograph of some clothes and a
flat lay with a number on it is an argument.

**Which one?** — the generator can build a second option, excluding everything
in the first so the two are genuinely different, and share both as a single
picture. This is the one feature in the roadmap that the commercial apps
structurally cannot copy: their user is one person alone with an app.

## Is it any good?

The engine could always say whether an outfit was *valid* — right slots, warm
enough, pitched at the right formality, made only of things you own. None of
that is the question somebody is asking in front of a mirror.

`domain/fitScore` answers the other one, in seven rules, each of which returns a
credit, a deduction, or an admission that it could not tell:

- **Anchor.** 60/30/10, judged on AREA rather than one garment one vote — a pair
  of socks should not argue with a coat on equal terms. One colour across most
  of an outfit is tonal and reads deliberate; two is where the eye stops knowing
  where to go.
- **Volume.** Loose over loose reads as pyjamas, fitted over fitted as a
  costume. Volume against something fitted is the balance stylists lead with.
- **Waistline.** Cutting the body in half shortens the whole silhouette; a tuck,
  a crop or a high rise is what makes the same two garments look considered.
- **Pattern.** Mixing works on scale contrast. Two prints the same size fight,
  and three is past the line.
- **Third piece.** Top, bottom and shoes stops there and reads unfinished. A
  jacket, a knit or one real piece of jewellery is the whole difference — and a
  belt does not count, which is what the focal weights are for.
- **Matching.** A bag matching the shoes matching the belt stopped reading as
  elegant a while ago.
- **Register.** A very-casual tank with formal trousers is what you notice
  across a room.

**Nothing here guesses.** A rule with no data to work from says what would let it
answer — *"say how the indigo jeans fit and the proportions can be judged"* —
rather than scoring the outfit against an assumption, and the card shows those
lines alongside the ones that moved the number. A score nobody can interrogate
is a gimmick; a score that says why is a stylist.

That needed three facts the wardrobe never held: `fit`, `length` and `rise`, plus
`patternScale`. All optional, all undefined until somebody says, and each one
only offered on a garment that can answer it — a pair of sunglasses is never
asked how it is cut.

## What it learns about you

Every wardrobe app claims to learn your style and almost none can tell you what
they learned, because the answer is a vector. This one is a tally.

The strongest preference signal in the whole product is somebody being offered a
garment for a slot and deliberately walking to a different one — and that
happened on the home screen several times a week and was thrown away. It is
written down now, alongside what was actually worn, weighted, decayed on a
sixty-day half-life, and turned into sentences on **You → What it has learned**:

> **You keep putting the olive field jacket back.**
> Offered 7 times, and swapped away from 5 of them. *[Archive it] [That is wrong]*

Four rules hold this honest, and they are the feature:

- **It never states an opinion it cannot evidence.** An observation needs a
  minimum number of occasions before it is offered at all, and always shows the
  count it rests on. One avoided olive jacket is a fact about a jacket — it
  takes two garments before it will say anything about *olive*.
- **It suggests, and never acts.** Nothing is archived, favourited or added to
  the avoid list except by a tap. The engine nudge is smaller than the colours
  you told it to avoid, and it cannot put a dirty shirt back on you or a blazer
  on you for the gym. Those are facts; this is an inference drawn from a few taps.
- **Everything is forgettable.** "That is wrong" unlearns the pieces the
  sentence was about, not just the sentence — hiding the words while the engine
  quietly kept acting on them is the exact failure the screen exists to prevent.
- **Shuffling past an outfit is not recorded at all.** That means *not today*,
  not *not ever*, and treating them the same teaches the app to hide clothes
  somebody likes for reasons it invented.

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

## Before you buy

The question a wardrobe app can answer and a shop cannot: not whether a thing
is nice, but whether anything you own goes with it. Pick a category and a
colour and it answers with a number it can defend — the candidate is treated as
a real garment, forced into the closet, and the outfit engine is asked to dress
five different days around it. What comes back is how many of them completed.

It also names what the piece would pair with, spots something near enough to it
that you already own, and shows which slots the wardrobe is thinnest in.
Pairings are ranked on more than colour: against a neutral almost everything
scores in the high eighties, so what she actually wears, whether the two suit
the same weather, and whether they belong at the same kind of occasion all
count.

## Daily reminders

One push notification a day, sent by this server, with no third party and
nothing to pay for. Set `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` (generate a
pair with `node -e "console.log(require('web-push').generateVAPIDKeys())"`) and
a loop started by `src/instrumentation.ts` sends anything due, once a minute,
in the reader's own timezone.

Three things have to line up before the switch can be turned on, and the
setting says which one is missing rather than pretending: the browser must
support push, permission must be granted, and **on iOS the app must be on the
home screen** — Safari refuses push to a site open in a tab.

The notification is a nudge, not a prediction. The server holds the wardrobe but
not the weather or the reader's units, so an outfit named in a notification
would differ from the one the app shows on open. Saying "your outfit is ready"
is honest; naming the wrong outfit is not.

## How it looks

The chrome is deliberately close to neutral, because the content of this app
*is* colour. A warm cream ground — where this started — tints every garment
photo in the wardrobe; paper and ink let the clothes be the only thing on screen
with a hue. The one accent is a deep pine, dark enough to read as furniture
rather than compete with a garment, and a colour almost nothing in a wardrobe
actually is.

Two typefaces, and nothing is set in both: Fraunces names things — screens,
outfits, the pieces themselves — and Instrument Sans does the reading.

The home screen leads with the outfit, edge to edge, because that is what the
app is for. It used to be one white card in a stack of white cards, below an
install prompt and a request for location — two chores in front of the first
thing anyone opened the app to see. Those now sit underneath it.

The demo wardrobe is drawn in the browser: forty-one silhouettes, one per
category, on a transparent ground. That last part matters more than it sounds.
Drawn onto a backdrop they were paper coasters on a mat; with an alpha channel
they sit on the flat lay exactly the way a real cut-out does, which makes the
demo an honest preview of the app with somebody's own clothes in it.

## Accessories

"Accessory" is not one slot. A watch, a belt and a pair of sunglasses are worn
together, not instead of one another, so they are modelled by **where on the
body they go** — eyes, neck, wrist, fingers, waist, carried, hands. That is what
actually competes: only one thing goes round a wrist at a time.

Three consequences, all of which were bugs before:

- Stepping through alternatives for a watch offers watches and bracelets, not
  belts.
- An outfit can carry several accessories at once, one per position — up to
  three *focal points*, which is the rule stylists actually mean. It used to be
  a cap of three objects, and that is a different claim: a belt half-hidden
  under a jacket spent the same allowance as a statement necklace, so a belt, a
  watch and a pair of sunglasses filled it and the chain never came out of the
  drawer. Now a piece somebody would comment on costs 1, a piece they would
  register costs about a half, and a piece simply doing its job costs a
  fraction — so an outfit can wear five things and still be quiet.
- A headband competes with a hat rather than with the other accessories, which
  is the one place a position crosses a slot. The engine says so out loud
  instead of the position table pretending a beanie is jewellery.
- The closet shelves them by position too, so a drawer of glasses, rings,
  watches and belts is browsable rather than one endless row.

Twelve positions now, not seven: hair, eyes, ears, neck, lapel, wrist, fingers,
waist, legwear, carried, hands. Earrings were missing entirely, which is a
strange omission for the most-worn accessory in the world, and so were the
things 2026 styling has moved to the middle of an outfit — visible socks, a
brooch on a lapel, a scarf worn in the hair.

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
