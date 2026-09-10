#!/usr/bin/env node
/**
 * Fetch card artwork for the "2026 Electric Cars" built-in deck.
 *
 * Only freely-licensed photographs are used, and every one is credited. The
 * images come from Wikimedia Commons via its API; the tool records the file
 * title, author, licence and source page for each one so the deck can ship with
 * proper attribution.
 *
 * Each image is downloaded as a thumbnail and re-encoded to a small, EXIF-free
 * JPEG, because a card never shows more than a few hundred pixels.
 *
 * Credits live in credits.json so they survive re-runs; CREDITS.md is generated
 * from it. Pin an exact Commons file with `preferred` when a search picks the
 * wrong car.
 *
 * Usage:
 *   node tools/fetch-car-images.js            # fetch anything missing
 *   node tools/fetch-car-images.js --force    # re-fetch everything
 *
 * Output: src/assets/cars/<slug>.jpg, credits.json and CREDITS.md
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'src', 'assets', 'cars');
const CREDITS_JSON = path.join(OUT_DIR, 'credits.json');
const CREDITS_MD = path.join(OUT_DIR, 'CREDITS.md');

const API = 'https://commons.wikimedia.org/w/api.php';
const USER_AGENT = 'TrunfoSampleDeck/1.0 (local project; card artwork fetch)';

/** Target size on disk. Card art tops out around 340px, so 640 is ample. */
const WIDTH = 640;
const QUALITY = 82;

/**
 * Card name -> Commons search query. `preferred` pins an exact Commons file;
 * every entry below is pinned to a photograph that has been eyeballed, so a
 * re-fetch reproduces the same set instead of re-ranking search hits.
 */
const CARS = [
    {
        slug: 'lucid-air',
        name: 'Lucid Air Grand Touring',
        query: 'Lucid Air',
        preferred: 'File:Lucid Air IAA 2023 1X7A0548.jpg'
    },
    {
        slug: 'tesla-model-s',
        name: 'Tesla Model S Plaid',
        query: 'Tesla Model S Plaid',
        preferred: 'File:Tesla Model S Plaid Autofrühling Ulm IMG 9321.jpg'
    },
    {
        slug: 'mercedes-eqs',
        name: 'Mercedes EQS 580',
        query: 'Mercedes-Benz EQS',
        preferred: 'File:Mercedes-Benz V297 EQS 580+ AMG Line grey (1).jpg'
    },
    {
        slug: 'bmw-i7',
        name: 'BMW i7 xDrive60',
        query: 'BMW i7',
        preferred: 'File:BMW i7 xDrive60 1X7A6822.jpg'
    },
    {
        slug: 'porsche-taycan',
        name: 'Porsche Taycan Turbo S',
        query: 'Porsche Taycan Turbo S',
        preferred: 'File:2020 Porsche Taycan Turbo S.jpg'
    },
    {
        slug: 'audi-e-tron-gt',
        name: 'Audi RS e-tron GT',
        query: 'Audi e-tron GT',
        preferred: 'File:Audi e-tron GT 1X7A0297.jpg'
    },
    {
        slug: 'tesla-model-3',
        name: 'Tesla Model 3 Long Range',
        query: 'Tesla Model 3',
        preferred: 'File:Tesla Model 3 (2023) Autofrühling Ulm IMG 9282.jpg'
    },
    {
        slug: 'tesla-model-y',
        name: 'Tesla Model Y Long Range',
        query: 'Tesla Model Y',
        preferred: 'File:Tesla Model Y 1X7A6211.jpg'
    },
    {
        slug: 'hyundai-ioniq-6',
        name: 'Hyundai Ioniq 6 Long Range',
        query: 'Hyundai Ioniq 6',
        preferred: 'File:Hyundai Ioniq 6 1X7A7258.jpg'
    },
    {
        slug: 'kia-ev6',
        name: 'Kia EV6 GT',
        query: 'Kia EV6',
        preferred: 'File:Kia EV6 GT IMG 8171.jpg'
    },
    {
        slug: 'polestar-3',
        name: 'Polestar 3',
        query: 'Polestar 3',
        preferred: 'File:Polestar 3 IAA 2023 1X7A0209.jpg'
    },
    {
        slug: 'volvo-ex90',
        name: 'Volvo EX90',
        query: 'Volvo EX90',
        preferred: 'File:Volvo EX90 DSC 7810.jpg'
    },
    {
        slug: 'rivian-r1t',
        name: 'Rivian R1T Quad',
        query: 'Rivian R1T',
        preferred: 'File:Rivian-r1t-2021.jpg'
    },
    {
        slug: 'ford-f150-lightning',
        name: 'Ford F-150 Lightning',
        query: 'Ford F-150 Lightning',
        preferred: 'File:Ford F-150 Lightning IAA 2023 1X7A0596.jpg'
    },
    {
        slug: 'byd-seal',
        name: 'BYD Seal AWD',
        query: 'BYD Seal',
        preferred: 'File:BYD Seal IAA 2023 1X7A0371.jpg'
    },
    {
        slug: 'xiaomi-su7',
        name: 'Xiaomi SU7 Max',
        query: 'Xiaomi SU7',
        preferred: 'File:(CHN-Shanghai) Private Xiaomi SU7 沪A7WE106 2024-11-24.jpg'
    }
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Commons rate-limits; back off and retry rather than losing a card. */
async function fetchWithRetry(url, attempts) {
    const tries = attempts || 5;
    let wait = 1500;
    for (let attempt = 1; attempt <= tries; attempt += 1) {
        const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
        if (response.ok) return response;
        if (response.status !== 429 && response.status < 500) {
            throw new Error(`Commons replied ${response.status}`);
        }
        if (attempt === tries) throw new Error(`Commons replied ${response.status}`);
        await sleep(wait);
        wait *= 1.8;
    }
    throw new Error('unreachable');
}

function stripHtml(value) {
    return String(value == null ? '' : value)
        .replace(/<[^>]*>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&#0?39;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function toCandidate(page) {
    const info = (page.imageinfo || [])[0] || {};
    const meta = info.extmetadata || {};
    return {
        title: page.title,
        index: page.index == null ? 999 : page.index,
        thumbUrl: info.thumburl || info.url || '',
        width: info.width || 0,
        height: info.height || 0,
        author: stripHtml(meta.Artist && meta.Artist.value) || 'Unknown',
        license: stripHtml(meta.LicenseShortName && meta.LicenseShortName.value) || 'Unknown',
        licenseUrl: stripHtml(meta.LicenseUrl && meta.LicenseUrl.value),
        descriptionUrl: info.descriptionurl || ''
    };
}

async function api(params) {
    const url = `${API}?action=query&format=json&prop=imageinfo&iiprop=url|size|extmetadata&iiurlwidth=900&${params}`;
    const response = await fetchWithRetry(url, 5);
    const body = await response.json();
    const pages = body.query && body.query.pages ? Object.values(body.query.pages) : [];
    return pages.filter((page) => page.pageid && page.pageid > 0).map(toCandidate);
}

function search(query, limit) {
    return api(
        `generator=search&gsrnamespace=6&gsrlimit=${limit}` +
            `&gsrsearch=${encodeURIComponent('filetype:bitmap ' + query)}`
    );
}

function lookupTitle(title) {
    return api(`titles=${encodeURIComponent(title)}`);
}

/** Landscape photos suit the card's art window; prefer them, then search rank. */
function rank(candidate) {
    const landscape = candidate.width > candidate.height ? 0 : 1;
    const bigEnough = candidate.width >= 800 ? 0 : 1;
    return landscape * 100 + bigEnough * 10 + candidate.index;
}

async function download(url, target) {
    const response = await fetchWithRetry(url, 5);
    fs.writeFileSync(target, Buffer.from(await response.arrayBuffer()));
}

/** Re-encode to a small, metadata-free JPEG so the repository stays light. */
function shrink(source, target) {
    const result = spawnSync(
        'convert',
        [source, '-resize', `${WIDTH}x${WIDTH}>`, '-strip', '-quality', String(QUALITY), target],
        { encoding: 'utf8' }
    );
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`convert failed: ${(result.stderr || '').trim()}`);
}

async function fetchOne(car, force) {
    const target = path.join(OUT_DIR, `${car.slug}.jpg`);
    if (!force && fs.existsSync(target)) return { skipped: true, file: target };

    const candidates = car.preferred
        ? await lookupTitle(car.preferred)
        : await search(car.query, 12);
    if (!candidates.length) throw new Error('no bitmap results');

    candidates.sort((a, b) => rank(a) - rank(b));
    const chosen = candidates[0];

    const raw = path.join(OUT_DIR, `.${car.slug}.download`);
    await download(chosen.thumbUrl, raw);
    shrink(raw, target);
    fs.rmSync(raw, { force: true });

    return { skipped: false, file: target, credit: chosen };
}

function loadCredits() {
    try {
        const parsed = JSON.parse(fs.readFileSync(CREDITS_JSON, 'utf8'));
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
        return {};
    }
}

function writeCredits(credits) {
    fs.writeFileSync(CREDITS_JSON, JSON.stringify(credits, null, 2) + '\n');

    const rows = CARS.filter((car) => credits[car.slug])
        .map((car) => {
            const credit = credits[car.slug];
            const encode = (value) => String(value).replace(/\|/g, '\\|');
            const title = encode(credit.title.replace(/^File:/, ''));
            const license = credit.licenseUrl ? `[${credit.license}](${credit.licenseUrl})` : credit.license;
            return `| ${encode(car.name)} | ${title} | ${encode(credit.author)} | ${license} | [Commons](${credit.descriptionUrl}) |`;
        })
        .join('\n');

    fs.writeFileSync(
        CREDITS_MD,
        `# Card artwork credits

The photographs bundled with the **2026 Electric Cars** deck come from
[Wikimedia Commons](https://commons.wikimedia.org/) and remain under the licence
shown below. Each was downscaled to ${WIDTH}px and stripped of metadata; no other
changes were made. The application code is licensed separately (MIT).

If you redistribute this deck, keep this file with it — the licences below
require attribution.

| Card | Commons file | Author | Licence | Source |
| ---- | ------------ | ------ | ------- | ------ |
${rows}

Fetched with \`tools/fetch-car-images.js\`.
`
    );
}

(async () => {
    const force = process.argv.includes('--force');
    fs.mkdirSync(OUT_DIR, { recursive: true });

    const credits = loadCredits();
    let failures = 0;

    for (const car of CARS) {
        try {
            const result = await fetchOne(car, force);
            if (result.credit) credits[car.slug] = result.credit;
            const size = result.skipped ? '' : ` (${Math.round(fs.statSync(result.file).size / 1024)} KB)`;
            const shown = result.credit || credits[car.slug];
            console.log(
                `${result.skipped ? 'have ' : 'fetch'}  ${car.slug.padEnd(22)}` +
                    (shown ? `${shown.license.padEnd(16)} ${shown.title}` : '') +
                    size
            );
        } catch (error) {
            failures += 1;
            console.error(`FAIL   ${car.slug.padEnd(22)} ${error.message}`);
        }
        await sleep(1200); // be polite to the API
    }

    writeCredits(credits);
    const credited = CARS.filter((car) => credits[car.slug]).length;
    console.log(`\n${credited}/${CARS.length} credited, ${failures} failed.`);
    process.exit(failures ? 1 : 0);
})().catch((error) => {
    console.error(error);
    process.exit(1);
});
