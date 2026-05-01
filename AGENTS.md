# bio_trial Agent Rules

## Project Overview
- Static landing and dashboard site for the Buperac x SixRing 2026 foliar biostimulant trial.
- Frontend ships as static HTML/CSS/JS on Vercel project `bio-trial` at `trial.buperac.com`.
- Backend uses the `bio_trial` schema on the Bushel Board Supabase project `ibgsloyjxdopkvwqcqwh`.
- Use GPT-5.5 conventions: direct source-of-truth checks, narrow edits, explicit verification, and no push without Kyle approval.

## Repo Layout
- `index.html`: public landing/signup page.
- `trial.html`: public aggregated trial dashboard.
- `farmer.html`: JWT-authed farmer dashboard.
- `vendor.html`: vendor dashboard.
- `supabase/functions/`: Telegram bot, signup notification, and signed upload URL Edge Functions.
- `supabase/migrations/`: `bio_trial` schema, RLS, RPCs, privacy-floor logic, and seed data.
- `biostimulant-funding/`: funding directory source app.
- `docs/plans/`: planning and historical design notes.
- `docs/inquiries/`: seed-rep and farmer scenarios, including Dusty at ReLineHybrids.
- `uploads/`: public downloadable assets.

## Backend Surface
- App code calls Supabase RPCs only; never query the `bio_trial` schema directly from frontend code.
- Farmer flows use JWT-authed farmer RPCs.
- Vendor flows use separate vendor RPCs.
- Public trial pages use public trial RPCs only.

## Conventions
- Keep mobile-first breakpoints and verify narrow screens before desktop polish.
- Treat `0.5 L/ha = 1 acre` as the trial product-rate planning convention unless Kyle changes it.
- Prefer small static-page edits over adding frameworks or build steps.
- Prefer `preview_inspect` over `preview_screenshot` for CSS/debug work because computed styles are more useful and screenshots can timeout.
- Keep `docs/inquiries/` updated when seed-rep scenarios arrive from Dusty at ReLineHybrids.

## Rules
- No direct schema queries from app code.
- No raw farmer PII in public RPCs, public payloads, generated assets, or logs.
- The 3-farm privacy floor is DB-enforced; do not bypass it in frontend code, RPCs, or Edge Functions.
- Do not wire Eric from SixRing into notifications or the vendor console without explicit Kyle approval.
- Do not push without Kyle approval.
