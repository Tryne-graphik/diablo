# A vérifier (Assistant + calculateur de DPS)

Liste établie le 2026-10-01. Cocher `[x]` au fur et à mesure ; on continue les
nouvelles fonctions une fois la partie « En jeu » faite.

## En jeu (toi)

Avant tout : importer la **v3.47** dans Tampermonkey (Utilitaires → importer le
fichier `userscript/diablo4-assistant.user.js`) et vérifier que la version
affichée est bien 3.47.

- [x] **1. Filtre Endgame + plastron runique** (OK en jeu le 2026-10-01 : v3.47, nom [IB] garde, 24 regles ; regle de base retiree en v3.48, inutile selon l'utilisateur) : sur IB Mekuna « Rank 1 Push »
      (`...rn824uhPl3?variant=v-mu6fct5o-a3knx`), assistant → « Endgame ».
      Le code s'importe, le nom est gardé, et un **plastron blanc ancestral**
      au sol reste visible (règle « Base runique - Torse »). Énigme/Discrétion
      ne se lootent pas : ils se fabriquent au Cube Horadrique avec ce
      plastron blanc (Normal) + les runes (Énigme = Jah + Ith + Ber,
      Discrétion = Tal + Eth). La règle garde donc l'ingrédient, pas l'objet.
- [ ] **2. Filtre Leveling** : même page, assistant → « Je monte de niveau ».
      Légendaires toujours visibles, Rares avec 2-3 stats du build colorées,
      le reste caché.
- [ ] **3. Set de charmes** : les charmes du set du build ressortent en
      couleur (condition « set de charmes », identique à l'export de ta femme
      mais jamais vue en jeu sur un filtre généré).
- [ ] **4. Filtre depuis Maxroll ou kami-labs** : une règle par emplacement
      s'allume bien sur un objet qui a la stat (les ids « X2 » de ces sites
      sont rattachés par nom, pas encore vus en jeu).
- [ ] **5. Une autre classe** (ex. Druide ou Sorcier) : le filtre s'importe
      sans erreur et les règles ont du sens.
- [ ] **6. Capture du Parangon avec un glyphe** : survoler un glyphe et noter
      « X / +40 <stat> (achat à l'intérieur de l'ensemble) » (comme la capture
      395 : 105 volonté pour Démonologue). Je compare avec mon calcul du rayon,
      dont la forme n'a jamais été vérifiée.

## Par moi (Claude)

- [x] **7. Indice contre le classement** (fait : aucun lien démontré, voir HISTORIQUE du calculateur, suite 13) : les builds les mieux notés par
      l'indice vont-ils plus vite dans la Fosse (helltides) ? C'est le test qui
      dit si le « DPS » veut dire quelque chose.
- [ ] **8. Démoniste, éléments non lus** : « +2 à Cri ardent », aspect
      « sadiques » des gants, multiplicateur feu/sacré du catalyseur, « Coup de
      chance », pouvoirs de démon primordial (captures 407-412).
- [ ] **9. Ton vrai Parangon** : pour l'instant c'est celui du guide qui sert
      d'approximation (avec tes vrais niveaux de glyphe).
- [ ] **10. Mots runiques sur Maxroll** dans le filtre (fait seulement pour IB).
- [ ] **11. Bit `arg4=36`** vu une fois dans un filtre Druide (faible risque,
      à revoir si on retrouve un filtre qui l'utilise).

## Ménage (toi)

- [ ] Supprimer `research/diablofilter-bulk-decode-latest.json` et
      `research/__pycache__` (créés par erreur le 2026-10-01).
