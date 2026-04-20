# Buperac Bio Trial — Landing Page (standalone)

Signup landing page for the 2026 Buperac × SixRing foliar biostimulant trial.

- **Frontend**: static HTML/CSS/JS at [trial.buperac.com](https://trial.buperac.com), deployed on Vercel (project `bio-trial`).
- **Backend**: Supabase — `bio_trial` schema on the Bushel Board project (`ibgsloyjxdopkvwqcqwh`). The schema is shared with Bushel Board's Supabase to avoid a second paid project while the trial is pre-revenue; see [`docs/plans/2026-04-19-bio-trial-standalone-design.md`](docs/plans/2026-04-19-bio-trial-standalone-design.md) for the extraction history and the future migration path to a dedicated project.

## Files

- `index.html` — farmer landing page. Agronomist-desk visual with sticky notes, hand-drawn diagram, live odometer, and signup form.
- `vendor.html` — SixRing vendor console. Login form + signups table with paid / liters / delivered controls.
- `styles.css` — landing-page styles.
- `app.js` — landing-page form submission, odometer animation, Supabase wiring.
- `vendor.js` — vendor console auth + RPC calls + DOM rendering (no `innerHTML` — the security hook enforces this).
- `supabase-config.js` — Supabase URL + anon key (safe to commit; gated by RLS and `SECURITY DEFINER` RPCs).
- `uploads/` — image assets referenced by the page.

## Backend surface

Four RPCs exposed under `public.*` (the `bio_trial.*` schema stays isolated — app code never reaches it directly):

| Function | Caller | Use |
|---|---|---|
| `public.submit_bio_trial_signup(payload jsonb)` | anon | Inserts a signup row, returns the new total enrolled acres. Price is server-authoritative ($2.80/ac). If `logistics_method = 'ship'`, a delivery charge is quoted in follow-up — not captured on the form. |
| `public.get_bio_trial_acres()` | anon | Returns current `sum(acres)` for the odometer. |
| `public.list_bio_trial_signups()` | vendor-gated (`bio_trial.is_vendor()`) | Returns all signups as jsonb with computed `acres_from_liters`. |
| `public.vendor_update_bio_trial_signup(p_signup_id uuid, p_patch jsonb)` | vendor-gated | Idempotent partial update. Allowed patch keys: `paid`, `liters`, `delivered`, `shipped`, `notes`. Timestamps stamp on `false → true` transitions; unknown keys fail closed. |

The underlying tables are `bio_trial.signups` and `bio_trial.vendor_users`. **Conversion rule:** 0.5 L = 1 acre, so `liters_purchased × 2 = acres_from_liters`. Status lifecycle: `new → contacted → approved → shipped → completed` (or `declined`).

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
