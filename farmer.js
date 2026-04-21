/* =========================================================
   Buperac Bio Trial — Farmer Dashboard
   JWT-authed via ?token= URL param; all DB access via SECURITY
   DEFINER RPCs that verify the token server-side. No innerHTML;
   all DOM built with createElement + textContent (security hook).
   ========================================================= */

(function () {
  "use strict";

  const SB_CFG = window.__BIO_TRIAL_SUPABASE__ || {};
  const authErr = document.getElementById("authError");

  const showError = (msg) => {
    authErr.textContent = msg;
    authErr.hidden = false;
  };

  if (!window.supabase || !SB_CFG.url || !SB_CFG.anonKey) {
    showError("Supabase client failed to load.");
    return;
  }

  const sb = window.supabase.createClient(SB_CFG.url, SB_CFG.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const url = new URL(window.location.href);
  const token = url.searchParams.get("token");
  if (!token) {
    showError("No trial link. Ask your contact for a fresh magic link.");
    return;
  }

  window.TOKEN = token;
  window.SB = sb;

  bootstrap().catch((e) => {
    console.error("bootstrap failed", e);
    showError("Could not load your trial. The link may be expired — ask for a new one.");
  });

  async function bootstrap() {
    const { data, error } = await sb.rpc("farmer_bootstrap", { p_token: token });
    if (error) throw error;
    if (!data || !data.signup) throw new Error("empty bootstrap");
    window.FARMER_STATE = data;
    renderAll(data);
  }

  function renderAll(state) {
    renderSignup(state.signup);
    renderTelegramCta(state);
    renderFields(state.fields || [], state.plots || []);
    renderTimeline(state.events || []);
    renderEventForm(state.fields || [], state.plots || []);
    document.getElementById("signupSummary").hidden = false;
    document.getElementById("telegramSection").hidden = false;
    document.getElementById("fieldsSection").hidden = false;
    document.getElementById("eventSection").hidden = false;
    document.getElementById("timelineSection").hidden = false;
  }

  // Spec §5 trial designs in declared order, most rigorous first. The tier
  // label drives the badge on each field and on the public scoreboard.
  const TRIAL_TYPE_INFO = {
    STRIP:             { tier: "controlled",    blurb: "Side-by-side treated/untreated strips in the same field" },
    SPLIT:             { tier: "controlled",    blurb: "Treated half vs untreated half of the same field" },
    WHOLE_HISTORICAL:  { tier: "referenced",    blurb: "Whole field vs your 3-year historical yield" },
    WHOLE_NEIGHBOR:    { tier: "referenced",    blurb: "Whole field vs an untreated neighbor field" },
    OBSERVATIONAL:     { tier: "observational", blurb: "Whole field, no check — directional only" },
  };

  function plotsForField(plots, fieldId) {
    return (plots || []).filter((p) => p.field_id === fieldId);
  }

  function renderSignup(s) {
    const host = document.getElementById("signupSummary");
    host.replaceChildren();

    const h = document.createElement("h2");
    h.textContent = [s.name, s.farm_name].filter(Boolean).join(" — ") || "Your trial";
    host.appendChild(h);

    const metaBits = [
      s.province || "",
      `${s.acres ?? 0} acres enrolled`,
      s.liters ? `${s.liters} L` : null,
      s.delivered ? "delivered ✓" : (s.shipped ? "shipped" : "pending delivery"),
      s.paid ? "paid ✓" : "unpaid",
    ].filter(Boolean);

    const p = document.createElement("p");
    p.className = "muted";
    p.textContent = metaBits.join(" · ");
    host.appendChild(p);
  }

  function renderTelegramCta(state) {
    const host = document.getElementById("telegramSection");
    host.replaceChildren();

    const h = document.createElement("h2");
    h.textContent = "Telegram inbox";
    host.appendChild(h);

    if (state.telegram_bound) {
      const p = document.createElement("p");
      p.textContent = "Connected ✓ — text observations, send photos, or try /apply and /yield.";
      host.appendChild(p);
      return;
    }

    const p = document.createElement("p");
    p.textContent = "Connect Telegram to text updates and photos directly from the field.";
    host.appendChild(p);

    const a = document.createElement("a");
    a.href = `https://t.me/BuperacTrialBot?start=${state.signup.id}`;
    a.className = "tg-btn";
    a.textContent = "Open Telegram →";
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    host.appendChild(a);
  }

  function renderFields(fields, plots) {
    const host = document.getElementById("fieldsList");
    if (!host) return;
    host.replaceChildren();
    if (!fields || fields.length === 0) {
      const p = document.createElement("p");
      p.className = "muted";
      p.textContent = "No fields yet. Add one to start tracking.";
      host.appendChild(p);
      return;
    }
    for (const f of fields) {
      const card = document.createElement("div");
      card.style.padding = "10px 0";
      card.style.borderBottom = "1px solid #eee";

      const title = document.createElement("strong");
      title.textContent = `${f.label} · ${f.crop ?? "?"}${f.prev_crop ? ` (prev: ${f.prev_crop})` : ""}`;
      card.appendChild(title);

      const meta = document.createElement("div");
      meta.className = "muted";
      const bits = [
        f.acres ? `${f.acres} ac` : null,
        f.application_method ? f.application_method.replace(/_/g, " ") : null,
      ].filter(Boolean);
      meta.textContent = bits.length ? bits.join(" · ") : "no details";
      card.appendChild(meta);

      // Trial-type row: either a badge ("STRIP · controlled") or a declare-CTA.
      const typeRow = document.createElement("div");
      typeRow.style.marginTop = "6px";
      if (f.trial_type) {
        const info = TRIAL_TYPE_INFO[f.trial_type] || { tier: "—", blurb: "" };
        const badge = document.createElement("span");
        badge.className = "kind-badge";
        badge.textContent = `${f.trial_type.replace(/_/g, " ")} · ${info.tier}`;
        typeRow.appendChild(badge);
        if (info.blurb) {
          const blurb = document.createElement("span");
          blurb.className = "muted";
          blurb.style.marginLeft = "8px";
          blurb.textContent = info.blurb;
          typeRow.appendChild(blurb);
        }
      } else {
        const warn = document.createElement("span");
        warn.className = "muted";
        warn.textContent = "No trial type declared yet.";
        typeRow.appendChild(warn);
        const btn = document.createElement("button");
        btn.type = "button";
        btn.textContent = "Declare trial type";
        btn.style.marginLeft = "8px";
        btn.addEventListener("click", () => openTrialTypeForm(card, f));
        typeRow.appendChild(btn);
      }
      card.appendChild(typeRow);

      // Plots list — real plots get acres, virtual plots get their reference.
      const myPlots = plotsForField(plots, f.id);
      if (myPlots.length > 0) {
        const plotsWrap = document.createElement("div");
        plotsWrap.style.marginTop = "6px";
        const plotsHead = document.createElement("div");
        plotsHead.className = "muted";
        plotsHead.textContent = "Plots:";
        plotsWrap.appendChild(plotsHead);
        const ul = document.createElement("ul");
        ul.style.margin = "4px 0 0 18px";
        for (const p of myPlots) {
          const li = document.createElement("li");
          const bits2 = [
            p.role,
            p.is_virtual ? "virtual" : (p.acres ? `${p.acres} ac` : null),
            p.is_virtual && p.historical_yield_bu_per_ac != null ? `${p.historical_yield_bu_per_ac} bu/ac hist.` : null,
            p.is_virtual && p.neighbor_reference ? `neighbor: ${p.neighbor_reference}` : null,
          ].filter(Boolean);
          li.textContent = `${p.label} (${bits2.join(" · ")})`;
          ul.appendChild(li);
        }
        plotsWrap.appendChild(ul);
        card.appendChild(plotsWrap);
      }

      host.appendChild(card);
    }
  }

  function openTrialTypeForm(anchorCard, field) {
    // Toggle — clicking Declare again closes the form.
    const existing = anchorCard.querySelector("[data-trial-type-form]");
    if (existing) {
      existing.remove();
      return;
    }
    anchorCard.appendChild(buildTrialTypeForm(field));
  }

  function buildTrialTypeForm(field) {
    const form = document.createElement("form");
    form.setAttribute("data-trial-type-form", "1");
    form.style.marginTop = "8px";
    form.style.padding = "8px";
    form.style.background = "#fafafa";
    form.style.border = "1px solid #eee";
    form.style.borderRadius = "4px";

    const selRow = document.createElement("div");
    selRow.className = "row";
    const selLab = document.createElement("label");
    selLab.textContent = `Trial type for ${field.label}`;
    const sel = document.createElement("select");
    sel.name = "trial_type";
    const emptyOpt = document.createElement("option");
    emptyOpt.value = "";
    emptyOpt.textContent = "— choose —";
    sel.appendChild(emptyOpt);
    for (const [v, info] of Object.entries(TRIAL_TYPE_INFO)) {
      const opt = document.createElement("option");
      opt.value = v;
      opt.textContent = `${v.replace(/_/g, " ")} — ${info.blurb}`;
      sel.appendChild(opt);
    }
    selLab.appendChild(sel);
    selRow.appendChild(selLab);
    form.appendChild(selRow);

    // Conditional inputs host — filled in based on selected type.
    const extrasHost = document.createElement("div");
    form.appendChild(extrasHost);

    function renderExtras(type) {
      extrasHost.replaceChildren();
      if (type === "WHOLE_HISTORICAL") {
        extrasHost.appendChild(makeInputRow("historical_yield_bu_per_ac", "Historical yield (bu/ac) — required", "number", true));
        extrasHost.appendChild(makeInputRow("historical_years_source", "Years / source (e.g. 2023-2025 combine maps)", "text", false));
      } else if (type === "WHOLE_NEIGHBOR") {
        extrasHost.appendChild(makeInputRow("neighbor_field_notes", "Neighbor field notes (same crop, untreated) — required", "text", true));
      }
    }
    sel.addEventListener("change", () => renderExtras(sel.value));

    const submit = document.createElement("button");
    submit.type = "submit";
    submit.textContent = "Save trial type";
    submit.style.marginTop = "6px";
    form.appendChild(submit);

    const statusLine = document.createElement("span");
    statusLine.className = "muted";
    statusLine.style.marginLeft = "10px";
    form.appendChild(statusLine);

    form.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      submit.disabled = true;
      statusLine.textContent = "";
      try {
        const fd = new FormData(form);
        const type = fd.get("trial_type");
        if (!type) throw new Error("Pick a trial type.");
        const extras = {};
        if (type === "WHOLE_HISTORICAL") {
          const raw = fd.get("historical_yield_bu_per_ac");
          if (raw === "" || raw == null) throw new Error("Historical yield is required for WHOLE_HISTORICAL.");
          extras.historical_yield_bu_per_ac = Number(raw);
          const src = fd.get("historical_years_source");
          if (src) extras.historical_years_source = String(src);
        } else if (type === "WHOLE_NEIGHBOR") {
          const notes = fd.get("neighbor_field_notes");
          if (!notes) throw new Error("Neighbor field notes are required for WHOLE_NEIGHBOR.");
          extras.neighbor_field_notes = String(notes);
        }
        statusLine.textContent = "Saving…";
        const { error } = await sb.rpc("farmer_set_trial_type", {
          p_token: token,
          p_field_id: field.id,
          p_type: type,
          p_extras: extras,
        });
        if (error) throw error;
        await refreshState();
      } catch (e) {
        console.error("set trial type failed", e);
        statusLine.textContent = "";
        alert("Failed: " + (e?.message ?? "unknown"));
      } finally {
        submit.disabled = false;
      }
    });

    return form;
  }

  function makeInputRow(name, label, type, required) {
    const row = document.createElement("div");
    row.className = "row";
    const lab = document.createElement("label");
    lab.textContent = label;
    const inp = document.createElement("input");
    inp.name = name;
    inp.type = type;
    if (required) inp.required = true;
    if (type === "number") inp.step = "any";
    lab.appendChild(inp);
    row.appendChild(lab);
    return row;
  }

  document.getElementById("addFieldBtn").addEventListener("click", () => {
    const host = document.getElementById("fieldFormHost");
    if (host.childElementCount > 0) {
      host.replaceChildren();
      return;
    }
    host.appendChild(buildFieldForm());
  });

  function buildFieldForm() {
    const form = document.createElement("form");
    form.style.marginTop = "12px";

    const specs = [
      { name: "label",     label: "Label (e.g. NW quarter)", type: "text",   required: true },
      { name: "crop",      label: "Crop",                     type: "text" },
      { name: "prev_crop", label: "Previous crop",            type: "text" },
      { name: "acres",     label: "Acres",                    type: "number" },
    ];
    for (const spec of specs) {
      const row = document.createElement("div");
      row.className = "row";
      const lab = document.createElement("label");
      lab.textContent = spec.label;
      const inp = document.createElement("input");
      inp.name = spec.name;
      inp.type = spec.type;
      if (spec.required) inp.required = true;
      if (spec.type === "number") inp.step = "any";
      lab.appendChild(inp);
      row.appendChild(lab);
      form.appendChild(row);
    }

    const selRow = document.createElement("div");
    selRow.className = "row";
    const selLab = document.createElement("label");
    selLab.textContent = "Application method";
    const sel = document.createElement("select");
    sel.name = "application_method";
    for (const [v, t] of [["", "—"], ["liquid_seeding", "Liquid at seeding"], ["foliar_spray", "Foliar spray"]]) {
      const opt = document.createElement("option");
      opt.value = v;
      opt.textContent = t;
      sel.appendChild(opt);
    }
    selLab.appendChild(sel);
    selRow.appendChild(selLab);
    form.appendChild(selRow);

    const submit = document.createElement("button");
    submit.type = "submit";
    submit.textContent = "Save field";
    form.appendChild(submit);

    form.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      submit.disabled = true;
      try {
        const fd = new FormData(form);
        const rawAcres = fd.get("acres");
        const patch = {
          label: fd.get("label"),
          crop: fd.get("crop") || null,
          prev_crop: fd.get("prev_crop") || null,
          application_method: fd.get("application_method") || null,
          acres: rawAcres === "" || rawAcres == null ? null : Number(rawAcres),
        };
        const { error } = await sb.rpc("farmer_upsert_field", {
          p_token: token, p_patch: patch,
        });
        if (error) throw error;
        await refreshState();
        document.getElementById("fieldFormHost").replaceChildren();
      } catch (e) {
        console.error("save field failed", e);
        alert("Failed to save: " + (e?.message ?? "unknown"));
      } finally {
        submit.disabled = false;
      }
    });

    return form;
  }

  function renderTimeline(events) {
    const host = document.getElementById("timelineList");
    if (!host) return;
    host.replaceChildren();
    if (!events || events.length === 0) {
      const p = document.createElement("p");
      p.className = "muted";
      p.textContent = "No events yet. Text the Telegram bot or log a lab result above to get started.";
      host.appendChild(p);
      return;
    }
    for (const e of events) {
      const row = document.createElement("div");
      row.className = "timeline-item";
      const badge = document.createElement("span");
      badge.className = "kind-badge";
      badge.textContent = (e.kind || "event").replace(/_/g, " ");
      const stamp = document.createElement("span");
      stamp.className = "muted";
      stamp.textContent = new Date(e.created_at).toLocaleString();
      row.appendChild(badge);
      row.appendChild(stamp);
      const summary = summarizePayload(e.kind, e.payload);
      if (summary) {
        const body = document.createElement("div");
        body.textContent = summary.slice(0, 240);
        row.appendChild(body);
      }
      if (Array.isArray(e.file_urls) && e.file_urls.length > 0) {
        const files = document.createElement("div");
        files.className = "muted";
        files.textContent = `📎 ${e.file_urls.length} file${e.file_urls.length === 1 ? "" : "s"} attached`;
        row.appendChild(files);
      }
      host.appendChild(row);
    }
  }

  function summarizePayload(kind, payload) {
    if (!payload || typeof payload !== "object") return "";
    if (kind === "observation")    return payload.text || "";
    if (kind === "yield")          return payload.bu_per_ac != null ? `${payload.bu_per_ac} bu/ac` : "";
    if (kind === "application")    return payload.applied_at ? `Applied ${new Date(payload.applied_at).toLocaleString()}` : "";
    if (kind === "photo")          return payload.caption || "";
    if (kind === "stand_count")    return payload.plants_per_m2 != null ? `${payload.plants_per_m2} plants/m²` : (payload.text || "");
    if (kind === "protein")        return payload.pct != null ? `${payload.pct}%` : (payload.text || "");
    if (kind === "soil_test")      return payload.text || "Soil test attached";
    if (kind === "moisture_test") {
      // Legacy rows used { pct } or { text } only — keep them readable.
      if (payload.reading_type == null) {
        return payload.pct != null ? `Moisture: ${payload.pct}%` : (payload.text || "");
      }
      // v1 moisture is soil-only: value = push-probe penetration depth (inches),
      // or a qualitative fallback when no probe is available.
      const { value, qualitative, observed_on } = payload;
      const when = observed_on ? ` on ${observed_on}` : "";
      if (qualitative) return `Soil moisture: ${qualitative}${when}`;
      return value != null ? `Soil moisture depth: ${value} in${when}` : `Soil moisture${when}`;
    }
    if (kind === "field_created")  return payload.label ? `Field added: ${payload.label}` : "";
    return payload.text || "";
  }

  function renderEventForm(fields, plots) {
    const host = document.getElementById("eventFormHost");
    if (!host) return;
    host.replaceChildren();

    const form = document.createElement("form");

    const selRow = document.createElement("div");
    selRow.className = "row";

    const kindLab = document.createElement("label");
    kindLab.textContent = "Kind";
    const kindSel = document.createElement("select");
    kindSel.name = "kind";
    for (const [v, t] of [
      ["observation",   "Observation (note)"],
      ["photo",         "Photo"],
      ["yield",         "Yield (bu/ac)"],
      ["soil_test",     "Soil test"],
      ["moisture_test", "Soil moisture"],
      ["stand_count",   "Stand count"],
      ["protein",       "Protein %"],
    ]) {
      const opt = document.createElement("option");
      opt.value = v;
      opt.textContent = t;
      kindSel.appendChild(opt);
    }
    kindLab.appendChild(kindSel);
    selRow.appendChild(kindLab);

    const fieldLab = document.createElement("label");
    fieldLab.textContent = "Field";
    const fieldSel = document.createElement("select");
    fieldSel.name = "field_id";
    const noneOpt = document.createElement("option");
    noneOpt.value = "";
    noneOpt.textContent = "— (signup-level)";
    fieldSel.appendChild(noneOpt);
    for (const f of fields ?? []) {
      const opt = document.createElement("option");
      opt.value = f.id;
      opt.textContent = `${f.label} (${f.crop ?? "?"})`;
      fieldSel.appendChild(opt);
    }
    fieldLab.appendChild(fieldSel);
    selRow.appendChild(fieldLab);

    // Plot picker — only shown when the chosen field has real (non-virtual)
    // plots. Required for yield events so strip/split deltas stay honest.
    const plotLab = document.createElement("label");
    plotLab.textContent = "Plot";
    plotLab.hidden = true;
    const plotSel = document.createElement("select");
    plotSel.name = "plot_id";
    plotLab.appendChild(plotSel);
    selRow.appendChild(plotLab);

    function refreshPlotOptions() {
      const fieldId = fieldSel.value || null;
      const realPlots = fieldId
        ? plotsForField(plots, fieldId).filter((p) => !p.is_virtual)
        : [];
      plotSel.replaceChildren();
      if (realPlots.length === 0) {
        plotLab.hidden = true;
        return;
      }
      plotLab.hidden = false;
      const blank = document.createElement("option");
      blank.value = "";
      blank.textContent = kindSel.value === "yield" ? "— pick plot (required) —" : "— whole field —";
      plotSel.appendChild(blank);
      for (const p of realPlots) {
        const opt = document.createElement("option");
        opt.value = p.id;
        opt.textContent = `${p.label} (${p.role})`;
        plotSel.appendChild(opt);
      }
    }
    fieldSel.addEventListener("change", refreshPlotOptions);
    kindSel.addEventListener("change", refreshPlotOptions);

    form.appendChild(selRow);

    // Soil moisture sub-form. kind='moisture_test' captures push-probe
    // readings: the number IS the depth the probe penetrated before
    // hitting dry soil (inches). Qualitative fallback (dry/adequate/wet)
    // is available when no probe is on hand. Payload shape is frozen at
    // { reading_type: "soil", value, unit: "in", qualitative?, observed_on,
    // notes } for forward-compat with aggregators that key on reading_type.
    const moistureBlock = document.createElement("div");
    moistureBlock.hidden = true;

    const mDateRow = document.createElement("div");
    mDateRow.className = "row";
    const mDateLab = document.createElement("label");
    mDateLab.textContent = "Observed on";
    const mDateInp = document.createElement("input");
    mDateInp.type = "date";
    mDateInp.name = "moisture_observed_on";
    mDateInp.valueAsDate = new Date();
    mDateLab.appendChild(mDateInp);
    mDateRow.appendChild(mDateLab);
    moistureBlock.appendChild(mDateRow);

    const mValRow = document.createElement("div");
    mValRow.className = "row";
    const mValLab = document.createElement("label");
    mValLab.textContent = "Probe depth (in)";
    const mValInp = document.createElement("input");
    mValInp.type = "number";
    mValInp.step = "0.1";
    mValInp.min = "0";
    mValInp.name = "moisture_value";
    mValInp.placeholder = "e.g. 18";
    mValLab.appendChild(mValInp);
    mValRow.appendChild(mValLab);
    moistureBlock.appendChild(mValRow);

    const mQualRow = document.createElement("div");
    mQualRow.className = "row";
    const mQualLab = document.createElement("label");
    mQualLab.textContent = "No probe? Describe";
    const mQualSel = document.createElement("select");
    mQualSel.name = "moisture_qualitative";
    for (const [v, t] of [
      ["",         "— use depth above —"],
      ["dry",      "Dry"],
      ["adequate", "Adequate"],
      ["wet",      "Wet"],
    ]) {
      const opt = document.createElement("option");
      opt.value = v; opt.textContent = t;
      mQualSel.appendChild(opt);
    }
    mQualLab.appendChild(mQualSel);
    mQualRow.appendChild(mQualLab);
    moistureBlock.appendChild(mQualRow);

    // Depth is required UNLESS the farmer picked a qualitative bucket.
    function refreshMoistureFields() {
      mValInp.required = !mQualSel.value;
    }
    mQualSel.addEventListener("change", refreshMoistureFields);
    refreshMoistureFields();

    form.appendChild(moistureBlock);

    const noteRow = document.createElement("div");
    noteRow.className = "row";
    const noteLab = document.createElement("label");
    noteLab.textContent = "Notes / value";
    const noteInp = document.createElement("textarea");
    noteInp.name = "note";
    noteInp.rows = 3;
    noteLab.appendChild(noteInp);
    noteRow.appendChild(noteLab);
    form.appendChild(noteRow);

    // Toggle moistureBlock vs generic note row visibility based on kind.
    // noteLab was built with textContent then had the <textarea> appended,
    // so noteLab.firstChild is the text node — safe to retarget its value.
    function refreshKindSections() {
      const isMoisture = kindSel.value === "moisture_test";
      moistureBlock.hidden = !isMoisture;
      noteLab.firstChild.nodeValue = isMoisture ? "Notes (optional)" : "Notes / value";
    }
    kindSel.addEventListener("change", refreshKindSections);
    refreshKindSections();

    const fileRow = document.createElement("div");
    fileRow.className = "row";
    const fileLab = document.createElement("label");
    fileLab.textContent = "Attach PDF / photo (optional)";
    const fileInp = document.createElement("input");
    fileInp.type = "file";
    fileInp.name = "file";
    fileInp.accept = "application/pdf,image/*";
    fileLab.appendChild(fileInp);
    fileRow.appendChild(fileLab);
    form.appendChild(fileRow);

    // Public-consent opt-in. Only photos currently surface on the public dashboard
    // (20260420000001_bio_trial_dashboard_expand.sql gates on kind='photo' AND
    // public_opt_in=true), but we capture consent on every event so the ledger can
    // widen later without re-prompting farmers.
    const publicRow = document.createElement("div");
    publicRow.className = "row";
    const publicLab = document.createElement("label");
    publicLab.style.display = "flex";
    publicLab.style.alignItems = "center";
    publicLab.style.gap = "8px";
    const publicInp = document.createElement("input");
    publicInp.type = "checkbox";
    publicInp.name = "public_opt_in";
    publicInp.style.width = "auto";
    const publicText = document.createElement("span");
    publicText.textContent = "OK to feature this on the public trial dashboard (no farm or farmer name shown — only province + crop).";
    publicLab.appendChild(publicInp);
    publicLab.appendChild(publicText);
    publicRow.appendChild(publicLab);
    form.appendChild(publicRow);

    const submit = document.createElement("button");
    submit.type = "submit";
    submit.textContent = "Log event";
    form.appendChild(submit);

    const statusLine = document.createElement("span");
    statusLine.className = "muted";
    statusLine.style.marginLeft = "10px";
    form.appendChild(statusLine);

    form.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      submit.disabled = true;
      statusLine.textContent = "";
      try {
        const fd       = new FormData(form);
        const kind     = fd.get("kind");
        const fieldId  = fd.get("field_id") || null;
        const plotId   = fd.get("plot_id") || null;
        const note     = String(fd.get("note") ?? "");
        const publicOk = fd.get("public_opt_in") === "on";
        const file     = fileInp.files?.[0] ?? null;

        if (kind === "photo" && !file) {
          throw new Error("Attach a photo before logging a Photo event.");
        }

        // A yield event without a field can't land in any per-crop/per-tier
        // bucket on the public scoreboard (get_trial_dashboard joins on
        // trial_fields), but it DID pad the headline "Yield reports" tile —
        // the aggregate and the count disagreed. Reject field-less yields at
        // submit so the two sides stay consistent. The RPC enforces the same
        // check server-side in 20260420000007_yield_field_required_and_hide_tiered.sql.
        if (kind === "yield" && !fieldId) {
          throw new Error("Pick the field this yield came from — yields need a field to be counted on the scoreboard.");
        }

        // Strip/split deltas depend on knowing which plot each yield came from.
        // If the field has plots and the farmer didn't pick one, reject.
        if (kind === "yield" && fieldId) {
          const real = plotsForField(plots, fieldId).filter((p) => !p.is_virtual);
          if (real.length > 0 && !plotId) {
            throw new Error("Pick which plot this yield came from (required for strip/split trials).");
          }
        }

        let payload;
        if (kind === "photo") {
          payload = { caption: note };
        } else if (kind === "yield") {
          const num = Number(note.trim());
          if (!isFinite(num) || num <= 0) {
            throw new Error("Enter bushels per acre as a number in Notes / value.");
          }
          payload = { bu_per_ac: num };
        } else if (kind === "moisture_test") {
          const obsOn    = String(fd.get("moisture_observed_on") || "");
          const valueRaw = String(fd.get("moisture_value") || "").trim();
          const qual     = String(fd.get("moisture_qualitative") || "");

          if (!obsOn) throw new Error("Pick the date the reading was taken.");

          // Soil moisture: value IS push-probe penetration depth in inches.
          // Qualitative bucket substitutes when no probe is available.
          const hasQual = qual !== "";
          let value = null;
          if (!hasQual) {
            const n = Number(valueRaw);
            if (!isFinite(n) || n <= 0) {
              throw new Error("Enter the probe depth in inches, or pick Dry/Adequate/Wet if you don't have a probe.");
            }
            value = n;
          }

          payload = {
            reading_type: "soil",
            value: value,
            unit: hasQual ? null : "in",
            qualitative: hasQual ? qual : null,
            observed_on: obsOn,
            notes: note || "",
          };
        } else {
          payload = { text: note };
        }

        let fileUrls = [];
        if (file) {
          statusLine.textContent = "Uploading…";
          fileUrls = await uploadViaEdge(file);
        }

        statusLine.textContent = "Saving…";
        const { error } = await sb.rpc("farmer_register_event", {
          p_token: token,
          p_kind: kind,
          p_field_id: fieldId,
          p_plot_id: plotId,
          p_payload: payload,
          p_file_urls: fileUrls,
          p_public_opt_in: publicOk,
        });
        if (error) throw error;

        form.reset();
        await refreshState();
        statusLine.textContent = "Saved ✓";
        setTimeout(() => { statusLine.textContent = ""; }, 2500);
      } catch (e) {
        console.error("log event failed", e);
        statusLine.textContent = "";
        alert("Failed: " + (e?.message ?? "unknown"));
      } finally {
        submit.disabled = false;
      }
    });

    host.appendChild(form);
  }

  // Upload via the bio-trial-farmer-upload-url edge function (T11 pivot).
  // Returns [storagePath] on success; throws on error.
  async function uploadViaEdge(file) {
    const fnUrl = `${SB_CFG.url}/functions/v1/bio-trial-farmer-upload-url`;
    const res = await fetch(fnUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SB_CFG.anonKey,
        "Authorization": `Bearer ${SB_CFG.anonKey}`,
      },
      body: JSON.stringify({ token, filename: file.name }),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok || !body || !body.signedUrl || !body.path) {
      throw new Error(body?.error || `upload-url failed (${res.status})`);
    }
    const putRes = await fetch(body.signedUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type || "application/octet-stream" },
      body: file,
    });
    if (!putRes.ok) throw new Error(`PUT failed (${putRes.status})`);
    return [body.path];
  }

  async function refreshState() {
    const { data, error } = await sb.rpc("farmer_bootstrap", { p_token: token });
    if (error) throw error;
    window.FARMER_STATE = data;
    renderFields(data.fields || [], data.plots || []);
    renderTimeline(data.events || []);
    renderEventForm(data.fields || [], data.plots || []);
  }
})();
