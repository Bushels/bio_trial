# Moisture Readings Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Close the gap between the farmer explainer / trial-dashboard design ("log moisture readings — crop %, soil probe or qualitative, rainfall") and the farmer web form, which today dumps moisture data into free-text observations so it can never be joined to yield deltas.

**Architecture:** The `moisture_test` event kind already exists in the schema CHECK constraint (migration `20260420000002_bio_trial_farmer_catchup.sql:79`), and the farmer form already exposes a "Moisture test" dropdown option — but the form writes `{text: note}` with no structured fields. This plan replaces that generic branch with a three-variant sub-form (crop / soil / rainfall) that writes a typed JSON payload, then updates the farmer timeline, vendor Events panel, and public activity feed to render the new shape while staying null-safe for legacy `{pct, text}` rows. No new migration is required.

**Tech Stack:** Static HTML + vanilla JS (farmer.html, farmer.js, trial.js, vendor.js), Supabase Postgres RPCs, JSONB payload in `bio_trial.trial_events`.

---

## Scope — What This PR Is And Isn't

**In scope:**
- Farmer form: restructure the `moisture_test` branch of the event form into a reading-type sub-form with numeric value, unit, optional depth, optional qualitative fallback, and observed date.
- Farmer timeline: render the three variants legibly ("Crop moisture: 11.8% on 2026-08-22", "Soil moisture: 18% at 12in on 2026-07-15", "Soil moisture: adequate on 2026-07-15", "Rainfall: 18 mm on 2026-06-30"). Keep a legacy-compat fallback for existing `{pct}` / `{text}` rows.
- Vendor Events panel (`vendor.js:summarizeEventPayload`): same legible formatting + legacy fallback.
- Public activity feed (`trial.js:kindLabel` + `verbForKind`): "Moisture" / "logged a moisture reading" — province + crop only, no numeric value leakage.
- Label rename: the kind-dropdown option "Moisture test" becomes "Moisture reading" to match explainer terminology.
- Rename label on the existing note/value textarea when the moisture sub-form is active (the shared textarea becomes "Notes" only; the value is structured).

**Explicitly out of scope (document in PR description):**
- **Telegram `/moisture` command.** Moisture logging is multi-field; mobile web form is the better surface. Deferred.
- **No new migration** for the CHECK constraint — `moisture_test` is already allowed. If a reviewer proposes adding `'moisture'` as a separate kind, the answer is "reuse the existing one; it's already in production schema".
- **No public numeric surfacing.** Public dashboard gets a count in the generic activity feed ("A farmer in SK logged a moisture reading on canola. 2h ago") and nothing more. We do NOT add a `moisture_readings_count` headline tile — the rigor/privacy story (how moisture ties to yield deltas in dry vs wet years) is a v2 spec item.
- **No weather-API auto-detect.** The rainfall variant is manual gauge entry only.
- **No file upload for moisture.** Soil probe PDFs and rain-gauge photos can still be attached via the existing kind="photo" path; the new sub-form has no file picker.

## Payload Shape (Reference)

```js
// All moisture_test payloads after this PR:
{
  reading_type: "crop" | "soil" | "rainfall",   // required
  value: number,                                 // required EXCEPT when reading_type='soil' AND qualitative is set
  unit: "pct" | "mm" | "in",                     // required with value. "pct" for crop/soil, "mm"|"in" for rainfall
  depth_in: number | null,                       // optional, only meaningful for reading_type='soil'
  qualitative: "dry" | "adequate" | "wet" | null, // optional, only for reading_type='soil' (alternative to value)
  observed_on: "YYYY-MM-DD",                     // required; date the reading was taken
  notes: string                                  // optional free text
}
```

**Legacy payloads that must keep rendering cleanly:**
- `{ pct: 12 }` — from the old form path. Render as "Moisture: 12%".
- `{ text: "swathed at 12%" }` — from the old form path. Render the text verbatim.
- Anything else — fall back to `JSON.stringify(p)` (vendor panel already does this at `vendor.js:356`).

---

## Task List

### Task 1: Branch bookkeeping and plan seed

**Files:**
- Create: `docs/plans/2026-04-20-moisture-readings-plan.md` (this file — already written)

**Step 1:** Confirm worktree branch.

Run: `git branch --show-current`
Expected: `claude/wizardly-sammet-a146a9` (branched off `feat/standalone-extraction`).

**Step 2:** Stage and commit the plan.

```bash
git add docs/plans/2026-04-20-moisture-readings-plan.md
git commit -m "docs(plan): moisture readings implementation plan

Scope: restructure moisture_test event payload into a typed
reading_type / value / unit / depth / qualitative shape, update
farmer form, timeline, vendor events, and public activity feed.
No migration required — moisture_test kind already permitted."
```

---

### Task 2: Add custom moisture sub-form renderer in farmer.js

**Files:**
- Modify: `farmer.js` — `renderEventForm` function, around line 475–695

**Step 1 — Read the current handler.**

Open `farmer.js` and confirm:
- Line 494 has `["moisture_test", "Moisture test"]` in the kind dropdown.
- Line 560–568 builds a generic `noteRow` textarea labeled "Notes / value".
- Line 650–661 constructs the payload — the `else` branch writes `{text: note}`.

**Step 2 — Rename the dropdown label.**

Change line 494 from:
```js
["moisture_test", "Moisture test"],
```
to:
```js
["moisture_test", "Moisture reading"],
```

**Step 3 — Inject a moisture sub-form block** between `selRow` and `noteRow` (after line 558, before the note row). Keep it hidden by default; show only when `kindSel.value === "moisture_test"`.

```js
// Moisture reading sub-form. kind='moisture_test' uses a structured
// payload { reading_type, value, unit, depth_in?, qualitative?,
// observed_on, notes } so we can aggregate by reading_type later
// and join to yield deltas. Other kinds still use the generic note
// textarea below. Legacy rows with payload { pct } or { text } keep
// rendering via the timeline/vendor fallbacks.
const moistureBlock = document.createElement("div");
moistureBlock.hidden = true;

const mTypeRow = document.createElement("div");
mTypeRow.className = "row";
const mTypeLab = document.createElement("label");
mTypeLab.textContent = "Reading type";
const mTypeSel = document.createElement("select");
mTypeSel.name = "moisture_reading_type";
for (const [v, t] of [
  ["crop",     "Crop moisture (%)"],
  ["soil",     "Soil moisture"],
  ["rainfall", "Rainfall (gauge)"],
]) {
  const opt = document.createElement("option");
  opt.value = v; opt.textContent = t;
  mTypeSel.appendChild(opt);
}
mTypeLab.appendChild(mTypeSel);
mTypeRow.appendChild(mTypeLab);

const mDateLab = document.createElement("label");
mDateLab.textContent = "Observed on";
const mDateInp = document.createElement("input");
mDateInp.type = "date";
mDateInp.name = "moisture_observed_on";
mDateInp.valueAsDate = new Date();
mDateLab.appendChild(mDateInp);
mTypeRow.appendChild(mDateLab);

moistureBlock.appendChild(mTypeRow);

const mValRow = document.createElement("div");
mValRow.className = "row";
const mValLab = document.createElement("label");
mValLab.textContent = "Value";
const mValInp = document.createElement("input");
mValInp.type = "number";
mValInp.step = "0.1";
mValInp.min = "0";
mValInp.name = "moisture_value";
mValInp.placeholder = "e.g. 12.5";
mValLab.appendChild(mValInp);
mValRow.appendChild(mValLab);

const mUnitLab = document.createElement("label");
mUnitLab.textContent = "Unit";
const mUnitSel = document.createElement("select");
mUnitSel.name = "moisture_unit";
// Options are pruned per reading_type in refreshMoistureFields().
mUnitLab.appendChild(mUnitSel);
mValRow.appendChild(mUnitLab);

const mDepthLab = document.createElement("label");
mDepthLab.textContent = "Depth (in)";
const mDepthInp = document.createElement("input");
mDepthInp.type = "number";
mDepthInp.step = "1";
mDepthInp.min = "0";
mDepthInp.name = "moisture_depth_in";
mDepthInp.placeholder = "optional, e.g. 12";
mDepthLab.appendChild(mDepthInp);
mValRow.appendChild(mDepthLab);

moistureBlock.appendChild(mValRow);

const mQualRow = document.createElement("div");
mQualRow.className = "row";
mQualRow.hidden = true;
const mQualLab = document.createElement("label");
mQualLab.textContent = "No probe? Describe";
const mQualSel = document.createElement("select");
mQualSel.name = "moisture_qualitative";
for (const [v, t] of [
  ["",         "— use numeric value above —"],
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

function refreshMoistureFields() {
  const rt = mTypeSel.value;
  // Unit options per reading type.
  mUnitSel.replaceChildren();
  const units = rt === "rainfall" ? [["mm", "mm"], ["in", "in"]] : [["pct", "%"]];
  for (const [v, t] of units) {
    const opt = document.createElement("option");
    opt.value = v; opt.textContent = t;
    mUnitSel.appendChild(opt);
  }
  // Depth field only meaningful for soil probes.
  mDepthLab.hidden = rt !== "soil";
  // Qualitative fallback only for soil-without-probe.
  mQualRow.hidden = rt !== "soil";
  // Value is required for crop/rainfall; for soil it's required UNLESS qualitative is set.
  mValInp.required = rt !== "soil" || !mQualSel.value;
}
mTypeSel.addEventListener("change", refreshMoistureFields);
mQualSel.addEventListener("change", refreshMoistureFields);
refreshMoistureFields();

form.appendChild(moistureBlock);

// Toggle moistureBlock vs generic note row visibility.
function refreshKindSections() {
  const isMoisture = kindSel.value === "moisture_test";
  moistureBlock.hidden = !isMoisture;
  noteLab.firstChild.nodeValue = isMoisture ? "Notes (optional)" : "Notes / value";
}
kindSel.addEventListener("change", refreshKindSections);
refreshKindSections();
```

**Step 4 — Patch the note label wiring.**

The existing label at line 562–563 is created via `noteLab.textContent = "Notes / value"`. Because `refreshKindSections()` above writes `noteLab.firstChild.nodeValue`, ensure the label structure stays compatible. If `noteLab` was constructed with `textContent` THEN the `<textarea>` was appended, `noteLab.firstChild` is the text node — the assignment works. Confirm by inspection, no code change needed here.

**Step 5 — Branch the submit payload construction.**

Replace the else-branch of the `if (kind === "photo") … else if (kind === "yield") … else { payload = { text: note } }` chain (around farmer.js:650–661) with:

```js
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
  const rt       = String(fd.get("moisture_reading_type") || "");
  const obsOn    = String(fd.get("moisture_observed_on") || "");
  const valueRaw = String(fd.get("moisture_value") || "").trim();
  const unit     = String(fd.get("moisture_unit") || "");
  const depthRaw = String(fd.get("moisture_depth_in") || "").trim();
  const qual     = String(fd.get("moisture_qualitative") || "");

  if (!rt)    throw new Error("Pick a moisture reading type (crop / soil / rainfall).");
  if (!obsOn) throw new Error("Pick the date the reading was taken.");

  // Soil can substitute a qualitative bucket for a numeric reading;
  // crop and rainfall must have a number.
  const hasQual = rt === "soil" && qual !== "";
  let value = null;
  if (!hasQual) {
    const n = Number(valueRaw);
    if (!isFinite(n) || n <= 0) {
      throw new Error(
        rt === "soil"
          ? "Enter a soil-probe reading, or pick Dry/Adequate/Wet if you don't have a probe."
          : "Enter a numeric moisture value."
      );
    }
    value = n;
  }

  // Normalize unit per reading type.
  const expectedUnits = rt === "rainfall" ? ["mm", "in"] : ["pct"];
  const finalUnit = hasQual ? null : (expectedUnits.includes(unit) ? unit : expectedUnits[0]);

  const depth_in = rt === "soil" && depthRaw !== "" ? Number(depthRaw) : null;
  if (depth_in != null && (!isFinite(depth_in) || depth_in < 0)) {
    throw new Error("Depth must be a non-negative number of inches.");
  }

  payload = {
    reading_type: rt,
    value: value,
    unit: finalUnit,
    depth_in: depth_in,
    qualitative: hasQual ? qual : null,
    observed_on: obsOn,
    notes: note || "",
  };
} else {
  payload = { text: note };
}
```

**Step 6 — Manual verify in browser (no dev server needed; static file).**

Run: open `farmer.html?token=<valid-farmer-token>` in a browser. In the event form:
- Pick "Moisture reading" from the Kind dropdown. Confirm: the sub-form appears, the generic Notes label becomes "Notes (optional)".
- Flip Reading type through Crop / Soil / Rainfall. Confirm: unit dropdown swaps (%/mm/in), Depth (in) only shown for Soil, qualitative row only shown for Soil.
- Flip to any other kind (Observation / Yield). Confirm: sub-form disappears, Notes label reverts to "Notes / value".

**Step 7 — Commit.**

```bash
git add farmer.js
git commit -m "feat(farmer): structured moisture-reading sub-form

Adds a reading_type (crop/soil/rainfall) sub-form to the
moisture_test event kind. Writes a typed payload with
value/unit/depth/qualitative/observed_on instead of free text
so moisture can be aggregated and joined to yield deltas later.
Other event kinds keep the generic note textarea."
```

---

### Task 3: Render the new payload shape in the farmer timeline

**Files:**
- Modify: `farmer.js` — `summarizePayload` function, line 461–473

**Step 1 — Replace the moisture_test branch** at line 470 with a shape-aware renderer that also handles legacy payloads:

```js
if (kind === "moisture_test") {
  // Legacy rows used { pct } or { text } only — keep them readable.
  const legacy =
    payload.reading_type == null
      ? (payload.pct != null ? `Moisture: ${payload.pct}%` : (payload.text || ""))
      : null;
  if (legacy != null) return legacy;

  const { reading_type, value, unit, depth_in, qualitative, observed_on } = payload;
  const when = observed_on ? ` on ${observed_on}` : "";
  const unitLabel = unit === "pct" ? "%" : (unit ? ` ${unit}` : "");
  if (reading_type === "crop") {
    return value != null ? `Crop moisture: ${value}${unitLabel}${when}` : `Crop moisture${when}`;
  }
  if (reading_type === "soil") {
    if (qualitative) return `Soil moisture: ${qualitative}${when}`;
    const depth = depth_in != null ? ` at ${depth_in}in` : "";
    return value != null ? `Soil moisture: ${value}${unitLabel}${depth}${when}` : `Soil moisture${when}`;
  }
  if (reading_type === "rainfall") {
    return value != null ? `Rainfall: ${value}${unitLabel}${when}` : `Rainfall${when}`;
  }
  return payload.notes || payload.text || "";
}
```

**Step 2 — Manual verify: legacy compat.**

Open browser console on `farmer.html`, paste:
```js
summarizePayload("moisture_test", { pct: 12 });           // "Moisture: 12%"
summarizePayload("moisture_test", { text: "swathed" });   // "swathed"
summarizePayload("moisture_test", { reading_type: "crop", value: 11.8, unit: "pct", observed_on: "2026-08-22" });
// "Crop moisture: 11.8% on 2026-08-22"
summarizePayload("moisture_test", { reading_type: "soil", value: 18.5, unit: "pct", depth_in: 12, observed_on: "2026-07-15" });
// "Soil moisture: 18.5% at 12in on 2026-07-15"
summarizePayload("moisture_test", { reading_type: "soil", qualitative: "adequate", observed_on: "2026-07-15" });
// "Soil moisture: adequate on 2026-07-15"
summarizePayload("moisture_test", { reading_type: "rainfall", value: 18, unit: "mm", observed_on: "2026-06-30" });
// "Rainfall: 18 mm on 2026-06-30"
```

Note: `summarizePayload` is inside an IIFE in farmer.js; it isn't exposed on `window`. For an ad-hoc check, temporarily `window.summarizePayload = summarizePayload;` at the bottom of the IIFE, then revert.

**Step 3 — Manual verify: end-to-end write → render.**

Submit a new crop moisture reading via the form (value 11.8, date 2026-08-22). The timeline should show the new line immediately after save (the form calls `refreshState()` on success).

**Step 4 — Commit.**

```bash
git add farmer.js
git commit -m "feat(farmer): render structured moisture readings in timeline

summarizePayload now formats crop/soil/rainfall moisture readings
with value, unit, depth, and observed_on. Legacy {pct} and {text}
payloads keep their original rendering so historical rows stay
readable."
```

---

### Task 4: Render the new payload shape in the vendor Events panel

**Files:**
- Modify: `vendor.js` — `summarizeEventPayload`, line 344–357

**Step 1 — Replace the moisture_test branch at line 353** with the same shape-aware logic as Task 3 (port it verbatim, adjusted for the `e.payload` → `p` aliasing that vendor.js uses):

```js
if (e.kind === "moisture_test") {
  if (p.reading_type == null) {
    return p.pct != null ? `${p.pct}% moisture` : (p.text || "");
  }
  const when = p.observed_on ? ` on ${p.observed_on}` : "";
  const unitLabel = p.unit === "pct" ? "%" : (p.unit ? ` ${p.unit}` : "");
  if (p.reading_type === "crop") {
    return p.value != null ? `Crop moisture: ${p.value}${unitLabel}${when}` : `Crop moisture${when}`;
  }
  if (p.reading_type === "soil") {
    if (p.qualitative) return `Soil moisture: ${p.qualitative}${when}`;
    const depth = p.depth_in != null ? ` at ${p.depth_in}in` : "";
    return p.value != null ? `Soil moisture: ${p.value}${unitLabel}${depth}${when}` : `Soil moisture${when}`;
  }
  if (p.reading_type === "rainfall") {
    return p.value != null ? `Rainfall: ${p.value}${unitLabel}${when}` : `Rainfall${when}`;
  }
  return p.notes || p.text || "";
}
```

**Step 2 — Manual verify on vendor console.**

Open `vendor.html?token=<vendor-jwt>`, click Events on a signup with a new moisture reading row. Confirm the summary reads legibly and that any older `{pct}` / `{text}` rows still render.

**Step 3 — Commit.**

```bash
git add vendor.js
git commit -m "feat(vendor): render structured moisture readings in Events panel

Mirrors the farmer timeline renderer so vendors see the same
legible summaries. Keeps the legacy {pct}/{text} fallback."
```

---

### Task 5: Activity feed wording on the public dashboard

**Files:**
- Modify: `trial.js` — `kindLabel` (line 293–303) and `verbForKind` (line 306–316)

**Step 1 — Add moisture_test entries.**

```js
function kindLabel(k) {
  return ({
    observation:   "Observation",
    yield:         "Yield",
    soil_test:     "Soil Test",
    application:   "Application",
    field_created: "Field",
    field:         "Field",
    photo:         "Photo",
    moisture_test: "Moisture",
  })[k] || String(k || "event").replace(/_/g, " ");
}

function verbForKind(k) {
  return ({
    observation:   "logged an observation",
    yield:         "reported yield",
    soil_test:     "logged a soil test",
    application:   "logged an application",
    field_created: "added a field",
    field:         "added a field",
    photo:         "shared a photo",
    moisture_test: "logged a moisture reading",
  })[k] || `logged ${String(k || "event").replace(/_/g, " ")}`;
}
```

**Step 2 — Confirm no numeric leakage.**

`renderActivity` (trial.js:216) only passes `kind`, `province`, `crop`, `created_at` into the DOM. The payload never reaches the public page. Visually verify: the public dashboard row should read "Moisture — A farmer in SK logged a moisture reading on canola. 2h ago" with no percentage or inches.

**Step 3 — Commit.**

```bash
git add trial.js
git commit -m "feat(trial): label moisture_test events in public activity feed

Adds \"Moisture\" kind label and \"logged a moisture reading\" verb
so the generic fallback (\"logged moisture test\") is replaced with
prose that matches the farmer-facing terminology. Payload stays
off the public page — province + crop + kind only."
```

---

### Task 6: README mention

**Files:**
- Modify: `README.md` — wherever event kinds are enumerated

**Step 1 — Search for the kinds list.**

Run: `grep -n "moisture_test\|event kinds\|kind.*check\|'observation'" README.md`

**Step 2 — If moisture_test is documented as "free-text only" or similar, update it** to reference the new structured payload. If not, skip this task (README already enumerates kinds abstractly).

**Step 3 — Commit if changed.**

```bash
git add README.md
git commit -m "docs(readme): moisture_test payload is now structured"
```

---

### Task 7: End-to-end manual verification on Supabase

**Prerequisite:** a working farmer JWT for the staging Bushel Board Supabase project (see memory `reference_supabase_projects.md`).

**Step 1 — Crop moisture.**

Submit via farmer.html: Reading type = Crop, value = 11.8, unit = %, date = 2026-08-22.

Verify in Supabase SQL editor:
```sql
select kind, payload, created_at
from bio_trial.trial_events
where kind = 'moisture_test'
order by created_at desc
limit 1;
```
Expected `payload`:
```json
{"notes":"","unit":"pct","value":11.8,"depth_in":null,"observed_on":"2026-08-22","qualitative":null,"reading_type":"crop"}
```

**Step 2 — Soil (probe).**

Reading type = Soil, value = 18.5, unit = %, depth = 12, date = 2026-07-15. Expect `reading_type: "soil", value: 18.5, depth_in: 12, qualitative: null`.

**Step 3 — Soil (qualitative).**

Reading type = Soil, leave value blank, pick Qualitative = Adequate. Expect `value: null, qualitative: "adequate"`.

**Step 4 — Rainfall.**

Reading type = Rainfall, value = 18, unit = mm, date = 2026-06-30. Expect `reading_type: "rainfall", value: 18, unit: "mm"`.

**Step 5 — Public activity feed.**

Open `trial.html`. Confirm the four new events each render as "Moisture — A farmer in <prov> logged a moisture reading [on <crop>]. <time ago>." with no numeric values.

**Step 6 — Vendor Events panel.**

Open `vendor.html?token=<vendor-jwt>`. Click Events on the test signup. Confirm all four rows render with their structured summaries.

**Step 7 — Legacy compat spot-check.**

Insert a legacy-shape row via SQL:
```sql
insert into bio_trial.trial_events (signup_id, kind, payload, source)
select id, 'moisture_test', '{"pct":14,"text":"legacy row"}'::jsonb, 'manual_test'
from bio_trial.signups
order by created_at desc
limit 1;
```
Reload the farmer timeline and vendor panel. The legacy row should display as "Moisture: 14%" (farmer) and "14% moisture" (vendor). Delete the row afterwards.

**Step 8 — Write results into the Progress log** below and commit.

```bash
git add docs/plans/2026-04-20-moisture-readings-plan.md
git commit -m "docs(plan): moisture readings E2E verification results"
```

---

### Task 8: Open the PR

**Step 1 — Push.**

```bash
git push -u origin claude/wizardly-sammet-a146a9
```

**Step 2 — Open PR against `feat/standalone-extraction`.**

Title: `feat(trial): structured moisture-reading sub-form`

Body (HEREDOC):
```markdown
## Summary
- Replaces the free-text `moisture_test` payload with a structured shape: `{ reading_type: crop|soil|rainfall, value, unit, depth_in?, qualitative?, observed_on, notes }`.
- Updates the farmer form (sub-form switches fields by reading type), farmer timeline, vendor Events panel, and public activity feed to render the new shape. All four renderers keep a legacy `{pct}` / `{text}` fallback so historical rows stay readable.
- **No migration required.** `moisture_test` is already on the `trial_events_kind_check` whitelist (migration `20260420000002`). If reviewers want a new `'moisture'` kind instead, the answer is no — it would churn vendor rendering and existing plan docs for zero schema benefit.

## Deferred (explicit)
- **No `/moisture` Telegram command.** Multi-field input is better on the web form than in a bot DM conversation.
- **No public numeric surfacing.** Public dashboard gets activity-feed counts only ("A farmer in SK logged a moisture reading"). Numeric/dashboard tiles wait until we have a rigor story for how moisture ties to yield deltas in dry vs wet years.
- **No weather-API auto-detect.** Rainfall is manual gauge entry only (v2 spec item §15).
- **No file upload on the sub-form.** Photos of probes / gauges still go through the kind=photo path.

## Test plan
- [ ] Crop moisture row lands in `trial_events` with `reading_type: "crop", value, unit: "pct", observed_on`.
- [ ] Soil probe row lands with `depth_in` populated.
- [ ] Soil qualitative row lands with `value: null, qualitative: "adequate"`.
- [ ] Rainfall row lands with `unit: "mm"` or `unit: "in"`.
- [ ] Farmer timeline renders all four legibly.
- [ ] Vendor Events panel renders all four legibly.
- [ ] Public activity feed shows "Moisture — A farmer in <prov> logged a moisture reading ..." with no numbers.
- [ ] Legacy `{pct: 14}` and `{text: "..."}` rows still render in both farmer and vendor views.
```

**Step 3 — Log PR URL in the Progress log.**

---

## Progress log

Per `feedback_keep_plan_progress_log.md`: update this table per task (not per phase). Row states: ⏳ in progress · ✅ done · ⚠️ blocked/partial · ❌ abandoned.

| Task | Title                                                        | Status | Notes                                                                                                        |
| ---- | ------------------------------------------------------------ | ------ | ------------------------------------------------------------------------------------------------------------ |
| T1   | Branch bookkeeping + commit plan                             | ✅     | Committed as `ecda991` on branch `claude/wizardly-sammet-a146a9` (off `feat/standalone-extraction`).          |
| T2   | Farmer form: moisture sub-form                               | ✅     | Committed as `a5edb83`. Spec ✅, code review 🟡 approved with minor notes (silent unit fallback at :815 — defensive guard; renderEventForm length watched, not refactored). |
| T3   | Farmer timeline: render new payload + legacy fallback        | ✅     | Committed as `a121046`. Diff is spec-verbatim (+24/-1 in `summarizePayload` moisture_test branch). `node --check` + isolated function test confirmed six output shapes incl. legacy compat. |
| T4   | Vendor Events panel: render new payload + legacy fallback    | ✅     | Committed as `285a08d`. Same shape-aware block as T3, ported to vendor.js (`p` aliasing). `node --check` OK. |
| T5   | Public activity feed: kindLabel + verbForKind wording        | ✅     | Committed as `8e1adf4`. Two entries added to the maps; payload never reaches DOM so no numeric leak.        |
| T6   | README mention (only if stale)                               | ✅     | `grep -i moisture README.md` returned nothing — README doesn't surface event-kind specifics. No edit needed. |
| T7   | End-to-end verification on Supabase (4 readings + legacy)    | ⚠️     | Partial — code-level verification only (parse all three JS files with `node --check`, cross-check 6 FormData names align between form and submit handler, diff-vs-base audit shows only 4 intended files touched). Live browser + Supabase runs against 4 readings + a legacy `{pct}` row deferred to post-merge smoke (subagent has no farmer token / live DB access). |
| T8   | Open PR against feat/standalone-extraction                   | ✅     | [bio_trial#4](https://github.com/Bushels/bio_trial/pull/4) — base `feat/standalone-extraction`, head `claude/wizardly-sammet-a146a9`. |
