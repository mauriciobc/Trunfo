/**
 * Card artwork preparation.
 *
 * Turns a picked image file into a small data URL that can live in the local
 * database. Files straight off a phone are several megabytes and thousands of
 * pixels wide; a card only ever shows a few hundred, so everything is
 * downscaled to a bounded edge and re-encoded before it is stored.
 *
 * Browser only (canvas + createImageBitmap). The store itself does not depend
 * on this module, which keeps the Node tests free of DOM requirements.
 */
(function (global, factory) {
    'use strict';
    const api = factory(global);
    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    } else {
        /** @type {Record<string, unknown>} */
        const host = /** @type {any} */ (global);
        host.TrunfoImages = api;
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (global) {
    'use strict';

    /**
     * The messages here reach the player through the deck creator's status
     * line, so they are translated. i18n.js publishes itself globally; under
     * Node it is required as a sibling module.
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

    const I18n = loadI18n();
    if (!I18n) throw new Error('TrunfoImages requires i18n.js to be loaded first.');
    const t = I18n.t;

    /** Longest edge kept, in pixels. */
    const MAX_EDGE = 640;
    const QUALITY = 0.82;
    const MAX_INPUT_BYTES = 25 * 1024 * 1024;

    function dataUrlBytes(dataUrl) {
        const comma = dataUrl.indexOf(',');
        if (comma < 0) return 0;
        const padding = dataUrl.endsWith('==') ? 2 : dataUrl.endsWith('=') ? 1 : 0;
        return Math.max(0, Math.round(((dataUrl.length - comma - 1) * 3) / 4) - padding);
    }

    /** Decode a Blob/File into something drawable. */
    function decode(file) {
        if (global.createImageBitmap) {
            // `from-image` applies EXIF rotation, which phone photos need.
            return global.createImageBitmap(file, { imageOrientation: 'from-image' }).catch(function () {
                return global.createImageBitmap(file);
            });
        }
        return new Promise(function (resolve, reject) {
            const url = global.URL.createObjectURL(file);
            const image = new global.Image();
            image.onload = function () {
                global.URL.revokeObjectURL(url);
                resolve(image);
            };
            image.onerror = function () {
                global.URL.revokeObjectURL(url);
                reject(new Error(t('error.imageRead')));
            };
            image.src = url;
        });
    }

    /**
     * Downscale and re-encode a file.
     * @param {File|Blob} file
     * @param {{maxEdge?: number, quality?: number}} [options]
     * @returns {Promise<{dataUrl: string, width: number, height: number, bytes: number}>}
     */
    function prepare(file, options) {
        const opts = options || {};
        if (!file) return Promise.reject(new Error(t('error.chooseImage')));
        if (file.type && !/^image\//.test(file.type)) {
            return Promise.reject(new Error(t('error.notAnImageFile')));
        }
        if (file.size && file.size > MAX_INPUT_BYTES) {
            return Promise.reject(new Error(t('error.imageTooBig')));
        }
        if (!global.document || !global.document.createElement) {
            return Promise.reject(new Error(t('error.imageBrowserOnly')));
        }

        const maxEdge = opts.maxEdge || MAX_EDGE;
        const quality = typeof opts.quality === 'number' ? opts.quality : QUALITY;

        return decode(file).then(function (source) {
            const sourceWidth = source.width || source.naturalWidth;
            const sourceHeight = source.height || source.naturalHeight;
            if (!sourceWidth || !sourceHeight) throw new Error(t('error.imageNoPixels'));

            const scale = Math.min(1, maxEdge / Math.max(sourceWidth, sourceHeight));
            const width = Math.max(1, Math.round(sourceWidth * scale));
            const height = Math.max(1, Math.round(sourceHeight * scale));

            const canvas = global.document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const context = canvas.getContext('2d');
            if (!context) throw new Error(t('error.imageNoCanvas'));
            context.drawImage(source, 0, 0, width, height);
            if (source.close) source.close();

            // WebP is much smaller; fall back when the browser ignores the type.
            let dataUrl = canvas.toDataURL('image/webp', quality);
            if (dataUrl.indexOf('data:image/webp') !== 0) {
                dataUrl = canvas.toDataURL('image/jpeg', quality);
            }

            return { dataUrl: dataUrl, width: width, height: height, bytes: dataUrlBytes(dataUrl) };
        });
    }

    return {
        MAX_EDGE: MAX_EDGE,
        QUALITY: QUALITY,
        MAX_INPUT_BYTES: MAX_INPUT_BYTES,
        prepare: prepare,
        dataUrlBytes: dataUrlBytes
    };
});
