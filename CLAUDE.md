# DiabloIV-Assistant

Userscript Tampermonkey (traduction EN->FR des guides, filtre de butin natif D4, classement
consensus) + serveur local FastAPI (`app/`). Depot : github.com/Tryne-graphik/diablo (pousse).
Journal : `HISTORIQUE.md` (lire la DERNIERE section `## 2026-` en reprise).
A tester / a faire : `A_VERIFIER.md`.

## Fichiers cles
- `userscript/diablo4-assistant.user.js` : le script (un seul fichier, `@version` a monter a chaque changement).
- `app/` : serveur local (`lancer.bat` ou `python -m app.main` -> http://127.0.0.1:8000), scrapers des 6 sites, `loot_filter/`.
- `google-apps-script/feedback-collector.gs` : retours + "Mes filtres" (Google Sheet). Apres modif, l'utilisateur doit le recoller et redeployer.
- `research/` : decodages de filtres, scripts jetables.

## Pieges connus
- Modifier le .user.js sur disque ne met PAS a jour Tampermonkey : l'utilisateur recolle ou passe par la MAJ GitHub.
- Tests hors jeu : bac a sable Node / Playwright depuis le scratchpad, jamais dans le depot. Tuer les process Playwright apres usage (un orphelin a deja ecrase le userscript).
- Ne jamais importer `research/bulk_decode.py` (s'execute a l'import).
- Ne jamais ouvrir de fenetre de test quand l'utilisateur joue.
- Projet frere : `E:\DevProject\DiabloIV-DPS-Calculator`.
