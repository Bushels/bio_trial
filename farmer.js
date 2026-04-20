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
    renderFields(state.fields || []);
    renderTimeline(state.events || []);
    renderEventForm(state.fields || []);
    document.getElementById("signupSummary").hidden = false;
    document.getElementById("telegramSection").hidden = false;
    document.getElementById("fieldsSection").hidden = false;
    document.getElementById("eventSection").hidden = false;
    document.getElementById("timelineSection").hidden = false;
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

  function renderFields(fields) {
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
      const meta = document.createElement("div");
      meta.className = "muted";
      const bits = [
        f.acres ? `${f.acres} ac` : null,
        f.application_method ? f.application_method.replace(/_/g, " ") : null,
      ].filter(Boolean);
      meta.textContent = bits.length ? bits.join(" · ") : "no details";
      card.appendChild(title);
      card.appendChild(meta);
      host.appendChild(card);
    }
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
    if (kind === "moisture_test")  return payload.pct != null ? `${payload.pct}% moisture` : (payload.text || "");
    if (kind === "field_created")  return payload.label ? `Field added: ${payload.label}` : "";
    return payload.text || "";
  }

  function renderEventForm(fields) {
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
      ["soil_test",     "Soil test"],
      ["moisture_test", "Moisture test"],
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
    form.appendChild(selRow);

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
        const note     = String(fd.get("note") ?? "");
        const file     = fileInp.files?.[0] ?? null;

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
          p_payload: { text: note },
          p_file_urls: fileUrls,
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
    renderFields(data.fields || []);
    renderTimeline(data.events || []);
    renderEventForm(data.fields || []);
  }
})();
