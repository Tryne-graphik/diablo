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
- [ ] **2. Filtre Leveling** (ECHEC 2026-10-01 : Legendaires/Uniques caches, Mythiques visibles ; en attente du code du filtre a decoder ; 2026-10-03 : code perdu, l'utilisateur a fait d'autres filtres Demoniste qui se comportent bien - a re-tester seulement si le cas revient) : même page, assistant → « Je monte de niveau ».
      Légendaires toujours visibles, Rares avec 2-3 stats du build colorées,
      le reste caché.
- [ ] **3. Set de charmes** : les charmes du set du build ressortent en
      couleur (condition « set de charmes », identique à l'export de ta femme
      mais jamais vue en jeu sur un filtre généré). v3.49 : les 5 pièces du set en couleur + TOUS les charmes/sceaux visibles (Magiques/Rares compris). v3.50 : option 🧿 pour cacher les Magiques/Rares (vérifier les 2 cas).
- [ ] **4. Filtre depuis Maxroll ou kami-labs** : une règle par emplacement
      s'allume bien sur un objet qui a la stat (les ids « X2 » de ces sites
      sont rattachés par nom, pas encore vus en jeu).
- [ ] **5. Une autre classe** (ex. Druide ou Sorcier) : le filtre s'importe
      sans erreur et les règles ont du sens.
- [x] **6. Capture du Parangon avec un glyphe** (fait 2026-10-03 : rayon Manhattan confirmé sur 4 glyphes sur 5) : survoler un glyphe et noter
      « X / +40 <stat> (achat à l'intérieur de l'ensemble) » (comme la capture
      395 : 105 volonté pour Démonologue). Je compare avec mon calcul du rayon,
      dont la forme n'a jamais été vérifiée.

- [x] **12. Relevé en 1920×1080** (fait 2026-10-03, captures 582-602 : 46/47 affixes, fiche et fenêtre OK) (écran de ta femme ; à faire sur ton PC avec
      le Démoniste, jeu en 1920×1080, pour comparer au relevé du 03/10) :
      panneau Personnage sans infobulle ; les 10 pièces survolées (+ capture
      après « Faire défiler » si besoin) ; fiche « Caractéristiques et
      matériaux » page par page ; les 5 glyphes survolés (NIVEAU visible) ;
      talisman (facultatif). Ensuite me dire le premier numéro de capture.

## Par moi (Claude)

- [x] **7. Indice contre le classement** (fait : aucun lien démontré, voir HISTORIQUE du calculateur, suite 13) : les builds les mieux notés par
      l'indice vont-ils plus vite dans la Fosse (helltides) ? C'est le test qui
      dit si le « DPS » veut dire quelque chose.
- [x] **8. Démoniste, éléments non lus** (fait 2026-10-03 : rangs, aspect sadiques et Coup de chance lus ; gemme, rangs et pouvoirs de démon (saison) hors indice des deux côtés, score inchangé - voir HISTORIQUE du calculateur) : « +2 à Cri ardent », aspect
      « sadiques » des gants, multiplicateur feu/sacré du catalyseur, « Coup de
      chance », pouvoirs de démon primordial (captures 407-412).
- [x] **9. Ton vrai Parangon** (fait 2026-10-03, captures 449-459 : 14,6 % du guide Rank 1 Push) : pour l'instant c'est celui du guide qui sert
      d'approximation (avec tes vrais niveaux de glyphe).
- [ ] **10. Mots runiques sur Maxroll** dans le filtre (fait seulement pour IB).
- [ ] **11. Bit `arg4=36`** vu une fois dans un filtre Druide (faible risque,
      à revoir si on retrouve un filtre qui l'utilise).

## Ménage (toi)

- [ ] Supprimer `research/diablofilter-bulk-decode-latest.json` et
      `research/__pycache__` (créés par erreur le 2026-10-01).
