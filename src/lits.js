// static literal extraction from sources
const fs = require('fs');
const out = new Set();
const grab = (file, filterFn) => {
  const src = fs.readFileSync(file, 'utf8');
  const re = /'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g; let m;
  while ((m = re.exec(src))) {
    let s = m[1] != null ? m[1] : m[2] != null ? m[2] : m[3];
    s = s.replace(/\\'/g, "'").replace(/\\"/g, '"').replace(/\\n/g, ' ').replace(/\\u2019/g, '’');
    if (m[3] != null && /\$\{/.test(s)) continue;
    if (s.length < 6 || !/[a-z]{3}/.test(s) || !/ /.test(s)) continue;
    if (/[=<>{}\\|;]/.test(s.replace(/\{n\}|\{t\}|\{X\}|\{Y\}/g, ''))) continue;
    if (/^(sls_|data-|#|\/|http|[a-z]+:\/\/)/.test(s) || /^\.[a-z][a-z-]*$/.test(s) || /^[a-z]+(-[a-z]+)+$/.test(s)) continue;
    if (/^[A-Za-z]+\([^)]*\)$/.test(s) && !/ /.test(s)) continue;
    out.add(s);
  }
};
['engine.js', 'talk.js', 'app.js'].forEach(f => grab(f));
fs.writeFileSync('../lits.json', JSON.stringify([...out]));
console.log(out.size);
