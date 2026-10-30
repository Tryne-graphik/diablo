# Inventaire des doublons (par contenu)

## A. Dictionnaires FR/EN
- Assistant : 12551 entrees (5670 cles EN uniques).
- Calc affixes_en_fr : 904 cles EN uniques.
- Cles communes : 51 ; **conflits (aucune traduction FR en commun) : 47** ; partiels (FR differents mais recouvrement) : 0.
- Propres Assistant : 5619 ; propres Calc : 853.
- Cles EN a plusieurs FR DANS l'Assistant seul : 101.
- item_names_fr : {"note": "listes de NOMS sans paires EN/FR : pas de conflit possible, seulement recouvrement", "items": 8020, "descriptors": 3154, "items_dans_assistant_fr": 3641, "items_dans_assistant_en": 15, "items_hors_assistant": 4376, "descriptors_dans_assistant": 91}

  - conflit `attack speed` : assistant=["vitesse d'attaque"] / calc=["a la vitesse d'attaque"]
  - conflit `maximum resource` : assistant=['ressource maximale'] / calc=['de maximum de ressource']
  - conflit `damage reduction` : assistant=['reduction des degats'] / calc=['de reduction des degats']
  - conflit `shadow resistance` : assistant=["resistance a l'ombre"] / calc=["de resistance a l'ombre"]
  - conflit `maximum life` : assistant=['vie maximale'] / calc=['maximum de vie augmente de']
  - conflit `energy regeneration` : assistant=["regeneration d'energie"] / calc=['de regeneration energie']
  - conflit `fire resistance` : assistant=['resistance au feu'] / calc=['de resistance au feu']
  - conflit `fortify generation` : assistant=['generation de fortification'] / calc=['a la generation de fortification']
  - conflit `spirit on kill` : assistant=['esprit par victime'] / calc=['de ressource par victime pour esprit']
  - conflit `cooldown reduction` : assistant=['reduction du temps de recharge'] / calc=['de reduction du temps de recharge']
  - conflit `vigor regeneration` : assistant=['regeneration de vigueur'] / calc=['de regeneration vigueur']
  - conflit `poison resistance` : assistant=['resistance au poison'] / calc=['de resistance au poison']
  - conflit `armor` : assistant=['armure'] / calc=["a l'armure"]
  - conflit `energy on kill` : assistant=['energie par victime'] / calc=['de ressource par victime pour energie']
  - conflit `life on hit` : assistant=['vie par coup'] / calc=['points de vie par coup']

## B. Ids d'affixes (Assistant loot_filter/data.py vs Calc/Maxroll)
- Ids Assistant : 287 ; presents dans les ids Maxroll (6380) : 287.
- Ids communs Assistant/Calc affixes_en_fr : 287 ; **conflits (meme id, noms sans recouvrement) : 239** (partiels : 0) ; propres Assistant 0 / propres Calc 4079.
- Ids Assistant absents de Maxroll (20 premiers) : []

  - id 2558713 : assistant=['shadow damage multiplier'] / calc=['x shadow damage multiplier']
  - id 2589367 : assistant=['human skills'] / calc=['to human skills']
  - id 2624411 : assistant=['minion skills'] / calc=['to minion skills']
  - id 2624407 : assistant=['bone skills'] / calc=['to bone skills']
  - id 2534778 : assistant=['dark prison'] / calc=['to dark prison']
  - id 1928785 : assistant=['skeleton mage'] / calc=['to skeleton mage']
  - id 2439788 : assistant=['brandish'] / calc=['to brandish']
  - id 1859780 : assistant=['lunging strike'] / calc=['to lunging strike']
  - id 1926989 : assistant=['fire bolt'] / calc=['to fire bolt']
  - id 2534764 : assistant=['hellion sting'] / calc=['to hellion sting']
  - id 2589353 : assistant=['dust devil'] / calc=['to dust devil skills']
  - id 1927010 : assistant=['ice blades'] / calc=['to ice blades']
  - id 1927016 : assistant=['teleport'] / calc=['to teleport']
  - id 2624431 : assistant=['centipede skills'] / calc=['to centipede skills']
  - id 1926981 : assistant=['charged bolts'] / calc=['to charged bolts']

## C. Lecture des sites
- Le Calc lit des PAGES DE BUILD (affixes chiffrees, planners) ; les scrapers Assistant lisent des LISTES (tier list) : niveau de donnees different, aucune cle commune sauf l'URL.
- d4builds : 77 URLs, communes avec les pages figees du Calc : []
- d4guides : 81 URLs, communes avec les pages figees du Calc : []
- infinitybuilds : 27 URLs, communes avec les pages figees du Calc : ['https://infinitybuilds.gg/en/builds/mekunas-blazing-scream-warlock-rn824uhPl3']
- kamilabs : 19 URLs, communes avec les pages figees du Calc : ['https://kami-labs.fr/diablo-4/builds/build-demoniste-cri-ardent-fosse-150-saison-15']
- maxroll : 86 URLs, communes avec les pages figees du Calc : ['https://maxroll.gg/d4/build-guides/blazing-scream-warlock-guide', 'https://maxroll.gg/d4/build-guides/dance-of-knives-rogue-guide']
- talion : 21 URLs, communes avec les pages figees du Calc : []
