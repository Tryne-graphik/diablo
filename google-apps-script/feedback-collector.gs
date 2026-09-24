/**
 * Diablo IV Assistant - collecteur de retours d'expérience + partage de filtres.
 *
 * Un seul endpoint Apps Script gère 2 usages distincts, discrimines par
 * data.action dans le POST :
 *   - action absente ou "feedback" : {title, body, version, page} -> ajoute
 *     une ligne à la feuille "Feedback" (comportement d'origine).
 *   - action "share" : {filterName, filterCode, buildTitle, buildUrl, mode}
 *     -> ajoute une ligne à la feuille "Partages" et renvoie {id} (le
 *     numero de ligne, utilise comme identifiant court dans l'URL).
 * Un GET avec ?share=<id> sert en retour une page HTML autonome (aucun
 * compte ni extension requis pour la lire) affichant le code du filtre et
 * un bouton pour le copier.
 *
 * 2026-09-24 CORRECTION (feedback) : la 1ère version utilisait
 * SpreadsheetApp.getActiveSpreadsheet(), qui ne marche QUE si le script
 * est créé depuis Extensions > Apps Script *à l'intérieur* d'un Google
 * Sheet (script "lié"). Un projet autonome créé directement sur
 * script.google.com (comme celui-ci) n'a pas de "feuille active" - ça
 * plantait avec TypeError: Cannot read properties of null (reading
 * 'getActiveSheet'). Corrigé en ciblant une feuille par son ID
 * explicitement, qui marche dans les deux cas.
 *
 * Configuration :
 *   1. Crée un Google Sheet (sheets.new), copie son ID dans l'URL :
 *      https://docs.google.com/spreadsheets/d/CET_ID_ICI/edit
 *   2. Colle cet ID ci-dessous à la place de "PASTE_YOUR_GOOGLE_SHEET_ID_HERE".
 *      La feuille "Partages" est créée automatiquement au 1er partage -
 *      rien à préparer pour ça.
 *
 * Déploiement :
 *   1. Coller ce fichier dans Code.gs (remplace tout le contenu).
 *   2. Déployer > Nouveau déploiement > Type "Application Web".
 *      - Exécuter en tant que : Moi
 *      - Qui a accès : Tout le monde
 *   3. Autoriser l'accès quand Google le demande (compte du propriétaire).
 *   4. Copier l'URL générée (se termine par /exec) - c'est
 *      APPS_SCRIPT_ENDPOINT_URL côté userscript.
 *
 * Après toute modification de ce fichier (y compris SHEET_ID) :
 * Déployer > Gérer les déploiements > icône crayon > Nouvelle version -
 * éditer le code seul ne suffit pas, l'URL /exec sert l'ancienne
 * version tant qu'aucune nouvelle version n'est publiée.
 */
var SHEET_ID = "1GT9UjN-JCK454fmPTyXlPdbw1OxwYDrfJZl972WKts0";
var SHARES_SHEET_NAME = "Partages";
var SHARES_HEADER = ["Date", "Nom du filtre", "Build", "URL du build", "Mode", "Code"];

function doPost(e) {
  var data = JSON.parse(e.postData.contents);
  if (data.action === "share") {
    return handleShare(data);
  }
  return handleFeedback(data);
}

function handleFeedback(data) {
  var sheet = SpreadsheetApp.openById(SHEET_ID).getSheets()[0];
  sheet.appendRow([
    new Date(),
    data.title || "",
    data.body || "",
    data.version || "",
    data.page || "",
  ]);
  return jsonResponse({ status: "ok" });
}

function handleShare(data) {
  var sheet = getOrCreateSharesSheet();
  sheet.appendRow([
    new Date(),
    data.filterName || "",
    data.buildTitle || "",
    data.buildUrl || "",
    data.mode || "",
    data.filterCode || "",
  ]);
  return jsonResponse({ status: "ok", id: sheet.getLastRow() });
}

function getOrCreateSharesSheet() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName(SHARES_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHARES_SHEET_NAME);
    sheet.appendRow(SHARES_HEADER);
  }
  return sheet;
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  if (e.parameter && e.parameter.share) {
    return renderSharePage(e.parameter.share);
  }
  return ContentService.createTextOutput("Diablo IV Assistant - endpoint de retours OK");
}

/** Lit la ligne d'id `id` (numero de ligne dans la feuille Partages) et rend une page de lecture autonome. */
function renderSharePage(id) {
  var rowIndex = parseInt(id, 10);
  var sheet = getOrCreateSharesSheet();
  if (!rowIndex || rowIndex < 2 || rowIndex > sheet.getLastRow()) {
    return HtmlService.createHtmlOutput("<p>Lien invalide ou expiré.</p>").setTitle("Filtre introuvable");
  }
  var row = sheet.getRange(rowIndex, 1, 1, SHARES_HEADER.length).getValues()[0];
  var filterName = row[1], buildTitle = row[2], buildUrl = row[3], mode = row[4], code = row[5];

  var html = "" +
    "<!doctype html><html><head><meta charset='utf-8'>" +
    "<meta name='viewport' content='width=device-width, initial-scale=1'>" +
    "<style>" +
    "body{font-family:system-ui,sans-serif;max-width:640px;margin:32px auto;padding:0 16px;background:#111;color:#eee}" +
    "h1{font-size:18px}" +
    "a{color:#03d0fc}" +
    "textarea{width:100%;height:100px;box-sizing:border-box;background:#1c1c24;color:#eee;border:1px solid #444;border-radius:6px;padding:8px;font-family:monospace;font-size:12px}" +
    "button{margin-top:8px;padding:8px 16px;border:0;border-radius:6px;background:#7b5cff;color:#fff;font-weight:bold;cursor:pointer}" +
    "p.meta{font-size:13px;color:#aaa}" +
    "</style></head><body>" +
    "<h1>🔗 Filtre de butin partagé - " + escapeHtml(filterName) + "</h1>" +
    "<p class='meta'>Build : " + (buildUrl ? "<a href='" + escapeHtml(buildUrl) + "' target='_blank'>" + escapeHtml(buildTitle || buildUrl) + "</a>" : escapeHtml(buildTitle)) +
    " — Mode : " + escapeHtml(mode) + "</p>" +
    "<textarea id='code' readonly>" + escapeHtml(code) + "</textarea>" +
    "<div><button id='copyBtn'>📋 Copier le code</button></div>" +
    "<p class='meta'>Colle ce code dans l'écran d'import de filtre en jeu (Onglet Objets > Filtre de butin > Importer).</p>" +
    "<script>" +
    "document.getElementById('copyBtn').onclick = function() {" +
    "  var ta = document.getElementById('code');" +
    "  ta.select();" +
    "  var btn = this;" +
    "  (navigator.clipboard ? navigator.clipboard.writeText(ta.value) : Promise.reject())" +
    "    .catch(function() { document.execCommand('copy'); })" +
    "    .then(function() { btn.textContent = '✅ Copié !'; })" +
    "    .catch(function() { btn.textContent = '✅ Copié !'; });" +
    "};" +
    "</script>" +
    "</body></html>";

  return HtmlService.createHtmlOutput(html).setTitle("Filtre partagé - " + filterName);
}

function escapeHtml(value) {
  return String(value == null ? "" : value).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}
