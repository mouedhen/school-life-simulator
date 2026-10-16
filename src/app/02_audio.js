/* app/02_audio.js — Sound effects (SFX), generated background music (Music) and speech (Voice). */
'use strict';
/* ---------- sound effects (SFX) ---------- */
/* tiny WebAudio synth: no files, quiet, only after a click, and the player can turn it off */
const SFX = {
  c: null,
  g: null,
  ctx() {
    if (!PREF.snd || PREF.muted) return null;
    try {
      if (!this.c) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        this.c = new AC();
        this.g = this.c.createGain();
        this.g.gain.value = (0.55 * PREF.vs) / 100;
        this.g.connect(this.c.destination);
      }
      if (this.c.state === 'suspended') this.c.resume();
      return this.c;
    } catch (e) {
      return null;
    }
  },
  note(f, at, d, type, v) {
    const c = this.ctx();
    if (!c) return;
    try {
      const o = c.createOscillator(),
        g = c.createGain();
      const t0 = c.currentTime + (at || 0);
      o.type = type || 'sine';
      o.frequency.setValueAtTime(f, t0);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(v || 0.12, t0 + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
      o.connect(g);
      g.connect(this.g);
      o.start(t0);
      o.stop(t0 + d + 0.05);
    } catch (e) {}
  },
  noise(at, d, f, v) {
    const c = this.ctx();
    if (!c) return;
    try {
      const n = Math.floor(c.sampleRate * d),
        b = c.createBuffer(1, n, c.sampleRate),
        a = b.getChannelData(0);
      for (let i = 0; i < n; i++) a[i] = (Math.random() * 2 - 1) * (1 - i / n);
      const s = c.createBufferSource();
      s.buffer = b;
      const fl = c.createBiquadFilter();
      fl.type = 'bandpass';
      fl.frequency.value = f;
      fl.Q.value = 0.8;
      const g = c.createGain();
      g.gain.value = v || 0.1;
      s.connect(fl);
      fl.connect(g);
      g.connect(this.g);
      s.start(c.currentTime + (at || 0));
    } catch (e) {}
  },
  tap() {
    this.note(660, 0, 0.05, 'triangle', 0.05);
  },
  up() {
    this.note(523, 0, 0.12, 'sine', 0.1);
    this.note(784, 0.09, 0.2, 'sine', 0.1);
  },
  down() {
    this.note(392, 0, 0.14, 'triangle', 0.09);
    this.note(294, 0.11, 0.26, 'triangle', 0.09);
  },
  coin() {
    this.note(988, 0, 0.08, 'square', 0.04);
    this.note(1319, 0.07, 0.18, 'square', 0.04);
  },
  page() {
    this.noise(0, 0.16, 1800, 0.07);
  },
  chime() {
    [523, 659, 784, 1046].forEach((f, i) => this.note(f, i * 0.13, 0.5, 'sine', 0.08));
  },
  endGood() {
    [523, 659, 784, 1046, 1319].forEach((f, i) => this.note(f, i * 0.16, 0.9, 'sine', 0.09));
  },
  endBad() {
    [440, 349, 294, 220].forEach((f, i) => this.note(f, i * 0.28, 0.9, 'triangle', 0.09));
  },
  forRes(r) {
    if (!r || !r.chips) return this.tap();
    let pos = 0,
      neg = 0,
      mon = 0;
    r.chips.forEach(c => {
      if (c.k === 'flag' || c.k === 'ripple') return;
      if (c.v > 0) {
        pos++;
        if (c.k === 'money') mon++;
      } else if (c.v < 0) neg++;
    });
    if (pos && !neg) mon && pos === mon ? this.coin() : this.up();
    else if (neg && !pos) this.down();
    else if (pos && neg) {
      this.up();
    } else this.tap();
  },
};

/* ---------- background music ---------- */
/* generated live in the browser (no files). Moods crossfade: calm (class), bright (Ball, holidays), exam (minigames, tests),
   win / sad (good / hard endings), dark (low popularity), menu (title and saved games). musMood() picks one. */
const Music = {
  c: null,
  grp: null,
  mood: '',
  timer: null,
  nt: 0,
  st: 0,
  seed: 7,
  started: false,
  // one mood per entry: bpm, ch = 4 bars of [bass note, chord notes] (MIDI numbers), sc = melody scale,
  // pw = wave, hat / arp / mel = chances of hi-hat, arpeggio and melody notes, echo / motif / pulse = extras
  // prettier-ignore
  M: {
    calm:   { bpm: 78,  ch: [[36, [60, 64, 67, 71]], [33, [57, 60, 64, 67]], [41, [57, 60, 65, 69]], [43, [59, 62, 67, 71]]],
              sc: [72, 74, 76, 79, 81, 84], pw: 'sine', hat: 0.018, arp: 0.5, mel: 0.34 },
    bright: { bpm: 104, ch: [[43, [59, 62, 67, 74]], [38, [57, 62, 66, 74]], [40, [59, 64, 67, 71]], [36, [60, 64, 67, 72]]],
              sc: [79, 81, 83, 86, 88, 91], pw: 'triangle', hat: 0.025, arp: 0.8, mel: 0.5 },
    menu:   { bpm: 58,  ch: [[40, [55, 59, 64]], [36, [55, 60, 64]], [43, [55, 59, 62]], [38, [57, 62, 66]]],
              sc: [], pw: 'sine', hat: 0, arp: 0.3, mel: 0, echo: 1,
              motif: [[[0, 76], [2, 79], [3, 83], [6, 81]], [[0, 79], [3, 76], [4, 72], [6, 76]], [[0, 74], [2, 79], [3, 83], [5, 86], [7, 83]], [[0, 81], [2, 78], [4, 74], [6, 78]]] },
    exam:   { bpm: 112, ch: [[38, [57, 62, 65]], [34, [58, 62, 65]], [41, [57, 60, 65]], [33, [57, 61, 64]]],
              sc: [74, 77, 79, 81, 84], pw: 'triangle', hat: 0.03, arp: 0.9, mel: 0.3, pulse: 1 },
    win:    { bpm: 76,  ch: [[36, [60, 64, 67]], [43, [59, 62, 67]], [33, [57, 60, 64]], [41, [60, 65, 69]]],
              sc: [], pw: 'sine', hat: 0, arp: 0.3, mel: 0, echo: 1,
              motif: [[[0, 76], [2, 79], [4, 84], [6, 83]], [[0, 79], [2, 74], [3, 79], [5, 83], [7, 86]], [[0, 81], [2, 84], [4, 81], [6, 76]], [[0, 77], [2, 81], [4, 84], [6, 88]]] },
    sad:    { bpm: 54,  ch: [[33, [57, 60, 64]], [29, [57, 60, 65]], [36, [55, 60, 64]], [40, [56, 59, 64]]],
              sc: [], pw: 'sine', hat: 0, arp: 0.18, mel: 0, echo: 1,
              motif: [[[0, 81], [3, 76], [6, 72]], [[0, 77], [3, 72], [6, 69]], [[0, 72], [2, 76], [5, 79]], [[0, 76], [4, 68]]] },
    dark:   { bpm: 62,  ch: [[33, [57, 60, 64]], [29, [57, 60, 65]], [36, [55, 60, 64]], [40, [56, 59, 64]]],
              sc: [69, 72, 74, 76, 79], pw: 'sine', hat: 0, arp: 0.22, mel: 0.2 },
  },
  rnd() {
    this.seed = (this.seed * 1664525 + 1013904223) >>> 0;
    return this.seed / 4294967296;
  },
  f(m) {
    return 440 * Math.pow(2, (m - 69) / 12);
  },
  ctx() {
    try {
      if (!this.c) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        this.c = new AC();
        this.master = this.c.createGain();
        this.master.gain.value = PREF.vm / 100;
        this.master.connect(this.c.destination);
      }
      if (this.c.state === 'suspended') this.c.resume();
      return this.c;
    } catch (e) {
      return null;
    }
  },
  voice(f, t0, d, type, v, lp) {
    const c = this.c,
      g = c.createGain();
    let last = g;
    try {
      const o = c.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(f, t0);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(v, t0 + (d > 1 ? Math.min(0.9, d / 4) : 0.015));
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
      o.connect(g);
      if (lp) {
        const fl = c.createBiquadFilter();
        fl.type = 'lowpass';
        fl.frequency.value = lp;
        g.connect(fl);
        last = fl;
      }
      last.connect(this.bus || this.grp);
      o.start(t0);
      o.stop(t0 + d + 0.05);
    } catch (e) {}
  },
  tick(t0, v) {
    const c = this.c;
    try {
      const n = Math.floor(c.sampleRate * 0.04),
        b = c.createBuffer(1, n, c.sampleRate),
        a = b.getChannelData(0);
      for (let i = 0; i < n; i++) a[i] = (Math.random() * 2 - 1) * (1 - i / n);
      const s = c.createBufferSource();
      s.buffer = b;
      const fl = c.createBiquadFilter();
      fl.type = 'highpass';
      fl.frequency.value = 6000;
      const g = c.createGain();
      g.gain.value = v;
      s.connect(fl);
      fl.connect(g);
      g.connect(this.grp);
      s.start(t0);
    } catch (e) {}
  },
  step(t0) {
    const m = this.M[this.mood];
    if (!m) return;
    const sd = 60 / m.bpm / 2;
    const bar = Math.floor(this.st / 8) % 4,
      k = this.st % 8;
    const ch = m.ch[bar];
    if (k === 0) {
      ch[1].forEach((n, i) =>
        this.voice(this.f(n), t0 + i * 0.03, sd * 8.2, this.mood === 'dark' ? 'triangle' : 'sine', 0.035, 1400),
      );
      this.voice(this.f(ch[0]), t0, sd * 3.6, 'sine', 0.11);
      if (this.mood !== 'dark') this.voice(this.f(ch[0]), t0 + sd * 4, sd * 3.4, 'sine', 0.08);
    }
    if (m.pulse && k % 2 === 0) this.voice(this.f(ch[0] + 12), t0, sd * 0.9, 'triangle', 0.05, 700);
    if (m.hat && k % 2 === 1) this.tick(t0, m.hat);
    if (this.rnd() < m.arp) {
      const n = ch[1][(k * 3 + bar) % ch[1].length] + 12;
      this.voice(this.f(n), t0, sd * 1.8, m.pw, 0.045, 3200);
    }
    if (m.motif)
      m.motif[bar].forEach(x => {
        if (x[0] === k) {
          this.voice(this.f(x[1]), t0, sd * 5, 'sine', 0.07, 5200);
          this.voice(this.f(x[1] + 12), t0, sd * 2, 'sine', 0.012);
        }
      });
    if ((k === 2 || k === 5 || k === 7) && this.rnd() < m.mel) {
      const n = m.sc[Math.floor(this.rnd() * m.sc.length)];
      this.voice(this.f(n), t0, sd * 3, m.pw, 0.05, 4200);
    }
    this.st++;
  },
  tickLoop() {
    const c = this.c;
    if (!c || !this.mood) return;
    if (this.nt < c.currentTime) this.nt = c.currentTime + 0.05;
    while (this.nt < c.currentTime + 0.5) {
      this.step(this.nt);
      this.nt += 60 / this.M[this.mood].bpm / 2;
    }
  },
  set(m) {
    if (!PREF.mus || PREF.muted || !this.started) {
      this.want = m;
      return;
    }
    this.want = m;
    if (m === this.mood) return;
    const c = this.ctx();
    if (!c) return;
    const old = this.grp,
      t = c.currentTime;
    if (old) {
      try {
        old.gain.cancelScheduledValues(t);
        old.gain.setValueAtTime(old.gain.value, t);
        old.gain.linearRampToValueAtTime(0, t + 2.2);
        setTimeout(() => {
          try {
            old.disconnect();
          } catch (e) {}
        }, 2600);
      } catch (e) {}
    }
    const g = c.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.8, t + 2.5);
    g.connect(this.master || c.destination);
    this.grp = g;
    this.bus = g;
    if (this.M[m].echo) {
      try {
        const bus = c.createGain(),
          dl = c.createDelay(1.5),
          fb = c.createGain(),
          wet = c.createGain();
        dl.delayTime.value = (60 / this.M[m].bpm) * 0.75;
        fb.gain.value = 0.4;
        wet.gain.value = 0.42;
        bus.connect(g);
        bus.connect(dl);
        dl.connect(wet);
        wet.connect(g);
        dl.connect(fb);
        fb.connect(dl);
        this.bus = bus;
      } catch (e) {}
    }
    this.mood = m;
    this.st = 0;
    this.nt = t + 0.1;
    if (!this.timer) this.timer = setInterval(() => this.tickLoop(), 120);
  },
  start() {
    if (!PREF.mus || PREF.muted) return;
    this.started = true;
    if (!this.ctx()) return;
    this.set(this.want || 'calm');
  },
  stop() {
    this.started = false;
    this.mood = '';
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    const g = this.grp;
    this.grp = null;
    if (g && this.c) {
      try {
        const t = this.c.currentTime;
        g.gain.setValueAtTime(g.gain.value, t);
        g.gain.linearRampToValueAtTime(0, t + 0.6);
        setTimeout(() => {
          try {
            g.disconnect();
          } catch (e) {}
        }, 800);
      } catch (e) {}
    }
  },
};
window.__Music = Music;
window.__PREF = PREF;
window.__musMood = () => musMood();
function musMood() {
  try {
    if (!S || V.savesOpen) return 'menu';
    if (S && S.ending) return E.ENDBY[S.ending.id].bad ? 'sad' : 'win';
    if (S && !S.over && (V.mg || (V.evCur && /exam|test|quiz|midterm|final|report card/i.test(V.evCur.title || ''))))
      return 'exam';
    if (V.evCur && (V.evCur.kind === 'ball' || V.evCur.kind === 'holiday')) return 'bright';
    if (S && S.pop <= 30) return 'dark';
  } catch (e) {}
  return 'calm';
}
document.addEventListener('visibilitychange', () => {
  try {
    if (Music.c) document.hidden ? Music.c.suspend() : PREF.mus && Music.c.resume();
  } catch (e) {}
});
document.addEventListener(
  'pointerdown',
  () => {
    if (PREF.mus && !PREF.muted && !Music.started) Music.start();
  },
  { capture: true },
);

/* ---------- voice ---------- */
/* browser text-to-speech for a few scenes (the Ball, the big school moments, the endings); synthetic voices, not recordings */
const Voice = {
  ok() {
    try {
      return !!(window.speechSynthesis && window.SpeechSynthesisUtterance);
    } catch (e) {
      return false;
    }
  },
  vs() {
    try {
      return window.speechSynthesis.getVoices() || [];
    } catch (e) {
      return [];
    }
  },
  gender(who) {
    const w = String(who || '').trim();
    if (!w) return null;
    const c = Object.keys(CH).find(
      n =>
        n === w ||
        n.split(' ')[0] === w.split(' ')[0] ||
        n.replace(/^(Ms|Mr)\.\s*/, '').split(' ')[0] === w.replace(/^(Ms|Mr)\.\s*/, '').split(' ')[0],
    );
    if (c) return CH[c].g;
    if (/^(Mom|Maman|Ms\.|Mme)/.test(w)) return 'F';
    if (/^(Dad|Papa|Mr\.|M\.)/.test(w)) return 'M';
    return null;
  },
  voiceFor(who, g) {
    const lang = L('en', 'fr');
    const all = this.vs().filter(v => v.lang && v.lang.toLowerCase().replace('_', '-').startsWith(lang));
    if (!all.length) return null;
    const fem =
        /female|woman|zira|samantha|susan|hazel|aria|jenny|julie|hortense|amelie|amélie|denise|karen|moira|tessa|victoria|siri.*female|google.*(uk english female|français)/i,
      mal = /\bmale\b|\bman\b|david|mark|daniel|george|thomas|paul|guy|fred|alex|google uk english male|henri/i;
    const pool =
      g === 'F'
        ? all.filter(v => fem.test(v.name) && !/\bmale\b/i.test(v.name))
        : g === 'M'
          ? all.filter(v => mal.test(v.name))
          : [];
    const list = pool.length ? pool : all;
    let h = 0;
    String(who || 'n')
      .split('')
      .forEach(ch => {
        h = (h * 31 + ch.charCodeAt(0)) >>> 0;
      });
    return list[h % list.length];
  },
  plain(s) {
    return trMC(s).replace(/ /g, ' ');
  },
  parts(text, narrator) {
    const out = [];
    const src = this.plain(text);
    const re =
      /(?:((?:Ms\.|Mr\.|Mme|M\.)\s[\p{L}'’ -]{1,24}|\p{Lu}[\p{L}'’ -]{0,28}):\s*)?[“«"]\s*([^”»"]+?)\s*[”»"]/gu;
    let last = 0,
      m,
      who = null;
    while ((m = re.exec(src))) {
      const pre = src.slice(last, m.index).trim();
      if (pre) out.push({ t: pre, who: null });
      who = m[1] ? m[1].trim() : who;
      out.push({ t: m[2], who: who || 'x' });
      last = m.index + m[0].length;
    }
    const tail = src.slice(last).trim();
    if (tail) out.push({ t: tail, who: null });
    return out;
  },
  say(parts) {
    if (!PREF.voice || PREF.muted || !this.ok()) return;
    this.stop();
    try {
      parts.forEach(pt => {
        if (!pt.t) return;
        const u = new SpeechSynthesisUtterance(pt.t);
        u.lang = L('en-US', 'fr-CA');
        let h = 0;
        String(pt.who || 'n')
          .split('')
          .forEach(ch => {
            h = (h * 17 + ch.charCodeAt(0)) >>> 0;
          });
        if (pt.who) {
          const g = this.gender(pt.who);
          const v = this.voiceFor(pt.who, g);
          if (v) u.voice = v;
          u.pitch = g === 'F' ? 1.12 + (h % 20) / 100 : g === 'M' ? 0.78 + (h % 20) / 100 : 0.95 + (h % 25) / 100;
          u.rate = 0.96 + (h % 9) / 100;
        } else {
          const v = this.voiceFor('narrator', null);
          if (v) u.voice = v;
          u.pitch = 0.92;
          u.rate = 0.94;
        }
        u.volume = (0.9 * PREF.vv) / 100;
        window.speechSynthesis.speak(u);
      });
      V.speaking = true;
    } catch (e) {}
  },
  stop() {
    try {
      if (this.ok()) window.speechSynthesis.cancel();
    } catch (e) {}
    V.speaking = false;
  },
};
const isVoiced = ev => !!ev && (ev.kind === 'ball' || ev.kind === 'special');
const evParts = ev => {
  let a = Voice.parts(ev.title).map(x => x);
  a = [{ t: Voice.plain(ev.title) + '.', who: null }].concat(Voice.parts(ev.desc));
  return a;
};
const resParts = (ev, r) => [].concat(...(r.lines || []).map(l => Voice.parts(l)));
const endParts = () => {
  const en = E.ENDBY[S.ending.id];
  return [{ t: Voice.plain(en.n) + '.', who: null }]
    .concat(Voice.parts('“' + en.q.replace(/[“”]/g, '') + '”'))
    .concat(en.body ? Voice.parts(en.body) : [])
    .concat(Voice.parts(en.moral ? L('Moral: ', 'Morale : ') + en.moral : ''));
};
const listenBtn = () =>
  PREF.voice && Voice.ok()
    ? `<button class="btn ghost small" data-act="listen" aria-label="${t('Listen')}">🔊 ${t('Listen')}` + `</button>`
    : '';
