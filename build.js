const fs = require('fs').promises;
const path = require('path');
const { minify } = require('terser');
const CleanCSS = require('clean-css');
const { minify: minifyHtml } = require('html-minifier-terser');

// Configuration
const config = {
    srcDir: 'src',
    distDir: 'dist',
    js: {
        dir: 'js',
        minifyOptions: {
            compress: true,
            mangle: true
        }
    },
    css: {
        dir: 'css',
        minifyOptions: {
            level: 2
        }
    },
    html: {
        minifyOptions: {
            collapseWhitespace: true,
            removeComments: true,
            minifyCSS: true,
            minifyJS: true
        }
    }
};

async function ensureDir(dir) {
    try {
        await fs.mkdir(dir, { recursive: true });
    } catch (err) {
        if (err.code !== 'EEXIST') throw err;
    }
}

async function processJavaScript(file) {
    const content = await fs.readFile(file, 'utf8');
    const result = await minify(content, config.js.minifyOptions);
    const outputPath = file.replace(config.srcDir, config.distDir);
    await ensureDir(path.dirname(outputPath));
    await fs.writeFile(outputPath, result.code);
    console.log(`Processed JavaScript: ${file} -> ${outputPath}`);
}

async function processCSS(file) {
    const content = await fs.readFile(file, 'utf8');
    const result = new CleanCSS(config.css.minifyOptions).minify(content);
    const outputPath = file.replace(config.srcDir, config.distDir);
    await ensureDir(path.dirname(outputPath));
    await fs.writeFile(outputPath, result.styles);
    console.log(`Processed CSS: ${file} -> ${outputPath}`);
}

async function processHTML(file) {
    const content = await fs.readFile(file, 'utf8');
    const result = await minifyHtml(content, config.html.minifyOptions);
    const outputPath = file.replace(config.srcDir, config.distDir);
    await ensureDir(path.dirname(outputPath));
    await fs.writeFile(outputPath, result);
    console.log(`Processed HTML: ${file} -> ${outputPath}`);
}

async function copyFile(file) {
    const outputPath = file.replace(config.srcDir, config.distDir);
    await ensureDir(path.dirname(outputPath));
    await fs.copyFile(file, outputPath);
    console.log(`Copied: ${file} -> ${outputPath}`);
}

// Main build process
async function build() {
    try {
        console.log('Starting build process...');
        
        // Clean dist directory
        await fs.rm(config.distDir, { recursive: true, force: true });
        await ensureDir(config.distDir);
        
        // Process all files
        const files = await fs.readdir(config.srcDir, { recursive: true });
        
        for (const file of files) {
            const fullPath = path.join(config.srcDir, file);
            const stat = await fs.stat(fullPath);
            
            if (stat.isFile()) {
                if (file.endsWith('.js')) {
                    await processJavaScript(fullPath);
                } else if (file.endsWith('.css')) {
                    await processCSS(fullPath);
                } else if (file.endsWith('.html')) {
                    await processHTML(fullPath);
                } else {
                    await copyFile(fullPath);
                }
            }
        }
        
        console.log('Build completed successfully!');
    } catch (error) {
        console.error('Build failed:', error);
        process.exit(1);
    }
}

build(); 