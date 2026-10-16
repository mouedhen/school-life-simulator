# User interface (`src/app/`)

Everything the player sees: screens, tabs, modals, sound, journal, phone. The game rules live in the engine (`src/engine/`, `window.Engine`, called `E` here); the UI only draws and reacts to clicks. Do not call engine functions "just to look": many of them advance the seeded random generator.

## How the files fit together

The files are **not modules**: they are pieces of one script and share one scope. `build.py` pastes them in file-name order inside a single `(function () { ... })()`, after `data.js`, `talk.js`, `fr.js`, `i18n.js` and the engine. A name defined in one file is visible in all the others. Code that runs **at load time** (top level, outside a function) may only use names from the same file or an earlier one.

There is no Node version of the UI: test it in the browser (`python build.py`, then the Playwright tests in `tests/`).

## Key ideas

- **Two states.** `S` is the saved game (engine state). `V` is the UI state, never saved: open tab and modal, sort/filter, current event and result, minigame and journal positions. `V`'s fields are listed where it is declared (`03_state.js`).
- **Drawing.** `render()` (`04_render.js`) rebuilds `#root` from the current tab's view function, then `renderModal()` draws the overlay. There is no partial update.
- **Clicks.** Every button has `data-act="<action>"` (often `data-v="<value>"`). `onClick()` looks the action up in the `ACTIONS` table (`12_input.js`, grouped by area). To add a button: add a `data-act` in the HTML and a handler in `ACTIONS`.
- **Text.** English strings are keys of the French layer. `tr()` / `esc()` translate engine sentences, `t(key)` and `L(en, fr)` pick UI words. Changing an English sentence breaks its French translation.

## Table of contents

| File | Sections | What it does |
| --- | --- | --- |
| `01_base.js` | helpers, i18n, preferences | `$`, `tr`, `ea`, `esc`; `FR` table, `L(en, fr)`, `t(key)`, `LANG`, theme; `PREF`, accessibility, `savePrefs` |
| `02_audio.js` | sound effects, background music, voice | `SFX` (WebAudio clicks), `Music` (live moods, `musMood()`), `Voice` (speech) |
| `03_state.js` | icons, storage, app state | Nav icons; `Store` (localStorage + Claude-account saves, prefs, autosave); `S`, `V`, chips, `toast` |
| `04_render.js` | render shell, faint ink mystery, Today tab | `hud`, `nav`, `render()`; clue ink (`inkHtml`, `revealInk`); `viewToday` |
| `05_journal.js` | journal: text, pages, book | Diary lines and memories, day and ending pages, spreads, page flips, `jFit` |
| `06_tabs.js` | avatars, People, Shop, Work, Calendar, Menu | `avatar()`, `viewPeople` (sorts), `viewShop`, kitchen / family / jobs, `viewCal`, `viewMenu` |
| `07_events.js` | modals, school minigames, events | `openModal` / `closeModal` / `renderModal`; memory and quiz games; `showEvent`, `resultHtml`, `afterEvent` |
| `08_progress.js` | run records, tutorial, traits, achievements | `recordRun`, `TUT`, `TRAITS` / `applyTrait`, `ACH`, `showStats` |
| `09_screens.js` | person profile, screens, dialogs | `showPerson`; login, title, game over, ending screens; saved games, endings book |
| `10_phone.js` | phone, phone minigames, chats | Unread badge, texts left; the four phone games; group chats and threads, `showPhone` |
| `11_settings.js` | run summary & note, settings & help | `summaryText`, note for MC, `showSettings`, `showHelp` |
| `12_input.js` | game start, click actions, keyboard | `startNew`, `beginGame`, `doInter`; the `ACTIONS` table and `onClick`; `onKey` |
| `13_boot.js` | boot | Event listeners, prefs loading, first render, `window.__dbg` for tests |

## Checks after a change

- Pure refactor: `python tests/ui_snapshot.py` must stay at `ALL PASSED` (118 screens, EN and FR).
- Any change: `python tests/ui_smoke.py en` and `fr`, plus the test of the area you touched (see `tests/README.md`).
