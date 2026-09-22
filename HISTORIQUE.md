# Historique de travail - Projet Diablo IV Assistant

## Vision (exprimée par l'utilisateur le 2026-09-16)

Un ensemble d'outils pour Diablo IV, en partant de zéro :

1. **Calculateur de build** - outil externe pour planifier un build (compétences,
   arbre de talents, affixes recherchés) avant de jouer.
2. **Surbrillance en jeu** - mettre en surbrillance dans l'inventaire/les
   coffres les objets intéressants par rapport au build choisi, et idéalement
   aussi les compétences/arbres de talents à équiper.
3. **Génération de filtre de butin** - analyser un build trouvé sur un site
   (généralement en anglais) et en déduire un filtre de butin utilisable en
   jeu.
4. **Difficulté identifiée par l'utilisateur lui-même** : les guides de build
   sont presque toujours en anglais, alors que le client de jeu peut être en
   français (ou l'inverse) - il faut donc gérer la correspondance EN <-> FR
   des noms de compétences, d'affixes, d'aspects légendaires, etc.

## Recherche effectuée avant de commencer (2026-09-16)

### Le filtre de butin natif existe maintenant - bonne nouvelle

Diablo IV a ajouté un **filtre de butin intégré au jeu** avec l'extension
*Lord of Hatred* (2026) : Options > Gameplay, permet de cacher/surligner/
recolorer les objets qui tombent, avec **import/export par code texte**
(copier-coller, limite de 25 règles par filtre). Ça s'applique aux objets
d'équipement (pas aux matériaux, gemmes, manuels de tempérage).

**Conséquence importante** : la fonctionnalité "générer un filtre de butin
à partir d'un build" peut se faire **sans toucher au jeu ni à l'écran** -
juste en analysant le texte d'un guide de build et en générant un code de
filtre au format officiel du jeu. Beaucoup plus simple, fiable et sûr que
d'automatiser l'interface. Le format exact du code n'a pas encore été
documenté précisément dans mes recherches (Blizzard peut le changer à
chaque patch) - à examiner en pratique (exporter un filtre créé à la main
en jeu, inspecter le code obtenu) avant de coder le générateur.

Sources : icy-veins.com, blizzardwatch.com, diablo4.wiki.fextralife.com,
diablobytes.com (voir recherche web du 2026-09-16 dans la session).

### La surbrillance en jeu est un vrai défi technique + un risque de compte

Diablo IV n'a **pas d'API de mod/addon** officielle (contrairement à WoW).
Toute surbrillance en jeu (inventaire, coffres, arbre de compétences)
nécessiterait donc :
- soit de la capture d'écran + reconnaissance de texte (OCR) + une fenêtre
  overlay transparente par-dessus le jeu (pas de lecture de mémoire du
  processus jeu) ;
- soit une lecture directe de la mémoire du jeu (beaucoup plus fiable mais
  **nettement plus risqué** vis-à-vis du système anti-triche).

**Un outil open-source existe déjà et fait quasiment exactement ce qui est
demandé** : [d4lf (Diablo 4 Loot Filter)](https://github.com/d4lfteam/d4lf) -
importe un build depuis Maxroll, surligne en vert les affixes qui matchent
directement sur l'écran (overlay + OCR), marque automatiquement l'équipement
sans intérêt comme "junk". Il existe même un éditeur web dédié
([d4lf-editor](https://github.com/zbee/d4lf-editor)) pour retoucher les
filtres générés depuis un import Maxroll. Nécessite d'activer "Advanced
Tooltip Information" dans les options du jeu pour que l'OCR soit fiable.

**Point d'attention ToS** : sur les forums officiels Blizzard, les
modérateurs indiquent que les outils tiers qui lisent l'état du jeu pendant
qu'il tourne (overlay compris) sont **à risque de bannissement**, même si
Blizzard "n'approuve" aucun outil tiers de toute façon. En pratique, la
communauté utilise largement ce type d'outil (d4lf notamment) sans vague de
bans généralisée constatée à ce jour, mais ce n'est officiellement pas
sanctionné - à prendre en compte avant de s'engager sur cette partie.

## Recommandation de découpage (proposée par l'IA, pas encore validée)

Plutôt que d'attaquer les trois fonctionnalités en même temps :

1. **Générateur de filtre de butin (EN -> code D4, gestion FR)** - partie la
   plus sûre et la plus originale (le filtre natif est récent, peu d'outils
   l'exploitent encore par analyse automatique de build). Bon point de
   départ.
2. **Calculateur de build** - outil web autonome, aucun risque technique ou
   de compte, faisable indépendamment du reste.
3. **Overlay de surbrillance (items + compétences)** - le plus complexe et
   le plus risqué. À étudier davantage avant de s'engager (voir si on peut
   s'appuyer sur d4lf plutôt que repartir de zéro, peser le risque de compte
   avec l'utilisateur).

## Le vrai problème transverse : correspondance EN <-> FR

Identifié par l'utilisateur comme la difficulté principale. Nécessite une
table de correspondance entre les noms anglais (utilisés par les sites de
build comme Maxroll, D4Builds, Icy Veins) et les noms français affichés en
jeu, pour : compétences, aspects légendaires, affixes/stats, noms de
classes/arbres de talents. Pistes à explorer en prochaine session :
- Fichiers de localisation du jeu (si extractibles/publics).
- Bases de données communautaires (Maxroll, Diablo4.wiki, D4Builds)
  proposent-elles déjà du contenu multilingue ou un identifiant stable
  (ID interne) indépendant de la langue, plus simple à mapper que le texte ?

## État actuel

Rien codé pour l'instant - dossier créé avec cet historique en préparation
de la prochaine session. Aucune décision finale prise sur le découpage
ci-dessus ni sur la stack technique (langage, si c'est un site web, un
script local, etc.) - à discuter au démarrage de la prochaine session.

## Installation de d4lf envisagée puis mise en pause (2026-09-16)

L'utilisateur a demandé d'installer d4lf. Avant de lancer quoi que ce soit,
recherche plus precise sur le mecanisme d'installation exact :

- L'installateur (`install_dll.cmd`, necessite les droits administrateur) :
  1. copie un fichier `saapi64.dll` **directement dans le dossier
     d'installation de Diablo IV** ;
  2. telecharge `signtool` (outil de signature Microsoft) et l'utilise pour
     creer un certificat local et signer cette DLL ;
  3. Diablo IV **charge automatiquement cette DLL dans son propre
     processus** au demarrage (le jeu exige des DLL signees pour les
     charger).
- Point rassurant : le mecanisme utilise **l'API d'accessibilite officielle
  du jeu** (lecteur d'ecran / synthese vocale, `saapi`, prevue pour les
  joueurs malvoyants), pas de la capture d'ecran brute (OCR) ni de la
  lecture memoire directe - contrairement a ce que j'avais suppose au
  depart lors de la premiere recherche.
- Point d'attention : c'est tout de meme du code tiers charge **dans le
  processus meme du jeu**, via un detournement de cette API (pas son usage
  prevu), avec des droits admin, et sans confirmation officielle de
  Blizzard que cet usage precis (au-dela de l'accessibilite) est tolere.
  Le README de d4lf ne mentionne aucune note sur le risque de bannissement
  ni sur des faux positifs antivirus.
- **Decision de l'utilisateur : installation mise en pause pour l'instant**,
  le temps d'en discuter davantage ou d'explorer une alternative moins
  invasive. Rien n'a ete installe ni telecharge sur la machine.

## d4lf installé (2026-09-16)

L'utilisateur a validé la reprise de l'installation après la pause précédente.

- Jeu trouvé sur ce PC : `G:\Diablo IV`.
- Dernière release téléchargée depuis GitHub (`d4lfteam/d4lf` v10.0.3, publiée
  2026-09-15), vérifiée par SHA256, extraite dans
  `E:\DiabloIV-Assistant\tools\d4lf\d4lf\`.
- `install_dll.cmd` exécuté (élévation UAC acceptée par l'utilisateur) :
  copie de `saapi64.dll` dans `G:\Diablo IV`, création d'un certificat
  auto-signé "Cert for D4LF" (magasin utilisateur courant, approuvé dans
  Trusted Root), téléchargement du package léger Microsoft BuildTools
  (signtool) car aucun signtool local trouvé, signature de la DLL.
  Résultat : **signature Valid**, installation terminée avec succès.
- `.tools\Microsoft.Windows.SDK.BuildTools\...\signtool.exe` reste en cache
  dans le dossier `tools\d4lf\d4lf\.tools` pour de futures re-signatures
  (ex. après mise à jour de d4lf).
- Pas encore fait : lancer `d4lf.exe`, activer "Advanced Tooltip Information"
  dans les options du jeu, importer un premier build (Maxroll) pour tester
  le surlignage.

## Recherche sur les interactions possibles avec le jeu (2026-09-19)

L'utilisateur a demandé un état des lieux de ce qu'on peut concrètement
lire/faire vis-à-vis du jeu, notamment "lire un build de perso".

- **Pas d'API Blizzard officielle** pour Diablo IV (contrairement à WoW qui a
  une Armory API). Confirmé sur les forums Blizzard.
- **Lire un build depuis un guide web** (Maxroll, D4Builds, Icy-Veins) : aucun
  problème, c'est juste du texte/HTML à parser, zéro interaction avec le jeu.
- **Lire SON PROPRE build/perso réel** : pas de solution officielle, deux
  pistes tierces :
  - [d4armory.io](https://d4armory.io/) : service communautaire non officiel,
    lie le compte Battle.net (ou utilise l'`account_id` trouvable dans
    `FenrisDebug.txt` du dossier d'install du jeu) pour faire un snapshot des
    stats/items d'un perso. Utilisé par la communauté (ex. le projet GitHub
    `ryancollingwood/diablo_4_armory_fetcher` l'exploite via GitHub Actions
    pour tracker les changements de perso).
  - d4lf (déjà installé) : ne lit pas le build d'un coup, il scanne
    l'inventaire/coffre objet par objet (~1s/objet, via le texte des
    tooltips capté par l'API d'accessibilité détournée), overlay vert/rouge
    selon le filtre, peut auto-marquer les objets "junk". Pas confirmé qu'il
    lit aussi la barre de compétences/arbre de talents équipé - à vérifier
    dans le code source de d4lf si besoin un jour.
- **Format du filtre de butin natif enfin identifié** : Protocol Buffers
  binaire encodé en base64, entièrement manipulable en texte (presse-papier),
  sans toucher au jeu. Un outil open-source existe déjà et documente/fait
  cet encodage/décodage en ~80 lignes de JS vanilla :
  [Upsilon72/d4-filter-generator](https://github.com/Upsilon72/d4-filter-generator).
  Gros gain de temps : plus besoin de reverse-engineer le format nous-mêmes
  à partir de zéro, on peut étudier ce projet comme référence avant de coder
  notre générateur (adapté à l'analyse EN->FR d'un build).
- Outil de décodage/visualisation existant en bonus :
  [d4lootfilter.com](https://www.d4lootfilter.com/) (colle un code de filtre,
  affiche les règles en clair).

## Prochaine étape à faire ensemble

- Discuter et valider (ou ajuster) le découpage en 3 phases proposé
  ci-dessus.
- Décider par quelle phase commencer (proposition : le générateur de filtre
  en premier, vu qu'on a maintenant une référence de format toute faite à
  étudier - `d4-filter-generator`).
- Clarifier la stack technique souhaitée (site web ? application locale ?
  script Python/Node ? etc.) et si l'utilisateur a une préférence de langage.
- Si on part sur le générateur de filtre : étudier le code de
  `d4-filter-generator` (structure Protocol Buffers) plutôt que de
  ré-exporter un filtre à la main pour en déduire le format.
- Décider si on veut aussi lire le build réel du joueur (pas juste un guide
  web) : si oui, choisir entre s'appuyer sur d4armory.io (nécessite de lier
  le compte Battle.net) ou sur le scan d4lf (nécessite le jeu lancé).

## Proposition de l'utilisateur et vérifications (2026-09-19)

Idée proposée : suivre un build en jeu avec d4lf, mais traduire **uniquement
le build choisi** (pas toute la base d'objets du jeu) en s'appuyant sur des
sites de build en français, plus comparaison de builds entre sites et
conseils sur l'équipement.

Sites proposés par l'utilisateur :
- Build voleur (exemple) : https://kami-labs.fr/diablo-4/builds/build-voleur-pluie-de-fleches-polyvalent-saison-15/
- Liste de builds : https://www.talion.tv/diablo/builds
- Page boss (usage exact pas clair, présenté comme "moteur de recherche
  traduction objets") : https://www.talion.tv/diablo/boss

### Découverte critique : d4lf exige un client de jeu en ANGLAIS

Vérifié dans le README installé localement (`tools/d4lf/d4lf/README.md`,
section "Game Settings", ligne 57) : **"Game Language must be English"**.
d4lf lit le texte affiché à l'écran (tooltips, via l'API d'accessibilité) et
le compare à sa propre base interne, entièrement en anglais
(`tools/d4lf/d4lf/assets/lang/enUS/{uniques,aspects,affixes,item_types,
sigils,sets,tributes,tooltips,charms_affixes,seals_affixes}.json`). Il
n'existe **aucune base frFR** dans l'installation. Conséquence :
- Si le client du jeu de l'utilisateur est en français, d4lf ne peut
  fonctionner correctement tel quel (le texte lu à l'écran serait en
  français, ne matchant rien dans la base anglaise).
- Si l'utilisateur accepte de jouer en anglais, d4lf fonctionne nativement
  sans aucun problème de langue côté jeu.
- **Question posée à l'utilisateur, réponse en attente** : le client est-il
  actuellement réglé en français, et est-il prêt à basculer en anglais pour
  cette fonctionnalité, ou tient-il à jouer en français (auquel cas la
  surbrillance en jeu via d4lf est à écarter, seuls le calculateur/filtre
  restent réalistes) ?

### Vérification des sites proposés

- **kami-labs.fr** (testé sur la page build voleur) : site classique, texte
  HTML structuré en français (pas d'images pour le texte), sections claires
  (présentation, points forts/faibles, équipement recommandé, sceau
  horadrique, gameplay, arbre des talents, mercenaire, paragon). Pas de
  tableaux de valeurs d'affixes chiffrées ni de lien d'import
  Maxroll/D4Builds ni de code de filtre exportable. Bon pour la direction
  générale d'un build, moins pour du filtrage précis par seuil de valeur.
- **talion.tv** (`/diablo/builds` et `/diablo/boss`) : c'est une application
  JavaScript (Angular/PrimeNG, `p-dark`), le contenu n'est **pas** dans le
  HTML brut renvoyé par une requête simple - il est chargé dynamiquement
  côté client. Un simple fetch/curl ne suffit pas : il faudrait soit un
  navigateur automatisé (Playwright/Puppeteer) pour rendre le JS, soit
  identifier et interroger directement l'API backend du site (à repérer via
  les requêtes réseau de la page dans un vrai navigateur). Plus de travail
  que kami-labs.fr, à explorer seulement si nécessaire.

### Verdict sur l'idée globale

- Traduire uniquement le build (pas tout le jeu) : **validé, bonne idée** -
  vocabulaire réduit (~10-30 termes/build), et les fichiers `enUS/*.json`
  déjà présents localement servent de référence exacte pour vérifier chaque
  traduction FR->EN avant de générer un profil d4lf.
- Comparer plusieurs builds de sites différents pour désigner "le meilleur" :
  **partiellement réaliste**. Aucun des sites vus n'affiche de vrais chiffres
  de DPS/survie exploitables - possible de faire une comparaison qualitative
  (tier lists communautaires, complexité, robustesse) mais pas un verdict
  chiffré sans un simulateur de dégâts complet (projet séparé, hors de
  portée pour l'instant).
- Conseils sur les pièces d'équipement : trivial, aucun développement requis
  (juste du raisonnement/chat), à intégrer dans l'outil final.
- Générateur de filtre de butin : confirmé indépendant de la langue du jeu
  (format basé sur des identifiants internes, pas du texte affiché).

## Décision utilisateur : abandon de la surbrillance en jeu, nouvelle direction (2026-09-19)

L'utilisateur confirme que l'absence de surbrillance en jeu n'est pas grave
(le filtre de butin suffit) et qu'il peut suivre un build sur un 2e écran.
**La contrainte "jeu en anglais" de d4lf devient donc non bloquante** - on
n'a plus besoin de faire tourner d4lf en overlay live pendant qu'il joue.

Nouvelle direction demandée : une interface web/locale avec (1) vue de
l'inventaire du joueur via d4armory, (2) affichage du build traduit avec un
encart pour poser des questions/conseils sur le build, (3) une fonctionnalité
de recherche qui compare les builds de plusieurs sites FR/US pour n'afficher
que le meilleur, si possible avec un classement/tier list.

### Découverte : d4armory.io est mort

Vérifié par requête HTTP directe (`curl -IL https://d4armory.io/`) : le
domaine redirige maintenant (301) vers `diablo4.blizzard.com`, la page
officielle Blizzard - le service n'existe plus. Confirmé aussi par le
README du projet `ryancollingwood/diablo_4_armory_fetcher` qui indique que
son dépôt est archivé car "the unofficial Diablo 4 Armory is no longer
active". Aucune alternative tierce équivalente trouvée en recherche web
(Maxroll a une page "Armory" mais c'est un guide sur le système
d'équipement du jeu, pas un lecteur d'inventaire à distance ; Blizzard a
ajouté un "Armory" **officiel mais in-game uniquement** en saison 7, qui
permet de sauvegarder/nommer jusqu'à 5 configurations de build par
personnage - pas d'accès externe).
**Conséquence : il n'existe actuellement aucun moyen fiable de lire
l'inventaire du joueur à distance/automatiquement.** Deux pistes possibles
pour remplacer cette brique, à trancher avec l'utilisateur :
1. Saisie manuelle de l'équipement actuel dans l'interface (simple, fiable,
   zéro risque, mais fastidieux à chaque mise à jour d'équipement).
2. S'appuyer sur le scan local de d4lf pendant que le jeu tourne (déjà
   installé et déjà fonctionnel chez l'utilisateur, voir ci-dessous) - mais
   nécessite d'examiner si d4lf peut exporter un résumé structuré de ce
   qu'il voit (pas juste un overlay visuel éphémère), à vérifier dans son
   code/sa doc avant de s'engager dessus.

### Découverte : l'utilisateur a déjà testé d4lf avec succès (2026-09-16/17), non documenté jusqu'ici

En inspectant `C:/Users/Tryne/.d4lf/` (config utilisateur locale de d4lf,
hors du dossier projet) :
- `params.ini` : 3 profils déjà activés, tous du build Maxroll **Voleur
  "Dance of Knives"** (`maxroll_rogue_dance_of_knives_endgame_rogue_starter/
  midgame/endgame`), importés le 2026-09-16 depuis
  https://maxroll.gg/d4/planner/mmfzmj0i#1 (visible en commentaire dans les
  fichiers `.d4lf/profiles/*.yaml`, 5 variantes présentes : starter,
  midgame, endgame, pushing, bossing).
- Format confirmé des profils d4lf : YAML, section `affixes` par type
  d'objet (`Amulet`, `Boots`, `Bow`, `ChestArmor`, etc.), chaque affixe
  référencé par un identifiant anglais en snake_case (ex.
  `vulnerable_damage_multiplier`, `movement_speed`) - correspond
  exactement aux clés des fichiers `assets/lang/enUS/*.json` de d4lf.
- Logs (`tools/d4lf/d4lf/logs/*.log`, sessions du 2026-09-17 et
  2026-09-18) : d4lf a bien été lancé et connecté au jeu (résolution
  détectée 5120x1440, client TTS connecté). Le texte brut capté par TTS
  est **en anglais** ("Life: 1,474 / 1,474...") - confirme que le client de
  jeu de l'utilisateur tourne actuellement en anglais (la question de la
  langue du jeu posée précédemment est donc déjà résolue dans les faits).
  Raccourci `run_vision_mode = ù` dans `params.ini` indique un clavier
  AZERTY français, cohérent avec un joueur français utilisant un client de
  jeu en anglais.
- Point d'attention vie privée à garder en tête : le flux TTS capté par
  d4lf n'est pas limité aux objets, il inclut aussi du texte d'interface
  générique (ex. noms de comptes/amis en ligne vus dans un log) - à ne pas
  exposer tel quel si on affiche un jour des logs bruts de d4lf dans notre
  interface.
- **Cette activité n'était pas dans l'historique jusqu'ici** - à retenir
  pour la suite : l'utilisateur a une vraie expérience pratique de d4lf, pas
  seulement une installation théorique.

### Découverte : plusieurs tier lists publiques existent déjà (saison 15)

Recherche web : Maxroll ([tier list endgame](https://maxroll.gg/d4/tierlists/endgame-tier-list)),
Mobalytics, D4Builds, Icy-Veins, D4Guides.gg, OP.GG publient chacun une
tier list de build à jour (S/A/B/... par classe) pour la saison 15
(Lord of Hatred). Exemple : 6 builds S-tier actuellement (Barbare
Whirlwind, Necro Minionmancer, Voleur Dance of Knives, Sorcier Blizzard
Static Field, Spiritborn Stinger, Sorcier des ténèbres Blazing Scream).
**Conséquence importante pour la demande de l'utilisateur** : on peut
répondre à "quel est le meilleur build pour telle classe" en agrégeant ces
tier lists existantes (recherche + synthèse), **sans avoir besoin de coder
un simulateur de DPS** (qui serait un projet à part entière, hors de
portée). Par contre, ces tier lists sont organisées par paliers (S/A/B...)
et par classe, pas comme un classement unique "top 20 toutes classes" - à
adapter dans la présentation plutôt que de promettre un vrai top 20 linéaire.

## Prochaine étape à faire ensemble (mise à jour)

- Décider comment obtenir l'équipement actuel du joueur vu que d4armory est
  mort : saisie manuelle pour commencer, ou investiguer si le scan local de
  d4lf peut être exploité (à valider avec l'utilisateur, question posée).
- Décider comment fonctionne l'encart "poser des questions sur le build" :
  vrai appel API Claude en direct depuis l'interface web (nécessite une clé
  API Anthropic et engendre un coût par question), ou rester une interaction
  via les sessions Claude Code (l'utilisateur revient discuter ici) - question
  posée à l'utilisateur.
- Choisir la stack technique du backend (proposition par défaut : Python,
  pratique pour le scraping web + lecture des fichiers locaux de d4lf) - pas
  bloquant, à ajuster si préférence exprimée.
- Étudier le format YAML des profils d4lf déjà importés (voir ci-dessus)
  comme référence concrète pour la génération de filtre/profil à partir d'un
  build traduit.

## Décisions utilisateur (2026-09-19, suite)

- **Inventaire du joueur** : abandonné pour l'instant (pas de saisie
  manuelle, pas d'exploitation du scan d4lf) - focus sur build traduit +
  conseils + filtre de butin uniquement. À reconsidérer plus tard si besoin.
- **Encart conseils sur le build** : pas d'appel API Claude en direct dans
  l'interface (pas de clé API, pas de coût par requête) - l'interface
  affichera le build traduit, et les questions/conseils continuent de se
  faire dans les sessions Claude Code comme actuellement.

## Périmètre MVP retenu

1. Recherche d'un type de build (classe + archétype) à travers plusieurs
   sites de guides FR (kami-labs.fr, talion.tv à confirmer) et US (Maxroll,
   D4Builds, Mobalytics, Icy-Veins...), croisée avec les tier lists
   existantes (saison en cours) pour ne remonter que le meilleur candidat.
2. Traduction ciblée de ce build (vocabulaire réduit : compétences, aspects,
   affixes, uniques) vers les identifiants anglais attendus par d4lf
   (référence : `assets/lang/enUS/*.json` de d4lf), avec affichage en
   français dans l'interface.
3. Génération d'un profil de filtre de butin natif D4 (code
   protobuf/base64) à partir de ce build, en s'appuyant sur
   `Upsilon72/d4-filter-generator` comme référence de format.
4. Pas d'inventaire joueur, pas de chat intégré, pas de surbrillance en jeu
   dans ce périmètre (voir décisions ci-dessus).

## Maquette d'interface produite (2026-09-19)

Publiée comme Artifact ("Chasseur de Build") avec le build Voleuse Danse des
Couteaux déjà présent dans d4lf comme exemple traduit : barre de recherche,
bande de sources comparées, détail du build (compétences/aspects/affixes
par emplacement/paragon), et panneau de filtre de butin généré avec bouton
copier. Retour utilisateur en attente / a mené à la découverte ci-dessous
qui remet en cause l'architecture "comparer plusieurs sites nous-mêmes".

## Découverte majeure : infinitybuilds.gg change la donne (2026-09-19)

L'utilisateur a proposé d'utiliser https://infinitybuilds.gg/ plutôt que de
repartir sur une interface de zéro. Vérifications faites :

- Déjà cité dans le README de d4lf comme site supporté par son importeur de
  profil natif (aux côtés de Maxroll, Mobalytics, D4Builds).
- **Vraie localisation française** (pas juste l'URL) : vérifié sur
  `/fr/tier-list/endgame` et `/fr/builds/...` - titres, noms de
  compétences ("Pluie de flèches", "Cri flamboyant", "Danse des lames"),
  tout le texte d'interface est traduit. Ça répond directement au problème
  transverse EN<->FR identifié depuis le début du projet, sans qu'on ait à
  construire notre propre pipeline de traduction généraliste.
- **Tier list intégrée et curatée** par de "top players" (marque "INF") :
  rangs S/A/B/C avec des builds nommés par classe, accessible en français.
  Exemple relevé (saison 15, endgame) : rang S (7 builds, dont Pluie de
  Flèches Voleuse et Cri Flamboyant Occultiste), rang A (13 builds, dont
  Danse des Couteaux), rang B (4 builds). Résout "quel est le meilleur
  build" sans qu'on ait à agréger nous-mêmes plusieurs tier lists
  différentes de sites différents.
- Chaque build a sa propre page avec sections Compétences, Équipement,
  Paragon, Talisman, Mercenaires, Plans de guerre, Avantages/Inconvénients.
  Des labels comme "Affixe majeur", "Affixe supérieur", "Affixes (jusqu'à
  4)" confirment la présence de vraies données d'affixes structurées (pas
  juste du texte descriptif comme sur kami-labs.fr).
- **Détail technique important** : le site est en Next.js (App Router),
  prérendu côté serveur mais les données de build ne sont pas dans un JSON
  simple (`__NEXT_DATA__`) - elles sont livrées via le streaming React
  Server Components (`self.__next_f.push(...)` dans des balises `<script>`).
  Récupérable et parsable en Python, mais plus technique qu'un simple
  scraping HTML/BeautifulSoup - nécessitera d'extraire et de décoder ces
  chunks JSON.
- `robots.txt` autorise le crawl de tout le contenu public (build pages,
  tier list) - seules les pages de compte/connexion/admin sont interdites.
  Pas de code d'export (Maxroll-style) ni d'API publique trouvés - il faut
  parser les pages elles-mêmes.

### Conséquence sur l'architecture

Cette découverte simplifie et réoriente fortement le projet :
- **Plus besoin de comparer nous-mêmes plusieurs sites FR/US disparates**
  (kami-labs, talion.tv, Maxroll...) pour désigner "le meilleur build" -
  la tier list intégrée d'InfinityBuilds fait déjà ce travail, en français.
- **Plus besoin de construire notre propre interface de recherche/
  navigation de builds** - le site a déjà une excellente UX en français ;
  l'utilisateur peut naviguer directement dessus.
- **Le périmètre de notre outil se réduit** à un convertisseur : l'
  utilisateur choisit/colle l'URL d'un build InfinityBuilds (ou une
  build de la tier list), notre outil parse la page (RSC), aligne les
  noms FR vers les identifiants anglais attendus par d4lf
  (`assets/lang/enUS/*.json`), et génère (a) un profil d4lf prêt à
  l'emploi et (b) un code de filtre de butin natif.
- La maquette "Chasseur de Build" produite juste avant (recherche +
  comparaison de sources) est probablement à revoir/simplifier en
  conséquence - à valider avec l'utilisateur.

## Pause de session (2026-09-19, soir)

L'utilisateur arrête pour la soirée, à reprendre la prochaine fois.

**Question ouverte, à trancher en premier à la reprise** : partir sur la
version resserrée de l'outil (un simple convertisseur : URL de build
InfinityBuilds -> profil d4lf + filtre de butin généré, sans interface de
recherche/comparaison à nous puisqu'InfinityBuilds la fait déjà), ou garder
quand même une petite interface de navigation par-dessus (dans l'esprit de
la maquette "Chasseur de Build" déjà publiée) ? Les deux options ont été
présentées à l'utilisateur juste avant la pause, réponse en attente.

## Reprise et nouvelle réorientation majeure (2026-09-20)

L'utilisateur tranche : il veut **garder le comparateur multi-sites**
(kami-labs.fr, talion.tv, Maxroll, D4Builds, Mobalytics, Icy-Veins,
InfinityBuilds...) plutôt que de se reposer uniquement sur la tier list
InfinityBuilds - jugée **moins fournie** que l'ensemble des autres sites de
build. Retour à l'idée originale de comparaison multi-sources, mais avec
InfinityBuilds comme source supplémentaire (pas la source unique).

### Idée nouvelle : utiliser le "Planner" perso d'InfinityBuilds comme interface de sortie

Proposition de l'utilisateur : après analyse/comparaison des builds, remplir
**automatiquement** un build sur InfinityBuilds avec les commentaires et
explications produits par l'analyse.

Vérifications faites (WebFetch) :
- InfinityBuilds a un **"Planner" à `/en/builds/new`**, séparé de la tier
  list publique. La tier list publique reste strictement curatée par
  l'équipe "INF" ("INF plays every build we publish. If it doesn't clear,
  it doesn't ship.") - **pas question de publier un faux build public comme
  si c'était officiel**, ce n'est pas praticable ni souhaitable.
- Confirmé avec l'utilisateur : l'objectif est de remplir **son propre
  planner personnel** (compte connecté), pas une publication publique. Ça
  change complètement le profil de risque : on écrit dans le compte de
  l'utilisateur lui-même, avec son consentement explicite, pas de contenu
  trompeur exposé à des tiers.
- Login du site : Discord OAuth, Twitch OAuth, ou email - pas de CAPTCHA
  détecté. Pas de ToS/robots.txt trouvé interdisant explicitement
  l'automatisation, mais rien ne l'autorise non plus explicitement.
- **Approche technique retenue pour éviter les soucis d'identifiants/OAuth
  automatisé** : navigateur automatisé (Playwright) avec un **profil
  persistant** - l'utilisateur se connecte une seule fois manuellement
  (peu importe la méthode), le script réutilise ensuite cette session pour
  remplir le formulaire du planner. Pas de stockage de mot de passe, pas
  d'automatisation du flux OAuth Discord/Twitch (qui serait plus limite
  côté ToS de ces plateformes).

### Architecture cible mise à jour (2026-09-20)

1. **Comparateur multi-sites** : scraper/parser les builds sur plusieurs
   sites FR/US, croiser avec leurs tier lists respectives, produire une
   synthèse qualitative du meilleur candidat par classe/archétype (toujours
   pas de DPS chiffré - hors de portée, décision déjà actée).
2. **Génération du commentaire/explication** à partir de cette analyse
   (pourquoi ce build, forces/faiblesses, sources citées).
3. **Remplissage automatique du planner InfinityBuilds personnel** de
   l'utilisateur via Playwright (session persistante après connexion
   manuelle) - remplace le besoin de construire notre propre interface de
   présentation (la maquette "Chasseur de Build" du 2026-09-19 est donc
   abandonnée/obsolète).
4. **Génération du filtre de butin natif** (protobuf/base64, référence
   `Upsilon72/d4-filter-generator`) à partir du build retenu, éventuellement
   accompagnée d'un profil d4lf (YAML) prêt à l'emploi - inchangé depuis le
   début du projet.

## Décision de stack technique et de packaging (2026-09-20)

Question posée avant de démarrer le code : sous quelle forme l'outil doit
être utilisable sur un autre PC ?

- **Public cible** : l'utilisateur veut potentiellement **partager l'outil
  avec d'autres joueurs D4 plus tard** (pas juste un usage perso sur un 2e
  PC à lui) - implique un packaging plus soigné à terme (installeur,
  robustesse face aux sites qui changent, documentation), même si on ne le
  fait pas dès maintenant.
- **Forme d'usage retenue** : une **petite interface web locale** (serveur
  lancé en local, ouvert dans le navigateur par défaut), pas une ligne de
  commande.

**Stack retenue** : Python + serveur web local (FastAPI) + Playwright.
- Un seul langage pour tout le projet (scraping/parsing, comparaison de
  builds, génération du filtre de butin, automatisation du Planner
  InfinityBuilds).
- Playwright sert à deux choses : rendre les pages nécessitant du JS
  (talion.tv, InfinityBuilds - voir découverte du 2026-09-19 sur le
  streaming React Server Components), et remplir le Planner personnel de
  chaque utilisateur avec sa propre session (pas de compte centralisé -
  chaque utilisateur de l'outil se connecte à son propre compte
  InfinityBuilds sur sa propre machine, voir décision du 2026-09-20
  ci-dessus sur le profil de navigateur persistant).
- **Distribution future envisagée** (pas à faire maintenant) : empaqueter
  en exécutable Windows (PyInstaller), avec une étape d'installation unique
  du navigateur Playwright (`playwright install chromium`) au premier
  lancement. Implication dès maintenant : éviter tout chemin/valeur codé en
  dur propre à la machine de l'utilisateur, pour ne pas avoir à refactorer
  plus tard.

## Première version codée du comparateur multi-sites (2026-09-20)

Structure créée dans `E:\DiabloIV-Assistant\` :
- `.venv\` - environnement virtuel Python dédié au projet (isolé du Python
  global de la machine, pour rester portable/réinstallable ailleurs).
- `requirements.txt` - fastapi, uvicorn, httpx, beautifulsoup4, playwright
  (versions figées sur celles déjà présentes/installées).
- `app\models.py` - modèle `BuildResult` commun à tous les scrapers, liste
  des 8 classes canoniques (id anglais + label FR) : barbarian/druid/
  necromancer/paladin/rogue/sorcerer/spiritborn/warlock.
- `app\scrapers\base.py` - interface `Scraper` commune + cache mémoire
  15 min (évite de re-taper les sites à chaque recherche).
- `app\scrapers\kamilabs.py` - **fonctionne**. Découverte clé : le hub de
  builds kami-labs charge tout via un endpoint REST WordPress
  (`/wp-json/autoarticle/v1/d4/hub/builds-ajax`) qui renvoie en UNE requête
  les ~392 builds avec tier/classe/saison/tags en attributs `data-*` -
  aucun besoin de Playwright ni de pagination pour cette source. Testé :
  54 builds Voleur récupérés correctement.
- `app\scrapers\infinitybuilds.py` - **fonctionne**, mais via Playwright
  (pas d'API JSON trouvée, contenu rendu côté client). Récupère la tier
  list endgame (~24 builds, tiers S/A/B). Limite connue : la classe est
  déduite du slug d'URL (ex. "...-rogue-..."), certains slugs sont des ids
  opaques sans nom de classe (ex. `_6EfxV8ono` pour un build Sacresprit
  "Stinger") - dans ce cas `game_class` reste `None` plutôt que d'être
  deviné ; visiter la page de chaque build lèverait l'ambiguïté mais n'a
  pas été fait dans cette première version (coût en temps/requêtes).
- `app\comparator.py` - interroge tous les scrapers enregistrés et renvoie
  les résultats groupés par source, chacun trié par tier. **Ne fait pas
  encore de rapprochement inter-sites** (reconnaître que "Danse des
  Couteaux" chez kami-labs et "Dance Of Knives" chez InfinityBuilds sont le
  même build) - nécessite un dictionnaire de noms de compétences FR<->EN
  qui n'existe pas encore (lié au problème transverse identifié depuis le
  début du projet). Pour l'instant, comparaison = deux colonnes triées par
  tier, à l'œil.
- `app\main.py` - serveur FastAPI local (`/api/classes`, `/api/compare`),
  sert l'interface statique et ouvre automatiquement le navigateur.
- `app\static\` - interface web simple (sélecteur de classe en français,
  champ mot-clé, colonnes de résultats par source avec badge de tier).

**Testé de bout en bout** : scrapers testés individuellement en ligne de
commande (résultats corrects), puis serveur lancé et requêtes API
vérifiées via curl (`/api/classes`, `/api/compare?game_class=rogue&
keyword=fleches`) - réponses JSON correctes avec accents UTF-8 propres.
Limite observée en le testant : chercher un mot-clé français ("fleches")
ne remonte rien côté InfinityBuilds (titres en anglais, "Rain Of Arrows")
- illustre concrètement pourquoi le mapping FR<->EN reste nécessaire pour
une vraie comparaison, pas seulement pour le filtre de butin.

**Pour relancer le serveur** : `E:\DiabloIV-Assistant\.venv\Scripts\
python.exe -m app.main` depuis `E:\DiabloIV-Assistant`, puis
http://127.0.0.1:8000 (ouvert automatiquement).

## Ajout de Maxroll comme 3e source (2026-09-20)

`app\scrapers\maxroll.py` - **fonctionne**, et bonne surprise : contrairement
à InfinityBuilds, la tier list Maxroll est **rendue côté serveur** (pas de
Playwright nécessaire, un simple `httpx.get` suffit) - confirmé en trouvant
les liens de builds directement dans le HTML brut avant même d'écrire le
scraper. Structure : classes CSS avec suffixe de hash (`_Tierlist__tier_
cxko4_112`) qui peut changer au redéploiement du site - matching fait sur
le préfixe stable plutôt que la classe complète, pour limiter la casse en
cas de changement. Classe du personnage déduite du nom de fichier de
l'icône (`NEW_Rogue_colored_Icon.webp` -> rogue), avec un cas particulier
pour le sorcier (fichier `UPDATED-SORC-COLORED-ICON.webp`, pas le nom
complet). **84/84 builds classés correctement** au test (aucun `None`).
Ajouté au registre dans `app\scrapers\__init__.py`. Testé via l'API
`/api/compare?game_class=rogue` : kamilabs 54, maxroll 15, infinitybuilds 1.

## Dictionnaire FR<->EN construit à partir d'InfinityBuilds (2026-09-20)

Idée retenue : InfinityBuilds sert la MÊME page de build en anglais
(`/en/builds/<slug>`) et en français (`/fr/builds/<slug>`) - mêmes noms
d'objets/compétences, juste traduits. En comparant les deux versions d'un
même build, on déduit automatiquement des paires FR<->EN fiables, sans
dictionnaire externe ni saisie manuelle.

**Piège rencontré et corrigé** : une première version comparait le texte
brut de toute la page (`body.innerText`) ligne à ligne entre les deux
langues. Ça casse dès qu'un build a un texte de présentation écrit par
l'auteur (traduit avec un nombre de lignes différent d'une langue à
l'autre) - toutes les lignes suivantes se retrouvent décalées d'un cran,
produisant des paires fausses (repéré concrètement : "Aspect of Falling
Feathers" collé à une chaîne vide sur un build Sacresprit "Storm
Feathers"). **Corrigé en interrogeant des composants DOM précis** plutôt
que le texte de la page entière : chaque emplacement d'équipement
(`.gear-paperdoll-tile`, classe Tailwind stable) est lu indépendamment,
et le bloc de compétences est repéré via une classe CSS exacte partagée
par un seul autre élément de la page ("Spirit Hall", propre aux
Sacresprits) - en prenant le premier élément avec cette classe, on trouve
le bloc Compétences sans avoir besoin de connaître sa traduction. Chaque
composant est traduit dans son coin, donc un texte imprévu ailleurs sur la
page ne peut plus tout décaler.

Résultat (`app\fr_en\`) :
- `extractor.py` - logique pure de mise en correspondance (testable sans
  navigateur), + les scripts JS exécutés dans la page.
- `build_dictionary.py` - script batch (pas appelé à chaque requête, trop
  lent/impoli pour InfinityBuilds) qui parcourt les ~24 builds de la tier
  list en EN et FR et génère `app\data\fr_en_dictionary.json`. À relancer
  manuellement pour rafraîchir : `.venv\Scripts\python.exe -m
  app.fr_en.build_dictionary` (~2-3 min).
- **209 paires générées, 0 entrée corrompue, 0 conflit** (aucun terme
  français associé à deux termes anglais différents) - vérifié
  explicitement après coup. Répartition : 138 objets/aspects, 63
  compétences, 8 noms de classe.
- `dictionary.py` - charge le JSON, expose `translate_keyword()`
  (recherche insensible aux accents : "fleches" trouve "Flèches").
- **Branché dans `comparator.py`** : une recherche par mot-clé essaie
  aussi sa traduction. Testé : chercher "fleches" (classe Voleur) remonte
  maintenant des résultats sur les **3 sources** - 5 sur kami-labs (FR),
  2 sur Maxroll ("Rain of Arrows"), 1 sur InfinityBuilds - alors
  qu'avant seul kami-labs répondait à ce mot-clé français.

**Limite assumée** : dictionnaire construit uniquement à partir des ~24
builds actuellement dans la tier list InfinityBuilds - vocabulaire
partiel, grandit à mesure qu'on relance le script (et que la tier list
change au fil des saisons). Pas encore de rapprochement "même build
détecté sur plusieurs sites" en une seule ligne (juste une traduction de
mot-clé) - possible next step maintenant que le dictionnaire existe.

## Ajout de 3 sources supplémentaires : D4Builds, D4Guides, talion.tv (2026-09-20)

Demandées par l'utilisateur : mobalytics.gg, talion.tv, d4builds.gg,
d4guides.gg. Méthode systématique utilisée pour chacune : chercher d'abord
un endpoint JSON déjà utilisé par le site lui-même avant d'envisager
Playwright.

- **`app\scrapers\d4builds.py`** - **fonctionne**, HTML serveur (comme
  Maxroll), page d'accueil liste directement les 77 builds "Meta Builds"
  avec classe en attribut CSS de l'icône (`build__icon Warlock`).
  Particularité : **pas de tier S/A/B sur ce site**, juste un niveau de
  Fosse ("Tower 150") - on ne invente pas un tier qui n'existe pas côté
  site, `tier=None` et le niveau de fosse est gardé en tag
  (`tower-150`). 77/77 builds classés.
- **`app\scrapers\d4guides.py`** - **fonctionne**, et c'est la source la
  plus simple de toutes : en inspectant `assets/js/builds-list.js` (visible
  en clair, pas minifié), on trouve l'appel `api.get('builds.php', params)`
  vers `https://d4guides.gg/api/v1/builds.php` - JSON structuré complet
  (tier S/A/B/C réel, classe, titre EN/DE, saison, type de build) en une
  requête, aucun HTML à parser. 47 builds saison 15 récupérés.
- **`app\scrapers\talion.py`** - **fonctionne**, mais nécessitait une autre
  méthode : le site est une SPA Angular sans rien d'utile dans le HTML
  statique (déjà su depuis le 2026-09-19). Cette fois, plutôt que de lire
  le bundle JS minifié, **Playwright a été utilisé une seule fois pour
  enregistrer les requêtes réseau** de la page (`page.on("response")`)
  pendant son chargement - a immédiatement révélé
  `https://api.talion.tv/api/builds/front`, un endpoint JSON public. Cet
  endpoint mélange plusieurs jeux Blizzard (pas que Diablo 4) sous des
  noms de classe qui se ressemblent - filtré sur `game.slug ==
  "diablo-4"` (32 builds restants, exactement les 8 classes D4 attendues
  en slugs français : barbare/druide/necromancien/paladin/voleur/sorcier/
  sacresprit/demoniste, mappés vers nos ids canoniques anglais). Tier
  extrait des tags de catégorie "Push Tier".

### Mobalytics.gg délibérément exclu

Bloqué par un **challenge anti-bot Cloudflare** (HTTP 403 avec l'en-tête
`Cf-Mitigated: challenge` sur le domaine principal ET tous les
sous-domaines/chemins d'API testés) - une vraie mesure technique
anti-automatisation, pas juste "pas d'API trouvée" comme pour talion.tv.
Le contourner demanderait de la simulation d'empreinte navigateur/
résolution de challenge, ce que ce projet ne fait délibérément pas.
**Décision : source non intégrée.** Si l'utilisateur y tient, il faudra en
rediscuter explicitement (proxy résidentiel, service de résolution de
challenge... des options plus lourdes et plus limites côté ToS).

### État du registre de sources (6 actives)

Testé via `/api/compare?game_class=rogue` : kamilabs 54, maxroll 15,
infinitybuilds 1, d4builds 12, d4guides 5, talion 6.

## Filtrage par saison en cours (2026-09-20)

L'utilisateur a demandé de vérifier que les builds affichés sont bien de la
saison en cours (S15). Audit fait source par source :

- **kami-labs : vrai bug corrigé.** Le flux mélangeait TOUTES les saisons
  depuis S5 (~400 posts), sans filtre. Sur ces ~400, seulement **14**
  étaient réellement S15 (`data-season="S15"`) - environ 70 autres posts
  n'avaient même pas l'attribut `data-season` rempli alors que leur titre
  mentionnait une vieille saison ("(S10)") : un trou de qualité de données
  côté kami-labs, pas un bug ici, mais qui aurait pollué nos résultats.
  Ajouté `app\config.py` (`CURRENT_SEASON = 15`) et filtré dessus dans
  `kamilabs.py`.
- **talion.tv : pas de champ saison du tout** dans leur API - vérifié
  toutes les clés d'un objet build. Approximé avec `updated_at >=
  CURRENT_SEASON_START` (date de début de saison estimée à partir des
  autres sites, `app\config.py`) : 20 des 32 builds D4 passent ce filtre,
  12 dataient d'avant (le plus vieux de 2025-04) - imparfait mais mieux que
  rien, documenté comme heuristique dans le code.
- **Maxroll, d4builds, InfinityBuilds : rien à corriger** - ce sont des
  pages "live" à saison unique (pas d'archive multi-saison mélangée),
  vérifié pour InfinityBuilds en inspectant deux pages de build (badge
  "S15" visible sur les deux).
- **D4Guides** : déjà correct (paramètre `season=15` envoyé à leur API dès
  le départ).

## Classement par consensus multi-sources (2026-09-20)

Question de l'utilisateur : comment identifier le meilleur build d'une
liste, et serait-il possible de noter les builds sur 20 à partir des
commentaires trouvés sur chaque site ?

**Vérification faite avant de proposer quoi que ce soit** - signaux
réellement disponibles par site :
- kami-labs a un système de vote (1-5 étoiles, endpoint `/votes/batch`)
  mais **très peu utilisé** : 0 à 5 votes par build, 6 jours après le début
  de saison - trop faible pour être fiable.
- D4Guides expose `views_count` (jusqu'à ~13 000, signal correct) et
  `favorites_count` (trop faible, 0-9).
- InfinityBuilds a un compteur "Track Build" et des commentaires (~6 par
  build) - également trop peu pour une analyse de sentiment fiable.
- D4Builds et talion.tv n'exposent aucune donnée de ce genre.

**Décision (validée avec l'utilisateur)** : analyser le texte des
commentaires (ce que je peux faire moi-même, en lisant les commentaires,
mais pas via un appel API Claude automatique et payant dans l'app - cf.
décision du 2026-09-19 sur l'absence d'API en direct) n'a pas encore assez
de matière pour être fiable, et présenter ça comme une note sur 20
donnerait une fausse précision. À la place : **classement par consensus
entre sources**, en s'appuyant sur ce qu'on a déjà (6 sites qui classent
chacun les builds en S/A/B/C/D).

`app\consensus.py` :
- Regroupe les builds qui semblent être "le même build" à travers les
  sources, en comparant leurs titres traduits/nettoyés (réutilise le
  dictionnaire FR<->EN pour transformer "Pluie de Flèches" en "rain
  arrows" avant comparaison) via une similarité de Jaccard sur les mots
  significatifs (seuil volontairement prudent à 0.5 : mieux vaut ne pas
  regrouper deux builds proches par erreur - ce qui fausserait le
  consensus - que les laisser en deux lignes séparées). Les mots de type
  d'affinité élémentaire (cold/poison/fire...) ne sont jamais traités comme
  du bruit, pour ne pas fusionner à tort des variantes réellement
  différentes.
- Classe les groupes par nombre de sources qui voient le même build, puis
  par tier moyen.
- Endpoint `/api/consensus?game_class=...`, affiché dans une nouvelle
  section "Meilleurs builds (consensus multi-sources)" en haut de la page,
  au-dessus du détail par source.

**Testé** : pour Voleur, le groupe #1 regroupe correctement "Pluie de
Flèches" (kami-labs), "Rain of Arrows"/"Cold/Poison Rain of Arrows"
(Maxroll, D4Guides, D4Builds), "Rain Of Arrows" (InfinityBuilds) - **5
sources sur 6**, majorité S-tier. Pour Barbare, "Tourbillon"/"Whirlwind"
regroupé sur 5 sources, 5×S et 1×A - cohérent avec le méta connu. Bonus
observé : "Tourbillon immortel" (variante défensive) n'a PAS été fusionné
avec le "Tourbillon" de base malgré le mot commun - le seuil prudent
distingue bien les vraies variantes.

**Limite assumée** : le rapprochement est approximatif par nature (titres
en texte libre) - biaisé volontairement vers la prudence (sous-regrouper
plutôt que sur-regrouper à tort).

## Croisement avec le classement officiel du jeu (2026-09-20)

Question de l'utilisateur : peut-on affiner le classement en le comparant
au classement OFFICIEL du jeu ?

**Recherche** : Diablo 4 a un vrai classement officiel - la **Tower
Leaderboard** (top 1000 joueurs par classe, accessible en jeu via
"Y > Leaderboards", pas de page Battle.net dédiée trouvée). Chaque entrée
du classement a un bouton "View Build" qui montre les compétences et
l'équipement réels du joueur classé. C'est exactement une donnée terrain
("qu'est-ce que les meilleurs joueurs utilisent vraiment"), différente
des avis éditoriaux des sites de guides.

**Trouvé** : [helltides.com/tower](https://helltides.com/tower) (site
communautaire déjà connu, cité par plusieurs sources de recherche) reflète
ce classement officiel en ligne. Méthode habituelle : espionner les
requêtes réseau de la page au chargement (comme pour talion.tv) - a
révélé `helltides.com/api/tower/getRun?id=...`, un JSON complet par run
(compétences réelles avec noms lisibles + type Core/Défensive/Ultime/
Sigil, objets équipés, tier de Fosse atteint, pseudo Battle.net). Encore
mieux : le classement ENTIER (actuellement ~160-190 joueurs par classe)
est déjà chargé dans la page au premier chargement, dans le cache de
données Nuxt (`window.__NUXT__.data.<clé>`) - une seule requête Playwright
suffit pour tout récupérer, pas besoin d'appeler l'API par joueur.

`app\leaderboard.py` :
- Récupère et met en cache (30 min) le classement Tower complet.
- `top_skill_names(classe, limit=20, core_only=True)` renvoie les
  compétences Core/Ultime des 20 meilleurs joueurs réels d'une classe -
  les compétences "Core/Ultime" définissent l'identité d'un build,
  contrairement aux compétences utilitaires/défensives partagées par tous
  (Esquive, Clone d'ombre...).

**Branché dans `app\consensus.py`** : chaque groupe de builds est
maintenant aussi comparé à ces compétences réelles (`leaderboard_
confirmations` = sur combien des 20 meilleurs joueurs réels une
compétence du titre du groupe apparaît). Affiché dans l'interface
("✓ confirmé chez N/20 joueurs du top classement officiel").

**Découverte importante en testant** : ce signal a fait remonter un
classement différent de celui basé uniquement sur les sites de guides.
Pour Voleur, "Pluie de Flèches" avait plus de sites qui en parlent
(5 sources) mais seulement 2/20 vrais joueurs du top l'utilisent, contre
"Tir Pénétrant" (4 sources) utilisé par **18/20** des meilleurs joueurs
réels. **Décision : le signal du classement officiel passe maintenant
AVANT le nombre de sources dans le tri** - les sites de guides peuvent
prendre du retard sur un patch ou se recopier entre eux, alors que
l'équipement réel des meilleurs joueurs ne ment pas. Si le classement
officiel échoue à charger ou n'a aucune confirmation pour un groupe, le
tri retombe naturellement sur le nombre de sources comme avant.

**Limite observée en testant** : "Tir Pénétrant" (talion.tv, en français)
n'a pas été rattaché au groupe principal (regroupé séparément, 1 seule
source mais 18/20 confirmations quand même) - le dictionnaire FR<->EN
actuel (construit uniquement à partir des 24 builds d'InfinityBuilds) ne
connaît pas encore la traduction "Tir Pénétrant" -> "Penetrating Shot".
Conséquence directe et concrète : enrichir le dictionnaire améliorerait
aussi la qualité du regroupement consensus, pas seulement la recherche par
mot-clé.

## Recherche directe dans le classement officiel (2026-09-20)

Question de l'utilisateur : peut-on chercher le meilleur Voleur qui joue
Dance of Knives dans le classement ?

Ajouté `search_runs(classe, compétence)` dans `app\leaderboard.py` -
cherche dans le classement Tower complet déjà en cache les runs de la
classe donnée dont une compétence équipée correspond (recherche insensible
à la casse). Endpoint `/api/leaderboard/search?game_class=...&skill=...`,
nouvelle section "Chercher dans le classement officiel (Tower)" dans
l'interface (classe + nom de compétence, affiche rang/pseudo/tier de
Fosse/temps/hardcore-SSF/compétences pour chaque résultat, meilleur rang
en premier).

**Testé** : "Voleur" + "Dance of Knives" -> 116 runs sur 190 utilisent
cette compétence, le mieux classé est **#77** (tier de Fosse 142). Cohérent
avec la découverte du 2026-09-20 sur le consensus : Dance of Knives n'est
pas dans le top absolu du classement en ce moment (aucun des 20 meilleurs
Voleurs ne la joue), Tir Pénétrant reste en tête - mais reste un bon choix
"honnête", loin d'être mauvais (#77 sur ~190 runs).

## Tier list officielle basée sur le classement Tower + bouton d'actualisation (2026-09-20)

Idée de l'utilisateur : afficher le niveau de classement pour tous les
builds, avec un bouton pour actualiser, et faire une vraie tier list basée
sur le classement officiel plutôt que sur l'avis des sites.

**Piège découvert et corrigé en cours de route** : la première tentative
groupait les runs réels par compétences "Core/Ultime" uniquement (comme
pour le signal de consensus) et classait les archétypes par **nombre de
joueurs** (popularité). Résultat faux à l'usage : pour Voleur, "Danse des
Couteaux" ressortait n°1 (85 joueurs, 44,7%) alors que "Tir Pénétrant"
(55 joueurs, 28,9%) atteint un tier de Fosse bien meilleur (145 contre
121) - la popularité mélange joueurs occasionnels et joueurs d'élite,
alors qu'on veut savoir quel build est le PLUS FORT. **Corrigé en classant
par meilleur tier de Fosse réellement atteint**, pas par popularité brute
(le nombre de joueurs reste affiché, pour repérer un résultat isolé/chanceux).

Deuxième piège découvert : `Poison Imbuement` et les compétences
"Subterfuge" (Dissimulation, Manteau des ténèbres...) sont utilisées par
quasiment tous les Voleurs quelle que soit leur vraie compétence
principale - ça faussait aussi le signal de consensus (2026-09-20,
`leaderboard_confirmations`) en "confirmant" à tort n'importe quel build
dont le titre contient juste le mot "poison". Exclu ces types de
compétences (`GENERIC_UTILITY_TYPES` dans `app\leaderboard.py`) du
rapprochement - limite connue restante : un mot générique isolé dans un
type autorisé (ex. "Dash") peut encore matcher à tort un titre qui le
contient par coïncidence.

`app\leaderboard.py` :
- `group_archetypes(classe)` - regroupe les runs d'une classe par
  similarité de compétences équipées complètes (même logique que
  `consensus.py` mais sur les vraies barres de compétences des joueurs,
  pas des titres de guide) - signature figée à la création du groupe pour
  éviter toute dérive après de nombreuses fusions.
- `official_tier_list(classe)` - classe les archétypes S/A/B/C par écart
  avec le meilleur tier de Fosse de la classe (S = à 3 tiers ou moins du
  record de la classe, etc.), avec nombre de joueurs, meilleur rang,
  meilleur tier atteint et 3 pseudos d'exemple par archétype.
- `get_leaderboard(force_refresh=True)` déjà existant, exposé maintenant
  via bouton dans l'interface.

Endpoints `/api/leaderboard/tierlist?game_class=...` et
`/api/leaderboard/refresh` (POST). Interface : nouvelle section "Tier list
officielle (classement Tower)" avec sélecteur de classe et bouton
"Actualiser le classement".

**Testé** : pour Voleur, "Tir Pénétrant" ressort bien en S (tier 145,
55 joueurs), la version pure "Danse des Couteaux" (sans Tir Pénétrant en
compétence principale) tombe en B (tier 121, 85 joueurs) - cohérent avec
les vraies performances plutôt qu'avec la popularité seule.

## Générateur de filtre de butin natif - brique d'origine du projet enfin démarrée (2026-09-20)

Investigation du bouton "View Filter" d'InfinityBuilds (voir plus haut) :
il affiche un aperçu lisible des règles du filtre (sans connexion), mais
pas de bouton pour copier le code brut - probablement réservé à un compte
connecté (comme "Copier dans mes brouillons" ou voter, déjà vus login-only).
Pas bloquant : les règles elles-mêmes (quels affixes, quels seuils) restent
lisibles sans connexion, donc pas besoin ni de se connecter ni de deviner
les règles - on peut les récupérer et les encoder nous-mêmes.

**Format du filtre étudié via `Upsilon72/d4-filter-generator`** (cloné pour
étude, cf. 2026-09-19) : Protocol Buffers binaire, base64 direct, sans
wrapper. Format entièrement compris :
- `Filter` : liste de `Rule` (déjà encodées) + nom + nombre de règles + un
  flag toujours à 1.
- `Rule` : nom, visibilité (SHOW/RECOLOR/HIDE_ALL), couleur RGBA, liste de
  `Condition`, + un flag toujours à 1.
- `Condition` : type (1=Rareté, 3=Affixe Supérieur, 4=Mise à niveau Codex,
  5=Type d'objet, 6=Affixe), avec des identifiants fixed32 et des seuils
  selon le type.

**Port Python fait et vérifié à l'octet près** : généré le même filtre
(preset "HF Warlock" du site de référence) avec le JS original (exécuté
via Node.js) et avec notre port Python - **sortie base64 strictement
identique**. Confiance élevée que l'encodeur est correct.

- `app\loot_filter\codec.py` - primitives protobuf (varint, fixed32,
  bytes) + constructeurs de Condition/Rule/Filter, porté ligne à ligne du
  JS de référence.
- `app\loot_filter\data.py` - table de 77 affixes universels (stats, toutes
  classes) + affixes de compétences par classe. **Limite héritée du projet
  de référence, pas de notre fait** : seul le Démoniste a ses ID de
  compétences confirmés (13 entrées) - les 7 autres classes sont listées
  mais avec `id: None` ("en attente de confirmation" selon leurs propres
  mots). Nécessiterait qu'un joueur exporte un filtre à une seule
  compétence en jeu et décode le résultat (~15 min/classe selon leur
  README) - possible piste pour l'utilisateur qui a le jeu, si souhaité.
- `app\loot_filter\generator.py` - assemble un filtre à partir de
  stats principales/secondaires/compétences choisies, même gabarit de
  règles que la référence (montrer tout / recolorer Affixe Supérieur en
  cyan / garder Légendaires+ en vert / mise à niveau Codex en vert / Rare
  BiS en doré / Rare avec 1+ affixe utile en orange / cacher le reste /
  toujours montrer Talismans légendaires). Renvoie aussi la liste des
  compétences demandées mais non résolues (ID non confirmé), pour prévenir
  plutôt que produire un filtre silencieusement incomplet.

Endpoints `/api/loot-filter/options?game_class=...` et
`/api/loot-filter/generate` (POST). Interface : nouvelle section
"Générateur de filtre de butin" - classe, nom du filtre, seuil doré,
listes de stats principales/secondaires et compétences (compétences non
confirmées grisées et désactivées), bouton générer + copier.

**Testé** : Démoniste (compétences confirmées) et Voleur (compétences non
confirmées, message d'avertissement affiché correctement, stats
universelles toujours utilisables) - les deux cas fonctionnent comme
prévu.

## Retours utilisateur sur l'interface (2026-09-20)

Trois retours après usage réel :
1. **Bug trouvé : le panneau "Meilleurs builds" ignorait le mot-clé de
   recherche.** Une recherche "Lightning Storm Druid" affichait quand même
   le top 10 consensus de toute la classe Druide, sans rapport avec la
   recherche - source de confusion légitime. **Corrigé** : `rank_builds()`
   accepte maintenant un `keyword` et applique la même expansion bilingue
   FR<->EN que `compare()` (extrait dans `comparator.expand_keywords()`,
   partagé entre les deux). Testé : chercher "lightning storm" sur Druide
   ne renvoie plus qu'1 groupe pertinent au lieu d'une dizaine.
2. **Interface trop encombrée.** Les cartes "Meilleurs builds" et les
   colonnes par source prenaient toute la hauteur de page. Corrigé :
   conteneurs à hauteur maximale avec défilement interne
   (`#consensus` et chaque `.source-column-list`), cartes resserrées
   (titre + badges de tier sur une seule ligne).
3. **Accès à la saison précédente demandé.** Architecture de saison
   revue : `Scraper.SUPPORTS_SEASON_FILTER` (nouveau) distingue les sources
   qui archivent plusieurs saisons de celles qui n'affichent que la saison
   en cours - `search()` renvoie `[]` pour une saison non actuelle sur les
   sources sans historique, plutôt que de mélanger silencieusement les
   saisons ou planter. **kami-labs et D4Guides** confirmés capables de
   filtrer par saison passée (testé `season=14` sur les deux). **Maxroll,
   InfinityBuilds, D4Builds, talion.tv** restent saison actuelle uniquement
   (ce sont des pages/API "live" sans sélecteur de saison côté site).
   Nouveau sélecteur de saison dans l'interface (`/api/seasons`), propagé
   à `/api/compare` et `/api/consensus` ; message explicite affiché sous le
   formulaire pour ne pas laisser croire que toutes les sources ont un
   historique.

## Analyse d'un build pour pré-remplir le générateur de filtre (2026-09-20)

Demande de l'utilisateur : pouvoir "consulter" un build et que l'outil
l'analyse pour construire le filtre automatiquement, plutôt que de tout
cocher à la main.

**Portée retenue (assumée, pas de fausse promesse)** : uniquement les
**compétences** sont détectées et pré-cochées automatiquement - pas les
stats/affixes prioritaires, qui varient trop d'un site à l'autre pour être
extraites de façon fiable sans un travail spécifique par source (déjà
beaucoup de travail rien que pour les compétences). Les stats restent à
cocher à la main, éclairées par la lecture du guide.

- `BuildResult` a maintenant un champ `skills`. Rempli **gratuitement**
  (déjà présent dans les données déjà récupérées, aucune requête
  supplémentaire) pour **D4Guides** (`skill_slot_icons` de leur API) et
  **D4Builds** (attribut `alt` des icônes de compétence, déjà dans le HTML
  scrappé).
- **InfinityBuilds** : pas de compétences dans le listing (coûterait un
  chargement Playwright par build rien que pour lister la tier list) -
  récupéré **à la demande** uniquement pour le build que l'utilisateur
  choisit d'analyser, en réutilisant `SKILLS_JS`/`_skill_names()` déjà
  construits pour le dictionnaire FR<->EN (`app\build_analysis.py`).
- kami-labs, Maxroll, talion.tv : pas de compétences disponibles pour
  l'instant (pas de scraper par page de build individuelle construit) -
  clairement annoncé "non disponible" plutôt que de faire semblant.
- Endpoint `/api/analyze-build?source=...&url=...` (uniquement appelé pour
  InfinityBuilds - les autres sources utilisent les compétences déjà
  présentes dans les données de recherche, aucun aller-retour nécessaire).
- Interface : bouton "Analyser →" sur chaque carte de build (colonnes par
  source + cartes de consensus, celle-ci choisissant automatiquement le
  build le plus riche en données parmi ses sources). Au clic : bascule sur
  la classe du build, coche les compétences reconnues dans le générateur
  de filtre, indique combien sont utilisables (ID confirmé) vs détectées
  mais non confirmées vs sans affixe "+X compétences" connu (normal, la
  plupart des compétences n'en ont pas).

**Testé** : `/api/compare` renvoie bien les compétences pour D4Guides et
D4Builds sans requête supplémentaire ; `/api/analyze-build` récupère
correctement les 6 compétences d'un build InfinityBuilds à la demande.

## Refonte en tableau de bord à 3 colonnes (2026-09-20)

Demande de l'utilisateur : une colonne "meilleurs builds" cliquable, un
panneau central "détail du build" qui s'ouvre au clic sur un titre, et le
générateur de filtre alimenté par le build affiché au centre.

Structure retenue : grille CSS à 3 colonnes (`#consensus-column` |
`#build-detail-column` | `#source-detail-column`), chacune avec sa propre
hauteur maximale et son défilement interne. Les titres de build (dans le
consensus ET dans le détail par source) sont devenus des boutons cliquables
(`showBuildDetail()`) plutôt que des liens directs - un lien externe "↗"
séparé reste disponible à côté pour ouvrir le site source. Le panneau
central affiche : titre, un badge de tier par source avec lien, les
compétences détectées (réutilise `resolveBuildSkills()`, la même logique
que l'ancien bouton "Analyser"), et un bouton "Générer le filtre pour ce
build" qui appelle `applySkillsToFilterForm()` puis fait défiler jusqu'au
générateur déjà rempli.

**Bug trouvé et corrigé en testant avec Playwright (capture d'écran +
inspection du DOM)** : pour un build présent sur beaucoup de sources
(jusqu'à 6 liens), la carte de consensus rendait le titre invisible
(largeur calculée à 0px). Cause : `.consensus-links` avait `flex-shrink:0`
+ `max-width:220px` à côté du titre en `flex:1` sur une carte étroite
(263px) - les liens, non compressibles, prenaient toute la largeur
disponible et écrasaient le titre à 0. Corrigé en plaçant les liens
**sous** le titre (bloc empilé) plutôt qu'à côté (ligne flex) - plus de
conflit de largeur, et plus cohérent avec la demande de compacité du
2026-09-20.

**Testé via Playwright** (recherche → clic sur un titre de consensus →
génération → vérification du panneau filtre) : le flux complet fonctionne
de bout en bout, capture d'écran à l'appui - classe correctement
synchronisée, compétences détectées et cochées quand l'ID est confirmé,
message clair sinon. Testé aussi le clic depuis la colonne "Détail par
source" (ex. kami-labs, sans compétences disponibles) : message
"non disponible" correct, pas de plantage.

## Affichage du contenu du build sur notre propre page (2026-09-20)

Demande de l'utilisateur, reformulée après une longue exploration
infructueuse sur Maxroll (voir ci-dessous) : que le contenu des builds
s'affiche **dans notre page**, pas seulement un lien vers le site source.

C'était déjà partiellement fait pour les compétences - étendu pour
afficher aussi l'**équipement** :
- `app\build_analysis.py` : `fetch_build_details()` (remplace
  `fetch_build_skills`) renvoie maintenant compétences ET objets pour
  InfinityBuilds, en réutilisant `GEAR_JS`/`_gear_names()` déjà construits
  pour le dictionnaire FR<->EN (2026-09-20, plus haut) - zéro code de
  scraping supplémentaire à écrire, juste relié différemment.
- `/api/analyze-build` renvoie `{skills, items}`.
- Panneau "Détail du build" : nouvelle section "ÉQUIPEMENT" (chips) en plus
  de "COMPÉTENCES", pour les builds où c'est disponible.

**Testé avec Playwright** (capture d'écran à l'appui) : un build
InfinityBuilds affiche maintenant ses 10 pièces d'équipement et 6
compétences directement dans notre panneau central, sans avoir à cliquer
le lien externe. **Point d'attention trouvé en testant** : l'analyse
InfinityBuilds à la demande peut prendre **jusqu'à ~15 secondes** (lancement
d'un navigateur Playwright côté serveur à chaque appel) - fonctionnel mais
pas instantané, à garder en tête si on veut améliorer la réactivité plus
tard (ex. lancer le navigateur une fois et le réutiliser).

Pour D4Guides/D4Builds (compétences déjà connues sans requête), la section
Équipement reste vide pour l'instant (ces sources n'exposent pas l'objet
dans leur liste) - pas de message d'erreur inutile, juste la section
masquée.

## Impasse documentée : analyse de builds Maxroll (2026-09-20)

Tentative longue et finalement interrompue de reproduire la même analyse
pour Maxroll. Résumé pour ne pas répéter le travail :

- Maxroll intègre chaque guide à un **planner interactif propre**
  (`https://maxroll.gg/d4/planner/<id>`, données via
  `https://planners.maxroll.gg/profiles/load/d4/<id>`), pas un simple
  paperdoll HTML statique comme InfinityBuilds.
- Les compétences y sont stockées comme des **ID numériques internes**
  (ex. `"414":1` dans `skillTree.steps[].data`) sans rapport avec le fichier
  de données de jeu public (`assets-ng.maxroll.gg/d4-tools/game/
  data.enus.json`, exploré en détail - contient bien une table `skills`
  mais indexée par clé texte type `Sorcerer_Spark`, pas par les ID
  numériques du planner).
- Les icônes de compétences dans le DOM du planner (classe stable
  `.skill-slot_SkillSlot__14SJs`) n'ont **aucun texte/alt/aria-label** -
  seulement une image de fond dont l'URL contient un ID numérique différent
  (ex. `3300682957.webp`) popur ce format d'assets.
- **Découverte utile pour plus tard** : ce même ID numérique d'icône
  (`3300682957`) a été retrouvé à l'identique dans la réponse de l'API
  D4Guides (`"icon_path":"/assets/img/skills/loh/3300682957.webp"` pour
  "Lightning Storm") - laisse penser qu'un dictionnaire ID-icône -> nom de
  compétence, construit en accumulant les données déjà scrappées de
  D4Guides/D4Builds au fil du temps, pourrait un jour décoder les barres de
  compétences Maxroll **sans avoir besoin d'interagir avec leur interface**.
  Piste non exploitée faute de temps - pas assez de compétences accumulées
  pour l'instant pour être fiable.
- Le nom de compétence EST bien lisible en survolant une icône dans le
  planner (infobulle `.d4t-skill-name`, confirmé par capture d'écran avec
  2 résultats corrects et différents pris isolément). Mais automatiser la
  lecture des 6 compétences d'affilée dans une seule session Playwright a
  échoué de façon reproductible (les 6 lectures renvoient systématiquement
  le même nom, y compris en rechargeant complètement la page entre chaque
  tentative) - cause exacte non identifiée, possiblement lié au fait que ce
  planner semble se synchroniser avec un personnage en jeu en direct
  ("Sync"/"Live Now" visibles dans l'interface).
- **Décision** : abandonné pour l'instant plutôt que de livrer une
  extraction non fiable. Maxroll reste dans la liste des sources
  "compétences non disponibles", au même titre que kami-labs/talion.tv.

## Vraie clarification de la demande : équipement complet par emplacement (2026-09-20)

Après plusieurs allers-retours ("j'ai l'impression que tu ne comprends pas
ma demande"), l'utilisateur a montré une capture d'écran de la page
D4Guides d'un build ("Dance of Knives") : liste d'équipement complète par
emplacement (Casque, Torse, Gants... avec le nom exact de l'objet/aspect),
système de talisman, runes. Ça a clarifié ce qui manquait : notre panneau
"Détail du build" n'affichait qu'une liste plate de mots-clés de
compétences, sans équipement structuré par emplacement.

Piste alternative de l'utilisateur en cours de route : simplement afficher
la page source dans une iframe. **Vérifié et rejeté** : D4Guides envoie
`content-security-policy: frame-ancestors 'none'` et `x-frame-options:
SAMEORIGIN` - le site interdit explicitement d'être affiché dans un cadre
externe, ce n'est pas un choix de notre part. Reconstruire le contenu
nous-mêmes (comme déjà fait pour les compétences) reste la seule option.

**Découverte clé** : en espionnant les requêtes réseau de la vraie page de
build D4Guides (même méthode que pour talion.tv/helltides), trouvé
`https://d4guides.gg/api/v1/builds.php?id=<uuid>&lang=en` - un endpoint de
détail PAR BUILD bien plus riche que l'endpoint de liste déjà utilisé :
objet exact par emplacement (`gear_setup`, avec rareté/tempering/gemmes),
liste de compétences (`skill_slots`, en IDs numériques), paragon, runewords,
talisman, texte du guide (`guide_html_en`)... Un endpoint `gear-slots.php`
donne la correspondance ID d'emplacement -> nom ("1"->"Helm" etc.), et
`skills.php?class_id=X` la correspondance ID de compétence -> nom par
classe (mis en cache en mémoire, ces référentiels changent rarement).

- `BuildResult` a deux nouveaux champs : `external_id` et
  `external_class_id` (identifiants internes D4Guides nécessaires pour
  appeler ce nouvel endpoint) - remplis gratuitement dans `d4guides.py`
  (déjà présents dans la réponse de liste). Corrigé au passage : l'URL de
  build utilisait le `slug` à suffixe de saison qui fait une redirection
  301 - utilise maintenant directement le `canonical_slug`.
- `app\build_analysis.py` : `fetch_build_details()` gère maintenant
  D4Guides en plus d'InfinityBuilds - **httpx seulement, pas de
  Playwright**, donc beaucoup plus rapide que l'analyse InfinityBuilds
  (~15s) pour ce cas.
- Frontend : les sources "riches" (InfinityBuilds, D4Guides) sont
  maintenant **toujours** ré-interrogées via `/api/analyze-build` au clic,
  même quand des compétences étaient déjà connues gratuitement (elles
  n'incluent jamais l'équipement) - `pickAnalyzableBuild()` les préfère
  aussi en premier pour les groupes de consensus multi-sources.

**Testé** : cliquer sur le build D4Guides "Dance of Knives" affiche
maintenant 11 emplacements d'équipement (Casque : Cowl of the Nameless,
Torse : Aspect of Debilitating Toxins, etc.) + 6 compétences, correspondant
exactement à la capture d'écran fournie par l'utilisateur - vérifié par
capture d'écran de notre propre interface. Petite imperfection notée :
quelques noms d'objets reviennent en allemand malgré `lang=en` (donnée
incomplète côté D4Guides, pas un bug ici).

## Pivot majeur : script Tampermonkey + InfinityBuilds comme "traducteur universel" (2026-09-20)

Après le blocage définitif sur l'iframe (tous les sites sauf talion.tv/
InfinityBuilds bloquent explicitement l'affichage en cadre externe, voir
plus haut), l'utilisateur a proposé une meilleure architecture :
- Un **script Tampermonkey** qui s'exécute directement dans la page du
  site consulté (plus de problème de CSP/iframe puisqu'on est DANS la
  page, pas en train de l'encadrer depuis l'extérieur).
- Au lieu d'apprendre à lire le format de 6 sites différents, le script ne
  récupère que le **titre** du build (universel), et notre serveur local
  cherche l'équivalent sur **InfinityBuilds** (la seule source qu'on sait
  déjà lire intégralement et de façon fiable) pour en tirer l'équipement/
  les compétences et générer le filtre.

### Nouveau backend

- `app\infinitybuilds_match.py` : `find_matching_build(titre, classe)` -
  réutilise la même logique de similarité de titres que le consensus
  (`app\consensus.py`, `_signature`/`_similarity`) pour retrouver le
  build InfinityBuilds le plus proche d'un titre libre. **Bug trouvé et
  corrigé en testant** : filtrer strictement par classe excluait à tort
  les builds InfinityBuilds dont la classe n'a pas pu être détectée depuis
  l'URL (limite connue depuis le 2026-09-19) - corrigé pour garder ces
  builds "classe inconnue" comme candidats plutôt que de les exclure.
- `/api/tampermonkey/translate?title=...&game_class=...` (nouvel endpoint
  dans `main.py`) : trouve le build InfinityBuilds correspondant, récupère
  son détail (`build_analysis.fetch_build_details`), génère le filtre
  (compétences seules, pas de stats - le script n'a pas d'interface pour
  les choisir), renvoie tout en un seul appel.
- Middleware CORS ajouté (`allow_origins=["*"]`) puisque le script sera
  appelé depuis n'importe lequel des 6 domaines de sites différents.

**Testé avec succès** : "Dance of Knives Rogue Endgame Build Guide" ->
trouve "Dance Of Knives" sur InfinityBuilds, récupère 11 objets + 6
compétences, génère un filtre valide. Idem pour "Blazing Scream Warlock"
(1/6 compétences reconnues avec ID confirmé, cohérent avec la limite déjà
connue : seul le Démoniste a des ID de compétences confirmés).

### Script Tampermonkey (`userscript\diablo4-assistant.user.js`)

Bouton flottant injecté sur les 6 sites (`@match` sur les 6 domaines) qui
lit le `<h1>` de la page (ou `document.title` en repli), devine la classe
par mots-clés FR/EN dans l'URL/titre, appelle le nouvel endpoint via
`GM_xmlhttpRequest`, et affiche le résultat (équipement, compétences, code
de filtre + bouton copier) dans un panneau flottant injecté dans la page -
sans changer d'onglet.

**Vérifié avec Playwright** (bouton + panneau injectés sur une vraie page
d4builds.gg, rendu visuel confirmé par capture d'écran - identique au
style du site). **Limite de test trouvée et documentée honnêtement** :
Playwright ne permet pas de tester une vraie extension Tampermonkey, donc
l'appel réseau réel (`GM_xmlhttpRequest`) n'a pas pu être vérifié de bout
en bout ici. En simulant l'appel avec un `fetch()` classique à la place
(pour tester le reste du script), Chrome a bloqué la requête avec
l'erreur **"Private Network Access"** ("Permission was denied for this
request to access the `loopback` address space") - une protection
récente de Chrome contre les sites publics qui appellent du 127.0.0.1.
Ajouté l'en-tête `Access-Control-Allow-Private-Network: true` côté
serveur en défense supplémentaire, mais **`GM_xmlhttpRequest` (utilisé
par le vrai script) s'exécute hors du bac à sable de la page et n'est
normalement pas soumis à cette vérification** - c'est justement la raison
d'être de cette API pour les scripts Tampermonkey qui parlent à un
service local. Reste à confirmer avec un vrai test en conditions réelles
(Tampermonkey installé dans un vrai navigateur).

**Installation pour tester** : installer l'extension Tampermonkey, créer
un nouveau script et coller le contenu de
`E:\DiabloIV-Assistant\userscript\diablo4-assistant.user.js` (ou l'ouvrir
directement depuis le gestionnaire Tampermonkey) - le serveur local doit
tourner (raccourci bureau).

## 2026-09-20 (suite) - Traduction FR exacte + kami-labs dans le script Tampermonkey

Script confirmé fonctionnel par l'utilisateur en conditions réelles
(bouton visible, panneau généré) - bouton/panneau déplacés du bas-droite
vers le haut-gauche (`#d4a-fab`/`#d4a-panel`, CSS `top/left` au lieu de
`bottom/right`).

Puis demande : utiliser InfinityBuilds ET kami-labs pour traduire la page
consultée avec les **termes exacts du client FR**, plutôt que les noms
anglais bruts affichés jusqu'ici dans le panneau.

**Décision de portée** (confirmée par l'utilisateur après coup : *"on fait
la traduction de la page en cours on laisse tombé la page en local"*) -
cet effort ne touche QUE le script Tampermonkey / `/api/tampermonkey/
translate`, pas le dashboard 3 colonnes local (`/api/analyze-build`,
`app/static/`), qui reste tel quel et n'est plus la priorité.

Changements :
- `app/build_analysis.py` : `_fetch_infinitybuilds_details` charge
  maintenant la page InfinityBuilds EN (comme avant, pour le matching des
  affixes de compétence - `SKILL_AFFIX_IDS` est en anglais) PUIS la même
  page en `/fr/` (swap d'un segment d'URL, même technique que
  `app/fr_en/build_dictionary.py`) pour l'affichage. `BuildDetails` gagne
  `skills_fr`/`items_fr` (retombent sur l'anglais si la page FR ne répond
  rien), `skills`/`items` restent anglais et inchangés pour ne pas casser
  le dashboard.
- Bug trouvé en testant : `HEADER_RE` dans `app/fr_en/extractor.py`
  n'acceptait que `[A-Z0-9 '\-]`, donc un en-tête français accentué comme
  "SPÉCIALISATION" ne stoppait jamais l'extraction des compétences - la
  liste FR débordait sur la section suivante (nom de spécialisation +
  description complète de la compétence ultime en trop). Passé à
  `[A-ZÀ-Ÿ0-9 '\-]`. Invisible côté dictionnaire FR/EN car son `zip()`
  tronque silencieusement à la longueur de la liste anglaise (jamais
  affectée, ses en-têtes ne sont pas accentués) - seul l'affichage direct
  l'exposait.
- `app/title_match.py` (nouveau) : la logique de correspondance floue de
  titre (déjà dans `app/infinitybuilds_match.py`) factorisée en une
  fonction générique `find_best_title_match(candidates, title, game_class)`
  pour être réutilisée sans dupliquer le code.
- `app/kamilabs_match.py` (nouveau) : même principe qu'InfinityBuilds mais
  contre les ~400 builds kami-labs (écrits par la communauté FR, pas
  traduits automatiquement) - sert de "deuxième avis" sur la terminologie,
  pas de source de détail (pas d'API par build connue pour kami-labs).
- `app/main.py` `/api/tampermonkey/translate` : génère le filtre depuis
  les compétences anglaises (`skills_en`, inchangé), mais renvoie
  `skills`/`items` en français (`skills_fr`/`items_fr`) pour l'affichage,
  plus `kamilabs_title`/`kamilabs_url` si une correspondance a été trouvée.
- Script Tampermonkey : affiche un lien "Vérifier aussi sur kami-labs"
  quand une correspondance existe.

**Vérifié en conditions réelles** (serveur relancé, un ancien processus
tournait encore sur le port 8000 avec l'ancien code - tué avant de
retester) : `Rain Of Arrows` (Voleur, InfinityBuilds) → compétences FR
correctement extraites ("Imprégnation de givre", "Bombe fumigène", "Pas de
l'ombre", "Dissimulation", "Sombre voile", "Pluie de flèches" - confirmé
en UTF-8 valide au niveau des octets bruts, un `�` affiché dans certains
tests n'était qu'un artefact d'affichage de la console Windows, pas une
vraie perte de données) et correspondance kami-labs trouvée automatiquement
("Build Voleur PLUIE DE FLECHES POLYVALENT").

## 2026-09-20 (suite 2) - Script Tampermonkey autonome, sans serveur local

Demande : faire fonctionner le script sans avoir besoin du serveur local
(`app/main.py`) du tout - plus de raccourci à lancer avant d'utiliser le
script.

**Obstacle identifié et confirmé avec l'utilisateur avant de coder** : ce
que faisait Playwright (un vrai navigateur qui charge la page InfinityBuilds
pour lire son contenu une fois rendu par React) ne peut pas être remplacé
par un simple iframe caché dans le script - un script ne peut pas lire le
contenu d'un iframe d'une autre origine (bloqué par la politique de même
origine du navigateur, même avec les droits élevés de Tampermonkey). Après
validation de l'utilisateur, solution retenue : un onglet furtif en
arrière-plan (ouvert et refermé automatiquement) sur la page InfinityBuilds
concernée - le script s'y exécute aussi (il cible déjà ce site) et renvoie
le résultat à l'onglet d'origine.

Découvertes en creusant avant de coder :
- La liste des builds InfinityBuilds (tier list) est en fait **déjà rendue
  côté serveur** - vérifié en récupérant le HTML brut sans navigateur :
  elle contient un bloc JSON-LD `ItemList` propre (titre + url) et le
  balisage des ancres avec `aria-label="Tier X builds"` (section parente)
  et `style="--chip-class:...--color-class-<classe>"` (couleur de la
  puce). Donc plus besoin de Playwright pour cette partie, juste une
  requête + `DOMParser` - et cette méthode de détection de classe est même
  **meilleure** que l'ancienne (basée sur le slug d'URL) : elle a
  correctement identifié la classe d'un build à slug opaque
  (`/en/builds/_6EfxV8ono` → Spiritborn) que l'ancien scraper Python ne
  savait pas classer.
- La page de DÉTAIL d'un build (équipement/compétences), elle, n'est PAS
  rendue côté serveur (React côté client uniquement) - confirmé en
  cherchant les classes CSS attendues (`gear-paperdoll-tile`, etc.) dans le
  HTML brut : absentes. D'où le besoin de l'onglet furtif pour cette seule
  partie.

Réécriture complète de `userscript/diablo4-assistant.user.js` (v2, plus
aucun appel à `127.0.0.1:8000`) :
- Recherche + correspondance de titre (`_signature`/`_similarity` de
  `app/consensus.py`, `app/title_match.py`) : portée en JS, dictionnaire
  FR/EN (`app/data/fr_en_dictionary.json`, 209 entrées) intégré tel quel
  dans le script (snapshot statique - à régénérer manuellement si le
  dictionnaire grandit).
- Liste InfinityBuilds : `GM_xmlhttpRequest` + `DOMParser`, comme décrit
  ci-dessus.
- Liste kami-labs : même API JSON qu'avant (`app/scrapers/kamilabs.py`),
  appelée directement en JS.
- Détail InfinityBuilds (équipement + compétences, EN et FR) : onglet
  furtif via `GM_openInTab`, relais du résultat entre onglets via
  `GM_setValue`/`GM_addValueChangeListener` (le stockage Tampermonkey est
  partagé entre tous les onglets exécutant le script, quelle que soit leur
  origine - exactement ce qu'il fallait pour ce relais). L'onglet se
  referme automatiquement une fois le résultat envoyé.
- Génération du filtre de butin : l'encodeur Protobuf
  (`app/loot_filter/codec.py`, lui-même un port de
  Upsilon72/d4-filter-generator) est réécrit directement en JS dans le
  script.

**Vérifié avant de livrer** (sans navigateur réel - cette partie reste à
tester en conditions réelles par l'utilisateur, comme la v1) :
- Port du matching de titre + génération de filtre testés dans Node.js
  directement : `"Rain Of Arrows"` et `"Pluie de Fleches"` donnent la
  même signature (grâce au dictionnaire FR/EN) → similarité 1.0, et le
  code de filtre généré pour Rogue/Rain of Arrows est **identique
  octet pour octet** à celui produit par le serveur Python testé plus tôt
  dans la session - confirme que le port JS du codec est correct.
- Logique d'extraction de la tier list rejouée en Python (BeautifulSoup)
  sur le HTML brut réel du site : 24/24 builds correctement extraits avec
  tier et classe, 0 manquant.
- `node --check` sur le fichier final : syntaxe valide.

Comme la v1, l'extraction en onglet furtif (`GM_openInTab` +
`GM_setValue`/`GM_addValueChangeListener`) n'a pas pu être testée de bout
en bout sans un vrai navigateur avec Tampermonkey installé - à confirmer
par l'utilisateur. Les `@grant` ont changé (ajout de `GM_openInTab`,
`GM_setValue`, `GM_deleteValue`, `GM_addValueChangeListener`,
`GM_removeValueChangeListener`, `@connect infinitybuilds.gg`/`kami-labs.fr`,
retrait de `@connect 127.0.0.1`) - Tampermonkey redemandera probablement
une autorisation pour le script mis à jour.

## 2026-09-20 (suite 3) - Deux boutons séparés : Traduire / Générer le filtre

Demande : un bouton dédié à la traduction, séparé de la génération du
filtre - jusqu'ici une seule action ("Générer le filtre") faisait les deux
en même temps.

Refactor de `runAnalysis()` en trois fonctions : `resolveTranslation()`
(partie commune et lente - recherche du build équivalent + lecture
équipement/compétences via onglet furtif), `runTranslate()` (nouveau
bouton "🇫🇷 Traduire" - affiche juste équipement/compétences en français,
sans filtre), et `runGenerateFilter()` (bouton "⚔ Générer le filtre"
existant, inchangé dans son résultat final). Les deux boutons sont
maintenant empilés en haut à gauche (`.d4a-fab-btn` commun, `#d4a-fab-
translate` au-dessus de `#d4a-fab-filter`), panneau décalé en conséquence.

Vérifié : `node --check` sur le fichier final, pas de référence résiduelle
à l'ancien id `#d4a-fab` unique.

## 2026-09-20 (suite 4) - Bug de détection de titre sur Maxroll

Testé par l'utilisateur sur Maxroll ("Dance of Knives" Rogue) : le bouton
"Traduire" a répondu "Aucun build équivalent trouvé... pour DIABLO IV" -
`guessTitle()` avait pris le premier `<h1>` de la page, qui sur Maxroll
est un titre de marque générique du site ("Diablo IV"), pas le titre du
build (qui est dans un `<h1>` PLUS LOIN dans le DOM).

Corrigé en deux temps :
1. `guessTitle()` se base maintenant sur `document.title` en priorité (pas
   le premier `<h1>` de la page) - fiable sur les deux sites vérifiés
   (D4Builds, Maxroll). Un `<h1>` n'est utilisé qu'en repli, et on prend
   alors le plus long plutôt que le premier.
2. Le `document.title` de Maxroll ajoute systématiquement
   "... for Diablo IV Season N - <nom du thème de la saison>" - le nom du
   thème (ex. "Hell's Legacy", change chaque saison, pas listable comme
   mot-bruit fixe) faisait tomber la similarité sous le seuil (0.33 au
   lieu de 0.5 requis). Ajouté un nettoyage regex qui coupe tout après
   "for Diablo IV/4" (robuste aux futurs noms de saison), plus "diablo" et
   "for" ajoutés aux mots-bruit (`NOISE_WORDS`) en filet de sécurité - dans
   le script ET dans `app/consensus.py` pour garder les deux implémentations
   cohérentes (même si `for`/`diablo` sont peu probables dans nos propres
   titres scrapés, ça ne coûte rien de les exclure partout).

Vérifié dans Node.js avec les vrais `document.title` de Maxroll et
D4Builds : similarité à 1.0 pour les deux contre le build InfinityBuilds
correspondant (avant le fix : 0.33 pour Maxroll, sous le seuil). Aucune
régression sur le test Rain of Arrows / Pluie de Flèches déjà validé.

## 2026-09-20 (suite 5) - Remplacement des noms directement sur la page

Demande : remplacer les noms précis (objets/compétences) directement sur
la page consultée, et laisser la traduction native de Chrome (débloquée
plus tôt dans la session) gérer le reste du texte - combine les deux
approches déjà discutées plutôt que de choisir l'une ou l'autre.

Ajouté au bouton "🇫🇷 Traduire" (`userscript/diablo4-assistant.user.js`) :
- `buildNameMap(itemsEn, itemsFr, skillsEn, skillsFr)` : associe chaque nom
  anglais d'InfinityBuilds à son équivalent français, par position (même
  logique d'appariement que `app/fr_en/extractor.py`'s `extract_pairs` -
  les deux extractions EN/FR viennent de la même structure de page, juste
  localisée différemment).
- `applyPageTranslation(nameMap)` : parcourt tous les nœuds de texte de la
  page (`TreeWalker`, en excluant `<script>`/`<style>`/nos propres
  éléments), remplace chaque nom anglais trouvé par son équivalent
  français - du plus long au plus court pour qu'un nom plus spécifique ne
  soit jamais coupé par un nom plus court contenu dedans.
- Le panneau indique combien de noms ont été remplacés sur la page.

`node --check` OK. Cette partie manipule le DOM réel de la page visitée -
n'a pas pu être testée sans navigateur, à valider par l'utilisateur.

## 2026-09-20 (suite 6) - Traductions effacées par le re-rendu React de D4Builds

Testé par l'utilisateur sur Maxroll : le panneau annonçait "111 nom(s)
remplacé(s)" et une phrase de texte libre était bien traduite ("Dance of
Knives" → "Danse des poignards" dans un paragraphe), mais la section
Équipement elle-même est restée en anglais.

Diagnostic : D4Builds/Maxroll sont des sites React - la section Équipement
se re-génère depuis les données internes du site (pas depuis le DOM) à
chaque interaction (changement d'onglet Starter/Midgame/Endgame/...), ou
n'était même pas encore montée dans le DOM au moment du clic sur
"Traduire" (montage différé par onglet). Dans les deux cas, React écrase
notre modification directe du texte, ou notre passage initial n'a jamais vu
ces nœuds.

Corrigé : `applyPageTranslation` (renommée en interne, logique déplacée
dans `translateTextIn(root, nameMap)`, réutilisable sur n'importe quel
nœud) démarre maintenant un `MutationObserver` sur `document.body` qui
réapplique la même carte de noms à tout contenu nouvellement ajouté ou
modifié - donc un changement d'onglet ou un rendu différé sur le site est
retraduit automatiquement, tant que la page reste ouverte. Pas de boucle
infinie : un texte déjà traduit ne contient plus le nom anglais, donc un
second passage dessus ne déclenche aucune modification (et donc aucune
nouvelle mutation).

`node --check` OK - à revalider par l'utilisateur en conditions réelles
(changer d'onglet sur D4Builds/Maxroll après avoir cliqué "Traduire" et
vérifier que la traduction persiste).

## 2026-09-20 (suite 7) - Vrai bug trouvé : préfixe "Aspect of" manquant

Le `MutationObserver` n'a pas suffi : toujours aucun nom traduit dans la
section Équipement sur une nouvelle capture de l'utilisateur (le
paragraphe libre, lui, restait bien traduit). Le vrai problème n'était pas
le re-rendu React mais un **désaccord de format entre sites** :
InfinityBuilds nomme les aspects avec leur forme complète ("Aspect of
Debilitating Toxins"), alors que D4Builds les affiche sans le préfixe
("Debilitating Toxins" seul, `Legendary Chest Armor` en dessous). Une
correspondance par sous-chaîne ne peut jamais matcher dans ce sens : le
texte affiché (court) ne peut pas "contenir" le nom complet (plus long).

Corrigé dans `buildNameMap()` (`userscript/diablo4-assistant.user.js`) :
pour chaque paire EN/FR commençant par "Aspect of"/"Aspect de"/"Aspect
d'", une seconde paire est ajoutée avec ce préfixe retiré des deux côtés
("Debilitating Toxins" → "toxines incapacitantes"). Vérifié en Node.js sur
les vrais noms observés dans les captures ("Aspect of Debilitating
Toxins" → "Debilitating Toxins" / "Aspect de toxines incapacitantes" →
"toxines incapacitantes", idem pour "Aspect d'imitation d'imprégnation").

`node --check` OK - à revalider par l'utilisateur.

## 2026-09-20 (suite 8) - Protection contre la traduction Chrome + bouton Google Translate

Confirmé par l'utilisateur : le remplacement des noms fonctionne
maintenant sur D4Builds. Demande suivante : un bouton Google Translate,
avec la garantie que Google ne réécrase pas les noms précis qu'on injecte.

Point important clarifié avec l'utilisateur : il n'existe pas d'API
permettant à un script de déclencher la traduction native de Chrome sur
l'onglet en cours (fonctionnalité interne au navigateur, pas exposée aux
pages/extensions) - seul un clic utilisateur (icône dans la barre
d'adresse, ou clic droit) peut le faire.

Ce qui a été fait :
- `translateTextNode()` (`userscript/diablo4-assistant.user.js`) ne fait
  plus une simple substitution de texte : elle découpe le nœud de texte et
  enveloppe chaque nom remplacé dans un `<span translate="no"
  class="notranslate">` - l'attribut HTML standard que la traduction
  native de Chrome (et le widget Google Translate) respecte pour ignorer
  un bout de contenu. Gère aussi les chevauchements entre la forme longue
  ("Aspect of X") et la forme courte ("X") d'un même nom en ne gardant que
  le match le plus long à une position donnée.
  `translateTextIn()` et son `TreeWalker` ignorent désormais aussi tout ce
  qui est déjà sous `[translate="no"]`, pour ne pas retraiter nos propres
  insertions en boucle (déjà sans risque de boucle infinie de toute façon,
  puisqu'un texte déjà traduit ne contient plus de nom anglais à
  matcher - mais plus propre/efficace ainsi).
- Nouveau bouton "🌐 Google Translate" (3e bouton, empilé sous les deux
  autres) : ouvre `translate.google.com/translate?...` dans un nouvel
  onglet, via `GM_openInTab`. Explicitement documenté (commentaire +
  tooltip du bouton) que cette page est une copie fraîche récupérée par
  Google - elle NE contient PAS nos noms déjà injectés sur l'onglet actuel
  (document différent). Le vrai bénéfice du `translate="no"` se voit en
  utilisant la traduction native de Chrome sur le MÊME onglet, après avoir
  cliqué "Traduire" en premier.

`node --check` OK. Pas pu tester la préservation réelle par la traduction
Chrome ni le rendu du nouvel onglet Google Translate sans navigateur - à
valider par l'utilisateur.

## 2026-09-20 (suite 9) - Traduction du reste du texte SANS changer d'onglet

L'utilisateur a remis en question l'affirmation "impossible de traduire en
restant sur la page" : à raison - ce n'est vrai QUE pour déclencher la
fonctionnalité native de Chrome par script (aucune API pour ça). Rien
n'empêche en revanche d'appeler nous-mêmes le service de traduction de
Google directement (le même moteur que Chrome utilise en interne) et
d'injecter le résultat dans le DOM, sans quitter l'onglet.

Testé cet accès en direct (`curl` vers
`translate.googleapis.com/translate_a/single`) avant de coder : **bloqué**
par Google ("Sorry... your computer or network may be sending automated
queries") - confirmé que c'est un point d'accès non-officiel avec
détection anti-robot. Expliqué à l'utilisateur qu'un clic de souris ne
change rien à la requête HTTP elle-même (pas de "jeton humain" dans ce
genre d'appel) - ce qui compte, c'est le contexte de la requête (IP,
cookies, empreinte navigateur, volume), très différent entre un test
`curl` depuis un environnement cloud et un vrai navigateur utilisateur.
Décidé d'implémenter quand même, avec un repli propre en cas d'échec.

Remplace le bouton "🌐 Google Translate" (qui ouvrait un nouvel onglet) par
"🌐 Traduire la page" qui reste sur l'onglet actuel :
- `collectTranslatableTextNodes()` : récupère tous les nœuds de texte
  traduisibles, en excluant tout ce qui est déjà protégé par
  `translate="no"` (les noms précis injectés par "Traduire" restent donc
  intacts).
- `translateBatchLines(lines)` : regroupe plusieurs nœuds par requête (15
  à la fois) en les joignant par des retours à la ligne (Google traite un
  retour à la ligne comme une frontière de phrase), pour limiter le nombre
  de requêtes. Si le nombre de lignes traduites reçues ne correspond pas à
  ce qui a été envoyé (Google a fusionné/scindé des lignes), le lot entier
  est ignoré plutôt que de risquer d'associer la mauvaise traduction au
  mauvais nœud.
- `runTranslatePageText()` : orchestre les lots, affiche le nombre de
  blocs traduits et signale les lots en échec (avec suggestion de
  recourir à la traduction native de Chrome en repli).

Ajouté `@connect translate.googleapis.com`. `node --check` OK. Cette
fonctionnalité dépend d'un service non garanti par Google - peut
fonctionner chez l'utilisateur même si bloqué dans l'environnement de
test ; à valider en conditions réelles.

## 2026-09-21 - Filtre de butin en deux paliers (2 et 3 affixes)

Demande : rendre le filtre de butin plus précis avec deux règles - une
pour un Rare avec 2 affixes voulus, une pour 3 - plutôt que la règle
unique actuelle ("≥1 affixe de compétence").

Recherche pour savoir d'où tirer la liste d'affixes voulus par pièce (pas
juste les compétences) :
- **InfinityBuilds** : aucune section de priorité de stats par build, pas
  de filtre natif exposé par build (le lien "Loot Filters" pointe vers la
  page générale du site).
- **D4Guides** (API) : un champ `loot_filter` existe bien dans la réponse
  JSON d'un build (`builds.php?id=...`), mais vide sur les 10 builds
  testés - jamais rempli par les auteurs. `paragon_setup` et
  `talisman_setup` sont eux bien peuplés (piste à noter pour le problème
  Paragon/Talisman non résolu, voir plus bas).
- **D4Builds** : a un onglet "Stat Priority" avec une vraie liste
  numérotée d'affixes par pièce d'équipement - mais pas systématique
  (absent sur "Dance of Knives", présent sur d'autres builds - dépend de
  l'auteur). Confirmé par une capture d'écran de l'utilisateur montrant le
  contenu réel (ex. Gants "Aspect d'imitation d'imprégnation" → "1. x28%
  Vulnerable Damage Multiplier, 2. x60% Damage Over Time Multiplier, 3.
  x24% Poison Damage Multiplier, 4. Ranks to Danse des poignards").

Décision : lire cette liste directement sur LA PAGE CONSULTÉE (pas besoin
de passer par InfinityBuilds pour cette partie), et regrouper tous les
affixes mentionnés, toutes pièces confondues, en un seul lot dédupliqué -
le format natif du filtre D4 ne permet de toute façon pas de cibler une
pièce précise ("un Rare avec N affixes de cette liste", pas "CETTE pièce
avec CES affixes"), donc rester par-pièce n'aurait rien changé au résultat
concret.

Implémenté dans `userscript/diablo4-assistant.user.js` :
- Table `AFFIX_IDS` (77 stats universelles, portée depuis
  `app/loot_filter/data.py`) ajoutée au script - jusqu'ici absente car
  jamais utilisée côté script (seules les compétences l'étaient).
- `findPriorityAffixIds()` : cherche un élément dont le texte exact est
  "Stat Priority" sur la page courante, le clique (lui + ses 2 parents,
  pour maximiser les chances de toucher le vrai gestionnaire de clic),
  attend 1,2s, puis passe tout `document.body.innerText` au crible d'une
  regex `/^\s*\d+\.\s*(.+)$/gm` (lignes numérotées) - fonctionne même si le
  clic sur l'onglet échoue ou si la structure DOM diffère d'un site à
  l'autre, puisque seul un texte qui correspond réellement à un affixe
  connu est retenu (le bruit comme "1. Introduction" dans une table des
  matières ne matche jamais rien et est silencieusement ignoré).
- `normalizeAffixText()` : nettoie un texte libre ("x28% Vulnerable Damage
  Multiplier" → "Vulnerable Damage Multiplier") et gère un renommage
  connu par classe ("Deadly Strike Chance" = nom Voleur de "Critical
  Strike Chance").
- `generateFilterCode()` : remplace la règle unique par deux règles
  (`≥2` orange, `≥3` or - l'or passant après donc prioritaire sur
  l'orange), avec repli sur l'ancienne règle `≥1` si un seul affixe est
  connu au total (une règle `≥2` ne se déclencherait jamais dans ce cas).
  Le panneau indique quels affixes de priorité ont été détectés sur la
  page, ou prévient qu'aucun n'a été trouvé.

**Vérifié dans Node.js** avec les vraies lignes de la capture
utilisateur : 13 affixes réels correctement reconnus ("Dexterity",
"Maximum Life", "Vulnerable Damage Multiplier", "Deadly Strike Chance" →
"Critical Strike Chance", etc.), tout le bruit correctement ignoré
("Unique Effect", "Ranks to Imbuement Skills", "+1 Charm Slot", "Ranks to
Danse des poignards"). `node --check` OK.

Point non résolu, mentionné par l'utilisateur mais mis de côté pour
l'instant : traduction des sections Paragon (rendu graphique sur
InfinityBuilds, pas de texte à lire - mais `paragon_setup` existe côté
API D4Guides, piste à explorer si besoin) et Talisman (texte de
recommandation libre sur InfinityBuilds, pas une liste propre - mais
`talisman_setup` existe aussi côté D4Guides).

## 2026-09-21 (suite) - Traduction Paragon résolue via les icônes kami-labs

L'utilisateur a proposé de regarder les pages de build Voleur sur
kami-labs, où les plaques/glyphes Paragon sont bien traduits en français.

**Méthode trouvée, fiable à 100%** (pas une déduction/un pari) : les
icônes de glyphe sur kami-labs utilisent le nom ANGLAIS comme nom de
fichier (`Versatility.webp`, `Canny.webp`, ...) et le texte alternatif
(`alt`) de l'image donne le nom FRANÇAIS (`"Polyvalence"`, `"Astuce"`,
...) - une paire EN/FR directement lisible dans le HTML, sans avoir à
deviner un ordre ou une correspondance entre deux listes séparées (ce qui
avait échoué plus tôt avec la phrase en prose "Le plan Paragon s'appuie
sur cinq plateaux — Start, Cheap Shot... — chacun exploité avec un
glyphe... : Polyvalence, Contrôle...", où l'ordre entre plateaux et
glyphes n'était pas garanti).

Exploré aussi côté D4Guides (API) pour confirmation : `paragon.php` (avec
`class_id`) existe bel et bien comme table de référence, mais son
paramètre `lang=fr` ne fait rien (renvoie l'anglais tel quel) - testé avec
`lang=de` qui LUI traduit correctement ("Burning Instinct" →
"Brennender Instinkt") : confirme que D4Guides n'a simplement aucune
donnée française pour les plateaux/glyphes Paragon dans leur base, pas un
bug de notre côté. Piste refermée pour de bon.

Exécuté un scan sur les 15 builds Saison 15 de kami-labs (toutes classes),
en extrayant toutes les paires `alt`/nom-de-fichier `d4-icons` de chaque
page : **208 paires EN/FR récupérées d'un coup**, dont 5 glyphes Paragon
confirmés (Versatility→Polyvalence, Control→Contrôle, Canny→Astuce,
Devious→Sournoiserie, Bane→Fléau) et une plaque (Cheap Shot→Coup bas) -
plus une grosse quantité de nouveaux objets/compétences en bonus (fusionnés
dans `app/data/fr_en_dictionary.json`, 209 → 336 entrées après retrait de
10 entrées invalides où le nom de fichier était un ID numérique au lieu
d'un nom).

Dans `userscript/diablo4-assistant.user.js` :
- `FR_EN_DICTIONARY` régénéré avec les 336 entrées (utilisé pour le
  matching de titre - `signature()`/`_similarity()`).
- Nouvelle table séparée `PARAGON_DICTIONARY` (glyphs + boards) : gardée
  À PART du dictionnaire général exprès - "Control", "Combat" sont des
  mots anglais bien trop courants pour être remplacés n'importe où sur la
  page sans risque (le générique "Insight"/"Familiar" présents dans le
  dictionnaire principal ont le même risque, mais ne sont utilisés que
  pour le matching de titre, jamais pour remplacer du texte sur la page -
  Paragon si, donc portée plus stricte nécessaire).
- `findParagonNameMap()` : cherche un panneau "Boards Used" (vu sur
  D4Builds) et ne cherche NOS noms connus QUE dans le texte de ce panneau
  précis, jamais sur toute la page - élimine le risque de faux positif.
  Fusionné dans `buildNameMap()`, donc actif automatiquement avec le
  bouton "Traduire".

`node --check` OK. Pas testé en conditions réelles (nécessite une page
D4Builds avec un panneau "Boards Used" visible) - à valider par
l'utilisateur.

## 2026-09-21 (suite 2) - Collecte étendue à toutes les classes, cache local

Demande : refaire la collecte kami-labs pour les 8 classes, en stockant
les données dans un répertoire local (pas juste 15 builds Saison 15
d'une poignée de classes).

Deux nouveaux scripts réutilisables :
- `scripts/crawl_kamilabs_icons.py` : récupère la liste complète des
  builds kami-labs (393 au total, toutes classes et saisons confondues -
  Barbare 66, Druide 57, Voleur 54, Sorcier 54, Nécromancien 48, Paladin
  45, Sacresprit 43, Démoniste 26) et met en cache le HTML brut de chaque
  page dans `app/data/kamilabs_cache/<slug>.html` (196 Mo au total) -
  relançable sans requêtes réseau inutiles (`skip` si déjà en cache).
  Lancé en tâche de fond (~5 min pour les 393 pages), terminé sans
  aucun échec (393/393).
- `scripts/extract_kamilabs_icons.py` : relit tout le cache local, extrait
  chaque paire `alt` (français) / nom de fichier d’icône `d4-icons`
  (anglais), fusionne dans `app/data/fr_en_dictionary.json` en évitant les
  doublons et en filtrant les entrées invalides (nom de fichier numérique).

Résultat : **569 nouvelles entrées fusionnées, dictionnaire passé de 336 à
905 entrées au total** (objets, compétences, ET Paragon, toutes classes).
Glyphes Paragon restants enfin confirmés : **Efficacy → Efficacité**,
**Tracker → Pistage**, **Ambush → Embuscade** - ce qui résout les deux
correspondances qui restaient incertaines depuis la capture d'écran
D4Builds ("Cheap Shot/Efficacy" et "Exploit Weakness/Tracker"). Deux
plaques Paragon en plus : **Eldritch Bounty → Prime exotique**,
**Exploit Weakness → Abus de faiblesse**.

`PARAGON_DICTIONARY` dans `userscript/diablo4-assistant.user.js` mis à
jour avec ces nouvelles entrées (9 glyphes, 3 plaques confirmés au total
maintenant), `FR_EN_DICTIONARY` régénéré avec les 905 entrées (fichier
final : 105 Ko, toujours raisonnable pour Tampermonkey). `node --check`
OK, aucune entrée invalide restante.

Les deux scripts sont réutilisables (relancer `crawl_kamilabs_icons.py`
périodiquement pour capter les nouveaux builds au fil de la saison, puis
`extract_kamilabs_icons.py` pour les fusionner) - le cache local
(`app/data/kamilabs_cache/`, 196 Mo) peut être supprimé sans perte : les
données utiles sont déjà dans `fr_en_dictionary.json`, seul le
téléchargement serait à refaire.

## Extension de l'extraction de compétences à kami-labs et Maxroll (2026-09-21)

Jusqu'ici, l'extraction gear/compétences (userscript v2) ne marchait QUE via
un onglet caché ouvert sur InfinityBuilds - si aucun build InfinityBuilds ne
correspondait au titre de la page courante (fréquent : InfinityBuilds ne
liste qu'une sélection restreinte de builds), on n'obtenait rien du tout,
même en naviguant directement sur kami-labs ou Maxroll.

Reverse-engineering fait en récupérant de vraies pages de build (curl, pas
de navigateur dans cet environnement) :

- **kami-labs** : le widget "équipement" ("ESRD") de chaque page de build
  n'est PAS un iframe cross-origin comme sur InfinityBuilds, mais un
  fichier statique **même origine** :
  `kami-labs.fr/wp-content/uploads/d4-builds/<buildId>/equipment-grid.html`
  (buildId lu directement sur la page via `#esrd-equipment-iframe[data-build-id]`,
  présent dans le HTML serveur). Ce fichier embarque un unique blob JSON
  `window.ESRD_STATE_V3` avec les noms EN **et** FR déjà appairés pour
  chaque compétence/emplacement d'équipement, répartis en plusieurs étapes
  de build ("Starter"/"Midgame"/"Endgame"/"Push" - la dernière est utilisée,
  la plus aboutie). Une seule requête, les deux langues, sans onglet caché.
- **Maxroll** : chaque page de build-guide contient un unique lien vers son
  propre Maxroll Planner (`maxroll.gg/d4/planner/<id>`, trouvé dans un bloc
  Gutenberg `maxroll/planner-page`). Récupérer cette page de planner donne
  un unique objet JSON `"search_metadata"` avec des tableaux propres de noms
  EN (compétences + objets). Maxroll n'a pas de version FR - les noms
  anglais sont donc passés dans `FR_EN_DICTIONARY` (905 entrées, déjà
  construit pour le title-matching) en repli best-effort, avec de bons
  résultats en pratique (ex. "Wrath of the Berserker" → "Courroux du
  berserker", "Iron Skin" → "Galvanisation").
- Piège trouvé en testant : le nom de fonction de recherche du planner id
  par regex (`d4/planner/<id>`) matchait aussi le lien de navigation du
  site lui-même (`/d4/planner/builds`) - explicitement exclu.

Implémenté dans `userscript/diablo4-assistant.user.js` (v2.0 → v2.1) :
`extractKamiLabsDetail()`, `extractMaxrollDetail()`,
`extractNativeDetail()` (dispatch par `location.hostname`), et un petit
parseur JSON à comptage d'accolades (`extractJsonAfter`) puisqu'une regex
non-gourmande tronque les objets imbriqués. `resolveTranslation()` essaie
d'abord l'extraction native de la page courante ; si elle échoue (site pas
kami-labs/Maxroll, ou embed introuvable), elle retombe sur l'ancien chemin
InfinityBuilds inchangé. Le libellé de source affiché dans le panneau
("Traduit via ... (kami-labs/Maxroll/InfinityBuilds)") est maintenant
dynamique (`result.sourceLabel`) au lieu d'être toujours "InfinityBuilds".
`@connect maxroll.gg` ajouté à l'en-tête Tampermonkey (`@connect kami-labs.fr`
existait déjà).

**Validé hors-navigateur** : logique testée en Node contre de vraies pages
récupérées (build "Flame Charge Barbarian" sur kami-labs et Maxroll, même
build que celui référencé dans la présentation du build kami-labs) -
extraction kami-labs et Maxroll toutes deux correctes (compétences, objets,
étape "Push", repli dictionnaire FR pour Maxroll). `node --check` OK sur le
userscript modifié. **Pas encore testé dans un vrai navigateur/Tampermonkey**
- à faire en priorité à la prochaine session avant de considérer ça acquis.

**talion.tv non traité** : c'est une SPA Angular sans rendu serveur (page
HTML initiale vide, `<app-root></app-root>`) - toutes les données viennent
d'un appel API runtime (`/api/builds/<id>/tabs`, trouvé dans le bundle JS
principal) vers un domaine (`api.talion.tv` ?) qui répond 401 même sur un
endpoint public en requête directe - la vraie base URL/API n'a pas été
retrouvée statiquement. Nécessiterait d'inspecter l'onglet Réseau d'un vrai
navigateur pendant la navigation sur le site pour voir la requête réelle et
ses en-têtes.

## Prochaine étape

- **v2 confirmée fonctionnelle en conditions réelles** (2026-09-20, testée
  par l'utilisateur sur D4Builds - "Dance of Knives - Rogue (S15)") :
  panneau affiché avec équipement/compétences en français exact
  ("Aspect d'obscurité réparatrice", "Danse des poignards", ...) et code de
  filtre généré, entièrement sans serveur local. Aucune correspondance
  kami-labs trouvée pour ce build précis (titre trop différent) - comportement
  normal, pas un bug.
- Question de l'utilisateur ensuite : traduire "toute la page" (titres,
  descriptions, pas juste objets/compétences). Diagnostic : la console de sa
  capture précédente montrait déjà des requêtes bloquées
  (`net::ERR_BLOCKED_BY_CLIENT`) vers `translate.google.com`/
  `translate.googleapis.com` - la traduction native de Chrome essayait déjà
  de se déclencher mais son bloqueur de pub la bloque par erreur.
  Recommandé de débloquer ces domaines et d'utiliser la traduction native de
  Chrome pour le texte général (meilleure qualité, gratuite, déjà
  disponible) plutôt que de coder une traduction générique dans le script -
  **l'utilisateur a choisi cette option**, aucun changement de code fait
  pour cette demande. Notre script reste focalisé sur les objets/compétences
  précis (où un traducteur généraliste se tromperait sur les noms propres).
- Le dashboard local (page 3 colonnes, `app/main.py`) reste disponible
  mais n'est plus la priorité - il n'a pas été touché par ce changement et
  continue de fonctionner indépendamment si besoin.
- Étudier le transport automatique vers le planificateur InfinityBuilds
  personnel de l'utilisateur (le plus gros chantier restant, jamais
  commencé - connexion persistante et structure du formulaire jamais
  explorées).
- **Tester en vrai (navigateur + Tampermonkey)** l'extraction native
  kami-labs/Maxroll ajoutée ce jour (v2.1) - validée seulement en Node hors
  navigateur jusqu'ici, voir section du 2026-09-21 ci-dessus.
- talion.tv reste à faire pour l'extraction de compétences (SPA Angular
  sans rendu serveur, API réelle non retrouvée statiquement - inspecter
  l'onglet Réseau d'un vrai navigateur pour la trouver, voir ci-dessus).
- Explorer l'extraction des stats prioritaires en plus des compétences,
  au moins pour InfinityBuilds (leur propre filtre "View Filter" affiche
  déjà les affixes qui comptent, voir découverte du 2026-09-20 plus haut).
- Si l'utilisateur veut un support complet pour les 7 classes restantes,
  il faudrait qu'il exporte un filtre à une compétence à la fois en jeu et
  qu'on décode le résultat ensemble (méthode déjà documentée par Upsilon72).
- Idée de l'utilisateur en attente (lien + bouton "copier vers Infinity") -
  reprendre en distinguant les deux niveaux de difficulté déjà identifiés :
  bouton "copier un résumé texte" (simple) vs remplissage automatique
  complet du formulaire InfinityBuilds (gros chantier, formulaire jamais
  exploré, connexion persistante jamais mise en place).
- Enrichir le dictionnaire FR<->EN au-delà des 24 builds InfinityBuilds
  pour réduire les groupes dupliqués comme "Tir Pénétrant" ci-dessus.
- Revisiter le classement consensus plus tard dans la saison si les
  votes/commentaires deviennent assez nombreux pour ajouter un signal de
  popularité/sentiment en plus du consensus de tier + classement officiel.
- Décider si on affine la détection de classe InfinityBuilds (visiter
  chaque page de build) ou si on laisse `None` tel quel pour l'instant.
- Repérée en passant, à creuser plus tard : chaque page de build
  InfinityBuilds a une section "LOOT FILTER" / "Loot Filter Code" avec un
  bouton "View Filter" - le site fournit peut-être déjà un code de filtre
  de butin natif prêt à l'emploi par build, ce qui raccourcirait beaucoup
  la brique 4 (génération de filtre) du projet.
- Décider quoi faire pour Mobalytics (laisser de côté, ou en reparler avec
  des moyens plus invasifs que l'utilisateur devra valider explicitement).

## 2026-09-21 (suite 2) - Dictionnaire complet des objets uniques et mythiques

Demande : traduire aussi les objets uniques et mythiques, pas juste ceux
incidemment vus dans les builds déjà scrapés. Clarifié avec l'utilisateur :
il veut la liste COMPLÈTE de tous les uniques/mythiques du jeu (source
canonique), pas juste corriger un cas précis.

**Source trouvée** : Maxroll publie son dump de données de jeu par langue -
`https://assets-ng.maxroll.gg/d4-tools/game/data.<locale>.json` (déjà connu
depuis le 2026-09-20 en `enus`, pour la table `skills`). Vérifié qu'une
version `frfr` existe aussi (200 OK) et contient les mêmes clés que la
version anglaise - texte issu de la vraie localisation Blizzard, pas une
traduction tierce. La table `items` (11 678 entrées au total, très bruitée -
objets de quête, textes UI, etc.) est **keyée par un identifiant interne
stable** (ex. `Chest_Unique_Generic_127` -> "Tyrael's Might"), partagé
identique entre les deux langues - permet un appariement EN/FR fiable par
clé plutôt que par position, contrairement à la technique utilisée
jusqu'ici pour les autres sources.

Filtrage par motif de clé `^<Slot>_Unique_<Classe|Generic>_<numéro>$` :
**287 objets** trouvés. Les Mythiques n'ont pas de tag distinct dans ce
jeu de données (`Chest_Unique_Generic_127`/Tyrael's Might, objet mythique,
suit exactement le même schéma de clé qu'un unique normal) - donc ce seul
filtre couvre déjà uniques ET mythiques, pas besoin d'une passe séparée.
Motif exclut aussi volontairement les variantes préfixées par saison
(`S14_Ring_Unique_Generic_104`) et les doublons "Talisman" (objet identique
sous une autre clé, pour le système de breloques) - un seul nom canonique
par objet.

Piège découvert : les noms français portent un **tag grammatical de genre**
ajouté par l'équipe de localisation pour l'accord des articles (ex.
`[mp]Poings du destin` = masculin pluriel) - retiré par regex avant usage.
Repéré aussi un tag `[PH]`/`[ph]` ("placeholder") sur des objets de quête
non finalisés, hors du périmètre uniques/mythiques donc sans impact ici.

`scripts/build_unique_mythic_dictionary.py` (nouveau) : télécharge les deux
fichiers, extrait 226 paires EN/FR utilisables (61 objets ont un nom
identique dans les deux langues - exclus, aucune valeur ajoutée), fusionne
dans `app/data/fr_en_dictionary.json` avec un nouveau `kind: "unique_item"`
et `source: "maxroll_gamedata"`. **97 entrées nouvelles** (objets jamais vus
dans un build scrapé jusqu'ici) + **27 entrées existantes corrigées** (la
donnée Maxroll fait autorité sur un nom repris incidemment d'un guide
communautaire) - dont 24 n'étaient qu'une différence d'apostrophe courbe
(’) vs droite (') déjà utilisée partout ailleurs dans le dictionnaire
(normalisée au passage), et 3 vrais désaccords de traduction corrigés
(ex. "Doombringer" : "Condamneuse" -> "Condamnatrice", le nom officiel).
Dictionnaire : 905 -> **1002 entrées**.

`scripts/sync_userscript_dictionary.py` (nouveau) : jusqu'ici la ligne
`FR_EN_DICTIONARY` du userscript était régénérée à la main à chaque ajout
("à régénérer manuellement si le dictionnaire grandit", note laissée dans
le fichier) - remplacé par un script qui réécrit cette seule ligne depuis
`fr_en_dictionary.json`, plus sûr vu la taille croissante (1002 entrées
maintenant). `PARAGON_DICTIONARY` reste intentionnellement à part, non
touché par ce script (toujours géré à la main, voir raison déjà documentée
dans le fichier).

**Impact fonctionnel réel, pas juste plus de données** : le dictionnaire
sert déjà à deux endroits actifs du userscript - (1) le rapprochement de
titre entre sites (signature/similarité), et (2) le **repli FR pour
Maxroll**, qui n'a pas de version française de ses pages de build et
traduit donc chaque objet via une recherche dans ce dictionnaire
(`itemsEn.map(lookupFr)`, voir 2026-09-21 plus haut). Ce repli ne couvrait
avant que les objets déjà croisés ailleurs - il couvre maintenant
**tous** les uniques/mythiques du jeu, y compris ceux qu'aucun build
scrapé n'avait encore fait apparaître.

`node --check` OK, vérifié dans Node.js que le JSON embarqué reste valide
et que des uniques connus (Doombringer, Tyrael's Might, Harlequin Crest)
s'y trouvent bien avec leur nom FR correct (octets UTF-8 vérifiés
directement, pas fiés à l'affichage de la console). Version du userscript
passée à 2.2. **Pas testé en conditions réelles** (nécessite un build
Maxroll équipant un objet unique/mythique fraîchement couvert) - à valider
par l'utilisateur.

## 2026-09-21 (suite 3) - Panneau allégé + 3 pistes discutées pour la suite

Retour utilisateur avec capture d'écran (page Maxroll "Dance of Knives"
avec le panneau ouvert après clic sur "Traduire") : le panneau réaffichait
la liste équipement/compétences en français **en plus** du remplacement
déjà fait directement sur la page - doublon inutile maintenant que
`applyPageTranslation` écrit le texte dans le DOM.

Trois pistes proposées par l'utilisateur, discutées avant de coder quoi que
ce soit :
1. Retirer l'affichage dupliqué du panneau - **fait cette session** (voir
   ci-dessous).
2. Une colonne à droite de l'écran avec le comparateur multi-sites/
   consensus/classement officiel (déjà construit en Python pour le
   dashboard local abandonné, jamais porté en JS) - jugé faisable
   techniquement (mêmes outils `GM_xmlhttpRequest` déjà utilisés) mais gros
   chantier (porter `comparator.py`/`consensus.py`/`leaderboard.py` + 6
   scrapers), pas commencé.
3. Afficher le moyen d'obtention d'un objet unique/mythique sélectionné -
   vérifié que la donnée existe côté communauté (Maxroll "Boss Loot Table
   Cheat Sheet", D4Builds "Unique Loot Tables" à
   `d4builds.gg/database/unique-loot-tables/`) mais **aucune source
   exploitable trouvée par requête directe** : la page D4Builds est un site
   Gatsby, son contenu de table n'est pas dans les JSON de static-query
   (`page-data/sq/d/*.json`, testés - ne contiennent que les métadonnées du
   site) - il faudrait inspecter les vraies requêtes réseau dans un
   navigateur pour trouver l'API réelle, comme fait précédemment pour
   talion.tv/helltides. Pas commencé, priorité la plus basse des trois
   selon l'utilisateur.

**Allègement du panneau fait** (`userscript/diablo4-assistant.user.js`,
2.2 -> 2.3) : dans `runTranslate()` (bouton "🇫🇷 Traduire"), retiré les
blocs `<strong>Équipement</strong>`/`chipList(result.itemsFr)` et
`<strong>Compétences</strong>`/`chipList(result.skillsFr)` - le panneau se
limite maintenant au lien de la source utilisée, la note kami-labs
éventuelle, et la confirmation ("X nom(s) remplacé(s) directement sur cette
page..."). **`runGenerateFilter()` (bouton "⚔ Générer le filtre") inchangé
volontairement** : ce bouton n'appelle pas `applyPageTranslation` (il ne
touche pas le texte de la page, juste le code de filtre généré) - les
listes équipement/compétences y restent donc la seule façon de voir ce qui
a été utilisé pour construire le filtre, pas un doublon dans ce cas précis.

`node --check` OK. **Pas testé en conditions réelles** - à valider par
l'utilisateur au prochain clic sur "Traduire".

## 2026-09-21 (suite 4) - talion.tv/diablo/boss comme 2e source pour les uniques + moyens d'obtention trouvés en bonus

L'utilisateur, après confirmation que le panneau allégé va bien ("plutôt
pas mal"), a proposé d'utiliser `talion.tv/diablo/boss` - présenté comme
"un traducteur des items" - pour la traduction.

**Vérifié via Playwright** (la page est une SPA Angular vide sans navigateur
- même limite que pour talion.tv déjà connue - donc enregistrement des
vraies requêtes réseau au chargement, même méthode que pour
talion.tv/builds et helltides.com par le passé) : `https://api.talion.tv/
api/diablo/uniques/front` est un endpoint JSON **public, sans auth**
(deviner l'URL en `curl` direct donnait 401 - seul un vrai chargement de
page révèle qu'elle passe sans les en-têtes/contexte d'un navigateur réel,
comme déjà observé pour l'API `builds` de ce même site). Réponse : 287
objets avec `name_fr`/`name_en`/`slot`/`class`/`boss[]`/`uber`/`note` -
c'est littéralement une base de données CMS maison (repéré en creusant le
bundle Angular : un formulaire admin `app-admin-diablo-unique-form-page`
avec exactement ces champs, confirmant que talion.tv curate cette table à
la main plutôt que de la générer).

**Bonus non demandé mais très utile** : le champ `boss` liste précisément
quel(s) boss droppent chaque objet, et `uber` marque les mythiques -
répond exactement à la question laissée ouverte hier (comment obtenir un
objet unique/mythique sélectionné), qu'on avait mise de côté faute de
source exploitable trouvée à l'époque (tentative sur D4Builds "Unique Loot
Tables" infructueuse, voir plus haut).

`scripts/build_talion_uniques_dictionary.py` (nouveau) : fusionne les
`name_fr`/`name_en` dans `fr_en_dictionary.json`. **69 nouvelles entrées**
(objets que le filtre par clé Maxroll n'avait pas couverts) + **4
corrections**. Comparaison des 287 objets communs aux deux sources : 280
identiques après normalisation apostrophe courbe/droite et espace
insécable (déjà la convention du reste du dictionnaire), **seulement 3
vrais désaccords** :
- `Doombringer` : kami-labs ET talion disent tous les deux "Condamneuse"
  contre "Condamnatrice" chez Maxroll - tranché en faveur des 2 sources
  concordantes (donnée Maxroll probablement obsolète/erronée sur cette
  entrée précise, à retenir : cette source n'est donc pas infaillible
  malgré son origine "officielle").
- `Nesekem the Herald` et `Herald of Zakarum` : différences mineures de
  ponctuation/article ("Nesekem, le Héraut" vs "Nesekem le Héraut",
  "Héraut **du** Zakarum" vs "Héraut **de** Zakarum") - tranché en faveur
  de talion.tv, site dédié spécifiquement à ce problème de traduction FR
  précise (vs Maxroll dont les fichiers par langue sont un sous-produit de
  leur planner, pas la vocation première du site).

Dictionnaire : 1002 -> **1071 entrées**. `scripts/sync_userscript_dictionary.py`
relancé, `node --check` OK, vérifié dans Node que "Doombringer" ->
"Condamneuse" (corrigé) et "Debilitating Toxins" -> "Toxines
incapacitantes" (préexistant) sont bien dans le JSON embarqué.

Les données `boss`/`uber` sont sauvegardées à part dans
`app/data/unique_item_sources.json` (287 entrées, `{nom_en: {boss: [...],
uber: bool}}`) - **pas encore branchées dans le userscript**, prêtes pour
la fonctionnalité "comment obtenir cet objet" si l'utilisateur veut s'y
mettre (c'était la piste la plus mal engagée des trois proposées hier,
maintenant débloquée).

### Piste creusée en marge, pas corrigée : Maxroll affiche des noms d'objets générés, pas les noms d'aspect bruts

En essayant de comprendre pourquoi "Debilitating Toxins"/"Imitated
Imbuement" restaient non traduits sur la capture d'écran de l'utilisateur
(page Maxroll) malgré des entrées existantes dans le dictionnaire :
vérifié le JSON `search_metadata` d'un vrai planner Maxroll
(`maxroll.gg/d4/planner/mmfzmj0i`, build Voleur Danse des Couteaux déjà
connu) - le tableau `items` contient des **noms d'objets générés/procéduraux**
complets ("Runic Gloves of Imitated Imbuement", "Warcaster of Channeling",
"Earthstriker's Runic Cleats"), pas le nom propre de l'aspect seul
("Imitated Imbuement") ni la forme "Aspect of X" que `buildNameMap()` sait
déjà découper (voir le fix du 2026-09-20 "suite 7"). Une correspondance
exacte dans le dictionnaire ne peut donc jamais matcher ces chaînes telles
quelles - il faudrait une extraction du nom d'aspect **à l'intérieur** de
ce nom généré (ex. repérer "... of Imitated Imbuement" ou "Warcaster of
Channeling" -> "Channeling"), un problème plus proche du texte libre que
d'une correspondance exacte. **Pas corrigé** - plus gros chantier que prévu,
signalé à l'utilisateur plutôt que traité dans l'élan, pour décider s'il
veut s'y attaquer.

## 2026-09-21 (suite 5) - Boutons restylés (2.4) + tooltip "où trouver cet objet" (2.5)

Retour utilisateur : boutons gris/texte noir/même taille pour la 2.4, puis
une proposition plus large - une colonne à droite avec (a) un champ
affichant où trouver un objet uniques/mythique au survol/clic, (b) le
classement serveur officiel + une "note de build" + des liens vers d'autres
builds, en dessous. Question posée : est-ce que tout ça rentre dans une
colonne ?

Réponse donnée avant de coder : oui techniquement (même principe que
l'ancien dashboard 3 colonnes - sections à hauteur max + défilement
interne), mais les 3 blocs n'étaient pas au même stade de maturité - (a)
prêt tout de suite (données `boss`/`uber` déjà récupérées la session
même), (b) gros chantier déjà identifié (portage JS du comparateur/
consensus/classement Tower), et "note de build" un concept jamais défini
dans ce projet. L'utilisateur a choisi de commencer par (a).

**Boutons (`userscript/diablo4-assistant.user.js`, 2.3 -> 2.4)** :
`.d4a-fab-btn` passé de `background: #d4622a`/`color: #fff` (orange/blanc)
à `background: #c9c9c9`/`color: #111` (gris clair/texte noir, `#b3b3b3` au
survol), et `width: 190px` fixe (avant : largeur au contenu, donc les 3
boutons avaient des tailles différentes selon la longueur de leur
libellé) + `text-align: center`.

**Tooltip au survol d'un objet unique/mythique (2.4 -> 2.5)** :
- `scripts/sync_unique_item_sources.py` (nouveau) : embarque
  `app/data/unique_item_sources.json` (bâti hier depuis talion.tv) dans le
  userscript sous `UNIQUE_ITEM_SOURCES`, en traduisant les slugs de boss
  ("ice-beast", "harbinger"...) vers leurs libellés FR - repris tels quels
  du menu déroulant admin de talion.tv déjà exploré hier (`bossesItems`
  dans leur bundle Angular), pas redevinés.
- `translateTextNode()` (déjà en place pour la traduction directe sur la
  page) porte maintenant l'attribut `data-d4a-en="<nom EN>"` sur le
  `<span translate="no">` généré, mais **seulement** quand
  `lookupItemSource()` confirme que ce nom correspond à un objet connu de
  `UNIQUE_ITEM_SOURCES` (pas sur les compétences/aspects traduits, qui
  n'ont pas cette donnée) - réutilise un mécanisme déjà existant plutôt que
  d'en ajouter un nouveau.
- `setupItemSourceTooltip()` (nouveau, appelé dans `init()`) : un seul
  listener `mouseover`/`mouseout` délégué sur `document.body` (plutôt qu'un
  par `<span>`, qui serait perdu à chaque passage du `MutationObserver` de
  traduction) affiche une petite bulle positionnée sous le nom survolé :
  liste des boss qui le droppent (ou "Butin monde" si `all`), plus un badge
  "⚜ Objet mythique" si `uber`.
- **Limite assumée, cohérente avec la limite déjà documentée plus haut** :
  ne fonctionne que sur les noms **déjà remplacés sur la page** (après clic
  sur "Traduire", et seulement si `buildNameMap`/l'extraction du build a pu
  associer ce nom précis - donc pas sur un objet écrit sous forme de nom
  généré comme "Warcaster of Channeling" tant que ce problème n'est pas
  résolu, pas plus que la traduction elle-même).

`node --check` OK, vérifié dans Node que `UNIQUE_ITEM_SOURCES` s'analyse
correctement (287 entrées, ex. Doombringer/Harlequin Crest bien marqués
`uber: true` avec leurs boss). **Pas testé en conditions réelles** (survol
dans un vrai navigateur) - à valider par l'utilisateur.

Pas commencé, laissé pour une prochaine fois : le classement officiel +
liens vers d'autres builds pour la colonne (gros portage JS), et la
clarification de "notre note de build".

## 2026-09-21 (suite 6) - Traduction des noms de boss (2.6)

Retour utilisateur, tooltip validé ("tout marche bien"), avec une nouvelle
demande : traduire aussi les noms des boss qui droppent l'objet.

Clarifié par déduction avant de coder : le tooltip affichait déjà les noms
en français (`UNIQUE_ITEM_SOURCES`/`BOSS_LABELS_FR`, construits hier depuis
les libellés admin de talion.tv) - donc la demande concerne plutôt les
mentions de noms de boss **dans le texte libre de la page** (ex. un guide
qui dit "farm the Butcher for X"), jamais couvertes jusqu'ici : ni
`FR_EN_DICTIONARY` (objets/compétences/classes/paragon uniquement) ni
`buildNameMap()` n'incluaient de noms de boss.

Vérifié avant d'écrire quoi que ce soit (`d4guides.gg/en/bosses`, déjà une
source de confiance du projet, plus une recherche web de recoupement) : la
plupart des noms de boss s'écrivent **à l'identique** en anglais et en
français (Andariel, Astaroth, Bartuc, Duriel, Grigoire, Urivar, Varshan) -
rien à traduire pour ceux-là. Seuls 4 diffèrent vraiment : Butcher/Le
Boucher, Harbinger (of Hatred)/Messager de la Haine, Beast in (the) Ice/
Bête dans la glace, Lord Zir/Zir.

`userscript/diablo4-assistant.user.js` (2.5 -> 2.6) : nouvelle table
`BOSS_NAME_PAIRS` (à côté de `PARAGON_DICTIONARY`, même esprit mais **pas
scopée** comme celle-ci - les noms de boss sont des expressions
distinctives à plusieurs mots, pas des mots génériques courts comme
"Control", donc pas le même risque de faux positif en remplacement pleine
page) avec forme courte ET forme longue par boss (les guides utilisent
l'une ou l'autre). Fusionnée dans `buildNameMap()` aux côtés des paires
Paragon déjà mergées - donc active automatiquement dans "Traduire" comme
dans "Traduire la page" (protégée par `translate="no"` comme le reste).

Vérifié en Node (simulation isolée de la logique tri-par-longueur +
remplacement, la même que `translateTextNode()`) sur une phrase test avec
les 4 formes courtes et longues mélangées - toutes correctement remplacées,
aucun chevauchement mal géré. `node --check` OK. **Pas testé en conditions
réelles.**

**Deuxième demande, pas encore traitée** : ajouter un div listant les
meilleurs builds au classement, 7 visibles puis défilement jusqu'au top 30.
C'est la pièce "classement officiel" identifiée hier comme le plus gros
chantier des trois pistes de colonne (nécessite de décider quelle(s)
source(s) alimentent ce classement - toutes les 6 (comme l'ancien
consensus Python) ou une seule pour commencer) - question posée à
l'utilisateur avant de s'engager dessus, pas de code écrit pour cette
partie cette session.

## 2026-09-21 (suite 7) - Classement multi-sources porté en JS (2.7)

L'utilisateur choisit l'option "consensus multi-sources" (vs InfinityBuilds
seul ou classement Tower seul) pour le div de classement (7 builds visibles,
défilement jusqu'au top 30).

**Découverte qui change tout le calcul de coût** : `signature()`/
`similarity()`/`SIMILARITY_THRESHOLD`/`NOISE_WORDS` - le cœur de l'algorithme
de regroupement de `app/consensus.py` (`_signature`/`_similarity`) - étaient
**déjà portés en JS** depuis le 2026-09-20 pour le title-matching
(`findBestTitleMatch`), avec un commentaire explicite les identifiant comme
tels. Pareil pour la récupération de listes : `fetchInfinityBuildsBuilds()`
et `fetchKamiLabsBuilds()` existaient déjà (utilisées pour `kamilabsMatch`).
Le "gros chantier" annoncé hier se réduit donc à : 3 nouveaux fetchers
(Maxroll, D4Builds, D4Guides, talion - 4 en fait) + la fonction de
regroupement/tri elle-même (`_group`/`rank_builds`, jamais portée) + l'UI.

`userscript/diablo4-assistant.user.js` (2.6 -> 2.7) :
- `fetchMaxrollBuilds()`, `fetchD4BuildsBuilds()`, `fetchD4GuidesBuilds(season)`,
  `fetchTalionBuilds()` - ports directs de leurs `app/scrapers/*.py`
  respectifs, mêmes endpoints/sélecteurs.
- `groupConsensus()`/`rankConsensusGroups()` - port de `_group()`/
  `rank_builds()` de `consensus.py`, **sans le signal de confirmation par le
  classement officiel Tower** (`leaderboard.py`) - sous-système séparé et
  bien plus gros (parsing du cache Nuxt d'helltides.com, regroupement par
  compétences réellement équipées, exclusion des compétences génériques...),
  volontairement laissé de côté cette session. Tri par
  `(nombre de sources, tier moyen)` uniquement pour l'instant.
- Nouveau 4e bouton "🏆 Classement" (à droite de l'écran, `#d4a-fab-ranking`,
  opposé aux 3 autres à gauche - repositionnement volontaire pour ne pas
  empiler 4 boutons et pour amorcer la "colonne à droite" discutée hier) et
  `#d4a-ranking-panel` : détecte la classe via `guessClass()` (déjà
  existant), interroge les 6 sources en parallèle (`Promise.allSettled` -
  une source qui échoue n'empêche pas les autres de s'afficher, juste
  signalée dans le panneau), regroupe, trie, affiche le top 30 dans
  `#d4a-rank-list` avec `max-height: 364px` (~7 lignes) + défilement interne.
  Chaque ligne : titre représentatif, nombre de sources, tier moyen/4,
  liens cliquables vers chaque source qui la référence.

**Vérification faite avant de considérer que ça marche** (pas qu'un
`node --check`, une vraie validation sur données réelles) :
- Structure HTML/JSON de Maxroll (préfixes CSS `_Tierlist__tier_*` toujours
  valides), D4Builds (`a.build` + `h2`, 77 cartes confirmées), et talion.tv
  (`api.talion.tv/api/builds/front`, 32 builds D4, toujours public)
  vérifiées en direct par requête réelle - pas supposées à partir du code
  Python seul.
- **Vrai bug trouvé et corrigé en vérifiant talion.tv** : l'API renvoie les
  tiers avec un espace en trop (`"A "`, `"S "`, pas `"A"`/`"S"`) - la
  comparaison exacte contre `TALION_VALID_TIERS` aurait échoué en
  silence sur 100% des builds talion (tier toujours `null`). Corrigé avec
  un `.trim()` avant comparaison. Vérifié que `app/scrapers/talion.py`
  (Python) n'a PAS ce bug - il trim déjà depuis le début, seul le nouveau
  port JS l'avait introduit.
- **Logique de regroupement/tri testée sur de vraies données**, pas
  seulement du code lu : extraction Python (BeautifulSoup) des mêmes
  sélecteurs que le JS, depuis les pages Maxroll/D4Builds/talion réellement
  téléchargées, injectée dans les fonctions `signature`/`similarity`/
  `groupConsensus`/`rankConsensusGroups` extraites telles quelles du
  userscript et exécutées dans Node - sur la classe Voleur : 4 groupes à
  3 sources d'accord ("Tir Pénétrant", "Pluie de flèches", "Danse des
  Poignards", "Piège mortel"), le rapprochement FR/EN fonctionne bien
  entre le titre français de talion ("VOLEUR - Tir Pénétrant") et les
  titres anglais de Maxroll/D4Builds ("Penetrating Shot") - cohérent avec
  les résultats déjà documentés le 2026-09-20 pour cette classe.
- D4Guides (API JSON) bloqué par Cloudflare en `curl` brut direct (403) -
  pas anormal, `GM_xmlhttpRequest` passe généralement ce genre de
  protection basique (vraie empreinte navigateur) là où `curl` échoue,
  mais pas vérifiable sans navigateur réel ici. `fetchD4GuidesBuilds()`
  encaisse déjà l'échec proprement (retourne `[]` plutôt que de planter
  tout le classement) - dégradation déjà prévue, pas un correctif ajouté
  après coup.

`@connect d4builds.gg`, `@connect d4guides.gg`, `@connect api.talion.tv`
ajoutés (nécessaires pour `GM_xmlhttpRequest` vers ces domaines - absents
jusqu'ici car jamais appelés depuis le script). `node --check` OK.

**Pas testé en conditions réelles** (clic sur "Classement" dans un vrai
navigateur avec Tampermonkey) - priorité pour la prochaine session, avec le
reste des tests en attente (v2.1 kami-labs/Maxroll natifs, v2.5 tooltip,
v2.6 traduction des boss).

## 2026-09-21 (suite 8) - Confirmation navigateur réel + colonne unique + limite Maxroll multi-étapes trouvée (2.8)

Retour utilisateur, testé en conditions réelles cette fois : objets ET
classement fonctionnent bien ("les items fonctionnent super idem pour le
classement"). Trois demandes ensuite, avec une capture d'écran montrant le
panneau "Traduire" sur le build Voleur Danse des Poignards (onglet
"Midgame" du planner Maxroll) :
1. Regrouper classement + traduction dans une seule colonne (classement en
   dessous, pas à droite).
2. Icône pour réduire/afficher cette colonne.
3. Régression signalée : "la traduction des aspects ne fonctionne plus" -
   capture montrant "Debilitating Toxins", "Imitated Imbuement",
   "Channeling", "Earthstriker's" non traduits alors que les objets uniques
   ("Capuchon de l'Anonyme", "Pierre de Jordane"...) le sont bien.

### Investigation de la régression signalée

Pas une régression causée par un changement de cette session (rien touché
dans `applyPageTranslation`/`buildNameMap` avant ce point) - c'est le
problème déjà documenté plus tôt aujourd'hui ("Maxroll affiche des noms
d'objets générés, pas les noms d'aspect bruts"), maintenant visible
concrètement parce que les uniques traduisent bien par contraste. Vérifié
avec les vraies données de CE build précis (`maxroll.gg/d4/planner/
mmfzmj0i`, lié depuis la page `dance-of-knives-rogue-guide` avec le
fragment `#4`) : `search_metadata.items` contient bien "Warcaster of
Channeling" et "Runic Gloves of Imitated Imbuement" - confirmé qu'il s'agit
exactement du problème déjà diagnostiqué, pas d'un nouveau bug.

**Correctif appliqué** : `findEmbeddedAspectPairs()` (nouveau) - pour
chaque nom brut Maxroll sans traduction directe en dictionnaire, cherche si
un nom d'aspect/objet connu du dictionnaire apparaît **à l'intérieur** de
la chaîne (le plus long gagne), et ajoute cette paire plus courte à
`buildNameMap()` - `translateTextIn()` la retrouve ensuite où qu'elle
apparaisse sur la page, sans avoir besoin de comprendre la grammaire de
génération de nom de Diablo. Corrige concrètement "Channeling" et
"Imitated Imbuement" pour ce build (vérifié : ces deux chaînes sont bien
dans les données récupérées).

**Limite plus profonde trouvée, pas corrigée** : "Debilitating Toxins" (le
torse visible dans la capture, onglet Midgame) n'est **pas du tout** dans
les données qu'on récupère - vérifié qu'un planner Maxroll multi-étapes
(Starter/Midgame/Endgame/Bossing/Pushing) ne sert **qu'un seul
`search_metadata`** côté serveur (compté : une seule occurrence dans le
HTML brut), qui ne correspond pas forcément à l'étape actuellement affichée
à l'écran (le lien de la page utilise un fragment `#4`, jamais envoyé au
serveur puisque les fragments sont purement côté client - donc notre
requête séparée reçoit toujours la même étape "par défaut", indépendamment
de l'onglet réellement sélectionné). Signalé à l'utilisateur : la vraie
correction demanderait de lire l'équipement affiché **directement sur la
page courante** (le widget planner intégré) plutôt que de refaire une
requête séparée vers une étape non garantie - pas attaqué cette session,
question de priorité posée.

### Colonne unique + réduction (2.7 -> 2.8)

Fusion de `#d4a-panel` et `#d4a-ranking-panel` (deux panneaux flottants
indépendants) en un seul `#d4a-column` : en-tête fixe (`#d4a-column-header`)
avec titre + icône `▾`/`▸` de réduction, corps (`#d4a-column-body`, caché
par défaut) contenant deux sections vides (`#d4a-panel-section`,
`#d4a-ranking-section`) que `renderPanel()`/`renderRankingPanel()`
remplissent indépendamment (au lieu de créer/détruire un élément racine à
chaque fois) - un clic sur "✕" vide maintenant juste sa propre section
(`innerHTML = ""`) plutôt que de supprimer tout le conteneur. La colonne se
déplie automatiquement (`expandColumn()`) dès qu'une section reçoit du
contenu, même si l'utilisateur l'avait réduite avant. `#d4a-panel-section:
empty` masque la bordure de séparation quand la traduction n'a encore rien
affiché - le classement seul n'a pas de double-bordure orpheline en haut.

4e bouton "🏆 Classement" ramené dans la pile de gauche (`top: 164px`, sous
les 3 autres) au lieu d'être isolé à droite - la colonne démarre juste en
dessous (`top: 212px`). Sélecteurs d'exclusion de `translateTextIn`
(3 occurrences) mis à jour de `#d4a-panel, #d4a-ranking-panel, ...` vers
`#d4a-column, ...`, un seul conteneur à exclure maintenant.

`node --check` OK. **Pas testé en conditions réelles** pour cette partie -
à valider par l'utilisateur.

## 2026-09-21 (suite 9) - Cause racine du problème Maxroll trouvée et corrigée (2.9)

L'utilisateur valide : "oui si ça peut améliorer la traduction on va se
lancer" - feu vert pour creuser la limite multi-étapes de Maxroll signalée
juste avant.

### La vraie cause trouvée (pas celle supposée hier)

Vérifié avec Playwright sur la vraie page du build (`dance-of-knives-
rogue-guide`, onglet Midgame cliqué comme dans la capture utilisateur) :
le widget d'équipement Maxroll n'est **pas** dans une iframe cross-origin
ni un Shadow DOM fermé - il est monté directement dans le DOM de la page
(`.d4t-embed-host`, même document, aucune restriction d'accès) par leur
propre script `d3-planner-embed`. Les noms d'objets y sont du texte brut
dans des éléments `class="equipment_Slot__title__<hash>"` (même convention
de hash que `_Tierlist__tier_*` déjà connue) - **et reflètent exactement
l'onglet actuellement affiché** ("Debilitating Toxins" trouvé là après
clic sur Midgame, correspond pile à la capture de l'utilisateur).
Confirmé en parallèle : la requête séparée vers `/d4/planner/<id>` ne sert
qu'**un seul** `search_metadata` côté serveur (compté dans le HTML brut),
indépendant du fragment `#4` du lien (les fragments d'URL ne sont jamais
envoyés au serveur) - explique précisément pourquoi cette requête séparée
ratait des objets propres à l'onglet Midgame.

**Conséquence** : plus besoin de deviner quelle étape demander au serveur -
il suffit de lire ce que la page affiche déjà, exactement comme kami-labs
(`ESRD_STATE_V3`) et InfinityBuilds le font déjà pour leurs propres widgets.

`extractMaxrollDetail()` (`userscript/diablo4-assistant.user.js`) :
- `extractMaxrollEquipmentFromDom()` (nouveau) - lit
  `[class*="equipment_Slot__title__"]` sur la page courante.
- `waitForMaxrollEquipmentDom()` (nouveau) - le widget peut encore être en
  train de se monter juste après le chargement de la page ; réessaie
  jusqu'à 3s plutôt que d'abandonner sur une première lecture vide.
- La requête planner reste utile pour les **compétences** (`meta.skills`,
  pas trouvées ailleurs dans le DOM pour l'instant - la barre de
  compétences n'affiche pas leur nom en texte brut, seulement au survol,
  déjà documenté comme peu fiable à automatiser le 2026-09-20) - lancée en
  parallèle de la lecture DOM plutôt qu'avant, pour ne pas ajouter de
  latence. `itemsEn` préfère la lecture DOM si elle a trouvé quelque chose,
  retombe sur `meta.items` sinon (page qui ne charge pas le widget,
  structure différente...).

### Deuxième bug trouvé en testant : mots plus courts que prévu

La lecture DOM donne des fragments plus courts qu'espéré pour certains
aspects ("Channeling" et "Imitated Imbuement" seuls, sans le "Aspect
of "/"Runic Gloves of " qu'on voyait dans les données du planner) - le
correctif de tout à l'heure (`findEmbeddedAspectPairs`, qui cherche un nom
CONNU à l'intérieur d'un nom BRUT plus long) ne suffisait donc pas : ici
c'est l'inverse, le nom brut est plus COURT que l'entrée du dictionnaire
("Channeling" cherché, dictionnaire n'a que "Aspect of Channeling").
Ajouté une seconde passe dans `findEmbeddedAspectPairs()` : si aucune
correspondance directe, cherche une entrée du dictionnaire dont
`stripAspectPrefix(en)` (déjà utilisé ailleurs pour la forme "Aspect of
X"/"Aspect de X") correspond exactement au nom brut, et prend
`stripAspectPrefix(fr)` comme traduction - **corrige "Channeling" et
"Imitated Imbuement"**, vérifié sur les vraies données. **Limite acceptée,
pas corrigée** : "Duelist's"/"Crushing"/"Earthstriker's" utilisent une
forme anglaise suffixe ("Duelist's Aspect", pas "Aspect of Duelist") dont
le français correspondant ("Aspect de duelliste", "Aspect écrasant") ne se
laisse pas découper de la même façon (parfois nom après "de", parfois
adjectif directement après "Aspect") - pas de règle fiable trouvée sans
risquer une traduction fausse, laissé de côté plutôt que deviner.

### Troisième bug trouvé en testant : le filtre par `kind` ne filtrait rien

En testant `findEmbeddedAspectPairs()` contre le VRAI tableau
`FR_EN_DICTIONARY` embarqué (pas la copie Python) : aucune correspondance
ne remontait, ni la nouvelle ni celle de tout à l'heure. Cause :
`scripts/sync_userscript_dictionary.py` ne gardait que `{fr, en}` en
générant le JS - le champ `kind` (utilisé par `EMBEDDED_MATCH_KINDS` pour
ignorer les compétences/Paragon) n'était **jamais présent** sur les
entrées embarquées, donc `EMBEDDED_MATCH_KINDS.has(entry.kind)` valait
toujours faux et rejetait tout. **Corrigé** : le script garde maintenant
aussi `kind`. Dictionnaire réembarqué (toujours 1071 entrées, juste un
champ de plus par entrée).

**Revérifié de bout en bout après le correctif** sur les 18 objets réels
lus par Playwright (onglet Midgame) : 10/18 se traduisent maintenant
correctement (avant : correspondance directe seule, pas de repli), dont
précisément les 4 noms signalés par l'utilisateur ("Debilitating Toxins",
"Imitated Imbuement", "Channeling" - "Earthstriker's" reste un cas non
résolu, forme suffixe comme ci-dessus). 8 non traduits restants :
3 formes suffixe (limite documentée ci-dessus) + 5 objets d'un set Voleur
("... of Spellbound Steel", "Legendary Horadric Seal") absents du
dictionnaire - gap de couverture ordinaire, pas un bug de logique.

`node --check` OK. Version 2.9. **Pas testé en conditions réelles** (clic
"Traduire" dans un vrai navigateur sur ce build précis) - à valider par
l'utilisateur, avec le reste des fonctionnalités en attente de test de
cette session (classement, tooltip objets, traduction des boss, colonne
unique).

## 2026-09-21 (suite 10) - Confirmé en conditions réelles + Talismans ajoutés (2.10)

L'utilisateur confirme par capture d'écran : le correctif 2.9 fonctionne
en vrai, exactement comme prédit par les tests Node de tout à l'heure -
"Toxines incapacitantes", "Aspect d'imitation d'imprégnation", "canalisation"
bien traduits sur la page réelle. Objets encore non traduits visibles sur
la capture : "Crushing", "Duelist's", "Earthstriker's" (limite déjà
documentée), "Grief" (absent des données Maxroll), et 6 objets non encore
rencontrés - "Legendary Horadric Seal" + 5x "... of Spellbound Steel"
(charms du set Voleur saison 15).

Recherche sur ces 6 derniers : le premier passage sur les données Maxroll
(2026-09-21, `build_unique_mythic_dictionary.py`) ne couvrait que les clés
`_Unique_` - jamais les **Talismans** (Sceau Horadrique + Breloques/Charms
de set), qui vivent sous un préfixe de clé totalement différent
(`Talisman_Seal_<rareté>`, `Talisman_Charm_Set_<classe>_<n°set>_<n°
breloque>`). **245 clés trouvées**, couvrant les breloques des 8 classes +
génériques pré-Torment + les 4 raretés de Sceau Horadrique.

`scripts/build_talisman_dictionary.py` (nouveau, même méthode/source que
`build_unique_mythic_dictionary.py`) : **234 nouvelles entrées**
(`kind: "talisman"`), 0 conflit avec l'existant. Dictionnaire : 1071 ->
**1305 entrées**. Réembarqué (`sync_userscript_dictionary.py`), `node
--check` OK.

**Revérifié sur les 18 objets réels du build test** (même méthode
qu'avant - Playwright + Node, pas juste relecture du code) : **16/18
traduits maintenant** (avant ce correctif : 10/18), dont "Legendary
Horadric Seal" -> "Sceau horadrique légendaire" et les 5 "X of Spellbound
Steel" -> "X de l'acier enchanté". Restent seulement les 3 formes
suffixes (limite grammaticale déjà documentée, pas retentée) et "Grief"
(introuvable dans le jeu de données Maxroll sous quelque casse que ce
soit - à défricher une autre fois si besoin, faute de source alternative
identifiée pour l'instant).

Version 2.10. **Pas testé en conditions réelles pour cet ajout Talisman
précis** - le reste (classement, tooltip, boss, colonne) toujours en
attente de retour utilisateur.

## 2026-09-21 (suite 11) - "Grief" introuvable même via talion + bouton de recherche en direct (2.11)

Demande utilisateur : peut-on utiliser le traducteur de talion.tv pour
"Grief" ? Vérifié dans le code Angular de talion.tv (`talion_main.js`) :
leur seule base de données Diablo curatée est "Uniques Diablo"
(`/admin/diablo-4/uniques`, déjà entièrement récupérée hier) - pas de
section équivalente pour les aspects/légendaires. "Grief" absent de leurs
287 objets aussi. Recherche complémentaire (web) : "Grief" est en fait un
**Runeword** (nouveau système de runes de la saison 15, recette Eth+Tir+Lo+
Mal+Ral), pas un unique classique au sens où Maxroll/talion le modélisent -
vérifié qu'aucune des deux sources n'a de clé "Runeword" du tout dans leurs
données actuelles. Millenium.org (site FR) a bien une page "nouveaux objets
uniques" mais pour la saison 8, pas la 15. **Conclusion : trou de
fraîcheur des données réel, pas une erreur de méthode** - aucune des
sources disponibles n'a encore catalogué ce mécanisme tout neuf.

Suite à ça, l'utilisateur propose d'ajouter un bouton de recherche
manuelle. Clarifié le comportement voulu : une vraie **recherche en
direct** (pas juste une consultation du dictionnaire déjà synchronisé) -
pour retrouver des traductions ajoutées aux sources depuis notre dernière
synchronisation, sans avoir à relancer les scripts Python et republier le
userscript à chaque fois.

`userscript/diablo4-assistant.user.js` (2.10 -> 2.11) :
- 5e bouton "🔍 Recherche" (`#d4a-fab-search`, sous "Classement") - déplie
  la colonne et place le curseur dans le champ de recherche.
- Nouvelle section permanente `#d4a-search-section` dans la colonne (pas
  vide par défaut comme les deux autres - c'est un outil autonome qui ne
  dépend pas d'un résultat de build) : champ texte + bouton "Chercher"
  (aussi déclenché par Entrée).
- `runLiveSearch()` : cherche d'abord dans `FR_EN_DICTIONARY` (instantané,
  0 requête), puis **en direct** dans la table `items` complète de
  Maxroll (`data.enus.json`/`data.frfr.json`, 11 678 entrées - pas
  seulement les sous-ensembles Unique/Talisman déjà extraits, la table
  entière) et dans `api.talion.tv/api/diablo/uniques/front` - trouve donc
  potentiellement des aspects/objets qu'on n'a jamais pré-extraits, pas
  seulement du contenu ajouté après coup. Résultats mis en cache par page
  (`maxrollGameItemsCache`/`talionUniquesLiveCache`) pour qu'une 2e
  recherche sur la même page ne retélécharge pas ~7 Mo. Un échec réseau
  n'empêche pas d'afficher les résultats déjà connus (dégradation déjà
  dans l'esprit du reste du script).
- `@connect assets-ng.maxroll.gg` ajouté (nouveau domaine appelé,
  distinct de `maxroll.gg`).

**Vérifié avant de considérer que ça marche** (pas juste `node --check`) :
simulation Node de l'algorithme de recherche (tri par longueur ignoré ici,
juste correspondance substring pliée/sans accents) sur les vraies données
déjà en cache localement :
- "Grief" -> aucun résultat, confirme la conclusion ci-dessus (pas de faux
  espoir donné par l'outil).
- "Misery" -> trouve "Heart of Misery" -> "Cœur de la Misère" **en
  direct** via Maxroll, alors qu'il n'est PAS dans notre dictionnaire
  statique - preuve concrète que la recherche va au-delà de ce qu'on a
  déjà synchronisé, pas juste une redite du dictionnaire.
- "Debilitating Toxins"/"Windforce" -> retrouvés instantanément via
  "déjà connu", sans requête réseau inutile.

`node --check` OK. Version 2.11. **Pas testé en conditions réelles** (clic
sur le bouton, vraie recherche dans un navigateur) - à valider par
l'utilisateur.

## 2026-09-21 (suite 12) - Menu reskinné sur le modèle d'Esprit Donghua (2.12)

Demande utilisateur : faire ressembler le menu à celui du projet
"esprit-donghua" (capture d'écran fournie), en récupérant le code existant
plutôt que d'en refaire un. Trouvé sur ce PC :
`E:\EspritDonghua-Script\esprit-donghua-suivi-progression-v4.user.js` -
fonctions `ensurePanelToggleButton()`/`buildPersistentPanel()` (lignes
~1665-1791) contiennent le CSS inline exact de l'interface de la capture.

**Repris tel quel** (pas redeviné) :
- Bouton hamburger unique `#d4a-toggle-btn` (34×34, `#15151f`, coin
  supérieur gauche, icône ☰/✕) au lieu des boutons flottants séparés.
- Panneau `#d4a-column` : fond `#15151f`, `display:flex;flex-direction:
  column;gap:8px` (le `align-items:stretch` implicite de flexbox suffit à
  rendre chaque bouton pleine largeur, sans `width:100%` explicite - même
  technique que le script d'origine).
- Titre en cyan `#03d0fc` gras (comme "Esprit Donghua Continuum").
- Boutons gris `#333`/texte blanc, mêmes `padding`/`border-radius`/
  `font-size` que "Supprimer la série sélectionnée" etc.

**Changement structurel, pas juste cosmétique** : les 5 boutons flottants
indépendants (`#d4a-fab-*`) sont devenus des `<button>` **à l'intérieur**
du panneau lui-même, comme dans le modèle - le panneau doit donc déjà être
ouvert pour qu'on puisse cliquer dessus, ce qui rend `expandColumn()`
(l'ouverture automatique à l'affichage d'un résultat) inutile dans la
pratique - gardé quand même comme filet de sécurité, réécrit pour la
nouvelle structure (`column.style.display`) plutôt que retiré.

**Bug annexe trouvé et corrigé au passage** : un 4e endroit dans
`translateTextIn()` (`root.closest("#d4a-panel, .d4a-fab-btn")`) était
resté sur l'ancien sélecteur pré-fusion de colonne (2026-09-21, suite 8) -
raté lors du nettoyage de l'époque, repéré cette fois en grep-ant tous les
restes de `.d4a-fab-btn`/`#d4a-panel` avant de considérer le ménage
terminé. Corrigé vers `#d4a-column, #d4a-toggle-btn, [translate="no"]`,
cohérent avec les 3 autres occurrences.

Le bouton "Copier le code" (`.d4a-copy`) garde une couleur distincte -
cyan `#03d0fc`/texte noir, repris du bouton "Exporter" d'Esprit Donghua
(seul bouton non-gris de leur menu, le plus proche fonctionnellement de
"produire quelque chose à copier/sauvegarder").

**Vérifié visuellement** (pas juste `node --check`) : rendu la structure
CSS/HTML isolée dans une page de test avec Playwright, capture d'écran
comparée à la référence - même mise en page (titre cyan, boutons gris
pleine largeur empilés, bouton hamburger). `node --check` OK, aucune
référence résiduelle à l'ancien système de boutons/panneaux (vérifié par
grep). Version 2.12. **Pas testé en conditions réelles** (dans un vrai
navigateur, sur une vraie page) - à valider par l'utilisateur.

**Confirmé fonctionnel par l'utilisateur** après rechargement manuel du
script dans Tampermonkey (le fichier sur le disque n'est jamais relu
automatiquement par Tampermonkey - copier/coller le contenu du fichier
dans l'éditeur Tampermonkey puis sauvegarder est nécessaire à chaque mise
à jour, pas seulement pour ce changement précis - à refaire pour toute
future session tant que le script n'est pas distribué autrement).

## 2026-09-21 (suite 13) - Infobulle d'objet Maxroll : simplification radicale par l'utilisateur (2.13)

Capture d'écran utilisateur : cliquer sur un objet dans le panneau
Équipement de Maxroll ouvre une vraie infobulle façon jeu ("RUNIC MAIL OF
DEBILITATING TOXINS", type/rareté, Item Power, puis chaque ligne d'affixe
avec sa valeur - "+212 Dexterity [175 - 212]", et des phrases complètes
générées comme "You gain 30.0% Damage Reduction, and Poisoned enemies deal
15% less damage to you."). Question : peut-on la traduire aussi ?

**Exploration faite avant l'idée de l'utilisateur** : vérifié les tables de
données Maxroll pertinentes - `affixes` (3202 entrées, formes préfixe/
suffixe grammaticales), `attributeDescriptions` (651 modèles de phrase
avec placeholders `{value}`/`{c_important}...{/c}`, ex. `+[{value}*100|
1%|] Critical Strike Chance`). Confirme que traduire les phrases d'affixe
complètes demanderait de reconnaître quel modèle correspond à quelle ligne
affichée puis réinjecter la valeur numérique au bon endroit dans la
version FR - un vrai sous-système à construire, bien plus gros que tout ce
qui a été fait jusqu'ici sur ce projet.

**L'utilisateur propose une simplification bien plus efficace** : laisser
Google traduire tout le texte générique de l'infobulle, et se concentrer
uniquement sur les termes de jeu précis (déjà ce qu'on fait) plutôt que de
reconstruire le système de gabarits de Blizzard nous-mêmes.

**Réalisation en creusant la demande** : c'est déjà presque exactement
l'architecture en place ("Traduire" pose des `translate="no"` sur les
termes précis, "Traduire la page" appelle Google pour le reste) - il ne
manquait qu'un détail : `runTranslatePageText()` faisait une seule passe
figée au moment du clic (`collectTranslatableTextNodes()`), donc une
infobulle ouverte APRÈS ce clic (comme celle du screenshot, qui n'existe
dans le DOM qu'au clic/survol d'un objet) ne serait jamais traduite sans
recliquer le bouton à la main. Question posée à l'utilisateur : automatiser
(observer les nouveaux popups) ou recliquer à chaque fois - l'utilisateur
choisit l'automatisation.

`userscript/diablo4-assistant.user.js` (2.12 -> 2.13) :
- `collectTranslatableTextNodes()` factorisé en `collectTranslatableTextNodesIn(root)`
  (même filtrage - ignore les balises non pertinentes, tout ce qui est déjà
  `translate="no"`/dans notre colonne - mais réutilisable sur un seul
  nœud nouvellement ajouté au lieu de toujours tout `document.body`).
- `startGoogleTranslateObserver()`/`flushGoogleTranslateQueue()` (nouveau) :
  un `MutationObserver` séparé de celui des termes précis (celui-ci passe
  par un endpoint externe non officiel et doit être limité en fréquence,
  contrairement au remplacement local instantané) - regroupe les nouveaux
  nœuds ajoutés sur une fenêtre de 600ms (`GOOGLE_OBSERVER_DEBOUNCE_MS`)
  avant d'envoyer UNE seule requête groupée à Google, plutôt qu'une
  requête par petite mutation DOM individuelle. Relit le DOM à froid au
  moment de l'envoi (pas de référence de nœud mise de côté à l'avance) -
  l'observateur des termes précis a pu entre-temps scinder certains nœuds
  en plusieurs `<span>`, une référence gardée à l'avance serait devenue
  obsolète.
- `runTranslatePageText()` démarre cet observateur après sa passe
  initiale - donc un clic sur "Traduire la page" active la traduction
  automatique de tout nouveau texte pour le reste de la session sur cette
  page, pas seulement au moment du clic.

**Vérifié avec de vrais tests DOM** (jsdom installé dans le bac à sable,
pas seulement `node --check`) :
- Simulation d'une infobulle qui s'ouvre avec un mélange de texte déjà
  protégé (`translate="no"`, simulant le terme précis déjà traduit) et de
  texte générique ("Ancestral Legendary Chest Armor", "+212 Dexterity") -
  confirmé que seul le texte générique est envoyé à la fonction de
  traduction (mockée), le texte protégé reste intact.
- Test de regroupement : deux ajouts au DOM à 30ms d'intervalle (bien en
  dessous du délai de 600ms) ne déclenchent qu'**un seul** appel groupé
  contenant les deux textes, pas deux appels séparés - confirme que le
  debounce évite de spammer l'API à chaque micro-mutation.

`node --check` OK. Version 2.13. **Pas testé en conditions réelles** (vrai
clic sur un objet dans un vrai navigateur) - à valider par l'utilisateur.

## 2026-09-21 (suite 14) - "Ça ne fonctionne pas" : en fait un problème d'ordre des boutons, fusionnés (2.14)

L'utilisateur signale que la 2.13 ne fonctionne pas et veut sauvegarder et
reprendre plus tard. Avant de clore, question posée sur une éventuelle
erreur console - réponse : **pas un bug** en fait, juste un problème
d'ordre - "il faut traduire en 1er et après traduire la page et là ça
fonctionne bien" - cliquer les deux boutons dans le bon ordre (Traduire
avant Traduire la page) marche déjà. Logique : "Traduire" protège les
termes précis avec `translate="no"` AVANT que "Traduire la page" ne lance
Google sur le reste - dans l'autre sens (ou un seul des deux cliqué),
Google écrase ou ignore les termes précis.

Décision utilisateur : plutôt que de compter sur l'utilisateur pour
retenir cet ordre, **un seul bouton qui fait les deux dans le bon ordre**.

`userscript/diablo4-assistant.user.js` (2.13 -> 2.14) :
- `runTranslateAll()` (nouveau) : `await runTranslate(); await
  runTranslatePageText();` - toujours dans cet ordre, aucune option pour
  se tromper.
- Bouton `#d4a-btn-google` ("🌐 Traduire la page") retiré du panneau -
  fusionné dans `#d4a-btn-translate` ("🇫🇷 Traduire"), dont le `onclick`
  pointe maintenant vers `runTranslateAll()` au lieu de `runTranslate()`
  seul. Titre du bouton mis à jour pour refléter les deux étapes. Colonne
  repassée de 4 boutons visibles à 3 (Traduire / Générer le filtre /
  Classement).
- `runTranslatePageText()` elle-même inchangée (toujours appelable seule
  en interne par `runTranslateAll()`), juste plus exposée comme bouton
  séparé.

`node --check` OK. Version 2.14. **Pas testé en conditions réelles** - à
valider par l'utilisateur.

## Pause de session (2026-09-21, tard)

L'utilisateur arrête pour la session, à reprendre plus tard. **Tout est
sauvegardé** : `userscript/diablo4-assistant.user.js` à jour en v2.14 sur
le disque (rappel : ce fichier n'est PAS automatiquement relu par
Tampermonkey - copier/coller le contenu dans l'éditeur Tampermonkey +
sauvegarder est nécessaire avant de pouvoir tester, comme découvert plus
haut cette session), `app/data/fr_en_dictionary.json` à 1305 entrées,
scripts de génération (`scripts/build_*.py`, `scripts/sync_*.py`) tous à
jour et rejouables.

**À reprendre en priorité la prochaine fois** :
- Valider en conditions réelles tout ce qui n'a pas encore été testé dans
  un vrai navigateur cette session : observateur Google automatique sur
  nouveau contenu (2.13, en particulier sur une vraie infobulle d'objet
  Maxroll), classement multi-sources (2.7), tooltip "où trouver cet
  objet" au survol (2.5), traduction des noms de boss (2.6), menu façon
  Esprit Donghua (2.12).

## 2026-09-21 (suite 15) - Validation automatisée du bouton "Traduire" fusionné (2.14)

Demande : valider le bouton fusionné. Plutôt qu'une simple relecture de
code, écrit un test Playwright (Python, déjà dans `.venv`) qui charge le
VRAI fichier `userscript/diablo4-assistant.user.js` (non modifié sur
disque - une copie en mémoire reçoit juste un petit bloc d'exposition de
fonctions internes pour pouvoir mocker le réseau) dans un vrai Chromium,
avec une page de test minimale. `resolveTranslation()` (extraction
propre à chaque site) est mockée exprès - inchangée par 2.14, déjà
validée par l'utilisateur les sessions précédentes ; le test isole
uniquement ce que 2.14 a changé.

**Résultat : 7/7 vérifications passées** (script conservé dans le
scratchpad de session, pas dans le projet) :
- `#d4a-btn-google` bien absent, 3 boutons d'action visibles.
- Le clic sur "Traduire" appelle `runTranslate()` PUIS
  `runTranslatePageText()`, et `runTranslate` se termine ENTIEREMENT
  (attendu réellement, pas en parallèle) avant que la passe Google ne
  démarre - confirmé par un ordre d'exécution enregistré avec un mock à
  délai artificiel.
- Le texte de page est bien traduit après ce clic unique.
- L'auto-traduction de nouveau contenu (2.13) reste active après ce
  clic : un texte ajouté après coup (simulant une infobulle d'objet) est
  traduit sans reclic, dans le délai de regroupement de 600ms.

**Portée de la validation** : couvre la logique de fusion/ordre en
conditions de navigateur réel (vrai DOM, vrai MutationObserver), mais
pas l'extraction spécifique par site ni le vrai Tampermonkey/une vraie
page Maxroll - l'utilisateur peut donc sauter la validation manuelle de
CE point précis (l'ordre des boutons), les autres points de la liste
"à reprendre en priorité" ci-dessus restant à valider manuellement.

## 2026-09-21 (suite 16) - Bug réel signalé : "Google prend le dessus, des items pas traduits" (2.15)

Signalement utilisateur en conditions réelles (Tampermonkey, vrai site) :
Google finit par écraser/remplacer certains noms qui auraient dû garder
le terme exact du client FR, et plusieurs items restent non traduits.

**Diagnostic (pas juste une relecture - tracé le chemin de données
complet)** : sur les sites sans version FR native (Maxroll notamment,
`extractMaxrollDetail()` ligne ~1377 `itemsFr: itemsEn.map(lookupFr)`),
`lookupFr()` retombe sur le nom ANGLAIS inchangé quand le terme n'est
pas encore dans `FR_EN_DICTIONARY` (couverture partielle, cf. limite déjà
connue depuis le 2026-09-20). Résultat : `itemsFr[i] === itemsEn[i]`
pour ce terme. Or `buildNameMap()` (ligne ~1559, avant fix) ignorait
purement et simplement toute paire où `en.toLowerCase() === fr.toLowerCase()`
- pensé à l'origine comme une optimisation ("pas la peine d'entourer un
texte qui ne change pas"). Conséquence non prévue : ce terme de jeu
précis se retrouvait en texte brut, non protégé par `translate="no"`,
et la passe Google (qui tourne après, sur tout ce qui n'est pas protégé)
le traduisait avec sa propre traduction générique - souvent différente
du vrai terme du client FR, ou carrément à côté pour un nom propre. Une
seule cause explique les deux symptômes rapportés : items non traduits
par nous (miss dictionnaire) qui finissent par être "traduits" par
Google à la place (mauvaise traduction visible = "Google prend le
dessus").

**Correctif** (`userscript/diablo4-assistant.user.js`, fonction
`buildNameMap`) : un terme sans correspondance FR connue est
maintenant quand même enregistré dans la table de noms, avec le texte
anglais tel quel comme "traduction" - il est donc toujours entouré d'un
`<span translate="no">` (juste avec le texte anglais inchangé à
l'intérieur), ce qui l'exclut de la passe Google. Mieux vaut laisser un
nom en anglais, prévisible, que laisser Google inventer un équivalent
français qui ne correspond pas au jeu.

**Validé par un test Playwright réel** (Chromium, vrai fichier chargé
tel quel, script conservé dans le scratchpad de session) : un terme
résolu ("Fireball" -> "Boule de Feu") continue d'être remplacé
normalement ; un terme simulant un miss dictionnaire ("Grasp of
Shadow", en=fr) est maintenant bien protégé (`translate="no"`, texte EN
conservé) ET n'apparaît plus dans la liste des nœuds envoyés à Google -
4/4 vérifications passées.

Version 2.15. `node --check` OK. **Limite qui reste vraie** : ça ne fait
pas apparaître le terme en français - juste anglais au lieu d'un faux
français. La vraie solution de fond reste d'agrandir
`fr_en_dictionary.json` (scripts `build_*.py` déjà en place). **À
valider par l'utilisateur** : recopier le script mis à jour dans
Tampermonkey (rappel habituel : le fichier disque n'est jamais relu
automatiquement) et confirmer que les items restés en anglais ne se
font plus "retraduire" par Google avec un mauvais résultat.

## 2026-09-21 (suite 17) - Testé par l'utilisateur : mieux, mais encore des noms non traduits (2.16)

Capture d'écran fournie (page Maxroll "Dance of Knives Rogue", 889 blocs
traduits par Google - la 2.15 tourne bien). Restent en anglais dans
l'équipement : "Crushing" (amulette), "Duelist's" (bague), "Imitated
Imbuement" (gants), "Earthstriker's" (bottes) - mais sans traduction
Google fautive dessus (ce que 2.15 visait déjà à éviter). Diagnostic
plus poussé plutôt qu'une simple ré-explication de la limite connue :

**Régression trouvée, introduite PAR le correctif 2.15 lui-même** :
`buildNameMap()` enregistre maintenant `en -> en` pour un terme non
résolu (le fix de la suite 16), mais ça se faisait DANS `addPairs()`,
donc AVANT que `findEmbeddedAspectPairs()` tourne plus bas dans la même
fonction. Cette dernière sait déjà résoudre le cas "Maxroll affiche le
nom court d'un aspect (`Imitated Imbuement`) alors que le dictionnaire
n'a que la forme complète (`Aspect of Imitated Imbuement` ->
`Aspect d'imitation d'imprégnation`)" en retirant le préfixe "Aspect
of/de/d'" des deux côtés - mais son garde-fou `if (!map.has(en))` voyait
que la clé existait DÉJÀ (le placeholder identité posé juste avant) et
laissait tomber la meilleure réponse trouvée. **Corrigé** en sortant la
boucle de secours identité de `addPairs()` et en la faisant tourner en
tout dernier, après `findEmbeddedAspectPairs()` - elle ne comble plus
que les trous qu'aucune autre règle n'a pu résoudre.

**Bug annexe trouvé en traçant ce cas précis** : `ASPECT_PREFIX_RE`
(`/^aspect\s+(of|de|d')\s*/i`) n'acceptait que l'apostrophe DROITE (`'`)
- `fr_en_dictionary.json` mélange apostrophe droite et courbe (`'`)
selon la source d'origine de chaque entrée (63 vs 91 occurrences
vérifiées). Sur une entrée en apostrophe courbe comme "Aspect
d'imitation d'imprégnation", le découpage du préfixe échouait
silencieusement côté français, donnant un résultat correct mais avec
"Aspect d'" resté collé devant au lieu du nom court attendu. Regex
élargie à `d['']` pour accepter les deux formes.

**Catégorie différente, VOLONTAIREMENT pas retouchée** : "Crushing",
"Duelist's", "Earthstriker's" viennent d'aspects où le nom court se
place APRÈS le mot "Aspect" en anglais ("Duelist's Aspect",
"Earthstrikers Aspect") et où le français peut restructurer en adjectif
("Aspect écrasant" pour "Crushing Aspect") - `findEmbeddedAspectPairs`
ne gère déjà, par choix documenté dans son propre commentaire, que le
préfixe "Aspect of X"/"Aspect de X", pas ce cas suffixe/adjectif, pour
ne pas risquer une correspondance fausse. Ces trois-là restent donc en
anglais - mais bien protégés de Google (vérifié), pas mal traduits.
Amélioration possible plus tard : enrichir `fr_en_dictionary.json` avec
des entrées courtes vérifiées une par une pour ce cas précis, plutôt
qu'une règle générique risquée à l'exécution.

**Validé par un test Playwright réel** utilisant le VRAI dictionnaire
embarqué du script (pas un mock) et reproduisant exactement les 4 noms
de la capture d'écran - "Imitated Imbuement" résolu correctement en
"imitation d'imprégnation" (plus masqué), les 3 autres confirmés
protégés (`translate="no"`) sans être envoyés à Google. Les deux tests
Playwright précédents (bouton fusionné, protection anti-Google
générique) rejoués aussi - aucune régression. Script conservé dans le
scratchpad de session.

Version 2.16. `node --check` OK. **À valider par l'utilisateur** :
recopier dans Tampermonkey et confirmer sur la même page Maxroll que
"Imitated Imbuement" apparaît maintenant traduit ; "Crushing",
"Duelist's", "Earthstriker's" resteront en anglais pour l'instant (gap
dictionnaire connu, pas un bug).
- Chantiers connus non commencés : remplissage auto du planner
  InfinityBuilds personnel, clarification de "notre note de build",
  extraction skills pour kami-labs/Maxroll en conditions réelles (v2.1,
  jamais confirmée par l'utilisateur malgré la validation Node).

## 2026-09-22 - Tentative de validation en conditions réelles (vraie page Maxroll) - bloquée par un problème d'environnement de test, pas de bug produit

Objectif de la session : sortir enfin du synthétique et valider sur une
**vraie page Maxroll en ligne** (`dance-of-knives-rogue-guide`) trois
choses jamais confirmées qu'en synthétique : (1) le fix 2.16 (Imitated
Imbuement traduit, Crushing/Duelist's/Earthstriker's protégés sans être
mal traduits par Google), (2) l'auto-traduction du nouveau contenu (2.13,
ouvrir une infobulle après le clic Traduire), (3) le reste des points
jamais testés en réel : classement consensus (bouton Classement, 6
sources), infobulle "où trouver cet objet" au survol, menu/panneau
(copié du projet Esprit Donghua).

**Méthode tentée** : Playwright Python pilotant un vrai Chromium, navigué
vers la vraie URL Maxroll, avec le contenu RÉEL et non modifié de
`userscript/diablo4-assistant.user.js` injecté dans la page (un pont
`GM_xmlhttpRequest` vers de vraies requêtes HTTP côté Python remplaçant
l'extension Tampermonkey, pour rester fidèle - contourne les limites
CORS d'une page normale exactement comme le fait l'extension réelle).

**Blocage rencontré, diagnostiqué en profondeur plutôt que contourné à
l'aveugle** : injecté via `page.add_init_script()` (la méthode standard
Playwright, déjà utilisée avec succès les sessions précédentes... mais
sur des pages de test synthétiques, jamais sur une vraie page chargée
d'ads/trackers comme Maxroll) - le script s'est retrouvé exécuté
**9 fois** dans le même document final (9 boutons `#d4a-toggle-btn`
trouvés), au lieu d'une fois. Hypothèses testées dans l'ordre :
1. Scripts publicitaires appelant `document.open()` faisant rejouer les
   scripts d'init Chromium/CDP - **bloqué tous les domaines pub connus
   via `page.route()` : le problème persiste identique (toujours 9)**,
   invalidant cette explication (ou au moins son caractère suffisant).
2. Garde-fou `window.__D4A_TEST_ALREADY_RAN` posé pour empêcher une
   ré-exécution - **silencieusement réinitialisé à chaque fois** alors
   que le DOM final montre bien les 9 instances accumulées dans le MÊME
   document - comportement Chromium/CDP non complètement élucidé
   (semble indiquer un scope JS global réinitialisé à chaque ré-injection
   tout en partageant le même arbre DOM, ce qui est contradictoire avec
   le fonctionnement normal de `document.open()`).
3. **Confirmé que ce n'est PAS un bug du userscript lui-même** : rien
   dans son code ne cause ni n'explique une ré-exécution multiple - le
   phénomène se produit AVANT même que le script ne s'exécute une seule
   fois "normalement" (c'est le mécanisme d'injection de Playwright
   lui-même qui est rejoué), et ce mécanisme n'existe pas du tout avec un
   vrai Tampermonkey (qui injecte le content script une seule fois, à
   `@run-at document-idle`, indépendamment des `document.open()` déclenchés
   par la page elle-même).
4. **Dernier correctif tenté, pas eu le temps de le valider jusqu'au
   bout** : remplacer `add_init_script()` par une injection UNIQUE via
   `page.evaluate()` lancée manuellement après le chargement complet de
   la page (plus proche du comportement réel de Tampermonkey de toute
   façon) - le run correspondant était encore en cours au moment où la
   session a été arrêtée pour cette piste.

**Résultat net de la session : aucun des 3 points n'a pu être confirmé
en conditions réellement réelles** (vraie page Maxroll en ligne) -
seulement le blocage d'environnement de test ci-dessus a été exploré et
en partie diagnostiqué. **Aucun bug trouvé ni corrigé dans le userscript
cette session - version toujours 2.16, fichier disque inchangé.** Les
validations Playwright synthétiques des sessions précédentes (2026-09-21,
"suite 15/16/17" ci-dessus) restent valables telles quelles mais ne
couvrent toujours pas une vraie page en ligne.

**Mise à jour tardive de la session - le correctif du point 4 a en fait
fonctionné** : le run relancé avec l'injection unique via `page.evaluate()`
après chargement (au lieu de `add_init_script()`) a bien tourné jusqu'au
bout, et **confirme le diagnostic : un seul `#d4a-toggle-btn` présent
dans le DOM final**, contre 9 avant. Le problème de duplication de
l'environnement de test est donc résolu par cette méthode - à réutiliser
telle quelle pour tout futur test Playwright sur une page chargée
d'ads/trackers (préférer `page.evaluate()` après chargement à
`add_init_script()`).

**Deux points supplémentaires trouvés une fois la duplication résolue**,
aucun des deux n'étant un bug du userscript :
- Bug trivial du script de test Python lui-même (pas du userscript) :
  `print()` plante sur l'encodage Windows par défaut (cp1252) dès qu'un
  caractère comme "✕" (le bouton fermer du panneau) doit s'afficher dans
  la console - la traduction elle-même n'a donc jamais pu être vérifiée
  jusqu'au bout, à cause de ce crash d'affichage et non d'un problème de
  traduction. À corriger avec `PYTHONIOENCODING=utf-8` ou une
  reconfiguration de stdout avant de relancer.
- **Point réel à examiner, pas encore expliqué** : sur cette page, avant
  même le crash d'affichage ci-dessus, le clic sur "Traduire" a déclenché
  le chemin de repli InfinityBuilds (`GM_openInTab` appelé deux fois vers
  `infinitybuilds.gg/en|fr/builds/dG9XrHqBAL?d4a_extract=...`) au lieu du
  chemin natif Maxroll (`extractMaxrollDetail`, censé être prioritaire
  pour cette page - voir docstring `v2.1` en tête du fichier). Vérifié
  indépendamment (requête HTTP directe, sans navigateur, hors Playwright)
  que le lien planner Maxroll **est bien présent** sur cette page
  (`maxroll.gg/d4/planner/mmfzmj0i`, même id que celui déjà noté le
  2026-09-16 pour ce build) - donc `extractMaxrollDetail()` aurait dû
  réussir. Cause non identifiée : possible cause côté test (le script a
  cliqué "Traduire" immédiatement après `networkidle`, sans attendre le
  rendu du widget d'équipement Maxroll - `waitForMaxrollEquipmentDom` a
  un délai max de 3s qui a pu ne pas suffire) ou véritable régression
  dans `extractMaxrollDetail`/`extractNativeDetail` à vérifier dans le
  code. **Pas encore tranché - à investiguer en priorité la prochaine
  session**, avant de re-tenter une validation complète.

**Résultat net de la session : aucun des 3 points demandés n'a pu être
confirmé en conditions réellement réelles** (vraie page Maxroll en
ligne) - le blocage d'environnement de test (duplication d'injection) a
bien été résolu en fin de session, mais les deux obstacles ci-dessus
(l'un trivial, l'autre à investiguer) ont empêché d'aller jusqu'au bout
avant l'arrêt de la session, demandé explicitement par l'utilisateur
plutôt que de continuer à itérer. **Aucun bug trouvé ni corrigé dans le
userscript cette session - version toujours 2.16, fichier disque
inchangé.** Les validations Playwright synthétiques des sessions
précédentes (2026-09-21, "suite 15/16/17" ci-dessus) restent valables
telles quelles mais ne couvrent toujours pas une vraie page en ligne.

**À reprendre en priorité la prochaine fois** :
- La méthode de test Playwright est maintenant fiable (injection via
  `page.evaluate()` après chargement) - corriger l'encodage stdout,
  investiguer pourquoi `extractMaxrollDetail` ne s'est pas déclenché sur
  cette page, puis relancer le test jusqu'au bout pour les 3 points
  demandés ;
- Soit, plus simple et plus fiable puisque c'est de toute façon l'usage
  réel visé : demander à l'utilisateur de recopier v2.16 dans
  Tampermonkey et de tester lui-même sur cette page (ce qui était déjà
  la validation prévue en fin de session du 2026-09-21, jamais faite) -
  élimine complètement les problèmes d'environnement de test ci-dessus,
  qui n'existent pas avec un vrai gestionnaire de userscripts.
- Points toujours non validés en conditions réelles, listés à nouveau
  puisque rien n'a bougé cette session : 2.13 (auto-traduction sur
  nouveau contenu), 2.7 (classement consensus), 2.5 (infobulle "où
  trouver cet objet"), 2.6 (noms de boss - en réalité déjà inclus dans
  les données de 2.5, pas une fonctionnalité séparée), 2.12
  (menu/panneau façon Esprit Donghua - juste l'UI, visuellement présente
  dans tous les runs de test malgré le bug de duplication, donc
  raisonnablement bas risque), v2.1 (extraction skills kami-labs/Maxroll).
- Chantiers toujours non commencés (inchangé) : remplissage auto du
  planner InfinityBuilds personnel, clarification de "notre note de
  build".

## 2026-09-22 (suite) - Point 1 validé par l'utilisateur en conditions réelles (Tampermonkey, vraie page Maxroll)

L'utilisateur a recopié v2.16 dans Tampermonkey et testé lui-même sur la
page Maxroll "Dance of Knives Rogue" (contournant complètement les
problèmes d'environnement Playwright ci-dessus, comme anticipé).
Capture d'écran fournie : panneau Équipement + Talisman.

**Confirmé exactement conforme à l'attendu du fix 2.15/2.16** :
- "imitation d'imprégnation" (gants) - traduit correctement. C'est
  précisément le bug d'ordre des opérations (`buildNameMap`/
  `findEmbeddedAspectPairs`) corrigé en 2.16 - première confirmation en
  conditions réelles.
- "Crushing" (amulette), "Duelist's" (bague), "Earthstriker's" (bottes) -
  restent en anglais, **sans** traduction Google fautive par-dessus.
  Comportement voulu (gap de dictionnaire connu, terme protégé plutôt que
  deviné).
- Console DevTools vérifiée : uniquement du bruit de bloqueur de pub
  (`ERR_BLOCKED_BY_CLIENT` sur doubleclick.net et consorts) et des
  avertissements de préchargement de ressources - aucune erreur JS liée
  au userscript.

**Point 1 de la liste "à valider" : validé.** Ne valide PAS pour autant le
point distinct flaggé juste au-dessus (`extractMaxrollDetail` vs. repli
InfinityBuilds) - cette capture concerne uniquement le bouton "Traduire"
(remplacement de texte en place dans le DOM), pas l'extraction de
build/génération de filtre, qui est un chemin de code différent. Ce
point reste à investiguer séparément.

**Reste à valider par l'utilisateur, en conditions réelles, pour boucler
la liste complète** : 2.13 (ouvrir une infobulle d'objet APRÈS avoir
cliqué "Traduire" une première fois, sans recliquer, et vérifier qu'elle
se traduit quand même), 2.7 (bouton Classement), 2.5 (survol d'un objet
pour l'infobulle "où le trouver"), 2.12 (aspect du menu/panneau).

### Les 4 points restants validés par l'utilisateur

Confirmé directement par l'utilisateur, sur la même session de test
(Tampermonkey, vraie page Maxroll) : **2.13 (auto-traduction du nouveau
contenu sans reclic), 2.5 (infobulle "où trouver cet objet" au survol),
2.12 (menu/panneau), et 2.7 (classement consensus) fonctionnent tous
correctement.**

**Bilan de la liste "à valider en conditions réelles" (portée initiale de
la session du 2026-09-22, points 1/2/3 de la demande utilisateur) :
entièrement close.** Tout marche en conditions réelles, version toujours
**2.16** (aucun changement de code n'a été nécessaire au final - le
diagnostic Playwright de la session était correct : le seul vrai problème
était l'environnement de test synthétique, pas le produit).

**Reste ouvert, sans changement** :
- Le point flaggé plus haut sur `extractMaxrollDetail` vs. repli
  InfinityBuilds (observé uniquement dans le test Playwright, jamais
  reproduit par l'utilisateur) - à garder à l'œil mais pas bloquant.
- v2.1 (extraction skills kami-labs/Maxroll native) toujours non
  confirmée en conditions réelles.
- Chantiers non commencés : remplissage auto du planner InfinityBuilds
  personnel, clarification de "notre note de build".

## 2026-09-22 (suite) - "Note du build" ajoutée (2.17)

Demande utilisateur : ajouter une vraie "note du build" - regarder où
chaque build est classé (S/A/B/C) sur tous les sites, et trier par le
plus de S en premier, puis le plus de A, etc.

**Constat avant de coder** : le classement existait déjà (bouton
Classement) mais triait par `(nb sources, tier moyen)` - une moyenne
masque le fait qu'un seul S est un signal individuel plus fort que
plusieurs A (ex. 1×S ex-aequo à 4.0 pourrait se retrouver derrière
2×A+1×B à une moyenne proche selon les cas, alors qu'un vrai S d'un site
devrait peser plus lourd qu'un consensus de A). Côté app.js (ancienne UI locale FastAPI, plus l'usage principal mais
gardée en cohérence), l'affichage de badges "S×3 A×1" existait déjà
(`renderConsensus`), mais le TRI backend (`consensus.py`) restait basé
sur la moyenne, pas sur les badges affichés - incohérence entre ce qui
est montré et ce qui décide l'ordre.

**Modifié dans les deux implémentations (elles sont un port l'une de
l'autre, gardées synchronisées comme le reste du projet)** :
- `app/consensus.py` : nouvelle propriété `tier_counts` (tuple
  `(nb_S, nb_A, nb_B, nb_C, nb_D)`, comparé lexicographiquement) et
  `note_label` (chaîne `"3×S · 1×A"`, exposée dans `to_dict()`).
  `sort_key` trie maintenant par `(leaderboard_confirmations, tier_counts,
  source_count, avg_tier_points)` - le classement officiel du jeu reste
  la priorité absolue (comportement inchangé, déjà validé), mais c'est
  maintenant `tier_counts` qui décide ensuite plutôt que la moyenne
  (`source_count`/`avg` ne départagent plus qu'une égalité exacte sur
  `tier_counts`).
- `userscript/diablo4-assistant.user.js` (2.16 -> 2.17) : mêmes
  `tierCounts()`/`compareTierCounts()` en JS (pas de
  `leaderboard_confirmations` côté script, jamais porté - voir
  commentaire existant en tête de cette section du fichier).
  `rankConsensusGroups()` trie maintenant par `tierCounts` d'abord. Le
  panneau Classement affiche désormais des badges colorés par tier
  (mêmes couleurs que l'ancienne UI : S orange, A jaune, B bleu, C/D
  gris) au lieu du seul "~X/4" affiché avant.

`node --check` OK, `python -c "import app.consensus"` OK. **Pas encore
testé en conditions réelles** (le classement en lui-même l'a été juste
avant dans cette même session, mais sans la note/le nouveau tri -
c'est le comportement de tri qui change ici) - à valider par
l'utilisateur : recopier v2.17 dans Tampermonkey, rouvrir le panneau
Classement, et vérifier que l'ordre et les badges reflètent bien "le
plus de S d'abord".

## 2026-09-22 (suite) - Position officielle + liens croisés sous le titre du panneau (2.18)

Demande utilisateur : "quand on consulte un build sur l'ensemble des
sites, en dessous du titre de notre fenêtre, il y a la position du
build dans le classement officiel et le lien pour aller sur ce build
si il vient d'un autre site que celui où on consulte." Suite directe de
la question précédente sur la faisabilité d'une recherche de position
officielle (voir plus haut le même jour) - cette fois demandée comme
fonctionnalité automatique du panneau, pas juste explorée.

### Découverte technique clé avant de coder

`app/leaderboard.py` (existant, côté Python/Playwright) lit déjà le
classement Tower officiel via `helltides.com/tower`. Avant de porter ça
en JS pur (sans Playwright, pour le userscript), vérification par
`curl` brut : `window.__NUXT__` et `skillDetails` sont bien présents
dans le HTML renvoyé tel quel par le serveur (pas besoin d'exécuter du
JS pour que la donnée EXISTE dans la réponse) - mais le format est le
"devalue" de Nuxt 3 : un tableau JS plat où les valeurs sont des INDEX
vers d'autres positions du même tableau (ex. `"skillDetails":59`
signifie "va lire l'entrée 59", pas une valeur directe). Un
`JSON.parse`/regex sur un sous-texte ne peut pas reconstruire ça
correctement - il faut que le vrai JS Nuxt de la page s'exécute pour
que `window.__NUXT__.data` soit correctement recomposé, exactement ce
que fait déjà le code Python via `page.evaluate()` après chargement.

**Conséquence** : réutilisation à l'identique du mécanisme déjà en
place dans le userscript pour un problème identique (lire l'état d'une
page tierce après exécution de son JS, sans pouvoir lire un iframe
cross-origin) - `openExtractionTab()`/`runExtractionMode()`, déjà
utilisé pour InfinityBuilds. Nouveau couple analogue
`openLeaderboardExtractionTab()`/`runLeaderboardExtractionMode()`, avec
un paramètre distinct `?d4a_lb_extract=<id>` (pas `d4a_extract`, la
logique d'extraction étant différente : lire `window.__NUXT__.data`, pas
des tuiles du DOM).

### Implémenté dans `userscript/diablo4-assistant.user.js` (2.17 -> 2.18)

- En-tête : `@match *://helltides.com/tower*`, `@connect helltides.com`,
  `@grant GM_getValue` (nouveau, pour le cache).
- `runLeaderboardExtractionMode(requestId)` : tourne UNIQUEMENT dans
  l'onglet caché ouvert sur helltides.com - poll `window.__NUXT__.data`
  (même heuristique que `app/leaderboard.py`'s `_FIND_LEADERBOARD_JS` :
  premier tableau dont le premier élément a un champ `skillDetails`,
  plus robuste qu'un hash de build Nuxt codé en dur), réduit chaque
  entrée à `{rank, battleTag, gameClass, tier, skills:[{name,type}]}`
  avant de renvoyer (pas la peine d'expédier le payload brut, volumineux,
  via `GM_setValue`), ferme l'onglet.
- `openLeaderboardExtractionTab()` : même relai `GM_setValue`/
  `GM_addValueChangeListener` qu'`openExtractionTab()`, clé de résultat
  distincte (`d4a_lbresult_` vs `d4a_result_`) pour ne jamais entrer en
  collision si les deux flux tournent en même temps.
- **Cache ajouté** (contrairement aux 6 fetchers de listes de builds,
  jamais cachés jusqu'ici, un choix déjà accepté) : `fetchTowerRuns()`
  vérifie un cache `GM_getValue`/`GM_setValue` (30 min de TTL, même
  durée que `CACHE_TTL_SECONDS` côté Python) avant de rouvrir un onglet
  caché - ouvrir un onglet est nettement plus coûteux qu'un simple
  `GM_xmlhttpRequest`, à ne pas refaire à chaque page de build visitée.
- `bestOfficialRank(gameClass, title)` : parmi les runs du classement de
  cette classe, retourne le MEILLEUR rang (le plus bas) dont les
  compétences "confirment" le titre - port exact du principe de
  `app/consensus.py`'s `_leaderboard_confirmations`/`_skill_tokens` (les
  mots d'une compétence doivent être un sous-ensemble NON VIDE de la
  signature du titre, pas une simple intersection - un mot générique
  partagé ne suffit pas) et de l'exclusion `GENERIC_UTILITY_TYPES`
  d'`app/leaderboard.py` (Imbuement/Subterfuge exclus - présents sur
  presque tous les builds d'une classe, source de faux positifs déjà
  documentée côté Python).
- `findCrossSiteLinks(title, gameClass)` : relance les 6 fetchers déjà
  utilisés par `runRanking()`, exclut la source du site actuellement
  consulté (mapping `location.hostname` -> id de source), applique
  `findBestTitleMatch()` (déjà utilisé pour InfinityBuilds/kami-labs
  dans `resolveTranslation()`) sur chacune des 5 autres - garde les
  matchs trouvés.
- `renderBuildInfo()` : orchestre les deux au chargement du panneau
  (appelée à la fin d'`init()`, sans bloquer le reste), remplit une
  nouvelle section `#d4a-buildinfo-section` insérée juste après
  `#d4a-column-title` et avant les 3 boutons existants. Silencieuse
  (section vide) si aucune classe n'est détectée sur la page - pas
  d'erreur affichée à chaque chargement de page ordinaire, contrairement
  aux erreurs explicites du bouton Classement (déclenchées par un clic
  volontaire, donc justifiées).

### Tests faits avant de considérer ça fini

**Partie la plus incertaine (le format Nuxt/l'extraction réelle) testée
avec un VRAI Playwright pointé directement sur `helltides.com/tower`**
(pas un site de guide chargé de pubs comme la session précédente
aujourd'hui - un site propre, différent contexte) :
- `window.__NUXT__.data` contient bien le tableau attendu **3.57s**
  après le début de la navigation (chargement à 2.04s, donc ~1.5s de
  plus pour l'hydratation Nuxt) - largement dans la marge du délai de
  15s utilisé pour le polling.
- **1545 entrées réelles récupérées**, structure confirmée exactement
  conforme à ce qu'attend le code : `rank`, `battle_tag`, `class`
  (minuscules, ex. `"warlock"` - correspond EXACTEMENT aux ids de classe
  déjà utilisés partout ailleurs dans le fichier, `CLASS_KEYWORDS`),
  `tier`, `skillDetails` (liste de `{name, type, ...}, ex.
  `{"name": "Bombardment", "type": "Core"}`). Les 8 classes du jeu
  présentes, rangs de 1 à 1545.
- Script de test conservé dans le scratchpad de session, pas dans le
  repo (pratique établie).

**Logique pure de correspondance testée hors navigateur** (fonctions
`signature`/`skillTokens`/`isNonEmptySubset`/exclusion des types
génériques - aucune dépendance DOM, extraites du VRAI fichier disque et
exécutées telles quelles sous Node, pas réécrites/simulées) : 4/4 cas
passés, notamment le garde-fou clé - une compétence nommée
"Bombardment Imbuement" de type `Imbuement` ne "confirme" PAS un titre
"Bombardment Demonform Warlock" malgré le mot partagé, exactement le
comportement voulu (évite le faux positif déjà documenté côté Python).

`node --check` OK. Version finale : **2.18**.

### Ce qui reste à valider par l'utilisateur (pas testable sans un vrai gestionnaire de userscripts)

- Le déclenchement réel depuis une page de build (kami-labs, Maxroll,
  etc.) : est-ce qu'un onglet s'ouvre bien discrètement en arrière-plan
  vers helltides.com au chargement du panneau, et la section sous le
  titre se remplit-elle avec un rang plausible et/ou des liens croisés
  vers d'autres sites ?
- Le cache 30 min : recharger la même page (ou une autre du même
  classe) une seconde fois dans les 30 minutes ne devrait PAS rouvrir
  d'onglet vers helltides.com (vérifiable en observant qu'aucun
  nouvel onglet ne clignote).
- Cas où aucune classe n'est détectée sur la page : la section doit
  rester invisible (pas de message d'erreur) - comportement voulu, pas
  testé en conditions réelles.
- Sur des classes/builds peu communs, il est normal et attendu que la
  position officielle affiche "Aucun joueur du classement officiel
  identifié avec ce build" - approximation par nature du rapprochement
  par titre (biaisé volontairement vers la prudence, seuil 0.5 déjà en
  place ailleurs dans le fichier).

## 2026-09-22 (suite) - Incident : fichier écrasé par un processus orphelin, récupéré via export Tampermonkey (2.19)

Après validation manuelle réussie de la v2.16 puis de la v2.18 (voir
ci-dessus), le fichier `userscript/diablo4-assistant.user.js` sur disque
s'est retrouvé réduit à **74 octets de contenu illisible**
(`"'("'("'((...")`) au moment de vérifier le rendu de la nouvelle section.

**Cause identifiée** : deux processus Python/Playwright **orphelins**,
lancés ~10h24 par la session de validation précédente (`test_real.py`,
voir plus haut) et jamais nettoyés après la fin de cette session, sont
restés bloqués en arrière-plan pendant plus d'une heure. En sortant
(probablement) d'un timeout, l'un d'eux a écrasé le fichier - la version
du script chargée en mémoire par ces processus au démarrage (10h24)
était antérieure aux derniers ajustements faits sur `test_real.py`
(edits à 10h29-10h33), donc le code exact responsable de l'écriture n'a
pas pu être identifié avec certitude après coup (fichier déjà réécrit
plusieurs fois depuis). Processus tués (`taskkill`), plus aucun résidu
constaté depuis.

**Pas de filet de sécurité Git** dans ce projet (`E:\DiabloIV-Assistant`
n'est pas un dépôt) - aucune sauvegarde automatique à restaurer. Pistes
de récupération explorées et écartées : historique local VS Code (une
seule entrée, elle-même corrompue), corbeille Windows (vide, cohérent
avec un écrasement en place plutôt qu'une suppression), clichés
instantanés VSS (nécessitent des droits admin non accordés).

**Récupération réussie** via un **export Tampermonkey réel** (Tableau de
bord → script → Fichier → Exporter, téléchargé en `.user.js`/`.txt`) -
plus fiable qu'un copier-coller dans le chat pour un fichier de cette
taille (~220 Ko). Cet export s'est avéré contenir tout le reste du
projet intact, à l'exception de la toute dernière fonctionnalité
(position officielle + liens croisés) dont seul le CSS avait été
sauvegardé côté Tampermonkey - le code JS correspondant manquait. Cause
exacte non tranchée (probablement une sauvegarde faite entre deux étapes
d'édition), sans conséquence pratique une fois la fonctionnalité
réappliquée.

**Reconstruction** : l'agent ayant écrit la fonctionnalité manquante l'a
réappliquée, à l'identique, sur cette base d'export vérifiée. Résultat
vérifié indépendamment par le coordinateur : `diff` contre l'export
d'origine ne montre **qu'une seule ligne modifiée** (le numéro de
version) et 271 lignes ajoutées - aucune autre ligne du contenu
préexistant n'a été touchée. `node --check` OK.

**Défaut résiduel trouvé et corrigé après coup** : une ligne d'en-tête
(`// @grant GM_setValue` / `// @grant GM_getValue`, deux lignes à
l'origine) s'est retrouvée fusionnée avec des fragments de texte
parasite lors de la reconstruction (probablement un résidu de la même
corruption, réinjecté par une correspondance d'édition imprécise) -
invisible à `node --check` puisque contenu dans un commentaire, mais
aurait empêché Tampermonkey de reconnaître le grant `GM_getValue`
(cassant silencieusement le cache du classement officiel). Repéré par un
grep large du fichier entier à la recherche du motif de corruption
connu, corrigé manuellement, plus aucune occurrence trouvée ensuite.

Version finale : **2.19**. **Leçon retenue pour les prochaines
sessions** : toujours lancer un grep de sécurité sur tout le fichier
après une reconstruction/intervention d'un agent, même quand
`node --check` passe - la syntaxe JS ne protège pas contre une
corruption confinée à un commentaire ou une chaîne littérale. Pas de
changement de processus décidé pour l'instant sur le nettoyage des
processus d'arrière-plan (à surveiller si ça se reproduit).

## 2026-09-22 (suite) - "Mes Builds" : mémoriser le dernier build consulté par classe (2.20)

Demande utilisateur : une nouvelle case sous "Recherche de traduction"
("Mes Builds") avec un menu déroulant pour choisir une classe parmi les
8 du jeu, et retrouver le dernier build consulté pour cette classe (avec
un lien pour y retourner).

Implémenté directement (sans agent séparé, vu les mésaventures de la
session) dans `userscript/diablo4-assistant.user.js` :
- `CLASS_LABELS_FR` (nouveau, à côté de `CLASS_KEYWORDS`) - labels
  français des 8 classes pour le menu déroulant, construit
  dynamiquement depuis `Object.keys(CLASS_KEYWORDS)` pour rester
  synchronisé sans double liste à maintenir.
- `getMyBuilds()`/`recordBuildVisit()`/`renderMyBuildForClass()` -
  stockage `GM_setValue`/`GM_getValue` (une seule clé `d4a_my_builds`,
  un objet `{classe: {title, url, visitedAt}}`) - partagé entre tous
  les sites suivis, comme le cache du classement officiel juste
  au-dessus dans le fichier. `recordBuildVisit()` appelé à deux
  endroits : au tout début d'`init()` (pour que le build de la page en
  cours soit visible immédiatement dans le menu, sans attendre la
  résolution asynchrone de la position officielle) et dans
  `renderBuildInfo()` (couvre aussi le cas où `init()` ne l'aurait pas
  encore fait).
- Nouvelle section `#d4a-mybuilds-section` dans le panneau, sous
  "Recherche de traduction" comme demandé - menu déroulant + zone de
  résultat, pré-sélectionne automatiquement la classe de la page
  actuellement consultée.

`node --check` OK, 2502 lignes. Vérifié après coup par un grep large du
fichier entier pour tout motif de corruption connu - rien trouvé.
Version finale : **2.20**. **Pas encore testé en conditions réelles** -
à valider par l'utilisateur : recopier v2.20 dans Tampermonkey, vérifier
que le menu liste bien les 8 classes en français, que visiter un build
Voleur puis un build Barbare garde bien les deux en mémoire
indépendamment, et que revenir sur une ancienne page de la même classe
affiche bien le lien vers le dernier build consulté (pas la page
actuelle si elle diffère - à re-sélectionner la classe dans le menu
pour voir la différence, puisque la page courante se pré-sélectionne et
s'enregistre automatiquement).

## 2026-09-22 (suite) - Dépôt Git initialisé (filet de sécurité après l'incident du jour)

Suite à l'incident de corruption plus haut, proposition faite à
l'utilisateur d'initialiser un dépôt git local (aucun remote) pour avoir
un vrai filet de sécurité la prochaine fois - accepté.

- `git init` dans `E:\DiabloIV-Assistant`, identité locale configurée
  (`git config user.name/email`, scope dépôt uniquement, pas global).
- `.gitignore` créé : exclut `.venv/` (réinstallable via
  `requirements.txt`), `tools/` (d4lf, outil tiers téléchargé, ~344 Mo,
  procédure de réinstallation déjà documentée plus haut dans ce
  fichier), `__pycache__/`/`*.pyc`, `*.log`, et
  `app/data/kamilabs_cache/` (cache de scraping régénérable, ~196 Mo,
  393 fichiers - premier essai de chemin dans le `.gitignore` était
  faux, `app/scrapers/kamilabs_cache/` au lieu du vrai
  `app/data/kamilabs_cache/`, corrigé avant de committer).
- Premier commit : 44 fichiers, ~875 Ko (uniquement le code source
  réel : `app/`, `scripts/`, `userscript/`, `HISTORIQUE.md`,
  `requirements.txt`, `lancer.bat`) - vérifié qu'aucun cache/venv/outil
  tiers volumineux ni fichier sensible ne s'y est glissé avant de
  committer.

À partir de maintenant, tout changement notable sur ce projet devrait
idéalement être suivi d'un commit (pas fait automatiquement à chaque
session - seulement si explicitement demandé, comme pour tout dépôt
git).

## 2026-09-22 (suite) - "Mes Builds" validé, et découverte : l'import de fichier Tampermonkey fonctionne mieux que le copier-coller

L'utilisateur a testé "Mes Builds" (v2.20) en conditions réelles -
**fonctionne**.

**Méthode de mise à jour du script trouvée, à privilégier désormais** :
le tableau de bord Tampermonkey a un onglet "Utilitaires" avec une
section d'import depuis un fichier local - sélectionner directement
`userscript/diablo4-assistant.user.js` sur le disque met à jour le
script installé sans passer par un copier-coller manuel dans
l'éditeur. Beaucoup plus fiable pour un fichier de cette taille (~230
Ko) que la méthode utilisée jusqu'ici, qui s'est révélée risquée de
troncature silencieuse cette session (voir l'incident de corruption
plus haut - l'export/collage manuel avait perdu une fonctionnalité
entière sans erreur visible). **Nouvelle procédure de mise à jour
recommandée pour toutes les prochaines sessions** : Tampermonkey →
tableau de bord → Utilitaires → Importer depuis un fichier → sélectionner
le fichier sur le disque. (Piste explorée et abandonnée avant de
trouver celle-ci : ouvrir `file:///E:/DiabloIV-Assistant/...` dans le
navigateur pour déclencher une invite de mise à jour Tampermonkey - ne
fonctionne pas pour un script installé localement sans `@updateURL`,
le bouton "Vérifier les mises à jour" reste grisé dans ce cas, c'est
normal.)

## 2026-09-22 (suite) - "Comparer les variantes" (2.21)

Demande utilisateur : pouvoir comparer en détail les différentes
versions d'un même build (objets différents, options de compétences
différentes, parfois stats différentes) selon le site ou même au sein
d'un site, pour identifier la meilleure variante.

**Clarifié avant de coder** : désigner LA meilleure variante par le
calcul demanderait un simulateur de dégâts complet, déjà explicitement
écarté du périmètre du projet le 2026-09-19 (trop gros projet à part
entière, formule de dégâts D4 très complexe). Proposé et validé avec
l'utilisateur à la place : afficher les écarts précis entre variantes
(diff), plus un signal objectif déjà disponible - la popularité de
chaque compétence chez les VRAIS joueurs du classement Tower officiel
(déjà intégré pour la position officielle). Pas d'équivalent pour les
objets : le classement n'expose que les compétences équipées, pas
l'équipement complet.

Implémenté directement (sans agent séparé) dans
`userscript/diablo4-assistant.user.js` :
- **`runExtractionMode` généralisé** (utilisé par `openExtractionTab`
  pour lire un build dans un onglet caché) : essaie d'abord
  `extractNativeDetail()` (kami-labs/Maxroll, instantané), puis se
  rabat sur l'ancienne lecture DOM InfinityBuilds
  (`runInfinityBuildsExtraction`, renommée mais logique inchangée) si
  la page cible n'est ni l'un ni l'autre. Avant ce changement, pointer
  un onglet caché vers une URL kami-labs/Maxroll échouait
  silencieusement (10s de polling DOM pour rien, ces sites n'ont pas
  les éléments `.gear-paperdoll-tile` attendus) - jamais un problème
  avant puisque `openExtractionTab` n'était appelé qu'avec des URLs
  InfinityBuilds ; le nouveau bouton en a besoin pour les 3 sources
  extractibles.
- **`EXTRACTABLE_SOURCES`** = kami-labs/Maxroll/InfinityBuilds - les
  3 seules sources avec une extraction de détail déjà construite.
  D4Builds/D4Guides/talion.tv n'ont jamais eu cette extraction (juste
  titre/tier/lien) - signalé explicitement à l'utilisateur dans le
  résultat plutôt que silencieusement omis, plutôt que de prétendre à
  une comparaison exhaustive des 6 sites.
- **`countPlayersUsingSkill(runs, gameClass, skillName)`** - réutilise
  `fetchTowerRuns()` déjà en cache (30 min) pour la position
  officielle, compte combien de joueurs réels de cette classe ont
  exactement cette compétence.
- **`diffVariantField`/`renderVariantComparison`** - regroupe
  objets/compétences par nom replié à travers toutes les variantes
  comparées, sépare "communs à toutes" de "diffèrent", affiche pour
  chaque compétence différente sa popularité réelle (objets : juste la
  liste des sources qui l'utilisent, pas de popularité disponible).
- **`runCompareVariants`** (nouveau bouton "🔬 Comparer les variantes",
  4e bouton du panneau) - lit le build de la page courante (réutilise
  `resolveTranslation()`), trouve les variantes sur les autres sites
  (réutilise `findCrossSiteLinks()`), ouvre jusqu'à 3 onglets cachés en
  parallèle pour les sources extractibles trouvées (borne le coût),
  puis calcule et affiche la comparaison.

`node --check` OK, 2686 lignes. Diff vérifié contre le commit précédent
(`git diff --stat`) - seulement les changements intentionnels, aucune
ligne préexistante touchée par erreur. Grep anti-corruption relancé sur
tout le fichier - rien trouvé. Version finale : **2.21**.

**Pas encore testé en conditions réelles** - à valider par
l'utilisateur : recopier v2.21 (import de fichier Tampermonkey, voir
méthode ci-dessus), cliquer "Comparer les variantes" sur un build ayant
des variantes connues sur d'autres sites, vérifier que les onglets
cachés s'ouvrent discrètement et que le résultat affiché est cohérent
(objets/compétences communs vs différents, popularité réelle sur les
compétences qui diffèrent).

## 2026-09-22 (suite) - Idée d'optimisateur de DPS : écartée du périmètre actuel, à revoir comme projet séparé

Question de l'utilisateur : serait-il compliqué de faire un
optimisateur de DPS ?

**Vérifié avant de répondre** (pas juste répété la limite déjà connue
du 2026-09-19) : téléchargé une vraie page de planner Maxroll
(`maxroll.gg/d4/planner/mmfzmj0i`) et cherché un chiffre de DPS ou un
poids de stats déjà calculé et exposé quelque part dans la donnée qu'on
lit déjà (`search_metadata`) ou ailleurs sur la page - aucune trace
structurée trouvée. Les nombreuses mentions de "dégâts" dans le HTML
sont du texte éditorial écrit à la main par l'auteur du guide
("+22% de dégâts (1.83/1.5=1.22)"), pas un champ calculé pour un
build/gear arbitraire. Pas de raccourci disponible cette fois
(contrairement à d'autres blocages de la session qui avaient une
donnée déjà calculée à récupérer ailleurs).

**Décision** : un vrai optimisateur nécessiterait d'implémenter
nous-mêmes la formule de dégâts complète de D4 (buckets multiplicatifs,
crit, vulnérable, procs conditionnels, disponibilité des buffs, rolls
d'affixes...), avec une maintenance continue à chaque patch - un
projet à part entière, pas une extension de l'outil actuel. Décision
utilisateur, dans le même esprit que celle du 2026-09-19 sur le
simulateur de DPS : **écarté du périmètre de Diablo IV Assistant**,
envisageable un jour comme **projet séparé** qui pourrait ensuite se
greffer à celui-ci (ex. brancher ses résultats dans "Comparer les
variantes" à la place du simple diff objets/compétences actuel). Rien
à coder pour l'instant.

## 2026-09-22 (suite) - Deuxième incident : retour en arrière inexpliqué du userscript (2.21 -> 2.19), résolu en 30 secondes grâce à Git

Juste après avoir committé "Comparer les variantes" (2.21, commit
`9ec6130`) et documenté la décision sur le DPS (aucune édition du
userscript entre les deux), `git add -A` a détecté que
`userscript/diablo4-assistant.user.js` était redevenu du contenu
**v2.19** - "Mes Builds" (2.20) et "Comparer les variantes" (2.21)
disparus, sans qu'aucune commande d'édition n'ait touché ce fichier
dans l'intervalle.

**Cause non identifiée** malgré vérification : aucun processus
`python`/`node`/`chrome-headless-shell` suspect trouvé en cours
(`Get-CimInstance`/`tasklist`), aucune tâche planifiée Windows
référençant ce projet ou un interpréteur Python/Node
(`Get-ScheduledTask`), `E:` est un disque physique fixe local
("Savegarde HDD"), pas un lecteur synchronisé dans le cloud - élimine
la piste OneDrive/Dropbox. Aucun agent Claude actif ou récupérable au
moment de l'incident (`ListAgents` vide). **Hypothèse la plus probable,
non confirmée** : un éditeur de texte externe (VS Code, Notepad++...)
qui aurait encore ce fichier ouvert avec une ancienne version en
mémoire (v2.19), et qui l'aurait re-sauvegardé par-dessus le contenu
plus récent - à vérifier si l'utilisateur a ce fichier ouvert ailleurs
que dans cette session.

**Résolution : quasi instantanée grâce au dépôt git initialisé plus tôt
dans la session** - `git checkout 9ec6130 -- userscript/diablo4-assistant.user.js`
a restauré le contenu exact du dernier commit propre, `node --check` OK,
recommité (`f72818f`). Sans le dépôt git, cet incident aurait été aussi
grave que le premier de la session (aucune autre sauvegarde
disponible). **Confirme que l'initialisation du dépôt git était la
bonne décision** - à garder en tête : committer plus fréquemment
pendant une session de travail (pas seulement en fin de session)
réduit encore la fenêtre de perte possible en cas de nouvel incident
de ce genre.
