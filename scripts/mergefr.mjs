// Merges the French translations tr/out_*.json (in name order; a later file overrides an earlier key)
// into src/fr.js, which defines globalThis.FRX for the i18n layer.
//   npm run fr            -> writes src/fr.js
//   npm run fr -- --check -> exits 1 if src/fr.js is not up to date (used by CI)
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TR = join(ROOT, 'tr');
const OUT = join(ROOT, 'src', 'fr.js');

export function buildFr() {
  const merged = new Map(); // a Map keeps insertion order even for number-like keys
  for (const f of readdirSync(TR).filter(f => /^out_.*\.json$/.test(f)).sort()) {
    for (const [k, v] of Object.entries(JSON.parse(readFileSync(join(TR, f), 'utf8')))) merged.set(k, v);
  }
  const body = [...merged].map(([k, v]) => JSON.stringify(k) + ':' + JSON.stringify(v)).join(',');
  return { text: 'globalThis.FRX={' + body + '};\n', count: merged.size };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { text, count } = buildFr();
  if (process.argv.includes('--check')) {
    const current = existsSync(OUT) ? readFileSync(OUT, 'utf8').replace(/\r\n/g, '\n') : '';
    if (current !== text) {
      console.error('src/fr.js is out of date: run `npm run fr` and commit it.');
      process.exit(1);
    }
    console.log(`src/fr.js is up to date (${count} entries)`);
  } else {
    writeFileSync(OUT, text);
    console.log(`src/fr.js: ${count} entries`);
  }
}
