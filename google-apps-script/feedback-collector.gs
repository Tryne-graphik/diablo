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
 *
 * 2026-09-27 SECURITE : SHEET_ID est un identifiant personnel (l'ID de la
 * feuille Google du propriétaire) - il ne doit JAMAIS apparaître en clair
 * dans ce fichier une fois committé sur le dépôt GitHub PUBLIC. Le
 * placeholder ci-dessous doit être remplacé par le vrai ID UNIQUEMENT
 * dans l'éditeur Apps Script en ligne et dans la copie Desktop
 * (feedback-collector.txt, non versionnée) - jamais re-committé ici.
 *
 * SHARED_SECRET, à l'inverse, PEUT rester en clair ici : ce n'est pas un
 * vrai secret puisque le userscript public contient forcément la même
 * valeur (APPS_SCRIPT_SHARED_SECRET) pour pouvoir appeler ce endpoint -
 * ça filtre seulement les bots génériques qui scannent GitHub pour des
 * URLs Apps Script exposées sans lire le code appelant, pas un ami
 * curieux. La vraie protection contre l'abus est le quota journalier
 * ci-dessous, qui reste efficace même si le secret est connu.
 */
var SHEET_ID = "PASTE_YOUR_GOOGLE_SHEET_ID_HERE";
var SHARED_SECRET = "bc7a564a-445a-418c-bcd5-5d7d03a206ca";
var SHARES_SHEET_NAME = "Partages";
var SHARES_HEADER = ["Date", "Nom du filtre", "Build", "URL du build", "Mode", "Code", "Classe", "Supprimé", "Auteur", "Saison", "Type de build", "Variante"];
// 2026-09-30 "Mes filtres" (le jeu ne garde que 10 filtres) : la feuille
// Partages sert de bibliothèque commune. Colonne 8 = suppression douce
// (date de suppression, la ligne reste récupérable en effaçant la case).
var SHARE_COL_CLASS = 7, SHARE_COL_DELETED = 8;
// 2026-09-30: qui a généré le filtre, pour quelle saison / type / variante.
var SHARE_COL_LAST = 12;

// Plafonds de taille par champ (protege la feuille contre un payload
// enorme envoye par erreur ou par abus) et quota d'appels/jour par action
// (protege contre un flot de requetes, secret leake ou pas).
var MAX_LENGTHS = { title: 200, body: 4000, version: 40, page: 500, filterName: 200, buildTitle: 300, buildUrl: 500, mode: 40, filterCode: 20000, gameClass: 40, author: 60, season: 10, buildType: 30, variant: 100 };
var DAILY_QUOTA = { feedback: 200, share: 200, "delete": 100 };

function doPost(e) {
  var data = JSON.parse(e.postData.contents);
  if (data.secret !== SHARED_SECRET) {
    return jsonResponse({ status: "error", message: "unauthorized" });
  }
  var action = data.action === "share" || data.action === "delete" ? data.action : "feedback";
  if (!checkAndConsumeQuota(action)) {
    return jsonResponse({ status: "error", message: "quota exceeded" });
  }
  if (action === "share") {
    return handleShare(data);
  }
  if (action === "delete") {
    return handleDelete(data);
  }
  return handleFeedback(data);
}

/** Quota simple par jour et par action, stocke dans les Properties du script (pas de vraie base, mais suffisant pour bloquer un flot d'abus). */
function checkAndConsumeQuota(action) {
  var props = PropertiesService.getScriptProperties();
  var key = "quota_" + action + "_" + new Date().toISOString().slice(0, 10);
  var count = parseInt(props.getProperty(key) || "0", 10);
  if (count >= DAILY_QUOTA[action]) return false;
  props.setProperty(key, String(count + 1));
  return true;
}

function cap(value, maxLen) {
  return String(value == null ? "" : value).slice(0, maxLen);
}

function handleFeedback(data) {
  var sheet = SpreadsheetApp.openById(SHEET_ID).getSheets()[0];
  sheet.appendRow([
    new Date(),
    cap(data.title, MAX_LENGTHS.title),
    cap(data.body, MAX_LENGTHS.body),
    cap(data.version, MAX_LENGTHS.version),
    cap(data.page, MAX_LENGTHS.page),
  ]);
  return jsonResponse({ status: "ok" });
}

function handleShare(data) {
  var sheet = getOrCreateSharesSheet();
  sheet.appendRow([
    new Date(),
    cap(data.filterName, MAX_LENGTHS.filterName),
    cap(data.buildTitle, MAX_LENGTHS.buildTitle),
    cap(data.buildUrl, MAX_LENGTHS.buildUrl),
    cap(data.mode, MAX_LENGTHS.mode),
    cap(data.filterCode, MAX_LENGTHS.filterCode),
    cap(data.gameClass, MAX_LENGTHS.gameClass),
    "", // Supprimé
    cap(data.author, MAX_LENGTHS.author),
    cap(data.season, MAX_LENGTHS.season),
    cap(data.buildType, MAX_LENGTHS.buildType),
    cap(data.variant, MAX_LENGTHS.variant),
  ]);
  return jsonResponse({ status: "ok", id: sheet.getLastRow() });
}

function handleDelete(data) {
  var sheet = getOrCreateSharesSheet();
  var row = parseInt(data.id, 10);
  if (!row || row < 2 || row > sheet.getLastRow()) {
    return jsonResponse({ status: "error", message: "invalid id" });
  }
  sheet.getRange(row, SHARE_COL_DELETED).setValue(new Date());
  return jsonResponse({ status: "ok" });
}

/** Liste des filtres non supprimés, plus récents d'abord (GET ?list=1&secret=...). */
function listShares() {
  var sheet = getOrCreateSharesSheet();
  var last = sheet.getLastRow();
  if (last < 2) return jsonResponse({ status: "ok", filters: [] });
  var rows = sheet.getRange(2, 1, last - 1, SHARE_COL_LAST).getValues();
  var out = [];
  for (var i = rows.length - 1; i >= 0; i--) {
    var r = rows[i];
    if (r[SHARE_COL_DELETED - 1] || !r[5]) continue;
    out.push({ id: i + 2, date: r[0], name: r[1], build: r[2], url: r[3], mode: r[4], code: r[5], gameClass: r[SHARE_COL_CLASS - 1], author: r[8], season: r[9], buildType: r[10], variant: r[11] });
  }
  return jsonResponse({ status: "ok", filters: out });
}

function getOrCreateSharesSheet() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName(SHARES_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHARES_SHEET_NAME);
    sheet.appendRow(SHARES_HEADER);
  } else if (sheet.getLastColumn() < SHARES_HEADER.length) {
    // Feuille créée avant l'ajout de colonnes : complète l'en-tête.
    sheet.getRange(1, 1, 1, SHARES_HEADER.length).setValues([SHARES_HEADER]);
  }
  return sheet;
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  if (e.parameter && e.parameter.list) {
    if (e.parameter.secret !== SHARED_SECRET) return jsonResponse({ status: "error", message: "unauthorized" });
    return listShares();
  }
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
