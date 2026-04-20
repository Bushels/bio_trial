/* =========================================================
   Buperac Bio Trial — Public Dashboard
   Single anon RPC to public.get_trial_dashboard; all aggregates
   enforced at the DB layer (privacy_floor >= 3 farms).
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

  load().catch((e) => {
    console.error("dashboard load failed", e);
    const h = document.getElementById("headline");
    h.replaceChildren();
    const p = document.createElement("p");
    p.className = "empty";
    p.textContent = "Dashboard temporarily unavailable.";
    h.appendChild(p);
  });

  async function load() {
    const { data, error } = await sb.rpc("get_trial_dashboard");
    if (error) throw error;
    if (!data) throw new Error("empty dashboard response");
    renderHeadline(data.headline || {});
    renderAggregates(data.aggregates || []);
    renderActivity(data.activity || []);
    await renderPhotos(data.photos || []);
  }

  function stat(n, label) {
    const d = document.createElement("div");
    d.className = "stat";
    const big = document.createElement("div");
    big.className = "n";
    big.textContent = String(n ?? 0);
    const lab = document.createElement("div");
    lab.className = "l";
    lab.textContent = label;
    d.appendChild(big);
    d.appendChild(lab);
    return d;
  }

  function renderHeadline(h) {
    const host = document.getElementById("headline");
    host.replaceChildren();
    host.appendChild(stat(h.farms_count ?? 0, "Farms enrolled"));
    host.appendChild(stat(Math.round(Number(h.acres_enrolled) || 0), "Acres enrolled"));
    host.appendChild(stat(h.provinces_count ?? 0, "Provinces"));
    host.appendChild(stat(h.applications_count ?? 0, "Applications logged"));
    host.appendChild(stat(h.yields_count ?? 0, "Yield reports"));
    host.appendChild(stat(h.observations_count ?? 0, "Observations"));
  }

  function renderAggregates(list) {
    const host = document.getElementById("aggregates");
    host.replaceChildren();
    if (!list || list.length === 0) {
      const p = document.createElement("p");
      p.className = "empty";
      p.textContent = "Not enough reports yet — aggregates appear once 3 farms have logged yield for a crop.";
      host.appendChild(p);
      return;
    }
    const tbl = document.createElement("table");
    tbl.className = "agg";
    const head = document.createElement("tr");
    for (const t of ["Crop", "Avg yield (bu/ac)", "Farms"]) {
      const th = document.createElement("th");
      th.textContent = t;
      head.appendChild(th);
    }
    tbl.appendChild(head);
    for (const row of list) {
      const tr = document.createElement("tr");
      for (const v of [row.crop, row.avg_yield, row.farms]) {
        const td = document.createElement("td");
        td.textContent = String(v ?? "—");
        tr.appendChild(td);
      }
      tbl.appendChild(tr);
    }
    host.appendChild(tbl);
  }

  function renderActivity(list) {
    const host = document.getElementById("activity");
    host.replaceChildren();
    if (!list || list.length === 0) {
      const p = document.createElement("p");
      p.className = "empty";
      p.textContent = "No activity yet.";
      host.appendChild(p);
      return;
    }
    for (const a of list) {
      const row = document.createElement("div");
      row.className = "activity-item";
      const sentence = document.createElement("span");
      const crop = a.crop ? ` on ${a.crop}` : "";
      const kind = (a.kind || "event").replace(/_/g, " ");
      sentence.textContent = `A farmer in ${a.province ?? "CA"} logged ${kind}${crop}`;
      const when = document.createElement("span");
      when.className = "muted";
      when.textContent = "  · " + timeAgo(new Date(a.created_at));
      row.appendChild(sentence);
      row.appendChild(when);
      host.appendChild(row);
    }
  }

  async function renderPhotos(photos) {
    if (!photos || photos.length === 0) return;
    const section = document.getElementById("photosSection");
    const host = document.getElementById("photos");
    host.replaceChildren();
    for (const p of photos) {
      const path = p.file_urls?.[0];
      if (!path) continue;
      const { data, error } = await sb.storage
        .from("trial-uploads")
        .createSignedUrl(path, 3600);
      if (error || !data?.signedUrl) continue;
      const img = document.createElement("img");
      img.src = data.signedUrl;
      img.alt = p.caption ?? "trial photo";
      img.loading = "lazy";
      host.appendChild(img);
    }
    if (host.childElementCount > 0) section.hidden = false;
  }

  function timeAgo(d) {
    const diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 60)     return "just now";
    if (diff < 3600)   return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400)  return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  }
})();
