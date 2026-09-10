# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Casual players who already know Top Trunfo (Top Trumps) and want a quick nostalgic round against the computer, alone, in a browser. Secondary (confirmed by the shipped builder): players who want to create and play their own themed decks.

## Product Purpose

A web-based single-player Top Trumps game: the player compares numerical stats on their top card against the computer's card, wins rounds, collects the whole deck. Success is a fully playable game with no critical bugs and a pleasant, quick round loop.

## Positioning

Faithful card-table authenticity: the interface mirrors a real Brazilian Trunfo card — coloured rim, numbered circle badge, yellow title banner, framed art window, name plate, ruled yellow stats table, starburst result seal — on a dark table. A generic game site could not copy this without becoming it.

## Operating Context

Played in short sessions in a desktop or phone browser. Decks ship with the app; cards may carry bundled artwork (built-in EV car decks in `src/assets/cars/`) or emoji. No server involved during play.

## Capabilities and Constraints

- Static HTML/CSS/JS, no framework; scripts load as classic scripts (`src/js/`).
- Decks and card artwork persist in a local IndexedDB database (`trunfo`) only; no accounts, no backend.
- No difficulty setting: the computer draws one of three modes per round it leads — a random stat, its best stat, or its best normalised stat (see `README.md` → "How the computer plays"); optional fast-reveal toggle.
- Deck creator page (`create.html`): build custom decks (up to 20), stats with highest/lowest-wins rules, emoji or image artwork, JSON export/import.
- Two languages: English and Brazilian Portuguese. The language follows the browser (or `?lang=`) and is switchable from the topbar; built-in deck content is translated, player-written deck text is left alone.
- Deliberately undecided: PWA/offline capability — the user confirmed it as a later addition; do not assume it is shipped.

## Brand Commitments

- Name: Trunfo (uppercase wordmark "TRUNFO" with a gold "T" mark).
- The card-face metaphor above is a binding identity commitment, not decoration.

## Evidence on Hand

- Product briefs in-repo: `Product-Documentation.md`, `project-overview.md`, `app-specs.md`.
- Bundled deck artwork: `src/assets/cars/` with `credits.json` and `CREDITS.md` (third-party car photos; credits must be preserved).

## Product Principles

1. The card looks like the real thing — authenticity beats app-pattern convenience on the card face.
2. A round is seconds, not minutes; chrome (topbar, statusbar) serves the card, never crowds it.
3. Everything works locally; the game never requires a connection or an account.
4. Custom decks are first-class citizens of the same table.

## Accessibility & Inclusion

- WCAG AA is the working target (verified in audits: focus traps, `inert`, Escape handling, `prefers-reduced-motion`, contrast).
- Reduced-motion users must always get a state-preserving non-animated alternative.
