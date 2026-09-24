/**
 * Diablo IV Assistant - collecteur de retours d'expérience.
 *
 * Reçoit un POST JSON {title, body, version, page} envoyé par le
 * userscript (via GM_xmlhttpRequest, donc pas de souci CORS côté
 * client) et ajoute une ligne à la feuille active du classeur Google
 * Sheets lié à ce script. Aucun compte ni identifiant requis côté
 * testeur - seul ce script, exécuté avec les droits du compte Google
 * qui le déploie, écrit réellement dans la feuille.
 *
 * Déploiement (Extensions > Apps Script sur le Google Sheet cible) :
 *   1. Coller ce fichier dans Code.gs (remplace le contenu par défaut).
 *   2. Déployer > Nouveau déploiement > Type "Application Web".
 *      - Exécuter en tant que : Moi
 *      - Qui a accès : Tout le monde
 *   3. Autoriser l'accès quand Google le demande (compte du propriétaire).
 *   4. Copier l'URL générée (se termine par /exec) - c'est
 *      FEEDBACK_ENDPOINT_URL côté userscript.
 *
 * Après toute modification de ce fichier : Déployer > Gérer les
 * déploiements > icône crayon > Nouvelle version - éditer le code seul
 * ne suffit pas, l'URL /exec sert l'ancienne version tant qu'aucune
 * nouvelle version n'est publiée.
 */
function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var data = JSON.parse(e.postData.contents);
  sheet.appendRow([
    new Date(),
    data.title || "",
    data.body || "",
    data.version || "",
    data.page || "",
  ]);
  return ContentService
    .createTextOutput(JSON.stringify({ status: "ok" }))
    .setMimeType(ContentService.MimeType.JSON);
}

/** Sanity check manuel : ouvrir l'URL /exec dans un navigateur doit afficher ce texte. */
function doGet(e) {
  return ContentService.createTextOutput("Diablo IV Assistant - endpoint de retours OK");
}
