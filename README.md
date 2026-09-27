# Diablo IV Assistant

Extension de navigateur (via [Tampermonkey](https://www.tampermonkey.net/)) qui, sur les sites de guides de build Diablo IV :

- traduit automatiquement les objets/compétences EN→FR (Maxroll, InfinityBuilds, kami-labs, D4Builds, D4Guides, talion.tv)
- génère un filtre de butin natif D4 (import direct en jeu) adapté au build affiché
- calcule un classement consensus multi-sources pour une classe donnée, et retrouve la position du build affiché dans le vrai classement officiel de la Tour

## Installation (2 minutes)

1. **Installe Tampermonkey** (extension de navigateur, gratuite) :
   - [Chrome / Edge / Brave](https://chromewebstore.google.com/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)
   - [Firefox](https://addons.mozilla.org/fr/firefox/addon/tampermonkey/)

2. **Installe le script** - clique sur ce lien, Tampermonkey ouvre automatiquement une page d'installation :
   👉 [Installer diablo4-assistant.user.js](https://raw.githubusercontent.com/Tryne-graphik/diablo/master/userscript/diablo4-assistant.user.js)

3. Clique sur **"Installer"** dans la fenêtre Tampermonkey qui s'ouvre. C'est tout.

Le script se met ensuite à jour **automatiquement** (Tampermonkey vérifie régulièrement les nouvelles versions sur ce dépôt) - pas besoin de réinstaller à chaque mise à jour.

## Utilisation

Va sur une page de build (ou la page d'accueil) de Maxroll, InfinityBuilds, kami-labs, D4Builds, D4Guides ou talion.tv : un panneau **"Diablo IV Assistant"** apparaît en haut à gauche de la page (bouton ☰ pour l'afficher/masquer), avec le numéro de version affiché sous le titre.

### Les 4 boutons principaux

- **🇫🇷 Traduire** - traduit les objets/compétences avec les termes exacts du client FR, puis le reste de la page via Google. À cliquer en premier sur une page anglaise. Le bouton s'allume une fois la traduction faite.
- **↩️ Original** - annule la traduction en rechargeant la page (redevient cliquable après "Traduire").
- **🏆 Classement** - classe les meilleurs builds de la classe détectée, par consensus entre les 6 sites de guides (à ne pas confondre avec "🏆 Mon rang" ci-dessous, qui vient du vrai classement officiel en jeu).
- **🔄 Vérifier MAJ** - ouvre la page d'installation du script, Tampermonkey indique lui-même si une mise à jour est disponible.

### Position dans le classement officiel

Sur une page de build, un encadré affiche "Aussi vu sur" (les autres sites où un build équivalent existe) et un bouton **🏆 Mon rang** - cherche le build affiché dans le vrai classement officiel de la Tour (top 200 par classe), pas une estimation : rang, joueur, niveau de Fosse atteint et temps du run.

### Générer un filtre de butin

Deux boutons, deux usages différents :

- **⚔ Filtre Ouvert** - garde tout Légendaire+ visible, pensé pour le leveling ou la chasse aux Aspects en début de partie. Peu d'options à régler.
- **🛡 Filtre Strict** - pensé pour l'endgame (Torment 12+) : plus sélectif, et personnalisable via les cases à cocher juste au-dessus (chaque case a un "ℹ️ En savoir plus" avec le détail). **Les réglages par défaut conviennent à la plupart des builds** - pas besoin de tout comprendre avant de cliquer, ils peuvent être ajustés après coup en regénérant le filtre.

Le code généré s'importe directement en jeu : Réglages > Filtre de butin > Importer.

### 📌 Mes Builds

Sur une page de build, une case à cocher "⭐ Garder ce build dans mes favoris" permet d'enregistrer explicitement le build affiché (un seul favori par classe). "Mes Builds", repliable, liste tous les builds ainsi enregistrés avec un lien pour les rouvrir, et un bouton "✕" pour en retirer un directement depuis la liste.

### 🔎 Recherche Google

Recherche rapide sur tout le web (pas seulement les 6 sites connus) avec des menus déroulants de préréglages : Type (Build/Objet unique/Aspect légendaire/Donjon Cauchemar), Classe, Mode de jeu, Saison, plus un champ de texte libre - ouvre une recherche Google classique dans un nouvel onglet.

## Retour d'expérience / bugs

Le bouton **"💬 Retour d'expérience"** dans le panneau envoie un message directement (aucun compte requis) - utile pour signaler tout ce qui semble confus ou cassé, pas seulement les bugs. On préfère un message "j'ai pas compris ce bouton" à rien du tout.

## Statut

Projet en cours de test actif, non publié sur un store d'extensions. Season 15.

## Crédits

Icône "Diablo skull" du titre du panneau : [Lorc](https://lorcblog.blogspot.com/) via [game-icons.net](https://game-icons.net/1x1/lorc/diablo-skull.html), licence [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/).
