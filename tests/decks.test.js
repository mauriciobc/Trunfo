/**
 * Deck store test suite.
 *
 * Run in Node: node tests/decks.test.js
 *
 * Covers deck validation (including the five-stat limit), the local-database
 * store over the in-memory backend, artwork handling, and JSON export/import.
 */
(function (root, factory) {
    'use strict';
    if (typeof module === 'object' && module.exports) {
        module.exports = factory;
    } else {
        /** @type {Record<string, any>} */
        const host = /** @type {any} */ (root);
        host.createDeckTests = function () {
            return factory(host.TrunfoDecks, host.TrunfoDeck);
        };
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Decks, Deck) {
    'use strict';

    const results = { passed: 0, failed: 0, failures: [] };
    const queue = [];

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
        if (a !== b) throw new Error((message || 'value') + ': expected ' + b + ' but got ' + a);
    }

    /** Register a test; it may be synchronous or return a promise. */
    function test(name, fn) {
        queue.push({ name: name, fn: fn });
    }

    function log(line) {
        if (typeof console !== 'undefined' && console.log) console.log(line);
    }

    /** A tiny but real PNG, so the data URL checks exercise actual bytes. */
    const PNG =
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

    function fiveStatDeck(overrides) {
        return Object.assign(
            {
                theme: 'Dinosaurs',
                attributes: ['length', 'weight', 'speed', 'bite', 'age'],
                labels: {
                    length: 'Length',
                    weight: 'Weight',
                    speed: 'Speed',
                    bite: 'Bite Force',
                    age: 'Age'
                },
                units: { length: 'm', weight: 't', speed: 'km/h', bite: 'kN', age: 'years' },
                cards: [
                    {
                        name: 'T-Rex',
                        icon: 'X',
                        attributes: { length: 12, weight: 8, speed: 27, bite: 35, age: 28 }
                    },
                    {
                        name: 'Triceratops',
                        attributes: { length: 9, weight: 6, speed: 24, bite: 12, age: 30 }
                    },
                    {
                        name: 'Velociraptor',
                        attributes: { length: 2, weight: 0.08, speed: 40, bite: 3, age: 15 }
                    },
                    {
                        name: 'Stegosaurus',
                        attributes: { length: 9, weight: 5, speed: 12, bite: 8, age: 25 }
                    }
                ]
            },
            overrides || {}
        );
    }

    async function freshStore() {
        const store = Decks.createStore(Decks.memoryBackend(), Deck.THEMES);
        await store.ready();
        return store;
    }

    /* ------------------------------------------------------------ the tests */

    function textHelpers() {
        test('prettify turns keys into readable labels', function () {
            equal(Decks.prettify('size'), 'Size', 'plain');
            equal(Decks.prettify('top_speed'), 'Top Speed', 'snake case');
            equal(Decks.prettify('topSpeed'), 'Top Speed', 'camel case');
            equal(Decks.prettify('bite-force'), 'Bite Force', 'kebab case');
        });

        test('slug produces stable attribute keys', function () {
            equal(Decks.slug('Bite Force'), 'bite_force', 'spaces');
            equal(Decks.slug('  Top  Speed  '), 'top_speed', 'collapses runs');
            equal(Decks.slug('topSpeed'), 'top_speed', 'camel case');
            equal(Decks.slug('!!!'), 'stat', 'falls back when nothing survives');
            equal(Decks.slug('!!!', 'stat_2'), 'stat_2', 'uses the supplied fallback');
        });

        test('data URL helpers measure and recognise images', function () {
            assert(Decks.isImageDataUrl(PNG), 'a PNG data URL is an image');
            assert(!Decks.isImageDataUrl('data:text/plain;base64,QQ=='), 'other data URLs are not');
            assert(!Decks.isImageDataUrl('https://example.com/a.png'), 'a URL is not a data URL');
            assert(Decks.dataUrlBytes(PNG) > 50, 'byte count is plausible: ' + Decks.dataUrlBytes(PNG));
        });
    }

    function validation() {
        test('a well-formed five-stat deck passes validation', function () {
            deepEqual(Decks.validate(fiveStatDeck()), [], 'no errors');
            const result = Decks.normalize(fiveStatDeck());
            equal(result.deck.attributes.length, 5, 'five stats kept');
            equal(result.deck.cards.length, 4, 'one whole group kept');
        });

        test('the five-stat limit is enforced', function () {
            const tooMany = fiveStatDeck({
                attributes: ['a', 'b', 'c', 'd', 'e', 'f'],
                labels: {},
                units: {},
                cards: [
                    { name: 'One', attributes: { a: 1, b: 1, c: 1, d: 1, e: 1, f: 1 } },
                    { name: 'Two', attributes: { a: 1, b: 1, c: 1, d: 1, e: 1, f: 1 } },
                    { name: 'Three', attributes: { a: 1, b: 1, c: 1, d: 1, e: 1, f: 1 } },
                    { name: 'Four', attributes: { a: 1, b: 1, c: 1, d: 1, e: 1, f: 1 } }
                ]
            });
            const errors = Decks.validate(tooMany);
            equal(errors.length, 1, 'one error');
            assert(/at most 5 stats/.test(errors[0]), 'names the limit: ' + errors[0]);
        });

        test('a deck needs a name', function () {
            const errors = Decks.validate(fiveStatDeck({ theme: '   ' }));
            assert(
                errors.some(function (e) {
                    return /name/i.test(e);
                }),
                'names the problem'
            );
        });

        test('cards must come in whole groups of four', function () {
            const base = fiveStatDeck();
            const eight = base.cards.concat(base.cards);
            [1, 2, 3, 5, 7].forEach(function (count) {
                const errors = Decks.validate(fiveStatDeck({ cards: eight.slice(0, count) }));
                assert(
                    errors.some(function (e) {
                        return /groups of four/.test(e);
                    }),
                    count + ' cards: names the problem'
                );
            });

            const full = Decks.validate(fiveStatDeck({ cards: eight }));
            deepEqual(full, [], 'two whole groups are fine');
        });

        test('a deck holds at most eight groups', function () {
            const base = fiveStatDeck();
            const nine = [];
            for (let i = 0; i < 36; i++) nine.push(base.cards[i % base.cards.length]);

            const errors = Decks.validate(fiveStatDeck({ cards: nine }));
            assert(
                errors.some(function (e) {
                    return /4 to 32 cards/.test(e);
                }),
                'names the ceiling: ' + errors.join(' | ')
            );
            equal(Decks.MAX_CARDS, Decks.CARDS_PER_GROUP * Decks.MAX_GROUPS, 'the ceiling is the groups');
        });

        test('every card needs a name and a number for every stat', function () {
            const good = fiveStatDeck().cards[2];
            const errors = Decks.validate(
                fiveStatDeck({
                    cards: [
                        { name: '', attributes: { length: 1, weight: 1, speed: 1, bite: 1, age: 1 } },
                        { name: 'Bad', attributes: { length: 'huge', weight: 1, speed: 1, bite: 1, age: 1 } },
                        good,
                        good
                    ]
                })
            );
            equal(errors.length, 2, 'both problems reported: ' + errors.join(' | '));
            assert(errors[0].indexOf('Card 1') === 0, 'first error names card 1');
            assert(errors[1].indexOf('Card 2 (Bad)') === 0, 'second error names card 2');
        });

        test('keys are slugified and de-duplicated', function () {
            const result = Decks.normalize(
                fiveStatDeck({
                    attributes: ['Top Speed', 'top speed'],
                    labels: { 'Top Speed': 'Top Speed', 'top speed': 'Top Speed' },
                    units: {},
                    cards: [
                        { name: 'A', attributes: { 'Top Speed': 1, 'top speed': 2 } },
                        { name: 'B', attributes: { 'Top Speed': 3, 'top speed': 4 } },
                        { name: 'C', attributes: { 'Top Speed': 5, 'top speed': 6 } },
                        { name: 'D', attributes: { 'Top Speed': 7, 'top speed': 8 } }
                    ]
                })
            );
            deepEqual(result.deck.attributes, ['top_speed', 'top_speed_2'], 'unique keys');
            deepEqual(result.deck.cards[0].attributes, { top_speed: 1, top_speed_2: 2 }, 'values remapped');
        });

        test('an imageId survives normalisation, junk does not', function () {
            const rest = fiveStatDeck().cards.slice(2);
            const kept = Decks.normalize(
                fiveStatDeck({
                    cards: [
                        { name: 'A', imageId: 'img-abc-1', attributes: fiveStatDeck().cards[0].attributes },
                        { name: 'B', imageId: 'not-an-id', attributes: fiveStatDeck().cards[1].attributes }
                    ].concat(rest)
                })
            ).deck;
            equal(kept.cards[0].imageId, 'img-abc-1', 'valid id kept');
            equal(kept.cards[1].imageId, null, 'invalid id dropped');

            const inline = Decks.normalize(
                fiveStatDeck({
                    cards: [
                        { name: 'A', image: PNG, attributes: fiveStatDeck().cards[0].attributes },
                        { name: 'B', attributes: fiveStatDeck().cards[1].attributes }
                    ].concat(rest)
                })
            ).deck;
            equal(inline.cards[0].imageId, null, 'an inline data URL is not stored on the deck record');
        });

        test('non-object input is rejected', function () {
            assert(Decks.validate(null).length === 1, 'null');
            assert(Decks.validate([]).length === 1, 'array');
            assert(Decks.validate('nope').length === 1, 'string');
        });

        test('a deck may mark one card as the Super Trunfo', function () {
            const base = fiveStatDeck();
            const marked = base.cards.map(function (card, index) {
                return index === 2 ? Object.assign({}, card, { superTrunfo: true }) : card;
            });

            const result = Decks.normalize(fiveStatDeck({ cards: marked }));
            deepEqual(result.errors, [], 'one trump is accepted');
            equal(result.deck.cards[2].superTrunfo, true, 'the mark survives normalisation');
            equal(result.deck.cards[0].superTrunfo, false, 'and the other cards are plain');

            const twoTrumps = marked.map(function (card, index) {
                return index === 3 ? Object.assign({}, card, { superTrunfo: true }) : card;
            });
            const errors = Decks.validate(fiveStatDeck({ cards: twoTrumps }));
            equal(errors.length, 1, 'a second trump is refused: ' + errors.join(' | '));
            assert(/Super Trunfo/.test(errors[0]), 'and the message names the rule');
        });

        test('a "lowest wins" stat survives normalisation', function () {
            const result = Decks.normalize(fiveStatDeck({ directions: { weight: 'lower' } }));
            deepEqual(result.deck.directions, { weight: 'lower' }, 'only the exception is kept');
            deepEqual(
                Decks.normalize(fiveStatDeck()).deck.directions,
                {},
                'a deck with no rules stores an empty map'
            );
        });

        test('a junk comparison rule is ignored, not rejected', function () {
            const result = Decks.normalize(
                fiveStatDeck({ directions: { weight: 'sideways', length: 'lower' } })
            );
            deepEqual(result.deck.directions, { length: 'lower' }, 'valid kept, junk dropped');
        });
    }

    function catalogue() {
        test('the store lists the built-ins first and marks them read-only', async function () {
            const store = await freshStore();
            const list = store.list();
            equal(list.length, Deck.THEMES.length, 'only built-ins to start');
            equal(list[0].builtIn, true, 'first entry is built in');
            equal(list[0].id, Deck.DEFAULT_THEME_ID, 'default deck first');
            equal(list[0].cards, Deck.AWESOME_ANIMALS.cards.length, 'card count');
            equal(list[0].stats, 3, 'stat count');
        });

        test('a saved deck appears in the catalogue and can be fetched', async function () {
            const store = await freshStore();
            const saved = await store.save(fiveStatDeck());
            equal(saved.ok, true, 'save succeeded: ' + saved.errors.join(' '));

            const list = store.list();
            equal(list.length, Deck.THEMES.length + 1, 'catalogue grew');
            const entry = list[list.length - 1];
            equal(entry.theme, 'Dinosaurs', 'name');
            equal(entry.cards, 4, 'card count');
            equal(entry.stats, 5, 'stat count');
            equal(entry.builtIn, false, 'custom deck is not built in');

            const fetched = store.get(entry.id);
            equal(fetched.cards[0].name, 'T-Rex', 'cards round-tripped');
            equal(fetched.labels.bite, 'Bite Force', 'labels round-tripped');
        });

        test('saving the same deck twice updates instead of duplicating', async function () {
            const store = await freshStore();
            const first = await store.save(fiveStatDeck());
            const second = await store.save(
                Object.assign({}, fiveStatDeck(), { id: first.deck.id, theme: 'Renamed' })
            );
            equal(second.ok, true, 'second save ok');
            equal(store.count(), 1, 'still one custom deck');
            equal(store.get(first.deck.id).theme, 'Renamed', 'updated in place');
        });

        test('decks survive a new store over the same backend', async function () {
            const backend = Decks.memoryBackend();
            const a = Decks.createStore(backend, Deck.THEMES);
            await a.ready();
            const saved = await a.save(fiveStatDeck());

            const b = Decks.createStore(backend, Deck.THEMES);
            await b.ready();
            equal(b.get(saved.deck.id).theme, 'Dinosaurs', 'reloaded from the database');
        });

        test('the custom-deck cap is enforced', async function () {
            const store = await freshStore();
            for (let i = 0; i < Decks.MAX_DECKS; i++) {
                const result = await store.save(fiveStatDeck({ theme: 'Deck ' + i }));
                equal(result.ok, true, 'save ' + i);
            }
            const overflow = await store.save(fiveStatDeck({ theme: 'One too many' }));
            equal(overflow.ok, false, 'refused');
            assert(/at most/.test(overflow.errors[0]), 'explains the cap: ' + overflow.errors[0]);
        });

        test('the built-in deck cannot be deleted, custom decks can', async function () {
            const store = await freshStore();
            equal((await store.remove(Deck.DEFAULT_THEME_ID)).ok, false, 'built-in protected');
            const saved = await store.save(fiveStatDeck());
            equal((await store.remove(saved.deck.id)).ok, true, 'custom deck deleted');
            equal(store.count(), 0, 'gone');
        });

        test('an invalid deck is refused with reasons', async function () {
            const store = await freshStore();
            const result = await store.save(fiveStatDeck({ theme: '' }));
            equal(result.ok, false, 'refused');
            assert(result.errors.length > 0, 'reasons given');
            equal(store.count(), 0, 'nothing stored');
        });

        test('a failing backend is reported instead of throwing', async function () {
            const hostile = Decks.memoryBackend();
            hostile.putDeck = function () {
                return Promise.reject(new Error('quota exceeded'));
            };
            const store = Decks.createStore(hostile, Deck.THEMES);
            await store.ready();
            const result = await store.save(fiveStatDeck());
            equal(result.ok, false, 'refused');
            assert(/local database/.test(result.errors[0]), 'explains: ' + result.errors[0]);
            equal(store.count(), 0, 'mirror not updated');
        });

        test('a backend that cannot load still gives the built-ins', async function () {
            const broken = Decks.memoryBackend();
            broken.loadDecks = function () {
                return Promise.reject(new Error('database unavailable'));
            };
            const store = Decks.createStore(broken, Deck.THEMES);
            await store.ready();
            equal(store.list().length, Deck.THEMES.length, 'built-ins available');
            equal(store.describe().error !== null, true, 'the failure is recorded');
        });
    }

    function selection() {
        test('the built-in deck is selected by default', async function () {
            const store = await freshStore();
            equal(store.selected(), Deck.DEFAULT_THEME_ID, 'default selection');
        });

        test('a saved deck can be selected and remembered', async function () {
            const backend = Decks.memoryBackend();
            const a = Decks.createStore(backend, Deck.THEMES);
            await a.ready();
            const saved = await a.save(fiveStatDeck());
            await a.select(saved.deck.id);

            const b = Decks.createStore(backend, Deck.THEMES);
            await b.ready();
            equal(b.selected(), saved.deck.id, 'selection persisted');
        });

        test('deleting the selected deck falls back to the built-in', async function () {
            const store = await freshStore();
            const saved = await store.save(fiveStatDeck());
            await store.select(saved.deck.id);
            await store.remove(saved.deck.id);
            equal(store.selected(), Deck.DEFAULT_THEME_ID, 'fell back');
        });

        test('a stale selection falls back to the built-in', async function () {
            const backend = Decks.memoryBackend();
            await backend.setMeta('selected', 'custom-does-not-exist');
            const store = Decks.createStore(backend, Deck.THEMES);
            await store.ready();
            equal(store.selected(), Deck.DEFAULT_THEME_ID, 'ignored the stale id');
        });
    }

    function artwork() {
        test('an image is stored, measured and readable back', async function () {
            const store = await freshStore();
            const stored = await store.putImage(PNG, { width: 1, height: 1 });
            equal(stored.ok, true, 'stored: ' + stored.errors.join(' '));
            assert(/^img-/.test(stored.image.id), 'id looks like an image id: ' + stored.image.id);
            equal(store.image(stored.image.id), PNG, 'reads back');
            equal(store.image('img-nope'), null, 'unknown id returns null');
            equal(store.imageStats().count, 1, 'one image held');
            assert(store.imageStats().bytes > 0, 'bytes accounted for');
        });

        test('non-images and oversized images are refused', async function () {
            const store = await freshStore();
            const notAnImage = await store.putImage('data:text/plain;base64,QQ==');
            equal(notAnImage.ok, false, 'text refused');
            assert(/not an image/.test(notAnImage.errors[0]), 'explains: ' + notAnImage.errors[0]);

            const huge = 'data:image/png;base64,' + 'A'.repeat(Decks.MAX_IMAGE_BYTES * 2);
            const tooBig = await store.putImage(huge);
            equal(tooBig.ok, false, 'oversized refused');
            assert(/too large/.test(tooBig.errors[0]), 'explains: ' + tooBig.errors[0]);
        });

        test('a deck hydrates with its card artwork attached', async function () {
            const store = await freshStore();
            const image = (await store.putImage(PNG)).image;
            const deck = fiveStatDeck();
            deck.cards[0].imageId = image.id;

            const saved = await store.save(deck);
            const hydrated = store.hydrate(saved.deck);
            equal(hydrated.cards[0].image, PNG, 'first card has the picture');
            equal(hydrated.cards[1].image, undefined, 'second card has none');
            equal(saved.deck.cards[0].image, undefined, 'the stored record stays lean');
        });

        test('artwork no deck uses any more is pruned', async function () {
            const store = await freshStore();
            const used = (await store.putImage(PNG)).image;
            const orphan = (await store.putImage(PNG)).image;
            equal(store.imageStats().count, 2, 'both stored');

            const deck = fiveStatDeck();
            deck.cards[0].imageId = used.id;
            await store.save(deck);
            const removed = await store.pruneImages();

            equal(removed, 1, 'one orphan removed');
            equal(store.image(orphan.id), null, 'orphan gone');
            equal(store.image(used.id), PNG, 'referenced image kept');
        });

        test('deleting a deck prunes its artwork', async function () {
            const store = await freshStore();
            const image = (await store.putImage(PNG)).image;
            const deck = fiveStatDeck();
            deck.cards[0].imageId = image.id;
            const saved = await store.save(deck);
            equal(store.imageStats().count, 1, 'stored');

            await store.remove(saved.deck.id);
            equal(store.imageStats().count, 0, 'pruned with the deck');
        });

        test('listing decks counts their artwork', async function () {
            const store = await freshStore();
            const image = (await store.putImage(PNG)).image;
            const deck = fiveStatDeck();
            deck.cards[0].imageId = image.id;
            await store.save(deck);

            const entry = store.list().filter(function (item) {
                return !item.builtIn;
            })[0];
            equal(entry.images, 1, 'one image counted');
        });
    }

    function importExport() {
        test('a deck round-trips through JSON with its artwork', async function () {
            const store = await freshStore();
            const image = (await store.putImage(PNG)).image;
            const deck = fiveStatDeck();
            deck.cards[0].imageId = image.id;
            const saved = await store.save(deck);

            const text = store.toJSON(saved.deck);
            assert(text.indexOf(PNG) !== -1, 'the artwork is inlined in the export');

            const parsed = await store.importJSON(text);
            equal(parsed.ok, true, 'parsed: ' + parsed.errors.join(' '));
            equal(parsed.decks[0].theme, 'Dinosaurs', 'name survived');
            deepEqual(parsed.decks[0].attributes, saved.deck.attributes, 'stats survived');
            assert(
                parsed.decks[0].cards[0].imageId && parsed.decks[0].cards[0].imageId !== image.id,
                'the imported card got its own stored copy'
            );
            equal(store.image(parsed.decks[0].cards[0].imageId), PNG, 'and the bytes match');
        });

        test('export can omit artwork', async function () {
            const store = await freshStore();
            const image = (await store.putImage(PNG)).image;
            const deck = fiveStatDeck();
            deck.cards[0].imageId = image.id;
            const saved = await store.save(deck);

            const lean = store.toJSON(saved.deck, { images: false });
            assert(lean.indexOf(PNG) === -1, 'no image data');
            assert(/"T-Rex"/.test(lean), 'the rest is still there');
        });

        test('a deck round-trips its comparison rules through JSON', async function () {
            const store = await freshStore();
            const saved = await store.save(fiveStatDeck({ directions: { weight: 'lower' } }));

            const text = store.toJSON(saved.deck, { images: false });
            assert(/"directions"/.test(text), 'the export names the rule');
            assert(/"weight": "lower"/.test(text), 'and which way it compares');

            const parsed = await store.importJSON(text);
            equal(parsed.ok, true, 'parsed: ' + parsed.errors.join(' '));
            deepEqual(parsed.decks[0].directions, { weight: 'lower' }, 'the rule survived the trip');
        });

        test('an imported deck gets a fresh id so it cannot overwrite', async function () {
            const store = await freshStore();
            const saved = await store.save(fiveStatDeck());
            const copy = JSON.parse(store.toJSON(saved.deck, { images: false }));
            copy.theme = 'Copy';

            const parsed = await store.importJSON(JSON.stringify(copy));
            equal(parsed.ok, true, 'parsed: ' + parsed.errors.join(' '));
            assert(parsed.decks[0].id !== saved.deck.id, 'new id: ' + parsed.decks[0].id);
            equal(parsed.decks[0].theme, 'Copy', 'name kept');
        });

        test('the Super Trunfo mark round-trips through JSON', async function () {
            const store = await freshStore();
            const base = fiveStatDeck();
            const cards = base.cards.map(function (card, index) {
                return index === 1 ? Object.assign({}, card, { superTrunfo: true }) : card;
            });
            const saved = await store.save(fiveStatDeck({ cards: cards }));

            const text = store.toJSON(saved.deck, { images: false });
            assert(/"superTrunfo": true/.test(text), 'the export carries the mark');

            const parsed = await store.importJSON(text);
            equal(parsed.ok, true, 'parsed: ' + parsed.errors.join(' '));
            equal(parsed.decks[0].cards[1].superTrunfo, true, 'the mark survived the trip');
            equal(parsed.decks[0].cards[0].superTrunfo, false, 'and did not spread');
        });

        test('a JSON array of decks is accepted', async function () {
            const store = await freshStore();
            const text = JSON.stringify([fiveStatDeck({ theme: 'One' }), fiveStatDeck({ theme: 'Two' })]);
            const parsed = await store.importJSON(text);
            equal(parsed.ok, true, 'parsed');
            equal(parsed.decks.length, 2, 'both decks');
            deepEqual(
                parsed.decks.map(function (d) {
                    return d.theme;
                }),
                ['One', 'Two'],
                'order kept'
            );
        });

        test('invalid JSON and invalid decks are reported', async function () {
            const store = await freshStore();
            const bad = await store.importJSON('{oops');
            equal(bad.ok, false, 'rejected');
            assert(/not valid JSON/.test(bad.errors[0]), 'explains: ' + bad.errors[0]);

            const invalid = await store.importJSON(JSON.stringify({ theme: '', attributes: [], cards: [] }));
            equal(invalid.ok, false, 'rejected');
            assert(invalid.errors.length > 0, 'reasons given');
        });

        test('exportAll writes every custom deck', async function () {
            const store = await freshStore();
            await store.save(fiveStatDeck({ theme: 'One' }));
            await store.save(fiveStatDeck({ theme: 'Two' }));
            const exported = JSON.parse(store.exportAll());
            equal(exported.length, 2, 'both exported');
        });
    }

    function migration() {
        test('decks from the old browser storage are migrated once', async function () {
            // The memory backend stands in for IndexedDB; localStorage is faked
            // just for the legacy keys.
            const cells = new Map();
            const previous = globalThis.localStorage;
            globalThis.localStorage = /** @type {any} */ ({
                getItem: function (key) {
                    return cells.has(key) ? cells.get(key) : null;
                },
                setItem: function (key, value) {
                    cells.set(key, String(value));
                },
                removeItem: function (key) {
                    cells.delete(key);
                }
            });
            try {
                cells.set(Decks.LEGACY_DECKS_KEY, JSON.stringify([fiveStatDeck({ id: 'custom-old-1' })]));
                cells.set(Decks.LEGACY_SELECTED_KEY, 'custom-old-1');

                const store = Decks.createStore(Decks.memoryBackend(), Deck.THEMES);
                await store.ready();

                equal(store.count(), 1, 'the legacy deck was imported');
                equal(store.selected(), 'custom-old-1', 'and its selection');
                equal(store.describe().migrated, 1, 'reported in the description');
                equal(cells.has(Decks.LEGACY_DECKS_KEY), false, 'the legacy key is cleared');
            } finally {
                if (previous === undefined) delete globalThis.localStorage;
                else globalThis.localStorage = previous;
            }
        });

        test('a legacy deck that is not a whole number of groups is reported, not dropped quietly', async function () {
            const cells = new Map();
            const previous = globalThis.localStorage;
            globalThis.localStorage = /** @type {any} */ ({
                getItem: function (key) {
                    return cells.has(key) ? cells.get(key) : null;
                },
                setItem: function (key, value) {
                    cells.set(key, String(value));
                },
                removeItem: function (key) {
                    cells.delete(key);
                }
            });
            try {
                const partial = fiveStatDeck({
                    id: 'custom-old-2',
                    cards: fiveStatDeck().cards.slice(0, 2)
                });
                cells.set(Decks.LEGACY_DECKS_KEY, JSON.stringify([partial]));

                const store = Decks.createStore(Decks.memoryBackend(), Deck.THEMES);
                await store.ready();

                equal(store.count(), 0, 'the partial deck was not imported');
                equal(store.describe().migrated, 0, 'nothing was claimed as imported');
                equal(store.describe().legacySkipped, 1, 'and the skip is reported');
            } finally {
                if (previous === undefined) delete globalThis.localStorage;
                else globalThis.localStorage = previous;
            }
        });
    }

    function run() {
        results.passed = 0;
        results.failed = 0;
        results.failures = [];

        log('Trunfo deck store tests');
        log('-----------------------');

        textHelpers();
        validation();
        catalogue();
        selection();
        artwork();
        importExport();
        migration();

        return queue
            .reduce(function (chain, entry) {
                return chain.then(function () {
                    return Promise.resolve()
                        .then(entry.fn)
                        .then(
                            function () {
                                results.passed += 1;
                                log('PASS  ' + entry.name);
                            },
                            function (error) {
                                results.failed += 1;
                                results.failures.push({ name: entry.name, message: error.message });
                                log('FAIL  ' + entry.name + '\n        ' + error.message);
                            }
                        );
                });
            }, Promise.resolve())
            .then(function () {
                log('-----------------------');
                log('Passed: ' + results.passed + '  Failed: ' + results.failed);
                if (results.failed) {
                    results.failures.forEach(function (failure) {
                        log('  x ' + failure.name + ': ' + failure.message);
                    });
                }
                return results;
            });
    }

    return { run: run, results: results };
});

/* Direct Node execution: `node tests/decks.test.js` */
if (typeof require === 'function' && typeof module === 'object' && require.main === module) {
    const suite = module.exports(require('../src/js/decks.js'), require('../src/js/deck.js'));
    suite
        .run()
        .then(function (outcome) {
            if (typeof process !== 'undefined') process.exit(outcome.failed ? 1 : 0);
        })
        .catch(function (error) {
            console.error(error);
            if (typeof process !== 'undefined') process.exit(1);
        });
}
