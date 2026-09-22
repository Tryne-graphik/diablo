// ==UserScript==
// @name         Diablo IV Assistant - Générateur de filtre
// @namespace    diablo4-assistant.local
// @version      2.21
// @description  Ajoute des boutons sur les pages de build Diablo IV (kami-labs, Maxroll, D4Builds, D4Guides, talion.tv, InfinityBuilds) pour traduire le build, générer un code de filtre de butin, et afficher le classement consensus des meilleurs builds de la classe - sans changer d'onglet et sans serveur local.
// @match        *://kami-labs.fr/diablo-4/builds/*
// @match        *://maxroll.gg/d4/build-guides/*
// @match        *://d4builds.gg/builds/*
// @match        *://d4guides.gg/*/build/*
// @match        *://www.talion.tv/diablo-4/builds/*
// @match        *://infinitybuilds.gg/*/builds/*
// @match        *://helltides.com/tower*
// @connect      infinitybuilds.gg
// @connect      kami-labs.fr
// @connect      maxroll.gg
// @connect      assets-ng.maxroll.gg
// @connect      d4builds.gg
// @connect      d4guides.gg
// @connect      api.talion.tv
// @connect      translate.googleapis.com
// @connect      helltides.com
// @grant        GM_xmlhttpRequest
// @grant        GM_openInTab
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_addValueChangeListener
// @grant        GM_removeValueChangeListener
// ==/UserScript==

(function () {
  "use strict";

  // v2: no local server anymore (E:\DiabloIV-Assistant\app\main.py is no
  // longer needed to use this script) - everything below runs entirely in
  // the browser. What changed vs v1 and why:
  //  - InfinityBuilds' tier list (list of builds) turns out to be
  //    server-rendered - a plain GM_xmlhttpRequest + DOMParser gets the
  //    same title/url/class/tier data Playwright used to fetch, no browser
  //    automation needed for that part.
  //  - A single build's DETAIL page (gear per slot, skills) is NOT
  //    server-rendered (React renders it client-side after load) and a
  //    userscript cannot read a cross-origin iframe's content (blocked by
  //    the browser's same-origin policy regardless of Tampermonkey's
  //    elevated grants) - so instead this briefly opens that build's page
  //    in its own background tab via GM_openInTab. This script also runs
  //    there (it matches infinitybuilds.gg/*/builds/*), reads the real
  //    rendered DOM directly (same extraction logic as before), and
  //    reports the result back to the tab that asked for it via
  //    GM_setValue/GM_addValueChangeListener (Tampermonkey's storage is
  //    shared across all tabs running this script, regardless of origin -
  //    exactly what a cross-tab relay needs). The background tab then
  //    closes itself automatically.
  //  - kami-labs' build list comes from its own JSON AJAX endpoint (no
  //    rendering involved at all), fetched the same way as before, just
  //    via GM_xmlhttpRequest instead of Python's httpx.
  //  - The loot filter's binary encoding (Protocol Buffers, Upsilon72's
  //    reverse-engineered format) is ported here directly in JS, exactly
  //    mirroring app/loot_filter/codec.py (itself already a port of
  //    Upsilon72/d4-filter-generator's original JS).
  //
  // v2.1: native gear/skill extraction for kami-labs and Maxroll, used
  // instead of the InfinityBuilds title-matching + background-tab trick
  // whenever the page being browsed IS one of those two sites - no
  // matching risk (it's the exact build on screen) and no extra tab.
  // Found by fetching real build pages and reading their raw response
  // (2026-09-21):
  //  - kami-labs' own equipment/skills widget ("ESRD") is a SAME-ORIGIN
  //    static file per build (kami-labs.fr/wp-content/uploads/d4-builds/
  //    <buildId>/equipment-grid.html), not a cross-origin iframe like
  //    InfinityBuilds - buildId comes from the visible page's own
  //    #esrd-equipment-iframe[data-build-id]. That file embeds a single
  //    `window.ESRD_STATE_V3` JSON blob with EN *and* FR names already
  //    paired per skill/gear slot, across several build "steps"
  //    (Starter/Midgame/Endgame/Push) - the last step is used (most
  //    endgame-complete). One fetch, both languages, no lang param needed.
  //  - A Maxroll build-guide page embeds exactly one link to its own
  //    Maxroll Planner (`maxroll.gg/d4/planner/<id>`, found inside a
  //    `maxroll/planner-page` Gutenberg block) - fetching that planner
  //    page's own HTML contains exactly one `"search_metadata"` JSON
  //    object with clean EN skill/item name arrays (Maxroll has no FR
  //    site, so FR names are looked up in FR_EN_DICTIONARY afterwards on
  //    a best-effort basis instead). The only wrinkle: the planner id
  //    regex must ignore the site's own "/d4/planner/builds" nav link,
  //    which matches the same pattern.

  const CURRENT_SEASON = 15; // bump each season - see app/config.py's CURRENT_SEASON

  // ---------------------------------------------------------------------
  // Class guessing on the page being browsed - same rough heuristic as v1.
  // ---------------------------------------------------------------------
  const CLASS_KEYWORDS = {
    barbarian: ["barbarian", "barbare"],
    druid: ["druid", "druide"],
    necromancer: ["necromancer", "necromancien", "nécromancien"],
    paladin: ["paladin"],
    rogue: ["rogue", "voleur", "voleuse"],
    sorcerer: ["sorcerer", "sorcier", "sorciere", "sorcière"],
    spiritborn: ["spiritborn", "sacresprit"],
    warlock: ["warlock", "demoniste", "démoniste"],
  };

  // FR display labels for the dropdown in "Mes Builds" (see renderMyBuildsSection
  // below) - same 8 canonical class ids as CLASS_KEYWORDS above, order kept
  // in sync since the dropdown is built from Object.keys(CLASS_KEYWORDS).
  const CLASS_LABELS_FR = {
    barbarian: "Barbare", druid: "Druide", necromancer: "Nécromancien", paladin: "Paladin",
    rogue: "Voleur", sorcerer: "Sorcier", spiritborn: "Sacresprit", warlock: "Démoniste",
  };

  function guessTitle() {
    // document.title first, not the page's first <h1> - found on Maxroll:
    // its first <h1> in DOM order is a site-wide "Diablo IV" brand
    // heading, not the build title, which sits in a LATER <h1> - grabbing
    // "the first h1" silently returned "Diablo IV" and broke matching
    // entirely. document.title reliably carries the actual per-page title
    // on every build site tested (D4Builds, Maxroll). Splitting on "|"
    // strips a trailing "| Site Name" suffix when present (Maxroll has
    // one) without cutting into the title itself, which can legitimately
    // contain " - " (e.g. Maxroll's own "... Season 15 - Hell's Legacy").
    // Maxroll's title also tacks on "... for Diablo IV Season 15 - Hell's
    // Legacy" - the season's theme name (changes every season, so it
    // can't be listed as a fixed noise word) diluted the match below the
    // similarity threshold in testing. This phrasing ("for Diablo IV/4
    // Season N - <theme>") is specific enough to strip outright rather
    // than rely on noise-word filtering alone.
    const titleCandidate = document.title
      .split("|")[0]
      .replace(/\s+for\s+diablo\s*(iv|4).*/i, "")
      .trim();
    if (titleCandidate.length > 4) return titleCandidate;

    // Fallback for the rare page with no meaningful document.title - pick
    // the longest <h1> rather than the first, same reasoning as above.
    const h1s = Array.from(document.querySelectorAll("h1"))
      .map((e) => e.innerText.trim())
      .filter((t) => t.length > 2);
    if (h1s.length > 0) return h1s.reduce((longest, t) => (t.length > longest.length ? t : longest), h1s[0]);

    return document.title;
  }

  function guessClass() {
    const haystack = (location.href + " " + document.title + " " + (document.querySelector("h1")?.innerText || "")).toLowerCase();
    for (const [classId, keywords] of Object.entries(CLASS_KEYWORDS)) {
      if (keywords.some((kw) => haystack.includes(kw))) return classId;
    }
    return null;
  }

  // ---------------------------------------------------------------------
  // Title matching (port of app/title_match.py + app/consensus.py's
  // _signature/_similarity) - finds "the same build" across sites from
  // free-text titles alone.
  // ---------------------------------------------------------------------
  const SIMILARITY_THRESHOLD = 0.5;

  // Ported from app/consensus.py's NOISE_WORDS - deliberately only
  // structural/meta words, never a damage type or skill modifier.
  const NOISE_WORDS = new Set([
    "build", "builds", "endgame", "guide", "guides", "season", "saison",
    "new", "meta", "speed", "farm", "speedfarm", "leveling", "budget",
    "pit", "push", "tower", "polyvalent", "transition", "midgame",
    "one", "button", "onebutton", "variant", "starter", "gameplay",
    "barbarian", "barbare", "druid", "druide", "necromancer", "necromancien",
    "paladin", "rogue", "voleur", "voleuse", "sorcerer", "sorcier", "sorciere",
    "spiritborn", "sacresprit", "warlock", "demoniste",
    // Zero discriminating value in any build title, always safe to strip -
    // found while testing guessTitle() against real site titles (Maxroll's
    // document.title always includes "for Diablo IV Season N").
    "diablo", "for",
  ]);
  for (let n = 1; n < 20; n++) NOISE_WORDS.add("s" + n);

  // Generated from app/data/fr_en_dictionary.json (built by
  // app/fr_en/build_dictionary.py diffing InfinityBuilds' EN/FR pages) -
  // a static snapshot embedded here since this script no longer has a
  // local server to read it from live. Re-generate by re-running that
  // build step and re-exporting if the dictionary grows.
  const FR_EN_DICTIONARY = [{"fr": "Aiguille de Tathamet", "en": "Spine of Tathamet", "kind": "item"}, {"fr": "Allure d'Arreat", "en": "Arreat's Bearing", "kind": "unique_item"}, {"fr": "Angoisse de Drognan", "en": "Drognan's Anguish", "kind": "item"}, {"fr": "Anneau de la lune agonisante", "en": "Ring of Writhing Moon", "kind": "item"}, {"fr": "Anneau des affamés", "en": "Ring of the Ravenous", "kind": "item"}, {"fr": "Anneau du ciel sans étoiles", "en": "Ring of Starless Skies", "kind": "item"}, {"fr": "Anneau du soleil de minuit", "en": "Ring of the Midnight Sun", "kind": "item"}, {"fr": "Appel des Anciens", "en": "Call of the Ancients", "kind": "skill"}, {"fr": "Arbitre de la justice", "en": "Arbiter of Justice", "kind": "skill"}, {"fr": "Armure de glace", "en": "Ice Armor", "kind": "skill"}, {"fr": "Armée de morts", "en": "Army of the Dead", "kind": "skill"}, {"fr": "Aspect arrogant", "en": "Aspect of Arrogance", "kind": "item"}, {"fr": "Aspect assiégé", "en": "Embattled Aspect", "kind": "item"}, {"fr": "Aspect brise-tempêtes", "en": "Storm Splitter's Aspect", "kind": "item"}, {"fr": "Aspect de brise-crâne", "en": "Skullbreaker's Aspect", "kind": "item"}, {"fr": "Aspect de calme intérieur", "en": "Aspect of Inner Calm", "kind": "item"}, {"fr": "Aspect de canalisation", "en": "Aspect of Channeling", "kind": "item"}, {"fr": "Aspect de capitaine des troupes", "en": "Hellbent Commander Aspect", "kind": "item"}, {"fr": "Aspect de confédération impie", "en": "Aspect of the Unholy Confederate", "kind": "item"}, {"fr": "Aspect de constellation élémentaire", "en": "Aspect of Elemental Constellation", "kind": "item"}, {"fr": "Aspect de corruption", "en": "Aspect of Corruption", "kind": "item"}, {"fr": "Aspect de duelliste", "en": "Duelist's Aspect", "kind": "item"}, {"fr": "Aspect de dégâts amplifiés", "en": "Aspect of Amplified Damage", "kind": "item"}, {"fr": "Aspect de désobéissance", "en": "Aspect of Disobedience", "kind": "item"}, {"fr": "Aspect de fauchage", "en": "Reaper's Aspect", "kind": "item"}, {"fr": "Aspect de flamme immaculée", "en": "Aspect of the Untarnished Blaze", "kind": "item"}, {"fr": "Aspect de force céleste", "en": "Aspect of Heavenly Strength", "kind": "item"}, {"fr": "Aspect de force détournée", "en": "Aspect of Redirected Force", "kind": "item"}, {"fr": "Aspect de froid impitoyable", "en": "Aspect of Merciless Cold", "kind": "item"}, {"fr": "Aspect de funambule", "en": "Edgemaster's Aspect", "kind": "item"}, {"fr": "Aspect de gros bras", "en": "Heavy Hitting Aspect", "kind": "item"}, {"fr": "Aspect de héraut orange", "en": "Aspect of the Orange Herald", "kind": "item"}, {"fr": "Aspect de jugement", "en": "Aspect of the Judicator", "kind": "item"}, {"fr": "Aspect de la juridiction de Tyraël", "en": "Aspect of Tyrael's Jurisdiction", "kind": "item"}, {"fr": "Aspect de lames déchirantes", "en": "Aspect of Shredding Blades", "kind": "item"}, {"fr": "Aspect de lave", "en": "Aspect of Lava", "kind": "item"}, {"fr": "Aspect de l’enclume de Glynn", "en": "Aspect of Glynn's Anvil", "kind": "item"}, {"fr": "Aspect de l’heure dorée", "en": "Aspect of the Golden Hour", "kind": "item"}, {"fr": "Aspect de malveillance", "en": "Aspect of Malice", "kind": "item"}, {"fr": "Aspect de maîtrise de soi", "en": "Aspect of Anger Management", "kind": "item"}, {"fr": "Aspect de métamorphose", "en": "Aspect of Metamorphosis", "kind": "item"}, {"fr": "Aspect de pestilence", "en": "Aspect of Pestilence", "kind": "item"}, {"fr": "Aspect de plumage renforcé", "en": "Aspect of Empowered Feathers", "kind": "item"}, {"fr": "Aspect de plumes tombantes", "en": "Aspect of Falling Feathers", "kind": "item"}, {"fr": "Aspect de protection arcanique", "en": "Aspect of Arcane Ward", "kind": "item"}, {"fr": "Aspect de querelleur", "en": "Vehement Brawler's Aspect", "kind": "item"}, {"fr": "Aspect de revers mobilisateur", "en": "Aspect of Rallying Reversal", "kind": "item"}, {"fr": "Aspect de rupture arbitraire", "en": "Wanton Rupture Aspect", "kind": "item"}, {"fr": "Aspect de ruse ailée", "en": "Aspect of Fleet Wings", "kind": "item"}, {"fr": "Aspect de réanimation", "en": "Aspect of Reanimation", "kind": "item"}, {"fr": "Aspect de supériorité", "en": "Aspect of Supremacy", "kind": "item"}, {"fr": "Aspect de surchauffe", "en": "Overheating Aspect", "kind": "item"}, {"fr": "Aspect de toucher maudit", "en": "Aspect of Accursed Touch", "kind": "item"}, {"fr": "Aspect de toxines incapacitantes", "en": "Aspect of Debilitating Toxins", "kind": "item"}, {"fr": "Aspect de vagues de sang", "en": "Tides of Blood Aspect", "kind": "item"}, {"fr": "Aspect de vue perçante", "en": "Aspect of True Sight", "kind": "item"}, {"fr": "Aspect de zéphyr d’arbitre", "en": "Aspect of the Arbiter's Zephyr", "kind": "item"}, {"fr": "Aspect des esquilles d’énergie", "en": "Aspect of Splintering Energy", "kind": "item"}, {"fr": "Aspect des progénitrices", "en": "Progenitor's Aspect", "kind": "item"}, {"fr": "Aspect du chef de guerre", "en": "Bold Chieftain's Aspect", "kind": "item"}, {"fr": "Aspect du mage seigneurial", "en": "Mage-Lord's Aspect", "kind": "item"}, {"fr": "Aspect du sillage glacial", "en": "Aspect of the Frozen Wake", "kind": "item"}, {"fr": "Aspect d’abus", "en": "Exploiter's Aspect", "kind": "item"}, {"fr": "Aspect d’acuité élémentaire", "en": "Aspect of Elemental Acuity", "kind": "item"}, {"fr": "Aspect d’allumage", "en": "Aspect of Ignition", "kind": "item"}, {"fr": "Aspect d’après-coup", "en": "Aspect of Aftermath", "kind": "item"}, {"fr": "Aspect d’armure hérissée", "en": "Aspect of Spiked Armor", "kind": "item"}, {"fr": "Aspect d’arrogance", "en": "Conceited Aspect", "kind": "item"}, {"fr": "Aspect d’ascension", "en": "Aspect of Ascension", "kind": "item"}, {"fr": "Aspect d’avantage alchimique", "en": "Aspect of Alchemical Advantage", "kind": "item"}, {"fr": "Aspect d’ignition", "en": "Aspect of Combustion", "kind": "item"}, {"fr": "Aspect d’imitation d’imprégnation", "en": "Aspect of Imitated Imbuement", "kind": "item"}, {"fr": "Aspect d’immortalité", "en": "Undying Aspect", "kind": "item"}, {"fr": "Aspect d’impact brûlant", "en": "Aspect of Searing Impact", "kind": "item"}, {"fr": "Aspect d’infestation", "en": "Aspect of Infestation", "kind": "item"}, {"fr": "Aspect d’obscurité", "en": "Aspect of Gloom", "kind": "item"}, {"fr": "Aspect d’obscurité réparatrice", "en": "Aspect of Mending Obscurity", "kind": "item"}, {"fr": "Aspect d’os durcis", "en": "Aspect of Hardened Bones", "kind": "item"}, {"fr": "Aspect explosif", "en": "Blasting Aspect", "kind": "item"}, {"fr": "Aspect farouche", "en": "Ferocious Aspect", "kind": "item"}, {"fr": "Aspect pyroclastique", "en": "Pyroclastic Aspect", "kind": "item"}, {"fr": "Aspect remuant", "en": "Writhing Aspect", "kind": "item"}, {"fr": "Aspect rémanent", "en": "Lingering Aspect", "kind": "item"}, {"fr": "Aspect sadique", "en": "Sadistic Aspect", "kind": "item"}, {"fr": "Aspect violent", "en": "Brutal Aspect", "kind": "item"}, {"fr": "Aspect écrasant", "en": "Crushing Aspect", "kind": "item"}, {"fr": "Azurite galvanique", "en": "Galvanic Azurite", "kind": "item"}, {"fr": "Blouse de Morveuse", "en": "Squirt's Blouse", "kind": "item"}, {"fr": "Bombardement", "en": "Bombardment", "kind": "skill"}, {"fr": "Bombe de magma", "en": "Molten Bomb", "kind": "skill"}, {"fr": "Bombe fumigène", "en": "Smoke Grenade", "kind": "skill"}, {"fr": "Bond", "en": "Leap", "kind": "skill"}, {"fr": "Bottes de morbête", "en": "Beastfall Boots", "kind": "item"}, {"fr": "Bouclier de feu", "en": "Flame Shield", "kind": "skill"}, {"fr": "Braies du cœur glacé", "en": "Iceheart Brais", "kind": "item"}, {"fr": "Bride de Tor'Baalos", "en": "Bridle of Tor'Baalos", "kind": "unique_item"}, {"fr": "Brume de sang", "en": "Blood Mist", "kind": "skill"}, {"fr": "Bâton de Kepeleke", "en": "Rod of Kepeleke", "kind": "item"}, {"fr": "Bénédiction écarlate", "en": "Red Blessing", "kind": "item"}, {"fr": "Calamité", "en": "Scourge", "kind": "skill"}, {"fr": "Chanson de la cathédrale", "en": "Cathedral's Song", "kind": "item"}, {"fr": "Chef-d'œuvre de Ramaladni", "en": "Ramaladni's Magnum Opus", "kind": "unique_item"}, {"fr": "Chevalière de Pelghain", "en": "Signet of Pelghain", "kind": "item"}, {"fr": "Clone d’ombre", "en": "Shadow Clone", "kind": "skill"}, {"fr": "Commandement des Déchus", "en": "Command Fallen", "kind": "skill"}, {"fr": "Commandement d’Abodian", "en": "Command Abodian", "kind": "skill"}, {"fr": "Contre-attaque", "en": "Counterattack", "kind": "skill"}, {"fr": "Corne de l'aigle", "en": "Eaglehorn", "kind": "unique_item"}, {"fr": "Cotte-de-rasoir", "en": "Razorplate", "kind": "item"}, {"fr": "Coup de bouclier", "en": "Shield Bash", "kind": "skill"}, {"fr": "Courant instable", "en": "Unstable Currents", "kind": "skill"}, {"fr": "Couronne de Lucion", "en": "Crown of Lucion", "kind": "item"}, {"fr": "Couronne de Léoric", "en": "Leoric's Crown", "kind": "item"}, {"fr": "Courroux du berserker", "en": "Wrath of the Berserker", "kind": "skill"}, {"fr": "Cri ardent", "en": "Blazing Scream", "kind": "skill"}, {"fr": "Cri de guerre", "en": "War Cry", "kind": "skill"}, {"fr": "Cri de ralliement", "en": "Rallying Cry", "kind": "skill"}, {"fr": "Cri provocateur", "en": "Challenging Shout", "kind": "skill"}, {"fr": "Danse des poignards", "en": "Dance of Knives", "kind": "skill"}, {"fr": "Derme toxique", "en": "Toxic Skin", "kind": "skill"}, {"fr": "Des yeux dans la nuit", "en": "Eyes in the Dark", "kind": "item"}, {"fr": "Discrétion", "en": "Stealth", "kind": "item"}, {"fr": "Dissimulation", "en": "Concealment", "kind": "skill"}, {"fr": "Décharge électrique", "en": "Charged Bolts", "kind": "skill"}, {"fr": "Déchirure", "en": "Rend", "kind": "skill"}, {"fr": "Décrépitude", "en": "Decrepify", "kind": "skill"}, {"fr": "El'Druin, épée de justice", "en": "El'Druin, Sword of Justice", "kind": "unique_item"}, {"fr": "Esprit", "en": "Spirit", "kind": "item"}, {"fr": "Essaim de terreur", "en": "Terror Swarm", "kind": "skill"}, {"fr": "Familier", "en": "Familiar", "kind": "skill"}, {"fr": "Flamme dévorante de Moloch", "en": "Moloch's Beating Flame", "kind": "item"}, {"fr": "Fracture infernale", "en": "Hell Fracture", "kind": "skill"}, {"fr": "Frappe de Corne-Tempête", "en": "Strike of Stormhorn", "kind": "item"}, {"fr": "Froid intense", "en": "Deep Freeze", "kind": "skill"}, {"fr": "Galvanisation", "en": "Iron Skin", "kind": "skill"}, {"fr": "Griffe véloce", "en": "Rushing Claw", "kind": "skill"}, {"fr": "Grèves de la pénitence", "en": "Penitent Greaves", "kind": "unique_item"}, {"fr": "Guerrier squelette", "en": "Skeleton Warrior", "kind": "skill"}, {"fr": "Habit de la mer", "en": "Raiment of the Sea", "kind": "item"}, {"fr": "Habit de l'Infini", "en": "Raiment of the Infinite", "kind": "unique_item"}, {"fr": "Harmonie d’Ebewaka", "en": "Harmony of Ebewaka", "kind": "item"}, {"fr": "Hausse-col de souimanga", "en": "Sunbird's Gorget", "kind": "item"}, {"fr": "Heaume de défense de Joritz le tout-puissant", "en": "Tuskhelm of Joritz the Mighty", "kind": "item"}, {"fr": "Homoncule infernal", "en": "Infernal Homunculus", "kind": "item"}, {"fr": "Hydre", "en": "Hydra", "kind": "skill"}, {"fr": "Héraut de Zakarum", "en": "Herald of Zakarum", "kind": "unique_item"}, {"fr": "Héritage de Kessime", "en": "Kessime's Legacy", "kind": "item"}, {"fr": "Héritage d'Esu", "en": "Esu's Heirloom", "kind": "unique_item"}, {"fr": "Idole sanguinaire", "en": "Blood-Mad Idol", "kind": "item"}, {"fr": "Imprégnation de givre", "en": "Cold Imbuement", "kind": "skill"}, {"fr": "Imprégnation de poison", "en": "Poison Imbuement", "kind": "skill"}, {"fr": "Lance des Cieux", "en": "Spear of the Heavens", "kind": "skill"}, {"fr": "Le Grand-père", "en": "The Grandfather", "kind": "item"}, {"fr": "Le dévoreur", "en": "The Devourer", "kind": "skill"}, {"fr": "Le protecteur", "en": "The Protector", "kind": "skill"}, {"fr": "L'idole octuple", "en": "The Eightfold Idol", "kind": "unique_item"}, {"fr": "Mage squelette", "en": "Skeleton Mage", "kind": "skill"}, {"fr": "Mailles châtiées", "en": "Chainscourged Mail", "kind": "item"}, {"fr": "Main d'apothéose", "en": "Hand of Apotheosis", "kind": "unique_item"}, {"fr": "Main écrasante", "en": "Crushing Hand", "kind": "skill"}, {"fr": "Marque du wendigo", "en": "Wendigo Brand", "kind": "item"}, {"fr": "Mur de feu", "en": "Firewall", "kind": "skill"}, {"fr": "Métamorphose", "en": "Metamorphosis", "kind": "skill"}, {"fr": "Météore", "en": "Meteor", "kind": "skill"}, {"fr": "Pas de l’ombre", "en": "Shadow Step", "kind": "skill"}, {"fr": "Pas du néant", "en": "Nether Step", "kind": "skill"}, {"fr": "Pas vacillant", "en": "Flickerstep", "kind": "item"}, {"fr": "Passage des lames", "en": "Blade Shift", "kind": "skill"}, {"fr": "Peau armurée", "en": "Armored Hide", "kind": "skill"}, {"fr": "Pierre de Jordanie", "en": "Stone of Jordan", "kind": "item"}, {"fr": "Piqueur", "en": "Stinger", "kind": "skill"}, {"fr": "Pluie de flèches", "en": "Rain of Arrows", "kind": "skill"}, {"fr": "Poignes dévastatrices de Gohr", "en": "Gohr's Devastating Grips", "kind": "item"}, {"fr": "Poings du destin", "en": "Fists of Fate", "kind": "item"}, {"fr": "Prison d’os", "en": "Bone Prison", "kind": "skill"}, {"fr": "Rage d'Harrogath", "en": "Rage of Harrogath", "kind": "unique_item"}, {"fr": "Ravageur", "en": "Ravager", "kind": "skill"}, {"fr": "Rose bleue", "en": "Blue Rose", "kind": "item"}, {"fr": "Saccage", "en": "Rampage", "kind": "skill"}, {"fr": "Sanctis de Kethamar", "en": "Sanctis of Kethamar", "kind": "item"}, {"fr": "Sceau de la deuxième trompette", "en": "Seal of the Second Trumpet", "kind": "item"}, {"fr": "Section", "en": "Sever", "kind": "skill"}, {"fr": "Solerets de chien des Enfers", "en": "Hellhound's Sabatons", "kind": "item"}, {"fr": "Sombre geôle", "en": "Dark Prison", "kind": "skill"}, {"fr": "Sombre voile", "en": "Dark Shroud", "kind": "skill"}, {"fr": "Sphère foudroyante", "en": "Ball Lightning", "kind": "skill"}, {"fr": "Spiritualité", "en": "Insight", "kind": "item"}, {"fr": "Talisman de Locran", "en": "Locran's Talisman", "kind": "item"}, {"fr": "Talisman du seigneur banni", "en": "Banished Lord's Talisman", "kind": "item"}, {"fr": "Tir pénétrant", "en": "Penetrating Shot", "kind": "skill"}, {"fr": "Tourbillon", "en": "Whirlwind", "kind": "skill"}, {"fr": "Téléportation", "en": "Teleport", "kind": "skill"}, {"fr": "Témérité", "en": "Temerity", "kind": "item"}, {"fr": "Vague de sang", "en": "Blood Wave", "kind": "skill"}, {"fr": "Vision de la tempête de feu", "en": "Vision of the Firestorm", "kind": "item"}, {"fr": "Voile d'argent", "en": "Argent Veil", "kind": "unique_item"}, {"fr": "Volonté de Tibault", "en": "Tibault's Will", "kind": "item"}, {"fr": "Vœu brisé", "en": "Shattered Vow", "kind": "item"}, {"fr": "Élégie", "en": "Elegy", "kind": "item"}, {"fr": "Énigme", "en": "Enigma", "kind": "item"}, {"fr": "Œuvre de Griswold", "en": "Griswold's Opus", "kind": "item"}, {"fr": "Barbare", "en": "barbarian", "kind": "class"}, {"fr": "Druide", "en": "druid", "kind": "class"}, {"fr": "Nécromancien", "en": "necromancer", "kind": "class"}, {"fr": "Paladin", "en": "paladin", "kind": "class"}, {"fr": "Voleur", "en": "rogue", "kind": "class"}, {"fr": "Sorcier", "en": "sorcerer", "kind": "class"}, {"fr": "Sacresprit", "en": "spiritborn", "kind": "class"}, {"fr": "Démoniste", "en": "warlock", "kind": "class"}, {"fr": "Adepte", "en": "Adept", "kind": "unknown"}, {"fr": "Anathème des Primordiaux", "en": "Anathema Of The Primes", "kind": "unknown"}, {"fr": "Aspect de la flamme antique", "en": "Aspect Of Ancient Flame", "kind": "unknown"}, {"fr": "Aspect d’appréhension", "en": "Aspect Of Apprehension", "kind": "unknown"}, {"fr": "Aspect des souvenirs de glace", "en": "Aspect Of Frozen Memories", "kind": "unknown"}, {"fr": "Aspect de toute-puissance", "en": "Aspect Of Might", "kind": "unknown"}, {"fr": "Aspect de surchauffe", "en": "Aspect Of Overheating", "kind": "unknown"}, {"fr": "Irebleue", "en": "Azurewrath", "kind": "unknown"}, {"fr": "Fléau", "en": "Bane", "kind": "paragon_glyph"}, {"fr": "Déluge", "en": "Barrage", "kind": "unknown"}, {"fr": "Raclée", "en": "Bash", "kind": "unknown"}, {"fr": "Marteau béni", "en": "Blessed Hammer", "kind": "unknown"}, {"fr": "Bouclier divin", "en": "Blessed Shield", "kind": "unknown"}, {"fr": "Chancre", "en": "Blight", "kind": "unknown"}, {"fr": "Idole sanguinaire", "en": "Blood Mad Idol", "kind": "unknown"}, {"fr": "Jambières de la lune de sang", "en": "Blood Moon Breeches", "kind": "unknown"}, {"fr": "Rage de sang", "en": "Blood Rage", "kind": "unknown"}, {"fr": "Cri exsangue", "en": "Bloodless Scream", "kind": "unknown"}, {"fr": "Envie sanguinaire", "en": "Bloodthirst", "kind": "unknown"}, {"fr": "Esprit d’os", "en": "Bone Spirit", "kind": "unknown"}, {"fr": "Tempête d’os", "en": "Bone Storm", "kind": "unknown"}, {"fr": "Rocher", "en": "Boulder", "kind": "unknown"}, {"fr": "Brandissement", "en": "Brandish", "kind": "unknown"}, {"fr": "Rixe", "en": "Brawl", "kind": "unknown"}, {"fr": "Astuce", "en": "Canny", "kind": "paragon_glyph"}, {"fr": "Candidature", "en": "Challenger", "kind": "unknown"}, {"fr": "Coup bas", "en": "Cheap Shot", "kind": "paragon_board"}, {"fr": "Brèche", "en": "Chip", "kind": "unknown"}, {"fr": "Choc", "en": "Clash", "kind": "unknown"}, {"fr": "Blâme", "en": "Condemn", "kind": "unknown"}, {"fr": "Sacre", "en": "Consecration", "kind": "unknown"}, {"fr": "Consommation", "en": "Consumption", "kind": "unknown"}, {"fr": "Contrôle", "en": "Control", "kind": "paragon_glyph"}, {"fr": "Physiologique", "en": "Corporeal", "kind": "unknown"}, {"fr": "Vrilles nécrophages", "en": "Corpse Tendrils", "kind": "unknown"}, {"fr": "Tir de couverture", "en": "Cover Fire", "kind": "unknown"}, {"fr": "Broyage", "en": "Crusher", "kind": "unknown"}, {"fr": "Armure cyclonique", "en": "Cyclone Armor", "kind": "unknown"}, {"fr": "Célérité", "en": "Dash", "kind": "unknown"}, {"fr": "Rugissement débilitant", "en": "Debilitating Roar", "kind": "unknown"}, {"fr": "Aura de défiance", "en": "Defiance Aura", "kind": "unknown"}, {"fr": "Sournoiserie", "en": "Devious", "kind": "paragon_glyph"}, {"fr": "Éviscération", "en": "Disembowel", "kind": "unknown"}, {"fr": "Lance divine", "en": "Divine Lance", "kind": "unknown"}, {"fr": "Pierre de dolmen", "en": "Dolmen Stone", "kind": "unknown"}, {"fr": "Domination", "en": "Dominate", "kind": "unknown"}, {"fr": "Aspect de duelliste", "en": "Duelists Aspect", "kind": "unknown"}, {"fr": "Terre et Ciel", "en": "Earth And Sky", "kind": "unknown"}, {"fr": "Brise-terre", "en": "Earth Breaker", "kind": "unknown"}, {"fr": "Rempart de terre", "en": "Earthen Bulwark", "kind": "unknown"}, {"fr": "Aspect du frappe-terre", "en": "Earthstrikers Aspect", "kind": "unknown"}, {"fr": "Élimination", "en": "Eliminator", "kind": "unknown"}, {"fr": "Foi persistante", "en": "Endurant Faith", "kind": "unknown"}, {"fr": "Bourreau", "en": "Executioner", "kind": "unknown"}, {"fr": "Étoile filante", "en": "Falling Star", "kind": "unknown"}, {"fr": "Aura de fanatisme", "en": "Fanaticism Aura", "kind": "unknown"}, {"fr": "Férocité", "en": "Ferocity", "kind": "unknown"}, {"fr": "Fébrilité", "en": "Feverous", "kind": "unknown"}, {"fr": "Champ de langueur", "en": "Field Of Languish", "kind": "unknown"}, {"fr": "Flamme nourricière", "en": "Flamefeeder", "kind": "unknown"}, {"fr": "Carapace de décret de la chair", "en": "Fleshwrit Carapace", "kind": "unknown"}, {"fr": "Forteresse", "en": "Fortress", "kind": "unknown"}, {"fr": "Déchaînement fondamental", "en": "Fundamental Release", "kind": "unknown"}, {"fr": "Droit du sang de Gathlen", "en": "Gathlen's Birthright", "kind": "unknown"}, {"fr": "Couronne du Tueur de divinités", "en": "Godslayer Crown", "kind": "unknown"}, {"fr": "Rage du grizzly", "en": "Grizzly Rage", "kind": "unknown"}, {"fr": "Frappe au sol", "en": "Ground Slam", "kind": "unknown"}, {"fr": "Marteau des Anciens", "en": "Hammer Of The Ancients", "kind": "unknown"}, {"fr": "Mains de brise-monde", "en": "Hands Of The Worldbreaker", "kind": "unknown"}, {"fr": "Cimier arlequin", "en": "Harlequin Crest", "kind": "unknown"}, {"fr": "Crève-cœur", "en": "Heartseeker", "kind": "unknown"}, {"fr": "Solerets de chien des Enfers", "en": "Hellhounds Sabatons", "kind": "unknown"}, {"fr": "Aspect de haute vélocité", "en": "High Velocity Aspect", "kind": "unknown"}, {"fr": "Trait sacré", "en": "Holy Bolt", "kind": "unknown"}, {"fr": "Aura de lumière sacrée", "en": "Holy Light Aura", "kind": "unknown"}, {"fr": "Ouragan", "en": "Hurricane", "kind": "unknown"}, {"fr": "Vierge de fer", "en": "Iron Maiden", "kind": "unknown"}, {"fr": "Réprimande de la Lumière", "en": "Light's Rebuke", "kind": "unknown"}, {"fr": "Lance de foudre", "en": "Lightning Spear", "kind": "unknown"}, {"fr": "Orage", "en": "Lightning Storm", "kind": "unknown"}, {"fr": "Manteau du Gris", "en": "Mantle Of The Grey", "kind": "unknown"}, {"fr": "Cœur fondu de Selig", "en": "Melted Heart Of Selig", "kind": "unknown"}, {"fr": "Zoologue", "en": "Menagerist", "kind": "unknown"}, {"fr": "Puissance", "en": "Might", "kind": "unknown"}, {"fr": "Leurre railleur", "en": "Mocking Lure", "kind": "unknown"}, {"fr": "Flamme dévorante de Moloch", "en": "Molochs Beating Flame", "kind": "unknown"}, {"fr": "Bouteille incendiaire", "en": "Molotov", "kind": "unknown"}, {"fr": "Feu nourri", "en": "Opening Fire", "kind": "unknown"}, {"fr": "Aspect surchargé", "en": "Overcharged Aspect", "kind": "unknown"}, {"fr": "Gantelets du Dévoreur de souffrance", "en": "Paingorger's Gauntlets", "kind": "unknown"}, {"fr": "Jambières", "en": "Pants", "kind": "unknown"}, {"fr": "Pétrification", "en": "Petrify", "kind": "unknown"}, {"fr": "Lierre empoisonné", "en": "Poison Creeper", "kind": "unknown"}, {"fr": "Raillerie", "en": "Provoke", "kind": "unknown"}, {"fr": "Égide de Raheir", "en": "Raheirs Aegis", "kind": "unknown"}, {"fr": "Garde de Raheir", "en": "Raheirs Guard", "kind": "unknown"}, {"fr": "À portée de main", "en": "Ready At Hand", "kind": "unknown"}, {"fr": "Sermon rouge", "en": "Red Sermon", "kind": "unknown"}, {"fr": "Splendeur", "en": "Resplendence", "kind": "unknown"}, {"fr": "Vengeance", "en": "Revenge", "kind": "unknown"}, {"fr": "Anneau de fureur rouge", "en": "Ring Of Red Furor", "kind": "unknown"}, {"fr": "Surin rouillé", "en": "Rustbitten Dirk", "kind": "unique_item"}, {"fr": "Terre calcinée", "en": "Scorched Earth", "kind": "unknown"}, {"fr": "Baiser de bandit", "en": "Scoundrel's Kiss", "kind": "unknown"}, {"fr": "Veille", "en": "Sentinel", "kind": "unknown"}, {"fr": "Imprégnation d’ombre", "en": "Shadow Imbuement", "kind": "unknown"}, {"fr": "Fragment de Verathiel", "en": "Shard Of Verathiel", "kind": "unknown"}, {"fr": "Charge au bouclier", "en": "Shield Charge", "kind": "unknown"}, {"fr": "Tir violent", "en": "Snipe", "kind": "unknown"}, {"fr": "Stratège", "en": "Tactician", "kind": "unknown"}, {"fr": "Séisme", "en": "Tectonic", "kind": "unknown"}, {"fr": "La main de Naz", "en": "The Hand Of Naz", "kind": "unknown"}, {"fr": "Pierre d'Hemat", "en": "The Hemat Stone", "kind": "unknown"}, {"fr": "Aspect de raz-de-marée", "en": "Tidal Aspect", "kind": "unknown"}, {"fr": "Mines à déclencheur", "en": "Trip Mines", "kind": "unknown"}, {"fr": "Stoïcisme", "en": "Undaunted", "kind": "unknown"}, {"fr": "Bandages d'ascète méconnu", "en": "Unsung Ascetic's Wraps", "kind": "unique_item"}, {"fr": "Aspect de querelleur", "en": "Vehement Brawlers Aspect", "kind": "unknown"}, {"fr": "Polyvalence", "en": "Versatility", "kind": "paragon_glyph"}, {"fr": "Porte-guerre", "en": "Warbringer", "kind": "unknown"}, {"fr": "Maître d’armes", "en": "Weapons Master", "kind": "unknown"}, {"fr": "Ursoïde", "en": "Werebear", "kind": "unknown"}, {"fr": "Vent cisaillant", "en": "Wind Shear", "kind": "unknown"}, {"fr": "Piège câblé", "en": "Wire Trap", "kind": "unknown"}, {"fr": "Loups", "en": "Wolves", "kind": "unknown"}, {"fr": "Colère", "en": "Wrath", "kind": "unknown"}, {"fr": "Zèle", "en": "Zeal", "kind": "unknown"}, {"fr": "Les 100 000 pas", "en": "100 000 Steps", "kind": "unknown"}, {"fr": "Abysse", "en": "Abyssal", "kind": "unknown"}, {"fr": "Aspect d’accélération", "en": "Accelerating Aspect", "kind": "unknown"}, {"fr": "Avancée", "en": "Advance", "kind": "unknown"}, {"fr": "Avantage", "en": "Advantage", "kind": "unknown"}, {"fr": "Égide", "en": "Aegis", "kind": "unknown"}, {"fr": "Après-coup", "en": "Aftermath", "kind": "unknown"}, {"fr": "Résistance agressive", "en": "Aggressive Resistance", "kind": "unknown"}, {"fr": "Volonté inébranlable d'Airidah", "en": "Airidah's Inexorable Will", "kind": "unique_item"}, {"fr": "Avantage alchimique", "en": "Alchemical Advantage", "kind": "unknown"}, {"fr": "Contrôle alchimique", "en": "Alchemist Control", "kind": "unknown"}, {"fr": "Embuscade", "en": "Ambush", "kind": "unknown"}, {"fr": "Amplification", "en": "Amplify", "kind": "unknown"}, {"fr": "Amplification des dégâts", "en": "Amplify Damage", "kind": "unknown"}, {"fr": "Guide ancestral", "en": "Ancestral Guidance", "kind": "unknown"}, {"fr": "Harpons des Anciens", "en": "Ancient Harpoons", "kind": "unknown"}, {"fr": "Temps anciens", "en": "Ancient Times", "kind": "unknown"}, {"fr": "Prédation", "en": "Apex", "kind": "unknown"}, {"fr": "Apôtre", "en": "Apostle", "kind": "unknown"}, {"fr": "Arbitre", "en": "Arbiter", "kind": "unknown"}, {"fr": "Fouet électrique", "en": "Arc Lash", "kind": "unknown"}, {"fr": "Arcadie", "en": "Arcadia", "kind": "unknown"}, {"fr": "Kandjar d'Asheara", "en": "Asheara's Khanjar", "kind": "unknown"}, {"fr": "Aspect d’adaptabilité", "en": "Aspect Of Adaptability", "kind": "unknown"}, {"fr": "Aspect de la bénédiction d’Akarat", "en": "Aspect Of Akarats Blessing", "kind": "unknown"}, {"fr": "Aspect de force ancestrale", "en": "Aspect Of Ancestral Force", "kind": "unknown"}, {"fr": "Aspect de perfectionnement angélique", "en": "Aspect Of Angelic Masterwork", "kind": "unknown"}, {"fr": "Aspect de la fureur déchaînée", "en": "Aspect Of Apogeic Furor", "kind": "unknown"}, {"fr": "Aspect d’armageddon", "en": "Aspect Of Armageddon", "kind": "unknown"}, {"fr": "Aspect d’audace", "en": "Aspect Of Audacity", "kind": "unknown"}, {"fr": "Aspect de fureur du berserker", "en": "Aspect Of Berserk Fury", "kind": "unknown"}, {"fr": "Aspect d’hémorragie du berserker", "en": "Aspect Of Berserk Ripping", "kind": "unknown"}, {"fr": "Aspect de froid mordant", "en": "Aspect Of Biting Cold", "kind": "unknown"}, {"fr": "Aspect infectieux", "en": "Aspect Of Bitter Infection", "kind": "unknown"}, {"fr": "Aspect de vengeance hérissée", "en": "Aspect Of Bristling Vengeance", "kind": "unknown"}, {"fr": "Aspect de Bul-Kathos", "en": "Aspect Of Bul-Kathos", "kind": "unknown"}, {"fr": "Aspect d’explosion osseuse", "en": "Aspect Of Bursting Bones", "kind": "unknown"}, {"fr": "Aspect de venin bouillonnant", "en": "Aspect Of Bursting Venoms", "kind": "unknown"}, {"fr": "Aspect de conflit céleste", "en": "Aspect Of Celestial Strife", "kind": "unknown"}, {"fr": "Aspect d’expiation", "en": "Aspect Of Chastisement", "kind": "unknown"}, {"fr": "Aspect de concentration", "en": "Aspect Of Concentration", "kind": "unknown"}, {"fr": "Aspect de contamination", "en": "Aspect Of Contamination", "kind": "unknown"}, {"fr": "Aspect de contemplation", "en": "Aspect Of Contemplation", "kind": "unknown"}, {"fr": "Aspect de délabrement", "en": "Aspect Of Decay", "kind": "unknown"}, {"fr": "Aspect de domination", "en": "Aspect Of Dominance", "kind": "unknown"}, {"fr": "Aspect de tremblements de terre", "en": "Aspect Of Earthquakes", "kind": "unknown"}, {"fr": "Aspect de griffes électriques", "en": "Aspect Of Electrified Claws", "kind": "unknown"}, {"fr": "Aspect de destin élémentaire", "en": "Aspect Of Elemental Fate", "kind": "unknown"}, {"fr": "Aspect de cercle de lames", "en": "Aspect Of Encircling Blades", "kind": "unknown"}, {"fr": "Aspect d’appétit funeste", "en": "Aspect Of Fel Gluttony", "kind": "unknown"}, {"fr": "Aspect de vents violents", "en": "Aspect Of Fierce Winds", "kind": "unknown"}, {"fr": "Aspect de puissance des forêts", "en": "Aspect Of Forest Power", "kind": "unknown"}, {"fr": "Aspect de l'enclume de Glynn", "en": "Aspect Of Glynns Anvil", "kind": "unknown"}, {"fr": "Aspect des veines rapaces", "en": "Aspect Of Grasping Veins", "kind": "unknown"}, {"fr": "Aspect de trombe centripète", "en": "Aspect Of Grasping Whirlwind", "kind": "unknown"}, {"fr": "Aspect de l’onguent de Hale", "en": "Aspect Of Hales Salve", "kind": "unknown"}, {"fr": "Aspect de châtiment sacré", "en": "Aspect Of Holy Punishment", "kind": "unknown"}, {"fr": "Aspect de fissures incendiaires", "en": "Aspect Of Incendiary Fissures", "kind": "unknown"}, {"fr": "Aspect de destin inévitable", "en": "Aspect Of Inevitable Fate", "kind": "unknown"}, {"fr": "Aspect d’interdiction", "en": "Aspect Of Interdiction", "kind": "unknown"}, {"fr": "Aspect de la ferveur de Jacques", "en": "Aspect Of Jacques Fervor", "kind": "unknown"}, {"fr": "Aspect de répression cinétique", "en": "Aspect Of Kinetic Suppression", "kind": "unknown"}, {"fr": "Aspect de la souveraineté de Lagera", "en": "Aspect Of Lageras Sovereignty", "kind": "unknown"}, {"fr": "Aspect des écrits de Lapa", "en": "Aspect Of Lapas Scripture", "kind": "unknown"}, {"fr": "Aspect de rage infinie", "en": "Aspect Of Limitless Rage", "kind": "unknown"}, {"fr": "Aspect de l’éveil spirituel", "en": "Aspect Of Minds Awakening", "kind": "unknown"}, {"fr": "Aspect de domination occulte", "en": "Aspect Of Occult Dominion", "kind": "unknown"}, {"fr": "Aspect des courants accablants", "en": "Aspect Of Overwhelming Currents", "kind": "unknown"}, {"fr": "Aspect de froid pénétrant", "en": "Aspect Of Piercing Cold", "kind": "unknown"}, {"fr": "Aspect de puissance des plaines", "en": "Aspect Of Plains Power", "kind": "unknown"}, {"fr": "Aspect de prosélytisme", "en": "Aspect Of Proselytizing", "kind": "unknown"}, {"fr": "Aspect de la brume vivace", "en": "Aspect Of Quickening Fog", "kind": "unknown"}, {"fr": "Aspect de représailles", "en": "Aspect Of Retaliation", "kind": "unknown"}, {"fr": "Aspect de vindicte", "en": "Aspect Of Retribution", "kind": "unknown"}, {"fr": "Aspect de dents de scie", "en": "Aspect Of Serration", "kind": "unknown"}, {"fr": "Aspect de servitude et sacrifice", "en": "Aspect Of Service And Sacrifice", "kind": "unknown"}, {"fr": "Aspect de puissance des cieux", "en": "Aspect Of Sky Power", "kind": "unknown"}, {"fr": "Aspect de carnage", "en": "Aspect Of Slaughter", "kind": "unknown"}, {"fr": "Aspect d’éclats dispersés", "en": "Aspect Of Splintering Shards", "kind": "unknown"}, {"fr": "Aspect de fragments stellaires", "en": "Aspect Of Star Shards", "kind": "unknown"}, {"fr": "Aspect de vigueur dérobée", "en": "Aspect Of Stolen Vigor", "kind": "unknown"}, {"fr": "Aspect de synergie", "en": "Aspect Of Synergy", "kind": "unknown"}, {"fr": "Aspect de ténacité", "en": "Aspect Of Tenacity", "kind": "unknown"}, {"fr": "Aspect de l’alpha", "en": "Aspect Of The Alpha", "kind": "unknown"}, {"fr": "Aspect de zéphyr d’arbitre", "en": "Aspect Of The Arbiters Zephyr", "kind": "unknown"}, {"fr": "Aspect de conduction bondissante", "en": "Aspect Of The Bounding Conduit", "kind": "unknown"}, {"fr": "Aspect de la dette du métamorphe", "en": "Aspect Of The Changelings Debt", "kind": "unknown"}, {"fr": "Aspect de sagesse par le nombre", "en": "Aspect Of The Crowded Sage", "kind": "unknown"}, {"fr": "Aspect d’aura maudite", "en": "Aspect Of The Cursed Aura", "kind": "unknown"}, {"fr": "Aspect des damnés", "en": "Aspect Of The Damned", "kind": "unknown"}, {"fr": "Aspect de barrière réfléchissante", "en": "Aspect Of The Deflecting Barrier", "kind": "unknown"}, {"fr": "Aspect de disciple", "en": "Aspect Of The Disciple", "kind": "unknown"}, {"fr": "Aspect de la forteresse", "en": "Aspect Of The Fortress", "kind": "unknown"}, {"fr": "Aspect de la toundra Glacée", "en": "Aspect Of The Frozen Tundra", "kind": "unknown"}, {"fr": "Aspect du grand festin", "en": "Aspect Of The Great Feast", "kind": "unknown"}, {"fr": "Aspect de l’indomptable", "en": "Aspect Of The Indomitable", "kind": "unknown"}, {"fr": "Aspect de défense de fer", "en": "Aspect Of The Iron Warrior", "kind": "unknown"}, {"fr": "Aspect du concordat de mastodonte", "en": "Aspect Of The Juggernauts Covenant", "kind": "unknown"}, {"fr": "Aspect du crépuscule", "en": "Aspect Of The Moonrise", "kind": "unknown"}, {"fr": "Aspect du Protecteur", "en": "Aspect Of The Protector", "kind": "unknown"}, {"fr": "Aspect du cœur prudent", "en": "Aspect Of The Prudent Heart", "kind": "unknown"}, {"fr": "Aspect de la bête enragée", "en": "Aspect Of The Rabid Beast", "kind": "unknown"}, {"fr": "Aspect de la bête humaine enragée", "en": "Aspect Of The Rampaging Werebeast", "kind": "unknown"}, {"fr": "Aspect de sauvagerie précipitée", "en": "Aspect Of The Rushing Wilds", "kind": "unknown"}, {"fr": "Aspect de cavalcade", "en": "Aspect Of The Stampede", "kind": "unknown"}, {"fr": "Pas de l'ombre Amélioré", "en": "Aspect Of The Umbral", "kind": "unknown"}, {"fr": "Aspect de la terreur ursine", "en": "Aspect Of The Ursine Horror", "kind": "unknown"}, {"fr": "Aspect de Valintyr", "en": "Aspect Of The Valintyr", "kind": "unknown"}, {"fr": "Aspect du vide", "en": "Aspect Of The Void", "kind": "unknown"}, {"fr": "Aspect de sauvagerie", "en": "Aspect Of The Wildrage", "kind": "unknown"}, {"fr": "Aspect du concordat de fanatique", "en": "Aspect Of The Zealots Covenant", "kind": "unknown"}, {"fr": "Aspect de la juridiction de Tyraël", "en": "Aspect Of Tyraels Jurisdiction", "kind": "unknown"}, {"fr": "Aspect d’ombre ultime", "en": "Aspect Of Ultimate Shadow", "kind": "unknown"}, {"fr": "Aspect de coups inflexibles", "en": "Aspect Of Unyielding Hits", "kind": "unknown"}, {"fr": "Aspect de gloire suprême", "en": "Aspect Of Utmost Glory", "kind": "unknown"}, {"fr": "Aspect de vaillance", "en": "Aspect Of Valiance", "kind": "unknown"}, {"fr": "Aspect de restauration luxuriante", "en": "Aspect Of Verdant Restoration", "kind": "unknown"}, {"fr": "Aspect de renforcement exprimé", "en": "Aspect Of Vocalized Empowerment", "kind": "unknown"}, {"fr": "Aspect de la loi de Watkins", "en": "Aspect Of Watkins Law", "kind": "unknown"}, {"fr": "Meurtrier", "en": "Assassin", "kind": "unknown"}, {"fr": "Innovation des auras", "en": "Aura Innovation", "kind": "unknown"}, {"fr": "Conduit axial", "en": "Axial Conduit", "kind": "unknown"}, {"fr": "Contrecoup", "en": "Backlash", "kind": "unknown"}, {"fr": "Aspect balistique", "en": "Ballistic Aspect", "kind": "unknown"}, {"fr": "Bague du Premier Souffle", "en": "Band Of First Breath", "kind": "unknown"}, {"fr": "Gants de rose ichoreuse", "en": "Bands Of Ichorous Rose", "kind": "unknown"}, {"fr": "Banished Lord's Talisman", "en": "Banished Lords Talisman", "kind": "unknown"}, {"fr": "Transe du combat", "en": "Battle Trance", "kind": "unknown"}, {"fr": "Aspect de folie guerrière", "en": "Battle-Mad Aspect", "kind": "unknown"}, {"fr": "Balise", "en": "Beacon", "kind": "unknown"}, {"fr": "Hostilité", "en": "Belligerence", "kind": "unknown"}, {"fr": "Remède amer", "en": "Bitter Medicine", "kind": "unknown"}, {"fr": "Guide béni", "en": "Blessed Guide", "kind": "unknown"}, {"fr": "Bénédiction", "en": "Blessing", "kind": "unknown"}, {"fr": "Aspect putrescent", "en": "Blighted Aspect", "kind": "unknown"}, {"fr": "Dime de sang", "en": "Blood Begets Blood", "kind": "unknown"}, {"fr": "Aspect de sang bouillonnant", "en": "Blood Boiling Aspect", "kind": "unknown"}, {"fr": "Hurlement sanglant", "en": "Blood Howl", "kind": "unknown"}, {"fr": "Prélèvement", "en": "Blood Lance", "kind": "unknown"}, {"fr": "Aspect du traqueur de sang", "en": "Blood Seekers Aspect", "kind": "unknown"}, {"fr": "Soif de sang", "en": "Blood-drinker", "kind": "unknown"}, {"fr": "Bain de sang", "en": "Bloodbath", "kind": "unknown"}, {"fr": "Sang nourricier", "en": "Bloodfeeder", "kind": "unknown"}, {"fr": "Aspect du chef de guerre", "en": "Bold Chieftains Aspect", "kind": "unknown"}, {"fr": "Concasseur d’os", "en": "Bonebreaker", "kind": "unknown"}, {"fr": "Gantelets en plaques d’os", "en": "Boneweave Gauntlets", "kind": "unknown"}, {"fr": "Aspect du combat", "en": "Brawlers Aspect", "kind": "unknown"}, {"fr": "Briser la ligne", "en": "Break The Line", "kind": "unknown"}, {"fr": "Aspect de banditisme téméraire", "en": "Breakneck Bandits Aspect", "kind": "unknown"}, {"fr": "Brillance", "en": "Brilliance", "kind": "unknown"}, {"fr": "Aspect de rempart", "en": "Bulwarks Aspect", "kind": "unknown"}, {"fr": "Instinct bouillonnant", "en": "Burning Instinct", "kind": "unknown"}, {"fr": "Aspect cadavérique", "en": "Cadaverous Aspect", "kind": "unknown"}, {"fr": "Cage de folie", "en": "Cage Of Madness", "kind": "unknown"}, {"fr": "Appel de la Nature", "en": "Call Of The Wild", "kind": "unknown"}, {"fr": "Chausse-trappe", "en": "Caltrops", "kind": "unknown"}, {"fr": "Château", "en": "Castle", "kind": "unknown"}, {"fr": "Cataclysme", "en": "Cataclysm", "kind": "unknown"}, {"fr": "Conduction incessante", "en": "Ceaseless Conduit", "kind": "unknown"}, {"fr": "Chaîne d’éclairs", "en": "Chain Lightning", "kind": "unknown"}, {"fr": "Surcharge", "en": "Charged", "kind": "unknown"}, {"fr": "Aspect d’éclair chargé", "en": "Charged Aspect", "kind": "unknown"}, {"fr": "Arme d’hast envoûtante", "en": "Charming Polearm", "kind": "unknown"}, {"fr": "Aspect de tromperie", "en": "Cheats Aspect", "kind": "unknown"}, {"fr": "Aspect Clandestinité", "en": "Clandestine Aspect", "kind": "unknown"}, {"fr": "Clarté", "en": "Clarity", "kind": "unknown"}, {"fr": "Griffe", "en": "Claw", "kind": "unknown"}, {"fr": "Déchirure", "en": "Cleave", "kind": "unknown"}, {"fr": "Corps à corps", "en": "Close Quarters Combat", "kind": "unknown"}, {"fr": "Contact", "en": "Closer", "kind": "unknown"}, {"fr": "Armoiries", "en": "Coat Of Arms", "kind": "unknown"}, {"fr": "Colosse", "en": "Colossal", "kind": "unknown"}, {"fr": "Commotion", "en": "Concussion", "kind": "unknown"}, {"fr": "Choc traumatisant", "en": "Concussive Stomp", "kind": "unknown"}, {"fr": "Conduction", "en": "Conduit", "kind": "unknown"}, {"fr": "Conjuration", "en": "Conjurer", "kind": "unknown"}, {"fr": "Vrilles constrictives", "en": "Constricting Tendrils", "kind": "unknown"}, {"fr": "Réserve innée", "en": "Core Reserve", "kind": "unknown"}, {"fr": "Explosion macabre", "en": "Corpse Explosion", "kind": "unknown"}, {"fr": "Capuchon de l'Anonyme", "en": "Cowl Of The Nameless", "kind": "unknown"}, {"fr": "Aspect de roche écrasante", "en": "Crashstone Aspect", "kind": "unknown"}, {"fr": "Cratère", "en": "Crater", "kind": "unknown"}, {"fr": "Guide de la secte", "en": "Cult Leader", "kind": "unknown"}, {"fr": "Noirceur", "en": "Darkness", "kind": "unknown"}, {"fr": "Flambeaube", "en": "Dawnfire", "kind": "unknown"}, {"fr": "Embuscade mortelle", "en": "Deadly Ambush", "kind": "unknown"}, {"fr": "Résurrection", "en": "Deadraiser", "kind": "unknown"}, {"fr": "Piège mortel", "en": "Death Trap", "kind": "unknown"}, {"fr": "Pavane mortelle", "en": "Death's Pavane", "kind": "unknown"}, {"fr": "Visage immortel", "en": "Deathless Visage", "kind": "unknown"}, {"fr": "Masque mortuaire de Nirmitruq", "en": "Deathmask Of Nirmitruq", "kind": "unknown"}, {"fr": "Toxines incapacitantes", "en": "Debilitating Toxins", "kind": "unknown"}, {"fr": "Flétrissure", "en": "Decay", "kind": "unknown"}, {"fr": "Décimation", "en": "Decimator", "kind": "unknown"}, {"fr": "Posture défensive", "en": "Defensive Stance", "kind": "unknown"}, {"fr": "Défiance", "en": "Defiance", "kind": "unknown"}, {"fr": "Lame démoniaque", "en": "Demonblade", "kind": "unknown"}, {"fr": "Profanation", "en": "Desecration", "kind": "unknown"}, {"fr": "Dévastation", "en": "Devastation", "kind": "unknown"}, {"fr": "Aspect de loup féroce", "en": "Dire Wolfs Aspect", "kind": "unknown"}, {"fr": "Mélopée d'Odium", "en": "Dirge Of Odium", "kind": "unique_item"}, {"fr": "Divinité", "en": "Divinity", "kind": "unknown"}, {"fr": "Coup étourdissant", "en": "Dizzying Blow", "kind": "unknown"}, {"fr": "Condamneuse", "en": "Doombringer", "kind": "unique_item"}, {"fr": "Drain de vitalité", "en": "Drain Vitality", "kind": "unknown"}, {"fr": "Force d’âme", "en": "Drive", "kind": "unknown"}, {"fr": "Mouvement druidique", "en": "Druid Motion", "kind": "unknown"}, {"fr": "Aspect du tourbillon de poussière", "en": "Dust Devils Aspect", "kind": "unknown"}, {"fr": "Pointe de terre", "en": "Earth Spike", "kind": "unknown"}, {"fr": "Dévastation terrestre", "en": "Earthen Devastation", "kind": "unknown"}, {"fr": "Aspect de funambule", "en": "Edgemasters Aspect", "kind": "unknown"}, {"fr": "Efficacité", "en": "Efficacy", "kind": "unknown"}, {"fr": "Prime exotique", "en": "Eldritch Bounty", "kind": "unknown"}, {"fr": "Électro", "en": "Electro", "kind": "unknown"}, {"fr": "Électrocution", "en": "Electrocution", "kind": "unknown"}, {"fr": "Faveur élémentaire", "en": "Elemental Favor", "kind": "unknown"}, {"fr": "Invocation élémentaire", "en": "Elemental Summoner", "kind": "unknown"}, {"fr": "Synergies élémentaires", "en": "Elemental Synergies", "kind": "unknown"}, {"fr": "Élémentaliste", "en": "Elementalist", "kind": "unknown"}, {"fr": "Élixir d’avantage", "en": "Elixir Of Advantage", "kind": "unknown"}, {"fr": "Élixir d’avantage II", "en": "Elixir Of Advantage II", "kind": "unknown"}, {"fr": "Élixir de vigueur II", "en": "Elixir Of Fortitude II", "kind": "unknown"}, {"fr": "Élixir de barbelés", "en": "Elixir Of Iron Barbs", "kind": "unknown"}, {"fr": "Élixir de barbelés II", "en": "Elixir Of Iron Barbs II", "kind": "unknown"}, {"fr": "Élixir de précision", "en": "Elixir Of Precision", "kind": "unknown"}, {"fr": "Élixir de ressourcerie", "en": "Elixir Of Resourcefulness", "kind": "unknown"}, {"fr": "Élixir de ressourcerie II", "en": "Elixir Of Resourcefulness II", "kind": "unknown"}, {"fr": "Aspect verglacé", "en": "Encased Aspect", "kind": "unknown"}, {"fr": "Maîtrise des enchantements", "en": "Enchantment Master", "kind": "unknown"}, {"fr": "Tempête éternelle", "en": "Endless Tempest", "kind": "unknown"}, {"fr": "Bâton sémillant", "en": "Energy Staff", "kind": "unknown"}, {"fr": "Illumination", "en": "Enlightenment", "kind": "unknown"}, {"fr": "Aspect embrumé", "en": "Enshrouding Aspect", "kind": "unknown"}, {"fr": "Envenimation", "en": "Envenom", "kind": "unknown"}, {"fr": "Camée débordant d'Esadora", "en": "Esadora's Overflowing Cameo", "kind": "unknown"}, {"fr": "Férocité d’Esu", "en": "Esus Ferocity", "kind": "unknown"}, {"fr": "Aspect perpétuel", "en": "Everliving Aspect", "kind": "unknown"}, {"fr": "Aspect de bourreau", "en": "Executioners Aspect", "kind": "unknown"}, {"fr": "Exploitation", "en": "Exploit", "kind": "unknown"}, {"fr": "Abus de faiblesse", "en": "Exploit Weakness", "kind": "unknown"}, {"fr": "Aspect d’abus", "en": "Exploiters Aspect", "kind": "unknown"}, {"fr": "Explosion", "en": "Explosive", "kind": "unknown"}, {"fr": "Charge explosive", "en": "Explosive Charge", "kind": "unknown"}, {"fr": "Exposition", "en": "Exposure", "kind": "unknown"}, {"fr": "Crocs et griffes", "en": "Fang And Claw", "kind": "unknown"}, {"fr": "Aspect d’hémorragie", "en": "Fastblood Aspect", "kind": "unknown"}, {"fr": "Ferveur", "en": "Fervent", "kind": "unknown"}, {"fr": "Suppuration", "en": "Fester", "kind": "unknown"}, {"fr": "Férocité", "en": "Fierce", "kind": "unknown"}, {"fr": "Finalité", "en": "Finality", "kind": "unknown"}, {"fr": "Éclair de feu", "en": "Fire Bolt", "kind": "unknown"}, {"fr": "Boule de feu", "en": "Fireball", "kind": "unknown"}, {"fr": "Forme physique", "en": "Fitness", "kind": "unknown"}, {"fr": "Déferlement de flammes", "en": "Flame Surge", "kind": "unknown"}, {"fr": "Technique parfaite", "en": "Flawless Technique", "kind": "unknown"}, {"fr": "Écorchement", "en": "Flay", "kind": "unknown"}, {"fr": "Nécrose", "en": "Flesh-eater", "kind": "unknown"}, {"fr": "Fluidité", "en": "Fluidity", "kind": "unknown"}, {"fr": "Rafale", "en": "Flurry", "kind": "unknown"}, {"fr": "Concentration", "en": "Focused", "kind": "unknown"}, {"fr": "Chausses du monde en déclin", "en": "Footfalls Of The Waning World", "kind": "unknown"}, {"fr": "Force de la Nature", "en": "Force Of Nature", "kind": "unknown"}, {"fr": "Flèche puissante", "en": "Forceful Arrow", "kind": "unknown"}, {"fr": "Force d’âme", "en": "Fortitude", "kind": "unknown"}, {"fr": "Éclat d'hiverre", "en": "Fractured Winterglass", "kind": "unique_item"}, {"fr": "Fragilité", "en": "Frailty", "kind": "unknown"}, {"fr": "Frénésie", "en": "Frenzy", "kind": "unknown"}, {"fr": "Destin frigide", "en": "Frigid Fate", "kind": "unknown"}, {"fr": "Finesse glaciale", "en": "Frigid Finesse", "kind": "unknown"}, {"fr": "Éclair de givre", "en": "Frost Bolt", "kind": "unknown"}, {"fr": "Nova de givre", "en": "Frost Nova", "kind": "unknown"}, {"fr": "Engeleurs", "en": "Frostburn", "kind": "unknown"}, {"fr": "Orbe gelé", "en": "Frozen Orb", "kind": "unknown"}, {"fr": "Revigorement", "en": "Fueled", "kind": "unknown"}, {"fr": "Vol de mort", "en": "Fueled By Death", "kind": "unknown"}, {"fr": "Fulmination", "en": "Fulminate", "kind": "unknown"}, {"fr": "Fournaise", "en": "Furnace", "kind": "unknown"}, {"fr": "Azurite galvanique", "en": "Galvanic Azurite", "kind": "unknown"}, {"fr": "Aspect d’entaille galvanisée", "en": "Galvanized Slashers Aspect", "kind": "unknown"}, {"fr": "Aspect d’arpenteur spectral", "en": "Ghostwalker Aspect", "kind": "unknown"}, {"fr": "Aspect glacial", "en": "Glacial Aspect", "kind": "unknown"}, {"fr": "Obscurité", "en": "Gloom", "kind": "unknown"}, {"fr": "Poignes de l'ombre", "en": "Grasp Of Shadow", "kind": "unique_item"}, {"fr": "Tombelle", "en": "Gravebloom", "kind": "unknown"}, {"fr": "Garde des tombes", "en": "Gravekeeper", "kind": "unknown"}, {"fr": "Aspect de gravité", "en": "Gravitational Aspect", "kind": "unknown"}, {"fr": "Moisson sinistre", "en": "Grim Harvest", "kind": "unknown"}, {"fr": "Choc terrestre", "en": "Ground Stomp", "kind": "unknown"}, {"fr": "Garde", "en": "Guarded", "kind": "unknown"}, {"fr": "Plaies béantes", "en": "Gushing Wounds", "kind": "unknown"}, {"fr": "Consommation", "en": "Guzzler", "kind": "unknown"}, {"fr": "Appel du verglas", "en": "Hail Of Verglas", "kind": "unknown"}, {"fr": "Hâte", "en": "Haste", "kind": "unknown"}, {"fr": "Marche de la Haine", "en": "Hatreds March", "kind": "unknown"}, {"fr": "Chasse aux têtes", "en": "Headhunter", "kind": "unknown"}, {"fr": "Fureur des Cieux", "en": "Heavens Fury", "kind": "unknown"}, {"fr": "Main lourde", "en": "Heavy Handed", "kind": "unknown"}, {"fr": "Poids lourd", "en": "Heavyweight", "kind": "unknown"}, {"fr": "Abîme d'Hécaton", "en": "Hecaton Chasm", "kind": "unique_item"}, {"fr": "Aspect d’agitation", "en": "Hectic Aspect", "kind": "unknown"}, {"fr": "Malveillance décuplée", "en": "Heightened Malice", "kind": "unknown"}, {"fr": "Sens aiguisés", "en": "Heightened Senses", "kind": "unknown"}, {"fr": "Héritier de perdition", "en": "Heir Of Perdition", "kind": "unknown"}, {"fr": "Capitaine des troupes", "en": "Hellbent Commander", "kind": "unknown"}, {"fr": "Saignée", "en": "Hemorrhage", "kind": "unknown"}, {"fr": "Morgenstern du héraut", "en": "Herald's Morningstar", "kind": "unknown"}, {"fr": "Chair dépecée", "en": "Hewed Flesh", "kind": "unknown"}, {"fr": "Gelée blanche", "en": "Hoarfrost", "kind": "unknown"}, {"fr": "Perfectionnement", "en": "Hone", "kind": "unknown"}, {"fr": "Affûtage", "en": "Honed", "kind": "unknown"}, {"fr": "Sabots du dieu de la montagne", "en": "Hooves Of The Mountain God", "kind": "unknown"}, {"fr": "Outrecuidance", "en": "Hubris", "kind": "unknown"}, {"fr": "Aspect massif", "en": "Hulking Aspect", "kind": "unknown"}, {"fr": "Monstruosité colossale", "en": "Hulking Monstrosity", "kind": "unknown"}, {"fr": "Être humain", "en": "Human", "kind": "unknown"}, {"fr": "Lames de glace", "en": "Ice Blades", "kind": "unknown"}, {"fr": "Éclats de glace", "en": "Ice Shards", "kind": "unknown"}, {"fr": "Chute de glace", "en": "Icefall", "kind": "unknown"}, {"fr": "Absorption", "en": "Imbiber", "kind": "unknown"}, {"fr": "Combat rapproché", "en": "In-Fighter", "kind": "unknown"}, {"fr": "Carreau incendiaire", "en": "Incendiary Bolt", "kind": "unknown"}, {"fr": "Incinération", "en": "Incinerate", "kind": "unknown"}, {"fr": "Fureur insatiable", "en": "Insatiable Fury", "kind": "unknown"}, {"fr": "Complexité", "en": "Intricacy", "kind": "unknown"}, {"fr": "Le fer aiguise le fer", "en": "Iron Sharpens Iron", "kind": "unknown"}, {"fr": "Plume irrégulière", "en": "Jagged Plume", "kind": "unknown"}, {"fr": "Jugement dernier", "en": "Judgement Day", "kind": "unknown"}, {"fr": "Jugement d'Auriel", "en": "Judgment Of Auriel", "kind": "unique_item"}, {"fr": "Heaume-glaive de juge", "en": "Judicant's Glaivehelm", "kind": "unknown"}, {"fr": "Juge", "en": "Judicator", "kind": "unknown"}, {"fr": "Mastodonte", "en": "Juggernaut", "kind": "unknown"}, {"fr": "Aspect de mastodonte", "en": "Juggernauts Aspect", "kind": "unknown"}, {"fr": "Décret de Kalan", "en": "Kalans Edict", "kind": "unknown"}, {"fr": "Dépositaire", "en": "Keeper", "kind": "unknown"}, {"fr": "Dépositaire de l’hiver", "en": "Keeper Of Winter", "kind": "unknown"}, {"fr": "Marche-steppes de Khamsin", "en": "Khamsin Steppewalkers", "kind": "unknown"}, {"fr": "Éboulement", "en": "Landslide", "kind": "unknown"}, {"fr": "Loi", "en": "Law", "kind": "unknown"}, {"fr": "Instinct de Leyrana", "en": "Leyranas Instinct", "kind": "unknown"}, {"fr": "Le Mur vigilant", "en": "Lidless Wall", "kind": "unknown"}, {"fr": "Mantelet de loyauté", "en": "Loyalty's Mantle", "kind": "unknown"}, {"fr": "Fente", "en": "Lunging Strike", "kind": "unknown"}, {"fr": "Pacte horrible", "en": "Lurid Pact", "kind": "unique_item"}, {"fr": "Soif de carnage", "en": "Lust For Carnage", "kind": "unknown"}, {"fr": "Aspect du mage seigneurial", "en": "Mage-Lords Aspect", "kind": "unknown"}, {"fr": "Croissant maléfique", "en": "Malefic Crescent", "kind": "unknown"}, {"fr": "Bouclier de mana", "en": "Mana Shield", "kind": "unknown"}, {"fr": "Aspect de mutilation", "en": "Manglers Aspect", "kind": "unknown"}, {"fr": "Mantelet de Fureur de la montagne", "en": "Mantle Of Mountain's Fury", "kind": "unknown"}, {"fr": "Mobilisation", "en": "Marshal", "kind": "unknown"}, {"fr": "Vigueur martiale", "en": "Martial Vigor", "kind": "unknown"}, {"fr": "Tête pensante", "en": "Mastermind", "kind": "unknown"}, {"fr": "Perfectionnement", "en": "Masterworking", "kind": "unknown"}, {"fr": "Mutilation", "en": "Maul", "kind": "unknown"}, {"fr": "Jet puissant", "en": "Mighty Throw", "kind": "unknown"}, {"fr": "Hallucination", "en": "Mirage", "kind": "unknown"}, {"fr": "Aspect de tir d’élite empêtré", "en": "Mired Sharpshooters Aspect", "kind": "unknown"}, {"fr": "Alliance Mjölnic", "en": "Mj Lnic Ryng", "kind": "unknown"}, {"fr": "Élan", "en": "Momentum", "kind": "unknown"}, {"fr": "Aspect Rage lunaire", "en": "Moonrage Aspect", "kind": "unknown"}, {"fr": "de Nagu", "en": "Nagu", "kind": "unknown"}, {"fr": "Catastrophe naturelle", "en": "Natural Disaster", "kind": "unknown"}, {"fr": "Mouvement naturel", "en": "Natural Motion", "kind": "unknown"}, {"fr": "Résistance naturelle", "en": "Natural Resistance", "kind": "unknown"}, {"fr": "Allonge de la Nature", "en": "Natures Reach", "kind": "unknown"}, {"fr": "Carapace nécrotique", "en": "Necrotic Carapace", "kind": "unknown"}, {"fr": "Nesekem le Héraut", "en": "Nesekem The Herald", "kind": "unique_item"}, {"fr": "Terreur nocturne", "en": "Night Terror", "kind": "unknown"}, {"fr": "Aucun témoin", "en": "No Witnesses", "kind": "unknown"}, {"fr": "Lame d’obsidienne", "en": "Obsidian Blade", "kind": "unknown"}, {"fr": "Œil d’ocelot", "en": "Ocelots Eye", "kind": "unknown"}, {"fr": "Catalyseur d'Okun", "en": "Okun's Catalyst", "kind": "unique_item"}, {"fr": "Communion avec la nature", "en": "One With Nature", "kind": "unknown"}, {"fr": "Iris ophidien", "en": "Ophidian Iris", "kind": "unknown"}, {"fr": "Aspect de l’opportuniste", "en": "Opportunists Aspect", "kind": "unknown"}, {"fr": "Oppression", "en": "Oppressive", "kind": "unknown"}, {"fr": "Surpassement", "en": "Outmatch", "kind": "unknown"}, {"fr": "Énergie débordante", "en": "Overflowing Energy", "kind": "unknown"}, {"fr": "Nœud de départ de parangon", "en": "Paragon Starting Node", "kind": "unknown"}, {"fr": "Voie de l'Émissaire", "en": "Path Of The Emissary", "kind": "unique_item"}, {"fr": "Revanche", "en": "Payback", "kind": "unknown"}, {"fr": "Tempête parfaite", "en": "Perfect Storm", "kind": "unknown"}, {"fr": "Pergélisol", "en": "Permafrost", "kind": "unknown"}, {"fr": "Persévérance", "en": "Perseverance", "kind": "unknown"}, {"fr": "Flèches perçantes", "en": "Piercing Arrows", "kind": "unknown"}, {"fr": "Piège de poison", "en": "Poison Trap", "kind": "unknown"}, {"fr": "Expertise : arme d'hast", "en": "Polearm Expertise", "kind": "unknown"}, {"fr": "Prédication", "en": "Preacher", "kind": "unknown"}, {"fr": "Avantage", "en": "Press The Advantage", "kind": "unknown"}, {"fr": "Orgueil", "en": "Pride", "kind": "unknown"}, {"fr": "Tempo virtuose", "en": "Prodigys Tempo", "kind": "unknown"}, {"fr": "Aspect protecteur", "en": "Protecting Aspect", "kind": "unknown"}, {"fr": "Protection", "en": "Protector", "kind": "unknown"}, {"fr": "Pulvérisation", "en": "Pulverize", "kind": "unknown"}, {"fr": "Perforation", "en": "Puncture", "kind": "unknown"}, {"fr": "Blâme", "en": "Punishment", "kind": "unknown"}, {"fr": "Purification", "en": "Purify", "kind": "unknown"}, {"fr": "Pyromane", "en": "Pyromaniac", "kind": "unknown"}, {"fr": "Suprême de la reine", "en": "Queens Supreme", "kind": "unknown"}, {"fr": "Métamorphose rapide", "en": "Quickshift", "kind": "unknown"}, {"fr": "Volée de plumes", "en": "Quill Volley", "kind": "unknown"}, {"fr": "Réanimation de squelette", "en": "Raise Skeleton", "kind": "unknown"}, {"fr": "Ralliement", "en": "Rally", "kind": "unknown"}, {"fr": "Aspect expéditif", "en": "Rapid Aspect", "kind": "unknown"}, {"fr": "Tir rapide", "en": "Rapid Fire", "kind": "unknown"}, {"fr": "Vigueur de Rathma", "en": "Rathmas Vigor", "kind": "unknown"}, {"fr": "Corbeaux", "en": "Ravens", "kind": "unknown"}, {"fr": "Fauchage", "en": "Reap", "kind": "unknown"}, {"fr": "Poursuite de la Faucheuse", "en": "Reapers Pursuit", "kind": "unknown"}, {"fr": "Aspect bondissant", "en": "Rebounding Aspect", "kind": "unknown"}, {"fr": "Euphorie de rédamine", "en": "Reddamine Buzz", "kind": "unknown"}, {"fr": "Renforcement", "en": "Reinforced", "kind": "unknown"}, {"fr": "Implacabilité", "en": "Relentless", "kind": "unknown"}, {"fr": "Renouveau", "en": "Renewal", "kind": "unknown"}, {"fr": "Résilience", "en": "Resilience", "kind": "unknown"}, {"fr": "Résilience", "en": "Resilient", "kind": "unknown"}, {"fr": "Résistance", "en": "Resistant", "kind": "unknown"}, {"fr": "Résolution", "en": "Resolution", "kind": "unknown"}, {"fr": "Détermination", "en": "Resolve", "kind": "unknown"}, {"fr": "Résonance", "en": "Resonance", "kind": "unknown"}, {"fr": "Révélation", "en": "Revealing", "kind": "unknown"}, {"fr": "Anneau de Mendeln", "en": "Ring Of Mendeln", "kind": "unknown"}, {"fr": "Rituel", "en": "Ritual", "kind": "unknown"}, {"fr": "Bris de roche", "en": "Rock Splitter", "kind": "unknown"}, {"fr": "Porte-Lumière putride", "en": "Rotting Lightbringer", "kind": "unknown"}, {"fr": "Opiniâtreté", "en": "Rugged", "kind": "unknown"}, {"fr": "Bagarre", "en": "Rumble", "kind": "unknown"}, {"fr": "Aspect de conduction runomancienne", "en": "Runeworkers Conduit Aspect", "kind": "unknown"}, {"fr": "Crampons runiques", "en": "Runic Cleats", "kind": "unknown"}, {"fr": "Gants runiques", "en": "Runic Gloves", "kind": "unknown"}, {"fr": "Calotte runique", "en": "Runic Skullcap", "kind": "unknown"}, {"fr": "Chevalière de sabotage", "en": "Saboteur's Signet", "kind": "unknown"}, {"fr": "Sabre de Tsasgal", "en": "Sabre Of Tsasgal", "kind": "unknown"}, {"fr": "Armes sacrées", "en": "Sacred Arms", "kind": "unknown"}, {"fr": "Sacrifice", "en": "Sacrificial", "kind": "unknown"}, {"fr": "Aspect sacrificiel", "en": "Sacrificial Aspect", "kind": "unknown"}, {"fr": "Murmures des sages", "en": "Sages Whisper", "kind": "unknown"}, {"fr": "Sanguivore, lame de Zir", "en": "Sanguivor Blade Of Zir", "kind": "unknown"}, {"fr": "Sape", "en": "Sapping", "kind": "unknown"}, {"fr": "L’odeur de la mort", "en": "Scent Of Death", "kind": "unknown"}, {"fr": "Parfums du désert méridien", "en": "Scents Of The Desert Afternoon", "kind": "unknown"}, {"fr": "Sceptre des Trois", "en": "Scepter Of The Three", "kind": "unknown"}, {"fr": "Veste de bandit", "en": "Scoundrel's Leathers", "kind": "unknown"}, {"fr": "Fléau de Duriel", "en": "Scourge Of Duriel", "kind": "unknown"}, {"fr": "Sceau des Ophanim", "en": "Seal Of The Ophanim", "kind": "unknown"}, {"fr": "Chaleur ardente", "en": "Searing Heat", "kind": "unknown"}, {"fr": "Second souffle", "en": "Second Wind", "kind": "unknown"}, {"fr": "Graine d'Horazon", "en": "Seed Of Horazon", "kind": "unique_item"}, {"fr": "Aspect du serpent", "en": "Serpentine Aspect", "kind": "unknown"}, {"fr": "Chancre d’ombre", "en": "Shadowblight", "kind": "unknown"}, {"fr": "Fracas", "en": "Shatter", "kind": "unknown"}, {"fr": "Aspect du berger", "en": "Shepherds Aspect", "kind": "unknown"}, {"fr": "Porte-bouclier", "en": "Shield Bearer", "kind": "unknown"}, {"fr": "Jet de bouclier", "en": "Shield Throw", "kind": "unknown"}, {"fr": "Armure étincelante", "en": "Shining Armor", "kind": "unknown"}, {"fr": "Aspect frissonnant", "en": "Shivering Aspect", "kind": "unknown"}, {"fr": "Impact électrique", "en": "Shocking Impact", "kind": "unknown"}, {"fr": "Aspect d’onde de choc", "en": "Shockwave Aspect", "kind": "unknown"}, {"fr": "Déchiquetage", "en": "Shred", "kind": "unknown"}, {"fr": "Voile de la fausse mort", "en": "Shroud Of False Death", "kind": "unknown"}, {"fr": "Voile de Khanduras", "en": "Shroud Of Khanduras", "kind": "unknown"}, {"fr": "Frappes drainantes", "en": "Siphoning Strikes", "kind": "unknown"}, {"fr": "Maîtrise des mages squelettes", "en": "Skeletal Mage Mastery", "kind": "unknown"}, {"fr": "Aspect de marchepeau", "en": "Skinwalkers Aspect", "kind": "unknown"}, {"fr": "Aspect de brise-crâne", "en": "Skullbreakers Aspect", "kind": "unknown"}, {"fr": "Traquenard", "en": "Snare", "kind": "unknown"}, {"fr": "Aspect du garde-neige", "en": "Snowguards Aspect", "kind": "unknown"}, {"fr": "Aspect du voile de neige", "en": "Snowveiled Aspect", "kind": "unknown"}, {"fr": "Élévation", "en": "Soar", "kind": "unknown"}, {"fr": "Chant de la montagne", "en": "Song Of The Mountain", "kind": "unknown"}, {"fr": "Épices apaisantes", "en": "Soothing Spices", "kind": "unknown"}, {"fr": "Griffe de l'âme", "en": "Soulbrand", "kind": "unique_item"}, {"fr": "Faille des âmes", "en": "Soulrift", "kind": "unknown"}, {"fr": "Cercle guette-âme", "en": "Soulwatch Hoop", "kind": "unknown"}, {"fr": "Étincelle", "en": "Spark", "kind": "unknown"}, {"fr": "Spirale matinale", "en": "Spiral Morning", "kind": "unknown"}, {"fr": "Aspect de lien spirituel", "en": "Spirit Bond Aspect", "kind": "unknown"}, {"fr": "Aspect fracturant", "en": "Splintering Aspect", "kind": "unknown"}, {"fr": "À ressort", "en": "Spring-loaded", "kind": "unknown"}, {"fr": "Bâton de Lam Esen", "en": "Staff Of Lam Esen", "kind": "unknown"}, {"fr": "Diadème de l'étoile déchue", "en": "Starfall Coronet", "kind": "unknown"}, {"fr": "Surtension statique", "en": "Static Surge", "kind": "unknown"}, {"fr": "Aspect du berserker robuste", "en": "Steadfast Berserkers Aspect", "kind": "unknown"}, {"fr": "Poigne de fer", "en": "Steel Grasp", "kind": "unknown"}, {"fr": "Explosion de pierres", "en": "Stone Burst", "kind": "unknown"}, {"fr": "Tempête de feu", "en": "Storm Of Fire", "kind": "unknown"}, {"fr": "Coup de tonnerre", "en": "Storm Strike", "kind": "unknown"}, {"fr": "Compagnon de l'orage", "en": "Storm's Companion", "kind": "unique_item"}, {"fr": "Aspect de l’oiseau des tempêtes", "en": "Stormcrows Aspect", "kind": "unknown"}, {"fr": "Robuste", "en": "Sturdy", "kind": "unknown"}, {"fr": "Invocation d'Ae'grom", "en": "Summon Aegrom", "kind": "unknown"}, {"fr": "Marque solaire", "en": "Sunbrand", "kind": "unknown"}, {"fr": "Nuit déchirée", "en": "Sundered Night", "kind": "unknown"}, {"fr": "Supériorité", "en": "Supremacy", "kind": "unknown"}, {"fr": "Instinct de survie", "en": "Survival Instincts", "kind": "unknown"}, {"fr": "Boucle irisée de Tal Rasha", "en": "Tal Rasha's Iridescent Loop", "kind": "unknown"}, {"fr": "Serre", "en": "Talon", "kind": "unknown"}, {"fr": "Fureur mesurée", "en": "Tempered Fury", "kind": "unknown"}, {"fr": "Rugissement de la tempête", "en": "Tempest Roar", "kind": "unknown"}, {"fr": "Ténacité", "en": "Tenacity", "kind": "unknown"}, {"fr": "Territoire", "en": "Territorial", "kind": "unknown"}, {"fr": "Terreur", "en": "Terror", "kind": "unknown"}, {"fr": "Basilic", "en": "The Basilisk", "kind": "unknown"}, {"fr": "La meilleure attaque", "en": "The Best Offense", "kind": "unknown"}, {"fr": "La lame de la vue embrasée", "en": "The Blade Of Sight Aflame", "kind": "unknown"}, {"fr": "Fendoir du Boucher", "en": "The Butcher's Cleaver", "kind": "unknown"}, {"fr": "Chasseur", "en": "The Hunter", "kind": "unknown"}, {"fr": "L'Oculus", "en": "The Oculus", "kind": "unique_item"}, {"fr": "Aspect de pénitence", "en": "The Penitents Aspect", "kind": "unknown"}, {"fr": "Traqueur", "en": "The Seeker", "kind": "unknown"}, {"fr": "Umbracrux", "en": "The Umbracrux", "kind": "unknown"}, {"fr": "Peau dure", "en": "Thick Skin", "kind": "unknown"}, {"fr": "Épines et chardons", "en": "Thorns And Thistles", "kind": "unknown"}, {"fr": "Pointe de foudre", "en": "Thunderspike", "kind": "unknown"}, {"fr": "Foudroiement", "en": "Thunderstruck", "kind": "unknown"}, {"fr": "Déchéance du titan", "en": "Titans Fall", "kind": "unknown"}, {"fr": "Torche", "en": "Torch", "kind": "unknown"}, {"fr": "Tornade", "en": "Tornado", "kind": "unknown"}, {"fr": "Blindage", "en": "Toughened", "kind": "unknown"}, {"fr": "Griffes toxiques", "en": "Toxic Claws", "kind": "unknown"}, {"fr": "Pistage", "en": "Tracker", "kind": "unknown"}, {"fr": "Piétinement", "en": "Trample", "kind": "unknown"}, {"fr": "Maîtrise des pièges", "en": "Trap Mastery", "kind": "unknown"}, {"fr": "Attaques trompeuses", "en": "Trick Attacks", "kind": "unknown"}, {"fr": "Ficelles du métier", "en": "Tricks Of The Trade", "kind": "unknown"}, {"fr": "Aspect de la crapule", "en": "Tricksters Aspect", "kind": "unknown"}, {"fr": "Tourbillon", "en": "Twister", "kind": "unknown"}, {"fr": "Lames sournoises", "en": "Twisting Blades", "kind": "unknown"}, {"fr": "Expertise : masse à deux mains", "en": "Two-Handed Mace Expertise", "kind": "unknown"}, {"fr": "Puissance de Tyraël", "en": "Tyrael's Might", "kind": "unknown"}, {"fr": "Casque de bâtard hideux", "en": "Ugly Bastard Helm", "kind": "unknown"}, {"fr": "Aspect ombreux", "en": "Umbrous Aspect", "kind": "unknown"}, {"fr": "Sans contrainte", "en": "Unconstrained", "kind": "unknown"}, {"fr": "Déchaînement", "en": "Unleash", "kind": "unknown"}, {"fr": "Puissance effrénée", "en": "Unrestrained Power", "kind": "unknown"}, {"fr": "Élixirs instables", "en": "Unstable Elixirs", "kind": "unknown"}, {"fr": "Indomptable", "en": "Untamed", "kind": "unknown"}, {"fr": "Force ursine", "en": "Ursine Strength", "kind": "unknown"}, {"fr": "Avant-garde", "en": "Vanguard", "kind": "unknown"}, {"fr": "Aspect d’avant-garde", "en": "Vanguards Aspect", "kind": "unknown"}, {"fr": "Goût de chair", "en": "Varyana Taste Of Flesh", "kind": "unknown"}, {"fr": "Prière de Vasily", "en": "Vasily's Prayer", "kind": "unknown"}, {"fr": "Victimisation", "en": "Victimize", "kind": "unknown"}, {"fr": "Vigilance", "en": "Vigilant", "kind": "unknown"}, {"fr": "Vigueur", "en": "Vigorous", "kind": "unknown"}, {"fr": "Aspect vigoureux", "en": "Vigorous Aspect", "kind": "unknown"}, {"fr": "Aspect vertueux", "en": "Virtuous Aspect", "kind": "unknown"}, {"fr": "Bouclier visqueux", "en": "Viscous Shield", "kind": "unknown"}, {"fr": "Frappes vitales", "en": "Vital Strikes", "kind": "unknown"}, {"fr": "Arsenal ambulant", "en": "Walking Arsenal", "kind": "unknown"}, {"fr": "Torgnole", "en": "Wallop", "kind": "unknown"}, {"fr": "Protection", "en": "Ward", "kind": "unknown"}, {"fr": "Protection de la blanche colombe", "en": "Ward Of The White Dove", "kind": "unknown"}, {"fr": "Sentier de la guerre", "en": "Warpath", "kind": "unknown"}, {"fr": "Coriace", "en": "Warrior", "kind": "unknown"}, {"fr": "Croissant gibbeux", "en": "Waxing Gibbous", "kind": "unknown"}, {"fr": "Faiblesse", "en": "Weakness", "kind": "unknown"}, {"fr": "Maîtrise des armes", "en": "Weapon Master", "kind": "unknown"}, {"fr": "Maîtrise d’arme", "en": "Weapon Mastery", "kind": "unknown"}, {"fr": "Loup-garou", "en": "Werewolf", "kind": "unknown"}, {"fr": "Aspect de projection furieuse", "en": "Wildbolt Aspect", "kind": "unknown"}, {"fr": "Sauvagerie", "en": "Wilds", "kind": "unknown"}, {"fr": "Hiver", "en": "Winter", "kind": "unknown"}, {"fr": "Flétrissement", "en": "Wither", "kind": "unknown"}, {"fr": "Endurance chevronnée", "en": "Worldly Endurance", "kind": "unknown"}, {"fr": "Subtilité matérielle", "en": "Worldly Finesse", "kind": "unknown"}, {"fr": "Bénédiction de Yen", "en": "Yen's Blessing", "kind": "unknown"}, {"fr": "Bénédiction de Yen (héritage)", "en": "Yen's Blessing Legacy", "kind": "unknown"}, {"fr": "Fanatique", "en": "Zealot", "kind": "unknown"}, {"fr": "Les 100 000 pas", "en": "100,000 Steps", "kind": "unique_item"}, {"fr": "Schisme d'Ae'grom", "en": "Ae'grom's Schism", "kind": "unique_item"}, {"fr": "Ahavarion, lance de Lycandre", "en": "Ahavarion, Spear of Lycander", "kind": "unique_item"}, {"fr": "Serment des anciens", "en": "Ancients' Oath", "kind": "unique_item"}, {"fr": "Visage d'Andarielle", "en": "Andariel's Visage", "kind": "unique_item"}, {"fr": "Foulée assassine", "en": "Assassin's Stride", "kind": "unique_item"}, {"fr": "Maxtlatl de Balazan", "en": "Balazan's Maxtlatl", "kind": "unique_item"}, {"fr": "Plaies d'Ahjad-Den", "en": "Bane of Ahjad-Den", "kind": "unique_item"}, {"fr": "Bastion de Sire Matthias", "en": "Bastion of Sir Matthias", "kind": "unique_item"}, {"fr": "Liens d'attrition", "en": "Bindings of Attrition", "kind": "unique_item"}, {"fr": "Rivière noire", "en": "Black River", "kind": "unique_item"}, {"fr": "Braies d'artisan du sang", "en": "Blood Artisan's Cuirass", "kind": "unique_item"}, {"fr": "Vague de sang", "en": "Blood Wake", "kind": "unique_item"}, {"fr": "Poigne de Bucrani", "en": "Bucrani's Grip", "kind": "unique_item"}, {"fr": "Détermination de Bucrani", "en": "Bucrani's Resolve", "kind": "unique_item"}, {"fr": "Bottines de Bucrani", "en": "Bucrani's Tread", "kind": "unique_item"}, {"fr": "Volonté de Bucrani", "en": "Bucrani's Will", "kind": "unique_item"}, {"fr": "Pondeur d'élite", "en": "Cluckeye", "kind": "unique_item"}, {"fr": "Cotcotonomicon", "en": "Cluckonomicon", "kind": "unique_item"}, {"fr": "Condamnation", "en": "Condemnation", "kind": "unique_item"}, {"fr": "Coup de graine", "en": "Coop de Grâce", "kind": "unique_item"}, {"fr": "Capuchon de tourment maléfique", "en": "Cowl of Malefic Torment", "kind": "unique_item"}, {"fr": "Étreinte de Cruor", "en": "Cruor's Embrace", "kind": "unique_item"}, {"fr": "Poigne de mort", "en": "Deathgrip", "kind": "unique_item"}, {"fr": "Pendentif de thanaturge", "en": "Deathspeaker's Pendant", "kind": "unique_item"}, {"fr": "Brise-terre", "en": "Earthbreaker", "kind": "unique_item"}, {"fr": "Percébène", "en": "Ebonpiercer", "kind": "unique_item"}, {"fr": "Écho de Kwatli", "en": "Echo of Kwatli", "kind": "unique_item"}, {"fr": "Tortionnaile", "en": "Eggcecutioner", "kind": "unique_item"}, {"fr": "Boucliœuf", "en": "Eggis", "kind": "unique_item"}, {"fr": "Œil de Baal", "en": "Eye of Baal", "kind": "unique_item"}, {"fr": "Champs écarlates", "en": "Fields of Crimson", "kind": "unique_item"}, {"fr": "Poings de guerre", "en": "Fists of War", "kind": "unique_item"}, {"fr": "Cautère", "en": "Flamescar", "kind": "unique_item"}, {"fr": "Tisse-flammes", "en": "Flameweaver", "kind": "unique_item"}, {"fr": "Broyeuse", "en": "Fleshrender", "kind": "unique_item"}, {"fr": "Porte de l'aube rouge", "en": "Gate of the Red Dawn", "kind": "unique_item"}, {"fr": "Gantelets du Sheol", "en": "Gauntlets of Sheol", "kind": "unique_item"}, {"fr": "Triomphe de gladiateur", "en": "Gladiator's Triumph", "kind": "unique_item"}, {"fr": "Gants de l'Illuminateur", "en": "Gloves of the Illuminator", "kind": "unique_item"}, {"fr": "Évangile de fidèle", "en": "Gospel of the Devotee", "kind": "unique_item"}, {"fr": "Mains de marche-tombe", "en": "Gravewalker's Hand", "kind": "unique_item"}, {"fr": "Grand bâton de la vieille sorcière", "en": "Greatstaff of the Crone", "kind": "unique_item"}, {"fr": "Grèves de la tombe vide", "en": "Greaves of the Empty Tomb", "kind": "unique_item"}, {"fr": "Atours de guerre", "en": "Guise of War", "kind": "unique_item"}, {"fr": "Main du pendu", "en": "Hangman's Hand", "kind": "unique_item"}, {"fr": "Busardes de guerre", "en": "Harriers of War", "kind": "unique_item"}, {"fr": "Cœur de guerre", "en": "Heart of War", "kind": "unique_item"}, {"fr": "Chevalière marquée des Enfers", "en": "Hellbrand Signet", "kind": "unique_item"}, {"fr": "Martelenfer", "en": "Hellhammer", "kind": "unique_item"}, {"fr": "Hurlements des profondeurs", "en": "Howl from Below", "kind": "unique_item"}, {"fr": "Acmé du chasseur", "en": "Hunter's Zenith", "kind": "unique_item"}, {"fr": "Souvenir d'Indira", "en": "Indira's Memory", "kind": "unique_item"}, {"fr": "Volonté de Kabraxis", "en": "Kabraxis' Will", "kind": "unique_item"}, {"fr": "Kilt d'Ailenoire", "en": "Kilt of Blackwing", "kind": "unique_item"}, {"fr": "Litanie du sable", "en": "Litany of Sable", "kind": "unique_item"}, {"fr": "Masse du roi Léoric", "en": "Mace of King Leoric", "kind": "unique_item"}, {"fr": "Allégresse du Loup Enragé", "en": "Mad Wolf's Glee", "kind": "unique_item"}, {"fr": "Marche de l'âme indéfectible", "en": "March of the Stalwart Soul", "kind": "unique_item"}, {"fr": "Alliance Mjölnic", "en": "Mjölnic Ryng", "kind": "unique_item"}, {"fr": "Garde-chair morlu", "en": "Morlu Fleshward", "kind": "unique_item"}, {"fr": "Étreinte maternelle", "en": "Mother's Embrace", "kind": "unique_item"}, {"fr": "Harnois de mutilation", "en": "Mutilator Plate", "kind": "unique_item"}, {"fr": "Griffes de la couronne ensanglantée", "en": "Nails of the Gore-Crowned", "kind": "unique_item"}, {"fr": "Présage de douleur", "en": "Omen of Pain", "kind": "unique_item"}, {"fr": "Orphelineuse", "en": "Orphan Maker", "kind": "unique_item"}, {"fr": "Masse-âcre", "en": "Overkill", "kind": "unique_item"}, {"fr": "Voie de Trag'Oul", "en": "Path of Trag'Oul", "kind": "unique_item"}, {"fr": "Cœur protéen", "en": "Protean Heart", "kind": "unique_item"}, {"fr": "Rictus de terreur", "en": "Rictus of Terror", "kind": "unique_item"}, {"fr": "Anneau de l'âme sacrilège", "en": "Ring of the Sacrilegious Soul", "kind": "unique_item"}, {"fr": "Sanguivore, lame de Zir", "en": "Sanguivor, Blade of Zir", "kind": "unique_item"}, {"fr": "Étoffe des misérables", "en": "Sashes of the Wretched", "kind": "unique_item"}, {"fr": "Seigneur du Péché", "en": "Sire of Sin", "kind": "unique_item"}, {"fr": "Chasse-cieux", "en": "Skyhunter", "kind": "unique_item"}, {"fr": "Bâton de rage éternelle", "en": "Staff of Endless Rage", "kind": "unique_item"}, {"fr": "Jambières de guerre", "en": "Strides of War", "kind": "unique_item"}, {"fr": "Crosse de guerre décolorée", "en": "Sunstained War-Crozier", "kind": "unique_item"}, {"fr": "Tassettes de l'aube", "en": "Tassets of the Dawning Sky", "kind": "unique_item"}, {"fr": "Sceau fécond", "en": "The Fecund Seal", "kind": "unique_item"}, {"fr": "Protection lugubre", "en": "The Gloom Ward", "kind": "unique_item"}, {"fr": "Sous-couronne", "en": "The Undercrown", "kind": "unique_item"}, {"fr": "Saccageuse aux Mille Yeux", "en": "Thousand-Eye Reaver", "kind": "unique_item"}, {"fr": "Cauchemar trois fois tissé", "en": "Thrice-Woven Nightmare", "kind": "unique_item"}, {"fr": "Frappes jumelles", "en": "Twin Strikes", "kind": "unique_item"}, {"fr": "Chaîne intègre", "en": "Unbroken Chain", "kind": "unique_item"}, {"fr": "Toile de la veuve", "en": "Widow's Web", "kind": "unique_item"}, {"fr": "Faim du cœur sauvage", "en": "Wildheart Hunger", "kind": "unique_item"}, {"fr": "Volonté de Rathma", "en": "Will of Rathma", "kind": "unique_item"}, {"fr": "Potentiel flétri", "en": "Wilted Potential", "kind": "unique_item"}, {"fr": "Ouragan", "en": "Windforce", "kind": "unique_item"}, {"fr": "Parole d'Hakan", "en": "Word of Hakan", "kind": "unique_item"}, {"fr": "Couronne de laurier aurique", "en": "Wreath of Auric Laurel", "kind": "unique_item"}, {"fr": "Bague de supercherie mouvante", "en": "Writhing Band of Trickery", "kind": "unique_item"}, {"fr": "Peau de Wyrd", "en": "Wyrdskin", "kind": "unique_item"}, {"fr": "Chevalière corrodée d'X'fal", "en": "X'Fal's Corroded Signet", "kind": "unique_item"}, {"fr": "[PH] Jambières uniques pour druides 97", "en": "[PH] Pants Unique Druid 97", "kind": "unique_item"}, {"fr": "Camée débordant d'Esadora", "en": "‍Esadora's Overflowing Cameo", "kind": "unique_item"}, {"fr": "Folies du dieu mort", "en": "Craze of the Dead God", "kind": "unique_item"}, {"fr": "Anneau de la chasse méridienne", "en": "Ring of the Midday Hunt", "kind": "unique_item"}, {"fr": "Protection de la première", "en": "Protection of the Prime", "kind": "unique_item"}, {"fr": "Chevalière de pacifiste", "en": "Peacemonger's Signet", "kind": "unique_item"}, {"fr": "Wushe Nak Pa", "en": "Wushe Nak Pa", "kind": "unique_item"}, {"fr": "Coquille de hyacinthe", "en": "Jacinth Shell", "kind": "unique_item"}, {"fr": "Mépris de la Terre", "en": "Scorn of the Earth", "kind": "unique_item"}, {"fr": "Lèche-blessure", "en": "Wound Drinker", "kind": "unique_item"}, {"fr": "Sepazontec", "en": "Sepazontec", "kind": "unique_item"}, {"fr": "Pierre de Vehemen", "en": "Stone of Vehemen", "kind": "unique_item"}, {"fr": "L'Annihilateur", "en": "The Unmaker", "kind": "unique_item"}, {"fr": "Mouette des fosses de combat", "en": "Pitfighter's Gull", "kind": "unique_item"}, {"fr": "Liens des Sidhes", "en": "Sidhe Bindings", "kind": "unique_item"}, {"fr": "La Troisième lame", "en": "The Third Blade", "kind": "unique_item"}, {"fr": "Veillée de Rakanoth", "en": "Rakanoth's Wake", "kind": "unique_item"}, {"fr": "Mortacrux", "en": "The Mortacrux", "kind": "unique_item"}, {"fr": "Vox Omnium", "en": "Vox Omnium", "kind": "unique_item"}, {"fr": "Crosse de guerre décolorée", "en": "Sunstained War-Crozier", "kind": "unique_item"}, {"fr": "Hausse-col de souimanga", "en": "‍Sunbird's Gorget", "kind": "unique_item"}, {"fr": "Plaies d'Ahjad-Den", "en": "Bane of Ahjad-Den", "kind": "unique_item"}, {"fr": "Sanguivore, lame de Zir", "en": "‍Sanguivor, Blade of Zir", "kind": "unique_item"}, {"fr": "Sabots du dieu de la montagne", "en": "‍Hooves of the Mountain God", "kind": "unique_item"}, {"fr": "Porte-Lumière putride", "en": "‍Rotting Lightbringer", "kind": "unique_item"}, {"fr": "Masque mortuaire de Nirmitruq", "en": "‍Deathmask of Nirmitruq", "kind": "unique_item"}, {"fr": "Orsivane", "en": "Orsivane", "kind": "unique_item"}, {"fr": "Couronne automnale", "en": "‍Autumnal Crown", "kind": "unique_item"}, {"fr": "Poigne éclair", "en": "Levin Grasp", "kind": "unique_item"}, {"fr": "Âme d'onyx", "en": "Onyx Soul", "kind": "unique_item"}, {"fr": "Puissance de Qual-Kehk", "en": "Might of Qual-Kehk", "kind": "unique_item"}, {"fr": "Volonté de pierre", "en": "Will of Stone", "kind": "unique_item"}, {"fr": "Marche désespérée", "en": "Desperate March", "kind": "unique_item"}, {"fr": "Le Maestro", "en": "The Maestro", "kind": "unique_item"}, {"fr": "Cadeau enveloppé", "en": "Shrouded Gift", "kind": "unique_item"}, {"fr": "Cœur implacable", "en": "The Relentless Heart", "kind": "unique_item"}, {"fr": "Accord des contrées sauvages", "en": "Accord of the Wilds", "kind": "unique_item"}, {"fr": "Don de givre", "en": "Gift of Frost", "kind": "unique_item"}, {"fr": "Crochet des vipères-magi", "en": "Fang of the Vipermagi", "kind": "unique_item"}, {"fr": "Givresang", "en": "Rimeblood", "kind": "unique_item"}, {"fr": "Hurlement sombre", "en": "Dark Howl", "kind": "unique_item"}, {"fr": "Kilt d'Ailenoire", "en": "Kilt of Blackwing", "kind": "unique_item"}, {"fr": "Grâce de Cassia", "en": "Cassia's Grace", "kind": "unique_item"}, {"fr": "Bague en fusion", "en": "Molten Band", "kind": "unique_item"}, {"fr": "Médaillon du vagabond sombre", "en": "Dark Stalker's Medallion", "kind": "unique_item"}, {"fr": "Pierre runique fracturée", "en": "Fractured Runestone", "kind": "unique_item"}, {"fr": "Serment de la marche verte", "en": "Greenwalker's Oath", "kind": "unique_item"}, {"fr": "Marque du vieux loup", "en": "Mark of the Old Wolf", "kind": "unique_item"}, {"fr": "Supplication", "en": "Supplication", "kind": "unique_item"}, {"fr": "Gants raffinés de seigneur des mers", "en": "Sea Lord's Fine Gloves", "kind": "unique_item"}, {"fr": "Emblème de Staalbrèche", "en": "Emblem of Staalbreak", "kind": "unique_item"}, {"fr": "Chevalière de la marche verte", "en": "Greenwalker's Signet", "kind": "unique_item"}, {"fr": "Cœur nostalgique de nomade", "en": "Nomad's Longing Heart", "kind": "unique_item"}, {"fr": "Totem sinistre d'Ifeh", "en": "Ifeh's Dire Totem", "kind": "unique_item"}, {"fr": "Puissance ursine", "en": "Might of the Ursine", "kind": "unique_item"}, {"fr": "Pacte d'os", "en": "Pact of Bone", "kind": "unique_item"}, {"fr": "Dague perdue d'Etna", "en": "Etna's Lost Dagger", "kind": "unique_item"}, {"fr": "Fureur des contrées sauvages", "en": "Fury of the Wilds", "kind": "unique_item"}, {"fr": "Cœur d'Azgar", "en": "Heart of Azgar", "kind": "unique_item"}, {"fr": "Porte-Lumière purifié", "en": "Purified Lightbringer", "kind": "unique_item"}, {"fr": "Nerf de la vengeance", "en": "Vengeful Sinew", "kind": "unique_item"}, {"fr": "Poing de la Rose de fer", "en": "Fist of the Iron Rose", "kind": "unique_item"}, {"fr": "Fureur de braise", "en": "Emberfury", "kind": "unique_item"}, {"fr": "Résonance de Shanar", "en": "Shanar's Resonance", "kind": "unique_item"}, {"fr": "Bâton de Zéraé", "en": "Staff of Zerae", "kind": "unique_item"}, {"fr": "Hesha e Kesungi", "en": "Hesha e Kesungi", "kind": "unique_item"}, {"fr": "Mélopée d'Airidah", "en": "Dirge of Airidah", "kind": "unique_item"}, {"fr": "Œil ouvert de Gorgorra", "en": "The Open Eye of Gorgorra", "kind": "unique_item"}, {"fr": "Miséricorde", "en": "Misericorde", "kind": "unique_item"}, {"fr": "Bénédiction du dieu du tonnerre", "en": "Thundergod's Blessing", "kind": "unique_item"}, {"fr": "Sceau horadrique ancestral", "en": "Ancestral Horadric Seal", "kind": "talisman"}, {"fr": "Berú de chair d'Abaddon", "en": "Berú of Abaddon's Flesh", "kind": "talisman"}, {"fr": "Berú d'alchimie appliquée", "en": "Berú of Applied Alchemy", "kind": "talisman"}, {"fr": "Berú d'Arreat", "en": "Berú of Arreat", "kind": "talisman"}, {"fr": "Berú de la morsure de Balazan", "en": "Berú of Balazan's Bite", "kind": "talisman"}, {"fr": "Berú d'orgueil de Bul-Kathos", "en": "Berú of Bul-Kathos' Pride", "kind": "talisman"}, {"fr": "Berú de foi vaillante", "en": "Berú of Dauntless Faith", "kind": "talisman"}, {"fr": "Berú de profanation", "en": "Berú of Desecration", "kind": "talisman"}, {"fr": "Berú d'ombre d'Harash", "en": "Berú of Harash's Shadow", "kind": "talisman"}, {"fr": "Berú des chaînes d'Horazon", "en": "Berú of Horazon's Chains", "kind": "talisman"}, {"fr": "Berú de conviction inébranlable", "en": "Berú of Iron Conviction", "kind": "talisman"}, {"fr": "Berú de la grâce de Kwatli", "en": "Berú of Kwatli's Grace", "kind": "talisman"}, {"fr": "Berú de révélation de la Lumière", "en": "Berú of Light's Epiphany", "kind": "talisman"}, {"fr": "Berú du pivot de Mefis", "en": "Berú of Mefis' Fulcrum", "kind": "talisman"}, {"fr": "Berú du bestiaire de Nafain", "en": "Berú of Nafain's Bestiary", "kind": "talisman"}, {"fr": "Berú du feu radieux", "en": "Berú of Radiant Fire", "kind": "talisman"}, {"fr": "Berú de la rage de Rezoka", "en": "Berú of Rezoka's Rage", "kind": "talisman"}, {"fr": "Berú de volonté vertueuse", "en": "Berú of Righteous Will", "kind": "talisman"}, {"fr": "Berú de la fureur de Sescheron", "en": "Berú of Sescheron's Fury", "kind": "talisman"}, {"fr": "Berú de l'acier enchanté", "en": "Berú of Spellbound Steel", "kind": "talisman"}, {"fr": "Berú de perspicacité inouïe", "en": "Berú of Uncanny Insight", "kind": "talisman"}, {"fr": "Berú de l'éclair sauvage", "en": "Berú of Wild Lightning", "kind": "talisman"}, {"fr": "Berú de l'étreinte de Wumba", "en": "Berú of Wumba's Embrace", "kind": "talisman"}, {"fr": "Berú du voile noir", "en": "Berú of the Black Shroud", "kind": "talisman"}, {"fr": "Berú du sang lié", "en": "Berú of the Blood Binder", "kind": "talisman"}, {"fr": "Berú du flux sanguin", "en": "Berú of the Bloodletter", "kind": "talisman"}, {"fr": "Berú de la lame floue", "en": "Berú of the Blurring Blade", "kind": "talisman"}, {"fr": "Berú du tissage d'os", "en": "Berú of the Bone Weaver", "kind": "talisman"}, {"fr": "Berú du chaudron", "en": "Berú of the Cauldron", "kind": "talisman"}, {"fr": "Berú du Creuset", "en": "Berú of the Crucible", "kind": "talisman"}, {"fr": "Berú de la Mère de la tanière", "en": "Berú of the Den Mother", "kind": "talisman"}, {"fr": "Berú de la mer Gelée", "en": "Berú of the Frozen Sea", "kind": "talisman"}, {"fr": "Berú du plus grand nombre", "en": "Berú of the Multitude", "kind": "talisman"}, {"fr": "Berú de l'Anonyme", "en": "Berú of the Nameless", "kind": "talisman"}, {"fr": "Berú de l'Œil plissé", "en": "Berú of the Narrow Eye", "kind": "talisman"}, {"fr": "Berú de la montagne ancienne", "en": "Berú of the Old Mountain", "kind": "talisman"}, {"fr": "Berú de la lune du loup rouge", "en": "Berú of the Red Wolf Moon", "kind": "talisman"}, {"fr": "Berú des aveugles", "en": "Berú of the Sightless", "kind": "talisman"}, {"fr": "Berú de guide des tempêtes", "en": "Berú of the Storm Shepherd", "kind": "talisman"}, {"fr": "Berú de la voie triple", "en": "Berú of the Threefold", "kind": "talisman"}, {"fr": "Berú du toucher d'éveil", "en": "Berú of the Waking Touch", "kind": "talisman"}, {"fr": "Fer de chair d'Abaddon", "en": "Fer of Abaddon's Flesh", "kind": "talisman"}, {"fr": "Fer d'action habile", "en": "Fer of Adept Action", "kind": "talisman"}, {"fr": "Fer d'alchimie appliquée", "en": "Fer of Applied Alchemy", "kind": "talisman"}, {"fr": "Fer d'Arreat", "en": "Fer of Arreat", "kind": "talisman"}, {"fr": "Fer de la morsure de Balazan", "en": "Fer of Balazan's Bite", "kind": "talisman"}, {"fr": "Fer des os brisés", "en": "Fer of Bone Breaking", "kind": "talisman"}, {"fr": "Fer d'orgueil de Bul-Kathos", "en": "Fer of Bul-Kathos' Pride", "kind": "talisman"}, {"fr": "Fer du destin cruel", "en": "Fer of Cruel Fate", "kind": "talisman"}, {"fr": "Fer du pacte ténébreux", "en": "Fer of Dark Pact", "kind": "talisman"}, {"fr": "Fer de foi vaillante", "en": "Fer of Dauntless Faith", "kind": "talisman"}, {"fr": "Fer de perspicacité trompeuse", "en": "Fer of Deceptive Insight", "kind": "talisman"}, {"fr": "Fer de profanation", "en": "Fer of Desecration", "kind": "talisman"}, {"fr": "Fer d'ombre d'Harash", "en": "Fer of Harash's Shadow", "kind": "talisman"}, {"fr": "Fer des chaînes d'Horazon", "en": "Fer of Horazon's Chains", "kind": "talisman"}, {"fr": "Fer de conviction inébranlable", "en": "Fer of Iron Conviction", "kind": "talisman"}, {"fr": "Fer de la grâce de Kwatli", "en": "Fer of Kwatli's Grace", "kind": "talisman"}, {"fr": "Fer de létalité", "en": "Fer of Lethality", "kind": "talisman"}, {"fr": "Fer de révélation de la Lumière", "en": "Fer of Light's Epiphany", "kind": "talisman"}, {"fr": "Fer de maîtrise", "en": "Fer of Mastery", "kind": "talisman"}, {"fr": "Fer du pivot de Mefis", "en": "Fer of Mefis' Fulcrum", "kind": "talisman"}, {"fr": "Fer du bestiaire de Nafain", "en": "Fer of Nafain's Bestiary", "kind": "talisman"}, {"fr": "Fer de technique éprouvée", "en": "Fer of Practiced Technique", "kind": "talisman"}, {"fr": "Fer du feu radieux", "en": "Fer of Radiant Fire", "kind": "talisman"}, {"fr": "Fer de la rage de Rezoka", "en": "Fer of Rezoka's Rage", "kind": "talisman"}, {"fr": "Fer de volonté vertueuse", "en": "Fer of Righteous Will", "kind": "talisman"}, {"fr": "Fer de la fureur de Sescheron", "en": "Fer of Sescheron's Fury", "kind": "talisman"}, {"fr": "Fer de massacre", "en": "Fer of Slaughter", "kind": "talisman"}, {"fr": "Fer de l'acier enchanté", "en": "Fer of Spellbound Steel", "kind": "talisman"}, {"fr": "Fer de survie", "en": "Fer of Survival", "kind": "talisman"}, {"fr": "Fer de perspicacité inouïe", "en": "Fer of Uncanny Insight", "kind": "talisman"}, {"fr": "Fer de l'éclair sauvage", "en": "Fer of Wild Lightning", "kind": "talisman"}, {"fr": "Fer de l'étreinte de Wumba", "en": "Fer of Wumba's Embrace", "kind": "talisman"}, {"fr": "Fer du voile noir", "en": "Fer of the Black Shroud", "kind": "talisman"}, {"fr": "Fer du sang lié", "en": "Fer of the Blood Binder", "kind": "talisman"}, {"fr": "Fer du flux sanguin", "en": "Fer of the Bloodletter", "kind": "talisman"}, {"fr": "Fer de la lame floue", "en": "Fer of the Blurring Blade", "kind": "talisman"}, {"fr": "Fer du tissage d'os", "en": "Fer of the Bone Weaver", "kind": "talisman"}, {"fr": "Fer du chaudron", "en": "Fer of the Cauldron", "kind": "talisman"}, {"fr": "Fer du Creuset", "en": "Fer of the Crucible", "kind": "talisman"}, {"fr": "Fer de la Mère de la tanière", "en": "Fer of the Den Mother", "kind": "talisman"}, {"fr": "Fer de la mer Gelée", "en": "Fer of the Frozen Sea", "kind": "talisman"}, {"fr": "Fer du plus grand nombre", "en": "Fer of the Multitude", "kind": "talisman"}, {"fr": "Fer de l'Anonyme", "en": "Fer of the Nameless", "kind": "talisman"}, {"fr": "Fer de l'Œil plissé", "en": "Fer of the Narrow Eye", "kind": "talisman"}, {"fr": "Fer de la montagne ancienne", "en": "Fer of the Old Mountain", "kind": "talisman"}, {"fr": "Fer de la lune du loup rouge", "en": "Fer of the Red Wolf Moon", "kind": "talisman"}, {"fr": "Fer des aveugles", "en": "Fer of the Sightless", "kind": "talisman"}, {"fr": "Fer de guide des tempêtes", "en": "Fer of the Storm Shepherd", "kind": "talisman"}, {"fr": "Fer de la voie triple", "en": "Fer of the Threefold", "kind": "talisman"}, {"fr": "Fer du toucher d'éveil", "en": "Fer of the Waking Touch", "kind": "talisman"}, {"fr": "Sceau horadrique", "en": "Horadric Seal", "kind": "talisman"}, {"fr": "Sceau horadrique légendaire", "en": "Legendary Horadric Seal", "kind": "talisman"}, {"fr": "Linta de chair d'Abaddon", "en": "Linta of Abaddon's Flesh", "kind": "talisman"}, {"fr": "Linta d'alchimie appliquée", "en": "Linta of Applied Alchemy", "kind": "talisman"}, {"fr": "Linta d'Arreat", "en": "Linta of Arreat", "kind": "talisman"}, {"fr": "Linta de la morsure de Balazan", "en": "Linta of Balazan's Bite", "kind": "talisman"}, {"fr": "Linta d'orgueil de Bul-Kathos", "en": "Linta of Bul-Kathos' Pride", "kind": "talisman"}, {"fr": "Linta de foi vaillante", "en": "Linta of Dauntless Faith", "kind": "talisman"}, {"fr": "Linta de profanation", "en": "Linta of Desecration", "kind": "talisman"}, {"fr": "Linta d'ombre d'Harash", "en": "Linta of Harash's Shadow", "kind": "talisman"}, {"fr": "Linta des chaînes d'Horazon", "en": "Linta of Horazon's Chains", "kind": "talisman"}, {"fr": "Linta de conviction inébranlable", "en": "Linta of Iron Conviction", "kind": "talisman"}, {"fr": "Linta de la grâce de Kwatli", "en": "Linta of Kwatli's Grace", "kind": "talisman"}, {"fr": "Linta de révélation de la Lumière", "en": "Linta of Light's Epiphany", "kind": "talisman"}, {"fr": "Linta du pivot de Mefis", "en": "Linta of Mefis' Fulcrum", "kind": "talisman"}, {"fr": "Linta du bestiaire de Nafain", "en": "Linta of Nafain's Bestiary", "kind": "talisman"}, {"fr": "Linta du feu radieux", "en": "Linta of Radiant Fire", "kind": "talisman"}, {"fr": "Linta de la rage de Rezoka", "en": "Linta of Rezoka's Rage", "kind": "talisman"}, {"fr": "Linta de volonté vertueuse", "en": "Linta of Righteous Will", "kind": "talisman"}, {"fr": "Linta de la fureur de Seschero", "en": "Linta of Sescheron's Fury", "kind": "talisman"}, {"fr": "Linta de l'acier enchanté", "en": "Linta of Spellbound Steel", "kind": "talisman"}, {"fr": "Linta de perspicacité inouïe", "en": "Linta of Uncanny Insight", "kind": "talisman"}, {"fr": "Linta de l'éclair sauvage", "en": "Linta of Wild Lightning", "kind": "talisman"}, {"fr": "Linta de l'étreinte de Wumba", "en": "Linta of Wumba's Embrace", "kind": "talisman"}, {"fr": "Linta du voile noir", "en": "Linta of the Black Shroud", "kind": "talisman"}, {"fr": "Linta du sang lié", "en": "Linta of the Blood Binder", "kind": "talisman"}, {"fr": "Linta du flux sanguin", "en": "Linta of the Bloodletter", "kind": "talisman"}, {"fr": "Linta de la lame floue", "en": "Linta of the Blurring Blade", "kind": "talisman"}, {"fr": "Linta du tissage d'os", "en": "Linta of the Bone Weaver", "kind": "talisman"}, {"fr": "Linta du chaudron", "en": "Linta of the Cauldron", "kind": "talisman"}, {"fr": "Linta du Creuset", "en": "Linta of the Crucible", "kind": "talisman"}, {"fr": "Linta de la Mère de la tanière", "en": "Linta of the Den Mother", "kind": "talisman"}, {"fr": "Linta de la mer Gelée", "en": "Linta of the Frozen Sea", "kind": "talisman"}, {"fr": "Linta du plus grand nombre", "en": "Linta of the Multitude", "kind": "talisman"}, {"fr": "Linta de l'Anonyme", "en": "Linta of the Nameless", "kind": "talisman"}, {"fr": "Linta de l'Œil plissé", "en": "Linta of the Narrow Eye", "kind": "talisman"}, {"fr": "Linta de la montagne ancienne", "en": "Linta of the Old Mountain", "kind": "talisman"}, {"fr": "Linta de la lune du loup rouge", "en": "Linta of the Red Wolf Moon", "kind": "talisman"}, {"fr": "Linta des aveugles", "en": "Linta of the Sightless", "kind": "talisman"}, {"fr": "Linta de guide des tempêtes", "en": "Linta of the Storm Shepherd", "kind": "talisman"}, {"fr": "Linta de la voie triple", "en": "Linta of the Threefold", "kind": "talisman"}, {"fr": "Linta du toucher d'éveil", "en": "Linta of the Waking Touch", "kind": "talisman"}, {"fr": "Sceau horadrique magique", "en": "Magic Horadric Seal", "kind": "talisman"}, {"fr": "Mlor de chair d'Abaddon", "en": "Mlor of Abaddon's Flesh", "kind": "talisman"}, {"fr": "Mlor d'alchimie appliquée", "en": "Mlor of Applied Alchemy", "kind": "talisman"}, {"fr": "Mlor d'Arreat", "en": "Mlor of Arreat", "kind": "talisman"}, {"fr": "Mlor de la morsure de Balazan", "en": "Mlor of Balazan's Bite", "kind": "talisman"}, {"fr": "Mlor des os brisés", "en": "Mlor of Bone Breaking", "kind": "talisman"}, {"fr": "Mlor d'orgueil de Bul-Kathos", "en": "Mlor of Bul-Kathos' Pride", "kind": "talisman"}, {"fr": "Mlor du destin cruel", "en": "Mlor of Cruel Fate", "kind": "talisman"}, {"fr": "Mlor du pacte ténébreux", "en": "Mlor of Dark Pact", "kind": "talisman"}, {"fr": "Mlor de foi vaillante", "en": "Mlor of Dauntless Faith", "kind": "talisman"}, {"fr": "Mlor de perspicacité trompeuse", "en": "Mlor of Deceptive Insight", "kind": "talisman"}, {"fr": "Mlor de profanation", "en": "Mlor of Desecration", "kind": "talisman"}, {"fr": "Mlor d'ombre d'Harash", "en": "Mlor of Harash's Shadow", "kind": "talisman"}, {"fr": "Mlor des chaînes d'Horazon", "en": "Mlor of Horazon's Chains", "kind": "talisman"}, {"fr": "Mlor de conviction inébranlable", "en": "Mlor of Iron Conviction", "kind": "talisman"}, {"fr": "Mlor de la grâce de Kwatli", "en": "Mlor of Kwatli's Grace", "kind": "talisman"}, {"fr": "Mlor de létalité", "en": "Mlor of Lethality", "kind": "talisman"}, {"fr": "Mlor de révélation de la Lumière", "en": "Mlor of Light's Epiphany", "kind": "talisman"}, {"fr": "Mlor du pivot de Mefis", "en": "Mlor of Mefis' Fulcrum", "kind": "talisman"}, {"fr": "Mlor du bestiaire de Nafain", "en": "Mlor of Nafain's Bestiary", "kind": "talisman"}, {"fr": "Mlor de technique éprouvée", "en": "Mlor of Practiced Technique", "kind": "talisman"}, {"fr": "Mlor du feu radieux", "en": "Mlor of Radiant Fire", "kind": "talisman"}, {"fr": "Mlor de la rage de Rezoka", "en": "Mlor of Rezoka's Rage", "kind": "talisman"}, {"fr": "Mlor de volonté vertueuse", "en": "Mlor of Righteous Will", "kind": "talisman"}, {"fr": "Mlor de la fureur de Sescheron", "en": "Mlor of Sescheron's Fury", "kind": "talisman"}, {"fr": "Mlor de massacre", "en": "Mlor of Slaughter", "kind": "talisman"}, {"fr": "Mlor de l'acier enchanté", "en": "Mlor of Spellbound Steel", "kind": "talisman"}, {"fr": "Mlor de survie", "en": "Mlor of Survival", "kind": "talisman"}, {"fr": "Mlor de perspicacité inouïe", "en": "Mlor of Uncanny Insight", "kind": "talisman"}, {"fr": "Mlor de l'éclair sauvage", "en": "Mlor of Wild Lightning", "kind": "talisman"}, {"fr": "Mlor de l'étreinte de Wumba", "en": "Mlor of Wumba's Embrace", "kind": "talisman"}, {"fr": "Mlor du voile noir", "en": "Mlor of the Black Shroud", "kind": "talisman"}, {"fr": "Mlor du sang lié", "en": "Mlor of the Blood Binder", "kind": "talisman"}, {"fr": "Mlor du flux sanguin", "en": "Mlor of the Bloodletter", "kind": "talisman"}, {"fr": "Mlor de la lame floue", "en": "Mlor of the Blurring Blade", "kind": "talisman"}, {"fr": "Mlor du tissage d'os", "en": "Mlor of the Bone Weaver", "kind": "talisman"}, {"fr": "Mlor du chaudron", "en": "Mlor of the Cauldron", "kind": "talisman"}, {"fr": "Mlor du Creuset", "en": "Mlor of the Crucible", "kind": "talisman"}, {"fr": "Mlor de la Mère de la tanière", "en": "Mlor of the Den Mother", "kind": "talisman"}, {"fr": "Mlor de la mer Gelée", "en": "Mlor of the Frozen Sea", "kind": "talisman"}, {"fr": "Mlor du plus grand nombre", "en": "Mlor of the Multitude", "kind": "talisman"}, {"fr": "Mlor de l'Anonyme", "en": "Mlor of the Nameless", "kind": "talisman"}, {"fr": "Mlor de l'Œil plissé", "en": "Mlor of the Narrow Eye", "kind": "talisman"}, {"fr": "Mlor de la montagne ancienne", "en": "Mlor of the Old Mountain", "kind": "talisman"}, {"fr": "Mlor de la lune du loup rouge", "en": "Mlor of the Red Wolf Moon", "kind": "talisman"}, {"fr": "Mlor des aveugles", "en": "Mlor of the Sightless", "kind": "talisman"}, {"fr": "Mlor de guide des tempêtes", "en": "Mlor of the Storm Shepherd", "kind": "talisman"}, {"fr": "Mlor de la voie triple", "en": "Mlor of the Threefold", "kind": "talisman"}, {"fr": "Mlor du toucher d'éveil", "en": "Mlor of the Waking Touch", "kind": "talisman"}, {"fr": "Sceau horadrique unique mythique", "en": "Mythic Unique Horadric Seal", "kind": "talisman"}, {"fr": "Phoba de chair d'Abaddon", "en": "Phoba of Abaddon's Flesh", "kind": "talisman"}, {"fr": "Phoba d'action habile", "en": "Phoba of Adept Action", "kind": "talisman"}, {"fr": "Phoba d'alchimie appliquée", "en": "Phoba of Applied Alchemy", "kind": "talisman"}, {"fr": "Phoba d'Arreat", "en": "Phoba of Arreat", "kind": "talisman"}, {"fr": "Phoba de la morsure de Balazan", "en": "Phoba of Balazan's Bite", "kind": "talisman"}, {"fr": "Phoba des os brisés", "en": "Phoba of Bone Breaking", "kind": "talisman"}, {"fr": "Phoba d'orgueil de Bul-Kathos", "en": "Phoba of Bul-Kathos' Pride", "kind": "talisman"}, {"fr": "Phoba du destin cruel", "en": "Phoba of Cruel Fate", "kind": "talisman"}, {"fr": "Phoba de pacte ténébreux", "en": "Phoba of Dark Pact", "kind": "talisman"}, {"fr": "Phoba de foi vaillante", "en": "Phoba of Dauntless Faith", "kind": "talisman"}, {"fr": "Phobar de perspicacité trompeuse", "en": "Phoba of Deceptive Insight", "kind": "talisman"}, {"fr": "Phoba de profanation", "en": "Phoba of Desecration", "kind": "talisman"}, {"fr": "Phoba d'ombre d'Harash", "en": "Phoba of Harash's Shadow", "kind": "talisman"}, {"fr": "Phoba des chaînes d'Horazon", "en": "Phoba of Horazon's Chains", "kind": "talisman"}, {"fr": "Phoba de conviction inébranlable", "en": "Phoba of Iron Conviction", "kind": "talisman"}, {"fr": "Phoba de la grâce de Kwatli", "en": "Phoba of Kwatli's Grace", "kind": "talisman"}, {"fr": "Phoba de létalité", "en": "Phoba of Lethality", "kind": "talisman"}, {"fr": "Phoba de révélation de la Lumière", "en": "Phoba of Light's Epiphany", "kind": "talisman"}, {"fr": "Phoba de maîtrise", "en": "Phoba of Mastery", "kind": "talisman"}, {"fr": "Phoba du pivot de Mefis", "en": "Phoba of Mefis' Fulcrum", "kind": "talisman"}, {"fr": "Phoba du bestiaire de Nafain", "en": "Phoba of Nafain's Bestiary", "kind": "talisman"}, {"fr": "Phoba de technique éprouvée", "en": "Phoba of Practiced Technique", "kind": "talisman"}, {"fr": "Phoba du feu radieux", "en": "Phoba of Radiant Fire", "kind": "talisman"}, {"fr": "Phoba de la rage de Rezoka", "en": "Phoba of Rezoka's Rage", "kind": "talisman"}, {"fr": "Phoba de volonté vertueuse", "en": "Phoba of Righteous Will", "kind": "talisman"}, {"fr": "Phoba de la fureur de Sescheron", "en": "Phoba of Sescheron's Fury", "kind": "talisman"}, {"fr": "Phoba de massacre", "en": "Phoba of Slaughter", "kind": "talisman"}, {"fr": "Phoba de l'acier enchanté", "en": "Phoba of Spellbound Steel", "kind": "talisman"}, {"fr": "Phoba de survie", "en": "Phoba of Survival", "kind": "talisman"}, {"fr": "Phoba de perspicacité inouïe", "en": "Phoba of Uncanny Insight", "kind": "talisman"}, {"fr": "Phoba de l'éclair sauvage", "en": "Phoba of Wild Lightning", "kind": "talisman"}, {"fr": "Phoba de l'étreinte de Wumba", "en": "Phoba of Wumba's Embrace", "kind": "talisman"}, {"fr": "Phoba du voile noir", "en": "Phoba of the Black Shroud", "kind": "talisman"}, {"fr": "Phoba du sang lié", "en": "Phoba of the Blood Binder", "kind": "talisman"}, {"fr": "Phoba du flux sanguin", "en": "Phoba of the Bloodletter", "kind": "talisman"}, {"fr": "Phoba de la lame floue", "en": "Phoba of the Blurring Blade", "kind": "talisman"}, {"fr": "Phoba du tissage d'os", "en": "Phoba of the Bone Weaver", "kind": "talisman"}, {"fr": "Phoba du chaudron", "en": "Phoba of the Cauldron", "kind": "talisman"}, {"fr": "Phoba du Creuset", "en": "Phoba of the Crucible", "kind": "talisman"}, {"fr": "Phoba de la Mère de la tanière", "en": "Phoba of the Den Mother", "kind": "talisman"}, {"fr": "Phoba de la mer Gelée", "en": "Phoba of the Frozen Sea", "kind": "talisman"}, {"fr": "Phoba du plus grand nombre", "en": "Phoba of the Multitude", "kind": "talisman"}, {"fr": "Phoba de l'Anonyme", "en": "Phoba of the Nameless", "kind": "talisman"}, {"fr": "Phoba de l'Œil plissé", "en": "Phoba of the Narrow Eye", "kind": "talisman"}, {"fr": "Phoba de la montagne ancienne", "en": "Phoba of the Old Mountain", "kind": "talisman"}, {"fr": "Phoba de la lune du loup rouge", "en": "Phoba of the Red Wolf Moon", "kind": "talisman"}, {"fr": "Phoba des aveugles", "en": "Phoba of the Sightless", "kind": "talisman"}, {"fr": "Phoba de guide des tempêtes", "en": "Phoba of the Storm Shepherd", "kind": "talisman"}, {"fr": "Phoba de la voie triple", "en": "Phoba of the Threefold", "kind": "talisman"}, {"fr": "Phoba du toucher d'éveil", "en": "Phoba of the Waking Touch", "kind": "talisman"}, {"fr": "Sceau horadrique rare", "en": "Rare Horadric Seal", "kind": "talisman"}];

  // Generated from app/data/unique_item_sources.json (built by
  // scripts/build_talion_uniques_dictionary.py, embedded by
  // scripts/sync_unique_item_sources.py) - which boss drops each Unique
  // (and whether it's a Mythic Unique), keyed by the item's English name.
  // Used for the "hover an item name to see where it drops" tooltip.
  const UNIQUE_ITEM_SOURCES = {"Rage of Harrogath": {"bossFr": ["Le Boucher"], "uber": false}, "Yen's Blessing": {"bossFr": ["Urivar"], "uber": false}, "X'Fal's Corroded Signet": {"bossFr": ["Zir"], "uber": false}, "Razorplate": {"bossFr": ["Duriel"], "uber": false}, "Godslayer Crown": {"bossFr": ["Andariel"], "uber": false}, "Frostburn": {"bossFr": ["Butin monde (n'importe quel boss/activité)"], "uber": false}, "Mother's Embrace": {"bossFr": ["Butin monde (n'importe quel boss/activité)"], "uber": false}, "Paingorger's Gauntlets": {"bossFr": ["Grigoire"], "uber": false}, "Penitent Greaves": {"bossFr": ["Butin monde (n'importe quel boss/activité)"], "uber": false}, "Soulbrand": {"bossFr": ["Butin monde (n'importe quel boss/activité)"], "uber": false}, "Azurewrath": {"bossFr": ["Bartuc"], "uber": false}, "Flickerstep": {"bossFr": ["Butin monde (n'importe quel boss/activité)"], "uber": false}, "Fists of Fate": {"bossFr": ["Butin monde (n'importe quel boss/activité)"], "uber": false}, "Tassets of the Dawning Sky": {"bossFr": ["Butin monde (n'importe quel boss/activité)"], "uber": false}, "Temerity": {"bossFr": ["Messager de la Haine"], "uber": false}, "Tibault's Will": {"bossFr": ["Butin monde (n'importe quel boss/activité)"], "uber": false}, "Arreat's Bearing": {"bossFr": ["Bartuc"], "uber": false}, "Ring of Red Furor": {"bossFr": ["Le Boucher"], "uber": false}, "Ring of the Ravenous": {"bossFr": ["Bête dans la glace"], "uber": false}, "Unbroken Chain": {"bossFr": ["Urivar"], "uber": false}, "Banished Lord's Talisman": {"bossFr": ["Butin monde (n'importe quel boss/activité)"], "uber": false}, "Fields of Crimson": {"bossFr": ["Zir"], "uber": false}, "Ramaladni's Magnum Opus": {"bossFr": ["Le Boucher"], "uber": false}, "The Butcher's Cleaver": {"bossFr": ["Le Boucher"], "uber": false}, "Twin Strikes": {"bossFr": ["Zir"], "uber": false}, "Tuskhelm of Joritz the Mighty": {"bossFr": ["Bartuc"], "uber": false}, "100,000 Steps": {"bossFr": ["Varshan"], "uber": false}, "Hellhammer": {"bossFr": ["Andariel"], "uber": false}, "Overkill": {"bossFr": ["Varshan"], "uber": false}, "Gohr's Devastating Grips": {"bossFr": ["Grigoire"], "uber": false}, "Ancients' Oath": {"bossFr": ["Andariel"], "uber": false}, "Battle Trance": {"bossFr": ["Astaroth"], "uber": false}, "Hunter's Zenith": {"bossFr": ["Grigoire"], "uber": false}, "Mjölnic Ryng": {"bossFr": ["Bartuc"], "uber": false}, "Mad Wolf's Glee": {"bossFr": ["Astaroth"], "uber": false}, "Unsung Ascetic's Wraps": {"bossFr": ["Zir"], "uber": false}, "Earthbreaker": {"bossFr": ["Bartuc"], "uber": false}, "Fleshrender": {"bossFr": ["Messager de la Haine"], "uber": false}, "Storm's Companion": {"bossFr": ["Andariel"], "uber": false}, "Waxing Gibbous": {"bossFr": ["Zir"], "uber": false}, "Wildheart Hunger": {"bossFr": ["Astaroth"], "uber": false}, "Insatiable Fury": {"bossFr": ["Andariel"], "uber": false}, "Greatstaff of the Crone": {"bossFr": ["Varshan"], "uber": false}, "Dolmen Stone": {"bossFr": ["Urivar"], "uber": false}, "Vasily's Prayer": {"bossFr": ["Varshan"], "uber": false}, "Tempest Roar": {"bossFr": ["Duriel", "Messager de la Haine"], "uber": false}, "Airidah's Inexorable Will": {"bossFr": ["Bête dans la glace"], "uber": false}, "Ring of the Sacrilegious Soul": {"bossFr": ["Astaroth"], "uber": false}, "Ring of Mendeln": {"bossFr": ["Bête dans la glace"], "uber": false}, "Blood Artisan's Cuirass": {"bossFr": ["Zir", "Urivar"], "uber": false}, "Bloodless Scream": {"bossFr": ["Astaroth"], "uber": false}, "Cruor's Embrace": {"bossFr": ["Zir"], "uber": false}, "Greaves of the Empty Tomb": {"bossFr": ["Grigoire"], "uber": false}, "Mutilator Plate": {"bossFr": ["Duriel"], "uber": false}, "Howl from Below": {"bossFr": ["Bête dans la glace"], "uber": false}, "Blood Moon Breeches": {"bossFr": ["Astaroth"], "uber": false}, "Lidless Wall": {"bossFr": ["Andariel"], "uber": false}, "Deathspeaker's Pendant": {"bossFr": ["Varshan"], "uber": false}, "Ebonpiercer": {"bossFr": ["Andariel"], "uber": false}, "Black River": {"bossFr": ["Andariel", "Messager de la Haine"], "uber": false}, "Deathless Visage": {"bossFr": ["Bête dans la glace"], "uber": false}, "Path of Trag'Oul": {"bossFr": ["Duriel"], "uber": false}, "Staff of Endless Rage": {"bossFr": ["Duriel"], "uber": false}, "Writhing Band of Trickery": {"bossFr": ["Urivar"], "uber": false}, "Scoundrel's Kiss": {"bossFr": ["Le Boucher"], "uber": false}, "Beastfall Boots": {"bossFr": ["Andariel"], "uber": false}, "Ring of Starless Skies": {"bossFr": ["Andariel", "Duriel", "Grigoire", "Varshan", "Zir", "Bête dans la glace"], "uber": true}, "Cowl of the Nameless": {"bossFr": ["Le Boucher"], "uber": false}, "Skyhunter": {"bossFr": ["Zir"], "uber": false}, "Saboteur's Signet": {"bossFr": ["Bête dans la glace"], "uber": false}, "Condemnation": {"bossFr": ["Duriel"], "uber": false}, "Eaglehorn": {"bossFr": ["Varshan"], "uber": false}, "Eyes in the Dark": {"bossFr": ["Astaroth"], "uber": false}, "Asheara's Khanjar": {"bossFr": ["Astaroth"], "uber": false}, "Windforce": {"bossFr": ["Urivar"], "uber": false}, "Word of Hakan": {"bossFr": ["Bartuc"], "uber": false}, "Grasp of Shadow": {"bossFr": ["Bartuc"], "uber": false}, "Scoundrel's Leathers": {"bossFr": ["Messager de la Haine"], "uber": false}, "Shroud of Khanduras": {"bossFr": ["Zir"], "uber": false}, "Doombringer": {"bossFr": ["Duriel", "Andariel", "Grigoire", "Varshan", "Zir", "Bête dans la glace"], "uber": true}, "Melted Heart of Selig": {"bossFr": ["Andariel", "Duriel", "Grigoire", "Varshan", "Zir", "Bête dans la glace"], "uber": true}, "Andariel's Visage": {"bossFr": ["Andariel", "Duriel", "Grigoire", "Varshan", "Zir", "Bête dans la glace"], "uber": true}, "Harlequin Crest": {"bossFr": ["Andariel", "Duriel", "Grigoire", "Varshan", "Zir", "Bête dans la glace"], "uber": true}, "Tyrael's Might": {"bossFr": ["Andariel", "Duriel", "Grigoire", "Varshan", "Zir", "Bête dans la glace"], "uber": true}, "The Grandfather": {"bossFr": ["Andariel", "Duriel", "Grigoire", "Varshan", "Zir", "Bête dans la glace", "Urivar"], "uber": true}, "Ahavarion, Spear of Lycander": {"bossFr": ["Andariel", "Duriel", "Grigoire", "Varshan", "Zir", "Bête dans la glace", "Urivar", "Messager de la Haine"], "uber": true}, "Staff of Lam Esen": {"bossFr": ["Zir"], "uber": false}, "Tal Rasha's Iridescent Loop": {"bossFr": ["Messager de la Haine"], "uber": false}, "Iceheart Brais": {"bossFr": ["Urivar"], "uber": false}, "‍Esadora's Overflowing Cameo": {"bossFr": ["Andariel"], "uber": false}, "Flamescar": {"bossFr": ["Urivar"], "uber": false}, "Axial Conduit": {"bossFr": ["Bartuc"], "uber": false}, "Starfall Coronet": {"bossFr": ["Bête dans la glace"], "uber": false}, "Fractured Winterglass": {"bossFr": ["Astaroth"], "uber": false}, "Gloves of the Illuminator": {"bossFr": ["Bête dans la glace"], "uber": false}, "Raiment of the Infinite": {"bossFr": ["Bartuc"], "uber": false}, "Esu's Heirloom": {"bossFr": ["Astaroth"], "uber": false}, "The Oculus": {"bossFr": ["Bête dans la glace"], "uber": false}, "Blue Rose": {"bossFr": ["Duriel"], "uber": false}, "Flameweaver": {"bossFr": ["Messager de la Haine"], "uber": false}, "Craze of the Dead God": {"bossFr": ["Andariel"], "uber": false}, "Ring of the Midday Hunt": {"bossFr": ["Zir"], "uber": false}, "Ring of Writhing Moon": {"bossFr": ["Zir"], "uber": false}, "Nesekem the Herald": {"bossFr": ["Andariel", "Duriel", "Grigoire", "Varshan", "Zir", "Bête dans la glace"], "uber": true}, "Heir of Perdition": {"bossFr": ["Andariel", "Duriel", "Grigoire", "Varshan", "Zir", "Bête dans la glace"], "uber": true}, "Shroud of False Death": {"bossFr": ["Andariel", "Duriel", "Grigoire", "Varshan", "Zir", "Bête dans la glace"], "uber": true}, "Shattered Vow": {"bossFr": ["Andariel", "Duriel", "Grigoire", "Varshan", "Zir", "Bête dans la glace"], "uber": true}, "Protection of the Prime": {"bossFr": ["Bête dans la glace"], "uber": false}, "Peacemonger's Signet": {"bossFr": ["Grigoire"], "uber": false}, "Ring of the Midnight Sun": {"bossFr": ["Astaroth"], "uber": false}, "Loyalty's Mantle": {"bossFr": ["Bartuc"], "uber": false}, "Wushe Nak Pa": {"bossFr": ["Duriel"], "uber": false}, "Band of First Breath": {"bossFr": ["Urivar"], "uber": false}, "Jacinth Shell": {"bossFr": ["Andariel"], "uber": false}, "Harmony of Ebewaka": {"bossFr": ["Bartuc"], "uber": false}, "Scorn of the Earth": {"bossFr": ["Bête dans la glace"], "uber": false}, "Wound Drinker": {"bossFr": ["Varshan"], "uber": false}, "Rod of Kepeleke": {"bossFr": ["Duriel"], "uber": false}, "Sepazontec": {"bossFr": ["Messager de la Haine"], "uber": false}, "Ugly Bastard Helm": {"bossFr": ["Messager de la Haine"], "uber": false}, "Stone of Vehemen": {"bossFr": ["Varshan"], "uber": false}, "The Unmaker": {"bossFr": ["Bartuc"], "uber": false}, "Pitfighter's Gull": {"bossFr": ["Zir"], "uber": false}, "Sidhe Bindings": {"bossFr": ["Messager de la Haine"], "uber": false}, "The Third Blade": {"bossFr": ["Astaroth"], "uber": false}, "Rakanoth's Wake": {"bossFr": ["Butin monde (n'importe quel boss/activité)"], "uber": false}, "Crown of Lucion": {"bossFr": ["Astaroth"], "uber": false}, "The Umbracrux": {"bossFr": ["Zir"], "uber": false}, "Endurant Faith": {"bossFr": ["Butin monde (n'importe quel boss/activité)"], "uber": false}, "Shard of Verathiel": {"bossFr": ["Varshan"], "uber": false}, "The Basilisk": {"bossFr": ["Grigoire"], "uber": false}, "The Mortacrux": {"bossFr": ["Grigoire"], "uber": false}, "Vox Omnium": {"bossFr": ["Varshan"], "uber": false}, "Kessime's Legacy": {"bossFr": ["Andariel"], "uber": false}, "Mantle of Mountain's Fury": {"bossFr": ["Urivar"], "uber": false}, "Malefic Crescent": {"bossFr": ["Bête dans la glace"], "uber": false}, "Indira's Memory": {"bossFr": ["Bête dans la glace"], "uber": false}, "Assassin's Stride": {"bossFr": ["Andariel"], "uber": false}, "Strike of Stormhorn": {"bossFr": ["Grigoire"], "uber": false}, "Okun's Catalyst": {"bossFr": ["Zir"], "uber": false}, "Sunstained War-Crozier": {"bossFr": ["Grigoire"], "uber": false}, "‍Sunbird's Gorget": {"bossFr": ["Urivar"], "uber": false}, "Gathlen's Birthright": {"bossFr": ["Zir"], "uber": false}, "Bane of Ahjad-Den": {"bossFr": ["Messager de la Haine"], "uber": false}, "‍Sanguivor, Blade of Zir": {"bossFr": ["Zir"], "uber": false}, "Bands of Ichorous Rose": {"bossFr": ["Duriel"], "uber": false}, "Hail of Verglas": {"bossFr": ["Astaroth"], "uber": false}, "Ophidian Iris": {"bossFr": ["Bartuc"], "uber": false}, "‍Hooves of the Mountain God": {"bossFr": ["Astaroth"], "uber": false}, "‍Rotting Lightbringer": {"bossFr": ["Varshan", "Urivar"], "uber": false}, "The Hand of Naz": {"bossFr": ["Varshan"], "uber": false}, "‍Deathmask of Nirmitruq": {"bossFr": ["Andariel"], "uber": false}, "Balazan's Maxtlatl": {"bossFr": ["Varshan"], "uber": false}, "Locran's Talisman": {"bossFr": ["Butin monde (n'importe quel boss/activité)"], "uber": false}, "Herald's Morningstar": {"bossFr": ["Urivar"], "uber": false}, "Herald of Zakarum": {"bossFr": ["Astaroth"], "uber": false}, "Argent Veil": {"bossFr": ["Andariel"], "uber": false}, "Orsivane": {"bossFr": ["Andariel"], "uber": false}, "‍Autumnal Crown": {"bossFr": ["Varshan"], "uber": false}, "Hangman's Hand": {"bossFr": ["Varshan"], "uber": false}, "Seal of the Second Trumpet": {"bossFr": ["Varshan"], "uber": false}, "Death's Pavane": {"bossFr": ["Varshan"], "uber": false}, "Levin Grasp": {"bossFr": ["Varshan"], "uber": false}, "Onyx Soul": {"bossFr": ["Varshan"], "uber": false}, "Raiment of the Sea": {"bossFr": ["Varshan"], "uber": false}, "Might of Qual-Kehk": {"bossFr": ["Grigoire"], "uber": false}, "Will of Stone": {"bossFr": ["Grigoire"], "uber": false}, "Deathgrip": {"bossFr": ["Grigoire"], "uber": false}, "Desperate March": {"bossFr": ["Grigoire"], "uber": false}, "The Maestro": {"bossFr": ["Grigoire"], "uber": false}, "Vision of the Firestorm": {"bossFr": ["Grigoire"], "uber": false}, "Fleshwrit Carapace": {"bossFr": ["Zir"], "uber": false}, "Hands of the Worldbreaker": {"bossFr": ["Grigoire"], "uber": false}, "The Hemat Stone": {"bossFr": ["Bartuc"], "uber": false}, "Shrouded Gift": {"bossFr": ["Messager de la Haine"], "uber": false}, "Cage of Madness": {"bossFr": ["Grigoire"], "uber": false}, "Wreath of Auric Laurel": {"bossFr": ["Varshan"], "uber": false}, "Ae'grom's Schism": {"bossFr": ["Varshan"], "uber": false}, "Seal of the Ophanim": {"bossFr": ["Varshan"], "uber": false}, "Thrice-Woven Nightmare": {"bossFr": ["Varshan"], "uber": false}, "Bastion of Sir Matthias": {"bossFr": ["Grigoire"], "uber": false}, "Sunbrand": {"bossFr": ["Grigoire"], "uber": false}, "Seed of Horazon": {"bossFr": ["Grigoire"], "uber": false}, "Sire of Sin": {"bossFr": ["Grigoire"], "uber": false}, "The Relentless Heart": {"bossFr": ["Bête dans la glace"], "uber": false}, "Accord of the Wilds": {"bossFr": ["Bête dans la glace"], "uber": false}, "Light's Rebuke": {"bossFr": ["Bête dans la glace"], "uber": false}, "Sanctis of Kethamar": {"bossFr": ["Bête dans la glace"], "uber": false}, "Orphan Maker": {"bossFr": ["Bête dans la glace"], "uber": false}, "Gift of Frost": {"bossFr": ["Bête dans la glace"], "uber": false}, "Hellhound's Sabatons": {"bossFr": ["Bête dans la glace"], "uber": false}, "Kabraxis' Will": {"bossFr": ["Bête dans la glace"], "uber": false}, "The Eightfold Idol": {"bossFr": ["Bête dans la glace"], "uber": false}, "Signet of Pelghain": {"bossFr": ["Bête dans la glace"], "uber": false}, "Judgment of Auriel": {"bossFr": ["Zir"], "uber": false}, "Judicant's Glaivehelm": {"bossFr": ["Zir"], "uber": false}, "Fang of the Vipermagi": {"bossFr": ["Zir"], "uber": false}, "Rimeblood": {"bossFr": ["Zir"], "uber": false}, "Dirge of Odium": {"bossFr": ["Zir"], "uber": false}, "Elegy": {"bossFr": ["Zir"], "uber": false}, "Dark Howl": {"bossFr": ["Urivar"], "uber": false}, "Kilt of Blackwing": {"bossFr": ["Urivar"], "uber": false}, "Gospel of the Devotee": {"bossFr": ["Urivar"], "uber": false}, "Will of Rathma": {"bossFr": ["Urivar"], "uber": false}, "Cathedral's Song": {"bossFr": ["Urivar"], "uber": false}, "Cassia's Grace": {"bossFr": ["Urivar"], "uber": false}, "Molten Band": {"bossFr": ["Urivar"], "uber": false}, "Cowl of Malefic Torment": {"bossFr": ["Urivar"], "uber": false}, "Infernal Homunculus": {"bossFr": ["Urivar"], "uber": false}, "The Blade of Sight Aflame": {"bossFr": ["Urivar"], "uber": false}, "Dark Stalker's Medallion": {"bossFr": ["Duriel"], "uber": false}, "Sabre of Tsasgal": {"bossFr": ["Duriel"], "uber": false}, "Fractured Runestone": {"bossFr": ["Duriel"], "uber": false}, "Greenwalker's Oath": {"bossFr": ["Duriel"], "uber": false}, "Mark of the Old Wolf": {"bossFr": ["Duriel"], "uber": false}, "The Undercrown": {"bossFr": ["Duriel"], "uber": false}, "Supplication": {"bossFr": ["Duriel"], "uber": false}, "Ward of the White Dove": {"bossFr": ["Duriel"], "uber": false}, "Sea Lord's Fine Gloves": {"bossFr": ["Duriel"], "uber": false}, "Galvanic Azurite": {"bossFr": ["Duriel"], "uber": false}, "Widow's Web": {"bossFr": ["Duriel"], "uber": false}, "Gauntlets of Sheol": {"bossFr": ["Duriel"], "uber": false}, "Rictus of Terror": {"bossFr": ["Duriel"], "uber": false}, "Scourge of Duriel": {"bossFr": ["Duriel"], "uber": false}, "Emblem of Staalbreak": {"bossFr": ["Andariel"], "uber": false}, "Greenwalker's Signet": {"bossFr": ["Andariel"], "uber": false}, "Dawnfire": {"bossFr": ["Andariel"], "uber": false}, "Drognan's Anguish": {"bossFr": ["Andariel"], "uber": false}, "Anathema of the Primes": {"bossFr": ["Andariel"], "uber": false}, "Night Terror": {"bossFr": ["Andariel"], "uber": false}, "Scepter of the Three": {"bossFr": ["Andariel"], "uber": false}, "Nomad's Longing Heart": {"bossFr": ["Messager de la Haine"], "uber": false}, "Ifeh's Dire Totem": {"bossFr": ["Messager de la Haine"], "uber": false}, "Might of the Ursine": {"bossFr": ["Messager de la Haine"], "uber": false}, "Blood Wake": {"bossFr": ["Messager de la Haine"], "uber": false}, "Pact of Bone": {"bossFr": ["Messager de la Haine"], "uber": false}, "The Gloom Ward": {"bossFr": ["Messager de la Haine"], "uber": false}, "Gate of the Red Dawn": {"bossFr": ["Messager de la Haine"], "uber": false}, "Mantle of the Grey": {"bossFr": ["Messager de la Haine"], "uber": false}, "Etna's Lost Dagger": {"bossFr": ["Messager de la Haine"], "uber": false}, "Protean Heart": {"bossFr": ["Messager de la Haine"], "uber": false}, "Bridle of Tor'Baalos": {"bossFr": ["Messager de la Haine"], "uber": false}, "Spine of Tathamet": {"bossFr": ["Messager de la Haine"], "uber": false}, "The Fecund Seal": {"bossFr": ["Messager de la Haine"], "uber": false}, "Chainscourged Mail": {"bossFr": ["Le Boucher"], "uber": false}, "Fury of the Wilds": {"bossFr": ["Le Boucher"], "uber": false}, "Heart of Azgar": {"bossFr": ["Le Boucher"], "uber": false}, "Purified Lightbringer": {"bossFr": ["Le Boucher"], "uber": false}, "Mace of King Leoric": {"bossFr": ["Le Boucher"], "uber": false}, "Red Blessing": {"bossFr": ["Le Boucher"], "uber": false}, "Vengeful Sinew": {"bossFr": ["Le Boucher"], "uber": false}, "March of the Stalwart Soul": {"bossFr": ["Le Boucher"], "uber": false}, "Red Sermon": {"bossFr": ["Le Boucher"], "uber": false}, "Fist of the Iron Rose": {"bossFr": ["Le Boucher"], "uber": false}, "Emberfury": {"bossFr": ["Le Boucher"], "uber": false}, "Shanar's Resonance": {"bossFr": ["Messager de la Haine"], "uber": false}, "Staff of Zerae": {"bossFr": ["Le Boucher"], "uber": false}, "Hesha e Kesungi": {"bossFr": ["Le Boucher"], "uber": false}, "Path of the Emissary": {"bossFr": ["Le Boucher"], "uber": false}, "Hellbrand Signet": {"bossFr": ["Le Boucher"], "uber": false}, "Lurid Pact": {"bossFr": ["Le Boucher"], "uber": false}, "Moloch's Beating Flame": {"bossFr": ["Le Boucher"], "uber": false}, "Nails of the Gore-Crowned": {"bossFr": ["Le Boucher"], "uber": false}, "Dirge of Airidah": {"bossFr": ["Astaroth"], "uber": false}, "Griswold's Opus": {"bossFr": ["Astaroth"], "uber": false}, "Gladiator's Triumph": {"bossFr": ["Astaroth"], "uber": false}, "Echo of Kwatli": {"bossFr": ["Astaroth"], "uber": false}, "Bindings of Attrition": {"bossFr": ["Astaroth"], "uber": false}, "Footfalls of the Waning World": {"bossFr": ["Astaroth"], "uber": false}, "Hecaton Chasm": {"bossFr": ["Astaroth"], "uber": false}, "Litany of Sable": {"bossFr": ["Astaroth"], "uber": false}, "The Open Eye of Gorgorra": {"bossFr": ["Bartuc"], "uber": false}, "Khamsin Steppewalkers": {"bossFr": ["Bartuc"], "uber": false}, "Gravewalker's Hand": {"bossFr": ["Bartuc"], "uber": false}, "Omen of Pain": {"bossFr": ["Bartuc"], "uber": false}, "Arcadia": {"bossFr": ["Bartuc"], "uber": false}, "Sundered Night": {"bossFr": ["Bartuc"], "uber": false}, "Misericorde": {"bossFr": ["Bartuc"], "uber": false}, "Eye of Baal": {"bossFr": ["Bartuc"], "uber": false}, "Hand of Apotheosis": {"bossFr": ["Bartuc"], "uber": false}, "Sashes of the Wretched": {"bossFr": ["Bartuc"], "uber": false}, "Blood-Mad Idol": {"bossFr": ["Butin monde (n'importe quel boss/activité)"], "uber": false}, "Rustbitten Dirk": {"bossFr": ["Butin monde (n'importe quel boss/activité)"], "uber": false}, "Thousand-Eye Reaver": {"bossFr": ["Butin monde (n'importe quel boss/activité)"], "uber": false}, "Thundergod's Blessing": {"bossFr": ["Butin monde (n'importe quel boss/activité)"], "uber": false}, "Wendigo Brand": {"bossFr": ["Butin monde (n'importe quel boss/activité)"], "uber": false}, "Wyrdskin": {"bossFr": ["Butin monde (n'importe quel boss/activité)"], "uber": false}};

  // Paragon glyph/board names - kept separate from FR_EN_DICTIONARY rather
  // than merged in, on purpose: these English names ("Control", "Combat",
  // "Insight"-like short common words) are common enough in ordinary
  // English prose that blindly substring-replacing them anywhere on a
  // page (as page-translation does) risks mangling unrelated sentences.
  // Scoped to ONLY the "Boards Used" panel text (see
  // findParagonBoardNames() below) instead, where a false match is far
  // less likely. Confirmed 2026-09-21 by reading kami-labs' own build
  // pages: their Paragon glyph icons are named after the English glyph
  // (e.g. "Versatility.webp") with the French translation as the image's
  // alt text - a reliable, code-verifiable pairing, not a guess.
  const PARAGON_DICTIONARY = {
    glyphs: {
      "Versatility": "Polyvalence", "Control": "Contrôle", "Canny": "Astuce", "Devious": "Sournoiserie",
      "Bane": "Fléau", "Combat": "Combat", "Efficacy": "Efficacité", "Tracker": "Pistage", "Ambush": "Embuscade",
    },
    boards: { "Cheap Shot": "Coup bas", "Eldritch Bounty": "Prime exotique", "Exploit Weakness": "Abus de faiblesse" },
  };

  // Uber boss names (the bosses shown in the item-source tooltip, see
  // UNIQUE_ITEM_SOURCES/lookupItemSource above) - EN names confirmed via
  // d4guides.gg/en/bosses (already a trusted source elsewhere in this
  // script), FR names from talion.tv's own admin labels (same source as
  // UNIQUE_ITEM_SOURCES). Most boss names are spelled identically in both
  // languages (Andariel, Astaroth, Bartuc, Duriel, Grigoire, Urivar,
  // Varshan) and are omitted here on purpose - nothing to translate, and
  // addPairs()/translateTextIn() already skip identical en/fr pairs.
  // Both a short and a "full title" EN form are listed per boss (guides
  // use either) - not scoped like PARAGON_DICTIONARY since these are
  // distinctive multi-word phrases, not generic short words.
  const BOSS_NAME_PAIRS = [
    ["The Butcher", "Le Boucher"],
    ["Butcher", "Le Boucher"],
    ["Harbinger of Hatred", "Messager de la Haine"],
    ["Harbinger", "Messager de la Haine"],
    ["The Beast in the Ice", "Bête dans la glace"],
    ["Beast in Ice", "Bête dans la glace"],
    ["Lord Zir", "Zir"],
  ];

  const WORD_RE = /[a-z']+/g;

  function fold(text) {
    return text.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  }

  function signature(title) {
    let folded = " " + fold(title) + " ";
    for (const entry of FR_EN_DICTIONARY) {
      const frFolded = fold(entry.fr);
      if (frFolded.length > 3 && folded.includes(frFolded)) {
        folded = folded.split(frFolded).join(" " + fold(entry.en) + " ");
      }
    }
    const words = new Set();
    let m;
    WORD_RE.lastIndex = 0;
    while ((m = WORD_RE.exec(folded))) {
      const w = m[0];
      if (!NOISE_WORDS.has(w) && w.length > 2) words.add(w);
    }
    return words;
  }

  function similarity(a, b) {
    if (a.size === 0 || b.size === 0) return 0;
    let inter = 0;
    for (const x of a) if (b.has(x)) inter++;
    return inter / (a.size + b.size - inter);
  }

  function findBestTitleMatch(candidates, title, gameClass) {
    let pool = candidates;
    if (gameClass) {
      const withClass = candidates.filter((b) => b.gameClass === gameClass || b.gameClass == null);
      if (withClass.length) pool = withClass;
    }
    const querySig = signature(title);
    let best = null;
    let bestScore = SIMILARITY_THRESHOLD;
    for (const build of pool) {
      const score = similarity(querySig, signature(build.title));
      if (score >= bestScore) {
        best = build;
        bestScore = score;
      }
    }
    return best;
  }

  // ---------------------------------------------------------------------
  // GM_xmlhttpRequest as a Promise.
  // ---------------------------------------------------------------------
  function gmGet(url) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: "GET",
        url,
        onload: (res) => resolve(res.responseText),
        onerror: () => reject(new Error(`Impossible de joindre ${url}`)),
        ontimeout: () => reject(new Error(`Délai dépassé pour ${url}`)),
        timeout: 20000,
      });
    });
  }

  // ---------------------------------------------------------------------
  // InfinityBuilds tier list - server-rendered, no browser automation
  // needed (see docstring at the top of this file). Title+url come from
  // the page's own JSON-LD ItemList block (clean data); tier+class come
  // from the rendered anchor markup, joined by url - the two live in
  // different parts of the page so this correlates them.
  // ---------------------------------------------------------------------
  async function fetchInfinityBuildsBuilds() {
    const html = await gmGet("https://infinitybuilds.gg/en/tier-list/endgame");
    const doc = new DOMParser().parseFromString(html, "text/html");

    let items = [];
    for (const block of doc.querySelectorAll('script[type="application/ld+json"]')) {
      try {
        const parsed = JSON.parse(block.textContent);
        const list = Array.isArray(parsed) ? parsed : [parsed];
        const found = list.find((x) => x["@type"] === "ItemList");
        if (found && Array.isArray(found.itemListElement)) {
          items = found.itemListElement.map((it) => ({ url: it.url, title: it.name }));
          break;
        }
      } catch (e) {
        // not the right script block - keep looking
      }
    }

    const meta = new Map();
    for (const a of doc.querySelectorAll('a[href*="/builds/"]')) {
      const href = a.getAttribute("href");
      if (!href) continue;
      const url = href.startsWith("http") ? href : "https://infinitybuilds.gg" + href;
      const section = a.closest("section[aria-label]");
      const label = section ? section.getAttribute("aria-label") || "" : "";
      const tierMatch = label.match(/Tier (\w+)/i);
      const classMatch = (a.getAttribute("style") || "").match(/--color-class-([a-z]+)/);
      meta.set(url, {
        tier: tierMatch ? tierMatch[1].toUpperCase() : null,
        gameClass: classMatch ? classMatch[1] : null,
      });
    }

    return items.map((it) => ({
      title: it.title,
      url: it.url,
      tier: meta.get(it.url)?.tier ?? null,
      gameClass: meta.get(it.url)?.gameClass ?? null,
    }));
  }

  // ---------------------------------------------------------------------
  // kami-labs' build hub - a real JSON API, same one app/scrapers/
  // kamilabs.py already used, just called from the browser instead of httpx.
  // ---------------------------------------------------------------------
  async function fetchKamiLabsBuilds(season) {
    const seasonTag = "S" + season;
    const raw = await gmGet("https://kami-labs.fr/wp-json/autoarticle/v1/d4/hub/builds-ajax");
    const json = JSON.parse(raw);
    const doc = new DOMParser().parseFromString(json.builds_html, "text/html");

    const results = [];
    for (const card of doc.querySelectorAll("article.d4-hub-build-item")) {
      if (card.getAttribute("data-season") !== seasonTag) continue;
      const link = card.querySelector("a.build-link");
      const titleEl = card.querySelector("h3.build-skill");
      if (!link || !titleEl) continue;
      results.push({
        title: titleEl.textContent.trim(),
        url: link.getAttribute("href") || "",
        gameClass: card.getAttribute("data-class") || null,
        tier: (card.getAttribute("data-tier") || "").replace("-TIER", "") || null,
      });
    }
    return results;
  }

  // ---------------------------------------------------------------------
  // Three more sources for the multi-site consensus ranking (see
  // groupConsensus()/runRanking() below) - each a straight port of its
  // app/scrapers/*.py counterpart, called from the browser instead of httpx.
  // ---------------------------------------------------------------------

  // Maxroll's endgame tier list - server-rendered, same CSS-prefix matching
  // as app/scrapers/maxroll.py (the build-tool hash suffix can change on
  // redeploy, so matching is on the stable prefix, not the full class name).
  async function fetchMaxrollBuilds() {
    const html = await gmGet("https://maxroll.gg/d4/tierlists/endgame-tier-list");
    const doc = new DOMParser().parseFromString(html, "text/html");
    const hasPrefix = (el, prefix) => Array.from(el.classList).some((c) => c.startsWith(prefix));

    const results = [];
    for (const tierDiv of doc.querySelectorAll("div")) {
      if (!hasPrefix(tierDiv, "_Tierlist__tier_")) continue;
      const header = tierDiv.querySelector("h3");
      if (!header) continue;
      const tierMatch = header.textContent.trim().match(/^([A-Z])Tier/);
      const tier = tierMatch ? tierMatch[1] : null;

      for (const link of tierDiv.querySelectorAll("a")) {
        if (!hasPrefix(link, "_Tierlist__tierItem_")) continue;
        const href = link.getAttribute("href");
        if (!href) continue;
        const titleEl = Array.from(link.querySelectorAll("span")).find((s) => hasPrefix(s, "_Tierlist__tierItemText_"));
        const title = (titleEl || link).textContent.trim();
        const icon = link.querySelector("img");
        const iconSrc = ((icon && icon.getAttribute("src")) || "").toLowerCase();
        let gameClass = Object.keys(CLASS_KEYWORDS).find((c) => iconSrc.includes(c)) || null;
        if (!gameClass && iconSrc.includes("sorc")) gameClass = "sorcerer"; // Maxroll's sorc icon file doesn't spell the class name out
        results.push({ source: "maxroll", title, url: href.startsWith("http") ? href : "https://maxroll.gg" + href, tier, gameClass });
      }
    }
    return results;
  }

  // D4Builds' "Meta Builds" homepage - server-rendered, no S/A/B tier
  // (ranked by Pit level instead, which this doesn't surface - see
  // app/scrapers/d4builds.py for why).
  async function fetchD4BuildsBuilds() {
    const html = await gmGet("https://d4builds.gg/");
    const doc = new DOMParser().parseFromString(html, "text/html");
    const classIds = new Set(Object.keys(CLASS_KEYWORDS));

    const results = [];
    for (const card of doc.querySelectorAll("a.build")) {
      const href = card.getAttribute("href");
      const titleEl = card.querySelector("h2");
      if (!href || !titleEl) continue;
      const icon = card.querySelector("img.build__icon");
      let gameClass = null;
      if (icon) {
        for (const cls of icon.classList) {
          if (classIds.has(cls.toLowerCase())) { gameClass = cls.toLowerCase(); break; }
        }
      }
      results.push({
        source: "d4builds", title: titleEl.textContent.trim(),
        url: href.startsWith("http") ? href : "https://d4builds.gg" + href,
        tier: null, gameClass,
      });
    }
    return results;
  }

  // D4Guides' JSON API - same endpoint as app/scrapers/d4guides.py.
  async function fetchD4GuidesBuilds(season) {
    const classIds = new Set(Object.keys(CLASS_KEYWORDS));
    let raw;
    try {
      raw = await gmGet(`https://d4guides.gg/api/v1/builds.php?limit=200&offset=0&sort=tier&season=${season}`);
    } catch (e) {
      return [];
    }
    let payload;
    try {
      payload = JSON.parse(raw);
    } catch (e) {
      return []; // seen return a Cloudflare challenge HTML page instead of JSON on some requests
    }
    const results = [];
    for (const build of (payload.data && payload.data.builds) || []) {
      const gameClass = classIds.has(build.class_slug) ? build.class_slug : null;
      const slug = build.canonical_slug || build.slug;
      results.push({
        source: "d4guides", title: build.title_en || build.title || "",
        url: `https://d4guides.gg/en/build/${slug}`, tier: build.tier_rating || null, gameClass,
      });
    }
    return results;
  }

  // talion.tv's public builds API - same endpoint as app/scrapers/talion.py
  // (found by recording real network requests, see that file's docstring).
  const TALION_CLASS_SLUG_FR_TO_EN = {
    barbare: "barbarian", druide: "druid", necromancien: "necromancer", paladin: "paladin",
    voleur: "rogue", sorcier: "sorcerer", sacresprit: "spiritborn", demoniste: "warlock",
  };
  const TALION_VALID_TIERS = new Set(["S", "A", "B", "C", "D"]);

  async function fetchTalionBuilds() {
    const raw = await gmGet("https://api.talion.tv/api/builds/front");
    const payload = JSON.parse(raw);
    const results = [];
    for (const build of payload) {
      if ((build.game && build.game.slug) !== "diablo-4") continue;
      const classSlugFr = build.class && build.class.slug;
      const gameClass = TALION_CLASS_SLUG_FR_TO_EN[classSlugFr] || null;
      let tier = null;
      for (const tag of build.tags || []) {
        // talion's API returns tier labels with a trailing space ("A ", "S "...) -
        // confirmed live 2026-09-21, matches VALID_TIERS only after trimming.
        const label = (tag.label || "").trim();
        if (tag.category && tag.category.label === "Push Tier" && TALION_VALID_TIERS.has(label)) tier = label;
      }
      results.push({ source: "talion", title: build.title || "", url: `https://www.talion.tv/diablo-4/builds/${build.slug}`, tier, gameClass });
    }
    return results;
  }

  // ---------------------------------------------------------------------
  // Manual "search a translation live" tool (🔍 button) - for a name our
  // static FR_EN_DICTIONARY doesn't have (a case like "Grief", too new to
  // be in any snapshot yet - see HISTORIQUE.md 2026-09-21). Re-fetches
  // Maxroll's FULL game-data item tables (not just the pre-filtered
  // Unique/Talisman subsets already merged into the dictionary - the
  // complete 11,678-entry table, so this can find aspects/sets/anything
  // else too) plus talion's uniques list, live, at search time - catches
  // whatever's been added to either source since our last dictionary sync
  // without needing to re-run a Python script and republish the userscript.
  // Cached per page load (module-level - not per-search) since each
  // fetch is a few MB and a user may search more than once.
  let maxrollGameItemsCache = null;
  async function fetchMaxrollGameItems() {
    if (maxrollGameItemsCache) return maxrollGameItemsCache;
    const [enRaw, frRaw] = await Promise.all([
      gmGet("https://assets-ng.maxroll.gg/d4-tools/game/data.enus.json"),
      gmGet("https://assets-ng.maxroll.gg/d4-tools/game/data.frfr.json"),
    ]);
    maxrollGameItemsCache = { itemsEn: JSON.parse(enRaw).items, itemsFr: JSON.parse(frRaw).items };
    return maxrollGameItemsCache;
  }

  let talionUniquesLiveCache = null;
  async function fetchTalionUniquesLive() {
    if (talionUniquesLiveCache) return talionUniquesLiveCache;
    const raw = await gmGet("https://api.talion.tv/api/diablo/uniques/front");
    talionUniquesLiveCache = JSON.parse(raw);
    return talionUniquesLiveCache;
  }

  async function runLiveSearch() {
    const input = document.getElementById("d4a-search-input");
    const query = (input.value || "").trim();
    const resultsEl = document.getElementById("d4a-search-results");
    if (!query) return;
    const queryFold = fold(query);

    resultsEl.innerHTML = `<p>Recherche de "${query}" en cours (Maxroll + talion.tv en direct)...</p>`;
    expandColumn();

    const seen = new Set();
    const results = [];

    // What we already know, instant (no network) - shown first.
    for (const entry of FR_EN_DICTIONARY) {
      if (fold(entry.en).includes(queryFold) || fold(entry.fr).includes(queryFold)) {
        if (seen.has(entry.en.toLowerCase())) continue;
        seen.add(entry.en.toLowerCase());
        results.push({ en: entry.en, fr: entry.fr, source: "déjà connu" });
        if (results.length >= 15) break;
      }
    }

    let errorNote = "";
    try {
      const [maxrollItems, talionUniques] = await Promise.all([fetchMaxrollGameItems(), fetchTalionUniquesLive()]);

      for (const key of Object.keys(maxrollItems.itemsEn)) {
        if (results.length >= 25) break;
        const enName = (maxrollItems.itemsEn[key].name || "").trim();
        if (!enName || seen.has(enName.toLowerCase()) || !fold(enName).includes(queryFold)) continue;
        const frRaw = (maxrollItems.itemsFr[key] || {}).name || "";
        const frName = frRaw.replace(/^\[(?:mp|fp|ms|fs|m|f)\]\s*/, "").replace(/’/g, "'").trim();
        if (!frName || frName.toLowerCase() === enName.toLowerCase()) continue;
        seen.add(enName.toLowerCase());
        results.push({ en: enName, fr: frName, source: "Maxroll (en direct)" });
      }

      for (const it of talionUniques) {
        if (results.length >= 25) break;
        const enName = (it.name_en || "").trim();
        if (!enName || seen.has(enName.toLowerCase()) || !fold(enName).includes(queryFold)) continue;
        seen.add(enName.toLowerCase());
        results.push({ en: enName, fr: (it.name_fr || "").replace(/’/g, "'").trim(), source: "talion.tv (en direct)" });
      }
    } catch (e) {
      errorNote = `<p style="color:#c9a227">Recherche en direct indisponible (${e.message}) - résultats déjà connus seulement.</p>`;
    }

    if (results.length === 0) {
      resultsEl.innerHTML = `<p>Aucune traduction trouvée pour "${query}", ni dans le dictionnaire ni en direct.</p>${errorNote}`;
      return;
    }
    const rows = results
      .map((r) => `<div class="d4a-search-row"><strong>${r.en}</strong> → ${r.fr}<br><span class="d4a-search-source">${r.source}</span></div>`)
      .join("");
    resultsEl.innerHTML = `${errorNote}${rows}`;
  }

  // ---------------------------------------------------------------------
  // Cross-source consensus ranking - port of app/consensus.py's _group()/
  // rank_builds() (minus the official Tower-leaderboard confirmation
  // boost, a separate and much larger sub-system not ported here - see
  // HISTORIQUE.md). Reuses signature()/similarity()/SIMILARITY_THRESHOLD
  // above, which are already that same file's _signature()/_similarity()
  // ported for title-matching - same grouping math, just applied to a
  // whole list pairwise instead of one query title against a list.
  // ---------------------------------------------------------------------
  const TIER_POINTS = { S: 4, A: 3, B: 2, C: 1, D: 0 };
  const TIER_ORDER = ["S", "A", "B", "C", "D"];

  // "Note du build" (demande utilisateur du 2026-09-22, port de
  // consensus.py's tier_counts/note_label) - combien de sources classent
  // ce build S, puis A, etc. Comparé lexicographiquement dans
  // rankConsensusGroups: un seul S l'emporte sur n'importe quel nombre de
  // A, contrairement à une simple moyenne (4×A ~ 1×S+1×D en moyenne, mais
  // un S reste un signal individuel plus fort qu'un A).
  function tierCounts(builds) {
    const counts = { S: 0, A: 0, B: 0, C: 0, D: 0 };
    for (const b of builds) if (b.tier in counts) counts[b.tier]++;
    return TIER_ORDER.map((t) => counts[t]);
  }

  function compareTierCounts(a, b) {
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return a[i] - b[i];
    }
    return 0;
  }

  const TIER_COLORS = { S: "#d4622a", A: "#c9a227", B: "#4a90a4", C: "#6b7280", D: "#6b7280" };

  function noteBadgesHtml(counts) {
    const parts = TIER_ORDER.map((t, i) => (counts[i] ? `<span class="d4a-tier-badge" style="background:${TIER_COLORS[t]}">${t}×${counts[i]}</span>` : null)).filter(Boolean);
    return parts.length ? parts.join(" ") : `<span class="d4a-rank-meta">non classé</span>`;
  }

  function groupConsensus(builds) {
    const groups = [];
    for (const build of builds) {
      const sig = signature(build.title);
      let bestGroup = null;
      let bestScore = SIMILARITY_THRESHOLD;
      for (const group of groups) {
        const score = similarity(sig, group.signature);
        if (score >= bestScore) {
          bestGroup = group;
          bestScore = score;
        }
      }
      if (bestGroup) {
        bestGroup.builds.push(build);
        for (const w of sig) bestGroup.signature.add(w);
      } else {
        groups.push({ builds: [build], signature: new Set(sig) });
      }
    }
    return groups;
  }

  function rankConsensusGroups(groups) {
    return groups
      .map((g) => {
        const sources = Array.from(new Set(g.builds.map((b) => b.source))).sort();
        const tierPoints = g.builds.filter((b) => b.tier in TIER_POINTS).map((b) => TIER_POINTS[b.tier]);
        const avgTier = tierPoints.length ? tierPoints.reduce((a, b) => a + b, 0) / tierPoints.length : -1;
        const counts = tierCounts(g.builds);
        // Prefer a French title (kami-labs/talion) as the representative, same as consensus.py's to_dict().
        const representative = g.builds.find((b) => b.source === "kamilabs") || g.builds.find((b) => b.source === "talion") || g.builds[0];
        return { title: representative.title, sourceCount: sources.length, sources, avgTier, tierCounts: counts, builds: g.builds };
      })
      // La note (compte de S/A/B/C/D) décide d'abord - "le plus de S gagne",
      // comme un tableau des médailles - source_count et avgTier ne
      // départagent plus qu'une égalité exacte sur la note.
      .sort((a, b) => compareTierCounts(b.tierCounts, a.tierCounts) || b.sourceCount - a.sourceCount || b.avgTier - a.avgTier);
  }

  async function runRanking() {
    const gameClass = guessClass();
    if (!gameClass) {
      renderRankingPanel(`<h3>Classement</h3><p style="color:#c9a227">Classe non détectée sur cette page.</p>`);
      return;
    }
    renderRankingPanel(`<h3>Classement</h3><p>Recherche des meilleurs builds ${gameClass}...</p>`);

    const results = await Promise.allSettled([
      fetchInfinityBuildsBuilds(),
      fetchKamiLabsBuilds(CURRENT_SEASON),
      fetchMaxrollBuilds(),
      fetchD4BuildsBuilds(),
      fetchD4GuidesBuilds(CURRENT_SEASON),
      fetchTalionBuilds(),
    ]);
    const sourceNames = ["infinitybuilds", "kamilabs", "maxroll", "d4builds", "d4guides", "talion"];
    const failedSources = [];
    let allBuilds = [];
    results.forEach((r, i) => {
      if (r.status === "fulfilled") {
        const withSource = r.value.map((b) => (b.source ? b : { ...b, source: sourceNames[i] }));
        allBuilds = allBuilds.concat(withSource);
      } else {
        failedSources.push(sourceNames[i]);
      }
    });

    const classBuilds = allBuilds.filter((b) => b.gameClass === gameClass || b.gameClass == null);
    const ranked = rankConsensusGroups(groupConsensus(classBuilds)).slice(0, 30);

    if (ranked.length === 0) {
      renderRankingPanel(`<h3>Classement</h3><p style="color:#c9a227">Aucun build trouvé pour cette classe.</p>`);
      return;
    }

    const failedNote = failedSources.length
      ? `<p style="color:#c9a227">Source(s) indisponible(s) cette fois : ${failedSources.join(", ")}.</p>`
      : "";

    const rows = ranked
      .map((g, i) => {
        const links = g.builds.map((b) => `<a href="${b.url}" target="_blank" rel="noopener noreferrer">${b.source}</a>`).join(" · ");
        return `<div class="d4a-rank-row"><strong>#${i + 1} ${g.title}</strong><br>
          <span class="d4a-rank-meta">${g.sourceCount} source(s) · </span>${noteBadgesHtml(g.tierCounts)}<br>
          <span class="d4a-rank-links">${links}</span></div>`;
      })
      .join("");

    renderRankingPanel(`
      <h3>Classement - ${gameClass}</h3>
      ${failedNote}
      <div id="d4a-rank-list">${rows}</div>
    `);
  }

  // ---------------------------------------------------------------------
  // InfinityBuilds build DETAIL extraction (gear per slot + skills) - runs
  // for real in a background tab (see file docstring). Same DOM-scoped
  // extraction as app/fr_en/extractor.py's GEAR_JS/SKILLS_JS, just written
  // as native JS instead of a page.evaluate() string, since it now runs
  // directly on the target page rather than through Playwright.
  // ---------------------------------------------------------------------
  const HEADER_RE = /^[A-ZÀ-Ÿ0-9 '\-]{2,25}$/;

  function extractGearRaw() {
    return Array.from(document.querySelectorAll(".gear-paperdoll-tile")).map((t) => t.innerText.split("\n"));
  }

  function extractSkillsRaw() {
    const cls = "text-[10px] font-semibold uppercase tracking-wider text-[#b7b0a6]";
    const header = Array.from(document.querySelectorAll("p")).find((e) => e.className === cls);
    if (!header) return [];
    let node = header;
    for (let i = 0; i < 3; i++) node = node.parentElement;
    return node.innerText.split("\n");
  }

  function gearNames(tilesRaw) {
    const names = [];
    for (const lines of tilesRaw) {
      if (lines.length >= 5 && lines[1] === "" && lines[3] === "" && lines[2]) names.push(lines[2]);
    }
    return names;
  }

  function skillNames(blockLines) {
    const names = [];
    for (const raw of blockLines.slice(2)) {
      const text = raw.trim();
      if (text === "" || /^\d+$/.test(text)) continue;
      if (HEADER_RE.test(text)) break;
      names.push(text);
    }
    return names;
  }

  // Runs ONLY inside a background tab opened for extraction (see
  // openExtractionTab below) - reports the build's gear/skills back via
  // GM_setValue, then closes its own tab. Tries native extraction first
  // (instant, works whenever the tab landed on kami-labs/Maxroll - added
  // 2026-09-22 for compareVariants() below, which can point this at ANY
  // of the 6 sites' build URLs, not just InfinityBuilds like before) and
  // falls back to the slower InfinityBuilds gear-tile DOM polling
  // otherwise - same two extraction paths resolveTranslation() already
  // uses on the CURRENT page, just reachable from inside another tab too.
  function runExtractionMode(requestId) {
    extractNativeDetail()
      .then((native) => {
        if (native && ((native.skillsEn && native.skillsEn.length) || (native.itemsEn && native.itemsEn.length))) {
          reportExtractionResult(requestId, { skills: native.skillsEn, items: native.itemsEn });
        } else {
          runInfinityBuildsExtraction(requestId);
        }
      })
      .catch(() => runInfinityBuildsExtraction(requestId));
  }

  function reportExtractionResult(requestId, result) {
    GM_setValue("d4a_result_" + requestId, JSON.stringify(result));
    setTimeout(() => {
      try {
        window.close();
      } catch (e) {
        // some browsers refuse to close a script-opened tab from here -
        // harmless, the opener closes it too (see openExtractionTab)
      }
    }, 500);
  }

  // Polls until the build's gear/skills have actually rendered (React
  // hydration isn't instant) - the original (pre-2026-09-22) extraction
  // path, now only reached when the target tab isn't kami-labs/Maxroll.
  function runInfinityBuildsExtraction(requestId) {
    const deadline = Date.now() + 10000;
    const poll = setInterval(() => {
      const gearRaw = extractGearRaw();
      const skillsRaw = extractSkillsRaw();
      const ready = (gearRaw.length > 0 && skillsRaw.length > 0) || Date.now() > deadline;
      if (!ready) return;
      clearInterval(poll);
      setTimeout(() => {
        reportExtractionResult(requestId, { skills: skillNames(extractSkillsRaw()), items: gearNames(extractGearRaw()) });
      }, 400); // small settle delay once both blocks are first detected
    }, 300);
  }

  // Opens `url` in a hidden background tab, waits for that tab's own copy
  // of this script (running in extraction mode there) to report back
  // gear/skills, then closes the tab. Resolves to null on timeout/failure
  // rather than rejecting, since a missing detail shouldn't block showing
  // whatever else was found (matched title, kami-labs link, ...).
  function openExtractionTab(url, timeoutMs = 12000) {
    return new Promise((resolve) => {
      const requestId = "r" + Date.now() + Math.random().toString(36).slice(2);
      const resultKey = "d4a_result_" + requestId;
      const sep = url.includes("?") ? "&" : "?";
      const targetUrl = url + sep + "d4a_extract=" + requestId;

      let settled = false;
      let tabHandle = null;
      let listenerId = null;
      let timer = null;

      const finish = (data) => {
        if (settled) return;
        settled = true;
        if (listenerId != null) GM_removeValueChangeListener(listenerId);
        GM_deleteValue(resultKey);
        clearTimeout(timer);
        if (tabHandle) {
          try {
            tabHandle.close();
          } catch (e) {
            // already closed itself (see runExtractionMode) - fine
          }
        }
        resolve(data);
      };

      listenerId = GM_addValueChangeListener(resultKey, (name, oldVal, newVal) => {
        if (!newVal) return;
        try {
          finish(JSON.parse(newVal));
        } catch (e) {
          finish(null);
        }
      });

      tabHandle = GM_openInTab(targetUrl, { active: false, insert: true, setParent: true });
      timer = setTimeout(() => finish(null), timeoutMs);
    });
  }

  // ---------------------------------------------------------------------
  // Official Tower leaderboard (real top-ranked players' actual equipped
  // build) via helltides.com/tower - same source/idea as app/leaderboard.py,
  // ported here for the "position officielle" shown under the panel title
  // (feature requested 2026-09-22). helltides.com embeds the leaderboard as
  // a Nuxt 3 "devalue" payload (window.__NUXT__.data) - confirmed by
  // fetching the raw HTML directly: the values ARE present, but as
  // cross-references between array slots (e.g. `"skillDetails":59` is an
  // INDEX pointing at another position in a big flat array, not inline
  // data) - a regex/JSON.parse of a substring can't reconstruct this. The
  // only reliable way to get real values back is to let Nuxt's own
  // client-side JS execute and rebuild window.__NUXT__.data itself, same
  // as app/leaderboard.py does via Playwright's page.evaluate() after
  // load - so this reuses the exact same hidden-background-tab relay
  // already used above for InfinityBuilds detail pages
  // (openExtractionTab/runExtractionMode), just with a distinct request
  // param (d4a_lb_extract, not d4a_extract) since what's read and how
  // differs (window state, not DOM tiles).
  // ---------------------------------------------------------------------
  const TOWER_URL = "https://helltides.com/tower";
  const TOWER_CACHE_KEY = "d4a_lb_cache";
  const TOWER_CACHE_TTL_MS = 30 * 60 * 1000; // matches app/leaderboard.py's CACHE_TTL_SECONDS
  const GENERIC_UTILITY_SKILL_TYPES = new Set(["Imbuement", "Subterfuge"]);

  function skillTokens(skillName) {
    const words = new Set();
    let m;
    WORD_RE.lastIndex = 0;
    while ((m = WORD_RE.exec(fold(skillName)))) {
      if (m[0].length > 2) words.add(m[0]);
    }
    return words;
  }

  function isNonEmptySubset(small, big) {
    if (small.size === 0) return false;
    for (const x of small) if (!big.has(x)) return false;
    return true;
  }

  // Runs ONLY inside the hidden background tab opened for this (see
  // openLeaderboardExtractionTab) - polls window.__NUXT__.data (Nuxt's own
  // hydration has to actually run first, see comment above), finds the
  // array shaped like the leaderboard (port of app/leaderboard.py's
  // _FIND_LEADERBOARD_JS: first array whose first entry has a
  // "skillDetails" field, more robust to a Nuxt redeploy than hardcoding
  // the hash key), reduces each entry to just what's needed (no point
  // shipping the raw multi-MB payload through GM_setValue), reports back,
  // closes itself - same relay shape as runExtractionMode.
  function runLeaderboardExtractionMode(requestId) {
    const deadline = Date.now() + 15000;
    const poll = setInterval(() => {
      const data = (window.__NUXT__ && window.__NUXT__.data) || {};
      let found = null;
      for (const value of Object.values(data)) {
        if (Array.isArray(value) && value.length && value[0] && value[0].skillDetails) {
          found = value;
          break;
        }
      }
      const ready = found || Date.now() > deadline;
      if (!ready) return;
      clearInterval(poll);
      const runs = (found || []).map((r) => ({
        rank: r.rank,
        battleTag: r.battle_tag,
        gameClass: r.class,
        tier: r.tier,
        skills: (r.skillDetails || []).filter(Boolean).map((s) => ({ name: s.name, type: s.type })),
      }));
      GM_setValue("d4a_lbresult_" + requestId, JSON.stringify(runs));
      setTimeout(() => {
        try {
          window.close();
        } catch (e) {
          // see runExtractionMode - some browsers refuse, opener closes it too
        }
      }, 500);
    }, 300);
  }

  // Same shape as openExtractionTab, distinct result-key prefix
  // (d4a_lbresult_ vs d4a_result_) so the two extraction flows can never
  // collide if both happen to be in flight at once.
  function openLeaderboardExtractionTab(timeoutMs = 18000) {
    return new Promise((resolve) => {
      const requestId = "r" + Date.now() + Math.random().toString(36).slice(2);
      const resultKey = "d4a_lbresult_" + requestId;
      const targetUrl = TOWER_URL + "?d4a_lb_extract=" + requestId;

      let settled = false;
      let tabHandle = null;
      let listenerId = null;
      let timer = null;

      const finish = (data) => {
        if (settled) return;
        settled = true;
        if (listenerId != null) GM_removeValueChangeListener(listenerId);
        GM_deleteValue(resultKey);
        clearTimeout(timer);
        if (tabHandle) {
          try {
            tabHandle.close();
          } catch (e) {
            // already closed itself - fine
          }
        }
        resolve(data);
      };

      listenerId = GM_addValueChangeListener(resultKey, (name, oldVal, newVal) => {
        if (!newVal) return;
        try {
          finish(JSON.parse(newVal));
        } catch (e) {
          finish(null);
        }
      });

      tabHandle = GM_openInTab(targetUrl, { active: false, insert: true, setParent: true });
      timer = setTimeout(() => finish(null), timeoutMs);
    });
  }

  // Cached 30min (opening a background tab is expensive, unlike the 6
  // build-site fetchers below which are plain HTTP requests and stay
  // uncached) - one shared cache for every class, filtered per-caller,
  // same shape as app/leaderboard.py's get_leaderboard()/top_skill_names().
  async function fetchTowerRuns() {
    try {
      const cached = GM_getValue(TOWER_CACHE_KEY, null);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Date.now() - parsed.fetchedAt < TOWER_CACHE_TTL_MS) return parsed.runs;
      }
    } catch (e) {
      // corrupt cache entry - fall through and refetch
    }
    const runs = (await openLeaderboardExtractionTab()) || [];
    try {
      GM_setValue(TOWER_CACHE_KEY, JSON.stringify({ fetchedAt: Date.now(), runs }));
    } catch (e) {
      // storage quota or similar - not fatal, just won't be cached this time
    }
    return runs;
  }

  // The "position officielle" shown under the panel title (2026-09-22) -
  // among real Tower leaderboard runs of this class, the best (lowest)
  // rank whose equipped skills "confirm" this build's title. Same
  // subset-match principle as app/consensus.py's _leaderboard_confirmations
  // (a skill's own tokens must ALL be in the title's signature - not just
  // overlap - so a single shared generic word can't count as a match), and
  // the same Imbuement/Subterfuge exclusion as app/leaderboard.py's
  // GENERIC_UTILITY_TYPES (those skills are on almost every build of a
  // class regardless of identity - see that file's comment for the
  // concrete false-positive example that led to excluding them).
  async function bestOfficialRank(gameClass, title) {
    const runs = await fetchTowerRuns();
    const titleSig = signature(title);
    let best = null;
    for (const run of runs) {
      if (run.gameClass !== gameClass) continue;
      const confirmed = (run.skills || []).some(
        (s) => !GENERIC_UTILITY_SKILL_TYPES.has(s.type) && isNonEmptySubset(skillTokens(s.name), titleSig)
      );
      if (!confirmed) continue;
      if (best === null || (run.rank ?? Infinity) < (best.rank ?? Infinity)) best = run;
    }
    return best ? { rank: best.rank, battleTag: best.battleTag, tier: best.tier } : null;
  }

  // "Comparer les variantes" (demande utilisateur 2026-09-22) - combien
  // des joueurs réels du classement officiel (déjà récupérés par
  // fetchTowerRuns ci-dessus) utilisent une compétence donnée, pour
  // objectiver un choix entre deux variantes qui ne diffèrent que par
  // UNE compétence. Comparaison par nom exact (replié/normalisé), pas
  // par sous-ensemble de mots comme bestOfficialRank - ici on compare
  // deux noms de compétence précis l'un à l'autre (déjà extraits
  // proprement), pas un nom de compétence à un titre de build en texte
  // libre, donc pas besoin de la tolérance du sous-ensemble.
  function countPlayersUsingSkill(runs, gameClass, skillName) {
    const target = fold(skillName);
    const classRuns = runs.filter((r) => r.gameClass === gameClass);
    const count = classRuns.filter((r) => (r.skills || []).some((s) => fold(s.name) === target)).length;
    return { count, total: classRuns.length };
  }

  const HOSTNAME_TO_SOURCE = {
    "kami-labs.fr": "kamilabs",
    "maxroll.gg": "maxroll",
    "www.maxroll.gg": "maxroll",
    "d4builds.gg": "d4builds",
    "d4guides.gg": "d4guides",
    "www.talion.tv": "talion",
    "infinitybuilds.gg": "infinitybuilds",
  };

  function currentSourceId() {
    return HOSTNAME_TO_SOURCE[location.hostname] || null;
  }

  const SOURCE_LABELS = {
    kamilabs: "kami-labs",
    maxroll: "Maxroll",
    infinitybuilds: "InfinityBuilds",
    d4builds: "D4Builds",
    d4guides: "D4Guides",
    talion: "talion.tv",
  };

  // Liens croisés vers les autres sites (2026-09-22) - si ce même build
  // (matché par similarité de titre, même logique/seuil que
  // findBestTitleMatch ailleurs dans ce fichier) est aussi listé sur
  // d'autres sites que celui-ci, donne un lien direct plutôt que de
  // laisser l'utilisateur chercher lui-même.
  async function findCrossSiteLinks(title, gameClass) {
    const self = currentSourceId();
    const fetchers = [
      ["infinitybuilds", fetchInfinityBuildsBuilds()],
      ["kamilabs", fetchKamiLabsBuilds(CURRENT_SEASON)],
      ["maxroll", fetchMaxrollBuilds()],
      ["d4builds", fetchD4BuildsBuilds()],
      ["d4guides", fetchD4GuidesBuilds(CURRENT_SEASON)],
      ["talion", fetchTalionBuilds()],
    ].filter(([source]) => source !== self);

    const results = await Promise.allSettled(fetchers.map(([, p]) => p));
    const links = [];
    results.forEach((r, i) => {
      if (r.status !== "fulfilled") return;
      const [source] = fetchers[i];
      const match = findBestTitleMatch(r.value, title, gameClass);
      if (match) links.push({ source, title: match.title, url: match.url });
    });
    return links;
  }

  // Orchestrates both halves of the "build info" section and renders it -
  // called automatically from init() on every build page, not gated
  // behind a button (that's the point of the feature: the info should
  // just be there when browsing a build). Silent (empty section) when no
  // class is detected at all - an error message on every ordinary page
  // load would be noisier than useful, unlike the Classement button's
  // explicit click-triggered error messages.
  // ---------------------------------------------------------------------
  // "Mes Builds" (demande utilisateur 2026-09-22) - mémorise, par classe,
  // le dernier build consulté sur n'importe lequel des 6 sites suivis par
  // ce script, pour le retrouver facilement plus tard via le menu
  // déroulant sous "Recherche de traduction". GM_setValue (pas
  // localStorage, qui serait isolé par site) puisque c'est justement du
  // stockage partagé entre tous ces sites qu'il faut ici - même choix que
  // le cache du classement officiel juste au-dessus.
  // ---------------------------------------------------------------------
  const MY_BUILDS_KEY = "d4a_my_builds";

  function getMyBuilds() {
    try {
      return JSON.parse(GM_getValue(MY_BUILDS_KEY, "{}"));
    } catch (e) {
      return {};
    }
  }

  function recordBuildVisit(gameClass, title, url) {
    if (!gameClass || !title || !url) return;
    const all = getMyBuilds();
    all[gameClass] = { title, url, visitedAt: Date.now() };
    GM_setValue(MY_BUILDS_KEY, JSON.stringify(all));
  }

  function renderMyBuildForClass(gameClass) {
    const resultEl = document.getElementById("d4a-mybuilds-result");
    if (!resultEl) return;
    if (!gameClass) {
      resultEl.innerHTML = "";
      return;
    }
    const entry = getMyBuilds()[gameClass];
    if (!entry) {
      resultEl.innerHTML = `<p class="d4a-rank-meta">Aucun build consulté pour cette classe pour l'instant.</p>`;
      return;
    }
    const when = new Date(entry.visitedAt).toLocaleDateString("fr-FR");
    resultEl.innerHTML = `<p><a href="${entry.url}" target="_blank" rel="noopener noreferrer">${entry.title}</a><br><span class="d4a-rank-meta">consulté le ${when}</span></p>`;
  }

  async function renderBuildInfo() {
    const section = document.getElementById("d4a-buildinfo-section");
    if (!section) return;
    const title = guessTitle();
    const gameClass = guessClass();
    if (!gameClass) {
      section.innerHTML = "";
      return;
    }
    recordBuildVisit(gameClass, title, location.href);
    section.innerHTML = "Recherche de la position officielle...";

    const [rank, links] = await Promise.all([
      bestOfficialRank(gameClass, title).catch(() => null),
      findCrossSiteLinks(title, gameClass).catch(() => []),
    ]);

    const rankHtml = rank
      ? `🏆 <a href="${TOWER_URL}" target="_blank" rel="noopener noreferrer">#${rank.rank} au classement officiel</a> (${rank.battleTag || "joueur anonyme"})`
      : "Aucun joueur du classement officiel identifié avec ce build.";

    const linksHtml = links.length
      ? "Aussi vu sur : " + links.map((l) => `<a href="${l.url}" target="_blank" rel="noopener noreferrer">${SOURCE_LABELS[l.source] || l.source}</a>`).join(" · ")
      : "";

    section.innerHTML = `<div>${rankHtml}</div>${linksHtml ? `<div>${linksHtml}</div>` : ""}`;
  }

  // ---------------------------------------------------------------------
  // Loot filter binary encoding - ported from app/loot_filter/codec.py
  // (itself a port of Upsilon72/d4-filter-generator, MIT-style credit:
  // "Research and reverse-engineering by Upsilon72 with Claude"). Numbers
  // here stay within the 32-bit range these IDs/colors actually use, so
  // plain JS bitwise ops (unsigned via >>>) are enough - no BigInt needed.
  // ---------------------------------------------------------------------
  const SHOW = 0, RECOLOR = 2, HIDE_ALL = 3;
  const COMMON = 0x01, MAGIC = 0x02, RARE = 0x04, LEGENDARY = 0x08, UNIQUE = 0x10, MYTHIC = 0x20, TALISMAN = 0x40;
  const LEGENDARY_PLUS = LEGENDARY | UNIQUE | MYTHIC | TALISMAN;
  const ALL_RARITIES = 0x7f;
  const CHARM = 0x00237e80, SEAL = 0x0022ed05;

  function encodeVarint(value) {
    value = value >>> 0;
    const out = [];
    while (true) {
      const byte = value & 0x7f;
      value = value >>> 7;
      if (value) {
        out.push(byte | 0x80);
      } else {
        out.push(byte);
        return out;
      }
    }
  }

  function fieldVarint(fieldNo, value) {
    return encodeVarint((fieldNo << 3) | 0).concat(encodeVarint(value));
  }

  function fieldFixed32(fieldNo, value) {
    value = value >>> 0;
    return encodeVarint((fieldNo << 3) | 5).concat([value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff]);
  }

  function fieldBytes(fieldNo, dataBytes) {
    return encodeVarint((fieldNo << 3) | 2).concat(encodeVarint(dataBytes.length)).concat(dataBytes);
  }

  function fieldString(fieldNo, value) {
    return fieldBytes(fieldNo, Array.from(new TextEncoder().encode(value)));
  }

  function makeColor(r, g, b, a = 255) {
    return ((a << 24) | (b << 16) | (g << 8) | r) >>> 0;
  }

  const COLOR_DEFAULT = 0xffff0000;
  const COLOR_CYAN = makeColor(0, 255, 255);
  const COLOR_GREEN = makeColor(0, 200, 0);
  const COLOR_ORANGE = makeColor(255, 140, 0);
  const COLOR_GOLD = makeColor(255, 215, 0);

  function conditionRarity(mask) {
    return fieldBytes(4, fieldVarint(1, 1).concat(fieldVarint(4, mask)));
  }
  function conditionGreaterAffix(count) {
    return fieldBytes(4, fieldVarint(1, 3).concat(fieldVarint(6, count)));
  }
  function conditionCodexUpgrade() {
    return fieldBytes(4, fieldVarint(1, 4).concat(fieldVarint(4, 1)).concat(fieldVarint(6, 1)));
  }
  function conditionAffixes(affixIds, requiredCount) {
    let inner = fieldVarint(1, 6);
    for (const id of affixIds) inner = inner.concat(fieldFixed32(2, id));
    inner = inner.concat(fieldVarint(4, requiredCount));
    return fieldBytes(4, inner);
  }
  function conditionItemTypes(typeIds) {
    let inner = fieldVarint(1, 5);
    for (const id of typeIds) inner = inner.concat(fieldFixed32(2, id));
    return fieldBytes(4, inner);
  }
  function makeRule(name, visibility, conditions, color = COLOR_DEFAULT) {
    let body = fieldString(1, name).concat(fieldVarint(2, visibility)).concat(fieldFixed32(3, color));
    for (const cond of conditions) body = body.concat(cond);
    body = body.concat(fieldVarint(5, 1));
    return fieldBytes(1, body);
  }
  function makeFilter(name, rules) {
    let body = [];
    for (const r of rules) body = body.concat(r);
    body = body.concat(fieldString(2, name)).concat(fieldVarint(3, rules.length)).concat(fieldVarint(4, 1));
    let binary = "";
    for (const b of body) binary += String.fromCharCode(b);
    return btoa(binary);
  }

  // Ported from app/loot_filter/data.py - only Warlock's skill-category
  // affix ids are confirmed (Upsilon72's own README calls the rest
  // "pending confirmation"); every other class lists its skills with
  // `null` so unresolved ones are reported rather than silently dropped.
  const SKILL_AFFIX_IDS = {
    warlock: {
      "Hellfire Skills": 0x0026adc4, "Occult Skills": 0x0026adc6, "Demonology Skills": 0x0026adcd,
      "Sigil of Chaos": 0x0026adc2, "Sigil of Summons": 0x0026adc8, "Sigil of Subversion": 0x0026ad87,
      "Blazing Scream": 0x0026ad89, "Bombardment": 0x0026ad8b, "Rampage": 0x0026ad7e,
      "Tyrant's Grasp": 0x0026ad46, "Dread Claws": 0x0026ad48, "Hell Fracture": 0x00273c0a,
      "Abyss Skills": 0x0026ad42,
    },
    barbarian: { "Bash": null, "Whirlwind": null, "Hammer of the Ancients": null, "Leap": null, "Rend": null, "Weapon Mastery Skills": null },
    druid: { "Landslide": null, "Tornado": null, "Pulverize": null, "Shred": null, "Wolves": null },
    necromancer: { "Bone Spear": null, "Blood Surge": null, "Corpse Explosion": null, "Bone Skills": null, "Blood Skills": null },
    rogue: { "Twisting Blades": null, "Rapid Fire": null, "Penetrating Shot": null, "Marksman Skills": null, "Cutthroat Skills": null },
    sorcerer: { "Fireball": null, "Ice Shards": null, "Chain Lightning": null, "Blizzard": null, "Frost Skills": null, "Pyromancy Skills": null, "Shock Skills": null },
    spiritborn: { "Quill Volley": null, "Soar": null, "Thunderspike": null, "Eagle Skills": null, "Jaguar Skills": null },
    paladin: {},
  };
  const GENERIC_SKILL_AFFIX_IDS = { "Core Skills": 0x001d6e31, "All Skills": 0x0026ad83 };

  // Ported from app/loot_filter/data.py - the 77 universal (any-class) stat
  // affix ids, added 2026-09-20 so a build's actual "Stat Priority" list
  // (read directly off whichever site shows one, e.g. D4Builds) can drive
  // real 2-affix/3-affix filter rules instead of skills alone.
  // fmt: off
  const AFFIX_IDS = {
    "Weapon Damage": 0x0027fc93, "Strength": 0x001beac2, "Intelligence": 0x001beabe,
    "Willpower": 0x001beab4, "Dexterity": 0x001beaba, "Thorns": 0x001beb22,
    "All Damage Multiplier": 0x001beac6, "Attack Speed": 0x001beace, "Critical Strike Chance": 0x001bead2,
    "Critical Strike Damage Multiplier": 0x001bead4, "Vulnerable Damage Multiplier": 0x001bfc80,
    "Damage Over Time Multiplier": 0x001bead6, "Cold Damage Multiplier": 0x00270af5,
    "Fire Damage Multiplier": 0x00270af7, "Holy Damage Multiplier": 0x00270aff,
    "Lightning Damage Multiplier": 0x00270afd, "Physical Damage Multiplier": 0x00270ad0,
    "Poison Damage Multiplier": 0x00270afb, "Shadow Damage Multiplier": 0x00270af9,
    "Maximum Life": 0x001bead8, "Life Regeneration": 0x001beada, "Life On Hit": 0x001d5e13,
    "Life on Kill": 0x0025da8c, "Armor": 0x001beab2, "Resistance to All Elements": 0x001bfd38,
    "Fire Resistance": 0x001beaee, "Cold Resistance": 0x001beb2e, "Lightning Resistance": 0x001beaf2,
    "Poison Resistance": 0x001beaf4, "Shadow Resistance": 0x001beaf6, "Physical Resistance": 0x002557e4,
    "Damage Reduction": 0x001d6e63, "Dodge Chance": 0x001bfc85, "Maximum Resource": 0x001bfc79,
    "Energy Regeneration": 0x001d5e30, "Essence Regeneration": 0x001d5e3a, "Fury Regeneration": 0x001d5e38,
    "Mana Regeneration": 0x001d5e36, "Spirit Regeneration": 0x001d5e33, "Vigor Regeneration": 0x001eb549,
    "Faith Regeneration": 0x002674b9, "Wrath Regeneration": 0x0026a37c, "Energy On Kill": 0x001d5e25,
    "Essence On Kill": 0x001d5e27, "Fury On Kill": 0x001d5e29, "Mana On Kill": 0x001d5e2b,
    "Spirit On Kill": 0x001d5e2d, "Vigor On Kill": 0x001eb481, "Faith On Kill": 0x002674bb,
    "Wrath every 10 Kills": 0x0026a374, "Resource Cost Reduction": 0x001d3a0f, "Resource Generation": 0x001beb20,
    "Lucky Hit Restore Primary Resource": 0x0024527f, "Potion Capacity": 0x001beae2, "Lucky Hit Chance": 0x001beadc,
    "Healing Received": 0x001bfcbf, "Fortify Generation": 0x00266b1e, "Barrier Generation": 0x00266b22,
    "Movement Speed": 0x001beade, "Attacks Reduce Evade Cooldown": 0x0026c56c, "Maximum Evade Charge": 0x0026c56e,
    "Evade Grants Movement Speed": 0x0026c570,
  };
  // fmt: on

  // A few affixes are shown with a class-specific display name in-game
  // (found on Rogue: crit chance is labelled "Deadly Strike Chance", not
  // "Critical Strike Chance") - mapped to the underlying universal name.
  const AFFIX_SYNONYMS = { "deadly strike chance": "Critical Strike Chance" };

  const AFFIX_IDS_BY_LOWER_NAME = new Map();
  for (const name of Object.keys(AFFIX_IDS)) AFFIX_IDS_BY_LOWER_NAME.set(name.toLowerCase(), name);

  // Turns a free-text "Stat Priority" entry (e.g. "x28% Vulnerable Damage
  // Multiplier", "Ranks to Imbuement Skills", "Unique Effect") into one of
  // our known affix names, or null when it doesn't match anything we can
  // filter on (skill-category text like "Ranks to X Skills" almost never
  // matches - most classes have no confirmed skill-affix ids yet anyway,
  // see SKILL_AFFIX_IDS above; "Unique Effect", "+1 Charm Slot" etc. aren't
  // real filterable affixes at all).
  function normalizeAffixText(raw) {
    const cleaned = raw
      .replace(/^[+x]?\d+%?\s*/i, "")
      .trim()
      .toLowerCase();
    if (AFFIX_SYNONYMS[cleaned]) return AFFIX_SYNONYMS[cleaned];
    return AFFIX_IDS_BY_LOWER_NAME.get(cleaned) || null;
  }

  // Reads whichever "Stat Priority" (or similarly-named) section the
  // CURRENT page shows for this build - found on D4Builds (a numbered
  // priority list per gear slot, e.g. "1. Dexterity", "2. Maximum Life"),
  // not all sites/builds have this (author-dependent - see HISTORIQUE.md,
  // investigated 2026-09-20 across InfinityBuilds/D4Guides/D4Builds and
  // found none of them expose this reliably as structured data). Since
  // D4's native filter format can only say "a Rare item has >=N of THESE
  // affixes" - not "this specific slot's item has these affixes" - every
  // numbered mention across every slot is pooled into one flat, deduped
  // list rather than kept per-slot.
  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function findPriorityAffixIds() {
    const tabCandidate = Array.from(document.querySelectorAll("*")).find(
      (e) => e.children.length === 0 && e.textContent.trim().toLowerCase() === "stat priority"
    );
    if (tabCandidate) {
      for (const target of [tabCandidate, tabCandidate.parentElement, tabCandidate.parentElement?.parentElement]) {
        if (target) target.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      }
      await sleep(1200); // let the tab's content actually render before reading it
    }

    const text = document.body.innerText;
    const ids = new Set();
    const matchedNames = new Set();
    for (const m of text.matchAll(/^\s*\d+\.\s*(.+)$/gm)) {
      const name = normalizeAffixText(m[1]);
      if (name && AFFIX_IDS[name]) {
        matchedNames.add(name);
        ids.add(AFFIX_IDS[name]);
      }
    }
    return { ids: Array.from(ids), names: Array.from(matchedNames) };
  }

  function resolveSkillIds(gameClass, skillNamesList) {
    const classSkills = SKILL_AFFIX_IDS[gameClass] || {};
    const ids = [];
    const unresolved = [];
    for (const name of skillNamesList) {
      let id = Object.prototype.hasOwnProperty.call(classSkills, name) ? classSkills[name] : undefined;
      if (id == null) id = GENERIC_SKILL_AFFIX_IDS[name];
      if (id != null) ids.push(id);
      else unresolved.push(name);
    }
    return { ids, unresolved };
  }

  // Port of app/loot_filter/generator.py's generate_filter_code, extended
  // 2026-09-20 with two-tier Rare-item matching (2+ / 3+ build-relevant
  // affixes, gold outranking orange) instead of one loose ">=1" check -
  // requested so a barely-relevant Rare and a near-perfect one don't look
  // the same. `priorityAffixIds` comes from findPriorityAffixIds() (the
  // current page's own "Stat Priority" list, when it has one) and is
  // pooled together with the build's skill affixes - D4's native filter
  // format can only ask "does this Rare have >=N of THESE affixes",
  // regardless of which slot it's for, so there's no way to keep this
  // genuinely per-piece even though the source data is.
  function generateFilterCode(filterName, gameClass, skillNamesList, priorityAffixIds = []) {
    const { ids: skillIds, unresolved } = resolveSkillIds(gameClass, skillNamesList);
    const allBuildIds = Array.from(new Set([...skillIds, ...priorityAffixIds]));

    const rules = [];
    rules.push(makeRule("Legendary Talismans", SHOW, [conditionRarity(LEGENDARY_PLUS), conditionItemTypes([CHARM, SEAL])]));
    rules.push(makeRule("Hide Junk", HIDE_ALL, [conditionRarity(COMMON | MAGIC | RARE)]));
    if (allBuildIds.length >= 2) {
      rules.push(makeRule("Check Rare - 2+ Build Affixes", RECOLOR, [conditionRarity(RARE), conditionAffixes(allBuildIds, 2)], COLOR_ORANGE));
    }
    if (allBuildIds.length >= 3) {
      // Comes AFTER (so higher priority than, per make_filter's ordering
      // convention) the 2+ rule, so a Rare matching 3+ shows gold instead
      // of being caught by the orange rule first.
      rules.push(makeRule("Check Rare - 3+ Build Affixes (BiS)", RECOLOR, [conditionRarity(RARE), conditionAffixes(allBuildIds, 3)], COLOR_GOLD));
    } else if (allBuildIds.length === 1) {
      // Only one affix known in total - a ">=2" requirement could never
      // match anything, so fall back to the simple ">=1" check rather
      // than generating a rule that's silently dead on arrival.
      rules.push(makeRule("Check Rare - Build Affix", RECOLOR, [conditionRarity(RARE), conditionAffixes(allBuildIds, 1)], COLOR_ORANGE));
    }
    rules.push(makeRule("Codex Upgrade", RECOLOR, [conditionCodexUpgrade()], COLOR_GREEN));
    rules.push(makeRule("Legendaries - Keep All", RECOLOR, [conditionRarity(LEGENDARY_PLUS)], COLOR_GREEN));
    rules.push(makeRule("Greater Affix - Loot", RECOLOR, [conditionGreaterAffix(1)], COLOR_CYAN));
    rules.push(makeRule("Show All - Catch All", SHOW, [conditionRarity(ALL_RARITIES)]));
    return { code: makeFilter(filterName, rules), unresolvedSkills: unresolved, resolvedAffixCount: allBuildIds.length };
  }

  // ---------------------------------------------------------------------
  // UI - unchanged in spirit from v1 (floating button, top-left panel).
  // ---------------------------------------------------------------------
  function injectStyles() {
    const style = document.createElement("style");
    style.textContent = `
      /* Palette/layout copied from the user's other project (Esprit
         Donghua Continuum, E:\\EspritDonghua-Script - buildPersistentPanel()
         and ensurePanelToggleButton()) at their request 2026-09-21, rather
         than inventing a new look: one small hamburger toggle button, one
         dark flex-column panel holding the title, all actions, and the
         result sections as plain stacked children (flex default
         align-items:stretch already makes every child full-width, no
         explicit width needed - same trick their panel relies on). */
      #d4a-toggle-btn {
        position: fixed; top: 10px; left: 10px; z-index: 999999;
        background: #15151f; color: #eee; border: none; border-radius: 6px;
        width: 34px; height: 34px; cursor: pointer; font-size: 16px;
        box-shadow: 0 2px 8px rgba(0,0,0,.4);
      }
      #d4a-column {
        position: fixed; top: 54px; left: 10px; z-index: 999998;
        background: #15151f; color: #eee; padding: 12px;
        box-shadow: 0 2px 8px rgba(0,0,0,.4); border-radius: 8px;
        display: flex; flex-direction: column; gap: 8px;
        width: 280px; max-height: calc(100vh - 70px); overflow-y: auto;
        font-family: system-ui, sans-serif; font-size: 13px; line-height: 1.5;
      }
      #d4a-column-title { font-weight: bold; color: #03d0fc; font-size: 13px; }
      #d4a-column > button, #d4a-search-form button {
        background: #333; color: #fff; border: none; padding: 6px 10px;
        border-radius: 4px; cursor: pointer; font-size: 11px; font-family: system-ui, sans-serif;
      }
      #d4a-panel-section:empty, #d4a-ranking-section:empty, #d4a-buildinfo-section:empty { display: none; }
      #d4a-buildinfo-section { font-size: 11px; color: #9aa0ab; margin: -2px 0 4px; line-height: 1.5; }
      #d4a-buildinfo-section a { color: #03d0fc; }
      #d4a-column h3 { margin: 0 0 8px; font-size: 15px; color: #eee; }
      #d4a-column .d4a-close { float: right; cursor: pointer; color: #9aa0ab; }
      #d4a-column .d4a-chip-list { display: flex; flex-wrap: wrap; gap: 4px; margin: 6px 0 10px; }
      #d4a-column .d4a-chip { background: #000; border: 1px solid #333; border-radius: 10px; padding: 2px 8px; font-size: 12px; }
      #d4a-column textarea {
        width: 100%; font-family: monospace; font-size: 11px; background: #000;
        color: #eee; border: 1px solid #333; border-radius: 6px; padding: 6px; resize: vertical;
      }
      #d4a-column button.d4a-copy { background: #03d0fc; color: #000; font-weight: bold; }
      #d4a-column a { color: #03d0fc; }
      #d4a-item-tooltip {
        position: fixed; z-index: 1000000; max-width: 260px;
        background: #15151f; color: #eee; border: 1px solid #333;
        border-radius: 8px; padding: 8px 10px; box-shadow: 0 6px 20px rgba(0,0,0,.4);
        font-family: system-ui, sans-serif; font-size: 12px; line-height: 1.4;
        pointer-events: none;
      }
      #d4a-item-tooltip .d4a-uber { color: #ffb300; font-weight: 600; }
      /* ~7 rows visible (52px each) before scrolling, per the requested "7 then scroll to top 30". */
      #d4a-rank-list { max-height: 364px; overflow-y: auto; }
      .d4a-rank-row { padding: 6px 0; border-bottom: 1px solid #333; }
      .d4a-rank-row:last-child { border-bottom: none; }
      .d4a-rank-meta { color: #9aa0ab; font-size: 11px; }
      .d4a-tier-badge { display: inline-block; font-weight: 700; font-size: 10px; padding: 1px 5px; border-radius: 3px; color: #fff; margin-right: 3px; }
      .d4a-rank-links { font-size: 11px; }
      .d4a-rank-links a { color: #03d0fc; margin-right: 4px; }
      #d4a-search-section { border-top: 1px solid #333; padding-top: 8px; }
      #d4a-mybuilds-section { border-top: 1px solid #333; padding-top: 8px; }
      #d4a-mybuilds-select {
        width: 100%; margin: 6px 0; padding: 6px 8px; border-radius: 4px; border: none;
        background: #000; color: #eee; font-size: 12px;
      }
      #d4a-mybuilds-result p { margin: 0; }
      #d4a-search-form { display: flex; gap: 6px; margin: 6px 0 10px; }
      #d4a-search-form input {
        flex: 1; min-width: 0; padding: 6px 8px; border-radius: 4px; border: none;
        background: #000; color: #eee; font-size: 12px;
      }
      #d4a-search-results { max-height: 300px; overflow-y: auto; }
      .d4a-search-row { padding: 6px 0; border-bottom: 1px solid #333; }
      .d4a-search-row:last-child { border-bottom: none; }
      .d4a-search-source { color: #9aa0ab; font-size: 11px; }
    `;
    document.head.appendChild(style);
  }

  // "Hover a translated item name -> see where it drops" - the small
  // amount of DOM plumbing (element + listeners) is set up once in
  // init(); this just positions/fills it. Delegated on document.body
  // rather than attached per-span, since spans get replaced on every
  // MutationObserver pass (see translateTextIn's observer).
  function setupItemSourceTooltip() {
    const tooltip = document.createElement("div");
    tooltip.id = "d4a-item-tooltip";
    tooltip.hidden = true;
    document.body.appendChild(tooltip);

    document.body.addEventListener("mouseover", (e) => {
      const target = e.target.closest && e.target.closest("[data-d4a-en]");
      if (!target) return;
      const info = lookupItemSource(target.dataset.d4aEn);
      if (!info) return;

      const bossLine = info.bossFr.length ? info.bossFr.join(", ") : "Source inconnue";
      tooltip.innerHTML = `📍 ${bossLine}${info.uber ? '<br><span class="d4a-uber">⚜ Objet mythique</span>' : ""}`;
      const rect = target.getBoundingClientRect();
      tooltip.style.left = `${Math.round(rect.left)}px`;
      tooltip.style.top = `${Math.round(rect.bottom + 6)}px`;
      tooltip.hidden = false;
    });

    document.body.addEventListener("mouseout", (e) => {
      const target = e.target.closest && e.target.closest("[data-d4a-en]");
      if (!target) return;
      if (e.relatedTarget && target.contains(e.relatedTarget)) return;
      tooltip.hidden = true;
    });
  }

  // The column auto-expands whenever either section gets new content - a
  // user who collapsed it earlier and then clicks a button again clearly
  // wants to see the result, not have it silently render underneath a
  // hidden body.
  function expandColumn() {
    const column = document.getElementById("d4a-column");
    const toggleBtn = document.getElementById("d4a-toggle-btn");
    if (column) column.style.display = "flex";
    if (toggleBtn) toggleBtn.textContent = "✕";
  }

  function renderPanel(html) {
    const section = document.getElementById("d4a-panel-section");
    section.innerHTML = `<span class="d4a-close" id="d4a-close">✕</span>${html}`;
    document.getElementById("d4a-close").onclick = () => { section.innerHTML = ""; };
    expandColumn();
  }

  function renderRankingPanel(html) {
    const section = document.getElementById("d4a-ranking-section");
    section.innerHTML = `<span class="d4a-close" id="d4a-ranking-close">✕</span>${html}`;
    document.getElementById("d4a-ranking-close").onclick = () => { section.innerHTML = ""; };
    expandColumn();
  }

  function chipList(items) {
    if (!items || items.length === 0) return "<em>aucun</em>";
    return `<div class="d4a-chip-list">${items.map((i) => `<span class="d4a-chip">${i}</span>`).join("")}</div>`;
  }

  // ---------------------------------------------------------------------
  // Native extraction for the CURRENT page (kami-labs/Maxroll) - see the
  // v2.1 docstring at the top of this file. extractNativeDetail() returns
  // null (never throws) whenever the current site isn't one of these two,
  // or the expected embed isn't found - callers fall back to the older
  // InfinityBuilds title-matching path in that case.
  // ---------------------------------------------------------------------

  // Finds the JSON object value that starts right after `marker` (e.g.
  // `"search_metadata":`) by counting brace depth - a plain non-greedy
  // regex (`\{.*?\}`) stops at the FIRST inner "}" and truncates nested
  // objects/arrays, which both blobs here have plenty of.
  function extractJsonAfter(text, marker) {
    const markerIdx = text.indexOf(marker);
    if (markerIdx === -1) return null;
    const start = text.indexOf("{", markerIdx);
    if (start === -1) return null;
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let i = start; i < text.length; i++) {
      const c = text[i];
      if (inString) {
        if (escaped) escaped = false;
        else if (c === "\\") escaped = true;
        else if (c === '"') inString = false;
        continue;
      }
      if (c === '"') inString = true;
      else if (c === "{") depth++;
      else if (c === "}") {
        depth--;
        if (depth === 0) return text.slice(start, i + 1);
      }
    }
    return null;
  }

  // Reverse lookup into FR_EN_DICTIONARY (built for title-matching, see
  // signature() above) - repurposed here as a best-effort EN->FR
  // translator for Maxroll, which has no FR site of its own to pair
  // against directly the way kami-labs does.
  let enToFrLookup = null;
  function lookupFr(en) {
    if (!enToFrLookup) {
      enToFrLookup = new Map();
      for (const entry of FR_EN_DICTIONARY) {
        const key = (entry.en || "").toLowerCase();
        if (key && !enToFrLookup.has(key)) enToFrLookup.set(key, entry.fr);
      }
    }
    return enToFrLookup.get(en.toLowerCase()) || en;
  }

  let itemSourceLookup = null;

  // Returns {bossFr: string[], uber: boolean} for a known Unique's English
  // name, or null if it's not a Unique we have source data for (e.g. it's
  // an aspect or skill name, not an item).
  function lookupItemSource(en) {
    if (!itemSourceLookup) {
      itemSourceLookup = new Map();
      for (const key of Object.keys(UNIQUE_ITEM_SOURCES)) {
        itemSourceLookup.set(key.toLowerCase(), UNIQUE_ITEM_SOURCES[key]);
      }
    }
    return itemSourceLookup.get((en || "").toLowerCase()) || null;
  }

  async function extractKamiLabsDetail() {
    const iframe = document.getElementById("esrd-equipment-iframe");
    const buildId = iframe && iframe.getAttribute("data-build-id");
    if (!buildId) return null;

    const url = `https://kami-labs.fr/wp-content/uploads/d4-builds/${buildId}/equipment-grid.html?embed=1`;
    let html;
    try {
      html = await gmGet(url);
    } catch (e) {
      return null;
    }

    const jsonText = extractJsonAfter(html, "window.ESRD_STATE_V3");
    if (!jsonText) return null;
    let state;
    try {
      state = JSON.parse(jsonText);
    } catch (e) {
      return null;
    }
    const steps = state.steps;
    if (!Array.isArray(steps) || steps.length === 0) return null;
    const step = steps[steps.length - 1]; // most endgame-complete variant

    const skillsEn = [];
    const skillsFr = [];
    for (const s of step.skills || []) {
      if (!s || !s.name_en) continue;
      skillsEn.push(s.name_en);
      skillsFr.push(s.name_fr || s.name_en);
    }

    const itemsEn = [];
    const itemsFr = [];
    for (const slot of Object.values(step.slots || {})) {
      if (!slot || !slot.name) continue;
      itemsEn.push(slot.name);
      itemsFr.push(slot.nameFr || slot.name);
    }
    if (skillsEn.length === 0 && itemsEn.length === 0) return null;

    return { sourceLabel: "kami-labs", sourceUrl: location.href, skillsEn, skillsFr, itemsEn, itemsFr };
  }

  // Reads the equipment paperdoll widget already embedded on the CURRENT
  // Maxroll guide page (mounted into a `.d4t-embed-host` div by their own
  // "d3-planner-embed" script - same-document DOM, no iframe/shadow DOM,
  // nothing cross-origin to fight) - found 2026-09-21 investigating why
  // some items stayed untranslated despite a fix for generated item names
  // (see findEmbeddedAspectPairs). CSS module class carries a redeploy-
  // dependent hash suffix (same convention as the tier list's
  // `_Tierlist__tier_*`), matched by prefix rather than full class name.
  // Reflects whatever step (Starter/Midgame/Endgame/...) the widget is
  // CURRENTLY showing - unlike the separate planner-page fetch below,
  // which only ever gets one fixed step server-side, not necessarily the
  // one being viewed (confirmed: that mismatch is exactly what was
  // causing items like "Debilitating Toxins" to go untranslated even
  // though a dictionary entry existed for it).
  function extractMaxrollEquipmentFromDom() {
    return Array.from(document.querySelectorAll('[class*="equipment_Slot__title__"]'))
      .map((el) => el.textContent.trim())
      .filter(Boolean);
  }

  // The widget can still be mounting when the user clicks a button right
  // after the page loads - poll briefly rather than giving up on the
  // first (possibly premature) empty read.
  async function waitForMaxrollEquipmentDom(maxWaitMs = 3000, intervalMs = 300) {
    const start = Date.now();
    while (Date.now() - start < maxWaitMs) {
      const items = extractMaxrollEquipmentFromDom();
      if (items.length > 0) return items;
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
    return extractMaxrollEquipmentFromDom();
  }

  async function extractMaxrollDetail() {
    const pageHtml = document.documentElement.outerHTML;
    const plannerIds = new Set();
    const idRe = /d4\/planner\/([a-z0-9]{4,})/gi;
    let idMatch;
    while ((idMatch = idRe.exec(pageHtml))) {
      const id = idMatch[1];
      if (id.toLowerCase() !== "builds") plannerIds.add(id); // "/d4/planner/builds" is the site's own nav link, not a build id
    }
    if (plannerIds.size === 0) return null;
    const plannerId = plannerIds.values().next().value;
    const plannerUrl = `https://maxroll.gg/d4/planner/${plannerId}`;

    // Run the DOM wait and the network fetch concurrently - the DOM read
    // is only needed for items (more accurate, see above); skills still
    // come from the planner fetch, nothing better found for those yet.
    const domItemsPromise = waitForMaxrollEquipmentDom();

    let html = null;
    try {
      html = await gmGet(plannerUrl);
    } catch (e) {
      // fall through - the DOM read alone can still be enough for items
    }
    let meta = null;
    if (html) {
      const jsonText = extractJsonAfter(html, '"search_metadata":');
      if (jsonText) {
        try {
          meta = JSON.parse(jsonText);
        } catch (e) {
          // fall through
        }
      }
    }

    const skillsEn = meta && Array.isArray(meta.skills) ? meta.skills : [];
    const domItems = await domItemsPromise;
    const itemsEn = domItems.length ? domItems : meta && Array.isArray(meta.items) ? meta.items : [];
    if (skillsEn.length === 0 && itemsEn.length === 0) return null;

    return {
      sourceLabel: "Maxroll",
      sourceUrl: plannerUrl,
      skillsEn,
      itemsEn,
      skillsFr: skillsEn.map(lookupFr),
      itemsFr: itemsEn.map(lookupFr),
    };
  }

  async function extractNativeDetail() {
    if (location.hostname === "kami-labs.fr") return extractKamiLabsDetail();
    if (location.hostname === "maxroll.gg" || location.hostname === "www.maxroll.gg") return extractMaxrollDetail();
    return null;
  }

  // Shared by both buttons: finds the equivalent InfinityBuilds/kami-labs
  // build and reads its gear/skills (EN for filter matching, FR for
  // display) - the slow, shared part (background tabs). Returns null if
  // no InfinityBuilds match was found at all (nothing further to show).
  async function resolveTranslation() {
    const title = guessTitle();
    const gameClass = guessClass();

    let native = null;
    try {
      native = await extractNativeDetail();
    } catch (e) {
      // ignore - falls back to InfinityBuilds matching below
    }
    if (native) {
      return {
        title,
        match: { title, url: native.sourceUrl },
        resolvedClass: gameClass,
        skillsEn: native.skillsEn,
        itemsEn: native.itemsEn,
        skillsFr: native.skillsFr,
        itemsFr: native.itemsFr,
        hasDetail: true,
        kamilabsMatch: null,
        sourceLabel: native.sourceLabel,
      };
    }

    const [ibBuilds, kamiBuilds] = await Promise.all([fetchInfinityBuildsBuilds(), fetchKamiLabsBuilds(CURRENT_SEASON)]);

    const match = findBestTitleMatch(ibBuilds, title, gameClass);
    if (!match) return { title, match: null };

    renderPanel(
      `<h3>Diablo IV Assistant</h3><p>Build trouvé : <em>${match.title}</em>. Lecture de l'équipement/compétences ` +
        `(ouverture furtive d'un onglet en arrière-plan, ~5-10s)...</p>`
    );

    const resolvedClass = match.gameClass || gameClass;
    const enUrl = match.url;
    const frUrl = enUrl.includes("/en/") ? enUrl.replace("/en/", "/fr/", 1) : null;

    const [enDetail, frDetail] = await Promise.all([openExtractionTab(enUrl), frUrl ? openExtractionTab(frUrl) : Promise.resolve(null)]);

    const skillsEn = enDetail ? enDetail.skills : [];
    const itemsEn = enDetail ? enDetail.items : [];
    const skillsFr = frDetail && frDetail.skills.length ? frDetail.skills : skillsEn;
    const itemsFr = frDetail && frDetail.items.length ? frDetail.items : itemsEn;
    const kamilabsMatch = findBestTitleMatch(kamiBuilds, match.title, resolvedClass);

    return { title, match, resolvedClass, skillsEn, itemsEn, skillsFr, itemsFr, hasDetail: !!enDetail, kamilabsMatch, sourceLabel: "InfinityBuilds" };
  }

  // Replaces this build's item/skill names directly on the page being
  // browsed with their exact French client wording - requested 2026-09-20
  // as a companion to Chrome's built-in page translation: a generic
  // translator mangles proper nouns (item/aspect names), so this handles
  // just those precisely (from the same EN/FR pair InfinityBuilds gave
  // us) and leaves everything else for Chrome to translate normally.
  // InfinityBuilds names aspects with their full "Aspect of X" form, but
  // other sites often show just "X" (found on D4Builds: "Debilitating
  // Toxins" instead of "Aspect of Debilitating Toxins") - a plain
  // substring match never fires in that case since the page's shorter
  // text can't contain the longer pattern. Stripping the prefix from both
  // languages adds a second, shorter pair that still matches.
  // fr_en_dictionary.json mixes straight (') and curly (') apostrophes
  // depending on which source a "d'X" entry came from - both must match,
  // otherwise stripAspectPrefix() silently no-ops on the curly-quote half
  // and leaves the full "Aspect d'X" wording instead of just "X" (found
  // 2026-09-21 chasing why "Imitated Imbuement" still showed with its
  // "Aspect d'" prefix attached after the fix below).
  const ASPECT_PREFIX_RE = /^aspect\s+(of|de|d['’])\s*/i;

  function stripAspectPrefix(name) {
    return name.replace(ASPECT_PREFIX_RE, "").trim();
  }

  // Finds a "Boards Used" panel on the CURRENT page (found on D4Builds -
  // see PARAGON_DICTIONARY's docstring) and returns only the KNOWN
  // glyph/board names found within its own text, scoped narrowly (not a
  // whole-page scan) since these English names are common enough words to
  // risk matching unrelated text elsewhere on the page.
  function findParagonNameMap() {
    const map = new Map();
    const heading = Array.from(document.querySelectorAll("*")).find(
      (e) => e.children.length === 0 && e.textContent.trim().toLowerCase() === "boards used"
    );
    if (!heading) return map;

    let container = heading.parentElement;
    for (let i = 0; i < 3 && container && container.textContent.trim().length < 40; i++) container = container.parentElement;
    if (!container) return map;

    const text = container.innerText || container.textContent || "";
    for (const [en, fr] of Object.entries(PARAGON_DICTIONARY.glyphs)) {
      if (en !== fr && text.includes(en)) map.set(en, fr);
    }
    for (const [en, fr] of Object.entries(PARAGON_DICTIONARY.boards)) {
      if (en !== fr && text.includes(en)) map.set(en, fr);
    }
    return map;
  }

  // Not every kind of dictionary entry makes sense to hunt for inside a
  // generated item name (see findEmbeddedAspectPairs below) - skills and
  // Paragon names live in a different namespace and risk a coincidental
  // false match, so only item-like kinds are scanned.
  const EMBEDDED_MATCH_KINDS = new Set(["item", "unique_item", "unknown"]);

  // Maxroll's `search_metadata.items` (see extractMaxrollDetail) doesn't
  // always give a plain aspect/unique name - some entries are the full
  // procedurally-generated item name Diablo assembles from a base item
  // type plus its aspect ("Runic Gloves of Imitated Imbuement", "Warcaster
  // of Channeling") - found 2026-09-21 investigating why some aspects
  // stayed untranslated despite an exact dictionary entry existing for the
  // aspect alone. A whole-string lookupFr() on those never matches, so
  // addPairs() below silently skips them (en === fr after the identity
  // fallback) and the aspect name never even reaches translateTextIn's
  // substring scan. Fix: search the dictionary for any entry whose EN name
  // occurs literally inside the raw string, and add THAT shorter pair
  // instead - translateTextIn's existing substring matching then finds it
  // wherever it appears on the page (independently of whatever wrapper
  // text surrounds it in Maxroll's own data), no naming-grammar parsing
  // needed. Longest embedded match wins, so a short match can't shadow a
  // more specific/longer one contained in the same string.
  function findEmbeddedAspectPairs(rawNames) {
    const pairs = [];
    for (const raw of rawNames || []) {
      const trimmed = (raw || "").trim();
      if (!trimmed || lookupFr(trimmed) !== trimmed) continue; // already has a direct/whole-string translation
      const rawLower = trimmed.toLowerCase();
      let best = null;
      for (const entry of FR_EN_DICTIONARY) {
        if (!EMBEDDED_MATCH_KINDS.has(entry.kind)) continue;
        const enLower = (entry.en || "").toLowerCase();
        if (enLower.length <= 3) continue; // skip short generic words - too easy to match by coincidence
        const idx = rawLower.indexOf(enLower);
        if (idx === -1) continue;
        if (!best || enLower.length > best.enInRaw.length) {
          best = { enInRaw: trimmed.slice(idx, idx + entry.en.length), fr: entry.fr };
        }
      }
      if (best) {
        pairs.push([best.enInRaw, best.fr]);
        continue;
      }

      // Reverse case: Maxroll's card already shows the short aspect name
      // alone ("Channeling"), but the dictionary only has the full form
      // ("Aspect of Channeling" -> "Aspect de canalisation") picked up
      // from InfinityBuilds' paperdoll. Same "Aspect of X"/"Aspect de X"
      // prefix-stripping trick as buildNameMap's addPairs() below, just
      // sourced from the static dictionary instead of a live EN/FR pair -
      // only handles the PREFIX form (most aspects use it); a few use a
      // French adjective form instead ("Aspect écrasant" for "Crushing
      // Aspect") that doesn't strip the same way and is left unmatched
      // rather than risk a wrong guess.
      for (const entry of FR_EN_DICTIONARY) {
        if (!EMBEDDED_MATCH_KINDS.has(entry.kind)) continue;
        const enStripped = stripAspectPrefix(entry.en || "");
        if (enStripped.length > 3 && enStripped.toLowerCase() === rawLower) {
          const frStripped = stripAspectPrefix(entry.fr || "");
          if (frStripped && frStripped.toLowerCase() !== rawLower) pairs.push([trimmed, frStripped]);
          break;
        }
      }
    }
    return pairs;
  }

  function buildNameMap(itemsEn, itemsFr, skillsEn, skillsFr) {
    const map = new Map();
    const addPairs = (ens, frs) => {
      const len = Math.min(ens.length, frs.length);
      for (let i = 0; i < len; i++) {
        const en = (ens[i] || "").trim();
        const fr = (frs[i] || "").trim();
        if (!en || !fr || en.toLowerCase() === fr.toLowerCase()) continue;
        map.set(en, fr);

        const enShort = stripAspectPrefix(en);
        const frShort = stripAspectPrefix(fr);
        if (enShort && frShort && enShort.length !== en.length && !map.has(enShort)) {
          map.set(enShort, frShort);
        }
      }
    };
    addPairs(itemsEn, itemsFr);
    addPairs(skillsEn, skillsFr);
    for (const [en, fr] of findParagonNameMap()) map.set(en, fr);
    for (const [en, fr] of BOSS_NAME_PAIRS) map.set(en, fr);
    for (const [en, fr] of findEmbeddedAspectPairs(itemsEn)) {
      if (!map.has(en)) map.set(en, fr);
    }

    // Last resort, run AFTER every smarter lookup above (not folded into
    // addPairs) - anything from THIS build's own item/skill lists that
    // still has no translation at all (lookupFr's dictionary miss on
    // Maxroll/D4Builds, not caught by findEmbeddedAspectPairs' aspect-
    // stripping either) is still registered as en->en, so translateTextIn
    // wraps it in translate="no" and Google's generic pass leaves it
    // alone instead of inventing a wrong French name (2026-09-21 bug
    // report, "Google prend le dessus"). Doing this INSIDE addPairs
    // instead was tried first and was itself a regression: it filled the
    // map with the en->en placeholder before findEmbeddedAspectPairs got
    // a chance to run, and `!map.has(en)` above then skipped the better
    // match it found (e.g. "Imitated Imbuement" already had a same-named
    // placeholder, so its real dictionary translation "imitation
    // d'imprégnation" - reachable via the "Aspect of X" stripping - never
    // got applied). Running this pass last guarantees it only ever fills
    // gaps nothing else could resolve.
    for (const raw of [...itemsEn, ...skillsEn]) {
      const en = (raw || "").trim();
      if (en && !map.has(en)) map.set(en, en);
    }

    return map;
  }

  const IGNORED_TAGS = new Set(["SCRIPT", "STYLE", "TEXTAREA", "INPUT"]);

  // Replaces matches in-place AND wraps each replacement in a
  // <span translate="no">, the standard HTML attribute Chrome's built-in
  // translate feature (and Google Translate's own widget) respects to
  // skip a piece of content entirely - requested 2026-09-20 so that
  // running Chrome's page translation afterward, on the same tab, doesn't
  // overwrite these precise names with a generic (and often wrong, for
  // proper nouns) translation.
  function translateTextNode(node, pairs) {
    const original = node.nodeValue;
    if (!original) return false;

    const matches = [];
    for (const [en, fr] of pairs) {
      let idx = 0;
      while ((idx = original.indexOf(en, idx)) !== -1) {
        matches.push({ start: idx, end: idx + en.length, fr, en });
        idx += en.length;
      }
    }
    if (matches.length === 0) return false;

    // Longest match wins on overlap (sorted by start, then by length desc).
    matches.sort((a, b) => a.start - b.start || b.end - a.end);
    const kept = [];
    let lastEnd = -1;
    for (const m of matches) {
      if (m.start >= lastEnd) {
        kept.push(m);
        lastEnd = m.end;
      }
    }

    const parent = node.parentNode;
    if (!parent) return false;

    const frag = document.createDocumentFragment();
    let cursor = 0;
    for (const m of kept) {
      if (m.start > cursor) frag.appendChild(document.createTextNode(original.slice(cursor, m.start)));
      const span = document.createElement("span");
      span.setAttribute("translate", "no");
      span.className = "notranslate";
      span.textContent = m.fr;
      if (lookupItemSource(m.en)) span.dataset.d4aEn = m.en;
      frag.appendChild(span);
      cursor = m.end;
    }
    if (cursor < original.length) frag.appendChild(document.createTextNode(original.slice(cursor)));

    parent.replaceChild(frag, node);
    return true;
  }

  // Translates every text node under `root` (root itself included, if it
  // is a text node) - `root` is document.body for the initial full pass,
  // or a single newly-added node when called from the mutation observer
  // below.
  function translateTextIn(root, nameMap) {
    if (!nameMap || nameMap.size === 0 || !root) return 0;
    // Longest names first, so a short name that happens to be a substring
    // of a longer, more specific one never gets replaced first and
    // corrupts the longer match.
    const pairs = Array.from(nameMap.entries()).sort((a, b) => b[0].length - a[0].length);

    if (root.nodeType === Node.TEXT_NODE) {
      const parentEl = root.parentElement;
      if (parentEl && parentEl.closest('#d4a-column, #d4a-toggle-btn, [translate="no"]')) return 0;
      return translateTextNode(root, pairs) ? 1 : 0;
    }
    if (root.nodeType !== Node.ELEMENT_NODE) return 0;
    if (IGNORED_TAGS.has(root.tagName)) return 0;
    if (root.closest && root.closest('#d4a-column, #d4a-toggle-btn, [translate="no"]')) return 0;

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const tag = node.parentElement ? node.parentElement.tagName : "";
        if (IGNORED_TAGS.has(tag)) return NodeFilter.FILTER_REJECT;
        if (node.parentElement && node.parentElement.closest('#d4a-column, #d4a-toggle-btn, [translate="no"]')) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });

    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);

    let replacedCount = 0;
    for (const node of nodes) {
      if (translateTextNode(node, pairs)) replacedCount++;
    }
    return replacedCount;
  }

  // Sites built with React/Vue (D4Builds, Maxroll, ...) re-render whole
  // sections from their own in-memory state whenever the user interacts
  // with the page (switching the "Starter/Midgame/Endgame" tabs, etc.) -
  // found in testing: item names got translated once, then reverted back
  // to English the moment the user clicked a different tab, because the
  // framework re-rendered that subtree from its untranslated source data,
  // overwriting our direct DOM edit. A MutationObserver re-applies the
  // same name map to whatever newly-rendered content appears, for as long
  // as the page stays open - this naturally never loops forever, since
  // already-translated text no longer contains an English name to match.
  let translationObserver = null;

  function startTranslationObserver(nameMap) {
    if (translationObserver) translationObserver.disconnect();
    translationObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "childList") {
          for (const node of mutation.addedNodes) translateTextIn(node, nameMap);
        } else if (mutation.type === "characterData") {
          translateTextIn(mutation.target, nameMap);
        }
      }
    });
    translationObserver.observe(document.body, { childList: true, subtree: true, characterData: true });
  }

  function applyPageTranslation(nameMap) {
    const count = translateTextIn(document.body, nameMap);
    startTranslationObserver(nameMap);
    return count;
  }

  // ---------------------------------------------------------------------
  // Whole-page text translation via Google's translation backend directly
  // (the same one powering Chrome's built-in translate, called ourselves
  // instead of relying on that browser feature) - stays on this tab,
  // unlike the earlier "open in a new tab via translate.google.com"
  // approach. This is an UNOFFICIAL, undocumented endpoint with no usage
  // guarantee - Google can rate-limit or block it as "automated queries"
  // without notice (confirmed happening from a datacenter test IP while
  // building this; a real browser's residential IP/cookies/request volume
  // are usually treated more leniently, but there's no hard guarantee).
  // Every text node already wrapped in translate="no" by
  // applyPageTranslation() above is skipped, so this never overwrites the
  // precise item/skill names already injected.
  // ---------------------------------------------------------------------
  const TRANSLATE_BATCH_SIZE = 15;

  function isGoogleTranslatableTextNode(node) {
    const tag = node.parentElement ? node.parentElement.tagName : "";
    if (IGNORED_TAGS.has(tag)) return false;
    if (node.parentElement && node.parentElement.closest('#d4a-column, #d4a-toggle-btn, [translate="no"]')) return false;
    const text = node.nodeValue.trim();
    return text.length >= 2 && /[a-zA-Z]/.test(text);
  }

  // Same filtering as collectTranslatableTextNodes() below, but scoped to
  // one root (a single newly-added node) instead of the whole page - used
  // by the observer that watches for content added AFTER the initial pass
  // (a game item tooltip that only exists once clicked/hovered, a React
  // tab re-render, etc. - see startGoogleTranslateObserver()).
  function collectTranslatableTextNodesIn(root) {
    if (root.nodeType === Node.TEXT_NODE) {
      return isGoogleTranslatableTextNode(root) ? [root] : [];
    }
    if (root.nodeType !== Node.ELEMENT_NODE) return [];
    if (root.closest && root.closest('#d4a-column, #d4a-toggle-btn, [translate="no"]')) return [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) { return isGoogleTranslatableTextNode(node) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT; },
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    return nodes;
  }

  function collectTranslatableTextNodes() {
    return collectTranslatableTextNodesIn(document.body);
  }

  // Keeps calling Google on whatever text appears AFTER the initial
  // "Traduire la page" pass - a Diablo item tooltip only exists in the DOM
  // once the user clicks/hovers an item, so without this it would stay in
  // English forever unless the user re-ran the button by hand every time
  // (requested 2026-09-21, same idea as startTranslationObserver() above
  // for the precise-term pass, kept as a SEPARATE observer since this one
  // debounces and batches through an unofficial rate-limited endpoint -
  // the precise-term one is instant/local and shouldn't wait on it).
  // Re-collects text fresh from the DOM at flush time rather than storing
  // node references up front, since translateTextIn's own observer may
  // have already split/replaced some of those nodes by then (see
  // translateTextNode: text nodes get replaced with <span> wrappers).
  let googleTranslateObserver = null;
  let googlePendingRoots = new Set();
  let googleFlushTimer = null;
  const GOOGLE_OBSERVER_DEBOUNCE_MS = 600;

  async function flushGoogleTranslateQueue() {
    const roots = Array.from(googlePendingRoots).filter((r) => r.isConnected);
    googlePendingRoots.clear();
    if (roots.length === 0) return;

    const seen = new Set();
    const nodes = [];
    for (const root of roots) {
      for (const n of collectTranslatableTextNodesIn(root)) {
        if (!seen.has(n)) {
          seen.add(n);
          nodes.push(n);
        }
      }
    }
    if (nodes.length === 0) return;

    for (let i = 0; i < nodes.length; i += TRANSLATE_BATCH_SIZE) {
      const batchNodes = nodes.slice(i, i + TRANSLATE_BATCH_SIZE);
      const lines = batchNodes.map((n) => n.nodeValue);
      const result = await translateBatchLines(lines);
      if (!result) continue;
      for (let j = 0; j < batchNodes.length; j++) {
        if (result[j] && result[j] !== lines[j] && batchNodes[j].isConnected) batchNodes[j].nodeValue = result[j];
      }
    }
  }

  function startGoogleTranslateObserver() {
    if (googleTranslateObserver) return;
    googleTranslateObserver = new MutationObserver((mutations) => {
      let sawAddition = false;
      for (const mutation of mutations) {
        if (mutation.type !== "childList") continue;
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE || node.nodeType === Node.TEXT_NODE) {
            googlePendingRoots.add(node);
            sawAddition = true;
          }
        }
      }
      if (!sawAddition) return;
      clearTimeout(googleFlushTimer);
      googleFlushTimer = setTimeout(flushGoogleTranslateQueue, GOOGLE_OBSERVER_DEBOUNCE_MS);
    });
    googleTranslateObserver.observe(document.body, { childList: true, subtree: true });
  }

  // Batches several text nodes into ONE request by joining them with "\n"
  // (Google's sentence splitter generally treats an explicit newline as a
  // hard boundary) rather than one request per node, to keep the request
  // count reasonable. If the number of translated lines coming back
  // doesn't match what was sent - Google merged/split something
  // unexpectedly - the whole batch is discarded rather than risk pairing
  // the wrong translation with the wrong node.
  async function translateBatchLines(lines) {
    const params = new URLSearchParams({ client: "gtx", sl: "en", tl: "fr", dt: "t" });
    params.set("q", lines.join("\n"));
    const url = `https://translate.googleapis.com/translate_a/single?${params.toString()}`;

    let raw;
    try {
      raw = await gmGet(url);
    } catch (e) {
      return null;
    }
    let data;
    try {
      data = JSON.parse(raw);
    } catch (e) {
      return null; // Google returned its "automated queries" HTML page, not JSON
    }
    const groups = data[0] || [];
    const translated = groups.map((g) => g[0]).join("");
    const resultLines = translated.split("\n");
    return resultLines.length === lines.length ? resultLines : null;
  }

  async function runTranslatePageText() {
    renderPanel(
      "<h3>Diablo IV Assistant</h3><p>Traduction du reste du texte via Google, sans changer d'onglet " +
        "(peut échouer par endroits si Google détecte un trafic automatisé - la traduction Chrome reste " +
        "disponible en repli)...</p>"
    );

    const nodes = collectTranslatableTextNodes();
    let translatedCount = 0;
    let failedBatches = 0;

    for (let i = 0; i < nodes.length; i += TRANSLATE_BATCH_SIZE) {
      const batchNodes = nodes.slice(i, i + TRANSLATE_BATCH_SIZE);
      const lines = batchNodes.map((n) => n.nodeValue);
      const result = await translateBatchLines(lines);
      if (!result) {
        failedBatches++;
        continue;
      }
      for (let j = 0; j < batchNodes.length; j++) {
        if (result[j] && result[j] !== lines[j]) {
          batchNodes[j].nodeValue = result[j];
          translatedCount++;
        }
      }
    }

    const failNote = failedBatches
      ? `<p style="color:#c9a227">${failedBatches} groupe(s) de texte n'ont pas pu être traduits (Google a peut-être bloqué la requête) - clique droit > "Traduire en français" pour compléter avec la traduction native de Chrome.</p>`
      : "";

    // From here on, any NEW text that appears (an item tooltip opened by
    // clicking/hovering gear, a tab re-render, ...) gets picked up and
    // translated automatically too - no need to click this button again.
    startGoogleTranslateObserver();

    renderPanel(`
      <h3>Diablo IV Assistant</h3>
      <p>${translatedCount} bloc(s) de texte traduits directement sur la page.</p>
      <p>Le nouveau texte qui apparaît ensuite (ex. une infobulle d'objet) sera traduit automatiquement aussi.</p>
      ${failNote}
    `);
  }

  // Single "Traduire" button - runs the precise-term pass THEN the
  // Google pass, always in that order. Used to be two separate buttons;
  // found in real use 2026-09-21 that running them in the wrong order (or
  // only the Google one) leaves item/skill names either untranslated or
  // translated generically instead of matching the exact FR game client
  // terms - merged into one button so that ordering mistake can't happen.
  async function runTranslateAll() {
    await runTranslate();
    await runTranslatePageText();
  }

  function renderNoMatch(title) {
    renderPanel(
      `<h3>Diablo IV Assistant</h3><p>Aucun build équivalent trouvé sur InfinityBuilds pour "<em>${title}</em>". ` +
        `InfinityBuilds ne couvre qu'une sélection curatée (~25 builds) - ce build précis n'y est peut-être pas.</p>`
    );
  }

  function kamilabsNoteHtml(kamilabsMatch) {
    return kamilabsMatch
      ? `<p>Vérifier aussi sur <a href="${kamilabsMatch.url}" target="_blank" rel="noopener noreferrer">${kamilabsMatch.title} (kami-labs)</a></p>`
      : "";
  }

  // "Traduire" button - just the French equipment/skill names, no filter
  // code. Separate from "Générer le filtre" so a quick terminology check
  // doesn't require caring about loot filters at all.
  async function runTranslate() {
    renderPanel("<h3>Diablo IV Assistant</h3><p>Recherche du build équivalent...</p>");
    let result;
    try {
      result = await resolveTranslation();
    } catch (err) {
      renderPanel(`<h3>Diablo IV Assistant</h3><p>${err.message}</p>`);
      return;
    }
    if (!result.match) {
      renderNoMatch(result.title);
      return;
    }

    const detailNote = result.hasDetail
      ? ""
      : `<p style="color:#c9a227">Impossible de lire le détail du build (l'onglet d'analyse n'a pas répondu à temps).</p>`;

    const nameMap = buildNameMap(result.itemsEn, result.itemsFr, result.skillsEn, result.skillsFr);
    const replacedCount = applyPageTranslation(nameMap);
    const pageNote = replacedCount
      ? `<p>${replacedCount} nom(s) remplacé(s) directement sur cette page par leur terme français exact - utilise la traduction Chrome pour le reste du texte.</p>`
      : `<p style="color:#c9a227">Aucun nom de cette page ne correspondait exactement aux noms anglais d'InfinityBuilds - rien remplacé sur la page (liste ci-dessous quand même disponible).</p>`;

    renderPanel(`
      <h3>Diablo IV Assistant</h3>
      <p>Traduit via <a href="${result.match.url}" target="_blank" rel="noopener noreferrer">${result.match.title} (${result.sourceLabel})</a> - termes exacts du client FR</p>
      ${kamilabsNoteHtml(result.kamilabsMatch)}
      ${detailNote}
      ${pageNote}
    `);
  }

  // "Générer le filtre" button - same translation, plus the loot filter
  // code built from the English skill names.
  async function runGenerateFilter() {
    renderPanel("<h3>Diablo IV Assistant</h3><p>Recherche du build équivalent...</p>");
    let result;
    try {
      result = await resolveTranslation();
    } catch (err) {
      renderPanel(`<h3>Diablo IV Assistant</h3><p>${err.message}</p>`);
      return;
    }
    if (!result.match) {
      renderNoMatch(result.title);
      return;
    }

    // Read the CURRENT page's own "Stat Priority" list, if it has one -
    // see findPriorityAffixIds()'s docstring. Never blocks filter
    // generation: an empty result just means fewer/simpler rules.
    let priority = { ids: [], names: [] };
    try {
      priority = await findPriorityAffixIds();
    } catch (e) {
      // ignore - stat-priority detection is a bonus signal, not required
    }

    const filterResult = generateFilterCode(result.match.title.slice(0, 30), result.resolvedClass || "", result.skillsEn, priority.ids);

    const detailNote = result.hasDetail
      ? ""
      : `<p style="color:#c9a227">Impossible de lire le détail du build (l'onglet d'analyse n'a pas répondu à temps) - le filtre ci-dessous est basé sur les compétences seules si trouvées, sinon vide.</p>`;

    const unresolvedNote = filterResult.unresolvedSkills.length
      ? `<p style="color:#c9a227">${filterResult.unresolvedSkills.length} compétence(s) sans affixe "+X compétences" reconnu pour cette classe (normal, la plupart n'en ont pas, ou classe non encore confirmée).</p>`
      : "";

    const priorityNote = priority.names.length
      ? `<p>Priorité de stats détectée sur cette page : ${priority.names.join(", ")} (utilisée pour les règles 2+/3+ affixes ci-dessous).</p>`
      : `<p style="color:#c9a227">Pas de liste de priorité de stats trouvée sur cette page - le filtre se base uniquement sur les compétences${filterResult.resolvedAffixCount < 2 ? " (règle simple ≥1 affixe)" : ""}.</p>`;

    renderPanel(`
      <h3>Diablo IV Assistant</h3>
      <p>Traduit via <a href="${result.match.url}" target="_blank" rel="noopener noreferrer">${result.match.title} (${result.sourceLabel})</a> - termes exacts du client FR</p>
      ${kamilabsNoteHtml(result.kamilabsMatch)}
      ${detailNote}
      <strong>Équipement</strong>
      ${chipList(result.itemsFr)}
      <strong>Compétences</strong>
      ${chipList(result.skillsFr)}
      ${unresolvedNote}
      ${priorityNote}
      <strong>Code du filtre</strong>
      <textarea rows="4" readonly id="d4a-code">${filterResult.code}</textarea>
      <button class="d4a-copy" id="d4a-copy-btn">Copier le code</button>
    `);

    document.getElementById("d4a-copy-btn").onclick = () => {
      const textarea = document.getElementById("d4a-code");
      textarea.select();
      navigator.clipboard.writeText(textarea.value);
      document.getElementById("d4a-copy-btn").textContent = "Copié !";
    };
  }

  // ---------------------------------------------------------------------
  // "Comparer les variantes" (demande utilisateur 2026-09-22) - pour un
  // même build, plusieurs sites (ou parfois le même site) proposent des
  // versions légèrement différentes (un objet différent, une option de
  // compétence différente, une priorité de stats différente). Objectif :
  // montrer les écarts précis entre variantes, pas désigner LA meilleure
  // - ça demanderait un vrai simulateur de dégâts, explicitement écarté
  // du périmètre de ce projet depuis le 2026-09-19 (voir HISTORIQUE.md).
  // Seul signal objectif ajouté : la popularité de chaque compétence
  // parmi les VRAIS joueurs du classement Tower officiel (countPlayersUsingSkill
  // ci-dessus) - aucune donnée équivalente n'existe pour les objets (le
  // classement n'expose que les compétences équipées, pas l'équipement).
  //
  // Ne compare que les sources pour lesquelles une extraction de détail
  // existe déjà (kami-labs, Maxroll : natif ; InfinityBuilds : onglet
  // caché) - D4Builds/D4Guides/talion.tv n'ont jamais eu cette extraction
  // construite (seulement titre/tier/lien), donc restent hors comparaison
  // pour l'instant, signalé à l'utilisateur plutôt que silencieusement
  // ignoré.
  // ---------------------------------------------------------------------
  const EXTRACTABLE_SOURCES = new Set(["kamilabs", "maxroll", "infinitybuilds"]);
  const MAX_COMPARED_OTHER_SOURCES = 3; // borne le coût (chaque onglet caché prend ~5-12s)

  function diffVariantField(variants, field) {
    const byName = new Map(); // nom replié -> { display, sources: Set }
    for (const v of variants) {
      for (const raw of v[field] || []) {
        const name = (raw || "").trim();
        if (!name) continue;
        const key = fold(name);
        if (!byName.has(key)) byName.set(key, { display: name, sources: new Set() });
        byName.get(key).sources.add(v.source);
      }
    }
    const common = [];
    const differing = [];
    for (const entry of byName.values()) {
      (entry.sources.size === variants.length ? common : differing).push(entry);
    }
    return { common, differing };
  }

  function renderVariantComparison(variants, gameClass, runs, skippedLinks) {
    const sourceLinksHtml = variants
      .map((v) => `<a href="${v.url}" target="_blank" rel="noopener noreferrer">${SOURCE_LABELS[v.source] || v.source}</a>`)
      .join(" · ");

    const skillsDiff = diffVariantField(variants, "skillsEn");
    const itemsDiff = diffVariantField(variants, "itemsEn");

    const renderCommon = (entries) => (entries.length ? chipList(entries.map((e) => e.display)) : "<em>aucun point commun trouvé</em>");

    const renderDiffering = (entries, withPopularity) => {
      if (entries.length === 0) return "<p><em>Aucune différence - toutes les variantes comparées utilisent exactement les mêmes.</em></p>";
      return entries
        .map((e) => {
          const sourcesTxt = Array.from(e.sources).map((s) => SOURCE_LABELS[s] || s).join(", ");
          let popTxt = "";
          if (withPopularity) {
            const { count, total } = countPlayersUsingSkill(runs, gameClass, e.display);
            popTxt = total > 0 ? ` — <span class="d4a-rank-meta">${count}/${total} joueurs du top classement officiel</span>` : "";
          }
          return `<div class="d4a-rank-row"><strong>${e.display}</strong><br><span class="d4a-rank-meta">présent chez : ${sourcesTxt}</span>${popTxt}</div>`;
        })
        .join("");
    };

    const skippedNote = skippedLinks.length
      ? `<p style="color:#c9a227">${skippedLinks.length} autre(s) site(s) ont aussi ce build (${skippedLinks.map((l) => SOURCE_LABELS[l.source] || l.source).join(", ")}) mais leur détail ne peut pas encore être lu par ce script - non inclus dans la comparaison.</p>`
      : "";
    const noPopularityNote = itemsDiff.differing.length
      ? `<p class="d4a-rank-meta">Pas de donnée de popularité pour les objets - le classement officiel n'expose que les compétences équipées, pas l'équipement.</p>`
      : "";
    const noLeaderboardNote = runs.length === 0 && skillsDiff.differing.length
      ? `<p style="color:#c9a227">Classement officiel indisponible cette fois - comparaison des compétences sans données de popularité réelle.</p>`
      : "";

    return `
      <p class="d4a-rank-meta">Sources comparées : ${sourceLinksHtml}</p>
      ${skippedNote}
      <strong>Compétences communes à toutes les variantes</strong>
      ${renderCommon(skillsDiff.common)}
      <strong>Compétences qui diffèrent</strong>
      ${renderDiffering(skillsDiff.differing, true)}
      ${noLeaderboardNote}
      <strong>Objets communs à toutes les variantes</strong>
      ${renderCommon(itemsDiff.common)}
      <strong>Objets qui diffèrent</strong>
      ${renderDiffering(itemsDiff.differing, false)}
      ${noPopularityNote}
    `;
  }

  async function runCompareVariants() {
    const title = guessTitle();
    const gameClass = guessClass();
    if (!gameClass) {
      renderPanel(`<h3>Diablo IV Assistant</h3><p style="color:#c9a227">Classe non détectée sur cette page.</p>`);
      return;
    }
    renderPanel(`<h3>Diablo IV Assistant</h3><p>Recherche des variantes de ce build sur les autres sites...</p>`);

    const [mine, links] = await Promise.all([
      resolveTranslation().catch(() => null),
      findCrossSiteLinks(title, gameClass).catch(() => []),
    ]);
    if (!mine || (!mine.itemsEn.length && !mine.skillsEn.length)) {
      renderPanel(`<h3>Diablo IV Assistant</h3><p style="color:#c9a227">Impossible de lire le détail de CE build - rien à comparer.</p>`);
      return;
    }

    const extractableLinks = links.filter((l) => EXTRACTABLE_SOURCES.has(l.source));
    const others = extractableLinks.slice(0, MAX_COMPARED_OTHER_SOURCES);
    const skippedLinks = links.filter((l) => !EXTRACTABLE_SOURCES.has(l.source)).concat(extractableLinks.slice(MAX_COMPARED_OTHER_SOURCES));

    const mySource = currentSourceId() || "infinitybuilds";
    const variants = [{ source: mySource, url: location.href, skillsEn: mine.skillsEn, itemsEn: mine.itemsEn }];

    if (others.length) {
      renderPanel(`<h3>Diablo IV Assistant</h3><p>Lecture de ${others.length} variante(s) sur les autres sites (ouverture d'onglet(s) en arrière-plan, ~5-15s)...</p>`);
      const results = await Promise.all(others.map((l) => openExtractionTab(l.url).catch(() => null)));
      results.forEach((r, i) => {
        if (r && ((r.items && r.items.length) || (r.skills && r.skills.length))) {
          variants.push({ source: others[i].source, url: others[i].url, skillsEn: r.skills || [], itemsEn: r.items || [] });
        } else {
          skippedLinks.push(others[i]);
        }
      });
    }

    if (variants.length < 2) {
      renderPanel(`<h3>Diablo IV Assistant</h3><p>Aucune autre variante lisible trouvée pour ce build - rien à comparer pour l'instant.</p>`);
      return;
    }

    const runs = await fetchTowerRuns().catch(() => []);
    const html = renderVariantComparison(variants, gameClass, runs, skippedLinks);
    renderPanel(`<h3>Diablo IV Assistant</h3><p>Comparaison de ${variants.length} variante(s) de ce build :</p>${html}`);
  }

  function init() {
    const extractRequestId = new URLSearchParams(location.search).get("d4a_extract");
    if (extractRequestId) {
      // This tab was opened by another tab running this same script, just
      // to read this one build's rendered gear/skills - see
      // openExtractionTab(). No UI here, just extract and report back.
      runExtractionMode(extractRequestId);
      return;
    }

    const lbExtractRequestId = new URLSearchParams(location.search).get("d4a_lb_extract");
    if (lbExtractRequestId) {
      // Same idea, distinct param - this tab was opened on helltides.com
      // to read the official Tower leaderboard, see
      // openLeaderboardExtractionTab(). No UI here either.
      runLeaderboardExtractionMode(lbExtractRequestId);
      return;
    }

    injectStyles();
    setupItemSourceTooltip();

    // Single hamburger toggle + one flex-column panel holding everything -
    // layout and palette copied from the user's Esprit Donghua Continuum
    // userscript (E:\EspritDonghua-Script\esprit-donghua-suivi-progression-
    // v4.user.js, ensurePanelToggleButton()/buildPersistentPanel()) at
    // their request 2026-09-21, replacing the previous 5 separate floating
    // pill buttons. Since every action button now lives INSIDE the panel,
    // the panel must already be open for one to be clickable at all - no
    // more need to auto-expand on render (expandColumn() is kept only as
    // a safety net for the unlikely case a result finishes rendering after
    // the user closed the panel mid-operation).
    const toggleBtn = document.createElement("button");
    toggleBtn.id = "d4a-toggle-btn";
    toggleBtn.type = "button";
    toggleBtn.title = "Afficher/masquer Diablo IV Assistant";
    toggleBtn.textContent = "☰";
    document.body.appendChild(toggleBtn);

    const column = document.createElement("div");
    column.id = "d4a-column";
    column.innerHTML = `
      <div id="d4a-column-title">Diablo IV Assistant</div>
      <div id="d4a-buildinfo-section"></div>
      <button id="d4a-btn-translate">🇫🇷 Traduire</button>
      <button id="d4a-btn-filter">⚔ Générer le filtre</button>
      <button id="d4a-btn-ranking">🏆 Classement</button>
      <button id="d4a-btn-compare">🔬 Comparer les variantes</button>
      <div id="d4a-panel-section"></div>
      <div id="d4a-ranking-section"></div>
      <div id="d4a-search-section">
        <strong>🔍 Recherche de traduction</strong>
        <div id="d4a-search-form">
          <input id="d4a-search-input" type="text" placeholder="Nom en anglais ou français...">
          <button id="d4a-search-btn">Chercher</button>
        </div>
        <div id="d4a-search-results"></div>
      </div>
      <div id="d4a-mybuilds-section">
        <strong>📌 Mes Builds</strong>
        <select id="d4a-mybuilds-select">
          <option value="">Choisir une classe...</option>
          ${Object.keys(CLASS_KEYWORDS).map((c) => `<option value="${c}">${CLASS_LABELS_FR[c]}</option>`).join("")}
        </select>
        <div id="d4a-mybuilds-result"></div>
      </div>
    `;
    document.body.appendChild(column);

    const translateBtn = document.getElementById("d4a-btn-translate");
    translateBtn.title = "Traduit les objets/compétences avec les termes exacts du client FR, puis le reste du texte de la page via Google";
    translateBtn.onclick = runTranslateAll;
    document.getElementById("d4a-btn-filter").onclick = runGenerateFilter;

    const rankingBtn = document.getElementById("d4a-btn-ranking");
    rankingBtn.title = "Classe les meilleurs builds de la classe détectée sur cette page, par consensus entre 6 sites (InfinityBuilds, kami-labs, Maxroll, D4Builds, D4Guides, talion.tv)";
    rankingBtn.onclick = runRanking;

    const compareBtn = document.getElementById("d4a-btn-compare");
    compareBtn.title = "Compare ce build à ses variantes sur les autres sites (objets/compétences qui diffèrent) et à la popularité réelle des compétences chez les joueurs du classement officiel";
    compareBtn.onclick = runCompareVariants;

    document.getElementById("d4a-search-btn").onclick = runLiveSearch;
    document.getElementById("d4a-search-input").onkeydown = (e) => {
      if (e.key === "Enter") runLiveSearch();
    };

    const myBuildsSelect = document.getElementById("d4a-mybuilds-select");
    myBuildsSelect.onchange = () => renderMyBuildForClass(myBuildsSelect.value);
    // Pré-sélectionne la classe de CETTE page si détectée, pour afficher
    // directement le build suivi correspondant sans avoir à le choisir.
    const currentClass = guessClass();
    if (currentClass) {
      recordBuildVisit(currentClass, guessTitle(), location.href);
      myBuildsSelect.value = currentClass;
      renderMyBuildForClass(currentClass);
    }

    toggleBtn.onclick = () => {
      const hidden = column.style.display === "none";
      column.style.display = hidden ? "flex" : "none";
      toggleBtn.textContent = hidden ? "✕" : "☰";
    };

    // Fire-and-forget: fills #d4a-buildinfo-section once resolved,
    // doesn't block anything else in init() (see renderBuildInfo()).
    renderBuildInfo();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
