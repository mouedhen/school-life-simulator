// Runs the browser tests (Python + Playwright, see tests/README.md) one after the other on dist/index.html.
// A failing test is retried once (phone_smoke is known to be flaky); the run fails if any test fails twice.
// Needs: Python 3 with `pip install playwright` and `python -m playwright install chromium`.
// PYTHON=<interpreter> overrides the default (python on Windows, python3 elsewhere).
import { spawnSync } from 'node:child_process';

const PY = process.env.PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
const TESTS = [
  ['tests/ui_snapshot.py'],
  ['tests/ui_smoke.py', 'en'],
  ['tests/ui_smoke.py', 'fr'],
  ['tests/phone_smoke.py', 'en'],
  ['tests/phone_smoke.py', 'fr'],
  ['tests/phone_games.py', 'en'],
  ['tests/people_shop.py', 'en'],
  ['tests/people_shop.py', 'fr'],
  ['tests/old_save.py'],
  ['tests/touch_ink.py'],
  ['tests/fr_miss.py'],
  ['tests/stress.py', 'en', '1', '2'],
];

const run = args => spawnSync(PY, args, { stdio: 'inherit' }).status === 0;
const failed = [];
const retried = [];
for (const args of TESTS) {
  const name = args.join(' ');
  console.log(`\n=== ${name}`);
  if (run(args)) continue;
  console.log(`--- retrying ${name}`);
  if (run(args)) retried.push(name);
  else failed.push(name);
}
console.log(`\n${TESTS.length - failed.length}/${TESTS.length} passed`);
if (retried.length) console.log(`passed on retry (flaky): ${retried.join(', ')}`);
if (failed.length) {
  console.error(`FAILED: ${failed.join(', ')}`);
  process.exit(1);
}
