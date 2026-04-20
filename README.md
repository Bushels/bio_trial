# Buperac Bio Trial — Landing Page (standalone)

Signup landing page for the 2026 Buperac × SixRing foliar biostimulant trial.

- **Frontend**: static HTML/CSS/JS at [trial.buperac.com](https://trial.buperac.com), deployed on Vercel (project `bio-trial`).
- **Backend**: Supabase — `bio_trial` schema on the Bushel Board project (`ibgsloyjxdopkvwqcqwh`). The schema is shared with Bushel Board's Supabase to avoid a second paid project while the trial is pre-revenue; see [`docs/plans/2026-04-19-bio-trial-standalone-design.md`](docs/plans/2026-04-19-bio-trial-standalone-design.md) for the extraction history and the future migration path to a dedicated project.

## Files

- `index.html` — farmer landing page. Agronomist-desk visual with sticky notes, hand-drawn diagram, live odometer, and signup form. Has a top-left "Live trial results" chip that points at `/trial` and a top-right "SixRing login" chip that points at `/vendor`.
- `vendor.html` / `vendor.js` — SixRing vendor console. Login + signups table with paid / liters / delivered controls and a "Farmer console" column (Copy farmer link / Rebind Telegram / Events panel).
- `farmer.html` / `farmer.js` — per-farmer dashboard. JWT-authed via `?token=` URL param; surfaces signup summary, Telegram CTA, field CRUD, event log form with file upload, timeline.
- `trial.html` / `trial.js` — public live-results dashboard. Single anon RPC call; privacy floor ≥3 farms for per-crop aggregates.
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
| `public.farmer_register_event(p_token text, p_kind text, p_field_id uuid, p_payload jsonb, p_file_urls text[])` | anon (verified by JWT) | Writes a `trial_events` row with `source='farmer_web'`. |
| `public.farmer_verify_token(p_token text)` | anon (wraps `bio_trial.verify_farmer_jwt`) | Thin `public.*` wrapper so the upload-URL edge function can verify a token through the PostgREST gateway (which only exposes `public`/`graphql_public`). Returns the signup UUID or NULL; swallows malformed-base64 decode errors. |
| `public.get_trial_dashboard()` | anon | Public dashboard payload: headline stats, per-crop yield aggregates (privacy floor ≥3 farms), anonymized activity feed (province-only), public-opt-in photos. Powers `/trial`. |

The underlying tables are `bio_trial.signups`, `bio_trial.vendor_users`, `bio_trial.trial_fields`, `bio_trial.trial_events`. **Conversion rule:** 0.5 L = 1 acre, so `liters_purchased × 2 = acres_from_liters`. Status lifecycle: `new → contacted → approved → shipped → completed` (or `declined`).

## Farmer inbox (Telegram)

`@BuperacTrialBot` (Telegram Bot API) webhook points at the `bio-trial-farmer-inbox` edge function. Every request is verified via the `X-Telegram-Bot-Api-Secret-Token` header; unverified POSTs 403.

Supported interactions:

| User action | Bot behaviour |
|---|---|
| `/start <signup_id>` (deep-link from farmer dashboard) | Writes `signups.farmer_telegram_chat_id`. Atomic — won't clobber an existing binding. |
| Free-form text | `trial_events(kind='observation', source='telegram')` |
| Photo | Downloads largest-resolution via `getFile`, uploads to `trial-uploads/{signupId}/…`, writes `kind='photo'` event with `file_urls=[path]`. |
| `/apply` | Inline keyboard of the farmer's fields; on tap writes `kind='application'`. |
| `/yield <bu>` | Inline keyboard of fields; on tap writes `kind='yield'` with `payload.bu_per_ac`. |

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

- **`/farmer`** — JWT-authed per-farmer dashboard. The vendor mints a token through the "Copy farmer link" button and shares the URL (`/farmer?token=…`) by email. Farmers see their signup summary, a Telegram connect-or-connected CTA, field CRUD, an event-log form with PDF/photo upload, and a timeline of all their events. Uploads go through the `bio-trial-farmer-upload-url` edge function (which signs a `trial-uploads` upload URL after verifying the JWT).
- **`/trial`** — public live-results dashboard. Single anon call to `public.get_trial_dashboard`; DB-enforced privacy floor hides per-crop yield aggregates until ≥3 farms have reported, and the activity feed exposes only province-level identifiers ("A farmer in SK logged observation on wheat"). No raw names, farm names, emails, RM/county values, or liters ever leave the DB through this RPC.
- Because Vercel strips `.html` and can drop query strings on redirect, farmer links are always built as `/farmer?token=…` (no `.html` suffix).

## Signup notifications

Every `INSERT` on `bio_trial.signups` fires the `trg_signups_notify` trigger, which does a fire-and-forget `pg_net` POST to the `bio-trial-notify-signup` edge function. The function sends a formatted message to Telegram (`@BuperacTrialBot` → Kyle).

Why Telegram and not email: Resend's free tier only allows one verified domain (already used by another Bushels project), and upgrading to Pro is $20/mo. Telegram's Bot API is free and delivers a push to phone in ~1s.

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

## Deploy

Vercel picks up pushes to `main` automatically (project `bio-trial`). Custom domain `trial.buperac.com` is configured with a CNAME at the Shopify-managed apex (`buperac.com`) pointing at Vercel's per-project target. Framework preset: **Other**; no build command; output directory is the repo root.
