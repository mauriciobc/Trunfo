/**
 * Deck creator page controller.
 *
 * Builds a deck definition in the browser, validates it through the deck store
 * and saves it to the local database so it becomes selectable on the game page.
 * Cards can carry artwork, which is downscaled and written to the image store.
 * Also handles JSON export/import.
 *
 * Loaded as a classic script after deck.js, engine.js, decks.js and images.js.
 */
(function (global) {
    'use strict';

    const Decks = global.TrunfoDecks;
    const Images = global.TrunfoImages;
    const Deck = global.TrunfoDeck;
    const I18n = global.TrunfoI18n;

    if (!Decks || !Deck || !I18n) {
        throw new Error('The deck creator needs i18n.js, deck.js, engine.js and decks.js first.');
    }

    const t = I18n.t;
    const MAX_STATS = Decks.MAX_STATS;
    const els = {};
    let draft = null;
    let statSeq = 0;
    let cardSeq = 0;
    /** Cards-table header nodes, keyed by stat, so they can mirror the panel. */
    let headerCells = {};
    /** The last validation messages, so a language switch can re-render them. */
    let lastErrors = [];

    /* ---------------------------------------------------------------- utils */

    function byId(id) {
        return document.getElementById(id);
    }

    function el(tag, className, text) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined && text !== null) node.textContent = String(text);
        return node;
    }

    function newStat(label, unit, direction) {
        statSeq += 1;
        return {
            key: 's' + statSeq,
            label: label || '',
            unit: unit || '',
            direction: direction === 'lower' ? 'lower' : 'higher'
        };
    }

    function newCard(values) {
        cardSeq += 1;
        return { id: 'c' + cardSeq, name: '', icon: '', imageId: null, values: values || {} };
    }

    function blankDraft() {
        return {
            id: null,
            theme: '',
            stats: [newStat(), newStat(), newStat()],
            cards: [newCard(), newCard()]
        };
    }

    function findStat(key) {
        return (
            draft.stats.filter(function (stat) {
                return stat.key === key;
            })[0] || null
        );
    }

    function findCard(id) {
        return (
            draft.cards.filter(function (card) {
                return card.id === id;
            })[0] || null
        );
    }

    /** A stat's 1-based position, for its accessible names. */
    function statNumber(key) {
        const index = draft.stats.findIndex(function (stat) {
            return stat.key === key;
        });
        return index < 0 ? 1 : index + 1;
    }

    /**
     * Status lines are kept as producers, keyed by their node, so switching
     * language repaints them rather than leaving the previous language behind.
     */
    const statusLines = new Map();

    function paintStatus(node) {
        const spec = statusLines.get(node);
        if (!spec) return;
        node.textContent = spec.producer();
        node.className =
            spec.tone === 'error' ? 'hint hint--error' : spec.tone === 'ok' ? 'hint hint--ok' : 'hint';
    }

    /** A status line the locale can repaint: it stores the key, not the text. */
    function setStatus(node, key, params, tone) {
        statusLines.set(node, {
            producer: function () {
                return t(key, params);
            },
            tone: tone
        });
        paintStatus(node);
    }

    /** A status line whose text came from elsewhere (already translated). */
    function setStatusText(node, text, tone) {
        statusLines.set(node, {
            producer: function () {
                return text;
            },
            tone: tone
        });
        paintStatus(node);
    }

    function repaintStatuses() {
        statusLines.forEach(function (_spec, node) {
            paintStatus(node);
        });
    }

    function showErrors(messages) {
        const list = messages || [];
        lastErrors = list;
        els.errors.innerHTML = '';
        els.errors.hidden = list.length === 0;
        if (!list.length) return;
        const ul = el('ul');
        list.forEach(function (message) {
            ul.appendChild(el('li', null, message));
        });
        els.errors.appendChild(el('p', 'errors__title', t('create.errorsTitle')));
        els.errors.appendChild(ul);
    }

    function formatBytes(bytes) {
        if (!bytes) return '0 KB';
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

    /** A short label for the card's artwork, used in the thumbnail cell. */
    function artFor(card) {
        const dataUrl = Decks.store().image(card.imageId);
        if (dataUrl) {
            const image = el('img', 'art-cell__img');
            image.src = dataUrl;
            image.alt = '';
            return image;
        }
        return el('span', 'art-cell__emoji', card.icon || '\u2014');
    }

    function renderArt(card) {
        const cell = document.querySelector('[data-thumb="' + card.id + '"]');
        if (!cell) return;
        cell.innerHTML = '';
        cell.appendChild(artFor(card));
    }

    /* --------------------------------------------------------------- render */

    function statInput(stat, field, options) {
        const opts = options || {};
        const input = el('input', opts.className || 'input');
        input.type = 'text';
        input.value = field === 'unit' ? stat.unit : stat.label;
        input.placeholder =
            opts.placeholder ||
            (field === 'unit' ? t('create.unitPlaceholder') : t('create.statPlaceholder'));
        input.maxLength = field === 'unit' ? 10 : 24;
        input.setAttribute('data-stat', stat.key);
        input.setAttribute('data-field', field);
        if (opts.label) input.setAttribute('aria-label', opts.label);
        return input;
    }

    /**
     * Which value wins the round for a stat: the highest (the classic Top Trumps
     * rule) or the lowest (for a time, a price, a weight).
     */
    function directionSelect(stat, index) {
        const select = el('select', 'select select--rule');
        select.setAttribute('data-stat', stat.key);
        select.setAttribute('data-field', 'direction');
        select.setAttribute('aria-label', t('create.statRule', { n: index + 1 }));
        [
            ['higher', t('create.ruleHigh')],
            ['lower', t('create.ruleLow')]
        ].forEach(function (pair) {
            const option = el('option', null, pair[1]);
            option.value = pair[0];
            select.appendChild(option);
        });
        select.value = stat.direction === 'lower' ? 'lower' : 'higher';
        return select;
    }

    function renderStats() {
        els.stats.innerHTML = '';

        draft.stats.forEach(function (stat, index) {
            const row = el('div', 'stat-row');
            row.appendChild(el('span', 'stat-row__index', String(index + 1)));

            const name = el('label', 'field');
            name.appendChild(el('span', 'visually-hidden', t('create.statName', { n: index + 1 })));
            name.appendChild(statInput(stat, 'label', { label: t('create.statName', { n: index + 1 }) }));
            row.appendChild(name);

            const unit = el('label', 'field field--narrow');
            unit.appendChild(el('span', 'visually-hidden', t('create.statUnit', { n: index + 1 })));
            unit.appendChild(
                statInput(stat, 'unit', {
                    className: 'input input--small',
                    label: t('create.statUnit', { n: index + 1 })
                })
            );
            row.appendChild(unit);

            const rule = el('label', 'field field--rule');
            rule.appendChild(el('span', 'visually-hidden', t('create.statRule', { n: index + 1 })));
            rule.appendChild(directionSelect(stat, index));
            row.appendChild(rule);

            const remove = el('button', 'btn btn--ghost btn--tiny', t('create.remove'));
            remove.type = 'button';
            remove.setAttribute('data-remove-stat', stat.key);
            remove.disabled = draft.stats.length <= Decks.MIN_STATS;
            remove.setAttribute('aria-label', t('create.removeStat', { n: index + 1 }));
            row.appendChild(remove);

            els.stats.appendChild(row);
        });

        els.statCount.textContent = I18n.number(draft.stats.length) + ' / ' + I18n.number(MAX_STATS);
        els.addStat.disabled = draft.stats.length >= MAX_STATS;
    }

    function cardArtCell(card, index) {
        const cell = el('td', 'cards-table__art');

        const thumb = el('span', 'art-cell__thumb');
        thumb.setAttribute('data-thumb', card.id);
        thumb.appendChild(artFor(card));
        cell.appendChild(thumb);

        const tools = el('div', 'art-cell__tools');

        const icon = el('input', 'input input--icon');
        icon.type = 'text';
        icon.value = card.icon;
        icon.placeholder = '🦖';
        icon.setAttribute('data-card', card.id);
        icon.setAttribute('data-field', 'icon');
        icon.setAttribute('aria-label', t('create.emojiForCard', { n: index + 1 }));
        tools.appendChild(icon);

        const picker = el('label', 'btn btn--ghost btn--tiny file-btn', t('create.image'));
        picker.title = t('create.imageTitle');
        const file = el('input');
        file.type = 'file';
        file.accept = 'image/*';
        file.hidden = true;
        file.setAttribute('data-image', card.id);
        file.setAttribute('aria-label', t('create.imageForCard', { n: index + 1 }));
        picker.appendChild(file);
        tools.appendChild(picker);

        const clear = el('button', 'btn btn--ghost btn--tiny', '✕');
        clear.type = 'button';
        clear.setAttribute('data-clear-image', card.id);
        clear.disabled = !card.imageId;
        clear.setAttribute('aria-label', t('create.removeImage', { n: index + 1 }));
        tools.appendChild(clear);

        cell.appendChild(tools);
        return cell;
    }

    function renderCards() {
        const table = els.cards;
        table.innerHTML = '';

        const head = el('thead');
        const names = el('tr');
        const units = el('tr', 'cards-table__units');

        names.appendChild(el('th', 'cards-table__corner', t('create.tableCard')));
        units.appendChild(el('th', 'cards-table__corner', t('create.tableUnit')));

        // The Stats panel owns the names, units and comparison rule; these
        // headers only mirror them, so there is a single place to edit.
        headerCells = {};
        draft.stats.forEach(function (stat, index) {
            const lower = stat.direction === 'lower';

            const nameCell = el('th');
            const nameText = el(
                'span',
                'cards-table__stat',
                stat.label || t('create.statFallback', { n: index + 1 })
            );
            nameCell.appendChild(nameText);
            const ruleText = el('span', 'cards-table__rule', lower ? t('create.ruleShort') : '');
            ruleText.hidden = !lower;
            nameCell.appendChild(ruleText);
            names.appendChild(nameCell);

            const unitCell = el('th');
            const unitText = el('span', 'cards-table__unit', stat.unit || t('create.emptyCell'));
            unitCell.appendChild(unitText);
            units.appendChild(unitCell);

            headerCells[stat.key] = { name: nameText, unit: unitText, rule: ruleText };
        });

        names.appendChild(el('th', 'cards-table__corner', t('create.tableArtwork')));
        names.appendChild(el('th', 'cards-table__corner', ''));
        units.appendChild(el('th'));
        units.appendChild(el('th'));

        head.appendChild(names);
        head.appendChild(units);
        table.appendChild(head);

        const body = el('tbody');
        draft.cards.forEach(function (card, index) {
            const row = el('tr');

            const nameCell = el('td');
            const nameInput = el('input', 'input');
            nameInput.type = 'text';
            nameInput.value = card.name;
            nameInput.placeholder = t('create.cardFallback', { n: index + 1 });
            nameInput.maxLength = 30;
            nameInput.setAttribute('data-card', card.id);
            nameInput.setAttribute('data-field', 'name');
            nameInput.setAttribute('aria-label', t('create.cardName', { n: index + 1 }));
            nameCell.appendChild(nameInput);
            row.appendChild(nameCell);

            draft.stats.forEach(function (stat) {
                const cell = el('td');
                const input = el('input', 'input input--number');
                input.type = 'number';
                input.step = 'any';
                input.value = card.values[stat.key] === undefined ? '' : card.values[stat.key];
                input.setAttribute('data-card', card.id);
                input.setAttribute('data-stat', stat.key);
                input.setAttribute(
                    'aria-label',
                    t('create.statForCard', {
                        stat: stat.label || t('create.statPlaceholder'),
                        n: index + 1
                    })
                );
                cell.appendChild(input);
                row.appendChild(cell);
            });

            row.appendChild(cardArtCell(card, index));

            const removeCell = el('td');
            const remove = el('button', 'btn btn--ghost btn--tiny', '✕');
            remove.type = 'button';
            remove.setAttribute('data-remove-card', card.id);
            remove.disabled = draft.cards.length <= Decks.MIN_CARDS;
            remove.setAttribute('aria-label', t('create.removeCard', { n: index + 1 }));
            removeCell.appendChild(remove);
            row.appendChild(removeCell);

            body.appendChild(row);
        });
        table.appendChild(body);

        els.cardCount.textContent = t('count.cards', { count: draft.cards.length });
    }

    function renderAll() {
        els.deckName.value = draft.theme;
        renderStats();
        renderCards();
    }

    /* ------------------------------------------------------------ form glue */

    function onInput(event) {
        const target = event.target;
        const statKey = target.getAttribute('data-stat');
        const cardId = target.getAttribute('data-card');
        const field = target.getAttribute('data-field');

        if (cardId) {
            const card = findCard(cardId);
            if (!card) return;
            if (field === 'name') card.name = target.value;
            else if (field === 'icon') {
                card.icon = target.value;
                renderArt(card);
            } else if (statKey) card.values[statKey] = target.value;
            return;
        }

        if (statKey) {
            const stat = findStat(statKey);
            if (!stat) return;
            if (field === 'label') {
                stat.label = target.value;
                if (headerCells[statKey]) {
                    headerCells[statKey].name.textContent =
                        stat.label || t('create.statFallback', { n: statNumber(statKey) });
                }
            } else if (field === 'unit') {
                stat.unit = target.value;
                if (headerCells[statKey]) {
                    headerCells[statKey].unit.textContent = stat.unit || t('create.emptyCell');
                }
            } else if (field === 'direction') {
                const lower = target.value === 'lower';
                stat.direction = lower ? 'lower' : 'higher';
                if (headerCells[statKey]) {
                    headerCells[statKey].rule.textContent = lower ? t('create.ruleShort') : '';
                    headerCells[statKey].rule.hidden = !lower;
                }
            }
        }
    }

    /** Downscale a picked file, store it, and attach it to the card. */
    function attachImage(cardId, file) {
        const card = findCard(cardId);
        if (!card) return;
        if (!Images) {
            setStatus(els.status, 'create.imageUnavailable', null, 'error');
            return;
        }

        setStatus(els.status, 'create.prepareImage', { name: file.name });
        Images.prepare(file)
            .then(function (prepared) {
                return Decks.store().putImage(prepared.dataUrl, prepared);
            })
            .then(function (stored) {
                if (!stored.ok) {
                    setStatusText(els.status, stored.errors.join(' '), 'error');
                    return;
                }
                card.imageId = stored.image.id;
                renderArt(card);
                const clear = document.querySelector('[data-clear-image="' + card.id + '"]');
                if (clear) clear.disabled = false;
                setStatus(
                    els.status,
                    'create.imageAdded',
                    {
                        width: I18n.number(stored.image.width),
                        height: I18n.number(stored.image.height),
                        size: formatBytes(stored.image.bytes)
                    },
                    'ok'
                );
            })
            .catch(function (error) {
                setStatusText(els.status, error.message, 'error');
            });
    }

    function onImageChange(event) {
        const input = event.target;
        const cardId = input.getAttribute('data-image');
        if (!cardId) return;
        const file = input.files && input.files[0];
        input.value = '';
        if (file) attachImage(cardId, file);
    }

    function onClick(event) {
        const statButton = event.target.closest('[data-remove-stat]');
        if (statButton) {
            const key = statButton.getAttribute('data-remove-stat');
            draft.stats = draft.stats.filter(function (stat) {
                return stat.key !== key;
            });
            renderAll();
            return;
        }

        const imageButton = event.target.closest('[data-clear-image]');
        if (imageButton) {
            const card = findCard(imageButton.getAttribute('data-clear-image'));
            if (card) {
                card.imageId = null;
                renderArt(card);
                imageButton.disabled = true;
                setStatus(els.status, 'create.imageRemoved');
            }
            return;
        }

        const cardButton = event.target.closest('[data-remove-card]');
        if (cardButton) {
            const id = cardButton.getAttribute('data-remove-card');
            draft.cards = draft.cards.filter(function (card) {
                return card.id !== id;
            });
            renderAll();
        }
    }

    /* ------------------------------------------------------ deck conversion */

    /** Unique, slugged attribute keys for the current stats, in column order. */
    function attributeKeys() {
        const keys = [];
        draft.stats.forEach(function (stat, index) {
            const base = Decks.slug(stat.label || '', 'stat_' + (index + 1));
            let key = base;
            let n = 2;
            while (keys.indexOf(key) !== -1) {
                key = base + '_' + n;
                n += 1;
            }
            keys.push(key);
        });
        return keys;
    }

    function toDeck() {
        const keys = attributeKeys();
        const labels = {};
        const units = {};
        const directions = {};

        draft.stats.forEach(function (stat, index) {
            labels[keys[index]] = String(stat.label || '').trim() || Decks.prettify(stat.key);
            const unit = String(stat.unit || '').trim();
            if (unit) units[keys[index]] = unit;
            if (stat.direction === 'lower') directions[keys[index]] = 'lower';
        });

        const cards = draft.cards.map(function (card) {
            const values = {};
            draft.stats.forEach(function (stat, index) {
                const raw = card.values[stat.key];
                values[keys[index]] = raw === '' || raw === undefined || raw === null ? null : Number(raw);
            });
            return {
                name: card.name,
                icon: card.icon,
                imageId: card.imageId,
                attributes: values
            };
        });

        return {
            id: draft.id || undefined,
            theme: els.deckName.value,
            attributes: keys,
            labels: labels,
            units: units,
            directions: directions,
            cards: cards
        };
    }

    function fromDeck(deck) {
        statSeq = 0;
        cardSeq = 0;

        const stats = deck.attributes.map(function (key) {
            statSeq += 1;
            return {
                key: 's' + statSeq,
                label: (deck.labels && deck.labels[key]) || Decks.prettify(key),
                unit: (deck.units && deck.units[key]) || '',
                direction: deck.directions && deck.directions[key] === 'lower' ? 'lower' : 'higher'
            };
        });

        const cards = deck.cards.map(function (card) {
            cardSeq += 1;
            const values = {};
            deck.attributes.forEach(function (key, index) {
                values['s' + (index + 1)] = card.attributes[key];
            });
            return {
                id: 'c' + cardSeq,
                name: card.name,
                icon: card.icon || '',
                imageId: card.imageId || null,
                values: values
            };
        });

        draft = {
            // Editing a built-in starts a new custom deck rather than modifying it.
            id: Decks.store().isBuiltIn(deck.id) ? null : deck.id,
            theme: deck.theme,
            stats: stats,
            cards: cards
        };
        renderAll();
    }

    /* ----------------------------------------------------------- deck list */

    function refreshList(preferredId) {
        const store = Decks.store();
        const decks = store.all();
        const wanted = preferredId || store.selected();

        els.deckList.innerHTML = '';
        decks.forEach(function (deck) {
            const name = deckLabel(deck);
            const suffix = store.isBuiltIn(deck.id) ? t('create.builtInSuffix') : '';
            const option = el('option', null, name + suffix);
            option.value = deck.id;
            els.deckList.appendChild(option);
        });
        if (wanted && store.get(wanted)) els.deckList.value = wanted;

        const custom = decks.filter(function (deck) {
            return !store.isBuiltIn(deck.id);
        }).length;
        const info = store.describe();
        const images = store.imageStats();

        els.listHint.textContent =
            (custom === 0 ? t('create.noCustomDecks') : t('create.customDecks', { count: custom })) +
            t('create.storage', {
                backend:
                    info.backend === 'indexeddb' ? t('create.storageIndexedDb') : t('create.storageMemory')
            }) +
            (images.count
                ? t('create.images', {
                      count: images.count,
                      size: formatBytes(images.bytes)
                  })
                : '');
        els.delete.disabled = store.isBuiltIn(els.deckList.value);
    }

    /** A deck's displayed name: built-in decks follow the language. */
    function deckLabel(deck) {
        const translation = Deck.translator(deck.id, I18n.locale());
        return translation ? translation.theme : deck.theme;
    }

    function selectedDeck() {
        return Decks.store().get(els.deckList.value);
    }

    function saveDeck() {
        Decks.store()
            .save(toDeck())
            .then(function (result) {
                if (!result.ok) {
                    showErrors(result.errors);
                    setStatus(els.status, 'create.fixProblems', null, 'error');
                    return;
                }
                draft.id = result.deck.id;
                showErrors([]);
                setStatus(els.status, 'create.saved', { theme: result.deck.theme }, 'ok');
                els.json.value = Decks.store().toJSON(result.deck, { images: false });
                refreshList(result.deck.id);
            })
            .catch(function (error) {
                setStatus(els.status, 'create.saveFailed', { message: error.message }, 'error');
            });
    }

    /* ------------------------------------------------------- import/export */

    function importText(text) {
        const store = Decks.store();
        store
            .importJSON(text)
            .then(function (parsed) {
                if (!parsed.ok) {
                    setStatusText(els.jsonStatus, parsed.errors.join(' '), 'error');
                    return null;
                }
                return Promise.all(
                    parsed.decks.map(function (deck) {
                        return store.save(deck);
                    })
                ).then(function (results) {
                    const saved = results.filter(function (result) {
                        return result.ok;
                    }).length;
                    const failed = results.filter(function (result) {
                        return !result.ok;
                    });
                    if (failed.length) {
                        setStatusText(
                            els.jsonStatus,
                            t('create.importPartial', {
                                saved: saved,
                                failed: failed.length,
                                errors: failed[0].errors.join(' ')
                            }),
                            'error'
                        );
                    } else {
                        setStatus(els.jsonStatus, 'create.imported', { count: saved }, 'ok');
                    }
                    refreshList();
                });
            })
            .catch(function (error) {
                setStatus(els.jsonStatus, 'create.importFailed', { message: error.message }, 'error');
            });
    }

    function downloadJson() {
        const text = els.json.value.trim() || Decks.store().exportAll();
        if (!text) {
            setStatus(els.jsonStatus, 'create.nothingToDownload', null, 'error');
            return;
        }
        try {
            const blob = new Blob([text], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'trunfo-deck.json';
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(url);
            setStatus(els.jsonStatus, 'create.downloaded', null, 'ok');
        } catch {
            setStatus(els.jsonStatus, 'create.downloadBlocked', null, 'error');
        }
    }

    function copyJson() {
        const text = els.json.value;
        if (!text.trim()) {
            setStatus(els.jsonStatus, 'create.nothingToCopy', null, 'error');
            return;
        }
        const done = function () {
            setStatus(els.jsonStatus, 'create.copied', null, 'ok');
        };
        if (global.navigator && global.navigator.clipboard && global.navigator.clipboard.writeText) {
            global.navigator.clipboard.writeText(text).then(done, function () {
                setStatus(els.jsonStatus, 'create.copyFailed', null, 'error');
            });
            return;
        }
        els.json.select();
        setStatus(els.jsonStatus, 'create.copyManual');
    }

    /* ------------------------------------------------------------- bindings */

    function bind() {
        els.deckName = byId('deck-name');
        els.stats = byId('stats');
        els.cards = byId('cards');
        els.statCount = byId('stat-count');
        els.cardCount = byId('card-count');
        els.addStat = byId('add-stat');
        els.addCard = byId('add-card');
        els.save = byId('save');
        els.template = byId('template');
        els.clear = byId('clear');
        els.status = byId('status');
        els.errors = byId('errors');
        els.deckList = byId('deck-list');
        els.load = byId('load');
        els.delete = byId('delete');
        els.exportDeck = byId('export-deck');
        els.listHint = byId('list-hint');
        els.json = byId('json');
        els.jsonStatus = byId('json-status');
        els.copy = byId('copy');
        els.download = byId('download');
        els.importText = byId('import-text');
        els.importFile = byId('import-file');

        els.deckName.addEventListener('input', function () {
            draft.theme = els.deckName.value;
        });
        els.stats.addEventListener('input', onInput);
        // A <select> does not always fire `input`; `change` covers it.
        els.stats.addEventListener('change', onInput);
        els.cards.addEventListener('input', onInput);
        els.cards.addEventListener('change', onImageChange);
        els.stats.addEventListener('click', onClick);
        els.cards.addEventListener('click', onClick);

        els.addStat.addEventListener('click', function () {
            if (draft.stats.length >= MAX_STATS) return;
            draft.stats.push(newStat());
            renderAll();
        });

        els.addCard.addEventListener('click', function () {
            const values = {};
            draft.stats.forEach(function (stat) {
                values[stat.key] = '';
            });
            draft.cards.push(newCard(values));
            renderAll();
        });

        els.save.addEventListener('click', saveDeck);

        els.template.addEventListener('click', function () {
            const builtIn = Deck && Deck.getTheme(Deck.DEFAULT_THEME_ID);
            if (!builtIn) return;
            // The copy is the player's own deck, so the built-in content is
            // baked in the language they are reading.
            fromDeck(Deck.localizeTheme(builtIn, I18n.locale()));
            draft.id = null;
            draft.theme = deckLabel(builtIn) + t('create.copySuffix');
            els.deckName.value = draft.theme;
            setStatus(els.status, 'create.templateLoaded', null, 'ok');
            showErrors([]);
        });

        els.clear.addEventListener('click', function () {
            draft = blankDraft();
            showErrors([]);
            setStatus(els.status, 'create.formCleared');
            els.json.value = '';
            renderAll();
        });

        els.deckList.addEventListener('change', function () {
            els.delete.disabled = Decks.store().isBuiltIn(els.deckList.value);
        });

        els.load.addEventListener('click', function () {
            const deck = selectedDeck();
            if (!deck) return;
            fromDeck(deck);
            setStatus(els.status, 'create.loadedDeck', { theme: deck.theme });
        });

        els.delete.addEventListener('click', function () {
            const id = els.deckList.value;
            const deck = Decks.store().get(id);
            if (!deck) return;
            Decks.store()
                .remove(id)
                .then(function (result) {
                    if (result.ok) setStatus(els.status, 'create.deleted', { theme: deck.theme }, 'ok');
                    else setStatusText(els.status, result.errors.join(' '), 'error');
                    refreshList();
                });
        });

        els.exportDeck.addEventListener('click', function () {
            const deck = selectedDeck();
            if (!deck) return;
            els.json.value = Decks.store().toJSON(deck);
            els.json.focus();
            setStatus(els.jsonStatus, 'create.exported', { theme: deck.theme });
        });

        els.copy.addEventListener('click', copyJson);
        els.download.addEventListener('click', downloadJson);
        els.importText.addEventListener('click', function () {
            importText(els.json.value);
        });

        els.importFile.addEventListener('change', function () {
            const file = els.importFile.files && els.importFile.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = function () {
                els.json.value = String(reader.result || '');
                importText(els.json.value);
            };
            reader.onerror = function () {
                setStatus(els.jsonStatus, 'create.fileUnreadable', null, 'error');
            };
            reader.readAsText(file);
            els.importFile.value = '';
        });

        document.addEventListener(I18n.EVENT_NAME, onLocaleChange);
    }

    /* ------------------------------------------------------------ localizing */

    /**
     * Repaint after the language changed: the form (placeholders and accessible
     * names), the saved-deck list, the validation messages and every status
     * line. Input *values* — a deck the player is writing — are never touched.
     */
    function onLocaleChange() {
        renderAll();
        showErrors(lastErrors);
        repaintStatuses();
        refreshList(els.deckList.value || undefined);
    }

    function init() {
        bind();
        draft = blankDraft();
        renderAll();

        // Reads come from the in-memory mirror, so wait for the database first.
        Decks.store()
            .ready()
            .then(function () {
                return Decks.store().pruneImages();
            })
            .then(function () {
                const store = Decks.store();
                const info = store.describe();
                if (info.error) {
                    setStatus(els.status, 'create.dbError', { error: info.error }, 'error');
                } else if (info.backend !== 'indexeddb') {
                    setStatus(els.status, 'create.noIndexedDb', null, 'error');
                }
                if (info.migrated) {
                    setStatus(els.status, 'create.migrated', { count: info.migrated }, 'ok');
                }

                const wanted = (global.location.hash.match(/^#edit=(.+)$/) || [])[1];
                const target = wanted ? store.get(decodeURIComponent(wanted)) : null;
                if (target) fromDeck(target);
                refreshList();
            });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Exposed for debugging and the browser test harness.
    global.TrunfoBuilder = {
        getDraft: function () {
            return draft;
        },
        setDraft: function (next) {
            draft = next;
            renderAll();
        },
        fromDeck: fromDeck,
        toDeck: toDeck,
        save: saveDeck,
        refreshList: refreshList,
        attachImage: attachImage
    };
})(window);
