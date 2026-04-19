# Bio Trial — Standalone Extraction Design

**Date:** 2026-04-19
**Status:** Approved, ready for implementation plan
**Owner:** Kyle Bushell (kyle@bushelsenergy.com)

## Context

The Buperac × SixRing 2026 foliar biostimulant trial has two surfaces today:

1. A standalone landing page at `bio-trial-dusky.vercel.app` (repo: `Bushels/bio_trial`), backed by the `bio_trial.*` schema inside the **Bushel Board** Supabase project (`ibgsloyjxdopkvwqcqwh`).
2. A homepage trial section and `/api/trial-notify` route in `bushel-board-app`, absorbing Phases 1–3 of the prior integration plan
   (see `bushel-board-app/docs/plans/2026-04-18-bio-trial-integration-design.md`).

The plan had been to continue absorbing the trial *into* Bushel Board. We are reversing course: the trial should be fully standalone in code, database, and domain. The Bushels Board app should have no awareness of the trial at all.

## Goals

- **Full separation of database.** Trial data lives in its own Supabase project; Bushel Board's database contains no trial tables.
- **Full separation of code.** `bushel-board-app` contains no trial UI, no trial API route, no trial env vars.
- **Portable domain.** Trial lives at `trial.buperac.com` (a domain Kyle owns, currently serving a Shopify site at the apex).
- **Low-friction cutover.** Two PRs at most (one per repo), zero data migration (existing signups are test rows), minimal DNS surface change.

## Non-goals

- Moving the `Bushels/bio_trial` GitHub repo to a new org. (Deferred — can happen anytime if handoff to SixRing becomes real.)
- Creating a new Vercel project or Vercel team. (Existing `bio-trial-dusky` project is reused.)
- Preserving the 2 existing signup rows or 1 vendor row. (All test data; safe to drop.)
- Keeping old `bio-trial-notify-signup` edge function in Bushel Board. (Will be deleted after cutover.)

## Architecture

Two fully independent systems after cutover:

```
┌──────────────────────────────┐      ┌──────────────────────────────┐
│  trial.buperac.com (Vercel)  │      │  bushelsboard.com (Vercel)   │
│  Bushels/bio_trial repo      │      │  bushel-board-app repo       │
│  static HTML/CSS/JS          │      │  Next.js                     │
└──────────────┬───────────────┘      └──────────────┬───────────────┘
               │                                     │
               ▼                                     ▼
┌──────────────────────────────┐      ┌──────────────────────────────┐
│  Supabase: "Buperac Trial"   │      │  Supabase: "Bushel Board"    │
│  (new project, ca-central-1) │      │  bio_trial schema archived   │
│  bio_trial.* schema          │      │  (renamed bio_trial_archived)│
│  + bio-trial-notify-signup   │      │  other app tables untouched  │
│  + Vault secrets             │      │                              │
└──────────────────────────────┘      └──────────────────────────────┘
```

## Components

### New Supabase project — "Buperac Trial"

- **Region:** `ca-central-1` (matches Pipe Vault / WellFi; co-locates with Canadian users).
- **Organization:** same org as existing projects (`ejnqkiupdojcdcvkrkwx`).
- **Schema to rebuild** (fresh migrations, not `pg_dump`):
  - `bio_trial.signups` — identical columns, checks, defaults (see `list_tables` output in the prep notes).
  - `bio_trial.vendor_users` — identical, FK to `auth.users.id` in the *new* project.
- **Public wrapper RPCs** (the only surface browser JS touches):
  - `public.submit_bio_trial_signup(payload jsonb)` → inserts signup, returns new acres sum.
  - `public.get_bio_trial_acres()` → returns `sum(acres)` for odometer.
  - `public.bio_trial_list_signups()` — vendor-gated.
  - `public.bio_trial_vendor_update(p_signup_id uuid, p_paid bool, p_liters numeric, p_delivered bool, p_notes text)` — vendor-gated.
  - Names match what `vendor.js` already calls — **no frontend changes required**. This resolves the README naming-convention open item: we ship `bio_trial_list_signups` / `bio_trial_vendor_update`, not the design-doc variant.
- **Trigger:** `trg_signups_notify` on `INSERT bio_trial.signups` → `pg_net` POST to `bio-trial-notify-signup` edge function.
- **Edge function:** `bio-trial-notify-signup` ported verbatim from the old project. Sends Resend email to Kyle + SixRing on every signup.
- **Vault secrets (fresh values, do not reuse old):**
  - `bio_trial_fn_url` — full URL of the new edge function.
  - `bio_trial_webhook_secret` — freshly generated (e.g. `gen_random_uuid()::text`).
- **Edge function secrets:**
  - `RESEND_API_KEY` = trial-specific Resend key provided by Kyle (`re_45DQvoSu_...`). Set via `supabase secrets set`; never committed.
  - `BIO_TRIAL_FROM` = verified Resend sender (e.g. `"Buperac Trial <trial@buperac.com>"` — requires domain verification in Resend).
  - `BIO_TRIAL_VENDOR_EMAIL` = `ericl@gosingletrack.com`.
  - `BIO_TRIAL_OWNER_EMAIL` = `buperac@gmail.com`.
  - `BIO_TRIAL_WEBHOOK_SECRET` = same value as the Vault `bio_trial_webhook_secret` entry.

### Frontend (`Bushels/bio_trial` repo)

- **Only file that changes:** `supabase-config.js` — swap `url` and `anonKey` to the new project's values.
- Everything else (HTML, CSS, `app.js`, `vendor.js`) stays identical; RPC signatures are unchanged.
- Remove the "being absorbed into Bushel Board" note from `README.md` and rewrite the stack description to reflect standalone state.

### Vercel

- Keep the existing `bio-trial-dusky` project; no new Vercel project.
- Add custom domain `trial.buperac.com` in Vercel → Project → Domains.
- `cleanUrls: true` in `vercel.json` stays as-is (so `/vendor` resolves to `vendor.html`).

### DNS

- In wherever `buperac.com` nameservers point (likely Shopify's DNS panel): add a `CNAME` record `trial → cname.vercel-dns.com`.
- Vercel auto-issues the Let's Encrypt cert once the CNAME resolves.
- The Shopify apex `buperac.com` A/ALIAS records are untouched — the Shopify site keeps working.

### Vendor re-registration (one-time manual)

- Eric @ SixRing visits `trial.buperac.com/vendor`, enters his email, receives a magic-link from the *new* project's `auth.users`.
- After he signs in, Kyle (or we) runs a small SQL insert to add his new `user_id` into `bio_trial.vendor_users`.
- Script: `INSERT INTO bio_trial.vendor_users (user_id, vendor_name) VALUES ('<new-uuid>', 'SixRing');`

### Bushel Board de-integration (separate PR in `bushel-board-app` repo)

**Code removal:**
- Homepage trial section component and styling (Phases 1–3 shipped).
- `/api/trial-notify` Next.js Node API route.
- Any in-flight work on `feature/bio-trial-integration` branch — close that PR without merging.
- Sweep for stragglers: `grep -r "bio_trial\|bio-trial\|trial-notify\|buperac"` and prune each hit.

**Database cleanup (Bushel Board Supabase, `ibgsloyjxdopkvwqcqwh`):**
- `ALTER SCHEMA bio_trial RENAME TO bio_trial_archived;` — reversible, zero-risk, keeps data intact as a reference.
- Drop the `public.*` wrapper RPCs (`submit_bio_trial_signup`, `get_bio_trial_acres`, `bio_trial_list_signups`, `bio_trial_vendor_update`) — nothing will call them once the homepage is removed.
- Delete the `bio-trial-notify-signup` edge function in this project.
- Leave Vault entries (`bio_trial_fn_url`, `bio_trial_webhook_secret`) — they're inert once the trigger is archived and the function is deleted.

## Data flow

Unchanged from today's model; only the project endpoint changes:

1. Farmer submits form → `app.js` calls `public.submit_bio_trial_signup(payload)` on the new Supabase project.
2. RPC inserts into `bio_trial.signups` → trigger fires → edge function emails Kyle + Eric.
3. RPC returns new `sum(acres)` → odometer animates to new total.
4. Eric logs into `/vendor` → `vendor.js` calls `bio_trial_list_signups()` / `bio_trial_vendor_update(...)`.

## Error handling

- **Signup form:** existing validation in `app.js` is unchanged. RPC returns explicit error on constraint violation; form surfaces it.
- **Notification failure:** edge function is fire-and-forget via `pg_net`. Insert is not rolled back if email fails; we rely on logs to catch issues.
- **DNS propagation:** the Vercel cert won't issue until the CNAME resolves. If the page 404s with SSL error for the first 10–30 min, that's expected — wait it out.
- **Rollback:** if something breaks within 24h of cutover, revert `supabase-config.js` to the old Bushel Board project URL/anon key and redeploy. The `bio_trial_archived` schema is still fully queryable — the old RPCs are dropped but can be restored by re-running the old migration from git history.

## Testing / smoke test

After cutover, in order:

1. Visit `trial.buperac.com` (once DNS + cert ready). Submit a signup with a throwaway email.
2. Verify row in new Supabase `bio_trial.signups` via the dashboard.
3. Verify Kyle + Eric receive notification emails.
4. Log in at `trial.buperac.com/vendor` as Eric, verify vendor console loads + signups table renders.
5. Toggle `paid = true` on the test row — confirm `payment_confirmed_at` stamps.
6. Visit `bushelsboard.com` — confirm the homepage trial section is gone.
7. Delete the test signup row.

## Commit / PR plan

Two PRs, sequenced:

**PR 1 (Bushels/bio_trial):** swap to new Supabase project.
- `supabase-config.js` URL + anon key change.
- `README.md` rewrite to reflect standalone state.
- Commit the schema migrations under `supabase/migrations/` (even though they're already applied — keeps source of truth in git).
- Merge, then do DNS + Vercel domain config.

**PR 2 (Bushels/bushel-board-app):** rip out trial integration.
- Delete homepage trial section components.
- Delete `/api/trial-notify`.
- Update any docs mentioning the integration (mark as reverted in the integration design doc, or delete if not useful).
- Run the Bushel Board Supabase cleanup migration (schema rename + RPC drops) as part of this PR's deploy.

## Open items / deferred

- **Domain verification in Resend** for the `buperac.com` sender domain — required before `BIO_TRIAL_FROM` can use `@buperac.com`. Likely means adding TXT + CNAME records to Shopify DNS.
- **Moving repo to a new GitHub org** — deferred; do only if SixRing or another party takes ownership.
- **Trial → Bushy promotion flow** (old Phase 6–7) — no longer relevant; the trial is fully standalone and has no auth bridge to Bushel Board.
