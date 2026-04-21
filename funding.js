/* Bio Trial funding page — client logic.
   Reads window.FUNDING_DATA, wires filters, renders grant cards.
   All user-visible values go through textContent / setAttribute —
   no innerHTML on user-supplied or data-supplied strings. */
(function () {
  "use strict";

  var DATA = window.FUNDING_DATA;
  if (!DATA) {
    console.error("FUNDING_DATA missing — funding-data.js did not load.");
    return;
  }

  var state = {
    country: "All",
    region: "All Regions",
    benefit: "All",
    query: ""
  };

  var el = {
    grid:           document.getElementById("grantGrid"),
    empty:          document.getElementById("emptyState"),
    meta:           document.getElementById("resultsMeta"),
    search:         document.getElementById("searchInput"),
    countryBtns:    document.querySelectorAll("[data-country]"),
    regionSelect:   document.getElementById("regionSelect"),
    benefitList:    document.getElementById("benefitList"),
    clearBtn:       document.getElementById("clearFiltersBtn"),
    emptyClearBtn:  document.getElementById("emptyClearBtn"),
    usaCount:       document.getElementById("usaCount"),
    canCount:       document.getElementById("canCount"),
    shownCount:     document.getElementById("shownCount"),
    totalCount:     document.getElementById("totalCount")
  };

  // ---------- Initial static counts ----------
  var totals = DATA.GRANTS.reduce(
    function (acc, g) {
      if (g.country === "USA") acc.usa++;
      else if (g.country === "Canada") acc.can++;
      return acc;
    },
    { usa: 0, can: 0 }
  );
  el.usaCount.textContent = String(totals.usa);
  el.canCount.textContent = String(totals.can);
  el.totalCount.textContent = String(DATA.GRANTS.length);

  // ---------- Benefit list ----------
  renderBenefitOptions();

  function renderBenefitOptions() {
    removeChildren(el.benefitList);
    var opts = ["All"].concat(DATA.BENEFITS);
    opts.forEach(function (b) {
      var label = document.createElement("label");
      label.className = "benefit-opt" + (state.benefit === b ? " is-active" : "");
      label.setAttribute("data-benefit", b);

      var box = document.createElement("span");
      box.className = "box";
      label.appendChild(box);

      var text = document.createElement("span");
      text.textContent = b === "All" ? "All benefits" : b;
      label.appendChild(text);

      var input = document.createElement("input");
      input.type = "radio";
      input.name = "benefit";
      input.value = b;
      if (state.benefit === b) input.checked = true;
      label.appendChild(input);

      label.addEventListener("click", function (ev) {
        ev.preventDefault();
        state.benefit = b;
        Array.prototype.forEach.call(
          el.benefitList.querySelectorAll(".benefit-opt"),
          function (n) { n.classList.remove("is-active"); }
        );
        label.classList.add("is-active");
        render();
      });

      el.benefitList.appendChild(label);
    });
  }

  // ---------- Country toggle ----------
  Array.prototype.forEach.call(el.countryBtns, function (btn) {
    btn.addEventListener("click", function () {
      state.country = btn.getAttribute("data-country");
      state.region = "All Regions";
      Array.prototype.forEach.call(el.countryBtns, function (b) {
        b.classList.toggle("is-active", b === btn);
      });
      rebuildRegionSelect();
      render();
    });
  });

  // ---------- Region select ----------
  rebuildRegionSelect();
  el.regionSelect.addEventListener("change", function () {
    state.region = el.regionSelect.value;
    render();
  });

  function rebuildRegionSelect() {
    var options;
    if (state.country === "USA") {
      options = ["All Regions"].concat(
        DATA.USA_STATES.filter(function (s) { return s !== "All States"; })
      );
      el.regionSelect.disabled = false;
    } else if (state.country === "Canada") {
      options = ["All Regions"].concat(
        DATA.CANADA_PROVINCES.filter(function (p) { return p !== "All Provinces"; })
      );
      el.regionSelect.disabled = false;
    } else {
      options = ["Pick a country first"];
      el.regionSelect.disabled = true;
    }
    removeChildren(el.regionSelect);
    options.forEach(function (opt) {
      var o = document.createElement("option");
      o.value = opt;
      o.textContent = opt;
      el.regionSelect.appendChild(o);
    });
    el.regionSelect.value = options[0];
    state.region = el.regionSelect.disabled ? "All Regions" : el.regionSelect.value;
  }

  // ---------- Search (debounced) ----------
  var searchTimer;
  el.search.addEventListener("input", function () {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(function () {
      state.query = el.search.value.trim().toLowerCase();
      render();
    }, 120);
  });

  // ---------- Clear filters ----------
  function clearAll() {
    state.country = "All";
    state.region = "All Regions";
    state.benefit = "All";
    state.query = "";
    el.search.value = "";
    Array.prototype.forEach.call(el.countryBtns, function (b) {
      b.classList.toggle("is-active", b.getAttribute("data-country") === "All");
    });
    rebuildRegionSelect();
    renderBenefitOptions();
    render();
  }
  el.clearBtn.addEventListener("click", clearAll);
  el.emptyClearBtn.addEventListener("click", clearAll);

  // ---------- Filtering ----------
  function applyFilters() {
    var q = state.query;
    return DATA.GRANTS.filter(function (g) {
      if (state.country !== "All" && g.country !== state.country) return false;

      if (state.region !== "All Regions") {
        var hit =
          g.regions.indexOf(state.region) >= 0 ||
          g.regions.indexOf("All States") >= 0 ||
          g.regions.indexOf("All Provinces") >= 0;
        if (!hit) return false;
      }

      if (state.benefit !== "All" && g.benefits.indexOf(state.benefit) < 0) return false;

      if (q) {
        var hay = (g.name + " " + g.organization + " " + g.description).toLowerCase();
        if (hay.indexOf(q) < 0) return false;
      }
      return true;
    });
  }

  // ---------- Render ----------
  var TILTS = [-0.5, 0.4, -0.2, 0.6, -0.35];

  function render() {
    var list = applyFilters();
    el.shownCount.textContent = String(list.length);
    el.meta.textContent = list.length + (list.length === 1 ? " result" : " results");

    removeChildren(el.grid);

    if (!list.length) {
      el.grid.hidden = true;
      el.empty.hidden = false;
      return;
    }
    el.grid.hidden = false;
    el.empty.hidden = true;

    list.forEach(function (g, i) {
      el.grid.appendChild(buildCard(g, TILTS[i % TILTS.length]));
    });
  }

  function buildCard(g, tilt) {
    var card = document.createElement("article");
    card.className = "grant-card" + (g.isFederal ? " is-federal" : "");
    card.style.setProperty("--tilt", tilt + "deg");

    var top = document.createElement("div");
    top.className = "grant-top";

    var juris = document.createElement("span");
    juris.className = "jurisdiction";
    juris.textContent = g.isFederal
      ? "Federal · " + g.country
      : (g.country === "USA" ? "State · USA" : "Province · Canada");
    top.appendChild(juris);

    var link = document.createElement("a");
    link.className = "grant-link";
    link.href = g.link;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.setAttribute("aria-label", "Open " + g.name + " in a new tab");
    var sr = document.createElement("span");
    sr.className = "sr";
    sr.textContent = "External link";
    link.appendChild(sr);
    top.appendChild(link);

    card.appendChild(top);

    var h3 = document.createElement("h3");
    h3.className = "grant-name";
    h3.textContent = g.name;
    card.appendChild(h3);

    var org = document.createElement("div");
    org.className = "grant-org";
    org.textContent = g.organization;
    card.appendChild(org);

    var desc = document.createElement("p");
    desc.className = "grant-desc";
    desc.textContent = g.description;
    card.appendChild(desc);

    var meta = document.createElement("div");
    meta.className = "grant-meta";
    meta.appendChild(metaRow("Amount",   g.amount));
    meta.appendChild(metaRow("Deadline", g.deadline));
    meta.appendChild(metaRow("Regions",  g.regions.join(", ")));
    card.appendChild(meta);

    var benefits = document.createElement("div");
    benefits.className = "grant-benefits";
    g.benefits.forEach(function (b, j) {
      var chip = document.createElement("span");
      chip.className = "benefit-chip";
      var ct = (j % 3 === 0) ? -1 : (j % 3 === 1 ? 0 : 1);
      chip.style.setProperty("--chip-tilt", ct + "deg");
      chip.textContent = b;
      benefits.appendChild(chip);
    });
    card.appendChild(benefits);

    return card;
  }

  function metaRow(label, val) {
    var row = document.createElement("div");
    row.className = "grant-meta-row";
    var l = document.createElement("span");
    l.className = "grant-meta-label";
    l.textContent = label;
    var v = document.createElement("span");
    v.className = "grant-meta-val";
    v.textContent = val;
    row.appendChild(l);
    row.appendChild(v);
    return row;
  }

  function removeChildren(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  render();
})();
