# School Life Simulator (savepoint)

Jeu de simulation de vie scolaire en un seul fichier HTML, bilingue EN/FR.

- `src/` : moteur (`engine.js`), interface (`app.js`), données (`data.js`), dialogues (`talk.js`), couche française (`i18n.js`, `fr.js`), styles.
- `tr/` : traductions françaises et glossaire (`python3 mergefr.py` régénère `src/fr.js`).
- `build.py` : assemble le tout dans `dist/index.html` (`python3 build.py`).
- `dist/index.html` : le jeu complet, à ouvrir dans un navigateur.
