# Bio Trial Standalone Extraction — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extract the Buperac bio-trial landing page from the Bushel Board Supabase project into a new standalone "Buperac Trial" Supabase project at `trial.buperac.com`, and rip out the trial integration from `bushel-board-app`.

**Architecture:** Rebuild the `bio_trial.*` schema + public RPC wrappers + notification trigger + edge function in a new Supabase project; swap `supabase-config.js` in `Bushels/bio_trial`; re-point the existing Vercel deployment to `trial.buperac.com` via a CNAME; delete the homepage trial section and `/api/trial-notify` route from `bushel-board-app`; rename the old schema to `bio_trial_archived`.

**Tech Stack:** Supabase (Postgres 17, Edge Functions, pg_net, Vault), Resend, Vercel, static HTML/JS, Next.js (for the removal PR).

**Reference design:** `docs/plans/2026-04-19-bio-trial-standalone-design.md`.

---

## Phase A — Capture old-project DDL and function source

Before destroying anything, pull the authoritative schema and edge-function source from the old Bushel Board project (`ibgsloyjxdopkvwqcqwh`) so we can rebuild verbatim in the new project.

### Task A1: Capture table DDL

**Files:**
- Create: `supabase/migrations/20260419_0001_bio_trial_tables.sql`

**Step 1: Dump tables via MCP**

Run via Supabase MCP `execute_sql` against project `ibgsloyjxdopkvwqcqwh`:

```sql
SELECT
  format('CREATE TABLE %I.%I (', table_schema, table_name) AS header,
  string_agg(
    format(
      '  %I %s%s%s',
      column_name,
      data_type,
      CASE WHEN is_nullable = 'NO' THEN ' NOT NULL' ELSE '' END,
      CASE WHEN column_default IS NOT NULL THEN ' DEFAULT ' || column_default ELSE '' END
    ),
    E',\n' ORDER BY ordinal_position
  ) AS body
FROM information_schema.columns
WHERE table_schema = 'bio_trial'
GROUP BY table_schema, table_name;
```

Also capture check constraints:

```sql
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE connamespace = 'bio_trial'::regnamespace
  AND contype IN ('c', 'u', 'p', 'f');
```

Also capture indexes:

```sql
SELECT indexdef FROM pg_indexes WHERE schemaname = 'bio_trial';
```

**Step 2: Write migration**

Assemble into `supabase/migrations/20260419_0001_bio_trial_tables.sql`. Start with:

```sql
-- Bio trial tables, extracted from Bushel Board project 2026-04-19
CREATE SCHEMA IF NOT EXISTS bio_trial;

CREATE TABLE bio_trial.signups (
  -- columns from dump
);
COMMENT ON TABLE bio_trial.signups IS 'Farmer trial signups. ...';

CREATE TABLE bio_trial.vendor_users (
  -- columns from dump
);
COMMENT ON TABLE bio_trial.vendor_users IS 'Maps Supabase auth users to vendor access ...';
```

Include all CHECK constraints and column comments from the dump. Reference the column list captured in `project_standalone_extraction.md` memory / the verbose `list_tables` output.

**Step 3: Commit**

```bash
git add supabase/migrations/20260419_0001_bio_trial_tables.sql
git commit -m "chore: capture bio_trial table DDL as migration"
```

---

### Task A2: Capture RPC source

**Files:**
- Create: `supabase/migrations/20260419_0002_bio_trial_rpcs.sql`

**Step 1: Dump function definitions**

Run against `ibgsloyjxdopkvwqcqwh`:

```sql
SELECT
  n.nspname AS schema,
  p.proname AS function,
  pg_get_functiondef(p.oid) AS ddl
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE (n.nspname = 'public' AND p.proname IN (
         'submit_bio_trial_signup',
         'get_bio_trial_acres',
         'bio_trial_list_signups',
         'bio_trial_vendor_update'))
   OR (n.nspname = 'bio_trial' AND p.proname = 'is_vendor')
ORDER BY n.nspname, p.proname;
```

**Step 2: Write migration**

Paste each `ddl` (prefixed with `CREATE OR REPLACE FUNCTION`) into the migration file. Include GRANTs:

```sql
-- anon-callable wrappers
GRANT EXECUTE ON FUNCTION public.submit_bio_trial_signup(jsonb) TO anon;
GRANT EXECUTE ON FUNCTION public.get_bio_trial_acres() TO anon;

-- vendor-gated (authenticated + is_vendor check inside)
GRANT EXECUTE ON FUNCTION public.bio_trial_list_signups() TO authenticated;
GRANT EXECUTE ON FUNCTION public.bio_trial_vendor_update(uuid, boolean, numeric, boolean, text) TO authenticated;
```

**Step 3: Commit**

```bash
git add supabase/migrations/20260419_0002_bio_trial_rpcs.sql
git commit -m "chore: capture bio_trial RPC source as migration"
```

---

### Task A3: Capture notification trigger and pg_net setup

**Files:**
- Create: `supabase/migrations/20260419_0003_bio_trial_notify.sql`

**Step 1: Dump trigger + trigger function**

```sql
SELECT pg_get_functiondef(p.oid)
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'bio_trial'
  AND p.proname ILIKE '%notify%';

SELECT pg_get_triggerdef(t.oid)
FROM pg_trigger t
WHERE t.tgname = 'trg_signups_notify';
```

**Step 2: Write migration**

```sql
-- Requires pg_net extension
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Trigger function (body from dump)
CREATE OR REPLACE FUNCTION bio_trial.notify_signup()
RETURNS TRIGGER AS $$
  -- body from dump, reads vault secrets for fn_url + webhook_secret
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_signups_notify
  AFTER INSERT ON bio_trial.signups
  FOR EACH ROW EXECUTE FUNCTION bio_trial.notify_signup();
```

**Step 3: Commit**

```bash
git add supabase/migrations/20260419_0003_bio_trial_notify.sql
git commit -m "chore: capture bio_trial notification trigger as migration"
```

---

### Task A4: Capture edge-function source

**Files:**
- Create: `supabase/functions/bio-trial-notify-signup/index.ts`
- Create: `supabase/functions/bio-trial-notify-signup/deno.json` (if referenced)

**Step 1: Fetch source via MCP**

Use `get_edge_function` MCP tool against `ibgsloyjxdopkvwqcqwh` with slug `bio-trial-notify-signup`.

**Step 2: Save verbatim**

Copy the entrypoint source to `supabase/functions/bio-trial-notify-signup/index.ts`.

**Step 3: Commit**

```bash
git add supabase/functions/bio-trial-notify-signup/
git commit -m "chore: capture bio-trial-notify-signup edge function source"
```

---

## Phase B — Stand up new "Buperac Trial" Supabase project

### Task B1: Create the project

**Step 1: Confirm cost**

Use MCP `get_cost` with `type: "project"`, org `ejnqkiupdojcdcvkrkwx`. Get the confirmation ID.

**Step 2: Create project**

Use MCP `create_project`:
- name: `Buperac Trial`
- organization_id: `ejnqkiupdojcdcvkrkwx`
- region: `ca-central-1`
- confirm_cost_id: `<from previous step>`

Save the returned project ref (should look like `xxxxxxxxxxxxxxxxxxxx`).

**Step 3: Verify**

Use MCP `get_project` with the new ref. Expect `status: ACTIVE_HEALTHY`. If `COMING_UP`, wait 30–60 seconds and retry.

**Step 4: Record the ref**

Update `docs/plans/2026-04-19-bio-trial-standalone-design.md` with the new ref in the architecture diagram. Commit that edit separately.

---

### Task B2: Apply table migration

**Step 1: Apply via MCP**

Use `apply_migration` against the new project with:
- name: `bio_trial_tables`
- query: contents of `supabase/migrations/20260419_0001_bio_trial_tables.sql`

**Step 2: Verify tables exist**

Run via `execute_sql`:

```sql
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'bio_trial'
ORDER BY table_name, ordinal_position;
```

Expected: same column list as the old project (~24 columns on `signups`, 3 on `vendor_users`).

**Step 3: Enable RLS with vendor-gate policy**

The old project has `rls_enabled: true` on both tables, gated by `bio_trial.is_vendor()`. Capture that policy now:

```sql
-- Against old project
SELECT pg_get_expr(pol.polqual, pol.polrelid), pol.polname, c.relname
FROM pg_policy pol JOIN pg_class c ON c.oid = pol.polrelid
WHERE c.relnamespace = 'bio_trial'::regnamespace;
```

Apply the same policies via `apply_migration` to the new project:
- name: `bio_trial_rls`
- Enable RLS on both tables; re-create each policy verbatim.

---

### Task B3: Apply RPC migration

**Step 1: Apply**

Use `apply_migration`:
- name: `bio_trial_rpcs`
- query: contents of `supabase/migrations/20260419_0002_bio_trial_rpcs.sql`

**Step 2: Verify**

```sql
SELECT proname FROM pg_proc
WHERE pronamespace IN ('public'::regnamespace, 'bio_trial'::regnamespace)
  AND proname IN (
    'submit_bio_trial_signup', 'get_bio_trial_acres',
    'bio_trial_list_signups', 'bio_trial_vendor_update',
    'is_vendor'
  );
```

Expected: 5 rows.

---

### Task B4: Apply notification trigger migration

**Step 1: Apply**

Use `apply_migration`:
- name: `bio_trial_notify`
- query: contents of `supabase/migrations/20260419_0003_bio_trial_notify.sql`

**Step 2: Verify**

```sql
SELECT tgname FROM pg_trigger
WHERE tgrelid = 'bio_trial.signups'::regclass
  AND NOT tgisinternal;
```

Expected: `trg_signups_notify`.

---

### Task B5: Deploy edge function

**Step 1: Deploy**

Use MCP `deploy_edge_function` with:
- project_id: new ref
- name: `bio-trial-notify-signup`
- entrypoint_path: `index.ts`
- files: `[{ name: "index.ts", content: <source from Task A4> }]`

**Step 2: Fetch and record the function URL**

```
https://<new-ref>.supabase.co/functions/v1/bio-trial-notify-signup
```

Save for Task B6.

---

### Task B6: Set Vault secrets

**Step 1: Generate webhook secret**

```sql
SELECT gen_random_uuid()::text;
```

Note the value.

**Step 2: Insert into vault**

Against new project:

```sql
SELECT vault.create_secret(
  '<full-function-url-from-B5>',
  'bio_trial_fn_url',
  'Full URL of the bio-trial-notify-signup edge function'
);

SELECT vault.create_secret(
  '<uuid-from-step-1>',
  'bio_trial_webhook_secret',
  'Shared secret header for trigger -> edge function calls'
);
```

**Step 3: Verify**

```sql
SELECT name FROM vault.decrypted_secrets
WHERE name IN ('bio_trial_fn_url', 'bio_trial_webhook_secret');
```

Expected: 2 rows.

---

### Task B7: Set Edge Function secrets

**Step 1: Set via Supabase Dashboard**

Dashboard → Project Settings → Edge Functions → Secrets. Add:

| Secret | Value |
|---|---|
| `RESEND_API_KEY` | `re_45DQvoSu_FoPcKXpMrYL7MdYHr9pxg3jq` (from Kyle, do not commit) |
| `BIO_TRIAL_FROM` | `Buperac Trial <trial@buperac.com>` (requires Resend domain verification — see Task E1) |
| `BIO_TRIAL_VENDOR_EMAIL` | `ericl@gosingletrack.com` |
| `BIO_TRIAL_OWNER_EMAIL` | `buperac@gmail.com` |
| `BIO_TRIAL_WEBHOOK_SECRET` | same UUID as the Vault `bio_trial_webhook_secret` |

**Step 2: Verify**

Trigger a test signup after Task C4 — if the email lands, secrets are correct.

---

### Task B8: Fetch anon key

**Step 1:**

Use MCP `get_publishable_keys` with the new project ref. Save the `anon` key.

**Step 2: Record in a non-committed file**

Do not commit the key yet (it will end up in `supabase-config.js` in Task C1 — which IS safe to commit because it's the anon key, but keep it out of the plan doc / chat history).

---

## Phase C — Frontend cutover

### Task C1: Swap supabase-config.js

**Files:**
- Modify: `supabase-config.js`

**Step 1: Edit**

Replace the URL and anonKey with the new project's values:

```js
window.__BIO_TRIAL_SUPABASE__ = {
  url: "https://<new-ref>.supabase.co",
  anonKey: "<new-anon-key>"
};
```

**Step 2: Verify locally**

```bash
python -m http.server 8000
# open http://localhost:8000
```

Open browser devtools → Network tab. Submit a test signup. Expect the POST to go to the new Supabase URL, and a 200 response.

**Step 3: Check for errors**

Browser console should be clean (no CORS, no 401, no schema errors).

**Step 4: Commit**

```bash
git add supabase-config.js
git commit -m "feat: point bio_trial landing page at standalone Supabase project"
```

---

### Task C2: Rewrite README

**Files:**
- Modify: `README.md`

**Step 1: Edit**

Remove the "being absorbed into Bushel Board" block. Update the Stack section to reflect standalone state. Replace references to `ibgsloyjxdopkvwqcqwh` with the new ref. Remove the "Future — trial → Bushel Board promotion" section entirely.

**Step 2: Commit**

```bash
git add README.md
git commit -m "docs: update README for standalone project state"
```

---

### Task C3: Push and let Vercel deploy

**Step 1: Push**

```bash
git push origin main
```

**Step 2: Watch Vercel**

Vercel auto-deploys on push. Open the Vercel dashboard, confirm the deploy succeeds, visit the preview URL (`bio-trial-dusky.vercel.app`), re-run the smoke test from C1 Step 2.

---

### Task C4: Add custom domain in Vercel

**Step 1: Vercel dashboard**

Project → Domains → Add → `trial.buperac.com`. Vercel will display required DNS records.

**Step 2: Add DNS record**

In the DNS provider for `buperac.com` (likely Shopify's DNS panel):

- Type: `CNAME`
- Name: `trial`
- Value: `cname.vercel-dns.com`
- TTL: default

Do NOT touch the apex `buperac.com` records — the Shopify site stays live.

**Step 3: Wait and verify**

`dig trial.buperac.com` should resolve after a few minutes. Vercel will auto-issue a Let's Encrypt cert; the green checkmark in the Domains panel can take 5–30 minutes.

**Step 4: Smoke test on the real domain**

Visit `https://trial.buperac.com`. Submit a real (but throwaway-email) signup. Verify:
- Row appears in `bio_trial.signups` in the new project.
- Kyle + Eric both receive notification emails.
- Odometer reflects the new acres total.

---

### Task C5: Register SixRing vendor

**Step 1: Eric logs in**

Eric visits `trial.buperac.com/vendor`, enters `ericl@gosingletrack.com`, clicks the magic link in his email.

**Step 2: Grab his auth user_id**

Run against the new project:

```sql
SELECT id, email FROM auth.users
WHERE email = 'ericl@gosingletrack.com';
```

**Step 3: Insert vendor row**

```sql
INSERT INTO bio_trial.vendor_users (user_id, vendor_name)
VALUES ('<eric-uuid>', 'SixRing');
```

**Step 4: Verify**

Eric refreshes `/vendor` — the signups table should render (with only the test row from C4 Step 4).

**Step 5: Delete the test signup**

```sql
DELETE FROM bio_trial.signups WHERE email = '<throwaway-email>';
```

---

## Phase D — Rip out Bushel Board integration

Work in the separate `bushel-board-app` repo (`C:\Users\kyle\Agriculture\bushel-board-app` — adjust path if different).

### Task D1: Create working branch

**Step 1:**

```bash
cd <bushel-board-app repo>
git checkout main
git pull
git checkout -b remove/bio-trial-integration
```

---

### Task D2: Delete homepage trial section

**Step 1: Locate the component**

```bash
grep -rln "bio_trial\|bio-trial\|buperac\|trial-notify\|foliar" app/ components/ lib/ pages/ 2>/dev/null
```

**Step 2: Delete trial-specific files**

Identify files that exist solely for the trial integration. Delete them with `git rm`.

**Step 3: Edit shared files**

Remove the trial section from the homepage. Remove any imports of the deleted components.

**Step 4: Delete `/api/trial-notify`**

```bash
git rm app/api/trial-notify/route.ts   # or pages/api/trial-notify.ts
```

**Step 5: Remove env vars**

Search for `RESEND` / `TRIAL` / `BIO_TRIAL` env vars that are *only* for the trial. Remove from `.env.example`, Vercel project settings (trial-specific ones), and any `env.ts`/`env.mjs` schema.

**Step 6: Run the app locally**

```bash
npm run dev
```

Visit `localhost:3000`. Confirm the homepage renders without the trial section and without errors.

**Step 7: Run type checks + tests**

```bash
npm run typecheck
npm run test
```

Both must pass before commit.

**Step 8: Commit**

```bash
git add -A
git commit -m "feat: remove bio-trial integration from homepage and API"
```

---

### Task D3: Archive bio_trial schema in Bushel Board Supabase

**Files:**
- Create: `supabase/migrations/<YYYYMMDDHHMMSS>_archive_bio_trial.sql` (in `bushel-board-app` repo)

**Step 1: Write migration**

```sql
-- Rename the schema (reversible)
ALTER SCHEMA bio_trial RENAME TO bio_trial_archived;

-- Drop the public wrappers (the app no longer calls them)
DROP FUNCTION IF EXISTS public.submit_bio_trial_signup(jsonb);
DROP FUNCTION IF EXISTS public.get_bio_trial_acres();
DROP FUNCTION IF EXISTS public.bio_trial_list_signups();
DROP FUNCTION IF EXISTS public.bio_trial_vendor_update(uuid, boolean, numeric, boolean, text);
```

**Step 2: Apply via MCP**

Use `apply_migration` against Bushel Board (`ibgsloyjxdopkvwqcqwh`):
- name: `archive_bio_trial`
- query: the SQL above.

**Step 3: Verify**

```sql
SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 'bio_trial%';
-- Expect: bio_trial_archived only

SELECT proname FROM pg_proc
WHERE pronamespace = 'public'::regnamespace AND proname LIKE '%bio_trial%';
-- Expect: 0 rows
```

**Step 4: Commit**

```bash
git add supabase/migrations/<file>.sql
git commit -m "chore: archive bio_trial schema in Bushel Board"
```

---

### Task D4: Delete old edge function

**Step 1: Remove from repo**

```bash
git rm -r supabase/functions/bio-trial-notify-signup
```

**Step 2: Delete from Supabase**

Dashboard → Bushel Board → Edge Functions → `bio-trial-notify-signup` → Delete.

(No MCP tool exists for deletion; do it manually.)

**Step 3: Commit**

```bash
git commit -m "chore: remove bio-trial edge function from Bushel Board"
```

---

### Task D5: Push and PR

**Step 1:**

```bash
git push -u origin remove/bio-trial-integration
gh pr create --title "Remove bio-trial integration from Bushel Board" --body "$(cat <<'EOF'
## Summary
- Trial extracted to standalone project at trial.buperac.com
- Removed homepage trial section and /api/trial-notify route
- Archived bio_trial schema → bio_trial_archived, dropped public wrapper RPCs
- Removed bio-trial-notify-signup edge function

See: Bushels/bio_trial/docs/plans/2026-04-19-bio-trial-standalone-design.md

## Test plan
- [ ] Local dev server: homepage renders cleanly, no console errors
- [ ] `npm run typecheck` passes
- [ ] `npm run test` passes
- [ ] Preview deploy: trial section absent
EOF
)"
```

**Step 2: Close any related open branches/PRs**

Close `feature/bio-trial-integration` (referenced in the README handover doc) without merging.

---

## Phase E — Final cleanup

### Task E1: Verify/add Resend domain for buperac.com

**Step 1: Resend dashboard**

Verify `buperac.com` is an authenticated sender domain in Resend. If not:
- Add domain in Resend.
- Copy the TXT + CNAME records Resend provides.
- Add them alongside the `trial` CNAME in the Shopify DNS panel.
- Wait for Resend to verify.

**Step 2: Verify `BIO_TRIAL_FROM` sends**

Send a test signup; confirm the email arrives without spam flags.

---

### Task E2: Final end-to-end smoke

**Step 1: In order:**

1. `https://trial.buperac.com` loads (HTTPS green padlock).
2. Submit a signup as a pretend farmer.
3. Kyle + Eric receive notifications.
4. Eric logs in at `/vendor`, sees the new row.
5. Eric flips paid=true; `payment_confirmed_at` stamps.
6. `https://bushelsboard.com` — no trial section, no errors.
7. Delete test rows from `bio_trial.signups` in the new project.

**Step 2: If all green, mark the design doc as `Status: Shipped`** in `docs/plans/2026-04-19-bio-trial-standalone-design.md` and commit.

---

## Rollback

If something breaks within 24h:

1. Revert `supabase-config.js` to the old Bushel Board URL + anon key; redeploy.
2. Unarchive: `ALTER SCHEMA bio_trial_archived RENAME TO bio_trial;`
3. Re-apply the dropped wrapper RPCs from git history (`git show <hash>:supabase/migrations/...` in the Bushel Board repo).
4. Re-deploy the old edge function (source is captured in `supabase/functions/bio-trial-notify-signup/index.ts` in this repo from Task A4).

Once rollback is no longer possible (e.g. after 1 week of successful standalone operation), we can drop `bio_trial_archived` from the Bushel Board project.
