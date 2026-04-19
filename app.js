/* =========================================================
   Buperac Bio Trial — interactions
   ========================================================= */

(function () {
  "use strict";

  const TW = Object.assign(
    { deskTone: "warm", grain: "subtle", accent: "both", sound: "off", odoStart: 0 },
    window.__TWEAKS__ || {}
  );

  // ----- Supabase client -----
  const SB_CFG = window.__BIO_TRIAL_SUPABASE__ || {};
  const sb = (window.supabase && SB_CFG.url && SB_CFG.anonKey)
    ? window.supabase.createClient(SB_CFG.url, SB_CFG.anonKey)
    : null;
  if (!sb) console.warn("[bio-trial] Supabase client not initialised — signup will be disabled.");

  // ----- Apply initial tweak state to <body> attrs -----
  function applyTweaks() {
    document.body.dataset.desk = TW.deskTone;
    document.body.dataset.grain = TW.grain;
    document.body.dataset.accent = TW.accent;
  }
  applyTweaks();

  // ==============================================
  // CROPS (multiselect w/ hand-drawn checkboxes)
  // ==============================================
  const CROPS = [
    "Canola", "Spring Wheat", "Durum", "Barley",
    "Oats", "Field Peas", "Lentils", "Soybeans",
    "Corn", "Flax", "Hay / Forage", "Other"
  ];
  const cropGrid = document.getElementById("cropGrid");
  CROPS.forEach((c, i) => {
    const id = "crop_" + i;
    const label = document.createElement("label");
    label.className = "crop";
    label.innerHTML = `
      <input type="checkbox" id="${id}" name="crops" value="${c}">
      <span class="crop-box" aria-hidden="true"></span>
      <span class="crop-text">${c}</span>
    `;
    cropGrid.appendChild(label);
  });
  const otherCb = cropGrid.querySelector('input[value="Other"]');
  const otherField = document.getElementById("otherField");
  otherCb.addEventListener("change", () => {
    otherField.hidden = !otherCb.checked;
    if (otherCb.checked) {
      setTimeout(() => otherField.querySelector("input").focus(), 50);
    }
  });

  // ==============================================
  // PRICING — $2.80/ac live subtotal
  // ==============================================
  const PRICE_PER_ACRE_CENTS = 280;
  const acresInput = document.getElementById("acresInput");
  const acresSubtotalAmt = document.getElementById("acresSubtotalAmt");
  const fmtMoney = (cents) =>
    new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 })
      .format(cents / 100);
  function updateSubtotal() {
    const a = parseInt(acresInput.value, 10);
    acresSubtotalAmt.textContent = (a && a > 0) ? fmtMoney(a * PRICE_PER_ACRE_CENTS) : "—";
  }
  acresInput.addEventListener("input", updateSubtotal);
  updateSubtotal();

  // ==============================================
  // LOGISTICS — toggle ship-address block
  // ==============================================
  const logisticsInputs = document.querySelectorAll('input[name="logistics"]');
  const shipBlock = document.getElementById("shipBlock");
  const shipInputs = shipBlock.querySelectorAll('input');
  function syncShipBlock() {
    const choice = Array.from(logisticsInputs).find(r => r.checked)?.value;
    const isShip = choice === "ship";
    shipBlock.hidden = !isShip;
    shipInputs.forEach(i => { i.required = isShip; });
  }
  logisticsInputs.forEach(r => r.addEventListener("change", syncShipBlock));
  syncShipBlock();

  // ==============================================
  // ODOMETER
  // ==============================================
  const DIGITS = 6;
  const digitsEl = document.getElementById("odo-digits");
  const drums = [];
  const DRUM_H = () => drums[0] ? drums[0].drum.getBoundingClientRect().height : 64;

  // Build drums, each with a strip of 0..9 then a repeated 0 (for a smooth wrap)
  for (let i = 0; i < DIGITS; i++) {
    const drum = document.createElement("div");
    drum.className = "odo-drum";
    const strip = document.createElement("div");
    strip.className = "odo-strip";
    // Put 0..9 then a trailing 0 for clean rollovers
    for (let n = 0; n <= 10; n++) {
      const s = document.createElement("span");
      s.textContent = (n % 10).toString();
      strip.appendChild(s);
    }
    drum.appendChild(strip);
    digitsEl.appendChild(drum);
    drums.push({ drum, strip, current: 0 });
  }

  // Set initial value (no animation)
  let currentAcres = Math.max(0, Math.min(999999, parseInt(TW.odoStart, 10) || 0));
  setDigitsImmediate(currentAcres);

  // Fetch real current total from Supabase and roll up to it
  if (sb) {
    sb.rpc("get_bio_trial_acres").then(({ data, error }) => {
      if (error) { console.warn("[bio-trial] get_bio_trial_acres failed:", error); return; }
      const total = parseInt(data, 10) || 0;
      if (total !== currentAcres) rollTo(total);
    });
  }

  function setDigitsImmediate(value) {
    const s = String(value).padStart(DIGITS, "0");
    for (let i = 0; i < DIGITS; i++) {
      const digit = parseInt(s[i], 10);
      drums[i].current = digit;
      drums[i].strip.style.transition = "none";
      drums[i].strip.style.transform = `translateY(${-digit * DRUM_H()}px)`;
    }
    // re-flow
    void drums[0].strip.offsetHeight;
  }

  // Roll from currentAcres up to newValue with staggered motion
  function rollTo(newValue, opts = {}) {
    newValue = Math.max(0, Math.min(999999, Math.floor(newValue)));
    if (newValue === currentAcres) return;

    const from = currentAcres;
    const to = newValue;
    currentAcres = to;

    // Determine, for each column (left=0..right=5), how many ticks we should pass through.
    // We want the ones to spin fastest. We compute the final digit for each column,
    // and additionally add "extra spins" to columns proportional to their position.
    const fromStr = String(from).padStart(DIGITS, "0");
    const toStr   = String(to).padStart(DIGITS, "0");

    const baseDuration = opts.quick ? 600 : 1800;
    const upward = to > from;

    for (let i = 0; i < DIGITS; i++) {
      const fromD = parseInt(fromStr[i], 10);
      const toD   = parseInt(toStr[i], 10);
      // delta number of ticks traveled (allow wrap via +10)
      let ticks;
      if (upward) {
        ticks = (toD - fromD + 10) % 10;
        if (ticks === 0 && fromD !== toD) ticks = 10;
      } else {
        ticks = (fromD - toD + 10) % 10;
      }

      // extra full rotations for columns further left (so it feels mechanical).
      // Rightmost column (ones) gets no extras; each leftward column gets fewer extras.
      // Actually we want ONES to spin the most. column index goes left->right: 0..5, rightmost=5 (ones).
      const colFromRight = DIGITS - 1 - i; // 0 for ones, up to 5 for hundred-thousands
      const extraSpins = Math.max(0, 3 - colFromRight); // ones +3, tens +2, hundreds +1, thousands 0
      const totalTicks = ticks + extraSpins * 10;

      // Duration: rightmost column (ones) finishes *last* so the motion settles left-to-right,
      // like a real odometer: leftmost settles first, rightmost keeps spinning.
      // => delay INCREASES as colFromRight decreases (i increases toward right).
      const delay = (DIGITS - 1 - colFromRight) * 40; // leftmost first
      const duration = baseDuration + colFromRight * 220; // ones longest

      animateColumn(i, fromD, totalTicks, duration, delay);
    }

    // Mechanical ticks SFX
    scheduleTicks(baseDuration, from !== to);

    // flavor: ka-chunk at end
    if (TW.sound === "on") {
      setTimeout(() => playKachunk(), baseDuration + 600);
    }
  }

  function animateColumn(i, fromD, totalTicks, duration, delay) {
    const col = drums[i];
    const h = DRUM_H();
    // we always travel DOWN visually (strip moves up). Start from fromD, end after totalTicks positions.
    // To make it look continuous we first reset strip position to fromD*h (without transition),
    // then animate to (fromD + totalTicks) * h.
    const startY = -fromD * h;
    const endY = -(fromD + totalTicks) * h;

    col.strip.style.transition = "none";
    col.strip.style.transform = `translateY(${startY}px)`;
    // force reflow
    void col.strip.offsetHeight;

    setTimeout(() => {
      col.strip.style.transition = `transform ${duration}ms cubic-bezier(.18,.85,.2,1.02)`;
      col.strip.style.transform = `translateY(${endY}px)`;
      // when done, snap back to final digit without transition so future rolls start clean
      setTimeout(() => {
        const finalD = ((fromD + totalTicks) % 10 + 10) % 10;
        col.strip.style.transition = "none";
        col.strip.style.transform = `translateY(${-finalD * h}px)`;
        col.current = finalD;
      }, duration + 30);
    }, delay);
  }

  // subtle breathing — ones wheel nudges a hair every ~15s
  function breathe() {
    const col = drums[DIGITS - 1];
    if (!col) return;
    const h = DRUM_H();
    const baseY = -col.current * h;
    col.strip.style.transition = "transform 1.2s cubic-bezier(.4,1.4,.5,1)";
    col.strip.style.transform = `translateY(${baseY - 3}px)`;
    setTimeout(() => {
      col.strip.style.transition = "transform 1.4s cubic-bezier(.4,1.4,.5,1)";
      col.strip.style.transform = `translateY(${baseY}px)`;
    }, 700);
  }
  setInterval(breathe, 14000 + Math.random() * 3000);

  // ---- Sound (very quiet synthesized tick + ka-chunk via WebAudio) ----
  let audioCtx = null;
  function ensureAudio() {
    if (!audioCtx) {
      try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch {}
    }
    return audioCtx;
  }
  function playTick() {
    if (TW.sound !== "on") return;
    const ctx = ensureAudio(); if (!ctx) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "square"; o.frequency.value = 1400 + Math.random() * 300;
    g.gain.value = 0.0001;
    o.connect(g).connect(ctx.destination);
    const t = ctx.currentTime;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.04, t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    o.start(t); o.stop(t + 0.06);
  }
  function playKachunk() {
    const ctx = ensureAudio(); if (!ctx) return;
    const t = ctx.currentTime;
    // low thump
    const o1 = ctx.createOscillator(); const g1 = ctx.createGain();
    o1.type = "sine"; o1.frequency.setValueAtTime(120, t); o1.frequency.exponentialRampToValueAtTime(55, t + 0.18);
    g1.gain.setValueAtTime(0.0001, t); g1.gain.exponentialRampToValueAtTime(0.12, t + 0.01); g1.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    o1.connect(g1).connect(ctx.destination); o1.start(t); o1.stop(t + 0.25);
    // click
    const o2 = ctx.createOscillator(); const g2 = ctx.createGain();
    o2.type = "square"; o2.frequency.value = 800;
    g2.gain.setValueAtTime(0.0001, t + 0.08); g2.gain.exponentialRampToValueAtTime(0.05, t + 0.085); g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
    o2.connect(g2).connect(ctx.destination); o2.start(t + 0.08); o2.stop(t + 0.14);
  }
  function scheduleTicks(duration, on) {
    if (!on || TW.sound !== "on") return;
    const count = Math.min(26, Math.floor(duration / 55));
    for (let i = 0; i < count; i++) {
      setTimeout(playTick, i * (duration / count));
    }
  }

  // ==============================================
  // SIMULATE a new signup (button below odo)
  // ==============================================
  document.getElementById("simBtn").addEventListener("click", () => {
    const bump = Math.floor(20 + Math.random() * 180); // 20-200 acres
    rollTo(currentAcres + bump);
  });

  // ==============================================
  // FORM SUBMIT
  // ==============================================
  const form = document.getElementById("trialForm");
  const successEl = document.getElementById("formSuccess");
  const submitBtn = form.querySelector('button[type="submit"], .stamp-btn, .submit-stamp');

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = new FormData(form);

    const acres = parseInt(data.get("acres"), 10);
    const crops = data.getAll("crops");
    const logistics_method = (data.get("logistics") || "").toString();
    const payload = {
      name: (data.get("name") || "").toString().trim(),
      farm_name: (data.get("farm") || "").toString().trim(),
      email: (data.get("email") || "").toString().trim(),
      phone: (data.get("phone") || "").toString().trim(),
      province_state: (data.get("region") || "").toString().trim(),
      rm_county: (data.get("rm") || "").toString().trim(),
      crops,
      crops_other: (data.get("other_crop") || "").toString().trim(),
      acres,
      logistics_method,
      delivery_street: (data.get("delivery_street") || "").toString().trim(),
      delivery_city:   (data.get("delivery_city")   || "").toString().trim(),
      delivery_postal: (data.get("delivery_postal") || "").toString().trim(),
      source: "landing_page"
    };

    // Client-side guards — keep the UX clean, server still validates
    const missing = [];
    if (!payload.name) missing.push("name");
    if (!payload.farm_name) missing.push("farm name");
    if (!payload.email) missing.push("email");
    if (!payload.province_state) missing.push("province/state");
    if (!crops.length) missing.push("at least one crop");
    if (!acres || acres < 1) missing.push("acres");
    if (!logistics_method) missing.push("pickup or shipping choice");
    if (logistics_method === "ship") {
      if (!payload.delivery_street) missing.push("delivery street");
      if (!payload.delivery_city) missing.push("delivery city");
      if (!payload.delivery_postal) missing.push("delivery postal code");
    }
    if (missing.length) {
      alert("Please fill in: " + missing.join(", "));
      return;
    }

    if (!sb) {
      alert("Signup is temporarily unavailable. Please reach out directly at info@buperac.com.");
      return;
    }

    if (submitBtn) submitBtn.disabled = true;

    const { data: newTotal, error } = await sb.rpc("submit_bio_trial_signup", { payload });

    if (error) {
      console.error("[bio-trial] submit failed:", error);
      if (submitBtn) submitBtn.disabled = false;
      alert("Something went wrong saving your signup. Please try again, or email info@buperac.com.");
      return;
    }

    form.hidden = true;
    successEl.hidden = false;

    rollTo(parseInt(newTotal, 10) || (currentAcres + acres));

    const odo = document.getElementById("odometer");
    if (odo) {
      const y = odo.getBoundingClientRect().top + window.scrollY - 120;
      window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
    }
  });

  // ==============================================
  // TWEAKS PANEL
  // ==============================================
  const panel = document.getElementById("tweaks-panel");
  const closeBtn = document.getElementById("tweaksClose");

  // mark active buttons
  function syncTweakButtons() {
    panel.querySelectorAll(".tw-opts[data-tw]").forEach(group => {
      const key = group.dataset.tw;
      group.querySelectorAll("button").forEach(b => {
        b.classList.toggle("active", b.dataset.v === TW[key]);
      });
    });
  }
  syncTweakButtons();

  panel.querySelectorAll(".tw-opts[data-tw]").forEach(group => {
    const key = group.dataset.tw;
    group.addEventListener("click", (e) => {
      const b = e.target.closest("button[data-v]");
      if (!b) return;
      TW[key] = b.dataset.v;
      applyTweaks();
      syncTweakButtons();
      persistTweaks();
    });
  });

  document.getElementById("odoApply").addEventListener("click", () => {
    const v = parseInt(document.getElementById("odoSet").value, 10);
    if (!isNaN(v)) rollTo(v);
  });

  closeBtn.addEventListener("click", () => { panel.hidden = true; });

  function persistTweaks() {
    try {
      window.parent.postMessage({
        type: "__edit_mode_set_keys",
        edits: {
          deskTone: TW.deskTone,
          grain: TW.grain,
          accent: TW.accent,
          sound: TW.sound,
          odoStart: currentAcres
        }
      }, "*");
    } catch {}
  }

  // --- Edit mode availability protocol ---
  window.addEventListener("message", (ev) => {
    const d = ev.data || {};
    if (d.type === "__activate_edit_mode") panel.hidden = false;
    else if (d.type === "__deactivate_edit_mode") panel.hidden = true;
  });
  try { window.parent.postMessage({ type: "__edit_mode_available" }, "*"); } catch {}

  // ==============================================
  // Tiny interactions: sticky note wiggle on scroll-in
  // ==============================================
  const io = new IntersectionObserver((entries) => {
    entries.forEach(ent => {
      if (ent.isIntersecting) {
        ent.target.animate(
          [
            { transform: ent.target.style.transform + " translateY(-4px)" },
            { transform: getComputedStyle(ent.target).transform }
          ],
          { duration: 420, easing: "cubic-bezier(.3,1.6,.4,1)" }
        );
        io.unobserve(ent.target);
      }
    });
  }, { threshold: 0.4 });
  document.querySelectorAll(".note").forEach(n => io.observe(n));

})();
