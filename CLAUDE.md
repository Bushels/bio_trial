# Claude Notes

- See `AGENTS.md` for project rules; the same rules apply to Claude.
- Keep `AGENTS.md` and this file rules-only: no activity logs, recent changes, or session notes.
- Prefer `preview_inspect` over `preview_screenshot` for CSS work because computed styles beat screenshot timeout risk.
- Use `mcp__supabase` for DB inspection against Bushel Board project `ibgsloyjxdopkvwqcqwh`.
- App code calls RPCs only; never query the `bio_trial` schema directly from frontend code.
- Farmer flows use JWT-authed farmer RPCs; vendor flows use separate vendor RPCs; public trial pages use public trial RPCs only.
- No raw farmer PII in public RPCs or public payloads.
- The 3-farm privacy floor is DB-enforced; do not bypass it.
- Do not wire Eric from SixRing into notifications or vendor-console without explicit Kyle approval.
- Verify `supabase/functions/` when editing Edge Functions.
- Keep mobile-first breakpoints and the `0.5 L/ha = 1 acre` planning convention unless Kyle changes it.
- Keep `docs/inquiries/` updated when seed-rep scenarios arrive from Dusty at ReLineHybrids.
- Push policy (revised 2026-05-01): push to `main` is pre-approved for routine work — content edits, SEO/meta tweaks, doc/comment changes, refactors with passing checks, generated province pages, and pillar articles already reviewed via Codex. Vercel build failures are the deploy gate. Still ask before: force-push or `--no-verify`; branch deletion or `git reset --hard`; schema migrations against the shared Bushel Board Supabase (`ibgsloyjxdopkvwqcqwh`); changes to `.env*` files, `supabase-config.js`, `vercel.json`, or anything routing-related; deletion of farmer/vendor data; or any push that touches more than ~30 files at once without prior plan.
