#!/usr/bin/env node
/**
 * Headless browser test runner.
 *
 * Loads a harness page in headless Chromium and waits for it to report. The
 * scenarios are asynchronous now — decks and artwork live in IndexedDB — so
 * `--dump-dom` with a virtual time budget is not reliable: virtual time races
 * ahead while the database is still answering. Instead the runner drives the
 * page over the DevTools protocol and polls `document.title` until the harness
 * says PASS or FAIL.
 *
 * Usage:
 *   node tests/run-browser-test.js [--dist] [--shots] [--browser=/path/to/chrome]
 *
 * Exits non-zero on failure and skips cleanly when no browser is installed.
 * The DevTools connection uses the global `WebSocket`, so this needs Node 22+
 * (`engines` in package.json); older Node is told so instead of failing every
 * scenario with "WebSocket is not defined".
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const args = process.argv.slice(2);
const useDist = args.includes('--dist');
const withShots = args.includes('--shots');
const explicit = args.find((a) => a.startsWith('--browser='));
const only = (args.find((a) => a.startsWith('--only=')) || '').split('=')[1] || null;

const PASS_TITLE = 'BROWSER-TESTS-PASSED';
const FAIL_TITLE = 'BROWSER-TESTS-FAILED';

/**
 * How long to wait for a freshly spawned Chrome to answer on its DevTools port.
 * A cold start on a CI runner (no warm page cache, first profile it has ever
 * written) takes the better part of 15 seconds on its own, so the old
 * 150 x 100ms window was a coin toss for whichever scenario ran first.
 */
const BROWSER_START_TIMEOUT_MS = 45000;

/**
 * Every scenario that must pass. `page` defaults to the game harness and
 * `budget` is a real-time ceiling in milliseconds. `lang` pins the page's
 * language through `?lang=`, so a developer's own locale cannot change what a
 * scenario asserts.
 */
const CASES = [
    { id: 'playthrough', label: 'one-round playthrough', size: '1280,940', budget: 40000 },
    { id: 'draw', label: 'draw and pot sweep', size: '1280,940', budget: 40000 },
    { id: 'solo', label: 'degenerate one-card deck', size: '1280,940', budget: 30000 },
    { id: 'customDeck', label: 'custom 5-stat deck in play', size: '1280,940', budget: 40000 },
    { id: 'cars', label: '2026 electric-car deck', size: '1280,940', budget: 40000 },
    { id: 'lowerWins', label: 'lower-wins stat', size: '1280,940', budget: 40000 },
    { id: 'paper', label: 'paper-texture shader', size: '1280,940', budget: 40000 },
    { id: 'flip', label: 'flip leaves no 3D context', size: '1280,940', budget: 45000 },
    { id: 'long', label: 'full 16-card game', size: '1280,940', budget: 180000 },
    { id: 'locale', label: 'language switch to pt-BR', size: '1280,940', budget: 40000 },
    {
        id: 'localeParam',
        label: '?lang=pt-BR on load',
        size: '1280,940',
        budget: 40000,
        lang: 'pt-BR'
    },
    { id: 'builder', page: 'builder.html', label: 'deck-creator form', size: '1280,1400', budget: 60000 },
    {
        id: 'builderLocale',
        page: 'builder.html',
        label: 'deck creator in pt-BR',
        size: '1280,1400',
        budget: 60000,
        lang: 'pt-BR'
    },
    { id: 'responsive', label: 'layout @ 1600x1200', size: '1600,1200', budget: 30000 },
    { id: 'responsive', label: 'layout @ 1280x940', size: '1280,940', budget: 30000 },
    { id: 'responsive', label: 'layout @ 1100x560', size: '1100,560', budget: 30000 },
    { id: 'responsive', label: 'layout @ 900x700', size: '900,700', budget: 30000 },
    { id: 'responsive', label: 'layout @ 820x600', size: '820,600', budget: 30000 },
    { id: 'responsive', label: 'layout @ 700x900', size: '700,900', budget: 30000 },
    { id: 'responsive', label: 'layout @ 480x900', size: '480,900', budget: 30000 }
].map((entry) => Object.assign({ page: 'browser.html', lang: 'en' }, entry));

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function findBrowser() {
    if (explicit) return explicit.split('=')[1];
    if (process.env.CHROME_BIN) return process.env.CHROME_BIN;

    const candidates = [
        'chromium',
        'chromium-browser',
        'google-chrome',
        'google-chrome-stable',
        'chrome',
        'msedge',
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    ];
    for (const candidate of candidates) {
        const probe = spawnSync(candidate, ['--version'], { stdio: 'ignore' });
        if (!probe.error && probe.status === 0) return candidate;
    }
    return null;
}

function decodeEntities(text) {
    return text
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&amp;/g, '&');
}

/** Launch a browser, open `url`, and wait for the harness to report. */
async function runCase(browser, url, size, budget, shotPath) {
    const port = 9200 + Math.floor(Math.random() * 600);
    const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'trunfo-chrome-'));
    const chrome = spawn(
        browser,
        [
            '--headless=new',
            '--no-sandbox',
            '--disable-gpu',
            '--no-first-run',
            '--hide-scrollbars',
            `--window-size=${size}`,
            `--user-data-dir=${profile}`,
            `--remote-debugging-port=${port}`,
            'about:blank'
        ],
        // Chrome's own complaints are collected: "the browser did not start" on
        // its own says nothing about why.
        { stdio: ['ignore', 'ignore', 'pipe'] }
    );

    let chromeLog = '';
    if (chrome.stderr) {
        chrome.stderr.on('data', (chunk) => {
            chromeLog = (chromeLog + chunk).slice(-4000);
        });
    }

    try {
        const startupDeadline = Date.now() + BROWSER_START_TIMEOUT_MS;
        let version = null;
        while (Date.now() < startupDeadline) {
            try {
                version = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
                break;
            } catch {
                // It already gave up: waiting out the rest of the window helps
                // nobody.
                if (chrome.exitCode !== null) break;
                await sleep(100);
            }
        }
        if (!version) {
            const why = chromeLog.trim().split('\n').filter(Boolean).slice(-3).join(' | ');
            throw new Error(
                'the browser did not start (exit ' +
                    chrome.exitCode +
                    (why ? '): ' + why : ' with no output)')
            );
        }

        const ws = new WebSocket(version.webSocketDebuggerUrl);
        await new Promise((resolve, reject) => {
            ws.onopen = resolve;
            ws.onerror = reject;
        });

        let nextId = 0;
        const pending = new Map();
        ws.onmessage = (event) => {
            const message = JSON.parse(event.data);
            if (message.id && pending.has(message.id)) {
                pending.get(message.id)(message);
                pending.delete(message.id);
            }
        };
        const send = (method, params, sessionId) =>
            new Promise((resolve) => {
                const id = ++nextId;
                pending.set(id, resolve);
                ws.send(JSON.stringify({ id, method, params: params || {}, sessionId }));
            });

        const target = await send('Target.createTarget', { url: 'about:blank' });
        const sessionId = (
            await send('Target.attachToTarget', { targetId: target.result.targetId, flatten: true })
        ).result.sessionId;
        await send('Page.enable', {}, sessionId);
        await send('Runtime.enable', {}, sessionId);

        const evaluate = async (expression) =>
            (await send('Runtime.evaluate', { expression, returnByValue: true }, sessionId)).result.result
                .value;

        await send('Page.navigate', { url }, sessionId);

        const deadline = Date.now() + budget;
        let title = '';
        while (Date.now() < deadline) {
            await sleep(150);
            title = String((await evaluate('document.title')) || '');
            if (title === PASS_TITLE || title === FAIL_TITLE) break;
        }

        const report = decodeEntities(
            String((await evaluate("(document.getElementById('out') || {}).textContent || ''")) || '')
        ).trim();

        if (shotPath) {
            const shot = await send('Page.captureScreenshot', { format: 'png' }, sessionId);
            if (shot.result && shot.result.data) {
                fs.writeFileSync(shotPath, Buffer.from(shot.result.data, 'base64'));
            }
        }

        ws.close();
        return {
            passed: title === PASS_TITLE,
            timedOut: title !== PASS_TITLE && title !== FAIL_TITLE,
            report
        };
    } finally {
        chrome.kill();
        await sleep(300);
        /*
         * Tidy up the throwaway profile — but never at the cost of the result.
         * Chrome's child processes can still be writing into it after the
         * parent is signalled, which used to raise ENOTEMPTY out of this block
         * and fail a scenario that had already passed. Retries first, then a
         * shrug: it lives in the OS temp directory.
         */
        try {
            fs.rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
        } catch {
            /* the OS reclaims its own temp directory */
        }
    }
}

async function run() {
    if (typeof WebSocket !== 'function') {
        console.log(
            'SKIP: the browser scenarios need Node 22+ (global WebSocket); this is ' +
                process.version +
                '. Re-run on a newer Node to exercise them.'
        );
        return 0;
    }

    const browser = findBrowser();
    if (!browser) {
        console.log('SKIP: no Chromium/Chrome found; set CHROME_BIN to run the browser tests.');
        return 0;
    }

    // Every harness page gets a temp copy so the dist build can be tested
    // without touching the sources.
    const harnesses = ['browser.html', 'builder.html'];
    const targets = new Map();
    for (const harness of harnesses) {
        const source = fs.readFileSync(path.join(__dirname, harness), 'utf8');
        const html = useDist ? source.replace(/\.\.\/src\/js\//g, '../dist/js/') : source;
        const stem = harness.replace('.html', '');
        const target = path.join(__dirname, `.${stem}-${useDist ? 'dist' : 'src'}.html`);
        fs.writeFileSync(target, html);
        targets.set(harness, target);
    }

    const shotDir = path.join(__dirname, 'screenshots');
    if (withShots) fs.mkdirSync(shotDir, { recursive: true });

    let failures = 0;
    const selected = CASES.filter((entry) => !only || entry.id === only);

    try {
        console.log(`Browser: ${browser} (${useDist ? 'dist build' : 'src'})\n`);

        for (const testCase of selected) {
            const url = `file://${targets.get(testCase.page)}?case=${testCase.id}&lang=${testCase.lang}`;
            const shotPath = withShots
                ? path.join(shotDir, `${testCase.id}-${testCase.size.replace(',', 'x')}.png`)
                : null;

            let outcome;
            try {
                outcome = await runCase(browser, url, testCase.size, testCase.budget, shotPath);
            } catch (error) {
                outcome = { passed: false, timedOut: false, report: 'runner error: ' + error.message };
            }

            const failedChecks = outcome.report.split('\n').filter((line) => line.startsWith('FAIL'));

            console.log(
                `${outcome.passed ? 'PASS' : 'FAIL'}  ${testCase.label.padEnd(26)} ${testCase.id}` +
                    ` @ ${testCase.size}` +
                    (outcome.passed
                        ? ''
                        : outcome.timedOut
                          ? '  <- no report before the timeout'
                          : '  <- ' + failedChecks.length + ' check(s)')
            );

            if (!outcome.passed) {
                failures += 1;
                if (outcome.report) {
                    console.log(
                        outcome.report
                            .split('\n')
                            .map((line) => '        ' + line)
                            .join('\n')
                    );
                }
            }
        }
    } finally {
        for (const target of targets.values()) fs.rmSync(target, { force: true });
    }

    if (failures) {
        console.error(`\n${failures} browser scenario(s) FAILED.`);
        return 1;
    }
    console.log(`\nAll ${selected.length} browser scenario(s) passed.`);
    return 0;
}

run().then(
    (code) => process.exit(code),
    (error) => {
        console.error(error);
        process.exit(1);
    }
);
