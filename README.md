# Buperac Bio Trial — Landing Page (standalone)

Signup landing page for the 2026 Buperac × SixRing foliar biostimulant trial.
Backed by Supabase (Bushel Board project), deploys as static files.

> **This site is being absorbed into the Bushel Board app.** Phases 1–3 of
> [`bushel-board-app/docs/plans/2026-04-18-bio-trial-integration-design.md`](../bushel-board-app/docs/plans/2026-04-18-bio-trial-integration-design.md)
> are live at `bushel-board-app.vercel.app/` (homepage gained a trial section). This
> standalone site is kept as a fallback while the remaining phases (admin console,
> trial-flag gating, delivery → invite, Trial tab) move into Bushel Board on
> branch `feature/bio-trial-integration`. See the consolidated status doc:
> [`bushel-board-app/docs/handovers/2026-04-18-bio-trial-feature-status.md`](../bushel-board-app/docs/handovers/2026-04-18-bio-trial-feature-status.md).

## Stack

- **Frontend**: static HTML/CSS/JS. No build step.
- **Backend**: Supabase — `bio_trial` schema in the Bushel Board project (`ibgsloyjxdopkvwqcqwh`).
- **Hosting**: Vercel (`cleanUrls` enabled so `/vendor` resolves to `vendor.html`).

## Files

- `index.html` — farmer landing page. Agronomist-desk visual with sticky notes, hand-drawn diagram, live odometer, and signup form.
- `vendor.html` — SixRing vendor console. Login form + signups table with paid / liters / delivered controls.
- `styles.css` — landing-page styles.
- `app.js` — landing-page form submission, odometer animation, Supabase wiring.
- `vendor.js` — vendor console auth + RPC calls + DOM rendering (no innerHTML — security hook enforces this).
- `supabase-config.js` — Supabase URL + anon key (safe to commit; gated by RLS/SECURITY DEFINER RPCs).
- `uploads/` — image assets referenced by the page.

## Backend surface

Four RPCs exposed under `public.*` (the `bio_trial.*` schema stays isolated — app code never reaches it directly):

| Function | Caller | Use |
|---|---|---|
| `public.submit_bio_trial_signup(payload jsonb)` | anon | Inserts a signup row, returns the new total enrolled acres. |
| `public.get_bio_trial_acres()` | anon | Returns current `sum(acres)` for the odometer. |
| `public.bio_trial_list_signups()` | vendor-gated (`bio_trial.is_vendor()`) | Returns all signups as jsonb with computed `acres_from_liters`. |
| `public.bio_trial_vendor_update(p_signup_id uuid, p_paid bool, p_liters numeric, p_delivered bool, p_notes text)` | vendor-gated | Idempotent status update: `payment_confirmed_at` stamps only on `false → true`, `product_delivered_at` and `access_granted_at` stamp together. |

The underlying tables are `bio_trial.signups` and `bio_trial.vendor_users`. **Conversion rule:** 0.5 L = 1 acre (so `liters_purchased × 2 = acres_from_liters`). Status lifecycle: `new → contacted → approved → shipped → completed` (or `declined`). The `promoted_user_id` column is reserved for the delivery → invite step (not yet shipped — it's Phase 6 of the integration design doc, and will live in Bushel Board, not here).

> **Naming-convention open item:** the design doc plans `list_bio_trial_signups()` and `vendor_update_bio_trial_signup(id uuid, patch jsonb)`. We shipped `bio_trial_list_signups()` and `bio_trial_vendor_update(...)` with positional params this session. Both work; only one set should survive. See the consolidated status doc for the reconcile plan.

## Signup notifications

**Current state (2026-04-18):** Bushel Board's homepage trial section uses a different notification path — the browser POSTs to `/api/trial-notify` (Next.js Node route) which emails `kyle@bushelsenergy.com` via Resend. SixRing is intentionally not CC'd while Resend is in sandbox mode.

The legacy path below is still wired in the Supabase project and fires on direct-to-table inserts — kept for the standalone site only. It will be retired when Phase 7 ships and this site is paused.

Every `INSERT` on `bio_trial.signups` fires the `trg_signups_notify` trigger,
which does a fire-and-forget `pg_net` POST to the `bio-trial-notify-signup`
edge function. The function emails Eric Liu (SixRing) and Kyle via Resend.

**Vault entries** (already created — do not hand-edit in SQL; update via
`vault.update_secret` if rotated):

| Vault secret name | What it is |
|---|---|
| `bio_trial_fn_url` | Full URL of the deployed edge function |
| `bio_trial_webhook_secret` | Shared secret sent as `X-Webhook-Secret` on every trigger call |

**Edge function secrets** (set in Supabase Dashboard → Project Settings →
Edge Functions → Secrets, or `supabase secrets set`):

| Secret | Required? | Default | Notes |
|---|---|---|---|
| `RESEND_API_KEY` | yes | — | Resend API key with permission to send from the `BIO_TRIAL_FROM` domain |
| `BIO_TRIAL_FROM` | yes | — | `"Buperac Trial <trial@…>"` — must be a verified sender in Resend |
| `BIO_TRIAL_VENDOR_EMAIL` | no | `ericl@gosingletrack.com` | SixRing notification recipient |
| `BIO_TRIAL_OWNER_EMAIL` | no | `buperac@gmail.com` | Kyle's notification recipient |
| `BIO_TRIAL_WEBHOOK_SECRET` | no (recommended) | — | If set, the edge function rejects requests whose `X-Webhook-Secret` header does not match this value. Must equal the `bio_trial_webhook_secret` vault entry. |

To retrieve the current webhook secret so you can mirror it into the edge
function env:

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

Vercel → "import project" from GitHub. Framework preset: **Other**. No build command; output directory is the repo root. Add `trial.buperac.com` as a custom domain and CNAME it in your DNS.

## Future — trial → Bushel Board promotion

Plan (now tracked on branch `feature/bio-trial-integration` in the Bushel Board repo):

1. **At delivery, not completion.** When a SixRing vendor flips `product_delivered_at` via `bio_trial_vendor_update`, a trigger fires a `pg_net` POST to a new edge function `bio-trial-invite-farmer`.
2. **Edge function** calls `auth.admin.inviteUserByEmail(signup.email, { data: { bio_trial_signup_id: signup.id } })`, then stamps `bio_trial.signups.access_granted_at`.
3. **`handle_new_user()`** trigger reads `bio_trial_signup_id` out of `raw_user_meta_data` and sets `is_trial_participant = true` + `bio_trial_signup_id` on the new `public.profiles` row.
4. **Chat unlocks** for trial participants; non-trial users see the chat tab greyed out until general availability.
5. **Trial tab** (new, beyond the original design doc) reads from `bio_trial.trial_events` — structured rows extracted from Bushy chat conversations (applications, observations, yields). Gives Kyle + SixRing a live cohort view of how the trial is going.

See [`bushel-board-app/docs/handovers/2026-04-18-bio-trial-feature-status.md`](../bushel-board-app/docs/handovers/2026-04-18-bio-trial-feature-status.md) for the full phase plan, flow diagram, and contamination-prevention rules.
