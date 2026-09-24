/**
 * Diablo IV Assistant - collecteur de retours d'expérience.
 *
 * Reçoit un POST JSON {title, body, version, page} envoyé par le
 * userscript (via GM_xmlhttpRequest, donc pas de souci CORS côté
 * client) et ajoute une ligne à la feuille Google Sheets identifiée
 * par SHEET_ID ci-dessous. Aucun compte ni identifiant requis côté
 * testeur - seul ce script, exécuté avec les droits du compte Google
 * qui le déploie, écrit réellement dans la feuille.
 *
 * 2026-09-24 CORRECTION : la 1ère version utilisait
 * SpreadsheetApp.getActiveSpreadsheet(), qui ne marche QUE si le
 * script est créé depuis Extensions > Apps Script *à l'intérieur*
 * d'un Google Sheet (script "lié"). Un projet autonome créé
 * directement sur script.google.com (comme celui-ci) n'a pas de
 * "feuille active" - ça plantait avec TypeError: Cannot read
 * properties of null (reading 'getActiveSheet'). Corrigé en ciblant
 * une feuille par son ID explicitement, qui marche dans les deux cas.
 *
 * Configuration :
 *   1. Crée un Google Sheet (sheets.new), copie son ID dans l'URL :
 *      https://docs.google.com/spreadsheets/d/CET_ID_ICI/edit
 *   2. Colle cet ID ci-dessous à la place de "PASTE_YOUR_GOOGLE_SHEET_ID_HERE".
 *
 * Déploiement :
 *   1. Coller ce fichier dans Code.gs (remplace tout le contenu).
 *   2. Déployer > Nouveau déploiement > Type "Application Web".
 *      - Exécuter en tant que : Moi
 *      - Qui a accès : Tout le monde
 *   3. Autoriser l'accès quand Google le demande (compte du propriétaire).
 *   4. Copier l'URL générée (se termine par /exec) - c'est
 *      FEEDBACK_ENDPOINT_URL côté userscript.
 *
 * Après toute modification de ce fichier (y compris SHEET_ID) :
 * Déployer > Gérer les déploiements > icône crayon > Nouvelle version -
 * éditer le code seul ne suffit pas, l'URL /exec sert l'ancienne
 * version tant qu'aucune nouvelle version n'est publiée.
 */
var SHEET_ID = "1GT9UjN-JCK454fmPTyXlPdbw1OxwYDrfJZl972WKts0";

function doPost(e) {
  var sheet = SpreadsheetApp.openById(SHEET_ID).getSheets()[0];
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
