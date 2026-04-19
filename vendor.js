/* =========================================================
   SixRing Vendor Desk — login + signup management
   ========================================================= */

(function () {
  "use strict";

  const SB_CFG = window.__BIO_TRIAL_SUPABASE__ || {};
  if (!window.supabase || !SB_CFG.url || !SB_CFG.anonKey) {
    const p = document.createElement("p");
    p.style.cssText = "color:#f5ecd6;padding:40px";
    p.textContent = "Supabase client missing.";
    document.body.replaceChildren(p);
    return;
  }
  const sb = window.supabase.createClient(SB_CFG.url, SB_CFG.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true }
  });

  const loginView   = document.getElementById("loginView");
  const dashView    = document.getElementById("dashView");
  const loginForm   = document.getElementById("loginForm");
  const loginBtn    = document.getElementById("loginBtn");
  const loginErr    = document.getElementById("loginErr");
  const whoEmail    = document.getElementById("whoEmail");
  const signoutBtn  = document.getElementById("signoutBtn");
  const signupsBody = document.getElementById("signupsBody");
  const statCount     = document.getElementById("statCount");
  const statPaid      = document.getElementById("statPaid");
  const statDelivered = document.getElementById("statDelivered");
  const statLiters    = document.getElementById("statLiters");

  // ---- boot ----
  sb.auth.getSession().then(({ data }) => {
    if (data.session) enterDashboard(data.session);
    else showLogin();
  });

  sb.auth.onAuthStateChange((_evt, session) => {
    if (session) enterDashboard(session);
    else showLogin();
  });

  // ---- login ----
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    loginErr.hidden = true;
    loginBtn.disabled = true;
    const fd = new FormData(loginForm);
    const email = (fd.get("email") || "").toString().trim();
    const password = (fd.get("password") || "").toString();

    const { error } = await sb.auth.signInWithPassword({ email, password });
    loginBtn.disabled = false;
    if (error) {
      loginErr.textContent = error.message || "Sign-in failed.";
      loginErr.hidden = false;
    }
  });

  signoutBtn.addEventListener("click", async () => {
    await sb.auth.signOut();
  });

  function showLogin() {
    loginView.hidden = false;
    dashView.hidden = true;
  }

  async function enterDashboard(session) {
    loginView.hidden = true;
    dashView.hidden = false;
    whoEmail.textContent = session.user?.email || "";
    await loadSignups();
  }

  // ---- data load ----
  async function loadSignups() {
    setSpinner("loading…");
    const { data, error } = await sb.rpc("list_bio_trial_signups");
    if (error) {
      const msg = (error.message || "").includes("not authorised")
        ? "Not authorised. Your user hasn't been added to bio_trial.vendor_users yet."
        : "Error: " + (error.message || "unknown");
      setSpinner(msg);
      return;
    }
    renderRows(Array.isArray(data) ? data : []);
  }

  function setSpinner(text) {
    signupsBody.replaceChildren();
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 7;
    td.className = "spinner";
    td.textContent = text;
    tr.appendChild(td);
    signupsBody.appendChild(tr);
  }

  function renderRows(rows) {
    updateStats(rows);
    signupsBody.replaceChildren();
    if (!rows.length) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 7;
      td.className = "spinner muted";
      td.textContent = "No signups yet.";
      tr.appendChild(td);
      signupsBody.appendChild(tr);
      return;
    }
    rows.forEach(r => signupsBody.appendChild(rowEl(r)));
  }

  function updateStats(rows) {
    statCount.textContent = rows.length;
    statPaid.textContent = rows.filter(r => r.payment_status === "paid").length;
    statDelivered.textContent = rows.filter(r => r.product_delivered_at).length;
    const liters = rows.reduce((sum, r) => sum + (Number(r.liters_purchased) || 0), 0);
    statLiters.textContent = liters ? liters.toFixed(1) : "0";
  }

  // ---- helpers to build cells ----
  function el(tag, attrs, ...children) {
    const n = document.createElement(tag);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (v == null || v === false) continue;
        if (k === "class") n.className = v;
        else if (k === "style") n.style.cssText = v;
        else if (k === "text") n.textContent = v;
        else if (k === "dataset") Object.assign(n.dataset, v);
        else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
        else if (k in n) n[k] = v;
        else n.setAttribute(k, v);
      }
    }
    for (const c of children) {
      if (c == null || c === false) continue;
      n.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    }
    return n;
  }

  function rowEl(r) {
    const tr = document.createElement("tr");
    if (r.product_delivered_at) tr.classList.add("delivered");
    tr.dataset.id = r.id;

    const signedUp = r.created_at ? new Date(r.created_at) : null;
    const signedUpDate = signedUp
      ? signedUp.toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" })
      : "—";
    const signedUpTime = signedUp
      ? signedUp.toLocaleTimeString("en-CA", { hour: "2-digit", minute: "2-digit" })
      : "";

    // Signed up cell
    tr.appendChild(el("td", null,
      el("div", null, signedUpDate),
      el("div", { class: "muted", style: "font-size:11px" }, signedUpTime)
    ));

    // Farmer cell
    const crops = Array.isArray(r.crops) ? r.crops.join(", ") : "";
    const cropsLine = crops + (r.crops_other ? " · " + r.crops_other : "");
    const farmerTd = el("td", { class: "farmer" },
      el("div", { class: "name" }, r.name || ""),
      el("div", { class: "farm" }, r.farm_name || ""),
      el("div", { class: "email" },
        (r.email || "") + (r.phone ? " · " + r.phone : "")
      )
    );
    if (cropsLine.trim()) {
      farmerTd.appendChild(el("div",
        { class: "muted", style: "font-size:11px;margin-top:3px" },
        cropsLine
      ));
    }
    tr.appendChild(farmerTd);

    // Region cell
    const regionTd = el("td", null, r.province_state || "—");
    if (r.rm_county) {
      regionTd.appendChild(el("div", { class: "muted", style: "font-size:11px" }, r.rm_county));
    }
    tr.appendChild(regionTd);

    // Logistics cell
    const logisticsLabel = r.logistics_method === "ship"
      ? `Ship to ${[r.delivery_city, r.delivery_postal].filter(Boolean).join(" ")}`
      : r.logistics_method === "pickup_fob_calgary" ? "Pickup — FOB Calgary" : "—";
    tr.appendChild(el("td", null, logisticsLabel));

    // Requested acres
    tr.appendChild(el("td", null, Number(r.acres_requested || 0).toLocaleString("en-CA")));

    // Status chips
    tr.appendChild(buildStatusCell(r));

    // Vendor actions
    tr.appendChild(el("td", null, buildVendorCell(r)));

    return tr;
  }

  function buildStatusCell(r) {
    const td = document.createElement("td");
    const paidClass = r.payment_status === "paid" ? "paid" : "pending";
    td.appendChild(el("span", { class: "chip " + paidClass }, r.payment_status || "pending"));
    if (r.product_delivered_at) {
      td.appendChild(document.createTextNode(" "));
      td.appendChild(el("span", { class: "chip delivered" }, "delivered"));
    }
    if (r.access_granted_at) {
      const d = new Date(r.access_granted_at);
      const note = el("div",
        { class: "muted", style: "font-size:11px;margin-top:4px" },
        "access granted"
      );
      note.appendChild(el("br"));
      note.appendChild(document.createTextNode(d.toLocaleDateString("en-CA")));
      td.appendChild(note);
    }
    return td;
  }

  function buildVendorCell(r) {
    const wrap = el("div", { class: "vendor-cell" });

    const initialPaid      = r.payment_status === "paid";
    const initialLiters    = r.liters_purchased != null ? String(r.liters_purchased) : "";
    const initialDelivered = !!r.product_delivered_at;

    const paidChk      = el("input", { type: "checkbox", class: "chk-paid", checked: initialPaid });
    const deliveredChk = el("input", { type: "checkbox", class: "chk-delivered", checked: initialDelivered });
    const litersInput  = el("input", {
      type: "number", step: "0.5", min: "0", class: "liters",
      placeholder: "liters", value: initialLiters
    });
    const acresOut = el("span", { class: "acres-computed" });
    const saveBtn  = el("button", { type: "button", class: "save-btn", disabled: true }, "Save");
    const flash    = el("div", { class: "saved-flash", hidden: true }, "✓ saved");
    const errBox   = el("div", { class: "err", hidden: true });

    wrap.appendChild(el("label", null, paidChk, " Paid"));
    wrap.appendChild(el("div", { class: "liters-row" },
      litersInput, el("span", null, "L"), acresOut
    ));
    wrap.appendChild(el("label", null, deliveredChk, " Delivered"));
    wrap.appendChild(saveBtn);
    wrap.appendChild(flash);
    wrap.appendChild(errBox);

    function refreshAcres() {
      const l = parseFloat(litersInput.value);
      acresOut.textContent = (isFinite(l) && l > 0)
        ? `→ ${(l * 2).toLocaleString("en-CA")} ac`
        : "";
    }
    refreshAcres();

    function markDirty() {
      const dirty =
        paidChk.checked !== initialPaid ||
        deliveredChk.checked !== initialDelivered ||
        (litersInput.value.trim() !== initialLiters.trim());
      saveBtn.disabled = !dirty;
      saveBtn.dataset.dirty = dirty ? "true" : "false";
      flash.hidden = true;
      errBox.hidden = true;
    }

    paidChk.addEventListener("change", markDirty);
    deliveredChk.addEventListener("change", markDirty);
    litersInput.addEventListener("input", () => { refreshAcres(); markDirty(); });

    saveBtn.addEventListener("click", async () => {
      saveBtn.disabled = true;
      errBox.hidden = true;
      const litersRaw = litersInput.value.trim();
      const liters = litersRaw === "" ? null : parseFloat(litersRaw);
      if (litersRaw !== "" && (!isFinite(liters) || liters < 0)) {
        errBox.textContent = "Liters must be a number ≥ 0.";
        errBox.hidden = false;
        saveBtn.disabled = false;
        return;
      }
      const patch = {
        paid:      paidChk.checked,
        liters:    liters,
        delivered: deliveredChk.checked
      };
      const { error } = await sb.rpc("vendor_update_bio_trial_signup", {
        p_signup_id: r.id,
        p_patch:     patch
      });
      if (error) {
        errBox.textContent = error.message || "Save failed.";
        errBox.hidden = false;
        saveBtn.disabled = false;
        return;
      }
      flash.hidden = false;
      saveBtn.dataset.dirty = "false";
      setTimeout(loadSignups, 400);
    });

    return wrap;
  }

})();
