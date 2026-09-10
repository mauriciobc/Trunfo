# TRUNFO — Top Trumps

A web-based, single-player Top Trumps game. Compare your card's statistics
against the computer, win the round, and collect the whole deck. Built with
plain HTML5, CSS3 and vanilla JavaScript — no framework, no backend.

## 🎮 Play

Open `src/index.html` directly in a browser, or build the optimised bundle and
open `dist/index.html`:

```bash
npm install
npm run build
# then open dist/index.html
```

The game uses classic `<script>` tags, so it runs straight from `file://`
without a web server.

## 🎲 How to play

The shipped rules are the printed **Super Trunfo** ones:

1. The deck is shuffled and split equally; each side forms a face-down stack and
   sees only its top card.
2. Whoever holds the choice picks a category on their top card and announces it.
   Both top cards are revealed and that category is compared.
3. The higher value takes both cards, plus anything already on the table, and puts
   them at the bottom of the winner's stack — except on a stat marked **↓**, where
   the lowest value wins.
4. On a tie the cards stay on the table and the same chooser picks a category from
   their next card; whoever wins that comparison takes everything on the table.
5. The winner of the round chooses next round's category.
6. **The Super Trunfo card** beats every card in the deck, whatever the category
   and whatever the values — unless it meets a **“1” card** (the first group,
   1A–1D), which beats it and takes the round.
7. The game ends when one player holds every card.

A deck is a **Trunfo deck**: 32 cards in eight groups of four, coded **1A–1D,
2A–2D, … 8A–8D**. The circle badge on a card carries its code, exactly as it does
on the printed card. The grouping is what the deck is built from — a custom deck
is written in whole groups of four, up to eight of them — and a group may mean
something (the built-in decks group big cats, or performance sedans, together) or
nothing at all. The “1” cards of rule 6 are therefore the four cards of the first
group, whatever the deck's theme.

### Built-in decks

| Deck                        | Theme              | Artwork     | Stats                                                       |
| --------------------------- | ------------------ | ----------- | ----------------------------------------------------------- |
| `awesome-animals` (default) | Awesome Animals    | emoji       | Size, Speed, Lifespan — 32 animals (8 groups of 4)          |
| `electric-cars-2026`        | 2026 Electric Cars | photographs | Range, Power, Top speed, Fast charge, 0–100 km/h ↓ — 32 EVs |

Each deck ships its own Super Trunfo card: the **Crocodile** (8D) in the animals
deck — beaten only by the big cats of 1A–1D — and the **Tesla Cybertruck
Cyberbeast** (7C) in the car deck, beaten only by the performance sedans of the
first group. A deck of your own can mark any one card the same way.

Most stats are "higher is better". A deck can mark a stat as "lower is better" —
a 0–100 time, a price, a lap time — and the engine then awards the round to the
smaller number; the card shows a small **↓** beside it. The car deck's
0–100 km/h time is one, so the quicker car wins that column.

> The car figures are **illustrative**: rounded, from widely reported
> manufacturer and press numbers, and they vary by market, trim, wheel size and
> test cycle. Treat that deck as sample content, not a specification sheet.

The car deck's thirty-two photographs are bundled with the app in
`src/assets/cars/`. They come from
[Wikimedia Commons](https://commons.wikimedia.org/) under the licences
listed in [`src/assets/cars/CREDITS.md`](src/assets/cars/CREDITS.md) — mostly
CC BY-SA 4.0 — and each was downscaled to 640px and stripped of metadata. **Keep
that file with the deck if you redistribute it**; the licences require
attribution. Re-fetch or re-pin them with:

```bash
npm run fetch:cars              # download anything missing
npm run fetch:cars -- --force   # re-download everything from pinned files
```

`tools/fetch-car-images.js` queries the Commons API and records the author and
licence for each file, so the credits survive a re-run. A card with no
photograph falls back to its emoji, and a photograph that fails to load degrades
to the emoji rather than showing a broken image.

### How the computer plays

There is no difficulty setting: the computer has three ways to pick a category,
and it **draws one at random for each round it leads**, so it does not play the
same way every time.

| Mode       | How it picks                                                          |
| ---------- | --------------------------------------------------------------------- |
| `random`   | a stat at random off its own card                                     |
| `best`     | the stat where its card is furthest from the losing end, in raw units |
| `adaptive` | the same, normalised across the deck's own range (fair across scales) |

All three honour a stat's direction, so a "lowest wins" column is never played as
if the biggest number were best. A game can pin one mode —
`createGame(theme, { ai: 'adaptive' })`, or `TrunfoUI.configure({ ai })` — which
is how the seeded simulations and browser scenarios stay deterministic; the
shipped default is `Engine.MIXED_AI`, the per-round draw. The mode that chose each
round is recorded in the round log and reported in the match summary
("Computer picks — Best number ×6 · Random stat ×4 · …").

### Round-limit backstop

The engine keeps a **300-round** cap so that a game cannot run forever; if it is
reached, the larger pile wins and the game-over panel says so. It is a backstop,
not a rule: with the shipped rules and mixed AI, 2,000 seeded games on the 32-card
animals deck ended by emptying a pile 96.5% of the time (averaging 97 rounds), and
the five-stat car deck 70.5% (averaging 170). The Super Trunfo card lengthens both
— a card that wins every round except against a “1” card keeps the lead swinging —
and the car deck's figures are close enough that its games run long. The cap was
150 for the 16-card deck and moved with the deck; `{ roundLimit: 0 }` to
`createGame` removes it.

### Controls

| Control      | Effect                                                                                                                                           |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Deck**     | Which deck to play. Custom decks are marked with a star.                                                                                         |
| **New deck** | Opens the deck creator.                                                                                                                          |
| **Fast**     | Shortens the reveal and the computer's think time, for long games.                                                                               |
| **Rules**    | Rules panel.                                                                                                                                     |
| **Restart**  | Re-deals with the current settings.                                                                                                              |
| **Language** | Switches the interface between English and Brazilian Portuguese. The flag is the language in use; the tooltip names the one a click switches to. |

## 🌍 Languages

The game ships in English and **Brazilian Portuguese** (`pt-BR`). Every string
lives in one catalog — `src/js/i18n.js` — and the two languages are key-for-key
identical, which `tests/i18n.test.js` enforces. The active language is chosen
per page in this order:

1. a `?lang=` query parameter, so a link can pin one — `index.html?lang=pt-BR`;
2. the last choice made with the topbar button (kept in `localStorage`);
3. the browser's own preference list;
4. English.

A regional variant with no catalog of its own falls back to the closest shipped
language: `pt-PT` reads `pt-BR`. Switching language re-renders the board, the
status line, the deck picker and open panels in place — the dealt cards are
untouched, so an in-progress match is never re-dealt.

The switch is one small **flag button** in the topbar, which keeps the chrome
narrow enough that neither language wraps the topbar at any tested width. The
flag shows the language in use and the accessible name (also the tooltip) says
what a click does — "Switch language to Português (BR)". It advances to the next
entry in `LOCALES`, so with two languages it is a toggle, and a third language
would turn it into a cycle without needing a menu. A flag stands for a language
here, not for a country: `en` ships as one catalog, so it takes the flag of the
language's origin rather than borrowing a region from `en-US`.

Three kinds of text are translated:

| Text                     | Where it comes from                                                                 |
| ------------------------ | ----------------------------------------------------------------------------------- |
| Interface copy           | `data-i18n` attributes in the markup, and `I18n.t()` in the controllers.            |
| Built-in deck content    | An `i18n` block per theme in `deck.js`: theme name, stat labels, units, card names. |
| Store and artwork errors | The same catalogs, so a validation message arrives in the reader's language.        |

Deck names and card text a player writes stay exactly as written: a custom deck
is its author's copy. Numbers are formatted for the language too (`1.020` in
`pt-BR`, `1,020` in English), and so are plurals — Portuguese says "1 carta",
"0 cartas".

Adding a language is three steps: add a catalog to `src/js/i18n.js`, list it in
`LOCALES`, and translate the built-in decks' `i18n` blocks in `deck.js`. The
catalog test will name any key you miss.

## 🃏 Creating decks

`src/create.html` is a deck creator. A deck has a name, up to **five stats**
(each with a unit and a comparison rule) and whole **groups of four cards** — 1A–1D
up to 8A–8D, so between 4 and 32 cards; every card needs a name and a number for
each stat. Cards can also carry **artwork**: pick an image and it is downscaled to
a 640px edge and re-encoded before it is stored, so a 5 MB photo does not end up
in the database.

| Step            | What happens                                                                                                                                                       |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Name and stats  | Each stat takes a unit and a rule — **Highest wins** (the default) or **Lowest wins** for a time, price or weight.                                                 |
| Cards           | A table in groups of four, each row carrying its code (1A, 1B…): one column per stat, plus an artwork cell with a thumbnail, an "Image" picker and a clear button. |
| Groups          | **Add a group of four** appends four rows; the ✕ on a group header removes that whole group. A deck is never edited in loose cards.                                |
| Super Trunfo    | One checkbox per row marks the deck's Super Trunfo card; ticking one clears the rest, since a deck holds one.                                                      |
| Save            | Validated and written to the local database; the deck then appears in the game's deck picker.                                                                      |
| Saved decks     | Load one back into the form, delete it, or export it.                                                                                                              |
| Export / import | JSON, with the artwork inlined so a file is self-contained. Import accepts one deck or an array.                                                                   |

### Storage

Everything local — there is still no backend:

| Data          | Where                                                      |
| ------------- | ---------------------------------------------------------- |
| Custom decks  | IndexedDB database `trunfo`, object store `decks`          |
| Card artwork  | object store `images`, referenced from a card by `imageId` |
| Selected deck | object store `meta`                                        |

Cards reference artwork by id rather than embedding it, so re-uploading one
picture does not rewrite the whole deck. Images no deck refers to any more are
pruned when a deck is deleted and when the creator opens. If a browser refuses
IndexedDB the store falls back to memory and says so instead of failing silently.

Decks created by the pre-database build (in `localStorage`) are migrated into the
database on first load. A legacy deck that does not fit the current layout — not
a whole number of groups of four, or more than 32 cards — cannot be carried over;
the creator reports how many were left behind rather than dropping them in
silence.

## 🎨 Card design & motion

Cards are modelled on the classic Brazilian **Trunfo** layout: a coloured card
rim, a numbered circle badge carrying the card's code (1A…8D), a yellow title
banner, a framed art window, a bold name plate and a ruled yellow stats table —
plus a starburst seal reading **Round win** on the card that took the round. The
deck's Super Trunfo card carries a gold **Super Trunfo** seal instead, all game
long, and a round it decides says so in the status line.

Every internal dimension of the card is a container-query unit, so the card
stays legible from roughly 150px to 340px wide. The layout switches between two
stacked rows and two side-by-side columns depending on the room available.

### Surface shaders

The card stock is not an image — it is generated by **two GLSL fragment shaders**
in `src/js/paper.js`. Each renders once into an offscreen canvas, serialises to a
small JPEG tile and is published to CSS as a custom property.

| Variant | Surface   | Looks like                                                               | Blended with                                                                                     | CSS variable    |
| ------- | --------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ | --------------- |
| `paper` | card face | matte stock: value-noise fibres, fine grain, slow mottle                 | `multiply`, as a full-card overlay, so the grain runs across the picture and the stats table too | `--paper-grain` |
| `gloss` | card back | lacquer: faint orange peel, sparse hairline scratches, occasional glints | `screen`, so it adds light rather than dirt                                                      | `--gloss-sheen` |

The back also carries a broad specular reflection of the lamp over the table, and
the card **leans in 3D under the cursor** — `perspective` on the slot, `rotateY` /
`rotateX` from the pointer, a `drop-shadow` thrown away from the lean. Pick it up,
tip it towards the light, and the reflection slides across the surface.

The pointer only ever supplies the _tilt_. The reflection itself is derived from
the pose that tilt produced, and `js/ui.js` reads that pose — yaw, pitch, roll,
translation and foreshortening — back out of `getComputedStyle`. So the same code
drives the light for the deal, the flip, the fly-to-winner and the pot sweep
without duplicating a single keyframe, and the reflection always runs _against_
the motion rather than tracking the cursor.

The reflection also **eases in once the card lands**. It is held at zero opacity
while the card is turning — dropped instantly, not faded, so it is simply absent
rather than dimming out of view — and then fades up over ~520 ms from the moment
the flip finishes. Without that it snapped on the instant the back was rendered
and the card read as a flat light rather than a surface catching a lamp. The
browser scenario asserts the three things that make it work: the fade is
declared, it eases up to a visible strength, and the overlay is at zero while
`flip-out` is on the card.

It is all skipped under `prefers-reduced-motion: reduce`, where the card holds
still and the reflection sits where the stylesheet puts it. That path needs one
extra rule: with no animation there is no `animationend`, so `flip-out` never
comes off the card — and without an override the reflection would stay hidden for
good.

> **Gotcha worth knowing.** `mix-blend-mode` is not applied to a layer inside a 3D
> rendering context. `perspective` on the card slot is fine, but putting
> `transform-style: preserve-3d` on the card extends that context over the gloss
> layers inside it — where they lose the backdrop they blend against and paint at
> full strength instead. Frozen mid-flip with opacity pinned to 1, so the only
> variable is `transform-style`, `flat` renders a mean luminance of **80.2** and
> `preserve-3d` **94.0**: a milky wash over the whole back, visible for the entire
> flip. The card is a flat plane, so `flat` is also simply the correct value.
>
> Two things make this easy to miss. `mix-blend-mode` still _reports_ `screen`
> while it is not being applied, so asserting on the blend mode proves nothing —
> the browser scenario asserts `transform-style` instead. And the flip keyframes
> end on an identity transform that still carries `perspective()`, which
> `fill: both` leaves applied; `js/ui.js` drops the flip class on `animationend`
> so no `matrix3d` lingers either.

Every noise lattice wraps at the tile edge, so a repeated tile has no visible
seam, and the low-frequency terms are deliberately weak: a strong low-frequency
feature is the one thing that makes a repeating tile read as repeating. The gloss
scratches were softened from a first pass that read as brushed metal rather than
lacquer.

It is all a progressive enhancement. If WebGL is unavailable or a shader fails to
compile, `apply()` returns `false`, the custom properties stay unset, `none` drops
out of the background stacks and the gradients and patterns stand alone. Nothing
breaks and nothing is left half-applied.

| Motion                | What it communicates                                       |
| --------------------- | ---------------------------------------------------------- |
| Card lean             | The back tips towards the cursor and its reflection slides |
| Deal-in               | Both piles fly out from the middle of the table            |
| Stack layers          | Offset card backs behind each pile show how deep it is     |
| Reveal flip           | The computer's card rotates over when a round resolves     |
| Fly-to-winner         | The losing card arcs into the winner's pile                |
| Pot sweep             | On a draw both cards sweep down into the pot               |
| Stat fill & row flash | The compared stat grows and flashes green/red/amber        |
| Seal pop              | The winner's starburst springs in                          |
| Counter & pot bump    | Pile counts and the pot pulse when they change             |

Everything above is disabled under `prefers-reduced-motion: reduce`, and the
overlays trap focus (via `inert` plus a Tab fallback) and close on `Escape`.

## 🗂️ Project structure

```
src/
  index.html        Game markup (board, rules, game-over overlay)
  create.html       Deck creator markup
  css/styles.css    Trunfo card design, pile stacks, motion and builder styles
  js/deck.js        Built-in themes: Awesome Animals and 2026 Electric Cars,
                    each with its pt-BR content
  js/i18n.js        Every interface string, in every shipped language
  assets/cars/      Bundled card photographs + CREDITS.md
  js/engine.js      Pure game rules — no DOM, deterministic with a seeded RNG
  js/decks.js       Local database: deck catalogue, artwork, import/export
  js/images.js      Downscales a picked picture into a storable data URL
  js/paper.js       GLSL surface shaders: matte paper for the face, gloss for the back
  js/ui.js          DOM controller: rendering, clicks, reveal timing, dynamics
  js/create.js      Deck creator controller
tests/
  engine.test.js       Engine unit + simulation suite
  decks.test.js        Deck store: validation, persistence, artwork, import/export
  i18n.test.js         Catalog parity, plurals, formats, deck and error translations
  browser.html         Game harness (?case=playthrough|draw|solo|customDeck|cars|lowerWins|locale|long|responsive)
  builder.html         Deck creator harness (generated - see tools/)
  run-browser-test.js  Headless Chromium runner, drives the page over CDP
  index.html           Browser report for the engine suite
tools/
  measure-layout.js         Prints the real chrome/overflow at every tested viewport
  make-builder-harness.py   Regenerates tests/builder.html from src/create.html
  fetch-car-images.js       Downloads and credits the car deck's photographs
build.js            Minifies src/ into dist/ and fingerprints asset URLs
eslint.config.js    Lint rules    |  tsconfig.json  Type checking (checkJs)
```

The engine is deliberately separate from the UI. `engine.js` implements the
documented functions — `createDeck`, `shuffleDeck`, `dealCards`, `compareCards`,
`updateState`, `playRound`, `checkGameOver` — plus `summarise` for the match
report and `cardCode`, which numbers a deck 1A–8D, and is exercised without a
browser. `decks.js` is likewise pure logic over a pluggable backend, so its whole
surface is unit-testable in Node.

## 🧪 Testing

```bash
npm run verify        # lint + type check + unit tests + build + browser tests
npm test              # 66 engine + 44 deck-store + 30 localization tests
npm run test:browser  # 21 DOM scenarios: game, deck creator, shaders, layout, language
npm run test:shots    # the same, saving screenshots to tests/screenshots/
npm run measure:layout  # real chrome/overflow at every tested viewport
npm run lint          # ESLint
npm run typecheck     # tsc --checkJs over the engine, store, i18n and their tests
```

`npm run test:browser -- --only=customDeck` runs a single scenario, which is much
quicker while iterating.

The browser suite covers a one-round playthrough (card anatomy, the code on the
badge, animation classes, per-side highlight colours, modal accessibility), the
draw/pot path, a degenerate one-card deck that is over at deal time, a custom
five-stat deck with artwork read back from IndexedDB, a **lower-wins** stat that
resolves to the smaller value and marks itself on the card, the Super Trunfo rule
played both ways round (the trump taking a round, and a “1” card taking it off the
trump), a full 32-card game played to completion, the deck-creator form end to end
(groups of four, a picked image downscaled, a comparison rule and the trump mark
saved), the 2026 Electric Cars deck and its 32-card layout, and layout overflow at
seven viewport sizes from 480×900 to 1600×1200.

The scenarios are asynchronous, so the runner drives the page over the DevTools
protocol and waits for it to report rather than screenshotting a fixed moment.
It skips cleanly when no Chromium/Chrome is installed; set `CHROME_BIN` to point
at one. `tests/index.html` runs the engine suite in a browser if you prefer a
visual report.

## 🛠️ Development

Requires Node.js 22+ (only for the build and tests — the game itself needs
nothing; the browser scenarios use the global `WebSocket` to drive Chrome).

```bash
npm install
npm run verify
```

`build.js` cleans `dist/`, minifies every HTML/CSS/JS file from `src/`, appends
a content hash to each asset URL so caches can never serve a stale file, and
emits `.nojekyll`. Pushing to `main` (or opening a PR) runs lint, type check,
tests and the browser suite; only a push to `main` deploys `dist/`.
See `.github/workflows/deploy.yml`.

## 🧱 Tech stack

| Layer   | Choice                                                    |
| ------- | --------------------------------------------------------- |
| Markup  | HTML5                                                     |
| Styling | CSS3 (custom properties, grid, container queries, motion) |
| Logic   | Vanilla JavaScript (no framework, classic scripts)        |
| Storage | IndexedDB for decks and artwork, in-memory otherwise      |
| Build   | Node.js + terser / clean-css / html-minifier-terser       |
| Quality | ESLint, Prettier, TypeScript `checkJs`, headless Chromium |

No runtime dependencies: the game itself loads five plain scripts and needs
nothing installed. WebGL is used only for the paper texture, and only if the
browser offers it.

Modern browsers only: the card relies on container query units, the dialogs use
`inert`, storage uses IndexedDB, and the paper texture needs WebGL (it degrades to
plain gradients without it). Layout is verified down to 480px wide; the
original brief defers full mobile support.

## 📐 Spec compliance notes

The shipped game follows the printed **Super Trunfo** rules: the deck's structure
(32 cards, eight groups of four, 1A–1D … 8A–8D), the tie handling (the cards stay
on the table and the same chooser picks again from their next card), the Super
Trunfo card and the “1” cards that beat it, and the end condition (all cards in
one hand). `Product-Documentation.md` describes a plainer game — one deck, highest
value wins — and the differences are listed below.

What remains is either an additive feature or a documented judgement call:

- **Per-stat comparison direction.** A deck may name a stat in `directions`
  (for example `{ "acceleration": "lower" }`) so the engine awards that column
  to the lowest value. The documents describe only "higher wins", so this is
  additive: `DIRECTIONS` in `src/js/engine.js` defaults every unnamed stat to the
  documented rule, and a hand-written deck that omits `directions` plays exactly
  as before. The car deck uses it for its 0–100 km/h time.
- **Round-limit backstop.** `DEFAULT_ROUND_LIMIT` in `src/js/engine.js` (300) is
  a backstop for a game that cannot end; with the shipped rules it fires for about
  30% of car-deck games and 3.5% of animals-deck games (2,000 seeds each). It
  exists so a deck cannot create a game that never ends; `{ roundLimit: 0 }`
  removes it.
- **Super Trunfo and the “1” cards.** The printed rule is implemented as printed:
  a marked card beats every card whatever the category, and a “1” card — the first
  group, 1A–1D — beats it. `compareCards` in `src/js/engine.js` owns that;
  `src/js/deck.js` says which card in each shipped deck carries the mark, and the
  deck creator offers it per card. One trump per deck is enforced by
  `src/js/decks.js`.
- **Ties.** The printed rule leaves the tied cards on the table and has the same
  chooser pick again from their next card; the winner of that comparison takes
  everything on the table. That is what the engine does — the "pot" is the cards
  on the table, and it only changes hands when a round is won. `Product-
Documentation.md` phrased the same idea as a pot claimed by the next round's
  winner, which is why the interface still calls it a pot.
- **Deck size and backstop scaling.** `Product-Documentation.md` does not state a
  deck size; the shipped decks (and everything the creator builds) use the printed
  layout of 32 cards in eight groups of four, so the round-limit backstop moved
  from 150 to 300 with the deck.
- **Full reveal.** The comparison is required to reveal the computer's chosen
  value; the UI reveals the whole card and highlights the compared stat. That is
  a superset of the requirement, not a contradiction, and it matches how the
  physical game is played.
- **Deck shape.** The documents describe a themed deck but not its size. The
  shipped decks — and every deck the creator will build — are the classic Trunfo
  layout: 32 cards in eight groups of four, 1A–1D … 8A–8D, with the code on the
  card's badge. `CARDS_PER_GROUP` and `MAX_GROUPS` live in `src/js/engine.js`,
  which mints the code from the card's position; `src/js/decks.js` enforces the
  same shape on a player's deck, so the two cannot disagree.
- **Deck creation and artwork.** Custom decks, the five-stat limit and card
  pictures are additions the documents do not describe. They change no rule: a
  custom deck plays by exactly the same rules as the built-in one. The limits are
  `MAX_STATS` and `MAX_GROUPS` in `src/js/decks.js`.
- **How the computer picks.** `Backend-Structure.md` says "the AI selects the
  first attribute". That is now one of three modes, and the mode is drawn at
  random for each round the computer leads — see **How the computer plays**. The
  comparison rules are untouched, so the deck still decides every round by value;
  only the choice of _which_ stat to compare moved. `createGame(theme, { ai })`
  pins a single mode, which is what the seeded tests and the browser harnesses
  do.
- **Additive UI.** The deck picker, Fast toggle, round counter, match summary
  and language switch change presentation or pacing, never a rule.
- **Localization.** The documents name only English content; `pt-BR` is an
  addition. It is presentation-only: the engine compares the same values and the
  deck data is unchanged — `deck.js` keeps English canonical and carries the
  Portuguese as a translation overlay, so a deck's cards, stats and rules are
  identical in both languages. Deck text a player writes is never translated.
- **Artwork.** Without bundled image assets the built-in deck uses emoji, so it
  looks different across platforms' emoji fonts. Custom decks can carry real
  pictures. `cardFace()` in `ui.js` picks between the two.
- **Undefined behaviour.** The printed rules do cover the tie (the cards stay on
  the table and the same chooser picks again), but not who chooses after a tie
  that empties a pile, or how to finish a game that cannot end. The engine uses
  the standard Top Trumps reading and records a `state.reason` (`pile-empty`,
  `round-limit` or `stalemate`) for each ending.

There is no backend. `Backend-Structure.md` sketches future `/start-game`,
`/select-category` and `/game-state` endpoints; the engine's pure functions are
shaped so they could be lifted behind those routes unchanged.

## 📄 License

MIT — see [LICENSE](LICENSE).
