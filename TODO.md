# TRUNFO — Implementation Status

The MVP described in `Product-Documentation.md`, `App-Flow.md`,
`Backend-Structure.md`, `Frontend-Guidelines.md` and `Tech-Stack.md` is
implemented in `src/` and shipped from `dist/`.

The shipped game is the printed **Super Trunfo** game, not the plainer one those
documents describe: the deck is 32 cards in eight groups of four (1A–1D … 8A–8D),
one card is the Super Trunfo and loses only to a "1" card, a tie leaves the cards
on the table for the same chooser to play again, and the game ends when one side
holds every card. The one deliberate departure from the print is the computer's
choice of category — the documents name a fixed "first attribute", and it now
draws one of three modes per round instead. See "Rules covered" below for the
rule-by-rule mapping and "Known deviations" for everything that is not a rule.

## Core game logic — `src/js/engine.js`

- [x] Card data structure `{ id, code, name, theme, icon, superTrunfo, attributes }`
- [x] `createDeck(theme)` builds a themed deck and validates every attribute
- [x] `shuffleDeck(deck, rng)` — Fisher-Yates, non-mutating, seedable
- [x] `dealCards(deck)` — equal piles; an odd card goes to the pot, not to a side
- [x] `createGame(theme, options)` initial state, deck range (`minima`/`maxima`),
      per-stat `directions`, the AI strategy, round limit and random source;
      resolves a degenerate deal instead of leaving it playable
- [x] `compareCards(...)` — highest value wins by default; a stat named in
      `theme.directions` is won by the lowest value instead
- [x] The Super Trunfo rule: a card with `superTrunfo: true` takes the round
      whatever the category and whatever the values, unless the other card is a
      "1" card (`isNumberOneCard` — the first group, 1A–1D), which takes it off
      the trump; the round result carries `superTrunfo` and `trumpBeaten`
- [x] `updateState(state, winner, pot)` — pot to the winner's pile
- [x] `playRound(state, category, mode)` — comparison, draw handling, turn
      hand-off; records which AI mode chose the category, if any
- [x] `checkGameOver(state)` — empty pile _or_ the round-limit backstop, with a
      recorded reason
- [x] AI modes: `random` (a stat off its own card), `best` (raw margin) and
      `adaptive` (margin normalised across the deck) — all three direction-aware,
      all three seedable
- [x] `mixed` is the shipped default: `chooseComputerCategory` draws one of the
      three modes at random for each round the computer leads, and returns the
      mode with the category so `playRound` can log it
- [x] `summarise(state)` — match totals for the game-over panel, including how
      many rounds each AI mode picked for
- [x] `cardCode(index)` — the Trunfo deck layout: cards come in groups of four
      lettered A–D, so a deck reads 1A–1D, 2A–2D … 8A–8D, and each card carries
      its code (`CARDS_PER_GROUP`, `MAX_GROUPS`, `MAX_CARDS`)

## Deck content — `src/js/deck.js`

- [x] "Awesome Animals" — 32 cards in 8 groups, Size (cm), Speed (km/h),
      Lifespan (years)
- [x] "2026 Electric Cars" — 32 EVs in 8 groups, Range (km), Power (hp), Top
      speed (km/h), Fast charge (kW), 0–100 km/h (s); the figures are
      illustrative sample data
- [x] Per-stat comparison rule: most stats are higher-is-better, and the car
      deck's 0–100 km/h is declared `lower` in `directions`, so the quicker car
      wins that column
- [x] Plain value comparison for every card except the deck's Super Trunfo:
      each shipped deck marks one card (`superTrunfo: true`) — the Crocodile
      (8D) in the animals deck and the Tesla Cybertruck Cyberbeast (7C) in the
      car deck, so each is beaten only by that deck's four "1" cards
- [x] Both themes are validated and simulated to completion by the engine tests
- [x] The car deck ships bundled photographs (`src/assets/cars/`) with
      attribution in `CREDITS.md`; `tools/fetch-car-images.js` re-fetches and
      re-credits them from pinned Wikimedia Commons files

## Interface — `src/index.html`, `src/css/styles.css`, `src/js/ui.js`

- [x] Player's card face-up with theme, name and every attribute
- [x] Computer's card face-down until the comparison, then revealed
- [x] Clickable attribute buttons; compared stat highlighted win/lose/draw
- [x] A "lowest wins" stat is marked **↓** on the card and named in the round
      message; the stat bar fills toward the winning end either way
- [x] Round message, round counter, card counts and pot indicator
- [x] Game-over overlay with the result, a match summary and Play again
- [x] Rules panel, a Fast play toggle and a flag button that switches language;
      no difficulty selector — the computer's mode varies by itself
- [x] Fluid card, container-query type scale, stacked/side-by-side layouts
- [x] Seal reads "Round win" for the round winner; the deck's Super Trunfo card
      wears a gold "Super Trunfo" seal all game
- [x] A round the Super Trunfo decided says so ("Super Trunfo!" / "A “1” card
      beats the Super Trunfo!"), and the rules panel lists the rule
- [x] The circle badge carries the card's code (1A…8D), derived by the engine
      from the card's position in the deck
- [x] A deal that is already over reports its result instead of hanging

## Deck creation and the local database

- [x] `src/create.html` + `src/js/create.js` — name, up to five stats with units
      and a **Highest wins / Lowest wins** rule, and a cards table
- [x] The cards table is written in whole **groups of four**: the code column
      shows each card's 1A–8D code, a group header names the group and its
      letters, "Add a group of four" appends four rows, and the ✕ on a header
      removes that group. A deck is never edited in loose cards.
- [x] `MAX_GROUPS` (8) caps a deck at 32 cards; `CARDS_PER_GROUP` and the group
      ceiling come from the engine, so the creator, the store and the card code
      cannot disagree
- [x] A **Super Trunfo** checkbox on every card row marks the deck's trump;
      ticking one clears the rest, and a second trump is refused with
      `error.oneSuperTrunfo`, in the reader's language
- [x] The mark survives JSON export and import along with the rest of the card
- [x] Validation with field-level messages before anything is written
- [x] A deck that is not a whole number of groups is refused with
      `error.cardGroups`, in the reader's language
- [x] Saved decks are pickable on the game page and marked with a star
- [x] `src/js/decks.js` — IndexedDB database `trunfo` (stores `decks`, `images`,
      `meta`) behind a pluggable backend, with an in-memory fallback
- [x] Synchronous reads from an in-memory mirror, asynchronous writes through
- [x] Decks from the old `localStorage` build are migrated on first load; a
      legacy deck that is not a whole number of groups is reported as left
      behind rather than dropped in silence
- [x] `src/js/images.js` — downscales a picked file to a 640px edge and re-encodes
      it before storage
- [x] Cards reference artwork by `imageId`; orphaned images are pruned
- [x] Artwork renders in the card's art window (`object-fit: cover`)
- [x] JSON export/import with the artwork inlined, one deck or an array,
      including each stat's comparison rule

## Localization — `src/js/i18n.js`

- [x] Every interface string lives in one catalog, key-for-key identical in
      `en` and `pt-BR`; a missing entry falls back to English rather than
      showing a raw key
- [x] `data-i18n` (+ `-title` / `-aria-label` / `-placeholder` / `-content`)
      marks up the markup; `I18n.t()` covers the controllers
- [x] The language is picked from `?lang=`, then `localStorage`, then the
      browser, then English; a regional tag with no catalog of its own falls
      back to the closest shipped language (`pt-PT` reads `pt-BR`)
- [x] The topbar flag button switches at runtime: markup, status line, deck
      picker and open panels re-render in place, and the dealt match is not
      disturbed
- [x] The button shows the flag of the language in use and names the switch it
      performs, so the flag is decoration and the action is announced; it
      advances through `LOCALES` and wraps, needing no menu
- [x] `<html lang>` follows the language; the switch survives a reload
- [x] Built-in deck content is translated through a per-theme `i18n` overlay
      (`translator()` for render time, `localizeTheme()` to bake a copy in), so
      English stays canonical and custom decks are never touched
- [x] Numbers and plurals follow the locale (`1.020` / `1,020`, "1 carta" /
      "1 card")
- [x] Store, artwork and validation errors are translated too, so a refused
      save reports itself in the reader's language
- [x] `min-width: 0` on the creator's panels: a longer stat label can no longer
      push the cards table past the page edge — it scrolls in its wrapper

## Accessibility and correctness

- [x] Overlays move focus, trap Tab, clear `inert` and close on `Escape`
- [x] `prefers-reduced-motion` cancels the movement instead of leaving it half-applied
- [x] Cards are memoised so stat bars and art animations do not restart
- [x] Timers are pruned instead of accumulating for the life of a game
- [x] Icon fills use a class, not a fragile `path[d^=...]` selector
- [x] Card stock is generated by GLSL fragment shaders (`src/js/paper.js`):
      a matte `paper` variant for the face (seamless value-noise fibres,
      grain and mottle, multiplied over the whole printed card) and a
      `gloss` variant for the back (orange peel, hairline scratches and
      glints, screen-blended, plus a specular reflection of the lamp)
- [x] The card back leans in 3D under the cursor and the reflection is
      derived from that pose, so the light also sweeps across it during
      deals, flips, fly-aways and pot sweeps
- [x] The shader is a progressive enhancement — with no WebGL the CSS
      gradients stand alone, verified by a browser scenario
- [x] The flip classes are dropped on `animationend`, so no card layer is left
      with a lingering 3D transform
- [x] `transform-style: flat` on the card: `preserve-3d` would put the gloss
      layers in a 3D rendering context, where `mix-blend-mode` is not applied and
      the back washes out for the whole flip (measured: 94 vs 80 mean luminance)
- [x] The reflection is held at zero while the card turns and fades up over
      ~520 ms once it lands, instead of snapping on; the reduced-motion path
      keeps it visible, since no `animationend` ever fires there

## Build, quality and deployment

- [x] `build.js` minifies `src/` into `dist/`, fingerprints asset URLs, emits
      `.nojekyll`
- [x] ESLint and `tsc --checkJs`, both clean
- [x] 66 engine tests including 200 seeded full-game simulations, the
      direction-aware comparison and AI, the Super Trunfo rule card by card, and
      a check that every shipped theme is well-formed and plays to completion
- [x] 44 deck-store tests: validation, persistence, artwork, import/export
      (including comparison rules and the trump mark), the group rule, legacy
      migration
- [x] 30 localization tests: catalog parity both ways, no empty or dead keys,
      every key the markup and the controllers ask for, placeholders, plurals,
      locale-normalised numbers, deck translations and translated store errors
- [x] 21 browser scenarios, including the draw/pot path, a degenerate one-card
      deck, a custom five-stat deck with artwork read back from IndexedDB, a
      lower-wins stat that resolves to the smaller value, the 2026 Electric Cars
      deck and its 32-card layout, the code on the card badge, the Super Trunfo
      rule played both ways round, a full 32-card game, the deck-creator form end
      to end (whole groups of four, the trump mark), a language switch at
      runtime, a `?lang=pt-BR` load of both pages, and layout at 7 viewport sizes
      — with the same chrome height in both languages
- [x] Every browser scenario pins its language through `?lang=`, so a
      developer's own locale cannot change what a scenario asserts
- [x] The browser runner drives the page over CDP and waits for the harness, so
      asynchronous scenarios cannot pass by accident
- [x] CI runs lint, type check, tests and the browser suite; `main` deploys

## Verified against the product document

Over 2,000 seeded games per deck, with the shipped mixed AI (the player modelled
as picking its `adaptive` best):

| Deck               | Ended by emptying a pile | Decided at the 300-round cap | Average rounds | Rounds decided against the rule |
| ------------------ | ------------------------ | ---------------------------- | -------------- | ------------------------------- |
| Awesome Animals    | 96.5%                    | 70 of 2,000                  | 97.2           | 0                               |
| 2026 Electric Cars | 70.5%                    | 590 of 2,000                 | 170.4          | 0                               |

The comparison itself is untouched: every one of those rounds went to the better
value under the stat's own rule, or to the Super Trunfo rule where a trump card
was on the table — the simulation re-derived each outcome before playing it and
found no disagreement. What the mixed AI costs is length — deciding which stat to
play on a coin toss makes a game longer than playing the first one every time.
The 32-card deck roughly triples the length of a 16-card one and the Super Trunfo
card lengthens it again, so the backstop moved from 150 rounds to 300 with the
deck; the five-stat car deck, whose values are close together, still runs into it
in about 30% of games.

## Rules covered — Super Trunfo

Rule by rule, from the printed sheet, with what implements it:

| Printed rule                                                                                                                                       | Where it lives                                                                                                                           |
| -------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| 2 or more participants; 7 years and up                                                                                                             | The app is two: you against the computer. Multiplayer is deferred (see below), so more than two is the one gap.                          |
| Objective: collect every card in the deck                                                                                                          | `checkGameOver` — an empty pile ends the match; `state.winner` names the side; the overlay reports it.                                   |
| Cards distributed equally, a stack each, only the top card visible                                                                                 | `dealCards` splits the deck evenly; the interface shows your top card and keeps the computer's face down.                                |
| The chooser announces a category from their top card; everyone reveals and compares; highest value takes the table's cards                         | `resolveRound` (UI) → `playRound` → `compareCards` → `updateState`; the winner's cards go to the bottom of the pile.                     |
| The round winner chooses the next category                                                                                                         | `updateState` hands the turn to the round's winner; the UI then waits for the player or plays the computer's pick.                       |
| On a tie the cards stay on the table, the same chooser picks again from their next card, and the comparison's winner takes everything on the table | A draw leaves `state.turn` alone and parks both cards in `state.drawPile`; the next winner claims the pile.                              |
| The Super Trunfo card wins whatever the values, unless a "1" card is in play, which wins instead                                                   | `compareCards` with `isSuperTrunfo` / `isNumberOneCard`; both shipped decks mark one card, and the creator can mark one per custom deck. |
| The winner is whoever ends up with all the cards                                                                                                   | `checkGameOver` → `phase: gameover`, with the game-over panel and the match summary.                                                     |

Two deliberate departures inside those rules are listed under **Known deviations**:
the per-stat "lowest wins" option, and the round-limit backstop that decides a
match which cannot end.

## Out of scope for the MVP

Deferred by the design documents: multiplayer, sound, and the optional
Node/Express backend (`POST /start-game`, `POST /select-category`,
`GET /game-state`). Additional built-in themes remain a future enhancement;
players can create their own instead.

## Known deviations and judgement calls

- The 300-round backstop fires for about 30% of car-deck games under the mixed AI
  (590 of 2,000 seeds) and 3.5% of animals-deck games (70 of 2,000);
  `{ roundLimit: 0 }` removes it. It exists so no deck can create a game that
  never ends. It was 150 for the 16-card deck and moved with the deck.
- The printed rules take 2–8 participants; this is a single-player game, so a
  match is always two sides. Multiplayer is deferred by the design documents.
- The "1" cards are the four cards of the first group (1A–1D) in a deck's own
  order, which is what the printed numbering means; a custom deck therefore
  decides which four cards can beat its Super Trunfo.
- The comparison reveals the computer's whole card, not just the compared stat.
  That is a superset of the requirement and matches the physical game.
- The printed rules cover the tie, but not who chooses after a tie that empties a
  pile, or how to finish an unendable game; the engine uses standard Top Trumps
  readings and records `state.reason`.
- The documents describe a themed deck but not its size. The shipped decks — and
  every deck the creator will build — follow the classic Trunfo layout: 32 cards
  in eight groups of four, 1A–1D … 8A–8D, with the code on the card's badge.
  `CARDS_PER_GROUP` / `MAX_GROUPS` live in the engine, which mints the code, and
  `src/js/decks.js` enforces the same shape on a player's deck.
- Deck creation, the five-stat limit, the per-stat comparison rule and card
  artwork are additions the documents do not describe. They change no rule: a stat
  with no `directions` entry keeps the documented "higher wins", and the limits
  live in `MAX_STATS` and `MAX_GROUPS`.
- The AI's mode is drawn per round instead of the documented fixed "first
  attribute". The change is confined to _which_ stat gets compared — the value
  rules are identical — and `createGame(theme, { ai })` still pins a single mode,
  which is what the tests and harnesses use.
- Fast play, the round counter and the match summary are additive UI
  affordances. Defaults keep the documented behaviour.
