# Diablo IV Assistant

Extension de navigateur (via [Tampermonkey](https://www.tampermonkey.net/)) qui, sur les sites de guides de build Diablo IV :

- traduit automatiquement les objets/compétences EN→FR (Maxroll, InfinityBuilds, kami-labs, D4Builds, D4Guides, talion.tv)
- génère un filtre de butin natif D4 (import direct en jeu) adapté au build affiché
- calcule un classement consensus multi-sources pour une classe donnée

## Installation (2 minutes)

1. **Installe Tampermonkey** (extension de navigateur, gratuite) :
   - [Chrome / Edge / Brave](https://chromewebstore.google.com/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)
   - [Firefox](https://addons.mozilla.org/fr/firefox/addon/tampermonkey/)

2. **Installe le script** - clique sur ce lien, Tampermonkey ouvre automatiquement une page d'installation :
   👉 [Installer diablo4-assistant.user.js](https://raw.githubusercontent.com/Tryne-graphik/diablo/master/userscript/diablo4-assistant.user.js)

3. Clique sur **"Installer"** dans la fenêtre Tampermonkey qui s'ouvre. C'est tout.

Le script se met ensuite à jour **automatiquement** (Tampermonkey vérifie régulièrement les nouvelles versions sur ce dépôt) - pas besoin de réinstaller à chaque mise à jour.

## Utilisation

Va sur une page de build sur Maxroll, InfinityBuilds, kami-labs, D4Builds, D4Guides ou talion.tv : un panneau **"Diablo IV Assistant"** apparaît en bas à droite de la page (bouton ☰ pour l'afficher/masquer), avec le numéro de version affiché sous le titre.

### Les 3 boutons principaux

- **🇫🇷 Traduire** - traduit les objets/compétences avec les termes exacts du client FR, puis le reste de la page via Google. À cliquer en premier sur une page anglaise.
- **🔍 Recherche** - déplie un petit champ pour chercher la traduction d'un terme précis (EN ou FR) sans traduire toute la page.
- **🏆 Classement** - classe les meilleurs builds de la classe détectée, par consensus entre 6 sites de guides.

### Générer un filtre de butin

Deux boutons, deux usages différents :

- **⚔ Filtre Ouvert** - garde tout Légendaire+ visible, pensé pour le leveling ou la chasse aux Aspects en début de partie. Peu d'options à régler.
- **🛡 Filtre Strict** - pensé pour l'endgame (Torment 12+) : plus sélectif, et personnalisable via les cases à cocher juste au-dessus (chaque case a un "ℹ️ En savoir plus" avec le détail). **Les réglages par défaut conviennent à la plupart des builds** - pas besoin de tout comprendre avant de cliquer, ils peuvent être ajustés après coup en regénérant le filtre.

Le code généré s'importe directement en jeu : Réglages > Filtre de butin > Importer.

### Mes Builds

Un menu déroulant mémorise le dernier build consulté par classe, pour y revenir rapidement sans le rechercher à nouveau.

## Retour d'expérience / bugs

Le bouton **"💬 Retour d'expérience"** dans le panneau envoie un message directement (aucun compte requis) - utile pour signaler tout ce qui semble confus ou cassé, pas seulement les bugs. On préfère un message "j'ai pas compris ce bouton" à rien du tout.

## Statut

Projet en cours de test actif, non publié sur un store d'extensions. Season 15.
