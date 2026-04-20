# Application-Method Picker — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans if resuming task-by-task.

**Goal:** Close the doc-ahead-of-code gap where the farmer explainer promises an "application method" picker (seed treatment / foliar spray) that doesn't exist. Every new `kind=application` event should carry `payload.method`, timelines should surface it, and the Telegram `/apply` flow should capture it too.

**Architecture:** No schema change; `method` goes inside the existing `trial_events.payload` jsonb. One tiny migration adds a CHECK constraint that rejects unknown method tokens for `kind='application'` while leaving legacy rows (method-less) untouched. Farmer dashboard gets `application` added to its event-kind select plus a conditional method dropdown. Telegram `/apply` fans out to a second inline keyboard after field selection.

**Tech Stack:** Static JS (`farmer.js`, `vendor.js`), Supabase Edge Function (Deno/TS), Postgres migration.

---

## Decisions

1. **Enum values: 2 user-facing labels.** `seed_treatment` and `foliar_spray`. The farmer explainer promises two; scoreboard segmentation only needs two; one extra tap on Telegram beats silent mis-tagging under three. Spec §6.6 keeps its richer `seed | in_furrow | foliar` as DB-agnostic documentation.
2. **Telegram: second keyboard.** After field selection, ask "seed treatment or foliar?" — one extra tap, avoids silent defaulting. Callback data extended to `apply_method:FIELD_ID:METHOD` (piggybacks on existing 3-part split).
3. **CHECK constraint.** Allow NULL method (so pre-existing rows survive, as required) but reject any non-enum value for `kind='application'`. New client code never writes NULL.
4. **Field-level `application_method` untouched.** That's the farmer's *plan*; the new `payload.method` is the *actual*. Different semantics. A rename pass on the field-level tokens (`liquid_seeding`) is out of scope here.

---

## Tasks

### T1 — Farmer dashboard: add `application` kind + conditional method picker
**Files:** `farmer.js`

- Add `["application", "Application (product applied)"]` to the kind options in `renderEventForm`.
- Below the select row, build a hidden method `<select>` (`seed_treatment` / `foliar_spray`) that becomes visible only when `kind === "application"`.
- In the submit handler, when `kind === "application"`: require method; build payload as `{ applied_at: new Date().toISOString(), method }`.

### T2 — Timeline summaries show the method
**Files:** `farmer.js`, `vendor.js`

- `summarizePayload` in both files: if `kind === 'application'`, render `${methodLabel} applied on ${date}` when method is present, fall back to current `Applied ${date}` for legacy rows.

### T3 — Migration: CHECK constraint on `payload.method`
**Files:** `supabase/migrations/20260420000008_application_method_check.sql` (NEW)

```sql
ALTER TABLE bio_trial.trial_events
  ADD CONSTRAINT trial_events_application_method_check
  CHECK (
    kind <> 'application'
    OR payload->>'method' IS NULL
    OR payload->>'method' IN ('seed_treatment', 'foliar_spray')
  );
```

Not-valid → validated in a second statement, so historical rows aren't re-checked at add time (belt-and-suspenders — every legacy row is already NULL-method anyway, but this keeps the lock brief).

### T4 — Telegram `/apply` flow: method picker
**Files:** `supabase/functions/bio-trial-farmer-inbox/index.ts`

- `handleApply` keeps its field picker but callback data stays `apply:FIELD_ID`.
- In `handleCallback` when `kind === 'apply'`: send a second keyboard asking the method, callback data `apply_method:FIELD_ID:seed_treatment` and `apply_method:FIELD_ID:foliar_spray`.
- Add a new branch for `kind === 'apply_method'` that does the insert with `{ applied_at, method }`.

### T5 — Farmer explainer sync
**Files:** `docs/farmer-explainer.md`

§7.2 currently says *"Type `/apply` — the bot pops up a list of your fields, you tap one, and it logs an application event."* → update to reflect the two-tap flow.

---

## Don't do (guardrails from the brief)

- Don't introduce a new top-level event `kind` — method lives inside application-event payload.
- Don't migrate existing rows; free-text notes stay free-text.
- Don't rename field-level `application_method` values (out of scope).

---

## Progress log

| Task | Description | Status | Notes |
|------|-------------|--------|-------|
| T1   | farmer.js: application kind + method picker      | ✅ | Added `application` to kind options; built hidden `application_method` select that unhides when kind=application; submit builds `payload = { applied_at, method, ?text }`. Also discovered/noted the pre-existing gap that `application` wasn't even selectable on the web form before this change. |
| T2   | farmer.js + vendor.js: timeline summary extended | ✅ | Shared shape: `${label} applied on ${date}` when method present, legacy rows still render `Applied ${date}`. Factored farmer.js summary into a small `formatApplicationSummary` helper; vendor.js uses an inline ladder to match the file's existing style. |
| T3   | CHECK-constraint migration                       | ✅ | `supabase/migrations/20260420000008_application_method_check.sql` added with `NOT VALID` + `VALIDATE` split. Needs manual `supabase db push` against the Bushel Board project (bio_trial schema) after merge — not auto-applied by the worktree. |
| T4   | Telegram `/apply` second keyboard                | ✅ | `handleCallback` reuses the 3-part split — `apply:FIELD_ID` now fans out to a second keyboard with `apply_method:FIELD_ID:seed_treatment` / `:foliar_spray`. Unknown-method guard added. Edge function redeploy (`supabase functions deploy bio-trial-farmer-inbox`) required after merge. |
| T5   | farmer-explainer.md §7.2 copy sync               | ✅ | Wording updated to reflect the two-tap flow. |
| PR   | Branch + PR                                      | ✅ | [#3](https://github.com/Bushels/bio_trial/pull/3) — branch `feat/application-method-picker`, base `main`. Name bumped from `feat/application-method` because a prior worktree was still holding the shorter name. |

### Verification notes

- `node --check farmer.js` and `node --check vendor.js` pass.
- Regex-level semantic checks confirm `application` option, both method tokens, and `formatApplicationSummary` are present.
- End-to-end browser preview not exercised because the event-form render path is gated behind a live `farmer_bootstrap` JWT + Supabase backend, which the preview can't provide; changes follow the same RPC contract (`farmer_register_event`) as every other event kind.
- Existing rows untouched: legacy `payload.method`-less application events will still summarize as `Applied ${date}` in both farmer and vendor timelines, and pass the new CHECK constraint.
