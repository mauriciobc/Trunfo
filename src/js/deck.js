/**
 * Deck data for Trunfo.
 *
 * A theme declares the attribute order (the MVP AI always plays the first
 * attribute), the display unit for each attribute, and the cards themselves.
 * Card shape matches Backend-Structure.md, plus an optional `icon` used purely
 * for presentation and an optional `superTrunfo` flag:
 *   { name: "Lion", theme: "Awesome Animals",
 *     attributes: { size: 250, speed: 80, lifespan: 15 }, icon: "🦁" }
 *
 * A deck is a Trunfo deck: thirty-two cards in eight groups of four, 1A–1D …
 * 8A–8D. The code is the card's position, so a theme declares only the order —
 * the engine derives `code` (see `cardCode` in engine.js). Eight groups of four
 * is the ceiling the deck store enforces on a deck a player builds; a theme may
 * give its groups a meaning (this one groups big cats together) or ignore them.
 *
 * The shipped deck follows Product-Documentation.md's value rule: the higher
 * value wins, with two documented exceptions — a theme can name a stat in
 * `directions` to compare it the other way ("lower wins", as the car deck does
 * for its 0–100 time), and the deck's Super Trunfo card is below.
 *
 * One card in each shipped deck is marked `superTrunfo: true` — the Super Trunfo
 * card of the printed game. It beats every card whatever the category, ignoring
 * the values, and loses only to a "1" card (the four cards of the first group,
 * 1A–1D). The engine owns that rule (`compareCards`); this file only says which
 * card carries the mark. A custom deck may mark one card the same way.
 *
 * A theme may carry an `i18n` block translating its own text (theme name, stat
 * labels, units and card names). English stays canonical; `translator()` hands
 * the UI a render-time lookup and `localizeTheme()` bakes a language into a
 * copy. Custom decks never carry one — their text belongs to the player.
 */
(function (global, factory) {
    'use strict';
    const api = factory();
    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    } else {
        /** @type {Record<string, unknown>} */
        const host = /** @type {any} */ (global);
        host.TrunfoDeck = api;
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    const AWESOME_ANIMALS = {
        id: 'awesome-animals',
        theme: 'Awesome Animals',
        // Declaration order is meaningful: this is the AI's choice order.
        attributes: ['size', 'speed', 'lifespan'],
        labels: { size: 'Size', speed: 'Speed', lifespan: 'Lifespan' },
        units: { size: 'cm', speed: 'km/h', lifespan: 'years' },
        // Translations of the content above. English stays the canonical form;
        // the UI asks `translator()` for the active language and renders the
        // deck through it, so a language switch never re-deals the game.
        i18n: {
            'pt-BR': {
                theme: 'Animais Incríveis',
                labels: { size: 'Tamanho', speed: 'Velocidade', lifespan: 'Tempo de vida' },
                units: { lifespan: 'anos' },
                cardNames: {
                    Lion: 'Leão',
                    Tiger: 'Tigre',
                    Cheetah: 'Guepardo',
                    'Grey Wolf': 'Lobo-cinzento',
                    Elephant: 'Elefante',
                    Giraffe: 'Girafa',
                    Rhinoceros: 'Rinoceronte',
                    Hippopotamus: 'Hipopótamo',
                    'Polar Bear': 'Urso-polar',
                    'Brown Bear': 'Urso-pardo',
                    'Giant Panda': 'Panda-gigante',
                    'American Bison': 'Bisão-americano',
                    Gorilla: 'Gorila',
                    Chimpanzee: 'Chimpanzé',
                    Orangutan: 'Orangotango',
                    Baboon: 'Babuíno',
                    Kangaroo: 'Canguru',
                    Horse: 'Cavalo',
                    'African Wild Dog': 'Cão-selvagem-africano',
                    'Water Buffalo': "Búfalo-d'água",
                    'Mountain Goat': 'Cabra-montesa',
                    'Bactrian Camel': 'Camelo-bactriano',
                    Llama: 'Lhama',
                    'Wild Boar': 'Javali',
                    'Red Fox': 'Raposa-vermelha',
                    Beaver: 'Castor',
                    'Giant Otter': 'Ariranha',
                    'Red Deer': 'Cervo-vermelho',
                    Ostrich: 'Avestruz',
                    'Emperor Penguin': 'Pinguim-imperador',
                    Crocodile: 'Crocodilo'
                }
            }
        },
        // Thirty-two cards in eight groups of four — 1A–1D … 8A–8D. The grouping
        // is structural; the theme here gives each group a loose meaning (big
        // cats, giants, bears…) because that reads well, not because the engine
        // needs it. Only the order inside a group is fixed by the deck.
        cards: [
            // 1 — apex predators
            { name: 'Lion', attributes: { size: 250, speed: 80, lifespan: 15 }, icon: '🦁' },
            { name: 'Tiger', attributes: { size: 260, speed: 90, lifespan: 20 }, icon: '🐯' },
            { name: 'Cheetah', attributes: { size: 150, speed: 120, lifespan: 12 }, icon: '🐆' },
            { name: 'Grey Wolf', attributes: { size: 160, speed: 65, lifespan: 16 }, icon: '🐺' },

            // 2 — giants of the savanna
            { name: 'Elephant', attributes: { size: 400, speed: 40, lifespan: 70 }, icon: '🐘' },
            { name: 'Giraffe', attributes: { size: 500, speed: 60, lifespan: 25 }, icon: '🦒' },
            { name: 'Rhinoceros', attributes: { size: 380, speed: 50, lifespan: 45 }, icon: '🦏' },
            { name: 'Hippopotamus', attributes: { size: 350, speed: 30, lifespan: 50 }, icon: '🦛' },

            // 3 — bears and bison
            { name: 'Polar Bear', attributes: { size: 300, speed: 40, lifespan: 25 }, icon: '🐻‍❄️' },
            { name: 'Brown Bear', attributes: { size: 200, speed: 50, lifespan: 25 }, icon: '🐻' },
            { name: 'Giant Panda', attributes: { size: 150, speed: 32, lifespan: 20 }, icon: '🐼' },
            { name: 'American Bison', attributes: { size: 300, speed: 55, lifespan: 20 }, icon: '🦬' },

            // 4 — primates
            { name: 'Gorilla', attributes: { size: 180, speed: 40, lifespan: 40 }, icon: '🦍' },
            { name: 'Chimpanzee', attributes: { size: 130, speed: 45, lifespan: 45 }, icon: '🐵' },
            { name: 'Orangutan', attributes: { size: 140, speed: 35, lifespan: 35 }, icon: '🦧' },
            { name: 'Baboon', attributes: { size: 70, speed: 45, lifespan: 30 }, icon: '🐒' },

            // 5 — runners and grazers
            { name: 'Zebra', attributes: { size: 220, speed: 65, lifespan: 25 }, icon: '🦓' },
            { name: 'Kangaroo', attributes: { size: 200, speed: 70, lifespan: 22 }, icon: '🦘' },
            { name: 'Horse', attributes: { size: 240, speed: 88, lifespan: 30 }, icon: '🐴' },
            { name: 'African Wild Dog', attributes: { size: 120, speed: 71, lifespan: 11 }, icon: '🐕' },

            // 6 — cattle, camels and goats
            { name: 'Water Buffalo', attributes: { size: 280, speed: 48, lifespan: 25 }, icon: '🐃' },
            { name: 'Mountain Goat', attributes: { size: 120, speed: 60, lifespan: 15 }, icon: '🐐' },
            { name: 'Bactrian Camel', attributes: { size: 300, speed: 65, lifespan: 50 }, icon: '🐫' },
            { name: 'Llama', attributes: { size: 180, speed: 56, lifespan: 20 }, icon: '🦙' },

            // 7 — woodland and river
            { name: 'Wild Boar', attributes: { size: 150, speed: 48, lifespan: 15 }, icon: '🐗' },
            { name: 'Red Fox', attributes: { size: 110, speed: 50, lifespan: 5 }, icon: '🦊' },
            { name: 'Beaver', attributes: { size: 100, speed: 35, lifespan: 15 }, icon: '🦫' },
            { name: 'Giant Otter', attributes: { size: 150, speed: 30, lifespan: 20 }, icon: '🦦' },

            // 8 — deer, birds and reptiles
            { name: 'Red Deer', attributes: { size: 200, speed: 65, lifespan: 20 }, icon: '🦌' },
            { name: 'Ostrich', attributes: { size: 280, speed: 70, lifespan: 40 }, icon: '🐦' },
            { name: 'Emperor Penguin', attributes: { size: 120, speed: 9, lifespan: 20 }, icon: '🐧' },
            {
                name: 'Crocodile',
                attributes: { size: 320, speed: 35, lifespan: 70 },
                icon: '🐊',
                // The deck's Super Trunfo card: it beats every card in the deck
                // except the "1" cards — the big cats of the first group.
                superTrunfo: true
            }
        ]
    };

    /**
     * A second built-in deck, to show that the game is not tied to one theme and
     * to exercise the five-stat limit.
     *
     * The figures are illustrative, rounded, and drawn from widely reported
     * manufacturer and press figures for these models. Real numbers vary by
     * market, trim, wheel size and test cycle, so treat this as sample content
     * rather than a specification sheet.
     *
     * Four stats are "higher is better". The 0–100 km/h time is the opposite:
     * a quicker car has a *smaller* number, so it is declared in `directions`
     * and the engine awards the round to the lower value.
     */
    const ELECTRIC_CARS_2026 = {
        id: 'electric-cars-2026',
        theme: '2026 Electric Cars',
        // Declaration order is meaningful: this is the AI's choice order.
        attributes: ['range', 'power', 'topSpeed', 'charge', 'acceleration'],
        labels: {
            range: 'Range',
            power: 'Power',
            topSpeed: 'Top speed',
            charge: 'Fast charge',
            acceleration: '0–100 km/h'
        },
        units: {
            range: 'km',
            power: 'hp',
            topSpeed: 'km/h',
            charge: 'kW',
            acceleration: 's'
        },
        // The one stat where the lowest number wins.
        directions: { acceleration: 'lower' },
        // Model names are proper nouns and stay as they are.
        i18n: {
            'pt-BR': {
                theme: 'Carros Elétricos 2026',
                labels: {
                    range: 'Alcance',
                    power: 'Potência',
                    topSpeed: 'Velocidade máxima',
                    charge: 'Recarga rápida',
                    acceleration: '0–100 km/h'
                },
                units: { power: 'cv' }
            }
        },
        // Thirty-two cars in eight groups of four — 1A–1D … 8A–8D. Structural
        // first, thematic second: each group is one kind of car, which is how a
        // printed deck is laid out, and the engine would play the same deck in
        // any order.
        cards: [
            // 1 — performance sedans
            {
                name: 'Lucid Air Grand Touring',
                icon: '🚘',
                imageUrl: 'assets/cars/lucid-air.jpg',
                attributes: { range: 830, power: 819, topSpeed: 270, charge: 300, acceleration: 3.0 }
            },
            {
                name: 'Tesla Model S Plaid',
                icon: '🏎️',
                imageUrl: 'assets/cars/tesla-model-s.jpg',
                attributes: { range: 600, power: 1020, topSpeed: 322, charge: 250, acceleration: 2.1 }
            },
            {
                name: 'Porsche Taycan Turbo S',
                icon: '🏎️',
                imageUrl: 'assets/cars/porsche-taycan.jpg',
                attributes: { range: 630, power: 952, topSpeed: 260, charge: 320, acceleration: 2.8 }
            },
            {
                name: 'Xiaomi SU7 Max',
                icon: '🏎️',
                imageUrl: 'assets/cars/xiaomi-su7.jpg',
                attributes: { range: 800, power: 673, topSpeed: 265, charge: 400, acceleration: 2.8 }
            },

            // 2 — luxury sedans
            {
                name: 'Mercedes EQS 580',
                icon: '🚗',
                imageUrl: 'assets/cars/mercedes-eqs.jpg',
                attributes: { range: 700, power: 536, topSpeed: 210, charge: 200, acceleration: 4.1 }
            },
            {
                name: 'BMW i7 xDrive60',
                icon: '🚗',
                imageUrl: 'assets/cars/bmw-i7.jpg',
                attributes: { range: 625, power: 536, topSpeed: 240, charge: 195, acceleration: 4.7 }
            },
            {
                name: 'Mercedes EQE 350+',
                icon: '🚗',
                imageUrl: 'assets/cars/mercedes-eqe.jpg',
                attributes: { range: 640, power: 292, topSpeed: 210, charge: 170, acceleration: 6.2 }
            },
            {
                name: 'BMW i5 M60',
                icon: '🚗',
                imageUrl: 'assets/cars/bmw-i5.jpg',
                attributes: { range: 582, power: 593, topSpeed: 230, charge: 205, acceleration: 3.8 }
            },

            // 3 — sport compacts
            {
                name: 'Audi RS e-tron GT',
                icon: '🏎️',
                imageUrl: 'assets/cars/audi-e-tron-gt.jpg',
                attributes: { range: 600, power: 646, topSpeed: 250, charge: 320, acceleration: 3.3 }
            },
            {
                name: 'Tesla Model 3 Long Range',
                icon: '🚗',
                imageUrl: 'assets/cars/tesla-model-3.jpg',
                attributes: { range: 629, power: 440, topSpeed: 233, charge: 250, acceleration: 4.2 }
            },
            {
                name: 'Polestar 2 Long Range Dual',
                icon: '🚗',
                imageUrl: 'assets/cars/polestar-2.jpg',
                attributes: { range: 655, power: 421, topSpeed: 205, charge: 205, acceleration: 4.2 }
            },
            {
                name: 'MG4 XPOWER',
                icon: '🚗',
                imageUrl: 'assets/cars/mg4.jpg',
                attributes: { range: 385, power: 429, topSpeed: 200, charge: 135, acceleration: 3.8 }
            },

            // 4 — family EVs
            {
                name: 'Tesla Model Y Long Range',
                icon: '🚙',
                imageUrl: 'assets/cars/tesla-model-y.jpg',
                attributes: { range: 600, power: 384, topSpeed: 217, charge: 250, acceleration: 5.0 }
            },
            {
                name: 'Hyundai Ioniq 6 Long Range',
                icon: '🚗',
                imageUrl: 'assets/cars/hyundai-ioniq-6.jpg',
                attributes: { range: 583, power: 325, topSpeed: 185, charge: 350, acceleration: 5.1 }
            },
            {
                name: 'BYD Seal AWD',
                icon: '🚗',
                imageUrl: 'assets/cars/byd-seal.jpg',
                attributes: { range: 520, power: 523, topSpeed: 180, charge: 150, acceleration: 3.8 }
            },
            {
                name: 'Kia EV6 GT',
                icon: '🚙',
                imageUrl: 'assets/cars/kia-ev6.jpg',
                attributes: { range: 450, power: 577, topSpeed: 260, charge: 240, acceleration: 3.5 }
            },

            // 5 — large SUVs
            {
                name: 'Polestar 3',
                icon: '🚙',
                imageUrl: 'assets/cars/polestar-3.jpg',
                attributes: { range: 560, power: 517, topSpeed: 210, charge: 250, acceleration: 4.7 }
            },
            {
                name: 'Volvo EX90',
                icon: '🚙',
                imageUrl: 'assets/cars/volvo-ex90.jpg',
                attributes: { range: 580, power: 510, topSpeed: 180, charge: 250, acceleration: 4.9 }
            },
            {
                name: 'BMW iX xDrive50',
                icon: '🚙',
                imageUrl: 'assets/cars/bmw-ix.jpg',
                attributes: { range: 630, power: 523, topSpeed: 200, charge: 195, acceleration: 4.6 }
            },
            {
                name: 'Audi Q8 e-tron 55',
                icon: '🚙',
                imageUrl: 'assets/cars/audi-q8-e-tron.jpg',
                attributes: { range: 582, power: 408, topSpeed: 200, charge: 170, acceleration: 5.6 }
            },

            // 6 — compact SUVs
            {
                name: 'Kia EV9 GT-Line',
                icon: '🚙',
                imageUrl: 'assets/cars/kia-ev9.jpg',
                attributes: { range: 505, power: 384, topSpeed: 200, charge: 240, acceleration: 5.3 }
            },
            {
                name: 'Volvo EX30 Twin',
                icon: '🚙',
                imageUrl: 'assets/cars/volvo-ex30.jpg',
                attributes: { range: 450, power: 428, topSpeed: 180, charge: 153, acceleration: 3.6 }
            },
            {
                name: 'Nissan Ariya e-4ORCE',
                icon: '🚙',
                imageUrl: 'assets/cars/nissan-ariya.jpg',
                attributes: { range: 498, power: 394, topSpeed: 200, charge: 130, acceleration: 5.1 }
            },
            {
                name: 'Volkswagen ID.4 Pro 4MOTION',
                icon: '🚙',
                imageUrl: 'assets/cars/volkswagen-id4.jpg',
                attributes: { range: 520, power: 340, topSpeed: 180, charge: 175, acceleration: 6.2 }
            },

            // 7 — pickups and off-roaders
            {
                name: 'Rivian R1T Quad',
                icon: '🛻',
                imageUrl: 'assets/cars/rivian-r1t.jpg',
                attributes: { range: 640, power: 835, topSpeed: 200, charge: 220, acceleration: 3.0 }
            },
            {
                name: 'Ford F-150 Lightning',
                icon: '🛻',
                imageUrl: 'assets/cars/ford-f150-lightning.jpg',
                attributes: { range: 515, power: 580, topSpeed: 180, charge: 150, acceleration: 4.0 }
            },
            {
                name: 'Tesla Cybertruck Cyberbeast',
                icon: '🛻',
                imageUrl: 'assets/cars/tesla-cybertruck.jpg',
                attributes: { range: 515, power: 845, topSpeed: 209, charge: 250, acceleration: 2.7 },
                // The deck's Super Trunfo card: the only card beaten by the "1"
                // cards — the performance sedans of the first group.
                superTrunfo: true
            },
            {
                name: 'Rivian R1S Quad',
                icon: '🚙',
                imageUrl: 'assets/cars/rivian-r1s.jpg',
                attributes: { range: 640, power: 835, topSpeed: 200, charge: 220, acceleration: 2.9 }
            },

            // 8 — newcomers
            {
                name: 'Zeekr 001 Long Range AWD',
                icon: '🚗',
                imageUrl: 'assets/cars/zeekr-001.jpg',
                attributes: { range: 620, power: 789, topSpeed: 240, charge: 400, acceleration: 3.3 }
            },
            {
                name: 'Nio ET7 Long Range',
                icon: '🚗',
                imageUrl: 'assets/cars/nio-et7.jpg',
                attributes: { range: 580, power: 644, topSpeed: 200, charge: 140, acceleration: 3.8 }
            },
            {
                name: 'Genesis GV60 Performance',
                icon: '🚙',
                imageUrl: 'assets/cars/genesis-gv60.jpg',
                attributes: { range: 466, power: 483, topSpeed: 235, charge: 350, acceleration: 4.0 }
            },
            {
                name: 'Jaguar I-Pace EV400',
                icon: '🚙',
                imageUrl: 'assets/cars/jaguar-i-pace.jpg',
                attributes: { range: 470, power: 400, topSpeed: 200, charge: 100, acceleration: 4.8 }
            }
        ]
    };

    const THEMES = [AWESOME_ANIMALS, ELECTRIC_CARS_2026];
    const DEFAULT_THEME_ID = AWESOME_ANIMALS.id;

    /** Look up a theme by id; with no id, return the default theme. */
    function getTheme(id) {
        if (!id) return AWESOME_ANIMALS;
        for (let i = 0; i < THEMES.length; i++) {
            if (THEMES[i].id === id) return THEMES[i];
        }
        return null;
    }

    /**
     * A built-in theme's content in another language, as a new theme object.
     * A theme with no `i18n` entry for `locale` — which includes every custom
     * deck, whose text is its author's — comes back untouched.
     *
     * This is for content that is *baked in*: the deck creator's "start from
     * the built-in deck", or tests. The game page translates at render time
     * through `translator()` instead.
     */
    function localizeTheme(theme, locale) {
        const overlay = theme && theme.i18n && theme.i18n[locale];
        if (!overlay) return theme;

        const localized = Object.assign({}, theme);
        if (overlay.theme) localized.theme = overlay.theme;
        localized.labels = Object.assign({}, theme.labels, overlay.labels);
        localized.units = Object.assign({}, theme.units, overlay.units);
        const names = overlay.cardNames || {};
        localized.cards = theme.cards.map(function (card) {
            return names[card.name] ? Object.assign({}, card, { name: names[card.name] }) : card;
        });
        return localized;
    }

    /**
     * A render-time translator for a built-in theme, or null when there is
     * nothing to translate (a custom deck, or English).
     *
     * @returns {{theme: string, labels: Object, units: Object, name: function(string): string}|null}
     */
    function translator(themeId, locale) {
        const theme = getTheme(themeId);
        const overlay = theme && theme.i18n && theme.i18n[locale];
        if (!overlay) return null;
        const names = overlay.cardNames || {};
        return {
            theme: overlay.theme || theme.theme,
            labels: overlay.labels || {},
            units: overlay.units || {},
            /** The card's name in this language; unknown names are left alone. */
            name: function (name) {
                return names[name] || name;
            }
        };
    }

    return {
        THEMES: THEMES,
        DEFAULT_THEME_ID: DEFAULT_THEME_ID,
        AWESOME_ANIMALS: AWESOME_ANIMALS,
        ELECTRIC_CARS_2026: ELECTRIC_CARS_2026,
        getTheme: getTheme,
        localizeTheme: localizeTheme,
        translator: translator
    };
});
