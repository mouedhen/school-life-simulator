/* School Life Simulator engine — Node entry point (tests and tools).
 *
 * The engine itself lives in src/engine/*.js (see src/engine/README.md): pieces of one
 * script that share one scope, in file-name order. Like build.py does for the browser,
 * this loader pastes them inside one function and runs the result. A line-level source
 * map makes error stack traces point at the real file and line in src/engine/.
 * Usage: require('./data.js'); require('./talk.js'); const E = require('./engine.js');
 */
'use strict';
const fs = require('fs'), path = require('path'), Module = require('module');

const DIR = path.join(__dirname, 'engine');

function bundle() {
  const files = fs.readdirSync(DIR).filter(f => f.endsWith('.js')).sort().map(f => path.join(DIR, f));
  const parts = files.map(f => fs.readFileSync(f, 'utf8'));
  // same text as build.py: '(function () {\n' + parts joined by '\n' + '})();\n'
  const code = '(function () {\n' + parts.join('\n') + '})();\n';
  // source map: one segment per line, mapping bundle line -> (file, line); line 1 is the wrapper
  const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const vlq = n => { let v = n < 0 ? (-n << 1) | 1 : n << 1, s = ''; do { let d = v & 31; v >>>= 5; if (v) d |= 32; s += B64[d]; } while (v); return s; };
  const lines = [''];
  let prevFile = 0, prevLine = 0;
  parts.forEach((text, fi) => text.split('\n').forEach((_, li) => {
    lines.push('A' + vlq(fi - prevFile) + vlq(li - prevLine) + 'A');
    prevFile = fi; prevLine = li;
  }));
  const map = { version: 3, sources: files.map(f => 'file:///' + f.replace(/\\/g, '/')), names: [], mappings: lines.join(';') };
  return code + '//# sourceMappingURL=data:application/json;base64,' + Buffer.from(JSON.stringify(map)).toString('base64') + '\n';
}

if (!globalThis.Engine) {
  if (Module.setSourceMapsSupport) Module.setSourceMapsSupport(true); else process.setSourceMapsEnabled(true);
  const file = path.join(DIR, '_bundle.js'); // virtual name, never written to disk
  const m = new Module(file, module);
  m.filename = file;
  m._compile(bundle(), file);
}
module.exports = globalThis.Engine;
