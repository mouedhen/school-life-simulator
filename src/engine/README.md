# Engine (`src/engine/`)

Pure game logic, no DOM. It needs `globalThis.DATA` (`data.js`) and, optionally, `globalThis.TALK` (`talk.js`). Everything the UI and the tests use is the object `E` built in `14_api.js` (`globalThis.Engine` in the browser, `require('./src/engine.js')` in Node).

## How the files fit together

The files are **not modules**: they are pieces of one script and share one scope, in file-name order. A name defined in one file (`const`, `function`) is visible in every other file.

- **Browser**: `build.py` pastes them, in order, inside a single `(function () { ... })()`.
- **Node**: `src/engine.js` runs each file as a script in the same global scope. Stack traces show the real file and line.

Rule: code that runs **at load time** (top level, outside a function) may only use names from the same file or an earlier one. Code inside functions can use anything.

To add a file, give it a number that places it in the right order. Both `build.py` and `src/engine.js` pick up every `src/engine/*.js` in name order.

## Table of contents

| File | Sections | What it does |
| --- | --- | --- |
| `01_core.js` | core lookups, rng, effect DSL, calendar | `CH`, `KIDS` / `FAM` / `TEACH`; seeded random (`rnd(S)` advances `S.rs`); `fxs("p+2;r:T+3?.5;f:FLAG")` → effect list; `DAYS` |
| `02_content.js` | random events, special events, holidays, shop, jobs, interaction catalogue, links | Content tables: `RAND`, `SPECIAL`, `HOLIDAYS`, `SHOP`, `JOBS`, `INTER`, `LINKS` |
| `03_state.js` | state, meeting people, start of a day | `newGame()` and the shape of `S`; known classmates (`S.met`); time blocks and the day's opening event |
| `04_mystery_npc.js` | the Player mystery, NPC acts | MC's doubts (`THOUGHTS`), the family noticing; people coming to you (compliments, gifts, gossip, follow-ups) |
| `05_effects.js` | relationships, day context, applying effects | `addRel()` with ripple; `makeCtx()` (who is Target / Helper / Classmate…); `applyFx()`, game over by POP |
| `06_events.js` | building events, personal events | `buildEvent()`: turns `S.pend` into the event the UI shows |
| `07_choices.js` | choosing, ball invitation, the Ball, after an event | `choose()` (study check, cheating, team game), the Ball night, what comes next |
| `08_day.js` | day flow, free-time actions | `endDay()`, evening events, `advance()`, end of year; `study`, `work`, `buy` |
| `09_family.js` | family bonds, cooking, items and gifts | `BONDS`, `RECIPES`, `cook()`, `useItem()`, `giveGift()` |
| `10_interactions.js` | interactions | `interactionList()`, `interact()` (one function per action), rumours |
| `11_endings.js` | endings | `ENDINGS`, `stats()`, `CHEND` (character endings), `checks()`, `BROAD` priority, `evaluateEnding()` |
| `12_quiz.js` | quiz mini-games | `quiz()`: questions for exam / test / quiz days |
| `13_phone.js` | phone, group chats, phone minigames, rumour lookup | Texting, incoming texts, `#class` / `#fam`, minigame rewards, `rumorsFor()` |
| `14_api.js` | public API | The object `E` |

## Rules for changing the engine

- English strings are translation keys for the French layer (`tr/out_*.json`, one key per sentence). Changing a sentence means adding its French translation too (`python tests/fr_miss.py` lists missing ones).
- Every random draw goes through `rnd(S)` (or a local `mul()` generator seeded from `S.seed`), so a game is reproducible from its seed.
- A pure refactor must keep `node tests/golden.js` at `OK`. After a deliberate gameplay change, re-record it (`node tests/golden.js record`) and commit the new `tests/golden.json`.
- Fields of `S` are saved as is: do not rename them, and give new ones a default for old saves (`python tests/old_save.py`).
