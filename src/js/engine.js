/**
 * Trunfo game engine.
 *
 * Pure, DOM-free implementation of the Top Trumps rules described in
 * App-Flow.md / Backend-Structure.md. Every function is deterministic when a
 * seeded `rng` is supplied, which keeps the engine unit-testable.
 *
 * A theme may compare a stat as "lower wins" (a 0–100 time, a price) by naming
 * it in `theme.directions`; every stat without an entry keeps the classic
 * "higher wins" rule.
 *
 * The computer has no fixed mode: unless a game pins one, each round it leads
 * draws a mode at random from `AI_MODES` (see `selectComputerCategory`).
 *
 * Works both as a classic browser script (exposes `window.TrunfoEngine`) and
 * as a CommonJS module (`require('./engine.js')`) for Node tests.
 */
(function (global, factory) {
    'use strict';
    const api = factory();
    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    } else {
        /** @type {Record<string, unknown>} */
        const host = /** @type {any} */ (global);
        host.TrunfoEngine = api;
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    const PLAYER = 'player';
    const COMPUTER = 'computer';
    const DRAW = 'draw';
    const PLAYING = 'playing';
    const GAME_OVER = 'gameover';

    /**
     * Top Trumps is a random walk and, with a deterministic chooser, it can
     * cycle forever — a seeded simulation found exactly that. After this many
     * rounds the match is decided on pile size instead, so a game always ends.
     */
    const DEFAULT_ROUND_LIMIT = 150;

    /**
     * How the computer chooses a category when it leads a round.
     *
     * - `random`   a stat picked at random from its card
     * - `best`     the stat where the card is furthest from the losing end in
     *              raw units, honouring the stat's direction (largest for
     *              "higher wins", smallest for "lower wins")
     * - `adaptive` the same idea normalised across the deck's own range, which is
     *              the fairest comparison when attributes use different scales
     */
    const AI_STRATEGIES = {
        random: 'random',
        best: 'best',
        adaptive: 'adaptive'
    };

    /** Every mode, in the order the mixed picker draws from. */
    const AI_MODES = [AI_STRATEGIES.random, AI_STRATEGIES.best, AI_STRATEGIES.adaptive];

    /**
     * The shipped default: the computer has no fixed mode, it draws one of
     * `AI_MODES` for each round it leads. `createGame` falls back to this for an
     * unknown or missing `ai`, so a hand-written deck JSON cannot break it.
     */
    const MIXED_AI = 'mixed';

    /** A strategy this engine understands: a mode, or the mixed default. */
    function isAiStrategy(value) {
        return typeof value === 'string' && (value === MIXED_AI || !!AI_STRATEGIES[value]);
    }

    /**
     * How a stat is compared. Most Top Trumps stats are "higher wins", but some
     * are naturally "lower wins" (a 0–100 time, a price, a lap time). A theme
     * declares the exceptions in `directions`; everything else defaults to
     * `higher`, so a deck written before this feature keeps its meaning.
     */
    const DIRECTIONS = {
        higher: 'higher',
        lower: 'lower'
    };

    const DEFAULT_DIRECTION = DIRECTIONS.higher;

    /**
     * Collect the attribute keys used by a theme, preserving declaration order.
     * The order matters: the MVP AI plays the first key.
     */
    function inferAttributeKeys(cards) {
        const keys = [];
        (cards || []).forEach(function (card) {
            Object.keys((card && card.attributes) || {}).forEach(function (key) {
                if (keys.indexOf(key) === -1) keys.push(key);
            });
        });
        return keys;
    }

    /**
     * A complete key -> "higher"/"lower" map for a theme. `themeConfig.directions`
     * only has to name the exceptions; every other stat is compared the classic
     * way. An unknown value is treated as `higher` rather than throwing, so a
     * hand-written deck JSON cannot break the game.
     */
    function normaliseDirections(themeConfig, keys) {
        const declared = (themeConfig && themeConfig.directions) || {};
        const directions = {};
        keys.forEach(function (key) {
            directions[key] = declared[key] === DIRECTIONS.lower ? DIRECTIONS.lower : DEFAULT_DIRECTION;
        });
        return directions;
    }

    /**
     * Build a deck from a theme configuration.
     * Card shape: { id, name, theme, icon, superTrunfo, attributes: { ... } }
     *
     * Validates eagerly: a theme that omits a declared attribute, or declares a
     * non-numeric one, fails here rather than halfway through a round.
     */
    function createDeck(themeConfig) {
        if (!themeConfig || !Array.isArray(themeConfig.cards)) {
            throw new TypeError('createDeck(themeConfig): themeConfig.cards must be an array');
        }
        if (!themeConfig.cards.length) {
            throw new Error('createDeck(themeConfig): the theme has no cards');
        }

        const keys =
            Array.isArray(themeConfig.attributes) && themeConfig.attributes.length
                ? themeConfig.attributes.slice()
                : inferAttributeKeys(themeConfig.cards);

        if (!keys.length) {
            throw new Error('createDeck(themeConfig): the theme exposes no attributes');
        }

        return themeConfig.cards.map(function (card, index) {
            const attributes = {};
            keys.forEach(function (key) {
                if (
                    !card.attributes ||
                    typeof card.attributes[key] !== 'number' ||
                    !isFinite(card.attributes[key])
                ) {
                    throw new Error(
                        'createDeck(themeConfig): card "' +
                            (card && card.name) +
                            '" is missing a numeric "' +
                            key +
                            '" attribute'
                    );
                }
                attributes[key] = card.attributes[key];
            });
            return {
                id: (themeConfig.id || 'deck') + '-' + index,
                name: card.name,
                theme: themeConfig.theme || themeConfig.id || 'Unknown theme',
                icon: card.icon || null,
                // Presentation only: the UI resolves these to a picture. The
                // engine never looks at them. `imageId` points into the local
                // database (custom decks); `imageUrl` is a bundled asset that
                // ships with a built-in deck.
                imageId: card.imageId || null,
                imageUrl: card.imageUrl || null,
                superTrunfo: card.superTrunfo === true,
                attributes: attributes
            };
        });
    }

    /**
     * Fisher-Yates shuffle. Returns a new array; the input is never mutated.
     * @param {Array} deck
     * @param {Function} [rng] random source in [0, 1); defaults to Math.random
     */
    function shuffleDeck(deck, rng) {
        if (!Array.isArray(deck)) {
            throw new TypeError('shuffleDeck(deck): deck must be an array');
        }
        const random = typeof rng === 'function' ? rng : Math.random;
        const shuffled = deck.slice();
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(random() * (i + 1));
            const swap = shuffled[i];
            shuffled[i] = shuffled[j];
            shuffled[j] = swap;
        }
        return shuffled;
    }

    /**
     * Split a deck into two equal face-down piles. An odd deck leaves one card
     * over rather than silently handing a side an extra card; `createGame`
     * seeds the pot with it so it stays contested.
     */
    function dealCards(deck) {
        if (!Array.isArray(deck)) {
            throw new TypeError('dealCards(deck): deck must be an array');
        }
        const half = Math.floor(deck.length / 2);
        return {
            playerHand: deck.slice(0, half),
            computerHand: deck.slice(half, half * 2),
            leftover: deck.slice(half * 2)
        };
    }

    /**
     * Create a fresh game state for a theme.
     * @param {Object} themeConfig
     * @param {{ rng?: Function, ai?: string, roundLimit?: number }} [options]
     *        `ai` is a mode (`random`, `best`, `adaptive`) or the mixed default;
     *        `roundLimit: 0` disables the limit; omit it for the default backstop.
     */
    function createGame(themeConfig, options) {
        const opts = options || {};
        const rng = typeof opts.rng === 'function' ? opts.rng : Math.random;
        const deck = shuffleDeck(createDeck(themeConfig), rng);
        const dealt = dealCards(deck);
        const keys =
            Array.isArray(themeConfig.attributes) && themeConfig.attributes.length
                ? themeConfig.attributes.slice()
                : inferAttributeKeys(themeConfig.cards);
        const ai = isAiStrategy(opts.ai) ? opts.ai : MIXED_AI;
        // 0 (or Infinity) means "no limit"; anything else is the cap in rounds.
        const roundLimit =
            typeof opts.roundLimit === 'number' && opts.roundLimit >= 0
                ? Math.floor(opts.roundLimit)
                : DEFAULT_ROUND_LIMIT;

        const state = {
            themeId: themeConfig.id || null,
            theme: themeConfig.theme || themeConfig.id || 'Unknown theme',
            attributeKeys: keys,
            units: Object.assign({}, themeConfig.units || {}),
            labels: Object.assign({}, themeConfig.labels || {}),
            icons: Object.assign({}, themeConfig.icons || {}),
            directions: normaliseDirections(themeConfig, keys),
            maxima: attributeMaxima(themeConfig.cards, keys),
            minima: attributeMinima(themeConfig.cards, keys),
            aiStrategy: ai,
            // The game's random source, kept so a seeded simulation stays
            // reproducible right through the AI's random mode and mixed picker.
            rng: rng,
            roundLimit: roundLimit,
            playerHand: dealt.playerHand,
            computerHand: dealt.computerHand,
            drawPile: dealt.leftover,
            turn: PLAYER,
            round: 0,
            phase: PLAYING,
            winner: null,
            reason: null,
            lastResult: null,
            log: []
        };

        // A degenerate deck (one card, or an odd deck that leaves both piles
        // empty) is already over when it is dealt. Without this the UI would sit
        // on "playing" with no card to click and no way to progress.
        checkGameOver(state);
        return state;
    }

    /** Highest value of each attribute across the theme. */
    function attributeMaxima(cards, keys) {
        const maxima = {};
        keys.forEach(function (key) {
            maxima[key] = (cards || []).reduce(function (best, card) {
                const value = card.attributes ? card.attributes[key] : 0;
                return typeof value === 'number' && value > best ? value : best;
            }, 0);
        });
        return maxima;
    }

    /** Lowest value of each attribute across the theme. */
    function attributeMinima(cards, keys) {
        const minima = {};
        keys.forEach(function (key) {
            minima[key] = (cards || []).reduce(function (best, card) {
                const value = card.attributes ? card.attributes[key] : 0;
                return typeof value === 'number' && value < best ? value : best;
            }, Infinity);
        });
        return minima;
    }

    /**
     * How good a value is for its attribute, on a 0–1 scale across the deck.
     * 1 is the best card in the theme and 0 the worst, whichever way the stat
     * is compared. A theme where every card shares a value scores 1.
     */
    function attributeScore(state, key, value) {
        const max = state && state.maxima ? state.maxima[key] : undefined;
        const min = state && state.minima ? state.minima[key] : undefined;
        if (typeof max !== 'number' || typeof min !== 'number') return 0;
        const span = max - min;
        if (!(span > 0)) return 1;
        const score = directionAdvantage(state, key, value) / span;
        return Math.max(0, Math.min(1, score));
    }

    /**
     * How far a value is from the losing end of its attribute, in the stat's own
     * units: the smallest value wins for "lower", the largest for "higher". Used
     * by the raw "best" AI, which avoids the division `attributeScore` does.
     */
    function directionAdvantage(state, key, value) {
        const lower = state && state.directions && state.directions[key] === DIRECTIONS.lower;
        const max = (state && state.maxima && state.maxima[key]) || 0;
        const min = (state && state.minima && state.minima[key]) || 0;
        return lower ? max - value : value - min;
    }

    /** The card at the top of a face-down pile, or null when the pile is empty. */
    function getTopCard(hand) {
        return Array.isArray(hand) && hand.length > 0 ? hand[0] : null;
    }

    /** A genuine Super Trunfo card beats any ordinary card. */
    function isSuperTrunfo(card) {
        return !!(card && card.superTrunfo === true);
    }

    /** A draw from [0, 1): the state's seeded source, or the argument given. */
    function randomSource(state, rng) {
        if (typeof rng === 'function') return rng;
        if (state && typeof state.rng === 'function') return state.rng;
        return Math.random;
    }

    /** A random index in [0, length), clamped so a sloppy rng cannot overrun. */
    function pickIndex(rng, length) {
        return Math.min(length - 1, Math.max(0, Math.floor(rng() * length)));
    }

    /**
     * Choose a category for the computer when it leads a round.
     *
     * The mode is either the one given (or the one the game was created with) or
     * — by default, with `MIXED_AI` — drawn at random from `AI_MODES` for this
     * round, so the computer does not play the same way every time. `random`
     * picks a stat at random off its card; the other two weigh the card's
     * values. See `AI_STRATEGIES`.
     *
     * Nothing is written to `state`: the mode comes back with the category, and
     * `playRound(state, category, mode)` is what records it in the log. Pass the
     * same `rng` to replay a whole game exactly (see `createGame`).
     *
     * @param {Object} state
     * @param {string} [strategy] a mode, or `MIXED_AI`; defaults to the game's
     * @param {Function} [rng] overrides the game's own source
     * @returns {{category: string, mode: string}|null} the key to play and the
     *          mode that chose it; null when the theme exposes no attributes
     */
    function chooseComputerCategory(state, strategy, rng) {
        if (!state || !state.attributeKeys || !state.attributeKeys.length) return null;

        const keys = state.attributeKeys;
        const source = randomSource(state, rng);
        const declared = isAiStrategy(strategy) ? strategy : state.aiStrategy || MIXED_AI;
        const mode = declared === MIXED_AI ? AI_MODES[pickIndex(source, AI_MODES.length)] : declared;

        if (mode === AI_STRATEGIES.random) {
            return { category: keys[pickIndex(source, keys.length)], mode: mode };
        }

        const card = getTopCard(state.computerHand);
        if (!card) return { category: keys[0], mode: mode };

        let best = keys[0];
        let bestScore = -Infinity;

        keys.forEach(function (key) {
            const value = card.attributes[key];
            if (typeof value !== 'number') return;
            const score =
                mode === AI_STRATEGIES.adaptive
                    ? attributeScore(state, key, value)
                    : directionAdvantage(state, key, value);
            if (score > bestScore) {
                bestScore = score;
                best = key;
            }
        });
        return { category: best, mode: mode };
    }

    /**
     * The computer's category, when the mode it came from is not needed.
     * @returns {string|null}
     */
    function selectComputerCategory(state, strategy, rng) {
        const pick = chooseComputerCategory(state, strategy, rng);
        return pick ? pick.category : null;
    }

    /**
     * Compare two cards on a single category.
     *
     * `direction` decides which value is better: `"higher"` (the default, and
     * the classic Top Trumps rule) or `"lower"`. A Super Trunfo card wins
     * outright; when both cards are trumps the direction decides between them.
     * Equal values are a draw.
     *
     * @param {object} playerCard
     * @param {object} computerCard
     * @param {string} category
     * @param {string} [direction] one of `DIRECTIONS`; omitted means `higher`
     */
    function compareCards(playerCard, computerCard, category, direction) {
        if (!playerCard || !computerCard) {
            throw new TypeError('compareCards(playerCard, computerCard, category): both cards are required');
        }
        const playerValue = playerCard.attributes[category];
        const computerValue = computerCard.attributes[category];

        if (typeof playerValue !== 'number' || typeof computerValue !== 'number') {
            throw new Error('compareCards: unknown category "' + category + '"');
        }

        const rule = direction === DIRECTIONS.lower ? DIRECTIONS.lower : DEFAULT_DIRECTION;
        const playerSuper = isSuperTrunfo(playerCard);
        const computerSuper = isSuperTrunfo(computerCard);

        let outcome = DRAW;
        if (playerSuper !== computerSuper) {
            outcome = playerSuper ? PLAYER : COMPUTER;
        } else if (playerValue !== computerValue) {
            const playerBetter =
                rule === DIRECTIONS.lower ? playerValue < computerValue : playerValue > computerValue;
            outcome = playerBetter ? PLAYER : COMPUTER;
        }

        return {
            category: category,
            direction: rule,
            playerValue: playerValue,
            computerValue: computerValue,
            outcome: outcome,
            margin: Math.abs(playerValue - computerValue),
            superTrunfo: playerSuper || computerSuper
        };
    }

    /**
     * Move the round's pot to its owner. A draw parks the cards in the draw
     * pile so that the next round's winner can claim them.
     */
    function updateState(state, winner, pot) {
        if (!state) throw new TypeError('updateState(state, winner, pot): state is required');
        const cards = pot || [];

        if (winner === PLAYER) {
            state.playerHand = state.playerHand.concat(cards);
            state.turn = PLAYER;
        } else if (winner === COMPUTER) {
            state.computerHand = state.computerHand.concat(cards);
            state.turn = COMPUTER;
        } else {
            state.drawPile = state.drawPile.concat(cards);
        }
        return state;
    }

    /**
     * Play one round.
     *
     * Both top cards are removed from their piles; on a win the winner takes
     * both cards plus any pending draw pile, placed at the bottom of the hand.
     * On a draw the cards are set aside for the next winner. The round winner
     * (or, after a draw, the previous chooser) selects next round's category.
     *
     * A round whose category the computer chose carries that choice's mode
     * (`random`, `best` or `adaptive`) into the result and the log, so the match
     * summary can say how it played; pass it as the third argument, straight
     * from `chooseComputerCategory`.
     *
     * @param {Object} state
     * @param {string} category
     * @param {string} [mode] the AI mode that chose `category`, if any
     * @returns {Object|null} the round result, or null when the game is over.
     */
    function playRound(state, category, mode) {
        if (!state || state.phase !== PLAYING) return null;
        if (!state.attributeKeys || state.attributeKeys.indexOf(category) === -1) {
            throw new Error('playRound(state, category): unknown category "' + category + '"');
        }

        const playerCard = getTopCard(state.playerHand);
        const computerCard = getTopCard(state.computerHand);

        if (!playerCard || !computerCard) {
            checkGameOver(state);
            return null;
        }

        const direction =
            state.directions && state.directions[category] === DIRECTIONS.lower
                ? DIRECTIONS.lower
                : DEFAULT_DIRECTION;
        const comparison = compareCards(playerCard, computerCard, category, direction);

        state.playerHand.shift();
        state.computerHand.shift();

        const pendingDrawPile = state.drawPile;
        const pot = [playerCard, computerCard].concat(pendingDrawPile);
        state.drawPile = [];

        updateState(state, comparison.outcome, pot);

        // Only a real mode is recorded: `mixed` is a picker, not a way to play.
        const chosenBy = AI_STRATEGIES[mode] ? mode : null;

        state.round += 1;
        state.lastResult = {
            round: state.round,
            category: category,
            direction: comparison.direction,
            playerCard: playerCard,
            computerCard: computerCard,
            playerValue: comparison.playerValue,
            computerValue: comparison.computerValue,
            outcome: comparison.outcome,
            margin: comparison.margin,
            superTrunfo: comparison.superTrunfo,
            potSize: pot.length,
            claimedDrawPile: pendingDrawPile.length,
            mode: chosenBy,
            turn: state.turn
        };
        state.log.push({
            round: state.round,
            category: category,
            direction: comparison.direction,
            outcome: comparison.outcome,
            potSize: pot.length,
            superTrunfo: comparison.superTrunfo,
            mode: chosenBy
        });

        checkGameOver(state);
        return state.lastResult;
    }

    /**
     * Evaluate the end condition.
     *
     * The match ends when a pile is empty — "one player has all the cards" — or
     * when the round limit is reached. With the shipped deck the limit is a
     * backstop that never fires (0 of 2000 seeded games); it exists so that a
     * custom deck cannot produce a game that never ends. Set `roundLimit: 0` on
     * `createGame` to remove it entirely.
     *
     * Note: the design documents only say "the game ends when one player has
     * all the cards". Neither a draw that empties a pile nor a stalemate is
     * covered there, so this implements the standard Top Trumps reading — a
     * player who cannot play loses, and the winner collects the pot and any
     * stragglers so the final count is accurate. At the round limit the larger
     * pile wins and equal piles are a draw; the pot goes to the winner.
     */
    function checkGameOver(state) {
        if (!state) return true;
        if (state.phase === GAME_OVER) return true;

        const playerOut = state.playerHand.length === 0;
        const computerOut = state.computerHand.length === 0;
        const limitReached = state.roundLimit > 0 && state.round >= state.roundLimit;

        if (!playerOut && !computerOut && !limitReached) return false;

        state.phase = GAME_OVER;

        if (!playerOut && !computerOut) {
            // Stalemate: decide on pile size and hand the pot to the leader.
            state.reason = 'round-limit';
            if (state.playerHand.length > state.computerHand.length) {
                state.winner = PLAYER;
                state.playerHand = state.playerHand.concat(state.drawPile);
                state.drawPile = [];
            } else if (state.computerHand.length > state.playerHand.length) {
                state.winner = COMPUTER;
                state.computerHand = state.computerHand.concat(state.drawPile);
                state.drawPile = [];
            } else {
                state.winner = DRAW;
            }
            return true;
        }

        state.reason = 'pile-empty';
        if (playerOut && computerOut) {
            state.winner = DRAW;
            state.reason = 'stalemate';
        } else if (!playerOut) {
            state.winner = PLAYER;
            state.playerHand = state.playerHand.concat(state.drawPile, state.computerHand);
            state.drawPile = [];
            state.computerHand = [];
        } else {
            state.winner = COMPUTER;
            state.computerHand = state.computerHand.concat(state.drawPile, state.playerHand);
            state.drawPile = [];
            state.playerHand = [];
        }
        return true;
    }

    /** How many rounds each AI mode chose the category for. */
    function emptyAiModes() {
        const counts = {};
        AI_MODES.forEach(function (mode) {
            counts[mode] = 0;
        });
        return counts;
    }

    /**
     * Summarise a finished (or in-progress) match from the round log.
     * Used by the game-over panel. `aiModes` counts the rounds the computer led,
     * by the mode that picked the category.
     */
    function summarise(state) {
        if (!state) return null;
        const rounds = state.round;

        if (!rounds) {
            return {
                theme: state.theme,
                winner: state.winner,
                reason: state.reason,
                rounds: 0,
                playerRounds: 0,
                computerRounds: 0,
                draws: 0,
                biggestPot: 0,
                superTrunfo: 0,
                longestAttribute: null,
                aiModes: emptyAiModes()
            };
        }

        let playerRounds = 0;
        let computerRounds = 0;
        let draws = 0;
        let biggestPot = 0;
        let superCount = 0;
        const perCategory = {};
        const aiModes = emptyAiModes();

        (state.log || []).forEach(function (entry) {
            if (entry.outcome === PLAYER) playerRounds += 1;
            else if (entry.outcome === COMPUTER) computerRounds += 1;
            else draws += 1;
            if (entry.potSize > biggestPot) biggestPot = entry.potSize;
            if (entry.superTrunfo) superCount += 1;
            if (entry.mode && aiModes[entry.mode] !== undefined) aiModes[entry.mode] += 1;
            perCategory[entry.category] = (perCategory[entry.category] || 0) + 1;
        });

        let longestAttribute = null;
        let longestCount = -1;
        Object.keys(perCategory).forEach(function (key) {
            if (perCategory[key] > longestCount) {
                longestCount = perCategory[key];
                longestAttribute = key;
            }
        });

        return {
            theme: state.theme,
            winner: state.winner,
            reason: state.reason,
            rounds: rounds,
            playerRounds: playerRounds,
            computerRounds: computerRounds,
            draws: draws,
            biggestPot: biggestPot,
            superTrunfo: superCount,
            longestAttribute: longestAttribute,
            aiModes: aiModes
        };
    }

    /** Card counts used by the HUD. */
    function getCardCounts(state) {
        return {
            player: state ? state.playerHand.length : 0,
            computer: state ? state.computerHand.length : 0,
            drawPile: state ? state.drawPile.length : 0
        };
    }

    return {
        PLAYER: PLAYER,
        COMPUTER: COMPUTER,
        DRAW: DRAW,
        PHASE: { PLAYING: PLAYING, GAME_OVER: GAME_OVER },
        AI_STRATEGIES: AI_STRATEGIES,
        AI_MODES: AI_MODES,
        MIXED_AI: MIXED_AI,
        isAiStrategy: isAiStrategy,
        DIRECTIONS: DIRECTIONS,
        DEFAULT_DIRECTION: DEFAULT_DIRECTION,
        DEFAULT_ROUND_LIMIT: DEFAULT_ROUND_LIMIT,
        createDeck: createDeck,
        inferAttributeKeys: inferAttributeKeys,
        normaliseDirections: normaliseDirections,
        shuffleDeck: shuffleDeck,
        dealCards: dealCards,
        createGame: createGame,
        attributeMaxima: attributeMaxima,
        attributeMinima: attributeMinima,
        attributeScore: attributeScore,
        getTopCard: getTopCard,
        isSuperTrunfo: isSuperTrunfo,
        chooseComputerCategory: chooseComputerCategory,
        selectComputerCategory: selectComputerCategory,
        compareCards: compareCards,
        updateState: updateState,
        playRound: playRound,
        checkGameOver: checkGameOver,
        summarise: summarise,
        getCardCounts: getCardCounts
    };
});
