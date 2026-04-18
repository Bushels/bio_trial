# Buperac Bio Trial — Landing Page

Standalone signup landing page for the 2026 Buperac foliar biostimulant trial.
Designed in Claude Design, backed by Supabase (Bushel Board project), deploys as static files.

## Stack

- **Frontend**: static HTML/CSS/JS. No build step.
- **Backend**: Supabase — `bio_trial` schema in the Bushel Board project (`ibgsloyjxdopkvwqcqwh`).
- **Hosting**: intended for Vercel at `trial.buperac.com`.

## Files

- `index.html` — the landing page. "Agronomist's desk" visual with sticky notes, hand-drawn diagram, live odometer, and signup form.
- `styles.css` — all page styles.
- `app.js` — form submission, odometer animation, Supabase wiring.
- `supabase-config.js` — Supabase URL + anon key (safe to commit; gated by RLS/SECURITY DEFINER RPCs).
- `uploads/` — image assets referenced by the page.

## Backend surface

Two public-schema RPCs exposed to `anon` (schema details are isolated in `bio_trial.*`):

| Function | Returns | Use |
|---|---|---|
| `public.submit_bio_trial_signup(payload jsonb)` | `integer` | Inserts a signup row and returns the new total enrolled acres in one round trip. |
| `public.get_bio_trial_acres()` | `integer` | Returns the current total enrolled acres for the live odometer on page load. |

The underlying table is `bio_trial.signups`. Status lifecycle: `new → contacted → approved → shipped → completed` (or `declined`). The `promoted_user_id` column is reserved for the post-trial step that turns successful trial participants into Bushel Board users.

## Local preview

```bash
python -m http.server 8000
# open http://localhost:8000
```

## Deploy

Vercel → "import project" from GitHub. Framework preset: **Other**. No build command; output directory is the repo root. Add `trial.buperac.com` as a custom domain and CNAME it in your DNS.

## Future — trial → Bushel Board promotion

After the trial, a separate job reads `bio_trial.signups` where `status = 'completed'` and `promoted_user_id IS NULL`, creates `auth.users` + `public.profiles` + `public.farm_profiles` rows, sends magic-link invites, and stamps `promoted_user_id` on the signup row.
