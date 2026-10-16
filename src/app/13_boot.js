/* app/13_boot.js — Startup (boot) and the debug hooks used by tests. */
'use strict';
/* ---------- boot ---------- */
async function boot() {
  const root = $('#root');
  let jx = null;
  document.addEventListener(
    'touchstart',
    e => {
      if (e.target.closest && e.target.closest('.spread')) jx = e.touches[0].clientX;
      else jx = null;
    },
    { passive: true },
  );
  document.addEventListener(
    'touchend',
    e => {
      if (jx == null) return;
      const dx = e.changedTouches[0].clientX - jx;
      jx = null;
      if (Math.abs(dx) > 45) jFlip(dx < 0 ? 1 : -1);
    },
    { passive: true },
  );
  document.addEventListener('keydown', onKey);
  const fk = e => {
    const t0 = e.target;
    if (!t0 || !t0.closest) return;
    const r = t0.closest('[data-reveal]');
    if (r) {
      const id = r.dataset.reveal;
      V.clues = V.clues || {};
      if (!V.clues[id]) {
        const ph = document.createElement('span');
        ph.dataset.clue = id;
        revealInk(ph);
        render();
      }
      return;
    }
    const k = t0.closest('.fink');
    if (k) revealInk(k);
  };
  document.addEventListener('mouseover', fk);
  document.addEventListener('focusin', fk);
  document.addEventListener('click', fk);
  document.addEventListener('input', e => {
    const k = e.target && e.target.dataset && e.target.dataset.vol;
    if (k) {
      PREF[k] = +e.target.value;
      applyVol();
    }
  });
  document.addEventListener('change', e => {
    const k = e.target && e.target.dataset && e.target.dataset.vol;
    if (!k) return;
    savePrefs();
    if (k === 'vs') SFX.chime();
    else if (k === 'vv') Voice.say([{ t: L('This is how I sound.', 'Voici ma voix.'), who: null }]);
  });
  document.addEventListener('click', e => {
    if (!e.target.closest('#ov')) onClick(e);
  });
  document.addEventListener('input', e => {
    if (e.target.id === 'q') {
      V.q = e.target.value;
      const pos = e.target.selectionStart;
      render();
      const q = $('#q');
      if (q) {
        q.focus();
        q.setSelectionRange(pos, pos);
      }
    }
  });
  try {
    if (document.fonts) {
      document.fonts.ready.then(() => {
        if ($('#spread')) jFit($('#spread'));
      });
      document.fonts.addEventListener('loadingdone', () => {
        if ($('#spread')) jFit($('#spread'));
      });
    }
  } catch (e) {}
  await Store.init();
  const p = await Store.prefs();
  V.clues = p.clues || {};
  V.revealed = !!p.revealed;
  if (p.ink != null) PREF.ink = p.ink;
  if (p.lang) LANG = p.lang;
  if (p.theme) THEME = p.theme;
  if (p.fs != null) PREF.fs = p.fs;
  if (p.rm != null) PREF.rm = p.rm;
  if (p.snd != null) PREF.snd = p.snd;
  if (p.voice != null) PREF.voice = p.voice;
  if (p.mus != null) PREF.mus = p.mus;
  if (p.muted != null) PREF.muted = p.muted;
  if (p.vm != null) PREF.vm = p.vm;
  if (p.vs != null) PREF.vs = p.vs;
  if (p.vv != null) PREF.vv = p.vv;
  applyTheme();
  applyA11y();
  V.seen = p.seen || [];
  V.prefName = p.name || '';
  V.gate = true;
  const m = await Store.metas();
  if (m.auto && !m.auto.over && !m.auto.ending) {
    V.hasAuto = true;
    V.autoInfo = `${fmtDate(m.auto.date)} · POP ${m.auto.pop} · $${m.auto.money}`;
  }
  render();
}
window.__dbg = { jPageHtml, JN: () => JN(), jFit, render: () => render() };
window.addEventListener('DOMContentLoaded', boot);
