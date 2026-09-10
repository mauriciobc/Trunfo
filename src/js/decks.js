/**
 * Deck store.
 *
 * Owns the catalogue of playable decks and the artwork attached to their cards.
 *
 * Storage is a local IndexedDB database (`trunfo`):
 *   decks   { id, theme, attributes, labels, units, directions, cards: [{ name, icon, imageId, attributes }] }
 *   images  { id, dataUrl, width, height, bytes, createdAt }
 *   meta    { key, value }            // e.g. the selected deck
 *
 * `directions` names the stats where the lowest value wins; a stat it does not
 * mention is compared "higher wins".
 *
 * Cards reference artwork by `imageId` so a deck record stays small and
 * re-uploading one picture does not rewrite the whole deck.
 *
 * IndexedDB is asynchronous, but the app wants synchronous reads while
 * rendering. So the whole catalogue is mirrored into memory by `ready()`; reads
 * come from the mirror and writes go through to the database.
 *
 * Works as a classic browser script (`window.TrunfoDecks`) and as a CommonJS
 * module for the Node tests, which use the in-memory backend.
 */
(function (global, factory) {
    'use strict';
    const api = factory(global);
    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    } else {
        /** @type {Record<string, unknown>} */
        const host = /** @type {any} */ (global);
        host.TrunfoDecks = api;
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (global) {
    'use strict';

    /**
     * Store errors are shown to the player, so they are translated. i18n.js
     * publishes itself globally in the browser and in Node alike; under Node it
     * is a sibling module, so a direct require covers a test that loads this
     * file on its own.
     */
    function loadI18n() {
        if (global && global.TrunfoI18n) return global.TrunfoI18n;
        if (typeof require === 'function') {
            try {
                return require('./i18n.js');
            } catch {
                return null;
            }
        }
        return null;
    }

    /**
     * The deck's shape — how many cards a group holds and how many groups a deck
     * may have — belongs to the game rules, so the engine owns the numbers and
     * mints the card codes. Loading it here keeps the store from inventing a
     * second opinion about what a well-formed deck is.
     */
    function loadEngine() {
        if (global && global.TrunfoEngine) return global.TrunfoEngine;
        if (typeof require === 'function') {
            try {
                return require('./engine.js');
            } catch {
                return null;
            }
        }
        return null;
    }

    const I18n = loadI18n();
    if (!I18n) throw new Error('TrunfoDecks requires i18n.js to be loaded first.');
    const t = I18n.t;
    const Engine = loadEngine();
    if (!Engine) throw new Error('TrunfoDecks requires engine.js to be loaded first.');

    const DB_NAME = 'trunfo';
    const DB_VERSION = 1;
    const DECK_STORE = 'decks';
    const IMAGE_STORE = 'images';
    const META_STORE = 'meta';

    /* Keys written by the pre-database build, migrated on first use. */
    const LEGACY_DECKS_KEY = 'trunfo.decks.v1';
    const LEGACY_SELECTED_KEY = 'trunfo.selectedDeck.v1';

    /** "Allow decks to have 5 items" — five stats per card. */
    const MAX_STATS = 5;
    const MIN_STATS = 1;
    /**
     * The Trunfo layout: cards come in groups of four, lettered A–D, and a deck
     * is one to eight groups — 1A–1D … 8A–8D, so 4 to 32 cards. The numbers come
     * from the engine, which derives each card's code from this same grouping.
     */
    const CARDS_PER_GROUP = Engine.CARDS_PER_GROUP;
    const MIN_GROUPS = 1;
    const MAX_GROUPS = Engine.MAX_GROUPS;
    const MIN_CARDS = CARDS_PER_GROUP * MIN_GROUPS;
    const MAX_CARDS = Engine.MAX_CARDS;
    const MAX_DECKS = 20;
    /** Artwork is downscaled before it gets here; this is the hard ceiling. */
    const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

    const MAX_NAME = 40;
    const MAX_CARD_NAME = 30;
    const MAX_LABEL = 24;
    const MAX_UNIT = 10;

    /* ------------------------------------------------------------ helpers */

    /** "top speed" / "topSpeed" / "top-speed" -> "Top Speed". */
    function prettify(key) {
        return String(key == null ? '' : key)
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

    /** Turn a display label into a stable attribute key. */
    function slug(text, fallback) {
        const clean = String(text == null ? '' : text)
            .replace(/([a-z0-9])([A-Z])/g, '$1_$2') // topSpeed -> top_Speed
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '');
        return clean || fallback || 'stat';
    }

    function uniqueKey(base, taken) {
        let key = base;
        let n = 2;
        while (taken.indexOf(key) !== -1) {
            key = base + '_' + n;
            n += 1;
        }
        return key;
    }

    function clampText(value, limit) {
        return String(value == null ? '' : value)
            .trim()
            .slice(0, limit);
    }

    /** Take up to `count` code points so multi-byte emoji survive intact. */
    function graphemes(value, count) {
        return Array.from(String(value == null ? '' : value).trim())
            .slice(0, count)
            .join('');
    }

    function randomSuffix() {
        return Math.random().toString(36).slice(2, 7);
    }

    function newDeckId() {
        return 'custom-' + Date.now().toString(36) + '-' + randomSuffix();
    }

    function newImageId() {
        return 'img-' + Date.now().toString(36) + '-' + randomSuffix();
    }

    function copy(value) {
        return JSON.parse(JSON.stringify(value));
    }

    /** Rough byte count of a base64 data URL, without decoding it. */
    function dataUrlBytes(dataUrl) {
        const comma = dataUrl.indexOf(',');
        if (comma < 0) return 0;
        const body = dataUrl.length - comma - 1;
        const padding = dataUrl.endsWith('==') ? 2 : dataUrl.endsWith('=') ? 1 : 0;
        return Math.max(0, Math.round((body * 3) / 4) - padding);
    }

    function isImageDataUrl(value) {
        return typeof value === 'string' && /^data:image\/[a-z0-9.+-]+;base64,/i.test(value);
    }

    /* --------------------------------------------------------- validation */

    /**
     * Canonicalise a deck definition.
     * @returns {{ deck: object|null, errors: string[] }}
     */
    function normalize(raw) {
        const errors = [];

        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
            return { deck: null, errors: [t('error.deckObject')] };
        }

        const theme = clampText(raw.theme, MAX_NAME);
        if (!theme) errors.push(t('error.deckName'));

        const rawAttributes = Array.isArray(raw.attributes) ? raw.attributes : [];
        if (rawAttributes.length < MIN_STATS) errors.push(t('error.minStats'));
        if (rawAttributes.length > MAX_STATS) {
            errors.push(t('error.maxStats', { max: MAX_STATS }));
        }

        const attributes = [];
        const labels = {};
        const units = {};
        const directions = {};
        rawAttributes.forEach(function (key, index) {
            const unique = uniqueKey(slug(key, 'stat_' + (index + 1)), attributes);
            attributes.push(unique);
            const name = clampText((raw.labels && raw.labels[key]) || prettify(key), MAX_LABEL);
            labels[unique] = name || prettify(unique);
            const scale = clampText(raw.units && raw.units[key], MAX_UNIT);
            if (scale) units[unique] = scale;
            // Only the exceptions are stored: a stat with no entry is compared
            // the classic way ("higher wins").
            if (raw.directions && raw.directions[key] === 'lower') directions[unique] = 'lower';
        });

        const rawCards = Array.isArray(raw.cards) ? raw.cards : [];

        const cards = [];
        let superCount = 0;
        rawCards.forEach(function (card, index) {
            const name = clampText(card && card.name, MAX_CARD_NAME);
            const where = name
                ? t('error.cardWhereNamed', { n: index + 1, name: name })
                : t('error.cardWhere', { n: index + 1 });
            if (!name) errors.push(t('error.cardName', { n: index + 1 }));

            const values = {};
            rawAttributes.forEach(function (key, i) {
                const source = card && card.attributes ? card.attributes[key] : undefined;
                const number = typeof source === 'number' ? source : Number(source);
                if (source === '' || source === null || !isFinite(number)) {
                    errors.push(t('error.cardValue', { where: where, stat: labels[attributes[i]] }));
                } else {
                    values[attributes[i]] = number;
                }
            });

            const icon = graphemes(card && card.icon, 2);
            const imageId =
                card && typeof card.imageId === 'string' && /^img-[a-z0-9-]+$/i.test(card.imageId)
                    ? card.imageId
                    : null;

            if (card && card.superTrunfo === true) {
                // A deck has one Super Trunfo card; a second one would make the
                // comparison meaningless. Report it once, on the second.
                if (superCount === 1) errors.push(t('error.oneSuperTrunfo'));
                superCount += 1;
            }

            cards.push({
                name: name,
                icon: icon || null,
                imageId: imageId,
                superTrunfo: !!(card && card.superTrunfo === true),
                attributes: values
            });
        });

        // A deck is played in groups of four, lettered A–D, up to eight groups.
        // One check covers all three ways to be off-layout — too few cards, a
        // partial group, more groups than a deck has — and it is reported after
        // the per-card problems, which name a row the player can go and fix.
        const wholeGroups =
            rawCards.length >= MIN_CARDS &&
            rawCards.length <= MAX_CARDS &&
            rawCards.length % CARDS_PER_GROUP === 0;
        if (!wholeGroups) {
            errors.push(t('error.cardGroups', { min: MIN_CARDS, max: MAX_CARDS }));
        }

        if (errors.length) return { deck: null, errors: errors };

        const id = typeof raw.id === 'string' && /^custom-[a-z0-9-]+$/i.test(raw.id) ? raw.id : newDeckId();

        return {
            deck: {
                id: id,
                theme: theme,
                attributes: attributes,
                labels: labels,
                units: units,
                directions: directions,
                cards: cards
            },
            errors: []
        };
    }

    /** Convenience wrapper: the error list for a candidate deck. */
    function validate(raw) {
        return normalize(raw).errors;
    }

    /** The image ids a deck actually uses. */
    function referencedImageIds(deck) {
        return (deck.cards || [])
            .map(function (card) {
                return card.imageId;
            })
            .filter(Boolean);
    }

    /* ----------------------------------------------------------- backends */

    function memoryBackend() {
        const decks = new Map();
        const images = new Map();
        const meta = new Map();
        return {
            name: 'memory',
            loadDecks: function () {
                return Promise.resolve(Array.from(decks.values()).map(copy));
            },
            loadImages: function () {
                return Promise.resolve(Array.from(images.values()).map(copy));
            },
            loadMeta: function () {
                return Promise.resolve(Object.fromEntries(meta));
            },
            putDeck: function (deck) {
                decks.set(deck.id, copy(deck));
                return Promise.resolve();
            },
            deleteDeck: function (id) {
                decks.delete(id);
                return Promise.resolve();
            },
            putImage: function (image) {
                images.set(image.id, copy(image));
                return Promise.resolve();
            },
            deleteImage: function (id) {
                images.delete(id);
                return Promise.resolve();
            },
            setMeta: function (key, value) {
                meta.set(key, value);
                return Promise.resolve();
            }
        };
    }

    function idbBackend(factory) {
        const idb = factory || (global && global.indexedDB);
        let handle = null;

        function open() {
            if (handle) return Promise.resolve(handle);
            return new Promise(function (resolve, reject) {
                const request = idb.open(DB_NAME, DB_VERSION);
                request.onupgradeneeded = function () {
                    const db = request.result;
                    if (!db.objectStoreNames.contains(DECK_STORE)) {
                        db.createObjectStore(DECK_STORE, { keyPath: 'id' });
                    }
                    if (!db.objectStoreNames.contains(IMAGE_STORE)) {
                        db.createObjectStore(IMAGE_STORE, { keyPath: 'id' });
                    }
                    if (!db.objectStoreNames.contains(META_STORE)) {
                        db.createObjectStore(META_STORE, { keyPath: 'key' });
                    }
                };
                request.onsuccess = function () {
                    handle = request.result;
                    resolve(handle);
                };
                request.onerror = function () {
                    reject(request.error || new Error(t('error.dbOpen')));
                };
                request.onblocked = function () {
                    reject(new Error(t('error.dbBlocked')));
                };
            });
        }

        /** Run a single request inside its own transaction. */
        function one(storeName, mode, action) {
            return open().then(function (db) {
                return new Promise(function (resolve, reject) {
                    const transaction = db.transaction(storeName, mode);
                    const store = transaction.objectStore(storeName);
                    let request;
                    try {
                        request = action(store);
                    } catch (error) {
                        reject(error);
                        return;
                    }
                    transaction.onabort = function () {
                        reject(transaction.error || new Error(t('error.dbAborted')));
                    };
                    request.onsuccess = function () {
                        resolve(request.result);
                    };
                    request.onerror = function () {
                        reject(request.error);
                    };
                });
            });
        }

        return {
            name: 'indexeddb',
            loadDecks: function () {
                return one(DECK_STORE, 'readonly', function (store) {
                    return store.getAll();
                });
            },
            loadImages: function () {
                return one(IMAGE_STORE, 'readonly', function (store) {
                    return store.getAll();
                });
            },
            loadMeta: function () {
                return one(META_STORE, 'readonly', function (store) {
                    return store.getAll();
                }).then(function (rows) {
                    const meta = {};
                    (rows || []).forEach(function (row) {
                        meta[row.key] = row.value;
                    });
                    return meta;
                });
            },
            putDeck: function (deck) {
                return one(DECK_STORE, 'readwrite', function (store) {
                    return store.put(copy(deck));
                }).then(function () {});
            },
            deleteDeck: function (id) {
                return one(DECK_STORE, 'readwrite', function (store) {
                    return store.delete(id);
                }).then(function () {});
            },
            putImage: function (image) {
                return one(IMAGE_STORE, 'readwrite', function (store) {
                    return store.put(copy(image));
                }).then(function () {});
            },
            deleteImage: function (id) {
                return one(IMAGE_STORE, 'readwrite', function (store) {
                    return store.delete(id);
                }).then(function () {});
            },
            setMeta: function (key, value) {
                return one(META_STORE, 'readwrite', function (store) {
                    return store.put({ key: key, value: value });
                }).then(function () {});
            }
        };
    }

    /* -------------------------------------------------------------- store */

    /**
     * @param {object} [backend] one of the backends above
     * @param {Array} [builtIns] themes that are always available and read-only
     */
    function createStore(backend, builtIns) {
        const source = backend || memoryBackend();
        const built = Array.isArray(builtIns) ? builtIns : [];

        const mirror = {
            decks: [],
            images: new Map(),
            selectedId: null,
            error: null
        };

        let readyPromise = null;
        const migration = { attempted: false, imported: 0, skipped: 0 };

        /** Move decks created by the pre-database build into the database. */
        function migrateLegacy() {
            if (migration.attempted) return Promise.resolve(0);
            migration.attempted = true;
            const storage = global && global.localStorage;
            if (!storage) return Promise.resolve(0);

            let legacy;
            try {
                legacy = JSON.parse(storage.getItem(LEGACY_DECKS_KEY) || '[]');
            } catch {
                legacy = [];
            }
            if (!Array.isArray(legacy) || !legacy.length) return Promise.resolve(0);

            const jobs = legacy.map(function (record) {
                const result = normalize(record);
                // A deck that does not fit the current layout (a partial group,
                // or more cards than a deck holds) cannot be carried over; count
                // it so the creator can say so instead of losing it in silence.
                if (!result.deck) {
                    migration.skipped += 1;
                    return Promise.resolve();
                }
                result.deck.id = typeof record.id === 'string' ? record.id : result.deck.id;
                const existing = mirror.decks.some(function (deck) {
                    return deck.id === result.deck.id;
                });
                if (existing) return Promise.resolve();
                mirror.decks.push(result.deck);
                migration.imported += 1;
                return Promise.resolve(source.putDeck(result.deck)).catch(function () {});
            });

            return Promise.all(jobs)
                .then(function () {
                    try {
                        storage.removeItem(LEGACY_DECKS_KEY);
                        const selected = storage.getItem(LEGACY_SELECTED_KEY);
                        if (selected && !mirror.selectedId) mirror.selectedId = selected;
                        storage.removeItem(LEGACY_SELECTED_KEY);
                    } catch {
                        /* best effort */
                    }
                    return migration.imported;
                })
                .catch(function () {
                    return migration.imported;
                });
        }

        function ready() {
            if (readyPromise) return readyPromise;
            readyPromise = Promise.resolve()
                .then(function () {
                    return source.loadDecks ? source.loadDecks() : [];
                })
                .then(function (records) {
                    mirror.decks = (records || [])
                        .map(function (record) {
                            const result = normalize(record);
                            if (!result.deck) return null;
                            // Keep the stored id even if normalize would mint one.
                            result.deck.id = record.id;
                            return result.deck;
                        })
                        .filter(Boolean);
                    return source.loadImages ? source.loadImages() : [];
                })
                .then(function (records) {
                    (records || []).forEach(function (image) {
                        if (image && image.id) mirror.images.set(image.id, image);
                    });
                    return source.loadMeta ? source.loadMeta() : {};
                })
                .then(function (meta) {
                    mirror.selectedId = (meta && meta.selected) || null;
                    return migrateLegacy();
                })
                .then(function () {
                    return api;
                })
                .catch(function (error) {
                    // A broken database must not break the game: carry on with
                    // whatever is already in the mirror.
                    mirror.error = error;
                    return api;
                });
            return readyPromise;
        }

        /* ------------------------------------------------------- read side */

        function isBuiltIn(id) {
            return built.some(function (deck) {
                return deck.id === id;
            });
        }

        function all() {
            return built.map(copy).concat(mirror.decks.map(copy));
        }

        function list() {
            return all().map(function (deck) {
                return {
                    id: deck.id,
                    theme: deck.theme,
                    cards: deck.cards.length,
                    stats: deck.attributes.length,
                    images: referencedImageIds(deck).length,
                    builtIn: isBuiltIn(deck.id)
                };
            });
        }

        function get(id) {
            const found = all().filter(function (deck) {
                return deck.id === id;
            })[0];
            return found || null;
        }

        function count() {
            return mirror.decks.length;
        }

        function selected() {
            if (mirror.selectedId && get(mirror.selectedId)) return mirror.selectedId;
            return built.length ? built[0].id : null;
        }

        function select(id) {
            const next = id == null ? null : String(id);
            mirror.selectedId = next;
            return Promise.resolve(source.setMeta ? source.setMeta('selected', next) : undefined).then(
                function () {
                    return selected();
                }
            );
        }

        /** The artwork data URL for an image id, or null. */
        function image(id) {
            if (!id) return null;
            const record = mirror.images.get(id);
            return record ? record.dataUrl : null;
        }

        function imageRecord(id) {
            return mirror.images.get(id) || null;
        }

        function imageStats() {
            let bytes = 0;
            mirror.images.forEach(function (record) {
                bytes += record.bytes || dataUrlBytes(record.dataUrl || '');
            });
            return { count: mirror.images.size, bytes: bytes };
        }

        /** A deck with each card's `image` data URL attached, ready to render. */
        function hydrate(deck) {
            if (!deck) return deck;
            const out = copy(deck);
            out.cards.forEach(function (card) {
                const dataUrl = image(card.imageId);
                if (dataUrl) card.image = dataUrl;
            });
            return out;
        }

        /* ------------------------------------------------------ write side */

        function save(raw) {
            return ready().then(function () {
                const result = normalize(raw);
                if (!result.deck) return { ok: false, deck: null, errors: result.errors };

                const at = mirror.decks.findIndex(function (deck) {
                    return deck.id === result.deck.id;
                });
                if (at < 0 && mirror.decks.length >= MAX_DECKS) {
                    return {
                        ok: false,
                        deck: null,
                        errors: [t('error.maxDecks', { max: MAX_DECKS })]
                    };
                }

                return Promise.resolve(source.putDeck(result.deck))
                    .then(function () {
                        if (at >= 0) mirror.decks[at] = result.deck;
                        else mirror.decks.push(result.deck);
                        return { ok: true, deck: result.deck, errors: [] };
                    })
                    .catch(function (error) {
                        return {
                            ok: false,
                            deck: null,
                            errors: [t('error.saveFailed', { message: error.message })]
                        };
                    });
            });
        }

        function remove(id) {
            return ready().then(function () {
                if (isBuiltIn(id)) {
                    return { ok: false, errors: [t('error.builtInDelete')] };
                }
                const at = mirror.decks.findIndex(function (deck) {
                    return deck.id === id;
                });
                if (at < 0) return { ok: false, errors: [t('error.deckMissing')] };

                return Promise.resolve(source.deleteDeck(id))
                    .then(function () {
                        mirror.decks.splice(at, 1);
                        if (mirror.selectedId === id) mirror.selectedId = null;
                        return pruneImages();
                    })
                    .then(function () {
                        return { ok: true, errors: [] };
                    })
                    .catch(function (error) {
                        return { ok: false, errors: [t('error.deleteFailed', { message: error.message })] };
                    });
            });
        }

        /**
         * Store artwork and return its id. The caller attaches that id to a card.
         * @param {string} dataUrl
         * @param {{width?: number, height?: number}} [info]
         */
        function putImage(dataUrl, info) {
            return ready().then(function () {
                if (!isImageDataUrl(dataUrl)) {
                    return { ok: false, image: null, errors: [t('error.notAnImage')] };
                }
                const bytes = dataUrlBytes(dataUrl);
                if (bytes > MAX_IMAGE_BYTES) {
                    return {
                        ok: false,
                        image: null,
                        errors: [t('error.imageTooLarge', { limit: Math.round(MAX_IMAGE_BYTES / 1024) })]
                    };
                }

                const record = {
                    id: newImageId(),
                    dataUrl: dataUrl,
                    width: (info && info.width) || 0,
                    height: (info && info.height) || 0,
                    bytes: bytes,
                    createdAt: Date.now()
                };

                return Promise.resolve(source.putImage(record))
                    .then(function () {
                        mirror.images.set(record.id, record);
                        return { ok: true, image: record, errors: [] };
                    })
                    .catch(function (error) {
                        return {
                            ok: false,
                            image: null,
                            errors: [t('error.imageSaveFailed', { message: error.message })]
                        };
                    });
            });
        }

        /** Delete artwork that no deck refers to any more. */
        function pruneImages() {
            const used = new Set();
            mirror.decks.forEach(function (deck) {
                referencedImageIds(deck).forEach(function (id) {
                    used.add(id);
                });
            });

            const orphans = [];
            mirror.images.forEach(function (record, id) {
                if (!used.has(id)) orphans.push(id);
            });
            if (!orphans.length) return Promise.resolve(0);

            return Promise.all(
                orphans.map(function (id) {
                    mirror.images.delete(id);
                    return Promise.resolve(source.deleteImage(id)).catch(function () {});
                })
            ).then(function () {
                return orphans.length;
            });
        }

        function clear() {
            return ready().then(function () {
                const decks = mirror.decks.slice();
                const images = Array.from(mirror.images.keys());
                mirror.decks = [];
                mirror.images = new Map();
                return Promise.all(
                    decks
                        .map(function (deck) {
                            return Promise.resolve(source.deleteDeck(deck.id)).catch(function () {});
                        })
                        .concat(
                            images.map(function (id) {
                                return Promise.resolve(source.deleteImage(id)).catch(function () {});
                            })
                        )
                ).then(function () {
                    return { ok: true };
                });
            });
        }

        /* -------------------------------------------------- import/export */

        /** Serialise a deck, inlining its artwork so the JSON is self-contained. */
        function toJSON(deck, options) {
            const opts = options || {};
            const withImages = opts.images !== false;
            return JSON.stringify(
                {
                    id: deck.id,
                    theme: deck.theme,
                    attributes: deck.attributes,
                    labels: deck.labels,
                    units: deck.units,
                    directions: deck.directions || {},
                    cards: deck.cards.map(function (card) {
                        const out = {
                            name: card.name,
                            icon: card.icon,
                            attributes: card.attributes
                        };
                        if (card.superTrunfo) out.superTrunfo = true;
                        const dataUrl = withImages ? image(card.imageId) : null;
                        if (dataUrl) out.image = dataUrl;
                        return out;
                    })
                },
                null,
                2
            );
        }

        function exportAll() {
            return JSON.stringify(
                mirror.decks.map(function (deck) {
                    return JSON.parse(toJSON(deck));
                }),
                null,
                2
            );
        }

        /**
         * Import one deck or an array of them. Artwork found on the cards is
         * written to the image store and referenced by id.
         * @returns {Promise<{ok: boolean, decks: Array, errors: string[]}>}
         */
        function importJSON(text) {
            return ready().then(function () {
                let parsed;
                try {
                    parsed = JSON.parse(text);
                } catch {
                    return { ok: false, decks: [], errors: [t('error.badJson')] };
                }

                const items = Array.isArray(parsed) ? parsed : [parsed];
                const errors = [];
                const decks = [];
                const imageJobs = [];

                items.forEach(function (item, index) {
                    const result = normalize(item);
                    if (!result.deck) {
                        errors.push(
                            (items.length > 1 ? t('error.deckLabel', { n: index + 1 }) : '') +
                                result.errors.join(' ')
                        );
                        return;
                    }
                    result.deck.id = newDeckId();

                    const rawCards = Array.isArray(item.cards) ? item.cards : [];
                    result.deck.cards.forEach(function (card, cardIndex) {
                        const dataUrl = rawCards[cardIndex] && rawCards[cardIndex].image;
                        if (!isImageDataUrl(dataUrl)) return;
                        imageJobs.push(
                            putImage(dataUrl).then(function (stored) {
                                if (stored.ok) card.imageId = stored.image.id;
                            })
                        );
                    });
                    decks.push(result.deck);
                });

                return Promise.all(imageJobs).then(function () {
                    return { ok: decks.length > 0, decks: decks, errors: errors };
                });
            });
        }

        function describe() {
            const stats = imageStats();
            return {
                backend: source.name,
                decks: mirror.decks.length,
                builtIns: built.length,
                images: stats.count,
                imageBytes: stats.bytes,
                selected: selected(),
                migrated: migration.imported,
                legacySkipped: migration.skipped,
                error: mirror.error ? String(mirror.error.message || mirror.error) : null
            };
        }

        const api = {
            ready: ready,
            all: all,
            list: list,
            get: get,
            count: count,
            selected: selected,
            select: select,
            isBuiltIn: isBuiltIn,
            image: image,
            imageRecord: imageRecord,
            imageStats: imageStats,
            hydrate: hydrate,
            save: save,
            remove: remove,
            putImage: putImage,
            pruneImages: pruneImages,
            clear: clear,
            toJSON: toJSON,
            importJSON: importJSON,
            exportAll: exportAll,
            describe: describe
        };
        return api;
    }

    /* Lazy singleton used by the pages. */
    let singleton = null;
    function store() {
        if (!singleton) {
            const deck = global && global.TrunfoDeck;
            const themes = deck && Array.isArray(deck.THEMES) ? deck.THEMES : [];
            let backend = null;
            try {
                backend = global && global.indexedDB ? idbBackend(global.indexedDB) : null;
            } catch {
                backend = null;
            }
            singleton = createStore(backend || memoryBackend(), themes);
        }
        return singleton;
    }

    return {
        DB_NAME: DB_NAME,
        DB_VERSION: DB_VERSION,
        LEGACY_DECKS_KEY: LEGACY_DECKS_KEY,
        LEGACY_SELECTED_KEY: LEGACY_SELECTED_KEY,
        MAX_STATS: MAX_STATS,
        MIN_STATS: MIN_STATS,
        CARDS_PER_GROUP: CARDS_PER_GROUP,
        MIN_GROUPS: MIN_GROUPS,
        MAX_GROUPS: MAX_GROUPS,
        MIN_CARDS: MIN_CARDS,
        MAX_CARDS: MAX_CARDS,
        MAX_DECKS: MAX_DECKS,
        MAX_IMAGE_BYTES: MAX_IMAGE_BYTES,
        prettify: prettify,
        slug: slug,
        normalize: normalize,
        validate: validate,
        dataUrlBytes: dataUrlBytes,
        isImageDataUrl: isImageDataUrl,
        createStore: createStore,
        memoryBackend: memoryBackend,
        idbBackend: idbBackend,
        store: store
    };
});
