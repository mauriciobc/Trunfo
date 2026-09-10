/**
 * Trunfo UI controller.
 *
 * Thin DOM layer on top of the pure engine: it owns no rules, only rendering
 * and the small amount of timing needed to reveal the computer's card and to
 * play the round dynamics (flip, fly-to-winner, sweep-to-pot).
 *
 * The card layout mirrors a real Trunfo card: a numbered circle badge, a yellow
 * title banner, a framed art window, a bold name plate and a ruled stats table.
 *
 * Loaded as a classic script after deck.js and engine.js.
 */
(function (global) {
    'use strict';

    const Engine = global.TrunfoEngine;
    const Deck = global.TrunfoDeck;
    // Required: every string the interface shows comes from the catalogs.
    const I18n = global.TrunfoI18n;
    // Optional: the deck store is only present on the real game page, not in
    // the minimal test harnesses.
    const Decks = global.TrunfoDecks || null;
    // Optional: the paper-texture shader. Without it the cards keep the plain
    // CSS gradients, which are the intended fallback.
    const Paper = global.TrunfoPaper || null;

    if (!Engine || !Deck || !I18n) {
        throw new Error('Trunfo UI requires i18n.js, deck.js and engine.js to be loaded first.');
    }

    const t = I18n.t;

    /**
     * Stats the reference deck defines. A deck that ships no label of its own
     * for one of these falls back to the catalog rather than to the raw key.
     */
    const KNOWN_STATS = { size: 'stat.size', speed: 'stat.speed', lifespan: 'stat.lifespan' };
    const ICONS = {
        size: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12h18M7 7l-5 5 5 5M17 7l5 5-5 5"/></svg>',
        speed: '<svg viewBox="0 0 24 24" aria-hidden="true"><path class="icon--solid" d="M13 2 4 14h6l-1 8 9-12h-6z"/></svg>',
        lifespan:
            '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>'
    };

    /* Pacing presets. `normal` is the default; `fast` shortens every beat. */
    const SPEEDS = {
        normal: { reveal: 1200, think: 650, deal: 900 },
        fast: { reveal: 400, think: 200, deal: 450 }
    };

    /**
     * Where the lamp's reflection sits on a card at rest: up and to the left of
     * centre. `trackCardGloss` moves it from there.
     */
    const BASE_GLOSS = { x: 32, y: 14 };
    /** How far the card leans at its edges when the cursor is on it, in degrees. */
    const TILT_MAX = 11;
    /** How far the reflection travels across the card per degree of tilt. */
    const GLARE_SWING = 1.35;

    const els = {};
    let state = null;
    let reveal = null; // { player, computer, result } while a round is being shown
    let busy = false;
    let timers = [];
    let computerMode = null;
    let previous = { player: null, computer: null, drawPile: null };
    let lastFocused = null;
    let signatures = { player: null, computer: null, idle: null };
    // No fixed AI: by default the engine draws a mode per round it leads
    // (`Engine.MIXED_AI`). A test or a future difficulty setting can pin one.
    const settings = { ai: null, fast: false };

    /* Catalog keys for the AI modes, so the summary can name them statically. */
    const AI_LABEL_KEYS = {
        random: 'ai.random',
        best: 'ai.best',
        adaptive: 'ai.adaptive'
    };

    /* ---------------------------------------------------------------- utils */

    function byId(id) {
        return document.getElementById(id);
    }

    /** Turn a stat key into a readable name when the deck supplies none. */
    function prettify(key) {
        return String(key)
            .replace(/[_-]+/g, ' ')
            .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
            .trim()
            .split(/\s+/)
            .filter(Boolean)
            .map(function (word) {
                return word.charAt(0).toUpperCase() + word.slice(1);
            })
            .join(' ');
    }

    /**
     * The active deck's translation for the current language, or null for a
     * custom deck (whose text is its author's) and for English. Built-in decks
     * carry theirs in `deck.js`; resolving it at render time means a language
     * switch re-renders the board instead of re-dealing the game.
     */
    let translatorKey = null;
    let translatorValue = null;

    function translator() {
        const id = state && state.themeId;
        if (!id) return null;
        const key = id + '|' + I18n.locale();
        if (key !== translatorKey) {
            translatorKey = key;
            translatorValue = Deck.translator(id, I18n.locale());
        }
        return translatorValue;
    }

    function label(key) {
        const translation = translator();
        if (translation && translation.labels[key]) return translation.labels[key];
        if (state && state.labels && state.labels[key]) return state.labels[key];
        if (KNOWN_STATS[key]) return t(KNOWN_STATS[key]);
        return prettify(key);
    }

    function unit(key) {
        const translation = translator();
        if (translation && translation.units[key]) return translation.units[key];
        return (state && state.units && state.units[key]) || '';
    }

    /** A card's displayed name: translated for a built-in deck, as written otherwise. */
    function cardName(card) {
        if (!card) return '';
        const translation = translator();
        return translation ? translation.name(card.name) : card.name;
    }

    /** The deck name printed on a card banner and footer. */
    function themeOf(card) {
        const translation = translator();
        if (translation) return translation.theme;
        return (card && card.theme) || (state ? state.theme : '');
    }

    /** The displayed name of any deck in the catalogue. */
    function deckLabel(deck) {
        if (!deck) return '';
        const translation = Deck.translator(deck.id, I18n.locale());
        return translation ? translation.theme : deck.theme;
    }

    /** The displayed name of the deck currently in play (or picked, before a deal). */
    function activeDeckLabel() {
        const translation = translator();
        if (translation) return translation.theme;
        if (state) return state.theme;
        if (Decks) {
            const store = Decks.store();
            const deck = store.get(store.selected());
            if (deck) return deckLabel(deck);
        }
        return Deck.getTheme(Deck.DEFAULT_THEME_ID).theme;
    }

    /**
     * A built-in deck references its artwork as a path relative to the game
     * page. The browser harnesses live in another directory, so they set
     * `window.TRUNFO_ASSET_BASE` to point back at the source tree.
     */
    function assetBase() {
        return global.TRUNFO_ASSET_BASE || '';
    }

    function el(tag, className, text) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined && text !== null) node.textContent = String(text);
        return node;
    }

    function speed() {
        return settings.fast ? SPEEDS.fast : SPEEDS.normal;
    }

    /**
     * The modes the computer picked with, and how often, e.g.
     * "Random stat ×4 · Best stat ×3". Rounds the player chose are not counted.
     */
    function aiSummary(summary) {
        const counts = (summary && summary.aiModes) || {};
        const parts = Engine.AI_MODES.filter(function (mode) {
            return counts[mode] > 0;
        }).map(function (mode) {
            return t(AI_LABEL_KEYS[mode]) + ' \u00d7' + I18n.number(counts[mode]);
        });
        return parts.length ? parts.join(' \u00b7 ') : t('summary.none');
    }

    /** Schedule a callback and forget its id once it fires. */
    function later(fn, ms) {
        // The callback always runs after this assignment, so `const` is safe here.
        const id = global.setTimeout(function () {
            const index = timers.indexOf(id);
            if (index >= 0) timers.splice(index, 1);
            fn();
        }, ms);
        timers.push(id);
        return id;
    }

    function clearTimers() {
        timers.forEach(function (id) {
            global.clearTimeout(id);
        });
        timers = [];
    }

    function repaint(node) {
        // Force a reflow so a re-added animation class restarts.
        if (node && node.offsetWidth !== undefined) void node.offsetWidth;
    }

    function nextFrame(fn) {
        if (global.requestAnimationFrame) global.requestAnimationFrame(fn);
        else global.setTimeout(fn, 16);
    }

    /** Stable per-name hue so every animal gets its own art colour. */
    function hueFor(name) {
        let hue = 0;
        for (let i = 0; i < name.length; i++) {
            hue = (hue * 31 + name.charCodeAt(i)) % 360;
        }
        return hue;
    }

    /** 1-based card number for the badge (the reference deck starts at A1). */
    function cardNumber(card) {
        const match = /(\d+)$/.exec(card.id || '');
        return match ? String(Number(match[1]) + 1) : '';
    }

    /* --------------------------------------------------------------- pieces */

    function cardBack() {
        const back = el('div', 'back');
        back.appendChild(el('span', 'back__ring'));
        back.appendChild(el('span', 'back__mark', 'TRUNFO'));
        back.appendChild(el('span', 'back__sub', 'Top Trumps'));
        return back;
    }

    function attrRow(category, value, options) {
        const opts = options || {};
        const row = opts.interactive ? el('button', 'attr') : el('div', 'attr attr--static');
        // Some stats are won by the lowest value (a 0–100 time, a price). The
        // engine owns that rule; the UI only shows it.
        const isLower = !!(state.directions && state.directions[category] === 'lower');

        if (opts.interactive) {
            row.type = 'button';
            row.setAttribute('data-category', category);
            row.disabled = !opts.enabled;
            const scale = unit(category) ? ' ' + unit(category) : '';
            row.setAttribute(
                'aria-label',
                t('game.attr.compare', {
                    stat: label(category),
                    value: value,
                    unit: scale,
                    rule: isLower ? t('game.attr.lower') : t('game.attr.higher')
                })
            );
        }
        if (opts.highlight) row.classList.add(opts.highlight);

        // The bar reads "how good is this value", so it fills toward the winning
        // end whichever way the stat is compared.
        const score = Engine.attributeScore(state, category, value);
        const percent = Math.max(4, Math.min(100, Math.round(score * 100)));

        const fill = el('span', 'attr__fill');
        row.appendChild(fill);

        const labelNode = el('span', 'attr__label');
        labelNode.appendChild(document.createTextNode(label(category)));
        if (unit(category)) labelNode.appendChild(el('small', 'attr__unit', unit(category)));
        if (isLower) {
            const rule = el('small', 'attr__rule', '\u2193');
            rule.title = t('game.attr.lowerTitle');
            labelNode.appendChild(rule);
        }
        row.appendChild(labelNode);

        const valueNode = el('span', 'attr__value');
        // Only the built-in stats have an icon; custom stats render without one.
        const markup = (state.icons && state.icons[category]) || ICONS[category];
        if (markup) {
            const iconNode = el('span', 'attr__icon');
            iconNode.innerHTML = markup;
            valueNode.appendChild(iconNode);
        }
        valueNode.appendChild(document.createTextNode(I18n.number(value)));
        row.appendChild(valueNode);

        nextFrame(function () {
            fill.style.transform = 'scaleX(' + percent / 100 + ')';
        });
        return row;
    }

    function cardFace(card, options) {
        const opts = options || {};
        const superCard = Engine.isSuperTrunfo(card);
        const name = cardName(card);
        const face = el('article', 'face');
        face.style.setProperty('--hue', String(hueFor(name)));
        if (opts.winner) face.classList.add('is-winner');
        if (superCard) face.classList.add('is-super');

        const top = el('header', 'face__top');
        const badge = el('span', 'badge');
        badge.appendChild(el('span', 'badge__text', 'A' + cardNumber(card)));
        top.appendChild(badge);
        const banner = el('span', 'banner');
        banner.appendChild(el('span', 'banner__text', themeOf(card)));
        top.appendChild(banner);
        face.appendChild(top);

        const art = el('div', 'face__art');
        // Artwork has three sources, in order: a hydrated data URL from the
        // local database (custom decks), a bundled asset that ships with a
        // built-in deck, or the emoji/initial as a fallback.
        const stored = card.image || (Decks ? Decks.store().image(card.imageId) : null);
        const source = stored || (card.imageUrl ? assetBase() + card.imageUrl : null);

        if (source) {
            const picture = el('img', 'face__photo');
            picture.src = source;
            picture.alt = name;
            // A missing or unreadable file should degrade to the emoji rather
            // than leave a broken image in the card window.
            picture.addEventListener(
                'error',
                function () {
                    picture.remove();
                    art.appendChild(el('span', 'face__icon', card.icon || name.charAt(0)));
                },
                { once: true }
            );
            art.appendChild(picture);
        } else {
            art.appendChild(el('span', 'face__icon', card.icon || name.charAt(0)));
        }

        // The seal states exactly what the card is: a real Super Trunfo card
        // keeps it permanently, an ordinary winner gets it for the round only.
        const seal = el('span', 'seal' + (superCard ? ' seal--super' : ''));
        seal.appendChild(el('span', 'seal__text', superCard ? 'Super Trunfo' : t('game.card.roundWin')));
        art.appendChild(seal);
        face.appendChild(art);

        face.appendChild(el('h3', 'face__name', name));

        const stats = el('div', 'attrs');
        state.attributeKeys.forEach(function (category) {
            stats.appendChild(
                attrRow(category, card.attributes[category], {
                    interactive: opts.interactive,
                    enabled: opts.enabled,
                    highlight: opts.highlights ? opts.highlights[category] : null
                })
            );
        });
        face.appendChild(stats);

        const foot = el('footer', 'face__footer');
        foot.appendChild(el('span', 'face__brand', 'TRUNFO'));
        foot.appendChild(el('span', 'face__series', themeOf(card)));
        face.appendChild(foot);

        return face;
    }

    /* --------------------------------------------------------------- render */

    function isPlayerChoosing() {
        return (
            !busy && !reveal && state && state.phase === Engine.PHASE.PLAYING && state.turn === Engine.PLAYER
        );
    }

    function highlightedCategories(side) {
        const highlights = {};
        if (!reveal) return highlights;

        const outcome = reveal.result.outcome;
        const mineWon = side === 'player' ? outcome === Engine.PLAYER : outcome === Engine.COMPUTER;

        state.attributeKeys.forEach(function (category) {
            if (reveal.result.category !== category) return;
            if (outcome === Engine.DRAW) highlights[category] = 'is-draw';
            else highlights[category] = mineWon ? 'is-winner' : 'is-loser';
        });
        return highlights;
    }

    function renderStack(node, count) {
        if (!node) return;
        const wanted = Math.max(0, Math.min(3, count - 1));
        if (node.childElementCount === wanted) return;
        node.innerHTML = '';
        for (let i = 1; i <= wanted; i++) {
            const layer = el('span', 'card-stack__layer');
            layer.style.setProperty('--i', String(i));
            node.appendChild(layer);
        }
    }

    function bump(node) {
        if (!node) return;
        node.classList.remove('is-bumped');
        repaint(node);
        node.classList.add('is-bumped');
    }

    /**
     * The status line is held as a *producer*, not as finished text: a round
     * message embeds stat labels and values that only the active language
     * knows, so switching language repaints it rather than showing stale copy.
     */
    let statusLine = null;

    /** A producer for a fixed key and params. */
    function message(key, params) {
        return function () {
            return { key: key, params: params };
        };
    }

    function paintStatus() {
        if (!els.message || !statusLine) return;
        const spec = statusLine();
        const text = t(spec.key, spec.params);
        if (els.message.textContent === text) return;
        els.message.textContent = text;
        els.message.classList.remove('is-new');
        repaint(els.message);
        els.message.classList.add('is-new');
    }

    function showStatus(producer) {
        statusLine = producer;
        paintStatus();
    }

    function updateCounts(counts) {
        els.playerCount.textContent = I18n.number(counts.player);
        els.computerCount.textContent = I18n.number(counts.computer);
        if (els.playerUnit) els.playerUnit.textContent = t('game.cards', { count: counts.player });
        if (els.computerUnit) els.computerUnit.textContent = t('game.cards', { count: counts.computer });
        els.potCount.textContent = I18n.number(counts.drawPile);
        els.pot.hidden = counts.drawPile === 0;

        if (previous.player !== null && previous.player !== counts.player) bump(els.playerCounter);
        if (previous.computer !== null && previous.computer !== counts.computer) bump(els.computerCounter);
        if (previous.drawPile !== null && counts.drawPile > previous.drawPile) bump(els.pot);

        previous = counts;
    }

    function renderIdle() {
        if (signatures.idle === 'idle') return;
        signatures.idle = 'idle';

        els.playerCard.innerHTML = '';
        els.playerCard.classList.add('is-empty');
        els.playerCard.appendChild(el('p', 'card__empty', t('game.startPrompt')));
        if (els.playerUnit) els.playerUnit.textContent = t('game.cards', { count: 0 });
        if (els.computerUnit) els.computerUnit.textContent = t('game.cards', { count: 0 });

        els.computerCard.classList.remove('flip-in', 'flip-out');
        els.computerCard.classList.add('card--back');
        els.computerCard.innerHTML = '';
        els.computerCard.appendChild(cardBack());
    }

    function render(producer) {
        if (!state) {
            renderIdle();
            if (producer) showStatus(producer);
            else paintStatus();
            return;
        }

        const counts = Engine.getCardCounts(state);
        updateCounts(counts);
        renderStack(els.playerStack, counts.player);
        renderStack(els.computerStack, counts.computer);
        els.board.classList.toggle('is-busy', busy);
        if (els.brandTag) els.brandTag.textContent = activeDeckLabel();
        if (els.round) els.round.textContent = I18n.number(state.round);

        renderPlayerCard();
        renderComputerCard();

        if (producer) showStatus(producer);
        else paintStatus();
    }

    function renderPlayerCard() {
        const card = reveal ? reveal.player : Engine.getTopCard(state.playerHand);
        const enabled = isPlayerChoosing();
        const highlights = highlightedCategories('player');
        const winner = !!reveal && reveal.result.outcome === Engine.PLAYER;

        // Rebuild only when something visible actually changed, so the stat
        // bars and the art animation do not restart on every render.
        const signature = [
            card ? card.id : 'none',
            enabled ? 'on' : 'off',
            winner ? 'win' : '',
            Object.keys(highlights)
                .sort()
                .map(function (k) {
                    return k + ':' + highlights[k];
                })
                .join(',')
        ].join('|');
        if (signature === signatures.player) return;
        signatures.player = signature;

        els.playerCard.innerHTML = '';
        els.playerCard.classList.remove('is-empty');

        if (!card) {
            els.playerCard.classList.add('is-empty');
            els.playerCard.appendChild(el('p', 'card__empty', t('game.noCards')));
            return;
        }

        els.playerCard.appendChild(
            cardFace(card, {
                interactive: true,
                enabled: enabled,
                highlights: highlights,
                winner: winner
            })
        );
    }

    function renderComputerCard() {
        const mode = reveal ? 'front' : 'back';
        const card = reveal ? reveal.computer : null;
        const winner = !!reveal && reveal.result.outcome === Engine.COMPUTER;
        const highlights = highlightedCategories('computer');

        const signature = [
            mode,
            card ? card.id : 'none',
            winner ? 'win' : '',
            Object.keys(highlights)
                .sort()
                .map(function (k) {
                    return k + ':' + highlights[k];
                })
                .join(',')
        ].join('|');

        if (signature !== signatures.computer) {
            signatures.computer = signature;

            if (mode === 'back') {
                els.computerCard.innerHTML = '';
                els.computerCard.classList.add('card--back');
                els.computerCard.setAttribute('aria-label', t('game.card.faceDown'));
                els.computerCard.appendChild(cardBack());
            } else {
                els.computerCard.classList.remove('card--back');
                els.computerCard.setAttribute('aria-label', t('game.card.revealed'));
                els.computerCard.innerHTML = '';
                els.computerCard.appendChild(
                    cardFace(card, {
                        highlights: highlights,
                        winner: winner
                    })
                );
            }
        }

        if (mode !== computerMode) {
            const animated = computerMode !== null;
            computerMode = mode;
            if (animated) {
                els.computerCard.classList.remove('flip-in', 'flip-out');
                repaint(els.computerCard);
                els.computerCard.classList.add(mode === 'front' ? 'flip-in' : 'flip-out');
            }
        }
    }

    /* ------------------------------------------------------------ dynamics */

    function clearDynamics() {
        [els.playerSlot, els.computerSlot].forEach(function (node) {
            if (node) node.classList.remove('is-winning', 'is-losing', 'is-potted');
        });
    }

    function applyRoundDynamics(result) {
        clearDynamics();
        if (result.outcome === Engine.PLAYER) {
            if (els.playerSlot) els.playerSlot.classList.add('is-winning');
            if (els.computerSlot) els.computerSlot.classList.add('is-losing');
        } else if (result.outcome === Engine.COMPUTER) {
            if (els.computerSlot) els.computerSlot.classList.add('is-winning');
            if (els.playerSlot) els.playerSlot.classList.add('is-losing');
        } else {
            if (els.playerSlot) els.playerSlot.classList.add('is-potted');
            if (els.computerSlot) els.computerSlot.classList.add('is-potted');
        }
    }

    function playDealAnimation() {
        if (!els.board) return;
        els.board.classList.remove('is-dealing');
        repaint(els.board);
        els.board.classList.add('is-dealing');
        later(function () {
            els.board.classList.remove('is-dealing');
        }, speed().deal);
    }

    /**
     * The status line for a finished round. A producer, so the stat label and
     * the numbers are re-read (and re-formatted) whenever it is painted.
     */
    function resultStatus(result) {
        return function () {
            const trump = result.superTrunfo ? t('game.result.trump') : '';
            const score = t('game.result.score', {
                stat: label(result.category),
                rule: result.direction === Engine.DIRECTIONS.lower ? t('game.result.lowestRule') : '',
                player: result.playerValue,
                computer: result.computerValue
            });
            const pot = result.potSize > 2 ? t('game.result.pot', { count: result.potSize }) : '';

            if (result.outcome === Engine.PLAYER) {
                return { key: 'game.result.win', params: { trump: trump, score: score, pot: pot } };
            }
            if (result.outcome === Engine.COMPUTER) {
                return { key: 'game.result.lose', params: { trump: trump, score: score, pot: pot } };
            }
            return { key: 'game.result.draw', params: { score: score } };
        };
    }

    /* ------------------------------------------------------------- overlays */

    function focusable(root) {
        const nodes = root.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        return Array.prototype.filter.call(nodes, function (node) {
            return !node.disabled && node.offsetParent !== null;
        });
    }

    function openOverlay(node, initialFocus) {
        if (node.hidden === false) return;
        lastFocused = document.activeElement;
        node.hidden = false;
        // `inert` removes the rest of the page from the tab order and the a11y
        // tree; the keydown trap below covers browsers without it.
        if (els.app && els.app.setAttribute) els.app.setAttribute('inert', '');
        if (initialFocus) initialFocus.focus();
    }

    function closeOverlay(node) {
        if (node.hidden) return;
        node.hidden = true;
        if (!els.rules.hidden || !els.overlay.hidden) return;
        if (els.app && els.app.removeAttribute) els.app.removeAttribute('inert');
        if (lastFocused && lastFocused.focus) lastFocused.focus();
        lastFocused = null;
    }

    function anyOverlayOpen() {
        return (els.rules && !els.rules.hidden) || (els.overlay && !els.overlay.hidden);
    }

    function trapTab(event) {
        if (event.key !== 'Tab' || !anyOverlayOpen()) return;
        const root = els.overlay.hidden ? els.rules : els.overlay;
        const nodes = focusable(root);
        if (!nodes.length) return;
        const first = nodes[0];
        const last = nodes[nodes.length - 1];
        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    }

    function showGameOver() {
        const counts = Engine.getCardCounts(state);
        const summary = Engine.summarise(state);
        const winner = state.winner;

        let title = t('over.draw');
        let detail = t('over.drawDetail');
        if (winner === Engine.PLAYER) {
            title = t('over.win');
            detail = t('over.winDetail');
        } else if (winner === Engine.COMPUTER) {
            title = t('over.lose');
            detail = t('over.loseDetail');
        }

        if (state.reason === 'round-limit') {
            title =
                winner === Engine.PLAYER
                    ? t('over.limitWin')
                    : winner === Engine.COMPUTER
                      ? t('over.limitLose')
                      : t('over.limitDraw');
            detail = t('over.limitDetail', { rounds: state.roundLimit });
            if (winner === Engine.DRAW) detail += t('over.limitLevel');
        }

        els.overlayTitle.textContent = title;
        const potNote = counts.drawPile > 0 ? t('over.potStayed', { count: counts.drawPile }) : '';
        els.overlayDetail.textContent =
            detail + t('over.score', { player: counts.player, computer: counts.computer }) + potNote;

        els.overlayStats.innerHTML = '';
        [
            [t('summary.rounds'), I18n.number(summary.rounds)],
            [t('summary.playerRounds'), I18n.number(summary.playerRounds)],
            [t('summary.computerRounds'), I18n.number(summary.computerRounds)],
            [t('summary.draws'), I18n.number(summary.draws)],
            [t('summary.biggestPot'), t('count.cards', { count: summary.biggestPot })],
            [
                t('summary.contested'),
                summary.longestAttribute ? label(summary.longestAttribute) : t('summary.none')
            ],
            [t('summary.superTrunfo'), I18n.number(summary.superTrunfo)],
            [t('summary.ai'), aiSummary(summary)]
        ].forEach(function (pair) {
            const row = el('div');
            row.appendChild(el('dt', null, pair[0]));
            row.appendChild(el('dd', null, String(pair[1])));
            els.overlayStats.appendChild(row);
        });

        openOverlay(els.overlay, els.overlayRestart);
    }

    /* ------------------------------------------------------------ deck list */

    /** The deck the player picked, with its artwork attached, ready to deal. */
    function resolveTheme() {
        if (Decks) {
            const store = Decks.store();
            const deck = store.get(store.selected());
            if (deck) return store.hydrate(deck);
        }
        return Deck.getTheme(Deck.DEFAULT_THEME_ID);
    }

    /**
     * Start a game once the local database has loaded, so a custom deck (and its
     * artwork) is available before the first deal.
     */
    function beginGame(themeConfig) {
        if (!Decks) {
            startGame(themeConfig);
            return;
        }
        Decks.store()
            .ready()
            .then(function () {
                startGame(themeConfig);
            });
    }

    function populateDecks() {
        if (!els.deckSelect || !Decks) return;
        const store = Decks.store();
        const decks = store.all();
        const current = store.selected();

        els.deckSelect.innerHTML = '';
        decks.forEach(function (deck) {
            // A built-in deck's name follows the language; a star marks the
            // player's own decks, whose names are theirs to write.
            const name = deckLabel(deck);
            const option = el('option', null, store.isBuiltIn(deck.id) ? name : name + ' \u2605');
            option.value = deck.id;
            els.deckSelect.appendChild(option);
        });
        if (current && store.get(current)) els.deckSelect.value = current;
        // The brand tag shows the deck before the first deal, too.
        if (els.brandTag) els.brandTag.textContent = activeDeckLabel();
    }

    /* ----------------------------------------------------------------- flow */

    function startGame(themeConfig) {
        clearTimers();
        // Optional theme argument keeps the controller testable with small decks.
        const theme = themeConfig && themeConfig.cards ? themeConfig : resolveTheme();
        populateDecks();

        state = Engine.createGame(theme, { ai: settings.ai });
        reveal = null;
        busy = false;
        computerMode = null;
        previous = { player: null, computer: null, drawPile: null };
        signatures = { player: null, computer: null, idle: null };

        closeOverlay(els.overlay);
        closeOverlay(els.rules);
        els.startBtn.hidden = true;
        els.restartBtn.hidden = false;
        if (els.round && els.round.parentElement) els.round.parentElement.hidden = false;

        clearDynamics();
        render(message('game.chooseFirst'));
        playDealAnimation();

        // A degenerate deck (for example a single card) is already over when it
        // is dealt; report it instead of leaving an unplayable board.
        if (state.phase === Engine.PHASE.GAME_OVER) {
            render(message('game.gameOver'));
            showGameOver();
            return;
        }

        maybeComputerTurn();
    }

    function onCategory(category) {
        if (!state || state.phase !== Engine.PHASE.PLAYING) return;
        if (busy || reveal) return;
        if (state.turn !== Engine.PLAYER) {
            showStatus(message('game.yourTurn'));
            return;
        }
        resolveRound(category);
    }

    function resolveRound(category, mode) {
        busy = true;
        clearDynamics();

        const played = {
            player: Engine.getTopCard(state.playerHand),
            computer: Engine.getTopCard(state.computerHand)
        };
        const result = Engine.playRound(state, category, mode);

        if (!result) {
            busy = false;
            render();
            return;
        }

        reveal = { player: played.player, computer: played.computer, result: result };
        render(resultStatus(result));
        applyRoundDynamics(result);

        later(function () {
            reveal = null;
            busy = false;
            clearDynamics();

            if (state.phase === Engine.PHASE.GAME_OVER) {
                render(message('game.gameOver'));
                showGameOver();
                return;
            }
            render(message('game.chooseNext'));
            maybeComputerTurn();
        }, speed().reveal);
    }

    function maybeComputerTurn() {
        if (!state || state.phase !== Engine.PHASE.PLAYING) return;
        if (state.turn !== Engine.COMPUTER) return;

        busy = true;
        render(message('game.computerTurn'));

        later(function () {
            const pick = Engine.chooseComputerCategory(state, settings.ai);
            busy = false;
            resolveRound(pick.category, pick.mode);
        }, speed().think);
    }

    /* ------------------------------------------------------------- bindings */

    /**
     * A card held under a lamp. Tilting it slides the reflection across its
     * surface and throws the shadow the other way; sliding it does the same,
     * because the lamp stays where it is.
     *
     * The cursor only ever supplies the *tilt*. The reflection itself is read
     * back from the card's own pose, which is why a deal, a flip or a fly-away
     * moves the light exactly the way a hand does — and why waving the pointer
     * across a still card, which would not move a real reflection, does nothing.
     *
     * Poses come from `getComputedStyle`, so every existing keyframe drives this
     * without duplicating a single one.
     */
    function poseOf(node) {
        const rest = { dx: 0, dy: 0, yaw: 0, pitch: 0, roll: 0, scale: 1 };
        if (!node || !global.getComputedStyle) return rest;

        const value = global.getComputedStyle(node).transform;
        if (!value || value === 'none') return rest;

        const m = value
            .slice(value.indexOf('(') + 1, -1)
            .split(',')
            .map(Number);

        if (value.indexOf('matrix3d') === 0) {
            // Column-major. For rotateY(yaw) * rotateX(pitch) the upper-left
            // block gives yaw = atan2(-m31, m11) and pitch = atan2(-m23, m22).
            return {
                dx: m[12] || 0,
                dy: m[13] || 0,
                yaw: Math.atan2(-m[2], m[0]),
                pitch: Math.atan2(-m[9], m[5]),
                roll: 0,
                scale: Math.sqrt(m[0] * m[0] + m[2] * m[2]) || 1
            };
        }

        return {
            dx: m[4] || 0,
            dy: m[5] || 0,
            yaw: 0,
            pitch: 0,
            // A 2D rotate() is an in-plane roll: it tips the light sideways too.
            roll: Math.atan2(m[1], m[0]),
            scale: Math.sqrt(m[0] * m[0] + m[1] * m[1]) || 1
        };
    }

    function prefersReducedMotion() {
        try {
            return !!(global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches);
        } catch {
            return false;
        }
    }

    function trackCardGloss(slot) {
        if (!slot || !global.requestAnimationFrame) return;
        // With motion turned down nothing moves, so a static reflection is right.
        if (prefersReducedMotion()) return;

        let frame = 0;
        let settled = 0;
        let lastKey = '';

        function sample() {
            frame = 0;

            const card = slot.querySelector('.card');
            const back = card && card.querySelector('.back');
            const rect = slot.getBoundingClientRect();

            // The slot carries the deal, the card the tilt and the fly-away, the
            // back the return flip. What matters is where the surface ended up.
            let dx = 0;
            let dy = 0;
            let yaw = 0;
            let pitch = 0;
            let roll = 0;
            let scale = 1;
            [poseOf(slot), poseOf(card), poseOf(back)].forEach(function (pose) {
                dx += pose.dx;
                dy += pose.dy;
                yaw += pose.yaw;
                pitch += pose.pitch;
                roll += pose.roll;
                scale *= pose.scale;
            });

            const width = Math.max(1, rect.width);
            const height = Math.max(1, rect.height);
            const yawDeg = (yaw * 180) / Math.PI;
            const pitchDeg = (pitch * 180) / Math.PI;
            const rollDeg = (roll * 180) / Math.PI;

            // The reflection runs against the tilt, and the lamp stays put while
            // the card travels underneath it.
            const x = BASE_GLOSS.x - yawDeg * GLARE_SWING - rollDeg * 1.1 - (dx / width) * 85;
            const y = BASE_GLOSS.y + pitchDeg * GLARE_SWING + (1 - scale) * 45 - (dy / height) * 85;

            const spot = {
                x: Math.max(-45, Math.min(145, x)),
                y: Math.max(-45, Math.min(145, y))
            };
            const key = spot.x.toFixed(1) + ',' + spot.y.toFixed(1);

            if (key !== lastKey) {
                lastKey = key;
                settled = 0;
                slot.style.setProperty('--gloss-x', spot.x.toFixed(1) + '%');
                slot.style.setProperty('--gloss-y', spot.y.toFixed(1) + '%');
            } else if (++settled > 8) {
                // At rest: the reflection has stopped travelling.
                return;
            }

            schedule();
        }

        function schedule() {
            if (!frame) frame = global.requestAnimationFrame(sample);
        }

        // The cursor supplies the tilt, and nothing else; the reflection is then
        // derived from the pose that tilt produced.
        slot.addEventListener('pointermove', function (event) {
            const rect = slot.getBoundingClientRect();
            if (!rect.width || !rect.height) return;

            const px = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
            const py = Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height));
            const yaw = (px - 0.5) * 2 * TILT_MAX;
            const pitch = -(py - 0.5) * 2 * TILT_MAX;

            slot.classList.add('is-tilting');
            slot.style.setProperty('--tilt-y', yaw.toFixed(2) + 'deg');
            slot.style.setProperty('--tilt-x', pitch.toFixed(2) + 'deg');
            // The shadow falls away from the tilt, which is what sells the depth.
            slot.style.setProperty('--shadow-x', (-yaw * 1.3).toFixed(1) + 'px');
            slot.style.setProperty('--shadow-y', (10 + pitch * 0.6).toFixed(1) + 'px');
            schedule();
        });

        slot.addEventListener('pointerleave', function () {
            slot.classList.remove('is-tilting');
            slot.style.removeProperty('--tilt-y');
            slot.style.removeProperty('--tilt-x');
            slot.style.removeProperty('--shadow-x');
            slot.style.removeProperty('--shadow-y');
            schedule();
        });

        ['animationstart', 'animationend', 'transitionrun', 'transitionend'].forEach(function (name) {
            slot.addEventListener(name, schedule);
        });

        schedule();
    }

    function bind() {
        els.app = document.querySelector('.app');
        els.board = byId('board') || document.querySelector('.board');
        els.playerSlot = byId('player-slot');
        els.computerSlot = byId('computer-slot');
        trackCardGloss(els.computerSlot);
        els.playerStack = byId('player-stack');
        els.computerStack = byId('computer-stack');
        els.playerCard = byId('player-card');
        els.computerCard = byId('computer-card');

        /*
         * The flip keyframes end on an identity transform, so the class that runs
         * them can come straight back off. It has to: `perspective()` in a
         * transform puts the element in a 3D rendering context, and an element in
         * a 3D rendering context cannot blend with its backdrop. Leaving the
         * class on therefore turns `mix-blend-mode` off for the overlays inside
         * it — the gloss on the back and the paper grain on the face both start
         * painting flat, which washes the card out to a featureless gradient.
         */
        els.computerCard.addEventListener('animationend', function (event) {
            if (event.animationName === 'flip-front' || event.animationName === 'flip-back') {
                els.computerCard.classList.remove('flip-in', 'flip-out');
            }
        });

        els.playerCount = byId('player-count');
        els.computerCount = byId('computer-count');
        els.playerUnit = byId('player-unit');
        els.computerUnit = byId('computer-unit');
        els.playerCounter = els.playerCount ? els.playerCount.closest('.counter') : null;
        els.computerCounter = els.computerCount ? els.computerCount.closest('.counter') : null;
        els.pot = byId('pot');
        els.potCount = byId('pot-count');
        els.message = byId('message');
        els.round = byId('round-count');
        els.startBtn = byId('start-btn');
        els.restartBtn = byId('restart-btn');
        els.speedBtn = byId('speed-btn');
        els.deckSelect = byId('deck-select');
        els.brandTag = byId('brand-tag');
        els.rulesBtn = byId('rules-btn');
        els.rules = byId('rules');
        els.rulesClose = byId('rules-close');
        els.overlay = byId('overlay');
        els.overlayTitle = byId('overlay-title');
        els.overlayDetail = byId('overlay-detail');
        els.overlayStats = byId('overlay-stats');
        els.overlayRestart = byId('overlay-restart');

        els.startBtn.addEventListener('click', function () {
            beginGame();
        });
        els.restartBtn.addEventListener('click', function () {
            beginGame();
        });
        els.overlayRestart.addEventListener('click', function () {
            beginGame();
        });

        els.playerCard.addEventListener('click', function (event) {
            const button = event.target.closest('button.attr');
            if (button && !button.disabled) onCategory(button.getAttribute('data-category'));
        });

        if (els.speedBtn) {
            els.speedBtn.addEventListener('click', function () {
                settings.fast = !settings.fast;
                els.speedBtn.setAttribute('aria-pressed', settings.fast ? 'true' : 'false');
                showStatus(message(settings.fast ? 'game.fastOn' : 'game.fastOff'));
            });
        }

        if (els.deckSelect) {
            els.deckSelect.addEventListener('change', function () {
                const id = els.deckSelect.value;
                if (Decks) Decks.store().select(id);
                beginGame();
            });
            populateDecks();
        }

        // Coming back from the deck creator through the bfcache can leave the
        // picker stale, so rebuild it whenever the page is restored.
        global.addEventListener('pageshow', function (event) {
            if (event.persisted) populateDecks();
        });

        els.rulesBtn.addEventListener('click', function () {
            openOverlay(els.rules, els.rulesClose);
        });
        els.rulesClose.addEventListener('click', function () {
            closeOverlay(els.rules);
        });
        els.rules.addEventListener('click', function (event) {
            if (event.target === els.rules) closeOverlay(els.rules);
        });
        els.overlay.addEventListener('click', function (event) {
            if (event.target === els.overlay) closeOverlay(els.overlay);
        });

        // A language switch re-renders every string this controller owns — the
        // board, the picker, the status line and an open result panel. The
        // dealt cards are not touched, so the match keeps going.
        document.addEventListener(I18n.EVENT_NAME, onLocaleChange);

        document.addEventListener('keydown', function (event) {
            if (event.key === 'Escape' && anyOverlayOpen()) {
                closeOverlay(els.overlay);
                closeOverlay(els.rules);
                return;
            }
            trapTab(event);
        });
    }

    /* ------------------------------------------------------------ localizing */

    /**
     * Repaint after the language changed. Signatures are cleared first: the
     * cards memoise on ids alone, so without this a translated name, label or
     * unit would never reach the DOM.
     */
    function onLocaleChange() {
        signatures = { player: null, computer: null, idle: null };
        populateDecks();
        render();
        if (els.overlay && els.overlay.hidden === false) showGameOver();
    }

    function init() {
        bind();

        // Give the cards a procedural paper texture. Failure is expected on
        // machines without WebGL and simply leaves the gradients in place.
        if (Paper) Paper.apply(document.documentElement);

        renderIdle();
        // Populate the deck picker once the local database has loaded.
        if (Decks) {
            Decks.store()
                .ready()
                .then(function () {
                    populateDecks();
                });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Exposed for debugging and browser-based smoke tests.
    global.TrunfoUI = {
        startGame: startGame,
        getState: function () {
            return state;
        },
        getSettings: function () {
            return settings;
        },
        onCategory: onCategory,
        /** Programmatic settings, used by the browser test harnesses. */
        configure: function (next) {
            if (!next) return settings;
            if (typeof next.fast === 'boolean') {
                settings.fast = next.fast;
                if (els.speedBtn) els.speedBtn.setAttribute('aria-pressed', settings.fast ? 'true' : 'false');
            }
            // A pinned mode for deterministic tests; `null` restores the
            // shipped per-round random pick.
            if (next.ai === null || next.ai === undefined) settings.ai = null;
            else if (Engine.isAiStrategy(next.ai)) settings.ai = next.ai;
            return settings;
        }
    };
})(window);
