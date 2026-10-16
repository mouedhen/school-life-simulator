# Tools

Development scripts. None of them is part of the game build (`build.py` only reads `src/`).

## `sim/` — engine simulations (Node)

Run from anywhere, e.g. `node tools/sim/sim2.js`. They load `src/` directly.

| Script | What it does |
| --- | --- |
| `sim.js`, `sim_st.js` | Balance runs with a few bot personalities. |
| `sim2.js`, `cov.js` | Ending coverage (prints the endings never reached). `NO_NPC=1` turns the NPC acts off in `cov.js`. |
| `sim3.js` | "Hermit" player who never talks to anyone. |
| `dbg.js` | One seeded run; counts the actions used and prints popularity over time. |
| `kinds.js` | One seeded run; lists the event kinds and titles met. |

The maintained versions of these checks are in `tests/` (`endings_cov.js`, `golden.js`).

## `archive/` — historical, not maintained

Kept for reference only; they no longer run as is.

- `patch1.py`, `patch2.py`, `patch3.py`: one-off text replacements already applied to `engine.js`.
- `ball.js.txt`, `fp.txt`: earlier drafts of the Ball scenes and of the family/teacher personal events, now in `engine.js` and `talk.js`.
- `keys.js`, `lits.js`: the first harvest of English strings for the French layer. `tests/fr_miss.py` replaces them.
