// Checks undefined and unused names across the pieces of each bundle (src/engine/*.js, src/app/*.js).
// The pieces share one scope, so a per-file lint cannot see these; here each bundle is linted as one script
// and every message is mapped back to its piece file and line.
import { Linter } from 'eslint';
import globals from 'globals';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// Names other <script>s of the page define (data.js, talk.js, fr.js, i18n.js, the engine, the Artifact runtime).
const PAGE_GLOBALS = { DATA: 'readonly', TALK: 'readonly', FRX: 'readonly', I18N: 'readonly', LANG: 'writable', claude: 'readonly' };

const BUNDLES = [
  { folder: 'src/engine', globals: { ...globals['shared-node-browser'], ...PAGE_GLOBALS } },
  { folder: 'src/app', globals: { ...globals.browser, ...PAGE_GLOBALS } },
];

const linter = new Linter();
let problems = 0;
for (const { folder, globals: g } of BUNDLES) {
  const dir = join(ROOT, folder);
  const files = readdirSync(dir).filter(f => f.endsWith('.js')).sort();
  const ranges = []; // [first line, file]
  let code = '(function () {\n';
  let line = 2;
  for (const f of files) {
    const text = readFileSync(join(dir, f), 'utf8').replace(/\r\n/g, '\n');
    ranges.push([line, join(dir, f)]);
    code += text + '\n';
    line += text.split('\n').length;
  }
  code += '})();\n';
  const messages = linter.verify(code, {
    languageOptions: { ecmaVersion: 'latest', sourceType: 'script', globals: g },
    rules: { 'no-undef': 'error', 'no-unused-vars': ['error', { caughtErrors: 'none' }] },
  });
  for (const m of messages) {
    const [start, file] = ranges.filter(([l]) => l <= m.line).pop() || [1, folder];
    console.log(`${relative(ROOT, file)}:${m.line - start + 1}:${m.column}  ${m.message}  (${m.ruleId})`);
    problems++;
  }
}
if (problems) {
  console.error(`\n${problems} problem(s) across the bundles`);
  process.exit(1);
}
console.log('bundles: no undefined or unused names');
