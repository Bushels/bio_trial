/* =========================================================
   Buperac Bio Trial — "The Trial Ledger" (public dashboard)
   One anon RPC to public.get_trial_dashboard; all aggregates
   privacy-gated at the DB layer (≥3 farms per crop).

   This file only writes plain data DOM (.stat, .activity-item,
   table.agg, .polaroid, .crop-chip). The inline decorator
   script in trial.html adds the desk "theatre": brass screws,
   pushpins, kind-coloured stamp badges, CONFIDENTIAL seal.
   ========================================================= */

(function () {
  "use strict";

  const SB_CFG = window.__BIO_TRIAL_SUPABASE__ || {};
  if (!window.supabase || !SB_CFG.url || !SB_CFG.anonKey) {
    console.error("Supabase client failed to load.");
    return;
  }

  const sb = window.supabase.createClient(SB_CFG.url, SB_CFG.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const PRIVACY_FLOOR_DEFAULT = 3;

  load().catch((e) => {
    console.error("dashboard load failed", e);
    const host = document.getElementById("headline");
    host.replaceChildren();
    const p = document.createElement("p");
    p.className = "empty";
    p.textContent = "Dashboard temporarily unavailable.";
    host.appendChild(p);
  });

  async function load() {
    const { data, error } = await sb.rpc("get_trial_dashboard");
    if (error) throw error;
    if (!data) throw new Error("empty dashboard response");

    const headline = data.headline || {};
    const floor    = data.privacy_floor || PRIVACY_FLOOR_DEFAULT;

    renderHeadline(headline);
    renderCrops(data.crops_list || []);
    renderAggregates(
      data.aggregates_by_tier || [],
      data.aggregates || [],
      headline,
      floor,
    );
    renderActivity(data.activity || []);
    await renderPhotos(data.photos || []);
  }

  // Tier labels mirror the migration's case expression in
  // 20260420000005_dashboard_trial_tiers.sql. Keep them in sync.
  const TIER_LABEL = {
    controlled:    "Controlled",
    referenced:    "Referenced",
    observational: "Observational",
    undeclared:    "Undeclared",
  };

  function stat(n, label) {
    const tile = document.createElement("div");
    tile.className = "stat";
    const big = document.createElement("div");
    big.className = "n";
    big.textContent = formatNumber(n);
    const lab = document.createElement("div");
    lab.className = "l";
    lab.textContent = label;
    tile.appendChild(big);
    tile.appendChild(lab);
    return tile;
  }

  function formatNumber(n) {
    const v = Number(n);
    if (!Number.isFinite(v)) return "0";
    return v.toLocaleString("en-US");
  }

  // Plaques cover every kind of trial data we're capturing:
  // scale indicators (farms / acres / provinces / crops) on row 1,
  // engagement indicators (apps / yields / soil / observations) on row 2,
  // rigor tiers (controlled / referenced / observational / undeclared) on
  // row 3 — this 3rd row is only rendered when the backend supplied tier
  // counts, so dashboards on older RPC versions still show the usual 8.
  function renderHeadline(h) {
    const host = document.getElementById("headline");
    host.replaceChildren();
    host.appendChild(stat(h.farms_count ?? 0,                          "Farms enrolled"));
    host.appendChild(stat(Math.round(Number(h.acres_enrolled) || 0),   "Acres enrolled"));
    host.appendChild(stat(h.provinces_count ?? 0,                      "Provinces"));
    host.appendChild(stat(h.crops_count ?? 0,                          "Crops in trial"));
    host.appendChild(stat(h.applications_count ?? 0,                   "Applications logged"));
    host.appendChild(stat(h.yields_count ?? 0,                         "Yield reports"));
    host.appendChild(stat(h.soil_tests_count ?? 0,                     "Soil tests"));
    host.appendChild(stat(h.observations_count ?? 0,                   "Observations"));

    const tiers = h.rigor_tier_counts;
    if (tiers && typeof tiers === "object") {
      host.appendChild(stat(tiers.controlled    ?? 0, "Controlled fields"));
      host.appendChild(stat(tiers.referenced    ?? 0, "Referenced fields"));
      host.appendChild(stat(tiers.observational ?? 0, "Observational fields"));
      host.appendChild(stat(tiers.undeclared    ?? 0, "Type pending"));
    }
  }

  function renderCrops(list) {
    const host = document.getElementById("crops-list");
    if (!host) return;
    host.replaceChildren();
    if (!list || list.length === 0) {
      const p = document.createElement("span");
      p.className = "crops-empty";
      p.textContent = "No signups yet — crops will appear as farmers enrol.";
      host.appendChild(p);
      return;
    }
    for (const c of list) {
      if (!c) continue;
      const chip = document.createElement("span");
      chip.className = "crop-chip";
      chip.textContent = String(c);
      host.appendChild(chip);
    }
  }

  // When aggregates are empty we write a single sentence containing both
  // "N farms" (target) and "M reporting" (current). The inline decorator
  // parses those numbers and swaps the text for the CONFIDENTIAL seal
  // with a privacy-meter dot progress bar.
  //
  // byTier: rows shaped {crop, tier, avg_yield, farms}. The RPC currently
  //   returns this as an empty array for launch
  //   (20260420000007_yield_field_required_and_hide_tiered.sql) because
  //   the old implementation mixed treated and check plots inside a tier.
  //   The wiring stays so we can re-enable once role-aware delta math
  //   ships, without another frontend change.
  // flatList: rows shaped {crop, avg_yield, farms} — the legacy view,
  //   rendered for now.
  function renderAggregates(byTier, flatList, headline, floor) {
    const host = document.getElementById("aggregates");
    host.replaceChildren();

    const haveTiered = Array.isArray(byTier) && byTier.length > 0;
    const haveFlat   = Array.isArray(flatList) && flatList.length > 0;

    if (!haveTiered && !haveFlat) {
      const reporting = Number(headline.farms_with_yields_count || 0);
      const p = document.createElement("p");
      p.className = "empty";
      p.textContent =
        `Aggregates unlock at ${floor} farms — ${reporting} reporting so far.`;
      host.appendChild(p);
      return;
    }

    const tbl = document.createElement("table");
    tbl.className = "agg";

    const headers = haveTiered
      ? ["Crop", "Tier", "Avg yield", "Reporting"]
      : ["Crop", "Avg yield", "Reporting"];

    const thead = document.createElement("thead");
    const headRow = document.createElement("tr");
    for (const label of headers) {
      const th = document.createElement("th");
      th.textContent = label;
      headRow.appendChild(th);
    }
    thead.appendChild(headRow);
    tbl.appendChild(thead);

    const tbody = document.createElement("tbody");
    const rows = haveTiered ? byTier : flatList;
    for (const row of rows) {
      const tr = document.createElement("tr");

      const cropCell = document.createElement("td");
      cropCell.textContent = row.crop ?? "—";
      tr.appendChild(cropCell);

      if (haveTiered) {
        const tierCell = document.createElement("td");
        tierCell.textContent = TIER_LABEL[row.tier] || (row.tier ?? "—");
        tr.appendChild(tierCell);
      }

      const avgCell = document.createElement("td");
      avgCell.textContent = row.avg_yield != null ? `${row.avg_yield} bu/ac` : "—";
      tr.appendChild(avgCell);

      const farmsCell = document.createElement("td");
      farmsCell.textContent = row.farms != null
        ? `${row.farms} farm${row.farms === 1 ? "" : "s"}`
        : "—";
      tr.appendChild(farmsCell);

      tbody.appendChild(tr);
    }
    tbl.appendChild(tbody);
    host.appendChild(tbl);
  }

  // Sentence the decorator expects: "<kind-span> A farmer in SK logged
  // observation on wheat. <muted-span>2m ago</muted-span>".
  // The decorator then wraps the non-kind/non-muted text in .sentence,
  // bolds the province code, and prepends a pushpin.
  function renderActivity(list) {
    const host = document.getElementById("activity");
    host.replaceChildren();

    if (!list || list.length === 0) {
      const p = document.createElement("p");
      p.className = "empty";
      p.textContent = "No activity yet — the pinboard fills up as farmers log in.";
      host.appendChild(p);
      return;
    }

    for (const a of list) {
      const row = document.createElement("div");
      row.className = "activity-item";

      const kindSpan = document.createElement("span");
      kindSpan.textContent = kindLabel(a.kind);
      row.appendChild(kindSpan);

      const verb = verbForKind(a.kind);
      const crop = a.crop ? ` on ${a.crop}` : "";
      const province = a.province ?? "CA";
      row.appendChild(document.createTextNode(
        ` A farmer in ${province} ${verb}${crop}.`
      ));

      const when = document.createElement("span");
      when.className = "muted";
      when.textContent = timeAgo(new Date(a.created_at));
      row.appendChild(when);

      host.appendChild(row);
    }
  }

  async function renderPhotos(photos) {
    if (!photos || photos.length === 0) return;
    const section = document.getElementById("photosSection");
    const host    = document.getElementById("photos");
    host.replaceChildren();

    for (const p of photos) {
      const path = p.file_urls?.[0];
      if (!path) continue;
      const { data, error } = await sb.storage
        .from("trial-uploads")
        .createSignedUrl(path, 3600);
      if (error || !data?.signedUrl) continue;

      const card = document.createElement("div");
      card.className = "polaroid";

      const img = document.createElement("img");
      img.src = data.signedUrl;
      img.alt = p.caption ?? "trial photo";
      img.loading = "lazy";
      card.appendChild(img);

      const cap = document.createElement("div");
      cap.className = "caption";
      cap.textContent = captionFor(p);
      card.appendChild(cap);

      host.appendChild(card);
    }

    if (host.childElementCount > 0) section.hidden = false;
  }

  function captionFor(photo) {
    if (photo.caption) return photo.caption;
    const bits = [];
    if (photo.crop) bits.push(photo.crop);
    if (photo.province) bits.push(photo.province);
    return bits.join(" · ");
  }

  function kindLabel(k) {
    return ({
      observation:   "Observation",
      yield:         "Yield",
      soil_test:     "Soil Test",
      application:   "Application",
      field_created: "Field",
      field:         "Field",
      photo:         "Photo",
    })[k] || String(k || "event").replace(/_/g, " ");
  }

  // Past-tense verb phrase that reads well in "A farmer in SK ___ on wheat".
  function verbForKind(k) {
    return ({
      observation:   "logged an observation",
      yield:         "reported yield",
      soil_test:     "logged a soil test",
      application:   "logged an application",
      field_created: "added a field",
      field:         "added a field",
      photo:         "shared a photo",
    })[k] || `logged ${String(k || "event").replace(/_/g, " ")}`;
  }

  function timeAgo(d) {
    const diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 60)    return "just now";
    if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  }
})();
