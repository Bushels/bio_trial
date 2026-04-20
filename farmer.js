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

  // Stubs — implemented in T20 (fields CRUD + event form + uploads)
  function renderFields(_fields) {
    const host = document.getElementById("fieldsList");
    if (!host) return;
    host.replaceChildren();
    const p = document.createElement("p");
    p.className = "muted";
    p.textContent = "Field CRUD wiring lands in the next pass.";
    host.appendChild(p);
  }

  function renderTimeline(events) {
    const host = document.getElementById("timelineList");
    if (!host) return;
    host.replaceChildren();
    if (!events.length) {
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
      badge.textContent = e.kind || "event";
      const stamp = document.createElement("span");
      stamp.className = "muted";
      stamp.textContent = new Date(e.created_at).toLocaleString();
      row.appendChild(badge);
      row.appendChild(stamp);
      const payloadText = summarizePayload(e.kind, e.payload);
      if (payloadText) {
        const body = document.createElement("div");
        body.textContent = payloadText;
        row.appendChild(body);
      }
      host.appendChild(row);
    }
  }

  function summarizePayload(kind, payload) {
    if (!payload || typeof payload !== "object") return "";
    if (kind === "observation") return payload.text || "";
    if (kind === "yield")       return `${payload.bu_per_ac} bu/ac`;
    if (kind === "application") return payload.applied_at ? `Applied ${new Date(payload.applied_at).toLocaleString()}` : "";
    if (kind === "photo")       return payload.caption || "";
    return "";
  }

  function renderEventForm(_fields) {
    const host = document.getElementById("eventFormHost");
    if (!host) return;
    host.replaceChildren();
    const p = document.createElement("p");
    p.className = "muted";
    p.textContent = "Event form + photo upload land in the next pass.";
    host.appendChild(p);
  }
})();
