#!/usr/bin/env python3
"""
Generate tests/builder.html from src/create.html.

The browser harness needs the real markup (ids, classes and script order) but
the asset paths must point at ../src/ and it needs a results sink for
--dump-dom. Generating it keeps the two from drifting apart.

Run from the repository root:

    python3 tools/make-builder-harness.py
"""

import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SOURCE = ROOT / "src" / "create.html"
TARGET = ROOT / "tests" / "builder.html"

HARNESS = r"""
        <!-- Results sink: out of flow and invisible so it never affects layout,
             but its text stays in the DOM for --dump-dom. -->
        <pre id="out" style="position: fixed; top: 0; left: 0; width: 1px; height: 1px; overflow: hidden; opacity: 0; pointer-events: none;">running</pre>

        <script>
            (function () {
                'use strict';

                var Decks = window.TrunfoDecks;
                var PNG =
                    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
                var errors = [];
                var CHECKS = [];

                window.addEventListener('error', function (e) {
                    errors.push(String(e.message));
                    // Report straight away: a thrown callback would otherwise
                    // leave the harness silent and look like a timeout.
                    report();
                });

                function byId(id) {
                    return document.getElementById(id);
                }

                function check(name, condition, extra) {
                    CHECKS.push(
                        (condition ? 'PASS' : 'FAIL') + ' ' + name +
                            (extra !== undefined ? ' :: ' + extra : '')
                    );
                }

                function fire(node) {
                    node.dispatchEvent(new Event('input', { bubbles: true }));
                }

                function all(selector, root) {
                    return Array.prototype.slice.call((root || document).querySelectorAll(selector));
                }

                function statRows() {
                    return all('#stats .stat-row').length;
                }

                function cardRows() {
                    return all('#cards tbody tr');
                }

                function numberInputs(rowIndex) {
                    return all('input[type="number"]', cardRows()[rowIndex]).length;
                }

                function statLabels() {
                    return all('#stats [data-field="label"]');
                }

                function statUnits() {
                    return all('#stats [data-field="unit"]');
                }

                function customDecks(store) {
                    return store.list().filter(function (entry) {
                        return !entry.builtIn;
                    });
                }

                /** Poll until a condition holds; the store and image code are async. */
                function waitFor(predicate, label) {
                    return new Promise(function (resolve, reject) {
                        var tries = 0;
                        (function poll() {
                            var ok = false;
                            try {
                                ok = predicate();
                            } catch (e) {
                                ok = false;
                            }
                            if (ok) {
                                resolve(ok);
                                return;
                            }
                            if (++tries > 600) {
                                reject(new Error('timed out waiting for ' + label));
                                return;
                            }
                            window.setTimeout(poll, 20);
                        })();
                    });
                }

                /** A real one-pixel PNG packaged as a File, as a file picker would give. */
                function pngFile() {
                    var binary = window.atob(PNG.split(',')[1]);
                    var bytes = new Uint8Array(binary.length);
                    for (var i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
                    return new File([bytes], 'pixel.png', { type: 'image/png' });
                }

                function fillDeck(names, values, theme) {
                    var name = byId('deck-name');
                    name.value = theme;
                    fire(name);

                    var L = ['Length', 'Weight', 'Speed', 'Bite Force', 'Age'];
                    var U = ['m', 't', 'km/h', 'kN', 'years'];
                    statLabels().forEach(function (input, i) {
                        input.value = L[i];
                        fire(input);
                    });
                    statUnits().forEach(function (input, i) {
                        input.value = U[i];
                        fire(input);
                    });

                    cardRows().forEach(function (row, i) {
                        var nameInput = row.querySelector('[data-field="name"]');
                        nameInput.value = names[i];
                        fire(nameInput);
                        all('input[type="number"]', row).forEach(function (input, j) {
                            input.value = values[i][j];
                            fire(input);
                        });
                    });
                }

                function report() {
                    check('no uncaught page errors', errors.length === 0, errors.join(' | '));
                    var failed = CHECKS.filter(function (c) {
                        return c.indexOf('FAIL') === 0;
                    }).length;
                    byId('out').textContent =
                        CHECKS.join('\n') + '\n---\nTOTAL=' + CHECKS.length + ' FAILED=' + failed;
                    document.title = failed ? 'BROWSER-TESTS-FAILED' : 'BROWSER-TESTS-PASSED';
                }

                /*
                 * The page ships in English and Brazilian Portuguese. With
                 * `?lang=pt-BR` the same markup and the same controller must
                 * come up in Portuguese, including the content of a deck copied
                 * from the built-in one and the validation messages.
                 */
                function localeRun() {
                    var I18n = window.TrunfoI18n;
                    var store = Decks.store();

                    return store.ready().then(function () {
                        check('the creator is in Portuguese', /Criador de baralhos/.test(
                            document.querySelector('.brand__tag').textContent),
                            document.querySelector('.brand__tag').textContent);
                        check('the language button shows the active flag',
                            byId('locale').textContent.trim() === '\u{1F1E7}\u{1F1F7}',
                            byId('locale').textContent.trim());
                        check('the language button names the switch it performs',
                            byId('locale').getAttribute('aria-label') === 'Mudar o idioma para English',
                            byId('locale').getAttribute('aria-label'));
                        check('the step headings are translated',
                            /Nomeie o baralho/.test(document.querySelector('[data-i18n="create.step1"]').textContent) &&
                            /Estatísticas/.test(document.querySelector('[data-i18n="create.step2"]').textContent),
                            document.querySelector('[data-i18n="create.step2"]').textContent);
                        check('the deck-name placeholder is translated',
                            byId('deck-name').placeholder === 'ex.: Dinossauros', byId('deck-name').placeholder);
                        check('the stat placeholders are translated',
                            statLabels()[0].placeholder === 'Nome da estatística',
                            statLabels()[0].placeholder);
                        check('the comparison rules are translated',
                            all('#stats [data-field="direction"]')[0].options[1].textContent === 'Menor vence',
                            all('#stats [data-field="direction"]')[0].options[1].textContent);
                        check('the accessible name of a stat is translated',
                            statLabels()[0].getAttribute('aria-label') === 'Nome da estatística 1',
                            statLabels()[0].getAttribute('aria-label'));
                        check('the table corners are translated',
                            /Carta/.test(all('.cards-table__corner')[0].textContent) &&
                            /Arte/.test(all('.cards-table__corner')[1].textContent),
                            all('.cards-table__corner')[0].textContent + ' ' + all('.cards-table__corner')[1].textContent);
                        check('the save button is translated',
                            byId('save').textContent.trim() === 'Salvar baralho',
                            byId('save').textContent);
                        // The list is filled once the database has answered.
                        return waitFor(function () {
                            return byId('deck-list').options.length > 0;
                        }, 'the saved-deck list').then(function () {
                            check('the built-in decks are named in Portuguese',
                                /Animais Incríveis \(embutido\)/.test(byId('deck-list').textContent),
                                byId('deck-list').textContent);
                        });
                    }).then(function () {
                        // A deck copied from the built-in one arrives translated.
                        byId('template').click();
                        check('the copied deck is named in Portuguese',
                            /\(cópia\)$/.test(byId('deck-name').value), byId('deck-name').value);
                        check('the copied stats are translated',
                            statLabels()[0].value === 'Tamanho' && statUnits()[2].value === 'anos',
                            statLabels()[0].value + ' / ' + statUnits()[2].value);
                        check('the copied table header mirrors it',
                            all('.cards-table__stat')[0].textContent === 'Tamanho',
                            all('.cards-table__stat')[0].textContent);
                    }).then(function () {
                        // And a refused save reports itself in Portuguese.
                        byId('clear').click();
                        byId('save').click();
                        return waitFor(function () {
                            return byId('errors').hidden === false;
                        }, 'the validation errors').then(function () {
                            check('validation errors arrive in Portuguese',
                                /Dê um nome ao baralho/.test(byId('errors').textContent) &&
                                /Carta 1/.test(byId('errors').textContent),
                                byId('errors').textContent.slice(0, 80));
                        });
                    }).then(function () {
                        byId('clear').click();
                        check('clearing still works in Portuguese',
                            byId('deck-name').value === '' && statRows() === 3,
                            byId('deck-name').value + ' / ' + statRows());
                        check('the form status is translated', /Formulário limpo/.test(byId('status').textContent),
                            byId('status').textContent);
                    });
                }

                function run() {
                    var store = Decks.store();

                    return store.ready().then(function () {
                        check('the builder loaded', typeof window.TrunfoBuilder === 'object');
                        check('decks are held in the local database',
                            store.describe().backend === 'indexeddb', store.describe().backend);
                        check('it starts with three stat rows', statRows() === 3, String(statRows()));
                        check('it starts with two card rows', cardRows().length === 2,
                            String(cardRows().length));
                        check('the card counter counts the cards, not just the noun',
                            byId('card-count').textContent === '2 cards',
                            byId('card-count').textContent);
                        check('add-stat is enabled below the limit', byId('add-stat').disabled === false);
                        check('the limit is advertised', /\/ 5$/.test(byId('stat-count').textContent),
                            byId('stat-count').textContent);

                        byId('add-stat').click();
                        byId('add-stat').click();
                        check('it grows to five stat rows', statRows() === 5, String(statRows()));
                        check('add-stat disables at the limit', byId('add-stat').disabled === true);
                        check('the counter reads 5 / 5', byId('stat-count').textContent === '5 / 5',
                            byId('stat-count').textContent);
                        check('every card row gains a value column',
                            numberInputs(0) === 5 && numberInputs(1) === 5,
                            numberInputs(0) + '/' + numberInputs(1));

                        var labelInput = statLabels()[0];
                        labelInput.value = 'Length';
                        fire(labelInput);
                        check('the table header mirrors the stat name',
                            all('.cards-table__stat')[0].textContent === 'Length',
                            all('.cards-table__stat')[0].textContent);

                        var unitInput = statUnits()[0];
                        unitInput.value = 'm';
                        fire(unitInput);
                        check('the table header mirrors the unit',
                            all('.cards-table__unit')[0].textContent === 'm',
                            all('.cards-table__unit')[0].textContent);

                        all('#stats [data-remove-stat]')[0].click();
                        check('a stat can be removed', statRows() === 4, String(statRows()));
                        byId('add-stat').click();
                        check('a stat can be added back', statRows() === 5, String(statRows()));

                        var ruleSelect = all('#stats [data-field="direction"]')[0];
                        check('every stat offers a comparison rule',
                            all('#stats [data-field="direction"]').length === statRows(),
                            String(all('#stats [data-field="direction"]').length));
                        check('the rule defaults to highest-wins',
                            ruleSelect.value === 'higher', ruleSelect.value);
                        ruleSelect.value = 'lower';
                        fire(ruleSelect);
                        check('choosing lowest-wins mirrors in the table header',
                            /lowest wins/i.test(all('.cards-table__rule')[0].textContent),
                            all('.cards-table__rule')[0].textContent);

                        fillDeck(['T-Rex', 'Triceratops'],
                            [[12, 8, 27, 35, 28], [9, 6, 24, 12, 30]], 'Harness Deck');
                    }).then(function () {
                        // Attach artwork the same way a file picker does.
                        var cardId = window.TrunfoBuilder.getDraft().cards[0].id;
                        var before = store.imageStats().count;
                        window.TrunfoBuilder.attachImage(cardId, pngFile());
                        return waitFor(function () {
                            return document.querySelector('[data-thumb="' + cardId + '"] img') !== null;
                        }, 'the thumbnail').then(function () {
                            check('a picked image becomes a thumbnail', true);
                            check('the image is written to the database',
                                store.imageStats().count === before + 1, String(store.imageStats().count));
                            check('the draft card references the image',
                                !!window.TrunfoBuilder.getDraft().cards[0].imageId);
                            check('the clear button is offered once an image exists',
                                document.querySelector('[data-clear-image]').disabled === false);
                        });
                    }).then(function () {
                        byId('save').click();
                        return waitFor(function () {
                            return /Saved/.test(byId('status').textContent);
                        }, 'the deck to save');
                    }).then(function () {
                        var entry = customDecks(store)[0];
                        check('the deck saves', true, byId('status').textContent);
                        check('no validation errors are shown', byId('errors').hidden === true);
                        check('it is stored in the database', !!entry && entry.theme === 'Harness Deck',
                            entry ? entry.theme : 'nothing stored');
                        check('it stores five stats', entry && entry.stats === 5,
                            entry ? String(entry.stats) : '-');
                        check('it stores two cards', entry && entry.cards === 2);
                        check('the artwork is recorded on the deck', entry && entry.images === 1,
                            entry ? String(entry.images) : '-');
                        var stored = store.get(entry.id);
                        check('the comparison rule is saved with the deck',
                            !!stored.directions && stored.directions['length'] === 'lower',
                            JSON.stringify(stored.directions));
                        check('the saved-deck list shows it', /Harness Deck/.test(byId('deck-list').textContent),
                            byId('deck-list').textContent);
                        check('deleting is offered for a custom deck', byId('delete').disabled === false);

                        byId('export-deck').click();
                        check('export fills the JSON box', /"theme": "Harness Deck"/.test(byId('json').value),
                            byId('json').value.slice(0, 60));
                        check('export inlines the artwork',
                            byId('json').value.indexOf('data:image/') !== -1);
                        check('export includes the comparison rules',
                            /"directions"/.test(byId('json').value));

                        // Loading a saved deck back must restore its rule.
                        byId('load').click();
                        check('loading a deck restores its comparison rule',
                            all('#stats [data-field="direction"]')[0].value === 'lower',
                            all('#stats [data-field="direction"]')[0].value);
                    }).then(function () {
                        // An invalid deck must be refused.
                        var firstName = cardRows()[0].querySelector('[data-field="name"]');
                        firstName.value = '';
                        fire(firstName);
                        byId('save').click();
                        return waitFor(function () {
                            return byId('errors').hidden === false;
                        }, 'the validation error').then(function () {
                            check('an invalid deck is refused', true);
                            check('the error names the offending card',
                                /Card 1/.test(byId('errors').textContent),
                                byId('errors').textContent.slice(0, 70));
                            firstName.value = 'T-Rex';
                            fire(firstName);
                        });
                    }).then(function () {
                        // Import a deck that carries its own artwork.
                        byId('json').value = JSON.stringify({
                            theme: 'Imported',
                            attributes: ['a', 'b', 'c', 'd', 'e'],
                            labels: {},
                            units: {},
                            cards: [
                                { name: 'One', image: PNG, attributes: { a: 1, b: 2, c: 3, d: 4, e: 5 } },
                                { name: 'Two', attributes: { a: 5, b: 4, c: 3, d: 2, e: 1 } }
                            ]
                        });
                        byId('import-text').click();
                        return waitFor(function () {
                            return /imported/.test(byId('json-status').textContent);
                        }, 'the import').then(function () {
                            check('importing adds a deck', /Imported/.test(byId('deck-list').textContent),
                                byId('deck-list').textContent);
                            check('the imported artwork is stored too',
                                store.imageStats().count === 2, String(store.imageStats().count));
                        });
                    }).then(function () {
                        byId('json').value = '{oops';
                        byId('import-text').click();
                        return waitFor(function () {
                            return /not valid JSON/.test(byId('json-status').textContent);
                        }, 'the broken import').then(function () {
                            check('a broken import is reported', true, byId('json-status').textContent);
                        });
                    }).then(function () {
                        byId('clear').click();
                        check('clearing empties the form', byId('deck-name').value === '');
                        check('clearing restores three stats', statRows() === 3, String(statRows()));
                    });
                }

                window.addEventListener('load', function () {
                    var portuguese = location.search.indexOf('lang=pt-BR') !== -1;
                    (portuguese ? localeRun() : run())
                        .then(report, function (error) {
                            check('the harness ran to completion', false, error.message);
                            report();
                        });
                });
            })();
        </script>
"""

BANNER = """<!--
  Browser harness for the deck creator. GENERATED FILE - do not edit by hand.

  The markup mirrors src/create.html; only the asset paths and the results sink
  differ. Regenerate with:

      python3 tools/make-builder-harness.py
-->
"""


def main() -> int:
    if not SOURCE.exists():
        print(f"missing {SOURCE}", file=sys.stderr)
        return 1

    html = SOURCE.read_text(encoding="utf-8")

    # Point the assets at the source tree, since this file lives in tests/.
    html = html.replace('href="css/styles.css"', 'href="../src/css/styles.css"')
    for name in ("i18n.js", "deck.js", "engine.js", "decks.js", "images.js", "create.js"):
        html = html.replace(f'src="js/{name}"', f'src="../src/js/{name}"')

    # Anchor on the tag itself; indentation is whatever Prettier produced.
    marker = '<script src="../src/js/create.js"></script>'
    if marker not in html:
        print("could not find the create.js script tag to anchor the harness", file=sys.stderr)
        return 1

    html = BANNER + html.replace(marker, marker + "\n" + HARNESS)
    TARGET.write_text(html, encoding="utf-8")
    print(f"wrote {TARGET.relative_to(ROOT)} ({len(html)} bytes)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
