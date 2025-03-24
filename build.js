const fs = require('fs');
const path = require('path');
const { minify } = require('terser');
const CleanCSS = require('clean-css');
const htmlMinifier = require('html-minifier');

// Configuration
const config = {
    srcDir: 'src',
    distDir: 'dist',
    htmlMinifierOptions: {
        removeComments: true,
        collapseWhitespace: true,
        removeAttributeQuotes: true,
        removeRedundantAttributes: true,
        removeEmptyAttributes: true,
        minifyJS: true,
        minifyCSS: true
    }
};

// Create dist directory if it doesn't exist
if (!fs.existsSync(config.distDir)) {
    fs.mkdirSync(config.distDir);
}

// Copy and minify JavaScript files
async function processJavaScript() {
    console.log('Processing JavaScript files...');
    const jsFiles = [
        'js/game.js',
        'tests/game.test.js'
    ];

    for (const file of jsFiles) {
        const srcPath = path.join(config.srcDir, file);
        const distPath = path.join(config.distDir, file);
        
        // Create directory if it doesn't exist
        const dir = path.dirname(distPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        const code = fs.readFileSync(srcPath, 'utf8');
        const minified = await minify(code, {
            compress: true,
            mangle: true
        });

        fs.writeFileSync(distPath, minified.code);
    }
}

// Process CSS files
function processCSS() {
    console.log('Processing CSS files...');
    const cssFiles = ['css/styles.css'];

    for (const file of cssFiles) {
        const srcPath = path.join(config.srcDir, file);
        const distPath = path.join(config.distDir, file);
        
        // Create directory if it doesn't exist
        const dir = path.dirname(distPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        const css = fs.readFileSync(srcPath, 'utf8');
        const minified = new CleanCSS().minify(css);
        fs.writeFileSync(distPath, minified.styles);
    }
}

// Process HTML files
function processHTML() {
    console.log('Processing HTML files...');
    const htmlFiles = ['index.html'];

    for (const file of htmlFiles) {
        const srcPath = path.join(config.srcDir, file);
        const distPath = path.join(config.distDir, file);
        
        const html = fs.readFileSync(srcPath, 'utf8');
        const minified = htmlMinifier.minify(html, config.htmlMinifierOptions);
        fs.writeFileSync(distPath, minified);
    }
}

// Main build process
async function build() {
    console.log('Starting build process...');
    
    try {
        await processJavaScript();
        processCSS();
        processHTML();
        console.log('Build completed successfully!');
    } catch (error) {
        console.error('Build failed:', error);
        process.exit(1);
    }
}

build(); 