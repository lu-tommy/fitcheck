# FitCheck — web

Photograph the clothes you already own, and get outfits built from that closet
and nothing else. No shopping suggestions dressed up as styling.

Next.js 16 · React 19 · TypeScript · Tailwind v4 · Zustand · IndexedDB.
No API keys, and nothing to pay for. One optional model, downloaded on request.

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

**Every judgement in this app is a rule you can read.** Outfits, the Fit Score,
packing lists, colour reasoning, the wash planner and what it has learned about
you all come from `src/domain` — arithmetic that runs instantly, works offline,
and can be argued with. Weather comes from Open-Meteo, which needs no key.

There is exactly one model anywhere near it, it is off until you say otherwise,
and it never decides anything: the garment parser reads a photo and offers boxes
somebody then confirms. See *Finding the clothes* below for what it downloads
and how to host it yourself.

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

Cataloguing is where wardrobe apps lose their users — a minute or two a garment,
two or three hours for a real closet — so there are four ways in and none of them
require a key:

- **Let it find them.** See *Finding the clothes*, below.
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

### Without a pointer

The cropper was built entirely around a finger and was, as a result, unusable
without one: the boxes were plain elements, so a desktop user had a mouse-only
tool and a screen-reader user had none at all.

Every box is now focusable and announces where it is in percentages — the only
numbers that mean anything read aloud without the photo in front of you. Arrows
nudge by one screen pixel, shift by ten, alt resizes, delete removes, escape
lets go, and a button places a box in the middle of the view so the keyboard
path does not start at boxes somebody else drew.

Which makes the keys the most precise instrument on the screen. The whole
argument for pinch-zoom is that a fingertip covers a hundred source pixels; an
arrow key covers exactly one, at any magnification, with no loupe and no steady
hand.

### Turning the photo

The crop is exactly the box that was drawn, and it is an *axis-aligned* box —
which is the one thing careful handles cannot fix. A jumper photographed at a
tilt does not fit inside an upright rectangle, so framing it meant drawing a
bigger box and taking the wall back in with it.

So the photo turns: a quarter-turn button and a ±15° straighten. Rotation
rewrites the working image rather than layering a transform over the top, which
is why nothing downstream — the boxes, the crop, the colour detection, the
cut-out, the parser — had to learn about it. Boxes are carried through with it,
exactly on a quarter turn and slightly generously on a straighten, because a box
that clipped a hem would not be noticed until somebody looked at the tile.

## Finding the clothes

Point it at a photo of somebody wearing an outfit and it boxes and names every
garment in one pass — a top, trousers, both shoes as one pair, a bag, a belt.
Boxing by hand is faster here than in most apps and it is still the slow part;
this turns *draw five boxes and pick five categories* into *confirm five chips*.

It is a `SegFormer` fine-tuned on ATR, run through Transformers.js on WebGPU
where the browser has it and WebAssembly where it does not. Four things about
how it is wired in, which are the reason it is a button and not a default:

- **It asks first, in numbers.** 27 MB, once, from `huggingface.co`; after that
  it runs on the device and works offline for good. Your photos never leave the
  phone — only the model comes down. "Uses AI to detect your clothes" tells
  nobody anything they can decide with. Set `NEXT_PUBLIC_MODEL_HOST` to a copy
  you host and the app is back to talking to nothing but your own server.
- **It never replaces the hand path.** Boxes it finds are *added* to anything
  already drawn, never substituted for it — somebody who drew a box could see
  the photograph, which is a better authority than the model. A parse that finds
  nothing says which of the two things went wrong (no garment, or no person)
  rather than leaving an unchanged screen that reads as broken.
- **It suggests; you confirm.** Every box is draggable and deletable, and the
  category only pre-fills where the model was actually sure. Its accuracy is
  wildly uneven by class — a belt is a thin strip the colour of the trousers
  behind it and lands around 35%, against 88% for a top — so a low-confidence
  guess is marked with a query on the box rather than quietly asserted.
- **It cannot take the app down with it.** The library sits behind a dynamic
  import, so it is a 504 KB chunk that people who never turn it on never fetch,
  and every failure resolves to a sentence rather than a rejected promise.

It also settles the cut-out. The flood fill seeds from the edges of a crop and
spreads through anything similar, which works against a plain wall and *cannot*
work against a person: a crop off a mirror selfie has skin, a room and a phone
around the garment, so the fill takes half an arm with it. That is why cropping
deliberately never ran it. A mask trained to tell a sleeve from an arm has no
such difficulty — so a parsed piece arrives already cut to its own outline, on a
transparent ground, the way the drawn demo wardrobe does, and the fill is not
run at all. A belt crossing a pair of trousers is a hole in the trousers' mask
rather than a smear across it.

The judgement lives in `domain/garmentClasses` with no model in it at all: given
a label map, which regions are garments, where each box goes, and how far the
label should be believed. That is why it can be tested against a mask drawn by
hand — including the failure it exists to prevent, where one stray pixel in a
far corner drags a min/max box across the whole photograph. Boxes are taken from
the 2nd to 98th percentile of the mask instead.

Note on licence: the weights carry the SegFormer licence rather than a permissive
one. Fine for a wardrobe on your own server; read it before it goes near a shop.

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

**Which one?** is also a verb. Two saved outfits can be picked off the Outfits
screen and sent as one picture — the case somebody is actually in, torn between
two things already hanging up, rather than between one just invented. While
picking, the rows stop being links: navigating away mid-choice loses the first
pick, and a row that sometimes opens an outfit and sometimes selects it is the
kind of ambiguity people tap twice to test.

In the generator, **Which one?** — it can build a second option, excluding everything
in the first so the two are genuinely different, and share both as a single
picture. This is the one feature in the roadmap that the commercial apps
structurally cannot copy: their user is one person alone with an app.

## Is it any good?

The engine could always say whether an outfit was *valid* — right slots, warm
enough, pitched at the right formality, made only of things you own. None of
that is the question somebody is asking in front of a mirror.

`domain/fitScore` answers the other one, in eight rules, each of which returns a
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
- **Metals.** The old rule was never mix them, and it is gone — what replaced it
  is specific rather than permissive: *repeat each metal at least twice*. One
  lone silver ring among gold reads as an accident; two reads as a decision.
  This cannot be folded into the colour rules and that is why it exists: to a
  colour analyser gold is a warm yellow and silver a light grey, so it sees a
  neutral with a small warm accent and approves — which is exactly the outfit
  somebody looks at later and cannot say what is wrong with. A piece that is
  itself mixed carries both metals and can never be the lone one, which is the
  entire reason those are made.
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

### Answering what it could not judge

Saying *"say how the indigo jeans fit"* on every outfit is honest and, on its
own, a nag: a request with no route to acting on it turns every morning into a
reminder of a chore with no beginning. Tapping that line — or the prompt at the
top of the closet — opens the queue.

One garment at a time, only the questions it can answer, and the ones you
actually wear first: the order is weighted by whether the piece sets an outfit's
proportions at all, how often it is worn, and whether it is a favourite. Log
scale on the wear count, so the jeans you live in come before a scarf worn once
without burying the rest of the wardrobe beneath them. Answering the last
question moves on by itself, because the constraint is the number of taps — a
form that opens, scrolls, saves and closes forty times is the setup grind people
abandon these apps over, and it does not become acceptable for happening later.

**There is no "guess them all" button, and that is deliberate.** A garment's cut
was a candidate for inference — the silhouette module already measures how a
mask narrows at the waist, and a boxy tee laid flat really does differ from a
tapered one. It does not survive where cut-outs now come from: the parser reads
a garment being *worn*, so the outline is the shape of the person inside it and
the difference between fitted and oversized is drape, not width. A wrong fact
here would silently corrupt the rules the queue exists to switch on. Fast and
true beats instant and wrong.

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

## How the whole wardrobe scores

The Fit Score judges one outfit, which answers *is this good* and never *why is
getting dressed hard on Tuesdays*. The second is the more useful question: it is
a fact about the wardrobe rather than about a morning, and it is the only one of
the two anybody can act on when they are next in a shop.

So `domain/wardrobeReport` dresses the wardrobe against itself — every top
against every bottom, each dress on its own — scores each outfit exactly the way
the home screen scores today, and reads it backwards. The average, the best
pairing, the pieces that lift whatever they are put with, and the pieces that
are harder to place. The pairing is quadratic, so it is capped at twelve a side
by wear count: a hundred and forty-four builds, which runs in a blink.

**A piece is never called bad.** "Harder to place" is the accurate statement as
well as the kind one — a garment scores low because of what is *around* it in
this particular wardrobe, and the same coat in a different closet would be fine.

The reason it names took two goes to get right. Naming the deduction that fired
most often around a piece produces nonsense: a closet with no jackets loses the
third-piece mark on *every* outfit, so reporting it against one garment says
nothing about that garment. What earns a mention is a rule that fires **more
around this piece than it fires everywhere else** — which for a pair of tuxedo
trousers in a casual wardrobe is *"usually because it is dressier or plainer
than what it goes with"*, and that is a sentence somebody can do something with.

## One piece, ten ways

The app is a very good ten seconds in the morning and, on its own, a thin reason
to open at any other time. The format that answers that is not a prettier home
screen: it is the one styling idea that reliably outperforms a fit check —
take something somebody already owns and show them ten outfits they did not know
were in the wardrobe. Every app could build it; only one built on a photographed
closet can build it **from your own clothes**, which is the only version worth
looking at twice.

The difficulty is that ten builds of a deterministic engine give ten of the same
outfit. Two things pull them apart, both already in the engine:

- **Ask ten different questions.** A jumper for a cold Tuesday and a jumper for
  dinner are genuinely different outfits, so the contexts vary the occasion and
  the weather rather than a random seed.
- **Remember what has been used.** Everything worn in an earlier look is put to
  rest for the later ones — a penalty rather than a ban, so a wardrobe of
  fifteen pieces still yields ten looks instead of running dry at four.

Tapping a look saves it, so the screen is a way into the wardrobe rather than a
poster of it, and **Share** renders the grid as one picture. The button only
appears where there is something to show: four looks is a feature and two is an
apology, so the count is taken before the button rather than after it is pressed.

## Streaks, on the right thing

Streaks are the cheapest retention mechanic there is and the easiest to point at
the wrong behaviour. A streak counting *new outfits* teaches somebody that
repeating a jumper is a failure — which is exactly the pressure this app exists
to remove, and it would be doing it in the name of engagement. That version is
not built here and should not be later.

What is counted is **logging**. It costs one tap, it can be satisfied by wearing
precisely what you wore yesterday, and every log feeds the wear history, the
cost per wear, the memories and the taste model — so rewarding it rewards the
thing that makes the rest of the app work. The copy says so outright, on the
screen most likely to imply otherwise: *"Wearing the same jeans counts — that is
rather the point."*

Two kindnesses in the arithmetic. A run stays alive until the day after a missed
one, so opening the app at breakfast never shows a streak just broken by not
having got dressed yet. And the week is reported next to the run, because five
days out of seven is a good week and a broken streak, and a screen that only
knows how to say the second thing is lying by omission.

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

## Reading the outfits out loud

Every unit test here builds the smallest closet that proves one rule. That is
the right way to test a rule and no way at all to answer the question somebody
actually has in front of a mirror: *does this dress me like a person, or like a
spreadsheet?*

`wardrobeAudit.test.ts` runs the real engine over a real forty-two piece
wardrobe across ten scenarios and prints what comes out. Run
`npx vitest run wardrobeAudit --reporter=verbose` and read it.

The first time it was run it produced a clown show, and every one of these was
a rule that passed its own unit test:

- **It preferred the clothes she never wears.** Wear count was a straight
  penalty capped at twelve, so a white tee worn forty-two times and marked a
  favourite scored −12 +8 = −4 while a purple satin shirt bought once and
  regretted scored −0.6. The regretted shirt started three and a half points
  ahead — more than the seasonality bonus — and appeared in **seven of ten
  outfits**. Wear count is evidence, not a debt; variety now comes from when a
  piece was last on, which is a different fact and the one that was missing.
- **It dressed for the month, not the weather.** Thirty-one degrees in
  September produced a long-sleeved top and fleece joggers, because both are
  autumn garments. The thermometer outranks the calendar at the extremes now,
  and only there — a mild March day and a mild October day genuinely want
  different things.
- **Heeled pumps at minus two, and no coat.** Footwear barely felt the weather.
- **A wool scarf, gold hoops, a signet ring and a belt — to the gym.** The
  accessory budget had no idea what the outfit was for.
- **Sunglasses to dinner on a fourteen-degree evening**, because the accessory
  loop took the best thing that *fit the budget* rather than the best thing
  that was any good. A budget is a ceiling, never a quota.
- **A formal dress lost a wedding to an Oxford shirt**, because a dress had to
  beat the best top by fifteen points alone — a hurdle nothing clears. It stands
  in for a top *and* a bottom, so it is compared against both.
- **A chunky oatmeal jumper over a black silk wrap dress**, because a dress and
  a pair of shoes carry no warmth and the arithmetic said the outfit was one
  point short at twenty degrees.
- **The engine built outfits its own score then marked down** — one gold thing
  and one silver thing — which reads as the app arguing with itself.

Every one is now a named scenario in that file, written as "does not put fleece
and long sleeves on her in a heatwave" rather than as a unit test, because that
is how they were found: not by a rule failing in isolation, but by reading ten
outfits and wincing.

- **Colour nuance was outvoting garment sense.** The harmony bonus ranged from
  about −20 to +13 — wider than a whole step of formality — so a pair of fleece
  joggers beat a pair of jeans for an ordinary day out because grey sits against
  navy with more contrast than black does. Whether a garment suits where you are
  going is a fact about the occasion; whether two hexes get on is a tie-breaker,
  and it is clamped to one now.

**A test was protecting the worst of them.** `prefers the less-worn of two
equivalent pieces` asserted the inversion as if it were the feature.

## Finding the holes, rather than checking the parts

Reading ten outfits catches bad answers and is blind to missing questions — a
category nothing can pick, a sentence nobody parsed, a kind of weather the
engine has never heard of. Those do not fail a test; they simply never come up.

`coverageAudit.test.ts` walks the whole surface instead, and is written to fail
where there is a hole. What it found:

- **The engine had never heard of rain.** The forecast is fetched, stored and
  shown on the home screen, and the outfit builder read exactly one field of it:
  the temperature. A downpour and a clear day at the same twelve degrees
  produced the identical outfit, suede boots and all. Waterproofing is now a
  *property* rather than a list of coat names — a trench, a shell and a pair of
  rubber boots are all waterproof and nothing about their categories says so —
  and rain is a reason for a coat in its own right, not only cold.
- **A funeral was literally a wedding.** "Funeral" was a keyword on the wedding
  rule, so the app read the two as the same day and announced it had built
  "a wedding look". Both are formal; they are not remotely the same occasion.
  A funeral has its own rule now, and asks for black.
- **"Running errands" and "the school run" dressed you for the gym.** `run` is
  a keyword for the athletic rule and also half of both phrases, so somebody
  popping to the shops had jeans, shirts and boots actively ruled out. A
  whole-word match is not enough when the word does two jobs; rules can veto.
- **Seven kinds of day could not be read at all** — a graduation, a festival,
  the pub, a barbecue, the theatre, a baby shower, going out out.
- **Leggings did not exist.** They fell back to *Other*, which is an accessory,
  so a garment a great many people wear most days could never be a bottom.
  Seven more were missing with them: turtleneck, overshirt, raincoat, swimwear,
  flats, rain boots and an umbrella — each chosen because it lets the engine
  express something it could not before, rather than to lengthen the list.
- **The demo drew 22 of 55 silhouettes.** It is the only place all of them are
  ever rendered, so thirty-three drawings had never been looked at — and a
  capsule with no dress, no coat and no shoes but trainers is not one anybody
  recognises. It is one of everything again, as it says it is.
- **It called the day back to you by the wrong name.** Type "the gym" and it
  announced "a run look". One rule can serve several days that dress alike; the
  label still has to be the word that was used.

### Two more the days themselves exposed

Running the twenty-two scenarios again found two things the coverage sweep could
not, because both are about strength rather than presence:

- **The occasion could overrule the weather.** What a day asks for was worth
  +60 — more than the seasonality penalty, more than the waterproof bonus, more
  than the two combined can answer — so *"going to work"* put a wool blazer on
  somebody in a downpour, walking straight past a raincoat, because the work
  rule lists a blazer among the things that suit an office. The occasion says
  what *kind* of garment suits the day; the weather says whether that garment is
  wearable today, and it has to be able to say so. The wrong coat is marked down
  now as well as the right one marked up, on every coat equally, so a wardrobe
  with nothing waterproof still gets one.
- **A colour request matched a spelling, not a colour.** A funeral asks for
  black, and charcoal, navy and a dark grey coat contain none of those six
  letters — so the app agreed the day wanted black and then went looking for the
  word, and put an oatmeal jumper over a black dress. Colours are compared as
  colours now: asking for black is asking for *dark and neutral*, which navy and
  charcoal answer and burgundy does not, and asking for blue finds denim.

## When it cannot dress you

The engine only ever uses clothes you own. That promise has a corollary it was
not honouring: sometimes the honest answer is **you do not own this**.

Asked to dress for a wedding out of a casual wardrobe, it produced a white
t-shirt with charcoal dress trousers and trainers, scored it 48 out of 100,
called it *"something in here is fighting"* — and presented it as the answer,
with the real problem in a warning underneath. It gave the same outfit for a job
interview and for a funeral. An app built on *wear what you own* improvising an
outfit it has already worked out is wrong is the one thing it must not do.

So a slot is now **declined** rather than filled badly, where two conditions
both hold: an occasion was actually named, and nothing available is within three
formality steps of it — three being where the outfit scorer starts charging real
points and where a person starts noticing across a room. Two steps, an Oxford
shirt with jeans, is simply an outfit.

What comes back instead names the gap and what would fill it:

> **Top** — Nothing you own suits a wedding. Look for: shirt, blouse.
> *The closest you own is your white tee.* **[Add to wishlist]**

Three things keep it honest:

- **Only where an occasion was named.** Somebody who has not said where they are
  going is going about their day, and *better the wrong shoes than none* still
  holds for an ordinary Tuesday. It stops holding at a funeral.
- **What does work is still worn.** The dress trousers stay; it is not
  all-or-nothing.
- **A piece asked for by name is never declined.** Overruling a deliberate
  choice is a different kind of wrong.

The suggestions come from the occasion's own list of what belongs there — the
wedding rule already says a shirt and a blouse suit one — rather than from a
second table that would drift away from the first. And they are written as a
shopping list rather than a sentence, because the category labels are a mix of
singular and plural and any phrasing with an article produces *"a shorts or
joggers"* for somebody to read on a Tuesday morning.

### Five more of the same shape

Once the engine was allowed to say "you do not own this", the same failure
turned up in five more places — a number, a garment or a verdict produced where
the honest answer was *there is nothing here to judge*:

- **An empty outfit scored 60 out of 100**, "fine, if a bit quiet". A single
  pair of trousers scored 52, "something in here is fighting" — with nothing to
  fight. Every rule that fired did so by accident. There is no score now until
  it is a whole outfit, and the card says which piece is missing instead.
- **A jumper worn on its own was not a whole outfit**, because the check
  demanded the `top` slot specifically. That is what a great many people wear
  all winter, and it was being dropped from the ten-ways screen entirely.
- **Warmth was only ever a penalty.** A light garment lost points in the cold
  and nothing ever gained any, so a wool coat and an olive field jacket scored
  identically at three degrees — the engine had no way to prefer the warmer of
  two suitable coats, which is the whole question on a cold morning.
- **A coat was skipped when the layers happened to add up.** A jumper, a shirt,
  jeans and boots met the warmth target at three degrees, so the engine stopped
  — sending somebody out into it with no coat because the sums balanced. Below
  about eight degrees a coat is not an optimisation.
- **Outerwear was judged as strictly as a shirt.** A wool coat over jeans is two
  formality steps out and completely ordinary; at full weight that alone lost it
  to a field jacket in the cold. A coat is the one thing everybody wears across
  registers.

And one more of the engine disagreeing with its own critic: **it assembled a
third colour that the score then marked down** — green wellies, a burgundy scarf
and a gold ring on the same school run. Harmony is clamped to four points either
way, deliberately, so it was far too weak to notice a third hue arriving. An
accessory is never worth a third colour, so that is a gate rather than a cost;
the garments that carry the outfit still take it as a cost, because leaving
somebody without trousers is not free.

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
