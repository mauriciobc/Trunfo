/**
 * Localization test suite.
 *
 * Run in Node: node tests/i18n.test.js
 *
 * The catalogs are data, so these tests guard the properties data can break:
 * the two languages stay key-for-key identical, every key the markup and the
 * controllers ask for exists, no key is left unused, placeholders and plurals
 * resolve, a regional tag picks the closest shipped language, and the shipped
 * decks and the store's messages really do come back translated.
 */
(function (root, factory) {
    'use strict';
    if (typeof module === 'object' && module.exports) {
        module.exports = factory;
    } else {
        /** @type {Record<string, any>} */
        const host = /** @type {any} */ (root);
        host.createI18nTests = function () {
            // No filesystem in the browser, so the source-scanning tests are
            // skipped there; the rest is the same suite.
            return factory(host.TrunfoI18n, host.TrunfoDeck, host.TrunfoDecks, null);
        };
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (I18n, Deck, Decks, sources) {
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

    /** Register a test; it may be synchronous or return a promise. */
    function test(name, fn) {
        queue.push({ name: name, fn: fn });
    }

    function log(line) {
        if (typeof console !== 'undefined' && console.log) console.log(line);
    }

    const PLURAL = /_(one|other)$/;

    /** Run `fn` with the locale set, then put it back. */
    function inLocale(tag, fn) {
        const previous = I18n.locale();
        I18n.setLocale(tag);
        try {
            return fn();
        } finally {
            I18n.setLocale(previous);
        }
    }

    function sourceText() {
        return sources
            .map(function (file) {
                return file.text;
            })
            .join('\n');
    }

    /* ------------------------------------------------------------- catalogs */

    function catalogs() {
        const catalogs_ = I18n.catalogs();

        test('every shipped locale has a catalog', function () {
            I18n.LOCALES.forEach(function (entry) {
                assert(catalogs_[entry.id], 'missing catalog for ' + entry.id);
            });
            equal(catalogs_.en ? Object.keys(catalogs_).length : 0, I18n.LOCALES.length, 'one per locale');
        });

        test('pt-BR is key-for-key identical to en', function () {
            const en = Object.keys(catalogs_.en).sort();
            const pt = Object.keys(catalogs_['pt-BR']).sort();
            const missing = en.filter(function (key) {
                return pt.indexOf(key) === -1;
            });
            const extra = pt.filter(function (key) {
                return en.indexOf(key) === -1;
            });
            equal(missing.length, 0, 'keys missing from pt-BR: ' + missing.join(', '));
            equal(extra.length, 0, 'keys only in pt-BR: ' + extra.join(', '));
        });

        test('no entry is empty and none repeats its key', function () {
            Object.keys(catalogs_).forEach(function (tag) {
                const catalog = catalogs_[tag];
                Object.keys(catalog).forEach(function (key) {
                    const value = catalog[key];
                    assert(typeof value === 'string' && value.length > 0, tag + ' ' + key + ' is empty');
                    assert(value !== key, tag + ' ' + key + ' still reads as its key');
                });
            });
        });

        test('every translated value differs from English where it should', function () {
            // A handful of entries are the same on purpose: brand and rule
            // names, bare symbols, proper nouns, and templates whose words come
            // from other keys. Anything else being identical means a
            // translation was forgotten.
            const allowed = [
                'game.result.trump',
                'game.attr.compare',
                'summary.none',
                'create.emptyCell',
                'create.tableSuperTrunfo',
                'create.storageIndexedDb'
            ];
            const shared = Object.keys(catalogs_.en).filter(function (key) {
                return catalogs_.en[key] === catalogs_['pt-BR'][key];
            });
            const forgot = shared.filter(function (key) {
                return allowed.indexOf(key) === -1;
            });
            equal(forgot.length, 0, 'untranslated in pt-BR: ' + forgot.join(', '));
            const stale = allowed.filter(function (key) {
                return shared.indexOf(key) === -1;
            });
            equal(stale.length, 0, 'listed as identical but is not: ' + stale.join(', '));
        });

        function pluralVariants(key) {
            return catalogs_.en[key + '_one'] !== undefined && catalogs_.en[key + '_other'] !== undefined;
        }

        test('every key used by the markup exists', function () {
            if (!sources) return;
            const used = [];
            sources.forEach(function (file) {
                if (!/\.html$/.test(file.path)) return;
                const pattern = /data-i18n(?:-[a-z-]+)?="([^"]+)"/g;
                let match = pattern.exec(file.text);
                while (match) {
                    used.push({ key: match[1], where: file.path });
                    match = pattern.exec(file.text);
                }
            });
            assert(used.length > 20, 'the markup scan found the marked-up strings');
            const missing = used.filter(function (entry) {
                return !catalogs_.en[entry.key] && !pluralVariants(entry.key);
            });
            equal(
                missing.length,
                0,
                'unknown keys in markup: ' +
                    missing
                        .map(function (entry) {
                            return entry.key + ' (' + entry.where + ')';
                        })
                        .join(', ')
            );
        });

        test('every key used by the controllers exists', function () {
            if (!sources) return;
            const used = [];
            sources.forEach(function (file) {
                if (!/\.js$/.test(file.path)) return;
                // t('key', …) and setStatus(node, 'key', …) are the two shapes.
                const patterns = [
                    /\bt\(\s*'([A-Za-z][\w.]*)'/g,
                    /setStatus\(\s*[^,]+,\s*'([A-Za-z][\w.]*)'/g
                ];
                patterns.forEach(function (pattern) {
                    let match = pattern.exec(file.text);
                    while (match) {
                        used.push({ key: match[1], where: file.path });
                        match = pattern.exec(file.text);
                    }
                });
            });
            assert(used.length > 80, 'the controller scan found the string lookups');
            const missing = used.filter(function (entry) {
                return !catalogs_.en[entry.key] && !pluralVariants(entry.key);
            });
            equal(
                missing.length,
                0,
                'unknown keys in controllers: ' +
                    missing
                        .map(function (entry) {
                            return entry.key + ' (' + entry.where + ')';
                        })
                        .join(', ')
            );
        });

        test('no catalog entry is dead weight', function () {
            if (!sources) return;
            const source = sourceText();
            const unused = Object.keys(catalogs_.en).filter(function (key) {
                const base = key.replace(PLURAL, '');
                return source.indexOf("'" + base + "'") === -1 && source.indexOf('"' + base + '"') === -1;
            });
            equal(unused.length, 0, 'never used: ' + unused.join(', '));
        });

        test('every page offers the language switch', function () {
            if (!sources) return;
            sources.forEach(function (file) {
                if (!/\.html$/.test(file.path)) return;
                assert(file.text.indexOf('data-locale-toggle') !== -1, file.path + ' has no language switch');
                assert(
                    /data-locale-toggle[\s\S]{0,200}<span class="flag"/.test(file.text),
                    file.path + ' has no flag inside its language switch'
                );
            });
        });

        test('plural entries come in pairs', function () {
            Object.keys(catalogs_.en).forEach(function (key) {
                if (!PLURAL.test(key)) return;
                const base = key.replace(PLURAL, '');
                assert(pluralVariants(base), key + ' has no _one/_other pair');
            });
        });
    }

    /* --------------------------------------------------------- translation */

    function translation() {
        test('a key resolves to the active language', function () {
            inLocale('en', function () {
                equal(I18n.t('game.start'), 'Start game');
            });
            inLocale('pt-BR', function () {
                equal(I18n.t('game.start'), 'Iniciar jogo');
            });
        });

        test('an unknown key is returned verbatim, not blank', function () {
            equal(I18n.t('nope.not.here'), 'nope.not.here');
        });

        test('an unknown key falls back to English rather than vanishing', function () {
            const en = I18n.catalogs().en;
            en['test.englishOnly'] = 'English only';
            try {
                inLocale('pt-BR', function () {
                    equal(I18n.t('test.englishOnly'), 'English only');
                });
            } finally {
                delete en['test.englishOnly'];
            }
        });

        test('placeholders are filled, and unknown ones are left alone', function () {
            equal(I18n.t('over.score', { player: 16, computer: 0 }), ' Final score — you 16, computer 0.');
            equal(
                I18n.t('game.attr.compare', {
                    stat: 'Size',
                    value: 250,
                    unit: ' cm',
                    rule: 'Highest value wins.'
                }),
                'Size 250 cm. Highest value wins. Compare Size.'
            );
            equal(I18n.t('create.statName', { n: 2 }), 'Name of stat 2');
            equal(I18n.t('create.statName'), 'Name of stat {n}', 'an unfilled placeholder stays readable');
        });

        test('a count picks the singular only at exactly one', function () {
            equal(I18n.t('game.cards', { count: 1 }), 'card');
            equal(I18n.t('game.cards', { count: 0 }), 'cards');
            equal(I18n.t('game.cards', { count: 3 }), 'cards');
            inLocale('pt-BR', function () {
                equal(I18n.t('game.cards', { count: 1 }), 'carta');
                equal(I18n.t('game.cards', { count: 0 }), 'cartas');
                equal(I18n.t('game.cards', { count: 4 }), 'cartas');
            });
        });

        test('numbers are written the way each locale writes them', function () {
            inLocale('en', function () {
                equal(I18n.number(1020), '1,020');
                equal(I18n.number(2.5), '2.5');
            });
            inLocale('pt-BR', function () {
                equal(I18n.number(1020), '1.020');
                equal(I18n.number(2.5), '2,5');
            });
        });

        test('interpolated numbers follow the locale too', function () {
            inLocale('pt-BR', function () {
                equal(I18n.t('create.statName', { n: 1020 }), 'Nome da estatística 1.020');
            });
        });
    }

    /* -------------------------------------------------------------- locales */

    function locales() {
        test('a regional tag picks the closest shipped language', function () {
            equal(I18n.supported('pt'), 'pt-BR', 'language only');
            equal(I18n.supported('pt-PT'), 'pt-BR', 'the other regional variant');
            equal(I18n.supported('PT_br'), 'pt-BR', 'case and separator');
            equal(I18n.supported('en-GB'), 'en', 'any English variant');
            equal(I18n.supported('fr'), null, 'an unshipped language');
            equal(I18n.supported(''), null, 'an empty tag');
            equal(I18n.supported(null), null, 'a missing tag');
        });

        test('the switch walks the shipped languages and wraps', function () {
            const order = I18n.LOCALES.map(function (entry) {
                return entry.id;
            });
            inLocale('en', function () {
                equal(I18n.nextLocale(), 'pt-BR', 'English offers Portuguese');
            });
            inLocale('pt-BR', function () {
                equal(I18n.nextLocale(), 'en', 'the last language wraps to the first');
            });
            // Whatever the current language, the next one is in the list.
            order.forEach(function (id) {
                inLocale(id, function () {
                    assert(order.indexOf(I18n.nextLocale()) !== -1, id + ' points at a shipped language');
                    assert(I18n.nextLocale() !== id, id + ' points somewhere else');
                });
            });
        });

        test('every shipped language has a flag for the switch button', function () {
            I18n.LOCALES.forEach(function (entry) {
                assert(/^\S+$/.test(entry.flag || ''), entry.id + ' has no flag');
            });
            const flags = I18n.LOCALES.map(function (entry) {
                return entry.flag;
            });
            equal(new Set(flags).size, flags.length, 'two languages share a flag');
        });

        test('an unknown tag is ignored instead of resetting the language', function () {
            const before = I18n.locale();
            equal(I18n.setLocale('klingon'), null, 'refused');
            equal(I18n.locale(), before, 'unchanged');
        });

        test('switching language survives a missing storage backend', function () {
            // Node has no localStorage; the switch must still take effect.
            equal(I18n.setLocale('pt-BR'), 'pt-BR');
            equal(I18n.locale(), 'pt-BR');
            I18n.setLocale('en');
        });
    }

    /* -------------------------------------------------------- deck content */

    function deckContent() {
        test('a built-in deck translates its theme, labels, units and card names', function () {
            const pt = Deck.translator('awesome-animals', 'pt-BR');
            assert(pt, 'no translator for pt-BR');
            equal(pt.theme, 'Animais Incríveis');
            equal(pt.labels.size, 'Tamanho');
            equal(pt.labels.lifespan, 'Tempo de vida');
            equal(pt.units.lifespan, 'anos');
            equal(pt.name('Lion'), 'Leão');
            equal(pt.name('Zebra'), 'Zebra', 'a name that needs no translation is kept');
        });

        test('English and custom decks get no translator', function () {
            equal(Deck.translator('awesome-animals', 'en'), null);
            equal(Deck.translator('custom-abc', 'pt-BR'), null);
            equal(Deck.translator('nope', 'pt-BR'), null);
        });

        test('the car deck translates its stats and keeps model names', function () {
            const pt = Deck.translator('electric-cars-2026', 'pt-BR');
            equal(pt.theme, 'Carros Elétricos 2026');
            equal(pt.labels.acceleration, '0–100 km/h');
            equal(pt.units.power, 'cv');
            equal(pt.name('Tesla Model S Plaid'), 'Tesla Model S Plaid');
        });

        test('baking a language in leaves the shipped deck untouched', function () {
            const theme = Deck.getTheme('awesome-animals');
            const before = JSON.stringify(theme);
            const pt = Deck.localizeTheme(theme, 'pt-BR');
            equal(pt.theme, 'Animais Incríveis');
            equal(pt.labels.size, 'Tamanho');
            equal(pt.cards[0].name, 'Leão', 'the first card was translated');
            equal(pt.cards.length, theme.cards.length);
            equal(JSON.stringify(theme), before, 'the canonical theme did not move');
            equal(Deck.localizeTheme(theme, 'en'), theme, 'English is the canonical form');
        });

        test('every translated card name belongs to a real card', function () {
            Deck.THEMES.forEach(function (theme) {
                Object.keys(theme.i18n || {}).forEach(function (tag) {
                    const names = theme.i18n[tag].cardNames || {};
                    const canonical = theme.cards.map(function (card) {
                        return card.name;
                    });
                    const unknown = Object.keys(names).filter(function (name) {
                        return canonical.indexOf(name) === -1;
                    });
                    equal(
                        unknown.length,
                        0,
                        theme.id + '/' + tag + ' names cards that do not exist: ' + unknown.join(', ')
                    );
                });
            });
        });

        test('every stat a translation names exists on the deck', function () {
            Deck.THEMES.forEach(function (theme) {
                Object.keys(theme.i18n || {}).forEach(function (tag) {
                    const overlay = theme.i18n[tag];
                    ['labels', 'units'].forEach(function (field) {
                        const unknown = Object.keys(overlay[field] || {}).filter(function (key) {
                            return theme.attributes.indexOf(key) === -1;
                        });
                        equal(
                            unknown.length,
                            0,
                            theme.id + '/' + tag + '/' + field + ': ' + unknown.join(', ')
                        );
                    });
                });
            });
        });

        test('a localized deck still passes the engine it feeds', function () {
            if (typeof require !== 'function') return;
            const Engine = require('../src/js/engine.js');
            const theme = Deck.localizeTheme(Deck.getTheme('awesome-animals'), 'pt-BR');
            const state = Engine.createGame(theme, { roundLimit: 0 });
            equal(state.attributeKeys.length, 3, 'the three stats survived');
            equal(state.playerHand.length + state.computerHand.length, 32, 'all 32 cards dealt');
            assert(state.playerHand[0].name, 'cards keep a name');
        });
    }

    /* --------------------------------------------------------- store errors */

    function storeErrors() {
        test('store validation messages follow the language', function () {
            inLocale('en', function () {
                assert(
                    Decks.validate({ theme: '', attributes: [], cards: [] })[0].indexOf('name') !== -1,
                    'English message'
                );
            });
            inLocale('pt-BR', function () {
                const errors = Decks.validate({ theme: '', attributes: [], cards: [] });
                assert(errors[0].indexOf('nome') !== -1, 'Portuguese message: ' + errors[0]);
                const tooMany = Decks.validate({
                    theme: 'T',
                    attributes: ['a', 'b', 'c', 'd', 'e', 'f'],
                    cards: []
                });
                assert(
                    tooMany.some(function (error) {
                        return /no máximo 5/.test(error);
                    }),
                    'the five-stat limit is translated: ' + tooMany.join(' | ')
                );

                const partial = Decks.validate({
                    theme: 'T',
                    attributes: ['a'],
                    cards: [{ name: 'Um', attributes: { a: 1 } }]
                });
                assert(
                    partial.some(function (error) {
                        return /grupos de quatro/.test(error);
                    }),
                    'the group rule is translated: ' + partial.join(' | ')
                );
            });
        });

        test('a card error names the card in the active language', function () {
            inLocale('pt-BR', function () {
                const errors = Decks.validate({
                    theme: 'Carros',
                    attributes: ['velocidade'],
                    cards: [
                        { name: '', attributes: { velocidade: 1 } },
                        { name: 'Dois', attributes: { velocidade: 2 } }
                    ]
                });
                assert(errors[0].indexOf('Carta 1') === 0, 'Portuguese prefix: ' + errors[0]);
            });
        });
    }

    function run() {
        catalogs();
        translation();
        locales();
        deckContent();
        storeErrors();

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

/* Direct Node execution: `node tests/i18n.test.js` */
if (typeof require === 'function' && typeof module === 'object' && require.main === module) {
    const fs = require('fs');
    const path = require('path');
    const root = path.join(__dirname, '..');
    const sources = [
        'src/index.html',
        'src/create.html',
        'src/js/deck.js',
        'src/js/decks.js',
        'src/js/i18n.js',
        'src/js/images.js',
        'src/js/ui.js',
        'src/js/create.js'
    ].map(function (relative) {
        return { path: relative, text: fs.readFileSync(path.join(root, relative), 'utf8') };
    });

    const suite = module.exports(
        require('../src/js/i18n.js'),
        require('../src/js/deck.js'),
        require('../src/js/decks.js'),
        sources
    );
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
