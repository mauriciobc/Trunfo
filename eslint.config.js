'use strict';

const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
    {
        ignores: [
            'dist/**',
            'node_modules/**',
            '.npm-cache/**',
            '.impeccable/**',
            '.github/skills/**',
            '.github/agents/**',
            '.tmp/**',
            'venv/**',
            '.venv/**',
            '__pycache__/**'
        ]
    },
    js.configs.recommended,
    {
        // Browser scripts. engine.js and deck.js are UMD, so they legitimately
        // touch `module`; everything else is plain browser code.
        files: ['src/js/**/*.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'script',
            globals: Object.assign({}, globals.browser)
        },
        rules: {
            'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
            eqeqeq: ['error', 'smart'],
            'no-var': 'error',
            'prefer-const': 'error'
        }
    },
    {
        files: ['build.js', 'tests/**/*.js', 'tools/**/*.js', 'eslint.config.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'commonjs',
            globals: Object.assign({}, globals.node)
        },
        rules: {
            'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
            eqeqeq: ['error', 'smart'],
            'no-var': 'error',
            'prefer-const': 'error'
        }
    },
    {
        // The UMD wrapper needs `module` and `globalThis` in both worlds.
        files: [
            'src/js/engine.js',
            'src/js/deck.js',
            'src/js/decks.js',
            'src/js/images.js',
            'src/js/i18n.js',
            'src/js/paper.js'
        ],
        languageOptions: {
            globals: Object.assign({}, globals.browser, globals.node)
        }
    }
];
