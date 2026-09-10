#!/usr/bin/env node
/**
 * Layout calibration tool.
 *
 * The card is sized from `--chrome` (the vertical space the topbar, statusbar
 * and headers take) and `--rows` in src/css/styles.css. Those constants have to
 * be re-derived whenever the chrome changes — a longer topbar that wraps to a
 * second row, for example.
 *
 * This prints, for every viewport the browser suite tests, the real chrome and
 * whether the page overflows, so the constants can be corrected from data
 * rather than guesswork.
 *
 * Usage: node tools/measure-layout.js
 */
'use strict';

const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
// Keep in sync with the `responsive` entries in tests/run-browser-test.js.
const SIZES = ['1600,1200', '1280,940', '1100,560', '900,700', '820,600', '700,900', '480,900'];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function findBrowser() {
    if (process.env.CHROME_BIN) return process.env.CHROME_BIN;
    for (const candidate of ['chromium', 'chromium-browser', 'google-chrome', 'google-chrome-stable']) {
        const probe = require('child_process').spawnSync(candidate, ['--version'], { stdio: 'ignore' });
        if (!probe.error && probe.status === 0) return candidate;
    }
    return null;
}

async function launch(browser, size) {
    const port = 9800 + Math.floor(Math.random() * 150);
    const chrome = spawn(
        browser,
        [
            '--headless=new',
            '--no-sandbox',
            '--disable-gpu',
            '--no-first-run',
            '--hide-scrollbars',
            `--window-size=${size}`,
            `--user-data-dir=${fs.mkdtempSync(path.join(os.tmpdir(), 'trunfo-measure-'))}`,
            `--remote-debugging-port=${port}`,
            'about:blank'
        ],
        { stdio: 'ignore' }
    );

    let version;
    for (let i = 0; i < 120; i++) {
        try {
            version = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
            break;
        } catch {
            await sleep(100);
        }
    }
    if (!version) throw new Error('the browser did not start');

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

    const page = `file://${path.join(ROOT, 'tests', 'browser.html')}?case=responsive`;
    await send('Page.navigate', { url: page }, sessionId);
    await sleep(2200);

    const measured = await send(
        'Runtime.evaluate',
        { expression: MEASURE_EXPRESSION, returnByValue: true },
        sessionId
    );

    ws.close();
    chrome.kill();
    await sleep(150);
    return measured.result.result.value;
}

const MEASURE_EXPRESSION = `(function () {
    var board = document.getElementById('board');
    var columns = getComputedStyle(board).gridTemplateColumns.split(' ').length;
    var card = document.getElementById('player-card');
    var cardHeight = card.getBoundingClientRect().height;
    var scroll = document.documentElement.scrollHeight;
    return JSON.stringify({
        innerW: window.innerWidth,
        innerH: window.innerHeight,
        topbar: Math.round(document.querySelector('.topbar').getBoundingClientRect().height),
        status: Math.round(document.querySelector('.statusbar').getBoundingClientRect().height),
        layout: columns >= 2 ? 'side-by-side' : 'stacked',
        cardW: Math.round(card.getBoundingClientRect().width),
        cardH: Math.round(cardHeight),
        chrome: Math.round(scroll - (columns >= 2 ? 1 : 2) * cardHeight),
        overflow: scroll - window.innerHeight
    });
})()`;

(async () => {
    const browser = findBrowser();
    if (!browser) {
        console.error('No Chromium/Chrome found. Set CHROME_BIN.');
        process.exit(1);
    }

    console.log('size        innerW  innerH  layout        topbar  status  cardW  cardH  chrome  overflow');
    for (const size of SIZES) {
        const data = JSON.parse(await launch(browser, size));
        const flag = data.overflow > 4 ? '  <-- OVERFLOWS' : '';
        console.log(
            `${size.padEnd(11)} ${String(data.innerW).padEnd(7)} ${String(data.innerH).padEnd(7)} ` +
                `${data.layout.padEnd(13)} ${String(data.topbar).padEnd(7)} ${String(data.status).padEnd(7)} ` +
                `${String(data.cardW).padEnd(6)} ${String(data.cardH).padEnd(6)} ${String(data.chrome).padEnd(7)} ` +
                `${data.overflow}${flag}`
        );
    }
})().catch((error) => {
    console.error(error);
    process.exit(1);
});
