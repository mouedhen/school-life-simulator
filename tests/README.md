# Tests

Run everything from the project root after `python3 build.py` (the UI tests read `dist/index.html`).

| Command | What it checks |
| --- | --- |
| `node tests/engine_smoke.js` | Engine only: 40 seeded years run without errors; NPC acts, family "notice" scenes and the one-time reveal fire as designed; follow-ups (apology/echo), loans and gift tracking work. |
| `node tests/endings_cov.js 600` | Ending coverage and average money/pop/grade. Run with `NO_NPC=1` to compare with the NPC acts switched off (expected: within about 1 point, same ending count). |
| `python3 tests/ui_smoke.py en` / `fr` | Browser (Playwright): plays 120 days, checks NPC encounters, faint ink hover/persistence, the blot hint, notice and reveal scenes, Settings/Help/Stats ink lines, no page errors. |
| `python3 tests/stress.py en 1 4` | Full-year bot runs through the real UI (seed range), fails on any page error or if no ending is reached. Use `fr` for French. |
| `python3 tests/phone_smoke.py en` / `fr` | Phone UI: list, unread badge, free texting, daily cap, quick replies, unknown-number ink clue, profile shows Text button. |
| `python3 tests/phone_games.py en` / `fr` | Group chats, the four minigames (reply, who, emoji, bubbles), daily limits, and no-phone days (takes ~40 s). |
| `python3 tests/old_save.py` | Builds a mid-year save, strips every newer field (meta, follow, giftFrom, strange, note...), loads it via Continue and plays it to an ending in EN and FR. |
| `python3 tests/touch_ink.py` | Emulated phone with real touch events: tapping the title blot and the faint ink in the real journal reveals it and stores the clue. |
| `python3 tests/fr_miss.py` | Harvests every new event string from the engine and fails if any has no French translation. |

Needs: Node 18+, Python 3, `pip install playwright` and a Chromium (`CHROMIUM=/path/to/chromium` if it is not the default).
