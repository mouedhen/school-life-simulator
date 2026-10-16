// Builds the whole game into one self-contained file: dist/index.html.
// Order matters: every <script> shares the page's global scope (see docs/ARCHITECTURE.md).
//   npm run build            -> writes dist/index.html
//   npm run build -- --check -> exits 1 if dist/index.html is not up to date (used by CI)
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');
const OUT = join(ROOT, 'dist', 'index.html');

// Reads a text file with LF line endings, whatever the checkout uses.
const read = file => readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

// src/engine/*.js and src/app/*.js are pieces of one script each: pasted in name order inside one function.
export function pieces(folder) {
  const files = readdirSync(folder).filter(f => f.endsWith('.js')).sort();
  return '(function () {\n' + files.map(f => read(join(folder, f))).join('\n') + '})();\n';
}

export function buildHtml() {
  const css = read(join(SRC, 'style.css')) + read(join(SRC, 'journal.css'));
  const fr = existsSync(join(SRC, 'fr.js')) ? read(join(SRC, 'fr.js')) : '';
  const scripts = [
    read(join(SRC, 'data.js')),
    read(join(SRC, 'talk.js')),
    fr,
    read(join(SRC, 'i18n.js')),
    pieces(join(SRC, 'engine')),
    pieces(join(SRC, 'app')),
  ];
  return (
    '<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>School Life Simulator</title>\n' +
    '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n' +
    '<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Fraunces:opsz,wght@9..144,600;9..144,700&family=Patrick+Hand&family=Dancing+Script:wght@500;700&display=swap" rel="stylesheet">\n' +
    `<style>${css}</style>\n` +
    '<div id="root"></div>\n' +
    scripts.map(s => `<script>${s}</script>\n`).join('')
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const html = buildHtml();
  if (process.argv.includes('--check')) {
    const current = existsSync(OUT) ? read(OUT) : '';
    if (current !== html) {
      console.error('dist/index.html is out of date: run `npm run build` and commit it.');
      process.exit(1);
    }
    console.log('dist/index.html is up to date');
  } else {
    mkdirSync(dirname(OUT), { recursive: true });
    writeFileSync(OUT, html);
    console.log(`dist/index.html: ${html.length} characters`);
  }
}
