# Buperac Bio Trial — Landing Page (standalone)

Signup landing page for the 2026 Buperac × SixRing foliar biostimulant trial.

- **Frontend**: static HTML/CSS/JS at [trial.buperac.com](https://trial.buperac.com), deployed on Vercel (project `bio-trial`).
- **Backend**: Supabase — `bio_trial` schema on the Bushel Board project (`ibgsloyjxdopkvwqcqwh`). The schema is shared with Bushel Board's Supabase to avoid a second paid project while the trial is pre-revenue; see [`docs/plans/2026-04-19-bio-trial-standalone-design.md`](docs/plans/2026-04-19-bio-trial-standalone-design.md) for the extraction history and the future migration path to a dedicated project.

## Files

- `index.html` — farmer landing page. Agronomist-desk visual with sticky notes, hand-drawn diagram, live odometer, and signup form. Has a top-left "Live trial results" chip that points at `/trial` and a top-right "SixRing login" chip that points at `/vendor`.
- `vendor.html` / `vendor.js` — SixRing vendor console. Login + signups table with paid / liters / delivered controls and a "Farmer console" column (Copy farmer link / Rebind Telegram / Events panel).
- `farmer.html` / `farmer.js` / `farmer.css` — per-farmer dashboard. JWT-authed via `?token=` URL param; surfaces signup summary, Telegram CTA, field CRUD, event log form with file upload, timeline. Uses the desk aesthetic (folder header, quick-tile plaques, two-column board that collapses to one on mobile) with a dedicated stylesheet scoped via `body.farmer` and `--f-` prefixed tokens so it doesn't collide with `styles.css`. Mobile-first: breakpoints at 520 / 720 / 980 px, iOS input font-size 17 px (prevents zoom-on-focus), 44 px touch targets on all buttons.
- `trial.html` / `trial.js` — public live-results dashboard. Single anon RPC call; privacy floor ≥3 farms for per-crop aggregates. Headline also surfaces rigor-tier counts (Controlled / Referenced / Observational / Type pending) so viewers can read the quality mix at a glance.
- `styles.css` — landing-page styles.
- `app.js` — landing-page form submission, odometer animation, Supabase wiring.
- `supabase-config.js` — Supabase URL + anon key (safe to commit; gated by RLS and `SECURITY DEFINER` RPCs).
- `supabase/functions/bio-trial-notify-signup/` — Telegram push on new signups (→ Kyle).
- `supabase/functions/bio-trial-farmer-inbox/` — Telegram webhook receiver for farmer chat. `/start <signup_id>` binding, free-form text observations, photos, `/apply`, `/yield`.
- `supabase/functions/bio-trial-farmer-upload-url/` — mints signed upload URLs against the `trial-uploads` bucket after verifying a farmer JWT.
- `uploads/` — image assets referenced by the page.

## Backend surface

RPCs exposed under `public.*` (the `bio_trial.*` schema stays isolated — app code never reaches it directly):

**Landing page + vendor console (original).**

| Function | Caller | Use |
|---|---|---|
| `public.submit_bio_trial_signup(payload jsonb)` | anon | Inserts a signup row, returns the new total enrolled acres. Price is server-authoritative ($2.80/ac). If `logistics_method = 'ship'`, a delivery charge is quoted in follow-up — not captured on the form. |
| `public.get_bio_trial_acres()` | anon | Returns current `sum(acres)` for the odometer. |
| `public.list_bio_trial_signups()` | vendor-gated (`bio_trial.is_vendor()`) | Returns all signups as jsonb with computed `acres_from_liters`, plus `farmer_telegram_chat_id` / `farmer_linked_at` for the farmer-console UI. |
| `public.vendor_update_bio_trial_signup(p_signup_id uuid, p_patch jsonb)` | vendor-gated | Idempotent partial update. Allowed patch keys: `paid`, `liters`, `delivered`, `shipped`, `notes`. Timestamps stamp on `false → true` transitions; unknown keys fail closed. |

**Farmer dashboard + Telegram inbox (trial-dashboard ship).**

| Function | Caller | Use |
|---|---|---|
| `public.vendor_mint_farmer_token(p_signup_id uuid)` | vendor-gated | Returns a signed HS256 JWT (`bio_trial.mint_farmer_jwt`) for the given signup. Vendor UI copies `/farmer?token=…` to clipboard. |
| `public.vendor_unbind_farmer_telegram(p_signup_id uuid)` | vendor-gated | Clears `farmer_telegram_chat_id` + `farmer_linked_at` so the farmer can `/start` on a new phone. |
| `public.vendor_list_trial_events(p_signup_id uuid)` | vendor-gated | All `trial_events` for a signup, newest first. Powers the Events side panel. |
| `public.farmer_bootstrap(p_token text)` | anon (verified by JWT) | Verifies the farmer JWT, returns `{signup, fields, events, telegram_bound}`. Single call that drives `/farmer`. |
| `public.farmer_upsert_field(p_token text, p_patch jsonb)` | anon (verified by JWT) | Inserts / updates a `trial_fields` row. Auto-emits a `field_created` event row for the timeline. |
| `public.farmer_register_event(p_token text, p_kind text, p_field_id uuid, p_payload jsonb, p_file_urls text[], p_public_opt_in boolean, p_plot_id uuid)` | anon (verified by JWT) | Writes a `trial_events` row with `source='farmer_web'`. `p_public_opt_in=true` lets photos surface on the public dashboard. `p_plot_id` attributes yield/application events to a specific plot (required for strip/split delta math). **Invariant:** `p_kind='yield'` requires `p_field_id` — field-less yields would inflate the headline count without ever landing in an aggregate bucket. |
| `public.farmer_verify_token(p_token text)` | anon (wraps `bio_trial.verify_farmer_jwt`) | Thin `public.*` wrapper so the upload-URL edge function can verify a token through the PostgREST gateway (which only exposes `public`/`graphql_public`). Returns the signup UUID or NULL; swallows malformed-base64 decode errors. |
| `public.get_trial_dashboard()` | anon | Public dashboard payload: headline stats (incl. `rigor_tier_counts` — Controlled / Referenced / Observational / Undeclared fields), per-crop yield aggregates (privacy floor ≥3 farms), anonymized activity feed (province-only), public-opt-in photos, and `aggregates_by_tier` (currently **intentionally empty** — see "Trial types & rigor tiers" below). Powers `/trial`. |

**Trial types + plots (Codex audit §3a catch-up):**

| Function | Caller | Use |
|---|---|---|
| `public.farmer_set_trial_type(p_token text, p_field_id uuid, p_type text, p_extras jsonb)` | anon (verified by JWT) | Declares one of `STRIP / SPLIT / WHOLE_HISTORICAL / WHOLE_NEIGHBOR / OBSERVATIONAL` for a field, and (if no plots exist yet) seeds a sensible default plot set the farmer can rename. Never destroys existing plots. Writes a `trial_type_declared` event for the timeline. |
| `public.farmer_upsert_plot(p_token text, p_field_id uuid, p_patch jsonb)` | anon (verified by JWT) | Escape hatch for farmers who want >2 strips or custom labels. Virtual plots (check references on WHOLE_* trials) cannot be hand-edited here — they flow only from `farmer_set_trial_type`. |

The underlying tables are `bio_trial.signups`, `bio_trial.vendor_users`, `bio_trial.trial_fields`, `bio_trial.trial_events`, `bio_trial.trial_plots`. **Conversion rule:** 0.5 L = 1 acre, so `liters_purchased × 2 = acres_from_liters`. Status lifecycle: `new → contacted → approved → shipped → completed` (or `declined`).

## Farmer inbox (Telegram)

`@BuperacTrialBot` (Telegram Bot API) webhook points at the `bio-trial-farmer-inbox` edge function. Every request is verified via the `X-Telegram-Bot-Api-Secret-Token` header; unverified POSTs 403.

Supported interactions:

| User action | Bot behaviour |
|---|---|
| `/start <signup_id>` (deep-link from farmer dashboard) | Writes `signups.farmer_telegram_chat_id`. Atomic — won't clobber an existing binding. |
| Free-form text | `trial_events(kind='observation', source='telegram')` |
| Photo | Downloads largest-resolution via `getFile`, uploads to `trial-uploads/{signupId}/…`, writes `kind='photo'` event with `file_urls=[path]`. |
| `/apply` | Inline keyboard of the farmer's fields; on tap writes `kind='application'`. |
| `/yield <bu>` | Inline keyboard of fields; on tap writes `kind='yield'` with `payload.bu_per_ac`. **Strip/split fields are hidden from the picker** — they need plot-level attribution the single-tap keyboard can't collect, so the bot tells the farmer to log the yield on the web dashboard instead. A second defense re-checks at tap time against the live plots. |

Idempotency: a partial UNIQUE index on `trial_events.telegram_message_id` makes Telegram's retry-on-timeout land as a `23505` conflict that the edge function treats as success.

### Webhook setup (one-time)

After setting `BIO_TRIAL_TG_BOT_TOKEN` and `BIO_TRIAL_TG_WEBHOOK_SECRET` on the `bio-trial-farmer-inbox` edge function:

```bash
curl -X POST "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://ibgsloyjxdopkvwqcqwh.supabase.co/functions/v1/bio-trial-farmer-inbox",
    "secret_token": "<same value as BIO_TRIAL_TG_WEBHOOK_SECRET>",
    "allowed_updates": ["message", "callback_query"]
  }'
```

Verify with `curl "https://api.telegram.org/bot<BOT_TOKEN>/getWebhookInfo"` — expect `url` populated, `pending_update_count=0`.

## Farmer dashboard + public trial dashboard

- **`/farmer`** — JWT-authed per-farmer dashboard. The vendor mints a token through the "Copy farmer link" button and shares the URL (`/farmer?token=…`) by email. Farmers see their signup summary (farm folder header + quick-tile plaques for fields / plots / events / photos), a Telegram connect-or-connected CTA, field CRUD, a trial-type picker per field, plot management (for STRIP/SPLIT), an event-log form with PDF/photo upload and a "Show on public dashboard" consent checkbox for photos, and a timeline of all their events. The page lives in `farmer.html` + `farmer.js` + `farmer.css` — the same desk aesthetic as `/trial` and the landing page, mobile-first down to 375 px. Uploads go through the `bio-trial-farmer-upload-url` edge function (which signs a `trial-uploads` upload URL after verifying the JWT).
- **`/trial`** — public live-results dashboard. Single anon call to `public.get_trial_dashboard`; DB-enforced privacy floor hides per-crop yield aggregates until ≥3 farms have reported, and the activity feed exposes only province-level identifiers ("A farmer in SK logged observation on wheat"). No raw names, farm names, emails, RM/county values, or liters ever leave the DB through this RPC.
- Because Vercel strips `.html` and can drop query strings on redirect, farmer links are always built as `/farmer?token=…` (no `.html` suffix).

## Trial types & rigor tiers

Per `BioLift_Cooperator_Trial_Spec_v1.md` §5, each field declares one of five trial designs. Fields roll up into three **rigor tiers** on the public dashboard so viewers can judge the quality mix of the evidence base:

| Trial type | Plots | Tier | Notes |
|---|---|---|---|
| `STRIP` | 2+ real (treated / check) | **Controlled** | Side-by-side strips in the same field. Gold standard. |
| `SPLIT` | 2 real (treated / check) | **Controlled** | Field split in half. |
| `WHOLE_HISTORICAL` | 1 real treated + 1 virtual check (the farmer's 3-year yield average) | **Referenced** | `trial_fields.historical_yield_bu_per_ac` holds the virtual check. |
| `WHOLE_NEIGHBOR` | 1 real treated + 1 virtual check (a neighbor field, same crop, same farm) | **Referenced** | `trial_fields.neighbor_field_notes` describes the reference. |
| `OBSERVATIONAL` | 1 real treated, no check | **Observational** | Yield numbers count toward headline tallies but produce no delta. |
| *(not yet declared)* | — | **Undeclared** | Dashboard tile labelled "Type pending". |

**Current limitation — tiered aggregates are intentionally empty on `/trial`.** The v1 tier-segmented aggregate averaged raw `bu_per_ac` per `(crop, tier)` without joining `trial_plots.role`, so STRIP/SPLIT trials published a blended treated+check mean under "Controlled" — a number that looks like a treatment effect but isn't. Until role-aware delta math lands (per-field `avg(treated) − avg(check)`, then average across farms with the ≥3-farm privacy floor, with virtual checks for WHOLE_*), `get_trial_dashboard` returns `aggregates_by_tier: []` and `trial.js` falls back to the flat per-crop table. See `20260420000007_yield_field_required_and_hide_tiered.sql` for the rationale and the re-enable path.

**Photo consent.** `trial_events.public_opt_in` is `false` by default. Photos only surface on `/trial` when the farmer ticks "Show on public dashboard" on the per-event form — checked per-event, not globally.

**Yield invariant.** `farmer_register_event` rejects yield events without a `field_id` (enforced in both SQL and `farmer.js`). Without a field the event can't enter any aggregate bucket, but would still have inflated the headline "Yield reports" tile — two sides of the public scoreboard disagreeing. Telegram `/yield` additionally hides strip/split fields from the picker (plot attribution isn't collectible over a one-tap keyboard).

## Signup notifications

Every `INSERT` on `bio_trial.signups` fires the `trg_signups_notify` trigger, which does a fire-and-forget `pg_net` POST to the `bio-trial-notify-signup` edge function. The function sends a formatted message to Telegram (`@BuperacTrialBot` → Kyle).

Why Telegram and not email: Resend's free tier only allows one verified domain (already used by another Bushels project), and upgrading to Pro is $20/mo. Telegram's Bot API is free and delivers a push to phone in ~1s.

**Pricing invariant.** `public.submit_bio_trial_signup` stores `price_per_acre_cents = 280` on every signup. The web subtotal (`app.js`) and Telegram notifier (`bio-trial-notify-signup`) must preserve cents in display strings when needed. Do not use a whole-dollar-only CAD formatter for the per-acre price: `$2.80/ac` must not round to `$3/ac`.

**Vault entries** on the Supabase project (read by the trigger; update via `vault.update_secret` if rotated):

| Vault secret name | What it is |
|---|---|
| `bio_trial_fn_url` | Full URL of the deployed edge function |
| `bio_trial_webhook_secret` | Shared secret sent as `X-Webhook-Secret` on every trigger call; must match the edge-function env var of the same name |

**Edge function secrets** (Supabase Dashboard → Edge Functions → Secrets, or `supabase secrets set`):

| Secret | Required? | Notes |
|---|---|---|
| `BIO_TRIAL_TG_BOT_TOKEN` | yes | Bot token from @BotFather for `@BuperacTrialBot`. |
| `BIO_TRIAL_TG_CHAT_ID` | yes | Target chat ID (Kyle's private chat). Obtain via `https://api.telegram.org/bot<TOKEN>/getUpdates` after sending the bot any message. |
| `BIO_TRIAL_WEBHOOK_SECRET` | yes | Must equal the `bio_trial_webhook_secret` vault entry. |

If the two `TG_*` vars are missing the edge function degrades gracefully (returns `{sent:false, reason:"no_config"}`) instead of throwing — so a bad deploy won't block signup inserts.

To read the current webhook secret for mirroring into the edge function env:

```sql
SELECT decrypted_secret FROM vault.decrypted_secrets
WHERE name = 'bio_trial_webhook_secret';
```

## Local preview

```bash
python -m http.server 8000
# open http://localhost:8000
```

## Local checks

Deno is installed on this Windows profile via Scoop and is used to type-check the Supabase Edge Functions locally. Supabase's Deno type packages reference npm dependencies, so use `--node-modules-dir=auto`.

```bash
deno check --node-modules-dir=auto supabase/functions/bio-trial-notify-signup/index.ts
deno check --node-modules-dir=auto supabase/functions/bio-trial-farmer-inbox/index.ts
deno check --node-modules-dir=auto supabase/functions/bio-trial-farmer-upload-url/index.ts
```

## Deploy

Vercel picks up pushes to `main` automatically (project `bio-trial`). Custom domain `trial.buperac.com` is configured with a CNAME at the Shopify-managed apex (`buperac.com`) pointing at Vercel's per-project target. Framework preset: **Other**; no build command; output directory is the repo root.

Edge functions are deployed separately through Supabase CLI. The current production project ref is `ibgsloyjxdopkvwqcqwh`.

```bash
supabase functions deploy bio-trial-notify-signup --project-ref ibgsloyjxdopkvwqcqwh
```
