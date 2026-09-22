const classSelect = document.getElementById("game-class");
const form = document.getElementById("search-form");
const status = document.getElementById("status");
const results = document.getElementById("results");

// Sources where /api/analyze-build can fetch this ONE build's full detail
// (gear per slot, skills) on demand - richer than what the listing carries
// for free, so these are always re-fetched rather than reusing build.skills
// (see app/build_analysis.py).
const SUPPORTED_ON_DEMAND = new Set(["infinitybuilds", "d4guides"]);

async function loadClasses() {
  const classes = await fetch("/api/classes").then((r) => r.json());
  const leaderboardClassSelect = document.getElementById("leaderboard-class");
  const tierlistClassSelect = document.getElementById("tierlist-class");
  const lfClassSelect = document.getElementById("lf-class");
  for (const c of classes) {
    const opt = document.createElement("option");
    opt.value = c.id;
    opt.textContent = c.label;
    classSelect.appendChild(opt);

    leaderboardClassSelect.appendChild(opt.cloneNode(true));
    tierlistClassSelect.appendChild(opt.cloneNode(true));
    lfClassSelect.appendChild(opt.cloneNode(true));
  }
  await loadLootFilterOptions();
}

async function loadSeasons() {
  const seasons = await fetch("/api/seasons").then((r) => r.json());
  const select = document.getElementById("season");
  for (const s of seasons) {
    const opt = document.createElement("option");
    opt.value = s.season;
    opt.textContent = s.label;
    select.appendChild(opt);
  }
}

function formatRunTime(ms) {
  if (!ms) return "?";
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function renderLeaderboardResults(runs) {
  const container = document.getElementById("leaderboard-results");
  container.innerHTML = "";

  if (runs.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "Aucun joueur du classement officiel n'utilise cette compétence pour cette classe.";
    container.appendChild(empty);
    return;
  }

  for (const run of runs) {
    const row = document.createElement("div");
    row.className = "lb-row";

    const rank = document.createElement("div");
    rank.className = "lb-rank";
    rank.textContent = `#${run.rank}`;
    row.appendChild(rank);

    const tag = document.createElement("div");
    tag.className = "lb-tag";
    tag.textContent = run.battle_tag || "?";
    row.appendChild(tag);

    const meta = document.createElement("div");
    meta.className = "lb-meta";
    const flags = [run.hardcore ? "Hardcore" : null, run.ssf ? "SSF" : null].filter(Boolean).join(", ");
    meta.textContent = `Tier ${run.tier} · ${formatRunTime(run.run_time_ms)}${flags ? " · " + flags : ""}`;
    row.appendChild(meta);

    const skills = document.createElement("div");
    skills.className = "lb-skills";
    skills.textContent = run.skills.join(" · ");
    row.appendChild(skills);

    container.appendChild(row);
  }
}

function renderTierList(entries) {
  const container = document.getElementById("tierlist-results");
  container.innerHTML = "";

  if (entries.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "Pas de données de classement pour cette classe.";
    container.appendChild(empty);
    return;
  }

  for (const entry of entries) {
    const row = document.createElement("div");
    row.className = `tier-row tier-${entry.tier.toLowerCase()}`;

    const badge = document.createElement("span");
    badge.className = "tier-badge";
    badge.textContent = entry.tier;
    row.appendChild(badge);

    const main = document.createElement("div");
    main.className = "tier-row-main";

    const skills = document.createElement("div");
    skills.className = "tier-row-skills";
    skills.textContent = entry.skills.join(" + ");
    main.appendChild(skills);

    const meta = document.createElement("div");
    meta.className = "tier-row-meta";
    meta.textContent = `Meilleur run : #${entry.best_rank} (Fosse ${entry.best_tier_reached}) · ${entry.player_count} joueur${entry.player_count > 1 ? "s" : ""} au classement (${entry.share_pct}%) · ex. ${entry.example_battle_tags.join(", ")}`;
    main.appendChild(meta);

    row.appendChild(main);
    container.appendChild(row);
  }
}

document.getElementById("tierlist-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const gameClass = document.getElementById("tierlist-class").value;
  const status = document.getElementById("tierlist-status");
  status.textContent = "Chargement du classement (premier appel : ~5-10s)...";
  document.getElementById("tierlist-results").innerHTML = "";
  try {
    const entries = await fetch(`/api/leaderboard/tierlist?game_class=${gameClass}`).then((r) => r.json());
    status.textContent = "";
    renderTierList(entries);
  } catch (err) {
    status.textContent = `Erreur : ${err}`;
  }
});

document.getElementById("tierlist-refresh").addEventListener("click", async () => {
  const status = document.getElementById("tierlist-status");
  status.textContent = "Actualisation du classement officiel en cours...";
  try {
    const result = await fetch("/api/leaderboard/refresh", { method: "POST" }).then((r) => r.json());
    status.textContent = `Classement actualisé (${result.runs_loaded} runs chargés). Clique sur "Afficher" pour voir le résultat.`;
  } catch (err) {
    status.textContent = `Erreur : ${err}`;
  }
});

function renderCheckList(container, items, { disabledPredicate, disabledSuffix } = {}) {
  container.innerHTML = "";
  for (const item of items) {
    const name = typeof item === "string" ? item : item.name;
    const disabled = disabledPredicate ? disabledPredicate(item) : false;

    const row = document.createElement("div");
    row.className = `lf-stat-item${disabled ? " pending" : ""}`;

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = name;
    checkbox.disabled = disabled;
    row.appendChild(checkbox);

    const label = document.createElement("label");
    label.textContent = disabled ? `${name}${disabledSuffix || ""}` : name;
    row.appendChild(label);

    container.appendChild(row);
  }
}

function checkedValues(container) {
  return Array.from(container.querySelectorAll("input[type=checkbox]:checked")).map((el) => el.value);
}

async function loadLootFilterOptions() {
  const gameClass = document.getElementById("lf-class").value;
  const options = await fetch(`/api/loot-filter/options?game_class=${gameClass}`).then((r) => r.json());

  renderCheckList(document.getElementById("lf-core-stats"), options.all_stats);
  renderCheckList(document.getElementById("lf-secondary-stats"), options.all_stats);
  renderCheckList(document.getElementById("lf-skills"), options.skills, {
    disabledPredicate: (s) => !s.confirmed,
    disabledSuffix: " (ID non confirmé)",
  });
}

document.getElementById("lf-class").addEventListener("change", loadLootFilterOptions);

async function resolveBuildDetails(build) {
  if (!build) return { skills: [], items: [], supported: false };

  if (SUPPORTED_ON_DEMAND.has(build.source)) {
    // Always re-fetch for these - their on-demand detail includes gear
    // per slot, which the listing never carries, so it's strictly richer
    // than build.skills even when that's already non-empty.
    const params = new URLSearchParams({ source: build.source, url: build.url });
    if (build.external_id) params.set("external_id", build.external_id);
    if (build.external_class_id) params.set("external_class_id", build.external_class_id);
    const result = await fetch(`/api/analyze-build?${params}`).then((r) => r.json());
    return { skills: result.skills || [], items: result.items || [], supported: true };
  }

  const skills = build.skills || [];
  if (skills.length > 0) {
    // Listing already carried skills for free (D4Builds) - no gear source
    // for this one yet, so items stay empty.
    return { skills, items: [], supported: true };
  }
  return { skills: [], items: [], supported: false };
}

async function applySkillsToFilterForm(gameClass, skills) {
  if (gameClass) {
    document.getElementById("lf-class").value = gameClass;
  }
  await loadLootFilterOptions();

  if (!skills || skills.length === 0) {
    return "Pas de compétence détectée pour ce build - choisis-les manuellement ci-dessous.";
  }

  const skillList = document.getElementById("lf-skills");
  const checkboxes = Array.from(skillList.querySelectorAll("input[type=checkbox]"));
  let matched = 0;
  let unconfirmed = 0;
  for (const checkbox of checkboxes) {
    if (skills.includes(checkbox.value)) {
      if (checkbox.disabled) {
        unconfirmed++;
      } else {
        checkbox.checked = true;
        matched++;
      }
    }
  }

  const notFound = skills.length - matched - unconfirmed;
  let msg = `${skills.length} compétence(s) détectée(s), ${matched} cochée(s) dans le filtre.`;
  if (unconfirmed > 0) msg += ` ${unconfirmed} non confirmée(s) pour cette classe.`;
  if (notFound > 0) msg += ` ${notFound} sans affixe "+X compétences" connu (normal, la plupart n'en ont pas).`;
  return msg;
}

let currentBuildDetail = null;

async function showBuildDetail(title, entries, gameClass, skillsSourceBuild) {
  document.getElementById("build-detail-empty").hidden = true;
  document.getElementById("build-detail-content").hidden = false;
  document.getElementById("bd-title").textContent = title;
  document.getElementById("bd-status").textContent = "";

  const meta = document.getElementById("bd-meta");
  meta.innerHTML = "";
  for (const e of entries) {
    const row = document.createElement("div");
    row.className = "bd-source-row";

    const badge = document.createElement("span");
    badge.className = `tier-badge ${tierClass(e.tier)}`;
    badge.textContent = e.tier || "?";
    row.appendChild(badge);

    const a = document.createElement("a");
    a.href = e.url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.textContent = `${e.source} ↗`;
    row.appendChild(a);

    meta.appendChild(row);
  }

  const statusEl = document.getElementById("bd-content-status");
  const itemsEl = document.getElementById("bd-items");
  const skillListEl = document.getElementById("bd-skill-list");
  statusEl.textContent = "Chargement du contenu du build...";
  itemsEl.innerHTML = "";
  skillListEl.innerHTML = "";
  currentBuildDetail = { gameClass, skills: [] };

  const { skills, items, supported } = await resolveBuildDetails(skillsSourceBuild);
  currentBuildDetail.skills = skills;

  if (!supported) {
    statusEl.textContent = "Contenu détaillé non disponible pour cette source - seuls le titre et le lien externe sont connus. Le filtre pourra quand même être généré, compétences à cocher à la main.";
    return;
  }
  statusEl.textContent = "";

  if (items.length > 0) {
    const heading = document.createElement("div");
    heading.className = "bd-section-title";
    heading.textContent = "Équipement";
    itemsEl.appendChild(heading);
    const list = document.createElement("div");
    list.className = "bd-chip-list";
    for (const item of items) {
      const chip = document.createElement("span");
      chip.className = "bd-chip";
      chip.textContent = item;
      list.appendChild(chip);
    }
    itemsEl.appendChild(list);
  }

  if (skills.length > 0) {
    const heading = document.createElement("div");
    heading.className = "bd-section-title";
    heading.textContent = "Compétences";
    skillListEl.appendChild(heading);
    const list = document.createElement("div");
    list.className = "bd-chip-list";
    for (const skill of skills) {
      const chip = document.createElement("span");
      chip.className = "bd-chip";
      chip.textContent = skill;
      list.appendChild(chip);
    }
    skillListEl.appendChild(list);
  } else {
    skillListEl.textContent = "Aucune compétence détectée pour ce build.";
  }
}

document.getElementById("bd-generate-filter").addEventListener("click", async () => {
  if (!currentBuildDetail) return;
  const bdStatus = document.getElementById("bd-status");
  bdStatus.textContent = "Préparation du générateur...";
  const summary = await applySkillsToFilterForm(currentBuildDetail.gameClass, currentBuildDetail.skills);
  document.getElementById("loot-filter-section").scrollIntoView({ behavior: "smooth" });
  bdStatus.textContent = summary;
});

document.getElementById("lf-generate").addEventListener("click", async () => {
  const status = document.getElementById("lf-status");
  const payload = {
    filter_name: document.getElementById("lf-name").value || "My Loot Filter",
    game_class: document.getElementById("lf-class").value,
    core_stats: checkedValues(document.getElementById("lf-core-stats")),
    secondary_stats: checkedValues(document.getElementById("lf-secondary-stats")),
    skills: checkedValues(document.getElementById("lf-skills")),
    gold_threshold: parseInt(document.getElementById("lf-gold-threshold").value, 10),
  };

  status.textContent = "Génération...";
  try {
    const result = await fetch("/api/loot-filter/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then((r) => r.json());

    document.getElementById("lf-code").value = result.code;
    document.getElementById("lf-output").hidden = false;
    status.textContent = `Code généré (${result.resolved_affix_count} affixes reconnus)${result.unresolved_skills.length ? " - compétences ignorées (ID non confirmé) : " + result.unresolved_skills.join(", ") : ""}`;
  } catch (err) {
    status.textContent = `Erreur : ${err}`;
  }
});

document.getElementById("lf-copy").addEventListener("click", () => {
  const code = document.getElementById("lf-code");
  code.select();
  navigator.clipboard.writeText(code.value).then(() => {
    document.getElementById("lf-status").textContent = "Code copié dans le presse-papier.";
  });
});

document.getElementById("leaderboard-search-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const gameClass = document.getElementById("leaderboard-class").value;
  const skill = document.getElementById("leaderboard-skill").value.trim();
  const status = document.getElementById("leaderboard-status");
  if (!skill) return;

  status.textContent = "Recherche dans le classement officiel...";
  document.getElementById("leaderboard-results").innerHTML = "";

  try {
    const params = new URLSearchParams({ game_class: gameClass, skill });
    const runs = await fetch(`/api/leaderboard/search?${params}`).then((r) => r.json());
    status.textContent = `${runs.length} résultat${runs.length > 1 ? "s" : ""} affiché${runs.length > 1 ? "s" : ""} (meilleurs rangs d'abord).`;
    renderLeaderboardResults(runs);
  } catch (err) {
    status.textContent = `Erreur : ${err}`;
  }
});

function tierClass(tier) {
  return tier ? `tier-${tier.toLowerCase()}` : "tier-c";
}

function makeTitleButton(text, onClick) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "build-title-btn";
  btn.textContent = text;
  btn.title = "Voir le détail de ce build au centre";
  btn.onclick = onClick;
  return btn;
}

function makeExternalLink(url) {
  const a = document.createElement("a");
  a.href = url;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  a.className = "ext-link";
  a.textContent = "↗";
  a.title = "Ouvrir sur le site source";
  return a;
}

function pickAnalyzableBuild(builds) {
  // On-demand sources (InfinityBuilds, D4Guides) include gear per slot -
  // strictly richer than a source that only has skills for free (D4Builds).
  return (
    builds.find((b) => SUPPORTED_ON_DEMAND.has(b.source)) ||
    builds.find((b) => b.skills && b.skills.length > 0) ||
    builds[0]
  );
}

function renderColumn(source, builds) {
  const col = document.createElement("div");
  col.className = "source-column";

  const title = document.createElement("h2");
  title.textContent = `${source} (${builds.length})`;
  col.appendChild(title);

  if (builds.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "Aucun build trouvé pour ce filtre.";
    col.appendChild(empty);
    return col;
  }

  const list = document.createElement("div");
  list.className = "source-column-list";

  for (const b of builds) {
    const card = document.createElement("div");
    card.className = `build-card ${tierClass(b.tier)}`;

    const badge = document.createElement("span");
    badge.className = "tier-badge";
    badge.textContent = b.tier || "?";
    card.appendChild(badge);

    card.appendChild(
      makeTitleButton(b.title, () =>
        showBuildDetail(b.title, [{ source: b.source, tier: b.tier, url: b.url }], b.game_class, b)
      )
    );
    card.appendChild(makeExternalLink(b.url));

    if (b.game_class === null) {
      const meta = document.createElement("span");
      meta.className = "build-meta";
      meta.textContent = "classe non détectée";
      card.appendChild(meta);
    }

    list.appendChild(card);
  }

  col.appendChild(list);
  return col;
}

const TIER_ORDER = ["S", "A", "B", "C", "D"];

function renderConsensus(groups) {
  const container = document.getElementById("consensus");
  container.innerHTML = "";

  if (groups.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "Pas assez de données pour cette classe.";
    container.appendChild(empty);
    return;
  }

  groups.slice(0, 10).forEach((g, i) => {
    const card = document.createElement("div");
    card.className = "consensus-card";

    const rank = document.createElement("div");
    rank.className = "consensus-rank";
    rank.textContent = `#${i + 1}`;
    card.appendChild(rank);

    const main = document.createElement("div");
    main.className = "consensus-main";

    const titleRow = document.createElement("div");
    titleRow.style.display = "flex";
    titleRow.style.alignItems = "center";

    const title = makeTitleButton(g.title, () => {
      const entries = g.builds.map((b) => ({ source: b.source, tier: b.tier, url: b.url }));
      showBuildDetail(g.title, entries, g.game_class, pickAnalyzableBuild(g.builds));
    });
    title.classList.add("consensus-title");
    titleRow.appendChild(title);

    const tiers = document.createElement("span");
    tiers.className = "consensus-tiers";
    for (const t of TIER_ORDER) {
      if (g.tier_summary[t]) {
        const badge = document.createElement("span");
        badge.className = tierClass(t);
        badge.textContent = `${t}×${g.tier_summary[t]}`;
        tiers.appendChild(badge);
      }
    }
    titleRow.appendChild(tiers);
    main.appendChild(titleRow);

    const sources = document.createElement("div");
    sources.className = "consensus-sources";
    let sourcesText = `${g.source_count} source${g.source_count > 1 ? "s" : ""} : ${g.sources.join(", ")}`;
    if (g.leaderboard_confirmations > 0) {
      sourcesText += ` — ✓ ${g.leaderboard_confirmations}/20 joueurs du top classement officiel`;
    }
    sources.textContent = sourcesText;
    main.appendChild(sources);

    const links = document.createElement("div");
    links.className = "consensus-links";
    for (const b of g.builds) {
      const a = document.createElement("a");
      a.href = b.url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = b.source;
      links.appendChild(a);
    }
    main.appendChild(links);
    card.appendChild(main);

    container.appendChild(card);
  });
}

async function runSearch() {
  const gameClass = classSelect.value;
  const keyword = document.getElementById("keyword").value.trim();
  const season = document.getElementById("season").value;

  const params = new URLSearchParams();
  if (gameClass) params.set("game_class", gameClass);
  if (keyword) params.set("keyword", keyword);
  if (season) params.set("season", season);

  status.textContent = "Recherche en cours (InfinityBuilds/talion.tv peuvent prendre quelques secondes)...";
  results.innerHTML = "";
  const consensusContainer = document.getElementById("consensus");
  consensusContainer.innerHTML = "";
  document.getElementById("build-detail-content").hidden = true;
  document.getElementById("build-detail-empty").hidden = false;

  try {
    const requests = [fetch(`/api/compare?${params}`).then((r) => r.json())];
    if (gameClass) {
      const consensusParams = new URLSearchParams({ game_class: gameClass });
      if (keyword) consensusParams.set("keyword", keyword);
      if (season) consensusParams.set("season", season);
      requests.push(fetch(`/api/consensus?${consensusParams}`).then((r) => r.json()));
    }
    const [compareData, consensusData] = await Promise.all(requests);
    status.textContent = "";

    if (consensusData) {
      renderConsensus(consensusData);
    } else {
      const empty = document.createElement("p");
      empty.className = "empty";
      empty.textContent = "Choisis une classe pour voir le consensus multi-sources.";
      consensusContainer.appendChild(empty);
    }

    for (const [source, builds] of Object.entries(compareData)) {
      results.appendChild(renderColumn(source, builds));
    }
  } catch (err) {
    status.textContent = `Erreur : ${err}`;
  }
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  runSearch();
});

loadClasses();
loadSeasons();
