/**
 * Production build.
 *
 * Minifies every HTML/CSS/JS file from src/ into dist/ and adds a content hash
 * to the asset URLs in the HTML, so a browser can never serve a stale
 * stylesheet or script after a deploy.
 *
 * Usage: node build.js
 */
'use strict';

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { minify } = require('terser');
const CleanCSS = require('clean-css');
const { minify: minifyHtml } = require('html-minifier-terser');

const SRC = 'src';
const DIST = 'dist';

const MINIFY_JS = { compress: true, mangle: true };
const MINIFY_CSS = { level: 2 };
const MINIFY_HTML = {
    collapseWhitespace: true,
    removeComments: true,
    minifyCSS: true,
    minifyJS: true
};

/** src-relative path -> content hash, used to bust caches in the HTML. */
const hashes = new Map();

function shortHash(text) {
    return crypto.createHash('sha256').update(text).digest('hex').slice(0, 10);
}

async function ensureDir(dir) {
    await fs.mkdir(dir, { recursive: true });
}

/** Every file under `dir`, as paths relative to it. */
async function listFiles(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true, recursive: true });
    return entries
        .filter((entry) => entry.isFile())
        .map((entry) => path.relative(dir, path.join(entry.parentPath || entry.path, entry.name)));
}

function outputPathFor(relative) {
    return path.join(DIST, relative);
}

async function write(relative, contents) {
    const target = outputPathFor(relative);
    await ensureDir(path.dirname(target));
    await fs.writeFile(target, contents);
    return target;
}

async function processJavaScript(relative) {
    const source = await fs.readFile(path.join(SRC, relative), 'utf8');
    const result = await minify(source, MINIFY_JS);
    if (result.error) throw result.error;
    hashes.set(relative, shortHash(result.code));
    await write(relative, result.code);
    console.log(`js   ${relative} -> ${outputPathFor(relative)}`);
}

async function processCSS(relative) {
    const source = await fs.readFile(path.join(SRC, relative), 'utf8');
    const result = new CleanCSS(MINIFY_CSS).minify(source);
    if (result.errors && result.errors.length) throw new Error(result.errors.join('\n'));
    hashes.set(relative, shortHash(result.styles));
    await write(relative, result.styles);
    console.log(`css  ${relative} -> ${outputPathFor(relative)}`);
}

/**
 * Rewrite `href="css/x.css"` and `src="js/x.js"` to include the content hash.
 * The hash is what the earlier JavaScript/CSS passes recorded.
 */
function fingerprintHtml(html) {
    return html.replace(/(href|src)="([^"]+\.(?:css|js))"/g, (match, attribute, url) => {
        const hash = hashes.get(url);
        return hash ? `${attribute}="${url}?v=${hash}"` : match;
    });
}

async function processHTML(relative) {
    const source = await fs.readFile(path.join(SRC, relative), 'utf8');
    const minified = await minifyHtml(source, MINIFY_HTML);
    await write(relative, fingerprintHtml(minified));
    console.log(`html ${relative} -> ${outputPathFor(relative)}`);
}

async function copyFile(relative) {
    await write(relative, await fs.readFile(path.join(SRC, relative)));
    console.log(`copy ${relative} -> ${outputPathFor(relative)}`);
}

async function build() {
    console.log('Starting build process...');
    await fs.rm(DIST, { recursive: true, force: true });
    await ensureDir(DIST);

    const files = await listFiles(SRC);

    // Assets first, so the HTML pass knows every hash.
    for (const relative of files.filter((f) => f.endsWith('.js'))) {
        await processJavaScript(relative);
    }
    for (const relative of files.filter((f) => f.endsWith('.css'))) {
        await processCSS(relative);
    }
    for (const relative of files.filter((f) => f.endsWith('.html'))) {
        await processHTML(relative);
    }
    for (const relative of files) {
        if (!/\.(js|css|html)$/.test(relative)) await copyFile(relative);
    }

    // Keep GitHub Pages from running Jekyll over the output.
    await write('.nojekyll', '');
    console.log(`Build completed successfully (${hashes.size} fingerprinted asset(s)).`);
}

build().catch((error) => {
    console.error('Build failed:', error);
    process.exit(1);
});
