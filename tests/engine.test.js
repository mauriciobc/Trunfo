/**
 * Engine test suite for Trunfo.
 *
 * Run in Node:    node tests/engine.test.js
 * Run in browser: open tests/index.html
 *
 * Covers the four areas required by the project plan: card dealing, game
 * logic, AI behaviour and win conditions.
 */
(function (root, factory) {
    'use strict';
    if (typeof module === 'object' && module.exports) {
        module.exports = factory;
    } else {
        /** @type {Record<string, any>} */
        const host = /** @type {any} */ (root);
        host.createEngineTests = function () {
            return factory(host.TrunfoEngine, host.TrunfoDeck);
        };
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Engine, Deck) {
    'use strict';

    const results = { passed: 0, failed: 0, failures: [] };

    function assert(condition, message) {
        if (!condition) throw new Error(message || 'assertion failed');
    }

    function equal(actual, expected, message) {
        if (actual !== expected) {
            throw new Error(
                (message || 'value') +
                    ': expected ' +
                    JSON.stringify(expected) +
                    ' but got ' +
                    JSON.stringify(actual)
            );
        }
    }

    function deepEqual(actual, expected, message) {
        const a = JSON.stringify(actual);
        const b = JSON.stringify(expected);
        if (a !== b) {
            throw new Error((message || 'value') + ': expected ' + b + ' but got ' + a);
        }
    }

    function test(name, fn) {
        try {
            fn();
            results.passed += 1;
            log('PASS  ' + name);
        } catch (error) {
            results.failed += 1;
            results.failures.push({ name: name, message: error.message });
            log('FAIL  ' + name + '\n        ' + error.message);
        }
    }

    function log(line) {
        if (typeof console !== 'undefined' && console.log) console.log(line);
    }

    /** Tiny deterministic PRNG (mulberry32) so shuffles are reproducible. */
    function makeRng(seed) {
        let t = seed >>> 0;
        return function () {
            t += 0x6d2b79f5;
            let r = Math.imul(t ^ (t >>> 15), 1 | t);
            r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
            return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
        };
    }

    function makeCard(name, attributes) {
        return { id: name.toLowerCase(), name: name, theme: 'Test', attributes: attributes };
    }

    function totalCards(state) {
        return state.playerHand.length + state.computerHand.length + state.drawPile.length;
    }

    const theme = Deck.getTheme(Deck.DEFAULT_THEME_ID);
    const DECK_SIZE = theme.cards.length;

    /* ------------------------------------------------------------ the tests */

    function deckAndDealing() {
        test('createDeck builds one card per theme entry with theme metadata', function () {
            const deck = Engine.createDeck(theme);
            equal(deck.length, DECK_SIZE, 'deck length');
            equal(deck[0].name, theme.cards[0].name, 'first card name');
            equal(deck[0].theme, theme.theme, 'card theme');
            deepEqual(Object.keys(deck[0].attributes), theme.attributes, 'attribute keys');
            deepEqual(deck[0].attributes, theme.cards[0].attributes, 'attribute values');
        });

        test('createDeck rejects a theme without cards', function () {
            let threw = false;
            try {
                Engine.createDeck({});
            } catch {
                threw = true;
            }
            assert(threw, 'expected a TypeError');
        });

        test('createDeck rejects a card that is missing a declared attribute', function () {
            let threw = false;
            try {
                Engine.createDeck({
                    id: 'broken',
                    attributes: ['size', 'speed'],
                    cards: [{ name: 'Half', attributes: { size: 1 } }]
                });
            } catch (e) {
                threw = /missing a numeric "speed"/.test(e.message);
            }
            assert(threw, 'expected a descriptive error about the missing attribute');
        });

        test('createDeck rejects a non-numeric attribute', function () {
            let threw = false;
            try {
                Engine.createDeck({
                    id: 'broken',
                    attributes: ['size'],
                    cards: [{ name: 'Text', attributes: { size: 'big' } }]
                });
            } catch {
                threw = true;
            }
            assert(threw, 'expected a TypeError-like failure for a string stat');
        });

        test('createDeck carries the Super Trunfo flag through', function () {
            const flagged = Engine.createDeck({
                id: 'super',
                theme: 'Super',
                attributes: ['size'],
                cards: [
                    { name: 'Plain', attributes: { size: 1 } },
                    { name: 'Trump', attributes: { size: 0 }, superTrunfo: true }
                ]
            });
            equal(flagged[0].superTrunfo, false, 'ordinary card is not a trump');
            equal(flagged[1].superTrunfo, true, 'flagged card is a trump');
            assert(Engine.isSuperTrunfo(flagged[1]), 'isSuperTrunfo agrees');
            assert(!Engine.isSuperTrunfo(flagged[0]), 'isSuperTrunfo rejects an ordinary card');
        });

        test('createDeck copies values instead of aliasing theme data', function () {
            const deck = Engine.createDeck(theme);
            deck[0].attributes[theme.attributes[0]] = -1;
            assert(theme.cards[0].attributes[theme.attributes[0]] !== -1, 'theme data was mutated');
        });

        test('shuffleDeck preserves every card and does not mutate the input', function () {
            const deck = Engine.createDeck(theme);
            const original = deck.map(function (card) {
                return card.id;
            });
            const shuffled = Engine.shuffleDeck(deck, makeRng(42));

            equal(shuffled.length, deck.length, 'length');
            deepEqual(
                deck.map(function (c) {
                    return c.id;
                }),
                original,
                'input mutated'
            );
            deepEqual(
                shuffled
                    .map(function (c) {
                        return c.id;
                    })
                    .sort(),
                original.slice().sort(),
                'same multiset of cards'
            );
        });

        test('shuffleDeck actually reorders a deck with a random source', function () {
            const deck = Engine.createDeck(theme);
            const shuffled = Engine.shuffleDeck(deck, makeRng(7));
            const moved = shuffled.some(function (card, i) {
                return card.id !== deck[i].id;
            });
            assert(moved, 'deck was not reordered');
        });

        test('dealCards splits the deck into two equal piles', function () {
            const deck = Engine.createDeck(theme);
            const dealt = Engine.dealCards(deck);
            equal(dealt.playerHand.length + dealt.computerHand.length, deck.length, 'all cards dealt');
            equal(dealt.playerHand.length, deck.length / 2, 'player count');
            equal(dealt.computerHand.length, deck.length / 2, 'computer count');
            deepEqual(dealt.leftover, [], 'no leftover for an even deck');
        });

        test('an odd deck gives neither side an extra card', function () {
            const odd = Engine.dealCards([1, 2, 3, 4, 5]);
            equal(odd.playerHand.length, 2, 'odd player count');
            equal(odd.computerHand.length, 2, 'odd computer count');
            deepEqual(odd.leftover, [5], 'the odd card is set aside, not gifted to the player');
        });

        test('dealCards gives each card to exactly one player', function () {
            const deck = Engine.createDeck(theme);
            const dealt = Engine.dealCards(Engine.shuffleDeck(deck, makeRng(3)));
            const seen = dealt.playerHand
                .concat(dealt.computerHand)
                .map(function (c) {
                    return c.id;
                })
                .sort();
            const unique = seen.filter(function (id, i) {
                return seen.indexOf(id) === i;
            });
            equal(unique.length, deck.length, 'duplicate or missing cards');
        });

        test('createGame deals the whole deck and starts on the player turn', function () {
            const game = Engine.createGame(theme, { rng: makeRng(11) });
            equal(totalCards(game), DECK_SIZE, 'all cards in play');
            equal(game.drawPile.length, 0, 'draw pile starts empty');
            equal(game.round, 0, 'round counter');
            equal(game.phase, Engine.PHASE.PLAYING, 'phase');
            equal(game.turn, Engine.PLAYER, 'opening turn');
            equal(game.winner, null, 'no winner yet');
            deepEqual(game.attributeKeys, theme.attributes, 'attribute order preserved');
        });
    }

    function comparisonAndRounds() {
        test('compareCards declares the higher value the winner', function () {
            const lion = makeCard('Lion', { size: 250, speed: 80, lifespan: 15 });
            const zebra = makeCard('Zebra', { size: 220, speed: 65, lifespan: 25 });

            const result = Engine.compareCards(lion, zebra, 'size');
            equal(result.outcome, Engine.PLAYER, 'player wins on size');
            equal(result.playerValue, 250, 'player value');
            equal(result.computerValue, 220, 'computer value');
            equal(Engine.compareCards(zebra, lion, 'size').outcome, Engine.COMPUTER, 'computer wins on size');
            equal(Engine.compareCards(lion, zebra, 'speed').outcome, Engine.PLAYER, 'player wins on speed');
        });

        test('compareCards returns a draw for equal values', function () {
            const a = makeCard('A', { size: 100, speed: 1, lifespan: 1 });
            const b = makeCard('B', { size: 100, speed: 2, lifespan: 2 });
            const result = Engine.compareCards(a, b, 'size');
            equal(result.outcome, Engine.DRAW, 'draw outcome');
            equal(result.margin, 0, 'margin');
            equal(Engine.compareCards(a, a, 'size', 'lower').outcome, Engine.DRAW, 'a draw either way');
        });

        test('compareCards honours a "lower wins" direction', function () {
            const fast = makeCard('Fast', { acceleration: 2.1 });
            const slow = makeCard('Slow', { acceleration: 5.0 });

            const result = Engine.compareCards(fast, slow, 'acceleration', Engine.DIRECTIONS.lower);
            equal(result.outcome, Engine.PLAYER, 'the quicker car wins');
            equal(result.direction, 'lower', 'the rule is recorded');
            equal(
                Engine.compareCards(slow, fast, 'acceleration', 'lower').outcome,
                Engine.COMPUTER,
                'and the slower one loses'
            );
            equal(
                Engine.compareCards(fast, slow, 'acceleration').outcome,
                Engine.COMPUTER,
                'omitting the rule keeps the classic higher-wins comparison'
            );
        });

        test('compareCards rejects an unknown category', function () {
            const a = makeCard('A', { size: 1, speed: 1, lifespan: 1 });
            let threw = false;
            try {
                Engine.compareCards(a, a, 'weight');
            } catch {
                threw = true;
            }
            assert(threw, 'expected an error for an unknown category');
        });

        test('playRound gives both cards to the winner, at the bottom of the pile', function () {
            const game = Engine.createGame(theme, { rng: makeRng(5) });
            game.playerHand = [
                makeCard('Strong', { size: 999, speed: 1, lifespan: 1 }),
                makeCard('PlayerSpare', { size: 1, speed: 1, lifespan: 1 })
            ];
            game.computerHand = [
                makeCard('Weak', { size: 1, speed: 1, lifespan: 1 }),
                makeCard('ComputerSpare', { size: 1, speed: 1, lifespan: 1 })
            ];

            const result = Engine.playRound(game, 'size');
            equal(result.outcome, Engine.PLAYER, 'outcome');
            equal(game.round, 1, 'round advanced');
            equal(game.playerHand.length, 3, 'player collected both cards');
            equal(game.playerHand[0].name, 'PlayerSpare', 'won cards go to the bottom');
            equal(game.playerHand[2].name, 'Weak', 'computer card collected last');
            equal(game.computerHand.length, 1, 'computer lost its top card');
            equal(game.turn, Engine.PLAYER, 'round winner selects next');
            equal(game.drawPile.length, 0, 'draw pile empty');
        });

        test('playRound hands the next choice to the computer when it wins', function () {
            const game = Engine.createGame(theme, { rng: makeRng(5) });
            game.playerHand = [
                makeCard('Weak', { size: 1, speed: 1, lifespan: 1 }),
                makeCard('PSpare', { size: 1, speed: 1, lifespan: 1 })
            ];
            game.computerHand = [
                makeCard('Strong', { size: 999, speed: 1, lifespan: 1 }),
                makeCard('CSpare', { size: 1, speed: 1, lifespan: 1 })
            ];

            const result = Engine.playRound(game, 'size');
            equal(result.outcome, Engine.COMPUTER, 'outcome');
            equal(game.turn, Engine.COMPUTER, 'computer selects next');
            equal(game.computerHand.length, 3, 'computer collected both cards');
        });

        test('a draw parks both cards in the pot for the next winner', function () {
            const game = Engine.createGame(theme, { rng: makeRng(5) });
            game.playerHand = [
                makeCard('DrawP', { size: 50, speed: 1, lifespan: 1 }),
                makeCard('WinP', { size: 999, speed: 1, lifespan: 1 }),
                makeCard('PSpare', { size: 1, speed: 1, lifespan: 1 })
            ];
            game.computerHand = [
                makeCard('DrawC', { size: 50, speed: 1, lifespan: 1 }),
                makeCard('LoseC', { size: 1, speed: 1, lifespan: 1 }),
                makeCard('CSpare', { size: 1, speed: 1, lifespan: 1 })
            ];

            const draw = Engine.playRound(game, 'size');
            equal(draw.outcome, Engine.DRAW, 'first round is a draw');
            equal(game.drawPile.length, 2, 'both cards set aside');
            equal(game.playerHand.length, 2, 'player hand after draw');
            equal(game.computerHand.length, 2, 'computer hand after draw');
            equal(game.turn, Engine.PLAYER, 'chooser keeps the turn after a draw');

            const win = Engine.playRound(game, 'size');
            equal(win.outcome, Engine.PLAYER, 'second round won');
            equal(win.claimedDrawPile, 2, 'draw pile was at stake');
            equal(game.drawPile.length, 0, 'pot claimed and cleared');
            equal(game.playerHand.length, 5, 'player took round cards plus the pot');
            equal(totalCards(game), 6, 'cards conserved');
        });

        test('playRound refuses to act once the game is over', function () {
            const game = Engine.createGame(theme, { rng: makeRng(5) });
            game.playerHand = [makeCard('Only', { size: 1, speed: 1, lifespan: 1 })];
            game.computerHand = [];
            Engine.checkGameOver(game);
            equal(Engine.playRound(game, 'size'), null, 'no round after game over');
        });

        test('playRound rejects an unknown category', function () {
            const game = Engine.createGame(theme, { rng: makeRng(5) });
            let threw = false;
            try {
                Engine.playRound(game, 'weight');
            } catch {
                threw = true;
            }
            assert(threw, 'expected an error');
        });
    }

    function aiBehaviour() {
        test('a game with no fixed mode starts mixed', function () {
            equal(Engine.createGame(theme, { rng: makeRng(9) }).aiStrategy, Engine.MIXED_AI, 'mixed');
            equal(
                Engine.createGame(theme, { rng: makeRng(9), ai: 'nonsense' }).aiStrategy,
                Engine.MIXED_AI,
                'an unknown mode falls back to mixed'
            );
            ['random', 'best', 'adaptive'].forEach(function (mode) {
                equal(
                    Engine.createGame(theme, { rng: makeRng(9), ai: mode }).aiStrategy,
                    mode,
                    mode + ' can be pinned'
                );
            });
        });

        test('the mixed picker draws every mode, and only real modes', function () {
            const game = Engine.createGame(theme, { rng: makeRng(3) });
            const seen = {};
            for (let i = 0; i < 300; i++) {
                const pick = Engine.chooseComputerCategory(game);
                assert(Engine.AI_MODES.indexOf(pick.mode) !== -1, 'a real mode: ' + pick.mode);
                assert(theme.attributes.indexOf(pick.category) !== -1, 'a real stat: ' + pick.category);
                seen[pick.mode] = (seen[pick.mode] || 0) + 1;
            }
            equal(Object.keys(seen).sort().join(','), 'adaptive,best,random', 'all three modes appear');
        });

        test('a pinned mode is used every round', function () {
            const game = Engine.createGame(theme, { rng: makeRng(3), ai: 'best' });
            for (let i = 0; i < 50; i++) {
                equal(Engine.chooseComputerCategory(game).mode, 'best', 'the pinned mode is kept');
            }
        });

        test('the random mode picks stats at random, not the first one', function () {
            const game = Engine.createGame(theme, { rng: makeRng(11), ai: 'random' });
            const seen = {};
            for (let i = 0; i < 200; i++) {
                seen[Engine.chooseComputerCategory(game).category] = 1;
            }
            equal(
                Object.keys(seen).sort().join(','),
                theme.attributes.slice().sort().join(','),
                'every stat gets picked'
            );
            // It reads nothing but the key list, so a card whose best stat is not
            // the first does not bias the draw.
            game.computerHand = [makeCard('Speedster', { size: 1, speed: 999, lifespan: 999 })];
            const picks = {};
            for (let i = 0; i < 120; i++) {
                const pick = Engine.chooseComputerCategory(game);
                picks[pick.category] = (picks[pick.category] || 0) + 1;
            }
            assert(
                Object.keys(picks).length > 1,
                'a lopsided card is still played at random: ' + JSON.stringify(picks)
            );
        });

        test('a seeded game replays exactly, mode draws included', function () {
            const play = function () {
                const game = Engine.createGame(theme, { rng: makeRng(21) });
                const picks = [];
                for (let i = 0; i < 40; i++) {
                    const pick = Engine.chooseComputerCategory(game);
                    picks.push(pick.mode + ':' + pick.category);
                }
                return picks;
            };
            equal(play().join(' | '), play().join(' | '), 'same seed, same choices');
        });

        test('the AI returns null when there are no attributes', function () {
            equal(Engine.selectComputerCategory({ attributeKeys: [] }), null, 'no attributes');
            equal(Engine.chooseComputerCategory({ attributeKeys: [] }), null, 'no attributes, no pick');
        });

        test('a round the computer chose records the mode it used', function () {
            const game = Engine.createGame(theme, { rng: makeRng(5) });
            const pick = Engine.chooseComputerCategory(game);
            const result = Engine.playRound(game, pick.category, pick.mode);
            equal(result.mode, pick.mode, 'the result carries the mode');
            equal(game.log[0].mode, pick.mode, 'so does the log');
            equal(game.log[0].category, pick.category, 'with the category it chose');
        });

        test('a round the player chose records no mode', function () {
            const game = Engine.createGame(theme, { rng: makeRng(5) });
            const result = Engine.playRound(game, game.attributeKeys[0]);
            equal(result.mode, null, 'no mode for a player pick');
            equal(game.log[0].mode, null, 'the log agrees');
        });

        test('"mixed" is a picker, so it is never recorded as a mode', function () {
            const game = Engine.createGame(theme, { rng: makeRng(4) });
            const result = Engine.playRound(game, game.attributeKeys[1], Engine.MIXED_AI);
            equal(result.mode, null, 'mixed never reaches the log');
        });

        test('the summary counts the computer\u2019s picks by mode', function () {
            const game = Engine.createGame(theme, { rng: makeRng(8) });
            let computerLed = 0;
            while (game.phase === Engine.PHASE.PLAYING) {
                let category = game.attributeKeys[0];
                let mode = null;
                if (game.turn === Engine.COMPUTER) {
                    const pick = Engine.chooseComputerCategory(game);
                    category = pick.category;
                    mode = pick.mode;
                    computerLed += 1;
                }
                Engine.playRound(game, category, mode);
            }
            const summary = Engine.summarise(game);
            const counted = Engine.AI_MODES.reduce(function (total, mode) {
                return total + summary.aiModes[mode];
            }, 0);
            equal(counted, computerLed, 'every computer-led round is counted once');
            equal(summary.rounds, game.round, 'and the rounds still add up');
        });
    }

    function winConditions() {
        test('the game ends when a pile is empty and the holder wins', function () {
            const game = Engine.createGame(theme, { rng: makeRng(4) });
            game.playerHand = [
                makeCard('Winner', { size: 1, speed: 1, lifespan: 1 }),
                makeCard('W2', { size: 1, speed: 1, lifespan: 1 })
            ];
            game.computerHand = [];
            equal(Engine.checkGameOver(game), true, 'game over detected');
            equal(game.phase, Engine.PHASE.GAME_OVER, 'phase');
            equal(game.winner, Engine.PLAYER, 'player wins');
            equal(game.playerHand.length, 2, 'winner keeps its cards');
        });

        test('the loser of a pile race sees the winner claim the pot', function () {
            const game = Engine.createGame(theme, { rng: makeRng(4) });
            game.playerHand = [];
            game.computerHand = [makeCard('C', { size: 1, speed: 1, lifespan: 1 })];
            game.drawPile = [
                makeCard('D1', { size: 1, speed: 1, lifespan: 1 }),
                makeCard('D2', { size: 1, speed: 1, lifespan: 1 })
            ];
            Engine.checkGameOver(game);
            equal(game.winner, Engine.COMPUTER, 'computer wins');
            equal(game.computerHand.length, 3, 'computer claimed the pot');
            equal(game.drawPile.length, 0, 'pot cleared');
        });

        test('a game where both piles empty is a draw', function () {
            const game = Engine.createGame(theme, { rng: makeRng(4) });
            game.playerHand = [];
            game.computerHand = [];
            game.drawPile = [makeCard('D', { size: 1, speed: 1, lifespan: 1 })];
            Engine.checkGameOver(game);
            equal(game.winner, Engine.DRAW, 'nobody could play');
            equal(game.drawPile.length, 1, 'unclaimed cards stay in the pot');
        });

        test('an empty pile triggers game over from inside playRound', function () {
            const game = Engine.createGame(theme, { rng: makeRng(13) });
            game.playerHand = [makeCard('Last', { size: 1, speed: 1, lifespan: 1 })];
            game.computerHand = [makeCard('Final', { size: 999, speed: 1, lifespan: 1 })];
            Engine.playRound(game, 'size');
            equal(game.phase, Engine.PHASE.GAME_OVER, 'phase after final round');
            equal(game.winner, Engine.COMPUTER, 'computer wins the last card');
        });

        test('getCardCounts reports both piles and the pot', function () {
            const game = Engine.createGame(theme, { rng: makeRng(1) });
            const counts = Engine.getCardCounts(game);
            equal(counts.player + counts.computer + counts.drawPile, DECK_SIZE, 'total counted');
            deepEqual(
                counts,
                { player: Math.ceil(DECK_SIZE / 2), computer: Math.floor(DECK_SIZE / 2), drawPile: 0 },
                'counts'
            );
        });
    }

    function superTrunfoAndModes() {
        const superTheme = {
            id: 'super-test',
            theme: 'Super Test',
            attributes: ['size', 'speed'],
            units: { size: 'cm', speed: 'km/h' },
            cards: [
                { name: 'Trump', attributes: { size: 1, speed: 1 }, superTrunfo: true },
                { name: 'Big', attributes: { size: 500, speed: 1 } },
                { name: 'Quick', attributes: { size: 1, speed: 120 } },
                { name: 'Middling', attributes: { size: 250, speed: 100 } }
            ]
        };

        test('a Super Trunfo card beats a higher value', function () {
            const deck = Engine.createDeck(superTheme);
            const trump = deck[0];
            const big = deck[1];
            const result = Engine.compareCards(trump, big, 'size');
            equal(result.outcome, Engine.PLAYER, 'the trump wins despite size 1 vs 500');
            equal(result.superTrunfo, true, 'the result is flagged as a trump round');
        });

        test('two Super Trunfo cards fall back to the higher value', function () {
            const a = { name: 'A', superTrunfo: true, attributes: { size: 10, speed: 1 } };
            const b = { name: 'B', superTrunfo: true, attributes: { size: 99, speed: 1 } };
            const result = Engine.compareCards(a, b, 'size');
            equal(result.outcome, Engine.COMPUTER, 'higher value decides');
            equal(result.superTrunfo, true, 'still flagged as a trump round');
        });

        test('a trump round is recorded on the round result and the log', function () {
            const game = Engine.createGame(superTheme, { rng: makeRng(1) });
            game.playerHand = [{ name: 'Trump', attributes: { size: 1, speed: 1 }, superTrunfo: true }];
            game.computerHand = [{ name: 'Big', attributes: { size: 500, speed: 1 } }];
            const result = Engine.playRound(game, 'size');
            equal(result.outcome, Engine.PLAYER, 'trump wins');
            equal(result.superTrunfo, true, 'flagged on the result');
            equal(game.log[game.log.length - 1].superTrunfo, true, 'flagged in the log');
        });

        test('the random mode plays a stat off the card, ignoring its values', function () {
            const game = Engine.createGame(superTheme, { rng: makeRng(1), ai: 'random' });
            game.computerHand = [{ name: 'Quick', attributes: { size: 1, speed: 120 } }];
            const picks = {};
            for (let i = 0; i < 100; i++) {
                const pick = Engine.chooseComputerCategory(game);
                equal(pick.mode, 'random', 'the mode is reported');
                picks[pick.category] = 1;
            }
            equal(Object.keys(picks).sort().join(','), 'size,speed', 'both stats get picked');
        });

        test('the "best" AI plays the value furthest from the losing end', function () {
            const game = Engine.createGame(superTheme, { rng: makeRng(1), ai: 'best' });
            game.computerHand = [{ name: 'Middling', attributes: { size: 250, speed: 100 } }];
            // size 250 beats the deck floor of 1 by 249; speed 100 beats 1 by 99.
            equal(Engine.selectComputerCategory(game), 'size', 'the biggest raw margin wins');
            equal(Engine.chooseComputerCategory(game).mode, 'best', 'and the mode comes back with the pick');
        });

        test('the "adaptive" AI plays the best value relative to the deck', function () {
            const game = Engine.createGame(superTheme, { rng: makeRng(1), ai: 'adaptive' });
            // size 250/500 = 0.5 but speed 100/120 = 0.83, so speed is the better bet.
            game.computerHand = [{ name: 'Middling', attributes: { size: 250, speed: 100 } }];
            equal(Engine.selectComputerCategory(game), 'speed', 'normalised values decide');
        });

        test('createGame stores the deck ceiling and the pinned mode', function () {
            const game = Engine.createGame(superTheme, { rng: makeRng(1), ai: 'adaptive' });
            equal(game.aiStrategy, 'adaptive', 'mode stored');
            equal(game.maxima.size, 500, 'size ceiling');
            equal(game.maxima.speed, 120, 'speed ceiling');
        });

        test('an odd deck seeds the pot so the extra card is contested', function () {
            const oddTheme = {
                id: 'odd',
                theme: 'Odd',
                attributes: ['size'],
                cards: [
                    { name: 'A', attributes: { size: 1 } },
                    { name: 'B', attributes: { size: 2 } },
                    { name: 'C', attributes: { size: 3 } }
                ]
            };
            const game = Engine.createGame(oddTheme, { rng: makeRng(2) });
            equal(game.playerHand.length, 1, 'player pile');
            equal(game.computerHand.length, 1, 'computer pile');
            equal(game.drawPile.length, 1, 'the spare card is in the pot');
        });

        test('a one-card deck is resolved at deal time, not left hanging', function () {
            const solo = {
                id: 'solo',
                theme: 'Solo',
                attributes: ['size'],
                cards: [{ name: 'Only', attributes: { size: 1 } }]
            };
            const game = Engine.createGame(solo, { rng: makeRng(1) });
            equal(game.phase, Engine.PHASE.GAME_OVER, 'the game never enters a playable state');
            equal(game.winner, Engine.DRAW, 'nobody can play');
            equal(game.reason, 'stalemate', 'reason recorded');
            equal(game.drawPile.length, 1, 'the only card sits in the pot');
        });

        test('roundLimit: 0 disables the limit', function () {
            equal(
                Engine.createGame(theme, { rng: makeRng(1), roundLimit: 0 }).roundLimit,
                0,
                'zero is stored, not replaced by the default'
            );
            const uncapped = Engine.createGame(theme, { rng: makeRng(4), roundLimit: 0 });
            let guard = 0;
            while (uncapped.phase === Engine.PHASE.PLAYING && guard < 4000) {
                Engine.playRound(
                    uncapped,
                    uncapped.turn === Engine.PLAYER
                        ? uncapped.attributeKeys[0]
                        : Engine.selectComputerCategory(uncapped)
                );
                guard += 1;
            }
            equal(uncapped.reason === 'round-limit', false, 'the limit never fires');
            assert(uncapped.phase === Engine.PHASE.GAME_OVER, 'the game still ends on piles alone');
        });

        test('the shipped deck is plain "highest value wins"', function () {
            const deck = Engine.createDeck(theme);
            const trumps = deck.filter(function (card) {
                return Engine.isSuperTrunfo(card);
            });
            equal(trumps.length, 0, 'no card carries the off-spec trump flag');
        });

        test('summarise reports the match totals from the log', function () {
            const game = Engine.createGame(theme, { rng: makeRng(7) });
            let guard = 0;
            while (game.phase === Engine.PHASE.PLAYING && guard < 2000) {
                Engine.playRound(game, game.attributeKeys[game.round % game.attributeKeys.length]);
                guard += 1;
            }
            const summary = Engine.summarise(game);
            equal(summary.rounds, game.round, 'round count');
            equal(
                summary.playerRounds + summary.computerRounds + summary.draws,
                game.round,
                'every round is classified'
            );
            assert(summary.biggestPot >= 2, 'the biggest pot covers at least the two played cards');
            assert(typeof summary.longestAttribute === 'string', 'a contested category is reported');
        });

        test('updateState moves the pot to the named side and parks draws', function () {
            const game = Engine.createGame(theme, { rng: makeRng(3) });
            const cards = [{ id: 'x' }, { id: 'y' }];
            const before = game.playerHand.length;
            Engine.updateState(game, Engine.PLAYER, cards);
            equal(game.playerHand.length, before + 2, 'player collected the pot');
            equal(game.turn, Engine.PLAYER, 'player leads next');

            const potted = Engine.createGame(theme, { rng: makeRng(3) });
            Engine.updateState(potted, Engine.DRAW, cards);
            equal(potted.drawPile.length, 2, 'draw parks the cards');
        });
    }

    function directionsAndAi() {
        const lowerTheme = {
            id: 'lower-test',
            theme: 'Lower Test',
            attributes: ['price', 'speed'],
            units: { price: '$', speed: 'km/h' },
            directions: { price: 'lower' },
            cards: [
                { name: 'Cheap', attributes: { price: 10, speed: 50 } },
                { name: 'Mid', attributes: { price: 25, speed: 90 } },
                { name: 'Pricey', attributes: { price: 40, speed: 120 } }
            ]
        };

        test('createGame stores a complete direction map and the value range', function () {
            const game = Engine.createGame(lowerTheme, { rng: makeRng(1) });
            equal(game.directions.price, 'lower', 'the declared stat compares downward');
            equal(game.directions.speed, 'higher', 'everything else keeps the classic rule');
            equal(game.minima.price, 10, 'price floor');
            equal(game.maxima.price, 40, 'price ceiling');
            equal(game.minima.speed, 50, 'speed floor');
        });

        test('an unknown direction falls back to higher instead of throwing', function () {
            const game = Engine.createGame(
                {
                    id: 'junk',
                    attributes: ['a'],
                    directions: { a: 'sideways' },
                    cards: [
                        { name: 'A', attributes: { a: 1 } },
                        { name: 'B', attributes: { a: 2 } }
                    ]
                },
                { rng: makeRng(1) }
            );
            equal(game.directions.a, 'higher', 'junk is ignored');
        });

        test('playRound awards a lower-is-better stat to the smaller value', function () {
            const game = Engine.createGame(lowerTheme, { rng: makeRng(1) });
            game.playerHand = [{ name: 'Cheap', attributes: { price: 10, speed: 50 } }];
            game.computerHand = [{ name: 'Pricey', attributes: { price: 40, speed: 50 } }];

            const result = Engine.playRound(game, 'price');
            equal(result.outcome, Engine.PLAYER, 'the cheaper card wins');
            equal(result.direction, 'lower', 'the rule is on the round result');
            equal(game.log[game.log.length - 1].direction, 'lower', 'and in the log');
        });

        test('the "best" AI plays the lowest value on a lower-is-better stat', function () {
            const game = Engine.createGame(lowerTheme, { rng: makeRng(1), ai: 'best' });
            game.computerHand = [{ name: 'Cheap', attributes: { price: 10, speed: 50 } }];
            equal(Engine.selectComputerCategory(game), 'price', 'the smallest raw number wins the pick');
        });

        test('the "adaptive" AI normalises both directions against the deck', function () {
            const game = Engine.createGame(lowerTheme, { rng: makeRng(1), ai: 'adaptive' });
            // price 10 is the deck floor (score 1), speed 50 of 120 (score ~0.41).
            game.computerHand = [{ name: 'Cheap', attributes: { price: 10, speed: 50 } }];
            equal(Engine.selectComputerCategory(game), 'price', 'the better relative position wins');
        });

        test('attributeScore maps both directions onto 0..1 goodness', function () {
            const game = Engine.createGame(lowerTheme, { rng: makeRng(1) });
            equal(Engine.attributeScore(game, 'price', 10), 1, 'the lowest price is best');
            equal(Engine.attributeScore(game, 'price', 40), 0, 'the highest price is worst');
            equal(Engine.attributeScore(game, 'speed', 120), 1, 'the fastest is best');
            equal(Engine.attributeScore(game, 'speed', 50), 0, 'the slowest is worst');
        });
    }

    function shippedThemes() {
        test('every shipped theme is well-formed', function () {
            assert(Deck.THEMES.length >= 2, 'more than one deck ships: ' + Deck.THEMES.length);

            Deck.THEMES.forEach(function (theme) {
                const deck = Engine.createDeck(theme);
                equal(deck.length, theme.cards.length, theme.id + ': card count');
                equal(
                    Object.keys(deck[0].attributes).length,
                    theme.attributes.length,
                    theme.id + ': stat count'
                );
                assert(theme.attributes.length <= 5, theme.id + ': within the five-stat limit');

                const names = deck.map(function (card) {
                    return card.name;
                });
                equal(new Set(names).size, names.length, theme.id + ': card names are unique');

                theme.attributes.forEach(function (key) {
                    assert(!!theme.labels[key], theme.id + ': ' + key + ' has a label');
                    assert(!!theme.units[key], theme.id + ': ' + key + ' has a unit');
                });
            });
        });

        test('the electric-car deck carries five stats on every card', function () {
            const cars = Deck.getTheme('electric-cars-2026');
            assert(cars, 'the deck exists');
            equal(cars.attributes.length, 5, 'five stats');
            equal(cars.cards.length, 16, 'sixteen cars');

            Engine.createDeck(cars).forEach(function (card) {
                equal(Object.keys(card.attributes).length, 5, card.name + ': five values');
                Object.keys(card.attributes).forEach(function (key) {
                    equal(typeof card.attributes[key], 'number', card.name + ' / ' + key + ' is numeric');
                });
            });
        });

        test('the electric-car deck declares its one lower-is-better stat', function () {
            const cars = Deck.getTheme('electric-cars-2026');
            deepEqual(Object.keys(cars.directions || {}), ['acceleration'], 'only the 0–100 time');

            const game = Engine.createGame(cars, { rng: makeRng(2) });
            equal(game.directions.acceleration, 'lower', 'quicker cars win');
            equal(game.directions.range, 'higher', 'the rest are higher-is-better');
            equal(game.minima.acceleration, 2.1, 'the quickest car sets the floor');

            // The same two cards must resolve in opposite directions per stat.
            const plaid = { name: 'Plaid', attributes: cars.cards[1].attributes };
            const ioniq = { name: 'Ioniq', attributes: cars.cards[8].attributes };
            equal(
                Engine.compareCards(plaid, ioniq, 'acceleration', game.directions.acceleration).outcome,
                Engine.PLAYER,
                'the quicker car wins the 0–100 stat'
            );
            equal(
                Engine.compareCards(plaid, ioniq, 'range', game.directions.range).outcome,
                Engine.PLAYER,
                'and still wins on range'
            );
        });

        test('the electric-car deck references artwork that ships with the app', function () {
            const cars = Deck.getTheme('electric-cars-2026');
            const missing = [];

            Engine.createDeck(cars).forEach(function (card) {
                assert(!!card.imageUrl, card.name + ': has an imageUrl');
                assert(
                    /^assets\/cars\/[a-z0-9-]+\.jpg$/.test(card.imageUrl),
                    card.name + ': unexpected path ' + card.imageUrl
                );
                // Only Node can touch the filesystem; the in-browser copy of
                // this suite skips the existence check.
                if (typeof require === 'function') {
                    const fs = require('fs');
                    const path = require('path');
                    const file = path.join(__dirname, '..', 'src', card.imageUrl);
                    if (!fs.existsSync(file)) missing.push(card.imageUrl);
                }
            });

            equal(missing.length, 0, 'every referenced file exists: ' + missing.join(', '));
        });

        test('every shipped theme plays to completion', function () {
            const seeds = 60;
            Deck.THEMES.forEach(function (theme) {
                let finished = 0;
                for (let seed = 1; seed <= seeds; seed++) {
                    const game = Engine.createGame(theme, { rng: makeRng(seed) });
                    let guard = 0;
                    while (game.phase === Engine.PHASE.PLAYING && guard < 2000) {
                        Engine.playRound(
                            game,
                            game.turn === Engine.PLAYER
                                ? game.attributeKeys[game.round % game.attributeKeys.length]
                                : Engine.selectComputerCategory(game)
                        );
                        guard += 1;
                    }
                    if (game.phase === Engine.PHASE.GAME_OVER) finished += 1;
                }
                equal(finished, seeds, theme.id + ': every game ended');
            });
        });
    }

    function fullGameSimulation() {
        test('200 seeded games with the mixed AI all terminate with cards conserved', function () {
            let limited = 0;

            for (let seed = 1; seed <= 200; seed++) {
                const game = Engine.createGame(theme, { rng: makeRng(seed) });
                let guard = 0;

                while (game.phase === Engine.PHASE.PLAYING && guard < 5000) {
                    const before = totalCards(game);
                    // The player rotates through the stats; the computer plays the
                    // shipped default, drawing a mode for each round it leads.
                    const pick =
                        game.turn === Engine.PLAYER
                            ? { category: game.attributeKeys[game.round % game.attributeKeys.length] }
                            : Engine.chooseComputerCategory(game);
                    Engine.playRound(game, pick.category, pick.mode);
                    equal(
                        totalCards(game),
                        before,
                        'card conservation (seed ' + seed + ', round ' + game.round + ')'
                    );
                    guard += 1;
                }

                equal(game.phase, Engine.PHASE.GAME_OVER, 'game finished (seed ' + seed + ')');
                assert(game.winner !== null, 'winner recorded (seed ' + seed + ')');
                assert(game.round <= game.roundLimit, 'round limit respected (seed ' + seed + ')');
                equal(totalCards(game), DECK_SIZE, 'all cards accounted for (seed ' + seed + ')');

                if (game.reason === 'round-limit') {
                    limited += 1;
                    continue; // decided on pile size, so the winner does not hold everything
                }

                const winnerHand =
                    game.winner === Engine.PLAYER
                        ? game.playerHand
                        : game.winner === Engine.COMPUTER
                          ? game.computerHand
                          : game.drawPile;
                equal(winnerHand.length, DECK_SIZE, 'winner holds the whole deck (seed ' + seed + ')');
            }

            assert(
                limited < 100,
                'most games should still end by emptying a pile, not at the limit: ' +
                    limited +
                    '/200 needed the limit'
            );
        });

        test('the round limit ends a game whose piles never empty', function () {
            const game = Engine.createGame(theme, { rng: makeRng(7), roundLimit: 3 });
            let guard = 0;
            while (game.phase === Engine.PHASE.PLAYING && guard < 100) {
                Engine.playRound(game, game.attributeKeys[0]);
                guard += 1;
            }
            equal(game.round, 3, 'stopped exactly at the limit');
            equal(game.reason, 'round-limit', 'the reason is recorded');
            assert(game.winner !== null, 'a winner is decided on pile size');
            equal(totalCards(game), DECK_SIZE, 'cards conserved');
        });

        test('two identical cards deadlock into a stalemate', function () {
            const deadlock = {
                id: 'deadlock',
                theme: 'Deadlock',
                attributes: ['size'],
                cards: [
                    { name: 'Same A', attributes: { size: 5 } },
                    { name: 'Same B', attributes: { size: 5 } }
                ]
            };
            const game = Engine.createGame(deadlock, { rng: makeRng(1) });
            Engine.playRound(game, 'size');
            equal(game.phase, Engine.PHASE.GAME_OVER, 'the single draw ends it');
            equal(game.reason, 'stalemate', 'both piles are empty');
            equal(game.winner, Engine.DRAW, 'nobody can play on');
        });

        test('across many seeds both players can win, so no side is hard-coded', function () {
            let playerWins = 0;
            let computerWins = 0;
            for (let seed = 1; seed <= 50; seed++) {
                const game = Engine.createGame(theme, { rng: makeRng(seed) });
                let guard = 0;
                while (game.phase === Engine.PHASE.PLAYING && guard < 2000) {
                    // Both sides play the first attribute: a symmetric contest of deals.
                    Engine.playRound(game, game.attributeKeys[0]);
                    guard += 1;
                }
                if (game.winner === Engine.PLAYER) playerWins += 1;
                if (game.winner === Engine.COMPUTER) computerWins += 1;
            }
            assert(playerWins > 0, 'player never won across 50 deals');
            assert(computerWins > 0, 'computer never won across 50 deals');
        });
    }

    function run() {
        results.passed = 0;
        results.failed = 0;
        results.failures = [];

        log('Trunfo engine tests');
        log('-------------------');

        deckAndDealing();
        comparisonAndRounds();
        aiBehaviour();
        winConditions();
        superTrunfoAndModes();
        directionsAndAi();
        shippedThemes();
        fullGameSimulation();

        log('-------------------');
        log('Passed: ' + results.passed + '  Failed: ' + results.failed);
        if (results.failed) {
            results.failures.forEach(function (failure) {
                log('  x ' + failure.name + ': ' + failure.message);
            });
        }
        return results;
    }

    return { run: run, results: results };
});

/* Direct Node execution: `node tests/engine.test.js` */
if (typeof require === 'function' && typeof module === 'object' && require.main === module) {
    const suite = module.exports(require('../src/js/engine.js'), require('../src/js/deck.js'));
    const outcome = suite.run();
    if (typeof process !== 'undefined') process.exit(outcome.failed ? 1 : 0);
}
