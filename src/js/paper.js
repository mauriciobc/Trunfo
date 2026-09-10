/**
 * Surface shaders for the cards.
 *
 * Two GLSL fragment shaders generate the card stock procedurally instead of
 * shipping textures:
 *
 *   paper  the matte stock of the card face — value-noise fibres, a fine grain
 *          and a slow mottle, laid over the print as a multiplied overlay.
 *   gloss  the lacquered back — a faint orange-peel dimple, sparse micro
 *          scratches and occasional glints, painted as a screen-blended layer so
 *          it adds light rather than dirt.
 *
 * Each shader renders once into an offscreen canvas and is handed to CSS as a
 * repeating tile. The tiles are seamless because every noise lattice wraps at
 * the tile edge, and they are small because a card never shows more than a few
 * hundred pixels.
 *
 * Everything here is a progressive enhancement: if WebGL is unavailable the
 * `apply()` call reports failure and the stylesheet's gradients and patterns
 * stand alone. Nothing breaks and nothing is left half-applied.
 *
 * Browser only; in Node `isSupported()` is simply false.
 */
(function (global, factory) {
    'use strict';
    const api = factory(global);
    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    } else {
        /** @type {Record<string, unknown>} */
        const host = /** @type {any} */ (global);
        host.TrunfoPaper = api;
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (global) {
    'use strict';

    const VERTEX_SHADER = `
attribute vec2 aPosition;
void main() {
    gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

    /**
     * Shared GLSL: a hash and value noise on a lattice, wrapped with `mod` so a
     * tile joins seamlessly to itself.
     */
    const NOISE_LIB = `
uniform float uSeed;
uniform float uTile;

float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21) + uSeed);
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}

float valueNoise(vec2 p, vec2 period) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);

    float a = hash(mod(i, period));
    float b = hash(mod(i + vec2(1.0, 0.0), period));
    float c = hash(mod(i + vec2(0.0, 1.0), period));
    float d = hash(mod(i + vec2(1.0, 1.0), period));

    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

/** Fractal noise; each octave wraps at its own lattice size. */
float fbm(vec2 uv, float cells, float octaves) {
    float sum = 0.0;
    float amplitude = 0.5;
    float norm = 0.0;
    float size = cells;

    for (int octave = 0; octave < 5; octave++) {
        if (float(octave) >= octaves) break;
        sum += amplitude * valueNoise(uv * size, vec2(size));
        norm += amplitude;
        amplitude *= 0.5;
        size *= 2.0;
    }

    return sum / max(norm, 0.0001);
}`;

    const PROGRAMS = {
        paper: {
            cssVar: '--paper-grain',
            sizeVar: '--paper-grain-size',
            defaults: {
                tile: 256,
                cssTile: 128,
                quality: 0.88,
                seed: 17,
                grain: 1,
                fibre: 1,
                // Deliberately weak: a strong low-frequency feature is the one
                // thing that makes a repeating tile read as repeating.
                mottle: 0.35,
                colour: [1.0, 0.995, 0.984]
            },
            uniforms: {
                seed: { type: 'float', from: 'seed' },
                tile: { type: 'float', from: 'tile' },
                grain: { type: 'float', from: 'grain' },
                fibre: { type: 'float', from: 'fibre' },
                mottle: { type: 'float', from: 'mottle' },
                paper: { type: 'vec3', from: 'colour' }
            },
            source: `
precision highp float;
${NOISE_LIB}

uniform float uGrain;
uniform float uFiber;
uniform float uMottle;
uniform vec3 uPaper;

void main() {
    vec2 uv = gl_FragCoord.xy / uTile;

    float grain = fbm(uv, 190.0, 3.0);       // fine tooth of the stock
    float mottle = fbm(uv, 5.0, 4.0);        // slow blotching, like uneven pulp
    float fibre = valueNoise(                // stretched far more vertically
        vec2(uv.x * 120.0, uv.y * 9.0),
        vec2(120.0, 9.0)
    );

    float shade = 1.0
        - uGrain * (grain - 0.5) * 0.22
        - uMottle * (mottle - 0.5) * 0.09
        - uFiber * (fibre - 0.5) * 0.07;

    shade = clamp(shade, 0.84, 1.0);
    gl_FragColor = vec4(uPaper * shade, 1.0);
}`
        },

        gloss: {
            cssVar: '--gloss-sheen',
            sizeVar: '--gloss-sheen-size',
            defaults: {
                tile: 256,
                cssTile: 128,
                quality: 0.86,
                seed: 91,
                peel: 1,
                scratch: 1,
                sparkle: 1,
                tint: [1.0, 1.0, 1.0]
            },
            uniforms: {
                seed: { type: 'float', from: 'seed' },
                tile: { type: 'float', from: 'tile' },
                peel: { type: 'float', from: 'peel' },
                scratch: { type: 'float', from: 'scratch' },
                sparkle: { type: 'float', from: 'sparkle' },
                tint: { type: 'vec3', from: 'tint' }
            },
            source: `
precision highp float;
${NOISE_LIB}

uniform float uPeel;
uniform float uScratch;
uniform float uSparkle;
uniform vec3 uTint;

void main() {
    vec2 uv = gl_FragCoord.xy / uTile;

    // Orange peel: the faint dimpling of a cured lacquer.
    float peel = fbm(uv, 220.0, 2.0);

    // Micro-scratches: long, thin, sparse. Stretched hard along one axis.
    float lines = valueNoise(
        vec2(uv.x * 26.0, uv.y * 340.0),
        vec2(26.0, 340.0)
    );
    float scratches = smoothstep(0.86, 1.0, lines);

    // Occasional glints where the coat catches a point of light.
    float glint = valueNoise(uv * 420.0, vec2(420.0));
    glint = pow(glint, 9.0);

    float shine = uPeel * (peel - 0.5) * 0.16
        + uScratch * scratches * 0.3
        + uSparkle * glint * 1.0;

    // This layer is screen-blended, so it must stay almost black: only the
    // bright detail should add light to the card underneath.
    float level = clamp(0.04 + max(shine, 0.0), 0.0, 1.0);
    gl_FragColor = vec4(uTint * level, 1.0);
}`
        }
    };

    let renderer = null;
    let rendererTried = false;
    let lastError = null;
    const programs = new Map();
    const cache = new Map();

    function variantNames() {
        return Object.keys(PROGRAMS);
    }

    function compile(gl, type, source) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            const log = gl.getShaderInfoLog(shader);
            gl.deleteShader(shader);
            throw new Error('shader failed to compile: ' + log);
        }
        return shader;
    }

    /** Build the WebGL context once; returns null when the browser cannot. */
    function getRenderer() {
        if (rendererTried) return renderer;
        rendererTried = true;

        const document = global.document;
        if (!document || !document.createElement) {
            lastError = 'no DOM';
            return null;
        }

        try {
            const canvas = document.createElement('canvas');
            const attributes = {
                antialias: false,
                alpha: false,
                depth: false,
                // toDataURL has to be able to read the buffer back.
                preserveDrawingBuffer: true
            };
            const gl =
                canvas.getContext('webgl', attributes) || canvas.getContext('experimental-webgl', attributes);

            if (!gl) {
                lastError = 'WebGL is unavailable';
                return null;
            }

            // One full-screen pair of triangles, shared by every program.
            const buffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
            gl.bufferData(
                gl.ARRAY_BUFFER,
                new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
                gl.STATIC_DRAW
            );

            renderer = { canvas: canvas, gl: gl, buffer: buffer };
            return renderer;
        } catch (error) {
            lastError = String(error.message || error);
            renderer = null;
            return null;
        }
    }

    /** Compile and link one variant, remembering the result. */
    function getProgram(name) {
        if (programs.has(name)) return programs.get(name);

        const spec = PROGRAMS[name];
        const active = getRenderer();
        if (!active) {
            programs.set(name, null);
            return null;
        }

        try {
            const gl = active.gl;
            const program = gl.createProgram();
            gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER));
            gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, spec.source));
            gl.linkProgram(program);
            if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
                throw new Error('program failed to link: ' + gl.getProgramInfoLog(program));
            }

            gl.useProgram(program);
            const position = gl.getAttribLocation(program, 'aPosition');
            gl.bindBuffer(gl.ARRAY_BUFFER, active.buffer);
            gl.enableVertexAttribArray(position);
            gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

            const locations = {};
            Object.keys(spec.uniforms).forEach(function (key) {
                locations[key] = gl.getUniformLocation(
                    program,
                    'u' + key.charAt(0).toUpperCase() + key.slice(1)
                );
            });

            const entry = { program: program, uniforms: locations, spec: spec };
            programs.set(name, entry);
            return entry;
        } catch (error) {
            lastError = String(error.message || error);
            programs.set(name, null);
            return null;
        }
    }

    function isSupported() {
        return variantNames().every(function (name) {
            return getProgram(name) !== null;
        });
    }

    function settings(name, options) {
        const spec = PROGRAMS[name];
        const opts = options || {};
        const config = {};
        Object.keys(spec.defaults).forEach(function (key) {
            config[key] = opts[key] === undefined ? spec.defaults[key] : opts[key];
        });
        config.tile = Math.max(32, Math.min(1024, Math.round(config.tile)));
        config.cssTile = Math.max(16, Math.round(config.cssTile));
        return config;
    }

    function cacheKey(name, config) {
        return (
            name +
            '|' +
            Object.keys(config)
                .sort()
                .map(function (key) {
                    return key + '=' + config[key];
                })
                .join('|')
        );
    }

    function normalizeArgs(variantOrOptions, maybeOptions) {
        if (typeof variantOrOptions === 'string') {
            return { variant: variantOrOptions, options: maybeOptions || {} };
        }
        return { variant: 'paper', options: variantOrOptions || {} };
    }

    /**
     * Render a variant and return it as a data URL, or null when WebGL is not
     * available. Results are memoised per configuration.
     */
    function texture(variantOrOptions, maybeOptions) {
        const args = normalizeArgs(variantOrOptions, maybeOptions);
        const name = PROGRAMS[args.variant] ? args.variant : 'paper';

        const config = settings(name, args.options);
        const key = cacheKey(name, config);
        if (cache.has(key)) return cache.get(key);

        const entry = getProgram(name);
        if (!entry) return null;

        const canvas = renderer.canvas;
        const gl = renderer.gl;
        if (canvas.width !== config.tile || canvas.height !== config.tile) {
            canvas.width = config.tile;
            canvas.height = config.tile;
        }

        gl.viewport(0, 0, config.tile, config.tile);
        gl.useProgram(entry.program);
        gl.bindBuffer(gl.ARRAY_BUFFER, renderer.buffer);

        Object.keys(entry.spec.uniforms).forEach(function (key) {
            const uniform = entry.spec.uniforms[key];
            const location = entry.uniforms[key];
            const value = config[uniform.from];
            if (uniform.type === 'vec3') {
                gl.uniform3f(location, value[0], value[1], value[2]);
            } else {
                gl.uniform1f(location, value);
            }
        });

        gl.drawArrays(gl.TRIANGLES, 0, 6);

        let dataUrl = null;
        try {
            dataUrl = canvas.toDataURL('image/jpeg', config.quality);
        } catch (error) {
            lastError = 'could not read the canvas back: ' + String(error.message || error);
            return null;
        }

        cache.set(key, dataUrl);
        return dataUrl;
    }

    /**
     * Render every variant and publish them as the CSS custom properties the
     * stylesheet uses. Returns false when the primary (paper) texture could not
     * be produced, leaving the stylesheet's own backgrounds in place.
     */
    function apply(target, options) {
        const opts = options || {};
        const root = target || (global.document && global.document.documentElement);
        if (!root || !root.style || !root.style.setProperty) return false;

        let primary = false;
        variantNames().forEach(function (name) {
            const spec = PROGRAMS[name];
            const config = settings(name, opts[name]);
            const url = texture(name, opts[name]);
            if (!url) return;
            if (name === 'paper') primary = true;
            root.style.setProperty(spec.cssVar, 'url("' + url + '")');
            root.style.setProperty(spec.sizeVar, config.cssTile + 'px ' + config.cssTile + 'px');
        });

        return primary;
    }

    function status() {
        const variants = {};
        variantNames().forEach(function (name) {
            variants[name] = getProgram(name) !== null;
        });
        return {
            supported: isSupported(),
            variants: variants,
            error: lastError,
            cached: cache.size
        };
    }

    function reset() {
        cache.clear();
        programs.clear();
        renderer = null;
        rendererTried = false;
        lastError = null;
    }

    return {
        VARIANTS: variantNames(),
        DEFAULTS: {
            paper: PROGRAMS.paper.defaults,
            gloss: PROGRAMS.gloss.defaults
        },
        isSupported: isSupported,
        texture: texture,
        apply: apply,
        status: status,
        reset: reset
    };
});
