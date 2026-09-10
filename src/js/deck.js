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
 * The shipped deck follows Product-Documentation.md exactly: the higher value
 * wins, with no exceptions. A theme can name a stat in `directions` to compare
 * it the other way ("lower wins"), as the car deck does for its 0–100 time. The
 * engine still supports a Super Trunfo card (`superTrunfo: true` beats any
 * ordinary card); add that flag to one card to opt in. It is off by default
 * because it breaks the plain value comparison and, with it enabled, roughly 39%
 * of deals never terminate.
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
                    Elephant: 'Elefante',
                    Cheetah: 'Guepardo',
                    Giraffe: 'Girafa',
                    Gorilla: 'Gorila',
                    Kangaroo: 'Canguru',
                    Rhinoceros: 'Rinoceronte',
                    Hippopotamus: 'Hipopótamo',
                    'Polar Bear': 'Urso-polar',
                    'Grey Wolf': 'Lobo-cinzento',
                    Ostrich: 'Avestruz',
                    Crocodile: 'Crocodilo',
                    Tiger: 'Tigre',
                    Horse: 'Cavalo',
                    Chimpanzee: 'Chimpanzé'
                }
            }
        },
        cards: [
            { name: 'Lion', attributes: { size: 250, speed: 80, lifespan: 15 }, icon: '🦁' },
            { name: 'Elephant', attributes: { size: 400, speed: 40, lifespan: 70 }, icon: '🐘' },
            { name: 'Cheetah', attributes: { size: 150, speed: 120, lifespan: 12 }, icon: '🐆' },
            { name: 'Giraffe', attributes: { size: 500, speed: 60, lifespan: 25 }, icon: '🦒' },
            { name: 'Gorilla', attributes: { size: 180, speed: 40, lifespan: 40 }, icon: '🦍' },
            { name: 'Kangaroo', attributes: { size: 200, speed: 70, lifespan: 22 }, icon: '🦘' },
            { name: 'Rhinoceros', attributes: { size: 380, speed: 50, lifespan: 45 }, icon: '🦏' },
            { name: 'Zebra', attributes: { size: 220, speed: 65, lifespan: 25 }, icon: '🦓' },
            { name: 'Hippopotamus', attributes: { size: 350, speed: 30, lifespan: 50 }, icon: '🦛' },
            { name: 'Polar Bear', attributes: { size: 300, speed: 40, lifespan: 25 }, icon: '🐻‍❄️' },
            { name: 'Grey Wolf', attributes: { size: 160, speed: 65, lifespan: 16 }, icon: '🐺' },
            { name: 'Ostrich', attributes: { size: 280, speed: 70, lifespan: 40 }, icon: '🐦' },
            { name: 'Crocodile', attributes: { size: 320, speed: 35, lifespan: 70 }, icon: '🐊' },
            { name: 'Tiger', attributes: { size: 260, speed: 90, lifespan: 20 }, icon: '🐯' },
            { name: 'Horse', attributes: { size: 240, speed: 88, lifespan: 30 }, icon: '🐴' },
            { name: 'Chimpanzee', attributes: { size: 130, speed: 45, lifespan: 45 }, icon: '🐵' }
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
        cards: [
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
                name: 'Porsche Taycan Turbo S',
                icon: '🏎️',
                imageUrl: 'assets/cars/porsche-taycan.jpg',
                attributes: { range: 630, power: 952, topSpeed: 260, charge: 320, acceleration: 2.8 }
            },
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
                name: 'Kia EV6 GT',
                icon: '🚙',
                imageUrl: 'assets/cars/kia-ev6.jpg',
                attributes: { range: 450, power: 577, topSpeed: 260, charge: 240, acceleration: 3.5 }
            },
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
                name: 'BYD Seal AWD',
                icon: '🚗',
                imageUrl: 'assets/cars/byd-seal.jpg',
                attributes: { range: 520, power: 523, topSpeed: 180, charge: 150, acceleration: 3.8 }
            },
            {
                name: 'Xiaomi SU7 Max',
                icon: '🏎️',
                imageUrl: 'assets/cars/xiaomi-su7.jpg',
                attributes: { range: 800, power: 673, topSpeed: 265, charge: 400, acceleration: 2.8 }
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
