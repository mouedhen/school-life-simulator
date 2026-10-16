# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# School Life Simulator (marque « savepoint »)

Jeu de simulation de vie scolaire dans un **seul fichier HTML**, bilingue EN/FR. Pas de framework, pas de dépendances runtime (seules les polices Google Fonts sont chargées en ligne).
Version publiée en Artifact privé : https://claude.ai/artifact/QnwPwuyEGtGECqnJVYPfZi (v14 au moment de ce fichier).

## Commandes

Outillage : Node ≥ 22 uniquement (`npm install` une fois, puis `npx playwright install chromium` pour les tests navigateur).

- `npm run build` : assemble `src/*` en `dist/index.html` (~1 Mo). Ouvrir ce fichier dans un navigateur pour jouer. `npm run build:check` vérifie qu'il est à jour (CI).
- `npm run fr` : fusionne `tr/out_*.json` dans `src/fr.js` (fichiers lus par ordre alphabétique : une clé en double est écrasée par le fichier suivant). À relancer après toute modification des traductions, puis `npm run build`. `npm run fr:check` en CI.
- `npm test` (tests unitaires + golden master), `npm run test:e2e` (navigateur), `npm run lint` (ESLint + noms non définis/inutilisés entre les morceaux, `scripts/lint-bundles.mjs`), `npm run format`.
- **Déploiement** : `.github/workflows/pages.yml` publie `dist/` sur GitHub Pages à chaque push sur `main`/`master`. Il faut reconstruire et committer `dist/index.html`. Vérification du site en ligne : `SLS_URL=<url> python tests/live_check.py en|fr`.

## Architecture

`build.py` concatène dans cet ordre, dans un unique `<script>`/`<style>` :
`style.css` + `journal.css` → `data.js` → `talk.js` → `fr.js` → `i18n.js` → `src/engine/*.js` (dans l'ordre des noms, enveloppés dans une seule fonction) → `src/app/*.js` (idem).
Rien n'est importé : tout partage la portée globale du navigateur, l'ordre compte.

- `data.js` : personnages (40), lieux, boutique, jobs, rumeurs, événements.
- `talk.js` : dialogues.
- **Moteur** : `src/engine/01_core.js` … `14_api.js` (table des matières et règles dans `src/engine/README.md`). Ces fichiers ne sont pas des modules : ce sont des morceaux d'un même script qui partagent une portée, dans l'ordre des noms ; le code exécuté au chargement ne peut utiliser que les noms des fichiers précédents. `src/engine.js` n'est que le chargeur Node (tests, outils) : il assemble les morceaux comme `build.py`, avec une source map pour que les erreurs pointent vers le bon fichier. Dans la suite de ce document, « engine.js » désigne le moteur dans son ensemble. Moteur pur, sans DOM. RNG avec graine. DSL d'effets, ex. `fxs("p+2;r:T+6;f:FLAG")` (p = popularité, r:ROLE+n = relation, f:FLAG = drapeau). Fins de personnage décrites par `CHEND` et évaluées par `reqOk`. `checks(S)` / `BROAD` fixent la priorité : une fin de personnage n'apparaît en épilogue que si aucune fin générale ne se déclenche.
- **Interface** : `src/app/01_base.js` … `13_boot.js` (table des matières, état `S`/`V`, fonctionnement des clics dans `src/app/README.md`) : interface, journal, modales, réglages, son, voix, clavier. Mêmes règles que le moteur (morceaux d'un même script, ordre des noms). Dans la suite, « app.js » désigne l'interface dans son ensemble.
- `src/` ne contient que les fichiers du build (+ le chargeur Node `engine.js`). Les scripts de développement sont dans `tools/` (voir `tools/README.md`) : `tools/sim/` (simulations Node du moteur, encore utilisables) et `tools/archive/` (anciens correctifs et brouillons, plus maintenus). Les scripts Node chargent le moteur avec `require('../../src/data.js'); require('../../src/talk.js'); const E=require('../../src/engine.js')` puis `E.newGame(seed)`.

## Couche française

- Le texte source reste en anglais. `tr()` (dans `i18n.js`) traduit **phrase par phrase** via le dictionnaire `I18N` + règles `FRX`.
- Les clés sont **par phrase** (une description multi-phrases doit être découpée), les nombres deviennent `{n}`, les noms propres sont protégés.
- Les traductions vivent dans `tr/out_*.json` (glossaire dans `tr/glossary.md`) ; `src/fr.js` est généré, ne pas l'éditer à la main.
- Piège connu : un texte non traduit en FR = clé absente ou phrase non découpée.

## Systèmes de jeu

- **Vacances** : table `HOLIDAYS` (travail, action de grâce, hiver, printemps, Pâques, patriotes) + `HOL_BY_RET`. Un événement de type `holiday` se déclenche le premier jour d'école après la pause, puis enchaîne sur l'événement normal du jour. Choix posent des drapeaux `HOL_<id>` et des relations (`PARENTS`, `MOM`, `DAD`).
- **Fins** : 78 fins (71 + 7 fins téléphone `ph_*`, voir plus bas). L'ordre du tableau `BROAD` est l'ordre de priorité. Fins de personnage (`CHEND`) + fins générales (`BROAD`). Fins « durée » basées sur `S.lowStreak` / `S.lowMax` (popularité ≤ 30) ; e17/e18 exigent `lowMax >= 20`. Écran « Endings » séparé en Good / Hard avec morales ; indices via `ENDBY`.
- **Journal** : pages à écriture manuscrite (Dancing Script / Patrick Hand), `jPageHtml` puis `jFit` : réduit la police jusqu'à 0.88, masque les éléments optionnels (`data-opt` 1/2/3), puis réduit jusqu'à 0.62. Refit après chaque retournement de page et au chargement des polices. `.pg .inner` a `overflow:hidden`.
- **Voix** : `speechSynthesis` du navigateur (synthétique, pas de comédiens), pour le bal, les événements « special » et les fins ; hauteur/voix selon le genre du locuteur ; bouton « Listen ».
- **Musique** : module `Music` dans `app.js`, générée en direct (WebAudio, aucun fichier). 3 ambiances en fondu : `calm` (classe), `bright` (bal, congés, bonnes fins), `dark` (popularité ≤ 30, mauvaises fins), choisies par `musMood()`. Démarre au premier clic ; réglage `PREF.mus`.
- **Musique (ambiances)** : `calm`, `bright`, `exam` (mini-jeux / titres contenant exam, test, quiz…), `win`, `sad` (fins bonnes / difficiles), `dark`, et `menu` (connexion, titre, parties sauvegardées).
- **Son** : bouton 🔊 dans le HUD et sur l'écran titre (touche **M**), `PREF.muted` ; curseurs de volume `PREF.vm` (musique), `vs` (effets), `vv` (voix) dans Réglages.
- **Tutoriel** : `TUT()`, visite en 6 étapes à la toute première partie (`prefs.tut`), rejouable depuis Aide.
- **Statistiques et succès** : `showStats()`, `ACH()` (13 succès calculés à partir de `prefs.runs` / `prefs.seen`), toast à chaque nouveau succès.
- **Rejouabilité** : choix de départ `TRAITS()` (Équilibré, Bûcheur, Social, Débrouillard, Surprends-moi) via `applyTrait()`, et bonus Nouvelle partie+ si des parties précédentes existent.
- **Cuisine** (`engine.js` : `RECIPES`, `cook()`, `cookLevel()` ; `app.js` : `kitchenHtml()`, `showCook()`) : onglet Travail. 5 recettes débloquées par la relation avec Mom (0/25/50/75/100). À Mom = 100, événement « Le couteau de cuisine » (`HOLIDAYS.knife`, objet permanent `Cooking knife`) qui débloque le plat signature. Cuisiner pour soi, la famille ou un ami coûte 1 bloc + des ingrédients et monte la relation. Événement scolaire `SPECIAL.showcase` le 23 avril 2027. Traductions FR : `tr/out_d5.json`.
- **Famille** (`BONDS`, `bond()`, `GIFTS` dans `engine.js` ; `familyHtml()`, `showBond()` dans `app.js`) : onglet Travail, section « En famille ». Dad, Riley, Max, Oliver et Sophie ont chacun 5 activités débloquées à 0/25/50/75/100 de relation (1 par jour par personne). À 100, scène-cadeau (`HOLIDAYS.gift_*`) avec un objet permanent : boîte à outils de Dad (petits boulots +2 $), carte cachée de Riley (sauve une fois d'une POP à 0), manette de Max (+1 indice aux quiz), blouson d'Oliver (+4 POP, meilleures chances d'équipe), agenda de Sophie (étude +5 % de préparation). Traductions : `tr/out_d6.json`.
- **Actes des PNJ** (`engine.js` : `npcActs`, `npcPick`, `npcEvent`, type d'événement `npc`, étiquette « Rencontre ») : le soir (après anniversaires et scène « la famille remarque », avant l'imprévu), ~17 % par soir avec 2 jours minimum d'écart, cooldown 6 jours par personne (`S.cool2`). Selon la relation : compliment (≥10), cadeau (≥25 ; objet via `c.get`, ou +5 $ de Dad), invitation (≥20), « tu surprends X qui parle bien de toi » (≥45), « on te rapporte que X parle dans ton dos » (≤5 et déjà interagi). Aussi : demande de conseil (≥15), emprunt de 5 $ (≥15 et <60, crée un prêt dans `S.loans`), éloge d'un prof (≥14). **Suites** (`S.follow`, 3 jours plus tard) : excuses de la personne si tu lui as parlé calmement (`apology`), ou « tes mots voyagent » si tu as répliqué méchamment (`echo`). « Demander à un ami » (`c.check`) : 60 % malentendu (+3), sinon −1 POP. Les cadeaux reçus sont suivis dans `S.giftFrom` et affichés sur le profil. Interrupteur de test : `globalThis.__NO_NPC`. Traductions : `tr/out_d7.json`, `out_d8.json`.
- **Mystère Joueur / MC** : le joueur croit être MC, mais le journal contient de l'**encre presque invisible** (classe `.fink`, opacité .07, révélée au survol, au focus ou au toucher). Les anciennes notes « — P. » du journal sont maintenant cette encre (id `n:<date>`), plus des indices dans l'interface (`k1` Aide, `k2` Réglages, `k3` Stats, `k4` Boutique, `k5` Calendrier, `k6` Famille, `k7` écran de fin, `k8` écran titre après 6 indices). Les indices sont **persistants entre les parties** (`prefs.clues`) ; `clueN()` = indices fixes + paliers de notes (2/5/9) ; `S.meta.clues` est synchronisé par `metaSync()`.
  - Étapes (`mystStage`) : <3, 3–5, 6+. Les **pensées de MC** (`mcThought`, ex. « Je n'ai pas l'impression d'avoir le contrôle ») apparaissent après un événement et dans le journal (`S.th`). La signature « — P. » n'apparaît qu'à 6+ indices ; la première note du journal dit « Can you read this? » avant 3 indices.
  - Chaque indice trouvé pendant une partie augmente `S.strange` ; aux seuils 1/3/5/7 (`NOTICE_AT`) un membre de la famille **remarque** (événement `notice`, 4 niveaux).
  - À **9 indices** (`REVEAL_AT`) : événement spécial `reveal` (« La page s'amincit »), une seule fois (`REVEAL_DONE`), entre le 14 sept. et le 10 juin hors jours clés. Ensuite l'encre reste visible (`prefs.revealed`). Succès « Encre pâle » et « Qui tient le stylo ? » (description cachée).
  - **Premier indice** : tant qu'aucune encre n'a été trouvée, une petite **tache d'encre** (`.blot`) est visible à côté de « savepoint » sur l'écran titre (indice `k0`) et au début des notes du journal ; la ligne pointillée sous la note reste aussi visible. La tache disparaît après la première trouvaille. Les indices trouvés sont listés dans Stats. Total : 9 indices fixes (`k0`–`k8`) + 3 paliers de notes = 12 ; la révélation se déclenche à 9.
  - Réglage « Contraste du texte pâle » (`PREF.ink`) : option d'accessibilité qui rend l'encre lisible sans la trouver à la place du joueur.
- **Réglages** (`PREF{ink,fs,rm,snd,voice,mus,muted,vm,vs,vv}`) : taille du texte (classes `body.fs1/fs2`), mouvement réduit (`html.rm`), son (synthé WebAudio `SFX`), voix, aide clavier (`onKey`), focus visible.

## Contraintes et préférences de l'utilisateur

- Langue de travail : français pour les échanges ; le jeu doit rester entièrement jouable en EN et en FR.
- Garder le jeu en un seul fichier HTML autonome.
- Dépôt GitHub **privé** (`mouedhen/school-life-simulator`).
- Optimiser le travail quand il faut répliquer un même écran : moins d'appels MCP, moins de jetons.
- Ne jamais saisir de mots de passe ou identifiants à la place de l'utilisateur.

## Points ouverts

1. **Figma** : passer l'argent de départ de 20 $ à 50 $ (aussi dans le jeu si voulu) et resynchroniser le prototype Figma (Welcome + Jour 1 en 4 variantes : sombre/clair × EN/FR). Il manque le **lien du fichier Figma**.
2. **Relecture du français** : la couche FR est traduite automatiquement ; une personne francophone native doit la tester (prévu).
3. Équilibrage : des bots aléatoires atteignent 58 fins sur 71 ; les autres sont atteignables en jouant volontairement (saint, e60, e17 vérifiés). Aucun réglage fait.

## Tests

Le dossier `tests/` contient les vérifications (voir `tests/README.md`) : **`node tests/golden.js`** (golden master : doit afficher `OK` après toute refactorisation pure ; `record` seulement après un changement de gameplay voulu), **`python tests/ui_snapshot.py`** (golden master de l'interface : 118 écrans EN/FR, ~80 s ; même règle pour `record`), `node tests/engine_smoke.js` (moteur), `node tests/endings_cov.js 600` (couverture des fins ; `NO_NPC=1` pour comparer sans les actes des PNJ), `python3 tests/ui_smoke.py en|fr` (navigateur : rencontres, encre, scènes de la famille et de révélation), `python3 tests/stress.py en|fr 1 4` (années complètes), `python3 tests/fr_miss.py` (chaînes sans traduction française), `python3 tests/phone_smoke.py en|fr`, `python3 tests/phone_games.py en|fr` (~40 s), `python3 tests/live_check.py en|fr`. Les tests navigateur demandent Playwright + Chromium (`CHROMIUM=/chemin` sinon). À lancer après `python3 build.py`. Mesure de référence (2 500 parties de bots) : 59/71 fins atteintes avec ou sans les actes des PNJ ; argent/POP/note moyens à ±1 point.

## Décisions

- Le « Joueur » est un secret : MC doute (pensées), l'encre pâle est l'indice, la famille remarque quand on la cherche, la révélation dit au joueur réel que c'est lui qui tient le stylo. Ton doux, jamais effrayant (jeu scolaire, enfants).
- Plan d'illustrations IA abandonné par l'utilisateur (trop long) ; seule la fiche de Maman a été testée via Figma `generate_image`. Aucun fichier d'art dans le projet.
- Pas de système pour tuer des personnages (école, personnages mineurs, ton du jeu). Idée d'un ami de l'utilisateur, transformée en mécanique de **cuisine** avec Mom.


## Added later
- **Avatars**: `avatar(name, size)` in app.js draws a simple procedural SVG face (hash of the name picks skin, hair, eyes, glasses, bow). Used in the People list and profile. No image files.
- **Run summary**: Menu/Settings/ending screen -> "Copy run summary" (`summaryText()`), a short text the tester pastes into a message. Includes stats, ending, clues, screen type.
- **Note for MC**: after the reveal (`V.revealed`), Settings/ending offer "Note for MC" (120 chars, stored in `prefs.note`). Next run copies it to `S.note`; `memLine(0)` writes it into the day-1 diary (FR rule in i18n.js).
- Tests added: `old_save.py` (old save compatibility) and `touch_ink.py` (touch emulation).
- **Phone (core)**: engine `PHONE_ACTS`, `phoneList`, `phoneAct`, `phoneReply`, `phoneIncoming` (engine.js, before "rumor lookup"). Texting runs `interact()` with `S._ph=1` (cost 0, gains x0.7, apology -2), capped at `PHONE_CAP`=4 texts/day, askmoney once per 3 days. `PHONE_HIDE` removes the replaced in-person options from the People profile (the engine functions still exist for bots/tests). Threads live in `S.phone.th[name]` (max 24 msgs), unread in `S.phone.un`. Incoming texts are generated in `endDay()` (about 50%/day) with quick replies (effect strings). The "Unknown number" thread (from day 4) holds two faint-ink clues `k9`,`k10` (clue total is now 14; REVEAL_AT is still 9). UI: `phoneHtml()` in app.js, header button, Today button, profile "Text" button. Minigames are the planned next step.
- **Phone extras**: `phoneOff(S)` (about 1 day in 12 the phone is off: texts, games and group posts are locked and the in-person options come back in the profile). Group chats `#class` and `#fam` (`GROUPS`, `GC_ACTS`, `phoneGroupAct`, `phoneGroupIncoming`): posts use the shared 4-text cap; incoming gossip/family messages have quick replies with `m.T` as the target. Minigames in app.js (`pgStart`, `pgAnswer`, `pgFinish`, data `RF`, `WS`, `EM`) and rewards in engine `phoneGame` (one play per game per day; rewards limited by `PG_GAP` days: reply 1, who 4, emoji 6, tap 6; money max $3 per prize). The emoji game hides clue `k11` on a perfect score (clue total is now 15).
- **Phone endings (7, ids `ph_*`)**: `ph_screen` (520+ texts, 3 or fewer hangouts), `ph_keeper` (60+ group posts, 6+ defences, 1 or no laugh-along, POP 45+), `ph_screenshot` (5+ laugh-alongs, 2 relationships below -20), `ph_read` (6+ ignored cold messages), `ph_line` (reveal seen, 12+ clues, 100+ texts), `ph_score` (100+ games, 40+ perfect), `ph_face` (25 texts or fewer, 20+ hangouts, 7+ friends at +40). Counters in S: `phoneN gcN gcDef gcLaugh phIgn pgN pgPerf`. They sit in `BROAD` after `saint` (the distinctive ones) and before `crown` (score/face). Ending total is now 78. Threshold changes: re-run `PHONE=1 node tests/endings_cov.js 1500` (a heavy-phone bot gets a phone ending as primary in about 20% of runs; no-phone bots about 2%).
- **Meeting people** (engine.js, `S.met`, `isMet`, `metKids`, `metOf`, `meet`, `introCheck`): a new game knows the 6 family members, Maya and 7 more classmates (seeded). `S.order` holds the other 22 in a seeded order. `introCheck` (called from `buildEvent` for day events) introduces the next one every `INTRO_GAP`(3) + 0-2 days, only on a day whose choices involve the target kid (`T`), and `makeCtx` makes that person `T` that day. All 30 classmates are met by about day 100-130. Teachers are met when their class event appears. Unmet people are left out of `makeCtx`, ball picks, NPC acts, phone threads and group chats (`phoneCan`), the People tab, and every relationship-ranked list in app.js (use `E.metKids(S)`). Old saves without `S.met` know everyone. The day event shows a "New contact" banner (`ev.met`) and the diary writes "I met X today" (rule in i18n.js). The People tab also says how many of the 40 you know.
- **People sort** (`V.sort`, `SORTS`, `data-act="sort"`): Default, Most popular / Least popular (`c.pop`, family and teachers have none so they go last), Best / Worst relationship. Works with the All/Classmates/Family/Teachers filter and the search box.
- **Event items** (engine.js `EVENT_ITEMS`, `itemLocked`): 14 shop items that stay locked (shown as "🔒 ???" with a vague hint) until an event sets their flag, for example CLUB_MEMBER -> Club badge, RETURNED_WALLET -> Lost-and-found scarf, STOOD_UP -> Brave badge. `applyFx` adds an `unlock` chip the first time the flag is set. `buy()` refuses locked items. They are plain `gift` or `cosmetic` items, so no new item logic.
- **Item icons** (app.js `ICON`, `KIND_ICON`, `itemIcon`): an emoji per shop item, shown in the shop, bag and gift picker; the family keepsakes have icons too.
- Tests: `tests/people_shop.py en|fr` and new engine_smoke cases. French strings for the new items are in `tr/out_d10.json`. `ph_face` now needs 7 friends at +40 (was 8) because people are met later.
