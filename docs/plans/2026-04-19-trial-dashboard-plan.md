# Trial Dashboard & Farmer Telegram Inbox — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ship the three-audience trial system — farmers send light data via Telegram, heavy data via a farmer dashboard, and a public trial dashboard surfaces redacted aggregates.

**Architecture:** One new Postgres schema surface (two tables, signups column, RLS, RPCs) on the existing Bushel Board Supabase project. One new edge function (Deno) that receives Telegram webhook updates. Three new frontend pages — `farmer.html`, `trial.html`, plus vendor console diffs. Auth: signed JWT in URL for farmers, `is_vendor()` for vendor, anon for the public dashboard.

**Tech Stack:**
- Supabase Postgres + RLS + `SECURITY DEFINER` RPCs (schema: `bio_trial`, public surface: `public.*`)
- Supabase Edge Functions (Deno runtime)
- Supabase Storage (`trial-uploads` bucket)
- Supabase Vault for secrets
- `pgjwt` extension for HS256 JWT mint/verify inside Postgres
- Telegram Bot API (webhook mode, inline keyboards, `getFile`)
- Vanilla HTML/CSS/JS frontend, deployed to Vercel, no build step
- Git flow: one commit per task

**Design reference:** [`2026-04-19-trial-dashboard-design.md`](2026-04-19-trial-dashboard-design.md) — read this first if anything here is unclear.

**Supabase project:** Bushel Board (`ibgsloyjxdopkvwqcqwh`). Use the Supabase MCP tools (`apply_migration`, `execute_sql`, `deploy_edge_function`, `get_logs`) — do not shell out to `supabase` CLI.

---

## Background context for the engineer

Read this before Task 1 — it explains *why* the architecture is the way it is, which matters when you hit edge cases.

- **Why three audiences on one table:** Marketing wants redacted stats on a public page; farmers need to see their own detail; SixRing needs admin views. Making `trial_events` shared (with RLS policies per audience) is cheaper than three separate event logs — same timeline, three different projections.
- **Why JWT in URL instead of Supabase Auth for farmers:** Farmers are one-season trial participants, not recurring Bushel Board users. Creating Supabase Auth users would require transactional email (we don't have Resend wired — $20/mo). A JWT signed with a server secret, containing `{sub: signup_id, exp}`, is stateless and costs nothing. Lost link = Kyle mints a new one.
- **Why Telegram for "light" data and the farmer dashboard for "heavy" data:** Farmers are busy; a photo with a caption is low-friction during spraying. But seed rates, tank mixes, soil-test PDFs don't fit in a chat message — those need a form.
- **Why the Telegram bot can identify farmers automatically:** Once a farmer taps the deep link (`t.me/BuperacTrialBot?start=<signup_id>`), Telegram sends `/start <signup_id>` as their first message. The webhook stamps `signups.farmer_telegram_chat_id` from `message.from.id`. Every subsequent message carries `chat_id` → we look up `signup_id`. Identity is sticky without the farmer doing anything more.
- **Why privacy floor ≥3 farms:** A public aggregate that reveals a single farm's yield defeats privacy. Requiring three farms per slice before surfacing averages is cheap and defensible.

---

## Supabase MCP primer

For anyone new to this — most backend work in this repo happens via Supabase MCP tools, not CLI:

- `mcp__supabase__apply_migration(project_id, name, query)` — records a migration in `supabase_migrations.schema_migrations` and applies it. Use for **all** DDL (CREATE/ALTER/DROP).
- `mcp__supabase__execute_sql(project_id, query)` — one-shot query, no migration record. Use for verification queries and data-path tests.
- `mcp__supabase__deploy_edge_function(project_id, name, files)` — deploys a Deno function. Returns the deployed version.
- `mcp__supabase__get_logs(project_id, service)` — pulls recent logs; `service='edge-function'` is what you want for debugging the webhook.

The project ID for this work is `ibgsloyjxdopkvwqcqwh` (Bushel Board). Always pass it explicitly.

---

## TDD adaptation for this codebase

There's no pytest / jest here — frontend is vanilla JS with no test runner, backend tests run as SQL queries in `execute_sql`. So "TDD" here means:

- **For SQL functions:** write the verification query first (`SELECT public.farmer_bootstrap(...)` expecting a specific jsonb shape), confirm it **errors** (function doesn't exist), write the function, rerun, confirm it **returns the expected shape**.
- **For edge functions:** write a `curl` invocation against the deployed function URL (or use `execute_sql` to POST via `pg_net`), assert the response, then code.
- **For frontend:** write a manual verification script (steps like "visit farmer.html?token=X, click Add Field, confirm row inserts"), then build the UI until the script passes.

This is lighter than classic TDD but keeps the discipline: you describe the behavior before you write it.

---

## Task breakdown

27 tasks across 8 phases. Each task is 2–15 minutes. Commit after every task.

- **Phase 1** (T1–T4): Schema foundation
- **Phase 2** (T5–T7): JWT mint/verify helpers
- **Phase 3** (T8–T11): Farmer RPCs
- **Phase 4** (T12): Public dashboard RPC
- **Phase 5** (T13–T18): Telegram inbox edge function
- **Phase 6** (T19–T22): Frontend pages
- **Phase 7** (T23–T25): Vendor console updates
- **Phase 8** (T26–T27): Smoke test + README

---

## Progress log

Updated per task so this file is always the source of truth for where we are. Search the git log for the task's commit to see the diff.

| Phase | Task | Title                                          | Status | Commit / notes |
|:-----:|:----:|:-----------------------------------------------|:------:|:---------------|
| 1     | T1   | `bio_trial.trial_fields` table                 | ✅     | `20260420000001_trial_fields_table` |
| 1     | T2   | `signups.farmer_telegram_chat_id` + `farmer_linked_at` | ✅ | `20260420000002_signups_telegram_binding` |
| 1     | T3   | `bio_trial.trial_events` + idempotency index   | ✅     | `20260420000003_trial_events_table` |
| 1     | T4   | `trial-uploads` private storage bucket         | ✅     | `20260420000004_trial_uploads_bucket` |
| 2     | T5   | enable `pgjwt` extension                       | ✅     | `20260420000005_enable_pgjwt` |
| 2     | T6   | `bio_trial.mint_farmer_jwt` + `verify_farmer_jwt` | ✅  | `20260420000006_farmer_jwt_helpers` |
| 2     | T7   | `public.vendor_mint_farmer_token` (`is_vendor()` gated) | ✅ | `20260420000007_vendor_mint_farmer_token` |
| 3     | T8   | `public.farmer_bootstrap` (adapted to real schema) | ✅ | `20260420000008_farmer_bootstrap` |
| 3     | T9   | `public.farmer_upsert_field`                   | ✅     | `20260420000009_farmer_upsert_field` |
| 3     | T10  | `public.farmer_register_event`                 | ✅     | `20260420000010_farmer_register_event` |
| 3     | T11  | `bio-trial-farmer-upload-url` edge fn + `farmer_verify_token` wrapper | ✅ | **pivot** from SQL RPC — see T11 section. Migrations `…11_public_farmer_verify_token` + `…12_farmer_verify_token_swallow_errors`. Edge fn deployed `verify_jwt: false` v3. |
| 4     | T12  | `public.get_trial_dashboard` (privacy floor ≥3)| ✅     | `20260420000013_get_trial_dashboard` (bumped past …11/…12 used by T11 wrappers). Adapted `s.province` → `s.province_state`. `STABLE` + `SECURITY DEFINER`. |
| 5     | T13  | scaffold `bio-trial-farmer-inbox` (renamed)    | ✅     | Deployed v1, `verify_jwt: false`. 403-without-secret & 405-on-GET smoke tests pass. **Needs Kyle:** set `BIO_TRIAL_TG_WEBHOOK_SECRET` in Supabase Dashboard → Edge Functions → Secrets before T14 E2E test. |
| 5     | T14  | `/start` binding                               | 🟡     | Migration `20260420000014_service_role_bio_trial_grants` applied. Edge fn v2 deployed with `handleStart` (UUID validate → lookup → reject if bound elsewhere → atomic UPDATE with `.is(null)` guard → success). **E2E blocked** until Kyle sets `BIO_TRIAL_TG_WEBHOOK_SECRET` in Supabase Dashboard. |
| 5     | T15  | text observations → `trial_events`             | ✅     | v3 deployed. `resolveSignup` + `handleObservation`; duplicate-key inserts (Telegram retry) treated as success via `isDuplicateKey` helper. |
| 5     | T16  | photo ingest → storage + `trial_events`        | ✅     | v4 deployed. `handlePhoto` streams bytes from Telegram `getFile` → `trial-uploads` bucket → `kind='photo'` event with `file_urls=[storagePath]`. Picks largest resolution via `width*height`; idempotent via `isDuplicateKey`. |
| 5     | T17  | `/apply` + `/yield` parsers                    | ✅     | v5 deployed. `handleApply` / `handleYield` build inline keyboards over `trial_fields`. `handleCallback` parses `apply:<fieldId>` / `yield:<fieldId>:<bu>` and inserts `kind='application'` or `kind='yield'` events; calls `answerCallbackQuery` to dismiss the loading spinner. Inserts smoke-tested via raw SQL — `trial_events_kind_check` accepts both kinds, `trial_events_source_check` accepts `'telegram'`. Live callback_query test still gated on `BIO_TRIAL_TG_WEBHOOK_SECRET`. |
| 5     | T18  | `setWebhook` registration                      | 🟡     | **Kyle action required** — needs bot token and dashboard access. Run once `BIO_TRIAL_TG_WEBHOOK_SECRET` is set on the edge function: `curl -X POST "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook" -H "Content-Type: application/json" -d '{"url":"https://ibgsloyjxdopkvwqcqwh.supabase.co/functions/v1/bio-trial-farmer-inbox","secret_token":"<same value>","allowed_updates":["message","callback_query"]}'`. Verify with `.../getWebhookInfo`. T14/T15/T16/T17 live E2E tests are all gated on this step. Frontend tasks T19–T25 can proceed in parallel. |
| 6     | T19  | `farmer.html` skeleton                         | ✅     | Static HTML + `farmer.js` bootstrap. Reads `?token=` param, calls `farmer_bootstrap` RPC, renders signup summary + Telegram CTA + timeline with kind badges. Fields/event form stubbed for T20. Verified in preview with minted test token — summary, telegram-unbound CTA, and both T17 events render correctly. **Note:** Vercel/preview server strips `.html` on redirect and drops the query string — farmer links must be built as `/farmer?token=...`, not `/farmer.html?token=...`. T23 vendor "copy link" button must honour this. |
| 6     | T20  | `farmer.js` CRUD + upload (uses edge fn URL)   | ✅     | Field add form (label/crop/prev_crop/acres/method), event log form (kind + field + notes + file). Uploads go through `bio-trial-farmer-upload-url` edge fn → PUT to signed URL → `farmer_register_event(file_urls=[path])`. Verified end-to-end in preview: added SW Field (`c3e0c30a…`), logged observation (source=`farmer_web`), uploaded 15-byte PDF into `trial-uploads/3ef9f803…/` and confirmed storage row. Timeline shows `📎 N files attached` indicator. Plus `farmer_upsert_field` auto-emits `field_created` events — timeline captures it without extra code. |
| 6     | T21  | `trial.html` public dashboard                  | ✅     | `trial.html` + `trial.js`. Single anon call to `public.get_trial_dashboard`; renders 6 headline stats, aggregates table (empty-state message until 3+ farms), province-only activity feed, and a hidden photos section. Verified in preview: headline shows 1 farm / 10 ac / AB / 1 each of applications/yield/observations; activity feed correctly anonymized ("A farmer in AB logged …"). |
| 6     | T22  | landing page link update                       | ✅     | Top-left "Live trial results" chip on `index.html`, mirroring the vendor-login chip but in crop-green and pointing at `/trial`. Verified: chip appears at top-left, clicking navigates to the public dashboard. |
| 7     | T23  | vendor: copy farmer link                       | ✅     | 8th column "Farmer console" with 3 buttons. Copy-link mints via `vendor_mint_farmer_token`, writes `/farmer?token=…` (no `.html`) to clipboard; gated on `product_delivered_at`. Verified: clipboard captured a valid JWT-bearing URL. |
| 7     | T24  | vendor: rebind Telegram                        | ✅     | Migration `20260420000015_vendor_unbind_farmer_telegram` (also extends `list_bio_trial_signups` to return `farmer_telegram_chat_id` + `farmer_linked_at`). Button gated on `farmer_telegram_chat_id != null`; confirm-prompt before clearing; reloads table on success. Verified: after click both fields NULL in DB, chip disappears, button disables. |
| 7     | T25  | vendor: events tab                             | ✅     | Migration `20260420000016_vendor_list_trial_events`. "Events" button opens a fixed-right side panel listing all `trial_events` for the signup, kind-badged with smart `summarizeEventPayload` (observation / yield / application / photo / field_created / stand_count / protein / moisture_test / soil_test / heat_event_timing) and `📎 N files` chip. Verified: all 5 events for test signup render cleanly. |
| 8     | T26  | E2E smoke test                                 | 🟡     | Non-Telegram flow fully passed: fresh `Smoke Test` signup inserted (real-schema columns) → vendor "Copy farmer link" minted JWT URL `/farmer?token=…` → farmer dashboard bootstrapped → added `Test NW` field (wheat, 80 ac, foliar_spray) → logged observation; public `/trial` correctly showed 2 farms / 110 ac / 2 provinces / 1 application / 1 yield / 2 observations with anonymized activity (no PII leakage verified). Cleanup: both test signups `DELETE`'d, cascade cleared 2 `trial_fields` + all `trial_events`; dashboard back to zeros. **Storage orphan:** `3ef9f803-deb3-…/2026-04-20T04-37-32…-soil-test.pdf` (15 bytes) couldn't be deleted by agent (RLS blocks anon, MCP blocks direct storage.objects delete) — Kyle-action: `supabase storage rm` or service-role delete. **Telegram E2E flow (steps 4–6)** still blocked on T18 webhook secret. |
| 8     | T27  | README + design-doc shipped marker             | ⬜     |  |

**Known plan deviations:**
- **T11 → edge function** (see T11 section for details). `storage.create_signed_upload_url` doesn't exist as a Postgres function; signing has to happen through the storage REST API.
- **Schema column mismatches in `bio_trial.signups`** (noticed during T8): plan assumed `paid, liters, delivered, shipped, province` — real columns are `payment_status, liters_purchased, product_delivered_at, product_shipped_at, province_state`. `farmer_bootstrap` derives booleans from the real columns; all test-signup INSERTs in later phases use the real column names.

**Test artifact:** Cleaned up at T26 — DB rows for test signups `3ef9f803-…` and `50a4316d-…` are gone, dependent fields/events cascade-deleted. One storage orphan remains: `trial-uploads/3ef9f803-…/2026-04-20T04-37-32-…-soil-test.pdf` (15-byte test PDF; RLS blocks anon delete, Kyle to sweep via service role).

---

## Phase 1 — Schema foundation

### Task 1: Create `bio_trial.trial_fields` table

**Files:**
- Create migration (via `apply_migration`): `20260420000001_trial_fields_table`

**Step 1: Write the verification query (it should fail)**

Via `execute_sql`:
```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'bio_trial' AND table_name = 'trial_fields'
ORDER BY ordinal_position;
```

Expected: zero rows (table doesn't exist yet).

**Step 2: Apply the migration**

Call `apply_migration` with `name = "20260420000001_trial_fields_table"` and this query:

```sql
CREATE TABLE bio_trial.trial_fields (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  signup_id           uuid NOT NULL REFERENCES bio_trial.signups(id) ON DELETE CASCADE,
  label               text NOT NULL,
  crop                text,
  prev_crop           text,
  application_method  text CHECK (application_method IN ('liquid_seeding', 'foliar_spray')),
  seed_rate_payload   jsonb,
  fert_rate_payload   jsonb,
  tank_mix            jsonb,
  acres               numeric,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX trial_fields_signup_idx ON bio_trial.trial_fields (signup_id);

COMMENT ON TABLE bio_trial.trial_fields IS
  'Per-field agronomy baselines for the Buperac bio trial. One signup can have many fields.';
```

**Step 3: Re-run the verification query**

Expected: 11 rows including `id`, `signup_id`, `label`, `crop`, `prev_crop`, `application_method`, `seed_rate_payload`, `fert_rate_payload`, `tank_mix`, `acres`, `created_at`.

**Step 4: Commit**

```bash
git add -A  # no local files changed, but commit a marker note
git commit --allow-empty -m "feat(db): add bio_trial.trial_fields table"
```

(Migrations live in Supabase — the git commit just records the conceptual change in repo history.)

---

### Task 2: Add Telegram binding columns to `bio_trial.signups`

**Step 1: Verification query (expect it to fail)**

```sql
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'bio_trial'
  AND table_name = 'signups'
  AND column_name IN ('farmer_telegram_chat_id', 'farmer_linked_at');
```

Expected: zero rows.

**Step 2: Apply migration `20260420000002_signups_telegram_binding`**

```sql
ALTER TABLE bio_trial.signups
  ADD COLUMN farmer_telegram_chat_id bigint,
  ADD COLUMN farmer_linked_at timestamptz;

ALTER TABLE bio_trial.signups
  ADD CONSTRAINT signups_farmer_chat_unique UNIQUE (farmer_telegram_chat_id);

CREATE INDEX signups_farmer_chat_idx
  ON bio_trial.signups (farmer_telegram_chat_id)
  WHERE farmer_telegram_chat_id IS NOT NULL;

COMMENT ON COLUMN bio_trial.signups.farmer_telegram_chat_id IS
  'Set on /start <signup_id> binding. UNIQUE — one chat cannot bind to two signups.';
```

**Step 3: Re-run verification — expect 2 rows.**

**Step 4: Commit**

```bash
git commit --allow-empty -m "feat(db): add farmer telegram binding columns to signups"
```

---

### Task 3: Create `bio_trial.trial_events` table

**Step 1: Verification query (expect fail)**

```sql
SELECT column_name FROM information_schema.columns
WHERE table_schema = 'bio_trial' AND table_name = 'trial_events'
ORDER BY ordinal_position;
```

Expected: zero rows.

**Step 2: Apply migration `20260420000003_trial_events_table`**

```sql
CREATE TABLE bio_trial.trial_events (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  signup_id            uuid NOT NULL REFERENCES bio_trial.signups(id) ON DELETE CASCADE,
  field_id             uuid REFERENCES bio_trial.trial_fields(id) ON DELETE SET NULL,
  kind                 text NOT NULL CHECK (kind IN (
                         'field_created',
                         'application',
                         'observation',
                         'stand_count',
                         'yield',
                         'protein',
                         'soil_test',
                         'moisture_test',
                         'photo',
                         'heat_event_timing'
                       )),
  payload              jsonb NOT NULL DEFAULT '{}'::jsonb,
  source               text NOT NULL CHECK (source IN ('telegram', 'farmer_web', 'vendor_admin')),
  telegram_message_id  bigint,
  file_urls            text[] NOT NULL DEFAULT ARRAY[]::text[],
  public_opt_in        boolean NOT NULL DEFAULT false,
  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX trial_events_signup_idx ON bio_trial.trial_events (signup_id, created_at DESC);
CREATE INDEX trial_events_kind_idx ON bio_trial.trial_events (kind);
CREATE UNIQUE INDEX trial_events_telegram_dedupe
  ON bio_trial.trial_events (telegram_message_id)
  WHERE telegram_message_id IS NOT NULL;

COMMENT ON TABLE bio_trial.trial_events IS
  'Shared event log for the bio trial. Telegram inbox, farmer web form, and vendor admin all insert here.';
```

**Step 3: Re-run verification — expect 10 rows.**

**Step 4: Commit**

```bash
git commit --allow-empty -m "feat(db): add bio_trial.trial_events table"
```

---

### Task 4: Create Storage bucket `trial-uploads`

**Step 1: Verification query (expect fail)**

```sql
SELECT id, name, public FROM storage.buckets WHERE id = 'trial-uploads';
```

Expected: zero rows.

**Step 2: Apply migration `20260420000004_trial_uploads_bucket`**

```sql
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'trial-uploads',
  'trial-uploads',
  false,
  20 * 1024 * 1024,  -- 20 MB per file
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Read-only access for vendor-gated RPCs and farmer-gated RPCs (we'll wire those later).
-- For now, lock everything down — uploads happen through signed URLs issued server-side.
CREATE POLICY "trial_uploads_service_role_all"
  ON storage.objects FOR ALL
  TO service_role
  USING (bucket_id = 'trial-uploads')
  WITH CHECK (bucket_id = 'trial-uploads');
```

**Step 3: Re-run verification — expect one row with `public = false`.**

**Step 4: Commit**

```bash
git commit --allow-empty -m "feat(storage): add trial-uploads bucket"
```

---

## Phase 2 — JWT mint/verify helpers

Farmers authenticate with an HS256 JWT in their URL. We mint and verify it inside Postgres using the `pgjwt` extension.

### Task 5: Enable `pgjwt` and store the signing secret in Vault

**Step 1: Verification query (expect fail)**

```sql
SELECT extname FROM pg_extension WHERE extname = 'pgjwt';
```

Expected: zero rows.

**Step 2: Apply migration `20260420000005_enable_pgjwt`**

```sql
CREATE EXTENSION IF NOT EXISTS pgjwt WITH SCHEMA extensions;
```

**Step 3: Set the JWT secret in Vault**

```sql
-- Generate a 64-byte random secret once, then store it.
-- If the secret already exists, keep it (never rotate casually — all outstanding farmer links break).
DO $$
DECLARE
  secret_exists boolean;
BEGIN
  SELECT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'bio_trial_farmer_jwt_secret')
  INTO secret_exists;

  IF NOT secret_exists THEN
    PERFORM vault.create_secret(
      encode(gen_random_bytes(48), 'base64'),
      'bio_trial_farmer_jwt_secret',
      'HS256 secret for signing farmer magic-link JWTs. Rotating breaks all outstanding links.'
    );
  END IF;
END$$;
```

**Step 4: Verify it's present**

```sql
SELECT name, created_at FROM vault.secrets WHERE name = 'bio_trial_farmer_jwt_secret';
```

Expected: one row.

**Step 5: Commit**

```bash
git commit --allow-empty -m "feat(db): enable pgjwt and stash farmer JWT secret in vault"
```

---

### Task 6: Write `bio_trial.mint_farmer_jwt` and `bio_trial.verify_farmer_jwt`

These live in the `bio_trial` schema (not `public`) because they're internal helpers — only other bio_trial functions call them.

**Step 1: Verification query (expect fail)**

```sql
SELECT proname FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'bio_trial'
  AND proname IN ('mint_farmer_jwt', 'verify_farmer_jwt');
```

Expected: zero rows.

**Step 2: Apply migration `20260420000006_farmer_jwt_helpers`**

```sql
CREATE OR REPLACE FUNCTION bio_trial.mint_farmer_jwt(p_signup_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = bio_trial, extensions, public
AS $$
DECLARE
  v_secret text;
  v_now    bigint;
BEGIN
  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets
  WHERE name = 'bio_trial_farmer_jwt_secret';

  IF v_secret IS NULL THEN
    RAISE EXCEPTION 'JWT secret missing in vault';
  END IF;

  v_now := extract(epoch FROM now())::bigint;

  RETURN extensions.sign(
    json_build_object(
      'sub', p_signup_id::text,
      'aud', 'bio_trial.farmer',
      'iat', v_now,
      'exp', v_now + (180 * 86400)  -- 180 days
    ),
    v_secret,
    'HS256'
  );
END$$;

CREATE OR REPLACE FUNCTION bio_trial.verify_farmer_jwt(p_token text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = bio_trial, extensions, public
AS $$
DECLARE
  v_secret  text;
  v_payload jsonb;
  v_valid   boolean;
BEGIN
  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets
  WHERE name = 'bio_trial_farmer_jwt_secret';

  SELECT payload::jsonb, valid
  INTO v_payload, v_valid
  FROM extensions.verify(p_token, v_secret, 'HS256');

  IF NOT v_valid THEN
    RAISE EXCEPTION 'invalid farmer token' USING ERRCODE = '28000';
  END IF;

  IF (v_payload->>'aud') <> 'bio_trial.farmer' THEN
    RAISE EXCEPTION 'wrong audience' USING ERRCODE = '28000';
  END IF;

  IF (v_payload->>'exp')::bigint < extract(epoch FROM now())::bigint THEN
    RAISE EXCEPTION 'farmer token expired' USING ERRCODE = '28000';
  END IF;

  RETURN (v_payload->>'sub')::uuid;
END$$;

REVOKE ALL ON FUNCTION bio_trial.mint_farmer_jwt(uuid) FROM public;
REVOKE ALL ON FUNCTION bio_trial.verify_farmer_jwt(text) FROM public;
```

**Step 3: Re-run verification — expect two rows.**

**Step 4: Commit**

```bash
git commit --allow-empty -m "feat(db): add mint/verify helpers for farmer JWTs"
```

---

### Task 7: Write `public.vendor_mint_farmer_token` RPC + round-trip test

Kyle calls this from the vendor console to get a farmer link to send manually.

**Step 1: Verification query (expect fail)**

```sql
SELECT proname FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' AND proname = 'vendor_mint_farmer_token';
```

Expected: zero rows.

**Step 2: Apply migration `20260420000007_vendor_mint_farmer_token`**

```sql
CREATE OR REPLACE FUNCTION public.vendor_mint_farmer_token(p_signup_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = bio_trial, public
AS $$
DECLARE
  v_exists boolean;
BEGIN
  IF NOT bio_trial.is_vendor() THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  SELECT EXISTS (SELECT 1 FROM bio_trial.signups WHERE id = p_signup_id) INTO v_exists;
  IF NOT v_exists THEN
    RAISE EXCEPTION 'signup not found';
  END IF;

  RETURN bio_trial.mint_farmer_jwt(p_signup_id);
END$$;

GRANT EXECUTE ON FUNCTION public.vendor_mint_farmer_token(uuid) TO authenticated;
```

**Step 3: Round-trip test**

```sql
-- Use an existing signup ID; or create one for the test
WITH test_signup AS (
  INSERT INTO bio_trial.signups (name, email, acres, logistics_method)
  VALUES ('Test Farmer', 'test@example.com', 10, 'pickup')
  RETURNING id
),
minted AS (
  SELECT id, bio_trial.mint_farmer_jwt(id) AS token FROM test_signup
)
SELECT
  id AS signup_id,
  bio_trial.verify_farmer_jwt(token) AS round_tripped,
  id = bio_trial.verify_farmer_jwt(token) AS matches
FROM minted;
```

Expected: `matches = true`.

**Step 4: Clean up the test row**

```sql
DELETE FROM bio_trial.signups WHERE email = 'test@example.com';
```

**Step 5: Commit**

```bash
git commit --allow-empty -m "feat(db): add vendor_mint_farmer_token RPC with JWT round-trip test"
```

---

## Phase 3 — Farmer RPCs

All farmer-facing RPCs follow the same pattern: take `p_token` first, resolve to `signup_id`, operate only on that signup's rows.

### Task 8: `public.farmer_bootstrap(p_token)`

Returns everything the farmer dashboard needs in one call: signup summary, fields, timeline, telegram-bound flag.

**Step 1: Verification query (expect fail)**

```sql
SELECT proname FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' AND proname = 'farmer_bootstrap';
```

Expected: zero rows.

**Step 2: Apply migration `20260420000008_farmer_bootstrap`**

```sql
CREATE OR REPLACE FUNCTION public.farmer_bootstrap(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = bio_trial, public
AS $$
DECLARE
  v_signup_id uuid;
  v_signup    jsonb;
  v_fields    jsonb;
  v_events    jsonb;
  v_bound     boolean;
BEGIN
  v_signup_id := bio_trial.verify_farmer_jwt(p_token);

  SELECT to_jsonb(s) - 'email' - 'phone' INTO v_signup
  FROM (
    SELECT id, name, farm_name, province, acres, logistics_method,
           paid, liters, delivered, shipped,
           farmer_telegram_chat_id IS NOT NULL AS telegram_bound
    FROM bio_trial.signups
    WHERE id = v_signup_id
  ) s;

  SELECT coalesce(jsonb_agg(to_jsonb(f) ORDER BY f.created_at), '[]'::jsonb) INTO v_fields
  FROM bio_trial.trial_fields f
  WHERE f.signup_id = v_signup_id;

  SELECT coalesce(jsonb_agg(to_jsonb(e) ORDER BY e.created_at DESC), '[]'::jsonb) INTO v_events
  FROM bio_trial.trial_events e
  WHERE e.signup_id = v_signup_id;

  SELECT farmer_telegram_chat_id IS NOT NULL INTO v_bound
  FROM bio_trial.signups WHERE id = v_signup_id;

  RETURN jsonb_build_object(
    'signup', v_signup,
    'fields', v_fields,
    'events', v_events,
    'telegram_bound', v_bound
  );
END$$;

GRANT EXECUTE ON FUNCTION public.farmer_bootstrap(text) TO anon, authenticated;
```

**Step 3: Test it**

Mint a token for any test signup, then:

```sql
SELECT jsonb_pretty(public.farmer_bootstrap('<token>'));
```

Expected: jsonb with `signup`, `fields`, `events`, `telegram_bound` keys.

**Step 4: Commit**

```bash
git commit --allow-empty -m "feat(db): add farmer_bootstrap RPC"
```

---

### Task 9: `public.farmer_upsert_field(p_token, p_field_patch jsonb)`

**Step 1: Verification query (expect fail)**

```sql
SELECT proname FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' AND proname = 'farmer_upsert_field';
```

Expected: zero rows.

**Step 2: Apply migration `20260420000009_farmer_upsert_field`**

```sql
CREATE OR REPLACE FUNCTION public.farmer_upsert_field(p_token text, p_patch jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = bio_trial, public
AS $$
DECLARE
  v_signup_id uuid;
  v_field_id  uuid;
  v_row       bio_trial.trial_fields;
BEGIN
  v_signup_id := bio_trial.verify_farmer_jwt(p_token);

  -- Whitelist the patch keys
  IF NOT (p_patch ?| ARRAY['label','crop','prev_crop','application_method',
                           'seed_rate_payload','fert_rate_payload','tank_mix','acres','id']) THEN
    RAISE EXCEPTION 'no valid keys in patch';
  END IF;

  v_field_id := nullif(p_patch->>'id', '')::uuid;

  IF v_field_id IS NULL THEN
    -- Insert
    INSERT INTO bio_trial.trial_fields (
      signup_id, label, crop, prev_crop, application_method,
      seed_rate_payload, fert_rate_payload, tank_mix, acres
    ) VALUES (
      v_signup_id,
      p_patch->>'label',
      p_patch->>'crop',
      p_patch->>'prev_crop',
      p_patch->>'application_method',
      p_patch->'seed_rate_payload',
      p_patch->'fert_rate_payload',
      p_patch->'tank_mix',
      nullif(p_patch->>'acres','')::numeric
    )
    RETURNING * INTO v_row;

    -- Record a field_created event for the timeline
    INSERT INTO bio_trial.trial_events (signup_id, field_id, kind, payload, source)
    VALUES (v_signup_id, v_row.id, 'field_created',
            jsonb_build_object('label', v_row.label, 'crop', v_row.crop),
            'farmer_web');
  ELSE
    -- Update (scope to this signup)
    UPDATE bio_trial.trial_fields
    SET label              = coalesce(p_patch->>'label', label),
        crop               = coalesce(p_patch->>'crop', crop),
        prev_crop          = coalesce(p_patch->>'prev_crop', prev_crop),
        application_method = coalesce(p_patch->>'application_method', application_method),
        seed_rate_payload  = coalesce(p_patch->'seed_rate_payload', seed_rate_payload),
        fert_rate_payload  = coalesce(p_patch->'fert_rate_payload', fert_rate_payload),
        tank_mix           = coalesce(p_patch->'tank_mix', tank_mix),
        acres              = coalesce(nullif(p_patch->>'acres','')::numeric, acres)
    WHERE id = v_field_id AND signup_id = v_signup_id
    RETURNING * INTO v_row;

    IF v_row IS NULL THEN
      RAISE EXCEPTION 'field not found for this signup';
    END IF;
  END IF;

  RETURN to_jsonb(v_row);
END$$;

GRANT EXECUTE ON FUNCTION public.farmer_upsert_field(text, jsonb) TO anon, authenticated;
```

**Step 3: Test insert**

```sql
SELECT jsonb_pretty(public.farmer_upsert_field(
  '<token>',
  '{"label":"NW quarter","crop":"wheat","prev_crop":"canola","application_method":"foliar_spray","acres":"80"}'::jsonb
));
```

Expected: row with `id`, `label = "NW quarter"`, etc.

**Step 4: Commit**

```bash
git commit --allow-empty -m "feat(db): add farmer_upsert_field RPC"
```

---

### Task 10: `public.farmer_register_event`

**Step 1: Verification query (expect fail)**

```sql
SELECT proname FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' AND proname = 'farmer_register_event';
```

Expected: zero rows.

**Step 2: Apply migration `20260420000010_farmer_register_event`**

```sql
CREATE OR REPLACE FUNCTION public.farmer_register_event(
  p_token     text,
  p_kind      text,
  p_field_id  uuid,
  p_payload   jsonb,
  p_file_urls text[],
  p_public_opt_in boolean DEFAULT false
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = bio_trial, public
AS $$
DECLARE
  v_signup_id uuid;
  v_row       bio_trial.trial_events;
  v_field_ok  boolean;
BEGIN
  v_signup_id := bio_trial.verify_farmer_jwt(p_token);

  IF p_field_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM bio_trial.trial_fields
      WHERE id = p_field_id AND signup_id = v_signup_id
    ) INTO v_field_ok;
    IF NOT v_field_ok THEN
      RAISE EXCEPTION 'field does not belong to this signup';
    END IF;
  END IF;

  INSERT INTO bio_trial.trial_events (
    signup_id, field_id, kind, payload, source, file_urls, public_opt_in
  ) VALUES (
    v_signup_id,
    p_field_id,
    p_kind,
    coalesce(p_payload, '{}'::jsonb),
    'farmer_web',
    coalesce(p_file_urls, ARRAY[]::text[]),
    coalesce(p_public_opt_in, false)
  )
  RETURNING * INTO v_row;

  RETURN to_jsonb(v_row);
END$$;

GRANT EXECUTE ON FUNCTION public.farmer_register_event(text, text, uuid, jsonb, text[], boolean)
  TO anon, authenticated;
```

**Step 3: Test**

```sql
SELECT jsonb_pretty(public.farmer_register_event(
  '<token>', 'observation', NULL,
  '{"text":"Looks healthy, slight lodging in SE corner"}'::jsonb,
  ARRAY[]::text[], false
));
```

Expected: row with `kind = observation`, `source = farmer_web`.

**Step 4: Commit**

```bash
git commit --allow-empty -m "feat(db): add farmer_register_event RPC"
```

---

### Task 11: `bio-trial-farmer-upload-url` edge function (pivoted from SQL RPC)

**Pivot note (2026-04-19):** The original plan below assumed `storage.create_signed_upload_url(bucket, path)` existed as a Postgres function. It does not — Supabase Storage signs upload URLs via a REST endpoint that HMACs against the storage-service secret, not a DB secret. Implemented as an edge function instead, which is the idiomatic pattern.

**What was actually built:**

- **`supabase/functions/bio-trial-farmer-upload-url/index.ts`** — deployed with `verify_jwt: false` (farmers use our custom HS256 JWT, not Supabase Auth).
  - `POST { token, filename }` → `{ path, token, signedUrl, bucket, signup_id }`.
  - Verifies token via `public.farmer_verify_token(p_token)` (a thin wrapper over `bio_trial.verify_farmer_jwt` — the `bio_trial` schema isn't on the PostgREST whitelist).
  - Generates a safe path: `<signup_id>/<iso-stamp>-<rand>-<sanitized-filename>`.
  - Calls `admin.storage.from('trial-uploads').createSignedUploadUrl(path)` with service_role.

- **Migration `20260420000011_public_farmer_verify_token`** — `public.farmer_verify_token(p_token text) returns uuid` wrapper, `SECURITY DEFINER`.
- **Migration `20260420000012_farmer_verify_token_swallow_errors`** — hardened to return NULL on any pgjwt decode exception (malformed tokens were surfacing 500s with `invalid byte sequence for encoding "UTF8"`; now they return 401 cleanly).

**Frontend contract change:** farmer.js calls the edge function URL directly (see T20), not `supabase.rpc("farmer_signed_upload_url", ...)`. The call in that task should be:

```js
const res = await fetch(`${SB_URL}/functions/v1/bio-trial-farmer-upload-url`, {
  method: "POST",
  headers: { "Content-Type": "application/json", apikey: SB_ANON_KEY },
  body: JSON.stringify({ token: window.TOKEN, filename: file.name }),
});
const { path, signedUrl } = await res.json();
```

**Verification (performed):** valid token → 200 with signed URL, invalid token → 401, missing fields → 400. Path scoped under `<signup_id>/`.

---

<details>
<summary>Original plan (superseded)</summary>

**Step 1: Verification query (expect fail)**

```sql
SELECT proname FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' AND proname = 'farmer_signed_upload_url';
```

Expected: zero rows.

**Step 2: Apply migration `20260420000011_farmer_signed_upload_url`**

```sql
CREATE OR REPLACE FUNCTION public.farmer_signed_upload_url(
  p_token    text,
  p_filename text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = bio_trial, storage, public
AS $$
DECLARE
  v_signup_id uuid;
  v_path      text;
  v_signed    jsonb;
BEGIN
  v_signup_id := bio_trial.verify_farmer_jwt(p_token);

  IF length(coalesce(p_filename, '')) = 0 OR p_filename ~ '[/\\]' THEN
    RAISE EXCEPTION 'invalid filename';
  END IF;

  v_path := v_signup_id::text || '/' || gen_random_uuid()::text || '-' || p_filename;

  -- Returns {url, token, path}
  SELECT storage.create_signed_upload_url('trial-uploads', v_path) INTO v_signed;

  RETURN jsonb_build_object(
    'path', v_path,
    'signed', v_signed
  );
END$$;

GRANT EXECUTE ON FUNCTION public.farmer_signed_upload_url(text, text) TO anon, authenticated;
```

**Step 3: Test**

```sql
SELECT jsonb_pretty(public.farmer_signed_upload_url('<token>', 'soil-test.pdf'));
```

Expected: jsonb with `path` and `signed.url`.

</details>

---

## Phase 4 — Public dashboard RPC

### Task 12: `public.get_trial_dashboard`

One RPC returning everything the public page shows, with privacy floor enforced in SQL.

**Step 1: Verification query (expect fail)**

```sql
SELECT proname FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' AND proname = 'get_trial_dashboard';
```

Expected: zero rows.

**Step 2: Apply migration `20260420000012_get_trial_dashboard`**

```sql
CREATE OR REPLACE FUNCTION public.get_trial_dashboard()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = bio_trial, public
AS $$
DECLARE
  v_headline   jsonb;
  v_aggregates jsonb;
  v_activity   jsonb;
  v_photos     jsonb;
  v_floor      int := 3;
BEGIN
  -- Headline: acres enrolled, # farms, # provinces, # applications logged
  SELECT jsonb_build_object(
    'acres_enrolled',     coalesce(sum(s.acres), 0),
    'farms_count',        count(DISTINCT s.id),
    'provinces_count',    count(DISTINCT s.province),
    'applications_count', (SELECT count(*) FROM bio_trial.trial_events WHERE kind = 'application'),
    'yields_count',       (SELECT count(*) FROM bio_trial.trial_events WHERE kind = 'yield'),
    'soil_tests_count',   (SELECT count(*) FROM bio_trial.trial_events WHERE kind = 'soil_test'),
    'observations_count', (SELECT count(*) FROM bio_trial.trial_events WHERE kind = 'observation')
  ) INTO v_headline
  FROM bio_trial.signups s;

  -- Aggregates by crop — only surface where ≥3 farms contributed
  WITH yield_events AS (
    SELECT f.crop,
           e.signup_id,
           (e.payload->>'bu_per_ac')::numeric AS bu_per_ac
    FROM bio_trial.trial_events e
    JOIN bio_trial.trial_fields f ON f.id = e.field_id
    WHERE e.kind = 'yield'
      AND (e.payload->>'bu_per_ac') ~ '^[0-9]+(\.[0-9]+)?$'
  ),
  crop_groups AS (
    SELECT crop,
           count(DISTINCT signup_id) AS farms,
           round(avg(bu_per_ac), 1)   AS avg_yield
    FROM yield_events
    WHERE crop IS NOT NULL
    GROUP BY crop
  )
  SELECT coalesce(jsonb_agg(
    jsonb_build_object('crop', crop, 'avg_yield', avg_yield, 'farms', farms)
    ORDER BY crop
  ), '[]'::jsonb) INTO v_aggregates
  FROM crop_groups
  WHERE farms >= v_floor;

  -- Activity feed: 20 most recent events, redacted
  SELECT coalesce(jsonb_agg(row_to_json(a) ORDER BY a.created_at DESC), '[]'::jsonb) INTO v_activity
  FROM (
    SELECT e.kind,
           s.province,
           f.crop,
           e.created_at
    FROM bio_trial.trial_events e
    JOIN bio_trial.signups s ON s.id = e.signup_id
    LEFT JOIN bio_trial.trial_fields f ON f.id = e.field_id
    ORDER BY e.created_at DESC
    LIMIT 20
  ) a;

  -- Public opt-in photos
  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'created_at', e.created_at,
      'file_urls',  e.file_urls,
      'caption',    e.payload->>'caption',
      'province',   s.province,
      'crop',       f.crop
    ) ORDER BY e.created_at DESC
  ), '[]'::jsonb) INTO v_photos
  FROM bio_trial.trial_events e
  JOIN bio_trial.signups s ON s.id = e.signup_id
  LEFT JOIN bio_trial.trial_fields f ON f.id = e.field_id
  WHERE e.kind = 'photo' AND e.public_opt_in = true
  LIMIT 30;

  RETURN jsonb_build_object(
    'headline',   v_headline,
    'aggregates', v_aggregates,
    'activity',   v_activity,
    'photos',     v_photos,
    'privacy_floor', v_floor
  );
END$$;

GRANT EXECUTE ON FUNCTION public.get_trial_dashboard() TO anon, authenticated;
```

**Step 3: Test**

```sql
SELECT jsonb_pretty(public.get_trial_dashboard());
```

Expected: jsonb with `headline`, `aggregates` (likely `[]`), `activity`, `photos`, `privacy_floor = 3`.

**Step 4: Commit**

```bash
git commit --allow-empty -m "feat(db): add get_trial_dashboard RPC with privacy floor"
```

---

## Phase 5 — Telegram inbox edge function

**Deno primer for anyone new to edge functions:**

- Supabase edge functions run on Deno (not Node). Imports use URLs or `npm:` prefix.
- Secrets: `Deno.env.get('NAME')`. These are set in Supabase Dashboard → Edge Functions → Secrets, or via `mcp__supabase__deploy_edge_function` with an `--env` wrapper (we'll set them manually via the dashboard or `supabase secrets set` CLI).
- Supabase client inside a function: `import { createClient } from 'npm:@supabase/supabase-js@2'`.
- Log output: `console.log`, `console.error` — visible via `mcp__supabase__get_logs({service:'edge-function'})`.

The existing [`supabase/functions/bio-trial-notify-signup/index.ts`](../../supabase/functions/bio-trial-notify-signup/index.ts) is a good pattern reference for Deno + Telegram.

### Task 13: Scaffold `bio-trial-farmer-inbox` with secret verification

**Files:**
- Create: `supabase/functions/bio-trial-farmer-inbox/index.ts`

**Step 1: Create the file**

```typescript
// supabase/functions/bio-trial-farmer-inbox/index.ts
//
// Telegram webhook receiver for the Buperac bio trial farmer inbox.
// Handles: /start <signup_id> binding, text observations, photos,
// /apply and /yield commands with inline keyboards.
//
// Telegram calls this URL on every update to the bot. We verify the
// X-Telegram-Bot-Api-Secret-Token header to prevent spoofing.

import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";

const TG_BOT_TOKEN = Deno.env.get("BIO_TRIAL_TG_BOT_TOKEN") ?? "";
const TG_WEBHOOK_SECRET = Deno.env.get("BIO_TRIAL_TG_WEBHOOK_SECRET") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

function supa(): SupabaseClient {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

async function tgSendMessage(chatId: number, text: string, extra: Record<string, unknown> = {}) {
  const res = await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", ...extra }),
  });
  if (!res.ok) console.error("tgSendMessage failed", await res.text());
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("method not allowed", { status: 405 });
  }

  // Telegram identifies itself with this header we configured in setWebhook.
  const secret = req.headers.get("x-telegram-bot-api-secret-token");
  if (!TG_WEBHOOK_SECRET || secret !== TG_WEBHOOK_SECRET) {
    return new Response("forbidden", { status: 403 });
  }

  let update: any;
  try {
    update = await req.json();
  } catch {
    return new Response("bad json", { status: 400 });
  }

  // Stub — implemented in later tasks
  console.log("update received", JSON.stringify(update).slice(0, 500));

  return new Response("ok", { status: 200 });
});
```

**Step 2: Deploy it**

Call `mcp__supabase__deploy_edge_function` with:
- `project_id: "ibgsloyjxdopkvwqcqwh"`
- `name: "bio-trial-farmer-inbox"`
- `files: [{ name: "index.ts", content: <the file contents> }]`

**Step 3: Set the webhook secret**

Generate a random secret and set it in the edge function env:

```bash
# In terminal, with supabase CLI authenticated:
openssl rand -hex 24
# Take that output and set both:
#   BIO_TRIAL_TG_WEBHOOK_SECRET=<value>
#   (via Supabase Dashboard → Edge Functions → bio-trial-farmer-inbox → Secrets)
```

Also ensure `BIO_TRIAL_TG_BOT_TOKEN` is set (shared with the existing notify function).

**Step 4: Smoke-test the 403 path**

```bash
curl -X POST "https://ibgsloyjxdopkvwqcqwh.supabase.co/functions/v1/bio-trial-farmer-inbox" \
  -H "Content-Type: application/json" \
  -d '{"test":true}'
```

Expected: `403 forbidden` (because the secret header is missing).

**Step 5: Commit**

```bash
git add supabase/functions/bio-trial-farmer-inbox/index.ts
git commit -m "feat(edge): scaffold bio-trial-farmer-inbox webhook receiver"
```

---

### Task 14: Add the `/start <signup_id>` binding handler

**Files:**
- Modify: `supabase/functions/bio-trial-farmer-inbox/index.ts`

**Step 1: Extend the Deno.serve handler**

Replace the stub `console.log` + 200 response with a router. Add these helpers above `Deno.serve`:

```typescript
async function handleStart(sb: SupabaseClient, chatId: number, args: string) {
  const signupId = args.trim();
  if (!/^[0-9a-f-]{36}$/.test(signupId)) {
    await tgSendMessage(chatId, "This doesn't look like a valid trial link. Tap the magic link from your delivery email.");
    return;
  }

  // Check signup exists and isn't already bound.
  const { data: signup, error } = await sb
    .from("signups")
    .select("id, farmer_telegram_chat_id, name")
    .eq("id", signupId)
    .maybeSingle();

  if (error) {
    console.error("lookup failed", error);
    return;
  }
  if (!signup) {
    await tgSendMessage(chatId, "Trial signup not found. Double-check your link.");
    return;
  }

  if (signup.farmer_telegram_chat_id && signup.farmer_telegram_chat_id !== chatId) {
    await tgSendMessage(chatId, "This trial is already connected to another phone. Ask your contact to rebind it.");
    return;
  }

  if (signup.farmer_telegram_chat_id === chatId) {
    await tgSendMessage(chatId, "You're already connected. Text me anytime, or try /apply or /yield.");
    return;
  }

  const { error: upErr } = await sb
    .from("signups")
    .update({ farmer_telegram_chat_id: chatId, farmer_linked_at: new Date().toISOString() })
    .eq("id", signupId)
    .is("farmer_telegram_chat_id", null);

  if (upErr) {
    console.error("bind failed", upErr);
    await tgSendMessage(chatId, "Something went wrong connecting you. Try again in a minute.");
    return;
  }

  await tgSendMessage(chatId, `Connected, ${signup.name ?? "farmer"}. Text observations anytime, send photos, or try /apply and /yield when the time comes.`);
}
```

And wire up the router in `Deno.serve`:

```typescript
// Replace the stub console.log + 200 with:
try {
  const sb = supa();
  const msg = update?.message;
  if (msg && msg.chat?.id) {
    const chatId = Number(msg.chat.id);
    const text: string = msg.text ?? "";

    if (text.startsWith("/start")) {
      const args = text.slice("/start".length).trim();
      await handleStart(sb, chatId, args);
    } else {
      // Routed in later tasks
      console.log("unhandled update", { chatId, text: text.slice(0, 120) });
    }
  }
} catch (err) {
  console.error("handler error", err);
}

return new Response("ok", { status: 200 });
```

Keep `bio_trial` as the schema. Read note: the Supabase JS client defaults to the `public` schema. Use `sb.schema('bio_trial').from('signups')` in all DB calls. Update every `.from('signups')` above to `sb.schema('bio_trial').from('signups')`.

**Step 2: Grant service_role access to bio_trial schema**

Apply migration `20260420000013_service_role_bio_trial_grants` (if not already granted):

```sql
GRANT USAGE ON SCHEMA bio_trial TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA bio_trial TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA bio_trial
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO service_role;
```

**Step 3: Redeploy the function**

`mcp__supabase__deploy_edge_function` again.

**Step 4: Smoke-test**

Create a test signup, mint nothing (we're Telegram-side). From Telegram, tap `t.me/BuperacTrialBot?start=<signup_id>`. Expect the bot to reply "Connected, <name>...". Verify:

```sql
SELECT id, farmer_telegram_chat_id, farmer_linked_at
FROM bio_trial.signups WHERE id = '<signup_id>';
```

Expected: `farmer_telegram_chat_id` populated.

**Step 5: Commit**

```bash
git add supabase/functions/bio-trial-farmer-inbox/index.ts
git commit -m "feat(edge): wire /start <signup_id> binding handler"
```

---

### Task 15: Text observation handler

Any non-command text from a bound chat becomes a `kind='observation'` event.

**Step 1: Add helper `resolveSignup(sb, chatId)` and the text handler**

```typescript
async function resolveSignup(sb: SupabaseClient, chatId: number): Promise<string | null> {
  const { data } = await sb
    .schema("bio_trial")
    .from("signups")
    .select("id")
    .eq("farmer_telegram_chat_id", chatId)
    .maybeSingle();
  return data?.id ?? null;
}

async function handleObservation(sb: SupabaseClient, chatId: number, msg: any) {
  const signupId = await resolveSignup(sb, chatId);
  if (!signupId) {
    await tgSendMessage(chatId, "You're not connected yet. Use your trial link from the delivery email.");
    return;
  }

  const { error } = await sb
    .schema("bio_trial")
    .from("trial_events")
    .insert({
      signup_id: signupId,
      kind: "observation",
      payload: { text: msg.text },
      source: "telegram",
      telegram_message_id: msg.message_id,
    });

  if (error && !error.message.includes("duplicate key")) {
    console.error("observation insert failed", error);
    await tgSendMessage(chatId, "Couldn't save that — try again in a sec.");
    return;
  }

  await tgSendMessage(chatId, "Saved ✓");
}
```

**Step 2: Wire into router**

In `Deno.serve`, extend the `if (text.startsWith("/start"))` branch:

```typescript
if (text.startsWith("/start")) {
  await handleStart(sb, chatId, text.slice("/start".length).trim());
} else if (text.startsWith("/")) {
  // Commands routed in later tasks
  console.log("unhandled command", text);
} else if (text.length > 0) {
  await handleObservation(sb, chatId, msg);
} else {
  console.log("unhandled non-text update");
}
```

**Step 3: Redeploy + test**

From Telegram (already bound chat), send: "Wheat looks good today, slight wind damage on the east edge."

Expect "Saved ✓". Verify:

```sql
SELECT kind, payload, source FROM bio_trial.trial_events
WHERE signup_id = '<signup_id>' ORDER BY created_at DESC LIMIT 1;
```

Expected: `kind=observation`, `payload.text` matches.

**Step 4: Commit**

```bash
git commit -am "feat(edge): route free-form text to observation events"
```

---

### Task 16: Photo handler (streams to Storage)

**Key unknown:** Telegram's `getFile` URL serves binary over HTTPS; we pipe it into Supabase Storage.

**Step 1: Add photo handler**

```typescript
async function handlePhoto(sb: SupabaseClient, chatId: number, msg: any) {
  const signupId = await resolveSignup(sb, chatId);
  if (!signupId) {
    await tgSendMessage(chatId, "Connect first using your trial link.");
    return;
  }

  // Telegram sends multiple resolutions — pick the largest.
  const photos = msg.photo as Array<{ file_id: string; width: number; height: number }>;
  const best = photos.slice().sort((a, b) => (b.width * b.height) - (a.width * a.height))[0];

  // Step A: resolve Telegram file path
  const fileRes = await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/getFile?file_id=${best.file_id}`);
  const fileJson = await fileRes.json();
  if (!fileJson.ok) {
    console.error("getFile failed", fileJson);
    return;
  }
  const tgPath = fileJson.result.file_path as string;

  // Step B: fetch bytes
  const binRes = await fetch(`https://api.telegram.org/file/bot${TG_BOT_TOKEN}/${tgPath}`);
  if (!binRes.ok) {
    console.error("telegram file fetch failed", binRes.status);
    return;
  }
  const bytes = new Uint8Array(await binRes.arrayBuffer());
  const ext = tgPath.split(".").pop() ?? "jpg";
  const storagePath = `${signupId}/${crypto.randomUUID()}.${ext}`;

  // Step C: upload to Supabase Storage
  const { error: upErr } = await sb.storage
    .from("trial-uploads")
    .upload(storagePath, bytes, {
      contentType: ext === "jpg" || ext === "jpeg" ? "image/jpeg" : `image/${ext}`,
      upsert: false,
    });
  if (upErr) {
    console.error("storage upload failed", upErr);
    await tgSendMessage(chatId, "Photo upload failed — try again later.");
    return;
  }

  // Step D: insert event
  const { error: evtErr } = await sb
    .schema("bio_trial")
    .from("trial_events")
    .insert({
      signup_id: signupId,
      kind: "photo",
      payload: { caption: msg.caption ?? null },
      source: "telegram",
      telegram_message_id: msg.message_id,
      file_urls: [storagePath],
    });

  if (evtErr && !evtErr.message.includes("duplicate key")) {
    console.error("photo event insert failed", evtErr);
    return;
  }

  await tgSendMessage(chatId, "Photo saved 📷");
}
```

**Step 2: Wire into router**

In `Deno.serve`, before the text branch:

```typescript
if (msg.photo && msg.photo.length > 0) {
  await handlePhoto(sb, chatId, msg);
} else if (text.startsWith("/start")) {
  // ...
}
```

**Step 3: Redeploy + test**

Send a photo from Telegram. Expect "Photo saved 📷". Verify:

```sql
SELECT kind, file_urls, payload FROM bio_trial.trial_events
WHERE signup_id = '<id>' AND kind = 'photo' ORDER BY created_at DESC LIMIT 1;

SELECT name, metadata->>'size' FROM storage.objects
WHERE bucket_id = 'trial-uploads' ORDER BY created_at DESC LIMIT 1;
```

Expected: event row + storage object.

**Step 4: Commit**

```bash
git commit -am "feat(edge): handle photos, stream to trial-uploads storage"
```

---

### Task 17: `/apply` and `/yield` commands with inline keyboards

**Step 1: Add command handlers**

```typescript
async function listFields(sb: SupabaseClient, signupId: string) {
  const { data } = await sb
    .schema("bio_trial")
    .from("trial_fields")
    .select("id, label, crop")
    .eq("signup_id", signupId)
    .order("created_at");
  return data ?? [];
}

async function handleApply(sb: SupabaseClient, chatId: number, msg: any) {
  const signupId = await resolveSignup(sb, chatId);
  if (!signupId) {
    await tgSendMessage(chatId, "Connect first using your trial link.");
    return;
  }
  const fields = await listFields(sb, signupId);
  if (fields.length === 0) {
    await tgSendMessage(chatId, "No fields yet — add one on your farmer dashboard first.");
    return;
  }
  const keyboard = {
    inline_keyboard: fields.map((f: any) => ([{
      text: `${f.label} (${f.crop ?? "?"})`,
      callback_data: `apply:${f.id}`,
    }])),
  };
  await tgSendMessage(chatId, "Which field did you spray Buperac on?", { reply_markup: keyboard });
}

async function handleYield(sb: SupabaseClient, chatId: number, msg: any, args: string) {
  const signupId = await resolveSignup(sb, chatId);
  if (!signupId) {
    await tgSendMessage(chatId, "Connect first using your trial link.");
    return;
  }
  const n = parseFloat(args);
  if (!isFinite(n) || n <= 0) {
    await tgSendMessage(chatId, "Usage: /yield 52  (bu/ac for the field you'll pick next)");
    return;
  }
  const fields = await listFields(sb, signupId);
  if (fields.length === 0) {
    await tgSendMessage(chatId, "No fields yet — add one on your farmer dashboard first.");
    return;
  }
  const keyboard = {
    inline_keyboard: fields.map((f: any) => ([{
      text: `${f.label} (${f.crop ?? "?"})`,
      callback_data: `yield:${f.id}:${n}`,
    }])),
  };
  await tgSendMessage(chatId, `Which field yielded ${n} bu/ac?`, { reply_markup: keyboard });
}

async function handleCallback(sb: SupabaseClient, cb: any) {
  const chatId = cb.message?.chat?.id;
  const data = (cb.data as string) ?? "";
  const signupId = await resolveSignup(sb, chatId);
  if (!signupId) return;

  const [kind, fieldId, extra] = data.split(":");
  if (kind === "apply") {
    await sb.schema("bio_trial").from("trial_events").insert({
      signup_id: signupId,
      field_id: fieldId,
      kind: "application",
      payload: { applied_at: new Date().toISOString() },
      source: "telegram",
    });
    await tgSendMessage(chatId, "Application logged ✓");
  } else if (kind === "yield") {
    await sb.schema("bio_trial").from("trial_events").insert({
      signup_id: signupId,
      field_id: fieldId,
      kind: "yield",
      payload: { bu_per_ac: parseFloat(extra) },
      source: "telegram",
    });
    await tgSendMessage(chatId, `Yield saved: ${extra} bu/ac ✓`);
  }

  // Dismiss the Telegram loading spinner on the button
  await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: cb.id }),
  });
}
```

**Step 2: Route in `Deno.serve`**

```typescript
if (update?.callback_query) {
  await handleCallback(sb, update.callback_query);
  return new Response("ok", { status: 200 });
}

// ... existing message-handling code, then:
if (text.startsWith("/apply")) {
  await handleApply(sb, chatId, msg);
} else if (text.startsWith("/yield")) {
  await handleYield(sb, chatId, msg, text.slice("/yield".length).trim());
}
```

**Step 3: Redeploy + test**

(Needs a trial_field to exist — add one via SQL if frontend isn't ready:)

```sql
INSERT INTO bio_trial.trial_fields (signup_id, label, crop)
VALUES ('<signup_id>', 'NW Field', 'wheat');
```

Then from Telegram: `/apply` → tap field → expect "Application logged ✓" and:

```sql
SELECT kind, field_id, payload FROM bio_trial.trial_events
WHERE signup_id = '<signup_id>' AND kind = 'application' ORDER BY created_at DESC LIMIT 1;
```

Same for `/yield 52`.

**Step 4: Commit**

```bash
git commit -am "feat(edge): add /apply and /yield with inline-keyboard field pickers"
```

---

### Task 18: Register the webhook with Telegram

One-time setup — point Telegram's bot at our edge function URL.

**Step 1: Read the current webhook status**

```bash
curl "https://api.telegram.org/bot<BOT_TOKEN>/getWebhookInfo"
```

Expected: may show empty or outdated URL.

**Step 2: Register our URL**

```bash
FN_URL="https://ibgsloyjxdopkvwqcqwh.supabase.co/functions/v1/bio-trial-farmer-inbox"
SECRET="<same value as BIO_TRIAL_TG_WEBHOOK_SECRET>"

curl -X POST "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d "{
    \"url\": \"$FN_URL\",
    \"secret_token\": \"$SECRET\",
    \"allowed_updates\": [\"message\", \"callback_query\"]
  }"
```

Expected: `{"ok":true,"result":true,"description":"Webhook was set"}`.

**Step 3: Verify**

```bash
curl "https://api.telegram.org/bot<BOT_TOKEN>/getWebhookInfo"
```

Expected: `url` is our function URL, `has_custom_certificate=false`, `pending_update_count=0`.

**Step 4: Add a note to README**

Add a short "Webhook setup" subsection under Signup notifications (content covered in Task 27).

**Step 5: Commit**

Nothing to commit in code at this step — it's Telegram-side state. Make an empty commit:

```bash
git commit --allow-empty -m "ops: register Telegram webhook for farmer inbox"
```

---

## Phase 6 — Frontend pages

### Task 19: `farmer.html` skeleton + auth boot

**Files:**
- Create: `farmer.html`
- Create: `farmer.js`

**Step 1: Write `farmer.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="robots" content="noindex, nofollow" />
  <title>Your Buperac Trial</title>
  <link rel="stylesheet" href="styles.css" />
  <style>
    body { font-family: system-ui, -apple-system, Segoe UI, sans-serif; max-width: 820px; margin: 0 auto; padding: 24px; color: #2e2e30; }
    h1 { margin-top: 0; }
    .card { background: #fff; border: 1px solid #e6e2d8; border-radius: 12px; padding: 16px; margin-bottom: 16px; }
    .muted { color: rgba(46,46,48,0.65); }
    .error { color: #a11; background: #fef0f0; border-color: #f3caca; padding: 12px; border-radius: 8px; }
    button { font: inherit; padding: 8px 14px; border-radius: 8px; border: 1px solid #d4cebe; background: #f7f1e3; cursor: pointer; }
    input, select, textarea { font: inherit; padding: 6px 10px; border: 1px solid #d4cebe; border-radius: 6px; width: 100%; box-sizing: border-box; }
    .row { display: flex; gap: 8px; margin-bottom: 8px; }
    .row > * { flex: 1; }
    .timeline-item { padding: 10px 0; border-bottom: 1px solid #eee; }
    .timeline-item:last-child { border-bottom: none; }
    .kind-badge { display: inline-block; font-size: 11px; text-transform: uppercase; background: #e8e1cf; padding: 2px 6px; border-radius: 4px; margin-right: 8px; letter-spacing: 0.5px; }
  </style>
</head>
<body>
  <h1>Your Buperac Trial</h1>
  <div id="authError" class="card error" hidden></div>
  <section id="signupSummary" class="card" hidden></section>
  <section id="telegramSection" class="card" hidden></section>
  <section id="fieldsSection" class="card" hidden>
    <h2>Your fields</h2>
    <div id="fieldsList"></div>
    <button id="addFieldBtn">+ Add a field</button>
    <div id="fieldFormHost"></div>
  </section>
  <section id="eventSection" class="card" hidden>
    <h2>Log lab result or observation</h2>
    <div id="eventFormHost"></div>
  </section>
  <section id="timelineSection" class="card" hidden>
    <h2>Your timeline</h2>
    <div id="timelineList"></div>
  </section>
  <script src="supabase-config.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
  <script src="farmer.js" defer></script>
</body>
</html>
```

**Step 2: Write `farmer.js` — auth boot only**

```javascript
// farmer.js — farmer dashboard client. Signed-JWT auth via ?token= URL param.
// Strict no-innerHTML policy enforced by security hook — all DOM built with createElement + textContent.

(function () {
  const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const authErr = document.getElementById("authError");
  const showError = (msg) => {
    authErr.textContent = msg;
    authErr.hidden = false;
  };

  const url = new URL(window.location.href);
  const token = url.searchParams.get("token");
  if (!token) {
    showError("No trial link. Ask your contact for a fresh magic link.");
    return;
  }

  window.TOKEN = token;
  window.SB = sb;

  bootstrap().catch((e) => {
    console.error(e);
    showError("Could not load your trial. The link may be expired — ask for a new one.");
  });

  async function bootstrap() {
    const { data, error } = await sb.rpc("farmer_bootstrap", { p_token: token });
    if (error) throw error;
    window.FARMER_STATE = data;
    renderAll(data);
  }

  function renderAll(state) {
    renderSignup(state.signup);
    renderTelegramCta(state);
    renderFields(state.fields);
    renderTimeline(state.events);
    renderEventForm(state.fields);
    document.getElementById("signupSummary").hidden = false;
    document.getElementById("telegramSection").hidden = false;
    document.getElementById("fieldsSection").hidden = false;
    document.getElementById("eventSection").hidden = false;
    document.getElementById("timelineSection").hidden = false;
  }

  function renderSignup(s) {
    const host = document.getElementById("signupSummary");
    host.replaceChildren();
    const h = document.createElement("h2");
    h.textContent = `${s.name ?? ""}${s.farm_name ? " — " + s.farm_name : ""}`;
    const p = document.createElement("p");
    p.className = "muted";
    p.textContent = `${s.province ?? ""} · ${s.acres ?? 0} acres enrolled · ${s.liters ?? 0} L · ${s.delivered ? "delivered" : "pending"}`;
    host.appendChild(h);
    host.appendChild(p);
  }

  function renderTelegramCta(state) {
    const host = document.getElementById("telegramSection");
    host.replaceChildren();
    const h = document.createElement("h2");
    h.textContent = "Telegram inbox";
    host.appendChild(h);
    if (state.telegram_bound) {
      const p = document.createElement("p");
      p.textContent = "Connected ✓ — text observations, send photos, try /apply or /yield.";
      host.appendChild(p);
    } else {
      const p = document.createElement("p");
      p.textContent = "Connect Telegram to text updates and photos directly from the field.";
      const a = document.createElement("a");
      a.href = `https://t.me/BuperacTrialBot?start=${state.signup.id}`;
      a.textContent = "Open Telegram →";
      a.style.display = "inline-block";
      a.style.padding = "10px 14px";
      a.style.background = "#229ed9";
      a.style.color = "white";
      a.style.borderRadius = "8px";
      a.style.textDecoration = "none";
      a.style.marginTop = "6px";
      host.appendChild(p);
      host.appendChild(a);
    }
  }

  // Stubs — implemented in next tasks
  function renderFields() {}
  function renderTimeline() {}
  function renderEventForm() {}
})();
```

**Step 3: Serve locally and smoke-test**

```bash
python -m http.server 8000
```

Mint a token:

```sql
SELECT public.vendor_mint_farmer_token('<existing_signup_id>');
```

Open `http://localhost:8000/farmer.html?token=<token>`. Expect: signup summary renders, Telegram section renders with "Connect" button (or "Connected ✓" if bound).

**Step 4: Commit**

```bash
git add farmer.html farmer.js
git commit -m "feat(frontend): farmer.html skeleton with JWT-authed bootstrap"
```

---

### Task 20: `farmer.js` — fields + event form

**Files:**
- Modify: `farmer.js`

**Step 1: Replace the fields / timeline / event stubs**

Replace the `renderFields`, `renderTimeline`, `renderEventForm` stubs with:

```javascript
function renderFields(fields) {
  const host = document.getElementById("fieldsList");
  host.replaceChildren();
  if (!fields || fields.length === 0) {
    const p = document.createElement("p");
    p.className = "muted";
    p.textContent = "No fields yet. Add one to start tracking.";
    host.appendChild(p);
    return;
  }
  for (const f of fields) {
    const card = document.createElement("div");
    card.className = "card";
    const title = document.createElement("strong");
    title.textContent = `${f.label} · ${f.crop ?? "?"} (prev: ${f.prev_crop ?? "?"})`;
    const meta = document.createElement("div");
    meta.className = "muted";
    meta.textContent = `${f.acres ?? "?"} ac · ${f.application_method ?? "?"}`;
    card.appendChild(title);
    card.appendChild(meta);
    host.appendChild(card);
  }
}

document.getElementById("addFieldBtn").addEventListener("click", () => {
  const host = document.getElementById("fieldFormHost");
  if (host.childElementCount > 0) {
    host.replaceChildren();
    return;
  }
  host.appendChild(buildFieldForm());
});

function buildFieldForm() {
  const form = document.createElement("form");
  form.style.marginTop = "12px";

  const fields = [
    { name: "label", label: "Label (e.g. NW quarter)", type: "text", required: true },
    { name: "crop", label: "Crop", type: "text" },
    { name: "prev_crop", label: "Previous crop", type: "text" },
    { name: "acres", label: "Acres", type: "number" },
  ];
  for (const spec of fields) {
    const row = document.createElement("div");
    row.className = "row";
    const lab = document.createElement("label");
    lab.textContent = spec.label;
    lab.style.flex = "2";
    const inp = document.createElement("input");
    inp.name = spec.name;
    inp.type = spec.type;
    if (spec.required) inp.required = true;
    lab.appendChild(inp);
    row.appendChild(lab);
    form.appendChild(row);
  }

  const selRow = document.createElement("div");
  selRow.className = "row";
  const selLab = document.createElement("label");
  selLab.textContent = "Application method";
  const sel = document.createElement("select");
  sel.name = "application_method";
  for (const [v, t] of [["", "—"], ["liquid_seeding", "Liquid at seeding"], ["foliar_spray", "Foliar spray"]]) {
    const opt = document.createElement("option");
    opt.value = v;
    opt.textContent = t;
    sel.appendChild(opt);
  }
  selLab.appendChild(sel);
  selRow.appendChild(selLab);
  form.appendChild(selRow);

  const submit = document.createElement("button");
  submit.type = "submit";
  submit.textContent = "Save field";
  form.appendChild(submit);

  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const fd = new FormData(form);
    const patch = {
      label: fd.get("label"),
      crop: fd.get("crop") || null,
      prev_crop: fd.get("prev_crop") || null,
      application_method: fd.get("application_method") || null,
      acres: fd.get("acres") || null,
    };
    const { error } = await window.SB.rpc("farmer_upsert_field", {
      p_token: window.TOKEN, p_patch: patch,
    });
    if (error) {
      alert("Failed to save: " + error.message);
      return;
    }
    // Refetch state
    const { data } = await window.SB.rpc("farmer_bootstrap", { p_token: window.TOKEN });
    window.FARMER_STATE = data;
    renderFields(data.fields);
    renderTimeline(data.events);
    renderEventForm(data.fields);
    document.getElementById("fieldFormHost").replaceChildren();
  });

  return form;
}

function renderTimeline(events) {
  const host = document.getElementById("timelineList");
  host.replaceChildren();
  if (!events || events.length === 0) {
    const p = document.createElement("p");
    p.className = "muted";
    p.textContent = "Nothing logged yet.";
    host.appendChild(p);
    return;
  }
  for (const e of events) {
    const row = document.createElement("div");
    row.className = "timeline-item";
    const badge = document.createElement("span");
    badge.className = "kind-badge";
    badge.textContent = e.kind.replace(/_/g, " ");
    const when = document.createElement("span");
    when.className = "muted";
    when.textContent = new Date(e.created_at).toLocaleString();
    const detail = document.createElement("div");
    const summary = e.payload?.text || e.payload?.caption || JSON.stringify(e.payload ?? {});
    detail.textContent = summary.slice(0, 240);
    row.appendChild(badge);
    row.appendChild(when);
    row.appendChild(detail);
    host.appendChild(row);
  }
}

function renderEventForm(fields) {
  const host = document.getElementById("eventFormHost");
  host.replaceChildren();

  const form = document.createElement("form");
  const selRow = document.createElement("div");
  selRow.className = "row";

  const kindLab = document.createElement("label");
  kindLab.textContent = "Kind";
  const kindSel = document.createElement("select");
  kindSel.name = "kind";
  for (const [v, t] of [
    ["observation", "Observation (note)"],
    ["soil_test", "Soil test"],
    ["moisture_test", "Moisture test"],
    ["stand_count", "Stand count"],
    ["protein", "Protein %"],
  ]) {
    const opt = document.createElement("option");
    opt.value = v;
    opt.textContent = t;
    kindSel.appendChild(opt);
  }
  kindLab.appendChild(kindSel);
  selRow.appendChild(kindLab);

  const fieldLab = document.createElement("label");
  fieldLab.textContent = "Field";
  const fieldSel = document.createElement("select");
  fieldSel.name = "field_id";
  const noneOpt = document.createElement("option");
  noneOpt.value = "";
  noneOpt.textContent = "— (signup-level)";
  fieldSel.appendChild(noneOpt);
  for (const f of fields ?? []) {
    const opt = document.createElement("option");
    opt.value = f.id;
    opt.textContent = `${f.label} (${f.crop ?? "?"})`;
    fieldSel.appendChild(opt);
  }
  fieldLab.appendChild(fieldSel);
  selRow.appendChild(fieldLab);
  form.appendChild(selRow);

  const noteRow = document.createElement("div");
  noteRow.className = "row";
  const noteLab = document.createElement("label");
  noteLab.textContent = "Notes / value";
  const noteInp = document.createElement("textarea");
  noteInp.name = "note";
  noteInp.rows = 3;
  noteLab.appendChild(noteInp);
  noteRow.appendChild(noteLab);
  form.appendChild(noteRow);

  const fileRow = document.createElement("div");
  fileRow.className = "row";
  const fileLab = document.createElement("label");
  fileLab.textContent = "Attach PDF / photo (optional)";
  const fileInp = document.createElement("input");
  fileInp.type = "file";
  fileInp.name = "file";
  fileInp.accept = "application/pdf,image/*";
  fileLab.appendChild(fileInp);
  fileRow.appendChild(fileLab);
  form.appendChild(fileRow);

  const submit = document.createElement("button");
  submit.type = "submit";
  submit.textContent = "Log event";
  form.appendChild(submit);

  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const fd = new FormData(form);
    const kind = fd.get("kind");
    const fieldId = fd.get("field_id") || null;
    const note = fd.get("note") ?? "";
    const file = fileInp.files?.[0] ?? null;

    let fileUrls = [];
    if (file) {
      const signed = await window.SB.rpc("farmer_signed_upload_url", {
        p_token: window.TOKEN, p_filename: file.name,
      });
      if (signed.error) {
        alert("Upload URL failed: " + signed.error.message);
        return;
      }
      const { path, signed: signedInner } = signed.data;
      const putRes = await fetch(signedInner.signedURL ?? signedInner.signed_url, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!putRes.ok) {
        alert("File upload failed");
        return;
      }
      fileUrls = [path];
    }

    const payload = { text: note };

    const { error } = await window.SB.rpc("farmer_register_event", {
      p_token: window.TOKEN,
      p_kind: kind,
      p_field_id: fieldId,
      p_payload: payload,
      p_file_urls: fileUrls,
    });
    if (error) {
      alert("Failed: " + error.message);
      return;
    }
    form.reset();
    const { data } = await window.SB.rpc("farmer_bootstrap", { p_token: window.TOKEN });
    window.FARMER_STATE = data;
    renderTimeline(data.events);
  });

  host.appendChild(form);
}
```

**Step 2: Smoke-test**

Reload `farmer.html?token=<token>`. Add a field, confirm it appears. Log an observation, confirm it appears in the timeline.

**Step 3: Commit**

```bash
git add farmer.js
git commit -m "feat(frontend): farmer field CRUD and event log form"
```

---

### Task 21: `trial.html` + `trial.js` public dashboard

**Files:**
- Create: `trial.html`
- Create: `trial.js`

**Step 1: Write `trial.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Buperac Bio Trial — Live Results</title>
  <meta name="description" content="Live results from the 2026 Buperac × SixRing foliar biostimulant trial." />
  <style>
    body { font-family: system-ui, -apple-system, Segoe UI, sans-serif; max-width: 960px; margin: 0 auto; padding: 32px 24px; color: #2e2e30; background: #faf6ec; }
    h1 { margin-top: 0; }
    .headline-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; margin: 24px 0; }
    .stat { background: #fff; padding: 16px; border-radius: 10px; border: 1px solid #ebe5d4; }
    .stat .n { font-size: 32px; font-weight: 700; line-height: 1; }
    .stat .l { font-size: 13px; color: rgba(46,46,48,0.65); text-transform: uppercase; letter-spacing: 0.5px; margin-top: 4px; }
    .section { background: #fff; padding: 18px; border-radius: 10px; border: 1px solid #ebe5d4; margin-bottom: 18px; }
    .activity-item { padding: 8px 0; border-bottom: 1px solid #f0ebdc; }
    .activity-item:last-child { border-bottom: none; }
    .muted { color: rgba(46,46,48,0.6); font-size: 13px; }
    .empty { font-style: italic; color: rgba(46,46,48,0.5); }
    .photos { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 8px; }
    .photos img { width: 100%; aspect-ratio: 1/1; object-fit: cover; border-radius: 8px; }
  </style>
</head>
<body>
  <h1>Buperac Bio Trial — Live Results</h1>
  <p class="muted">2026 season · Buperac × SixRing foliar biostimulant · <a href="/">trial signup</a></p>

  <div id="headline" class="headline-grid"></div>

  <section class="section">
    <h2>Crop yield aggregates</h2>
    <p class="muted">Shown when at least <strong>3 farms</strong> are contributing for a given crop — protects individual farm privacy.</p>
    <div id="aggregates"></div>
  </section>

  <section class="section">
    <h2>Recent activity</h2>
    <div id="activity"></div>
  </section>

  <section class="section" id="photosSection" hidden>
    <h2>From the field</h2>
    <div id="photos" class="photos"></div>
  </section>

  <script src="supabase-config.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
  <script src="trial.js" defer></script>
</body>
</html>
```

**Step 2: Write `trial.js`**

```javascript
// trial.js — public trial dashboard. Single anon RPC call, read-only render.

(function () {
  const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  load().catch((e) => {
    console.error(e);
    const h = document.getElementById("headline");
    h.replaceChildren();
    const p = document.createElement("p");
    p.className = "empty";
    p.textContent = "Dashboard temporarily unavailable.";
    h.appendChild(p);
  });

  async function load() {
    const { data, error } = await sb.rpc("get_trial_dashboard");
    if (error) throw error;
    renderHeadline(data.headline);
    renderAggregates(data.aggregates);
    renderActivity(data.activity);
    renderPhotos(data.photos);
  }

  function stat(n, label) {
    const d = document.createElement("div");
    d.className = "stat";
    const big = document.createElement("div");
    big.className = "n";
    big.textContent = n;
    const lab = document.createElement("div");
    lab.className = "l";
    lab.textContent = label;
    d.appendChild(big);
    d.appendChild(lab);
    return d;
  }

  function renderHeadline(h) {
    const host = document.getElementById("headline");
    host.replaceChildren();
    host.appendChild(stat(h.farms_count, "Farms enrolled"));
    host.appendChild(stat(Math.round(Number(h.acres_enrolled) || 0), "Acres enrolled"));
    host.appendChild(stat(h.provinces_count, "Provinces"));
    host.appendChild(stat(h.applications_count, "Applications logged"));
    host.appendChild(stat(h.yields_count, "Yield reports"));
    host.appendChild(stat(h.observations_count, "Observations"));
  }

  function renderAggregates(list) {
    const host = document.getElementById("aggregates");
    host.replaceChildren();
    if (!list || list.length === 0) {
      const p = document.createElement("p");
      p.className = "empty";
      p.textContent = "Not enough reports yet — aggregates appear once 3 farms have logged yield for a crop.";
      host.appendChild(p);
      return;
    }
    const tbl = document.createElement("table");
    tbl.style.width = "100%";
    tbl.style.borderCollapse = "collapse";
    const head = document.createElement("tr");
    for (const t of ["Crop", "Avg yield (bu/ac)", "Farms"]) {
      const th = document.createElement("th");
      th.textContent = t;
      th.style.textAlign = "left";
      th.style.padding = "6px 4px";
      th.style.borderBottom = "1px solid #ebe5d4";
      head.appendChild(th);
    }
    tbl.appendChild(head);
    for (const row of list) {
      const tr = document.createElement("tr");
      for (const v of [row.crop, row.avg_yield, row.farms]) {
        const td = document.createElement("td");
        td.textContent = String(v);
        td.style.padding = "6px 4px";
        td.style.borderBottom = "1px solid #f4efe0";
        tr.appendChild(td);
      }
      tbl.appendChild(tr);
    }
    host.appendChild(tbl);
  }

  function renderActivity(list) {
    const host = document.getElementById("activity");
    host.replaceChildren();
    if (!list || list.length === 0) {
      const p = document.createElement("p");
      p.className = "empty";
      p.textContent = "No activity yet.";
      host.appendChild(p);
      return;
    }
    for (const a of list) {
      const row = document.createElement("div");
      row.className = "activity-item";
      const sentence = document.createElement("span");
      const crop = a.crop ? ` on ${a.crop}` : "";
      sentence.textContent = `A farmer in ${a.province ?? "CA"} logged ${a.kind.replace(/_/g, " ")}${crop}`;
      const when = document.createElement("span");
      when.className = "muted";
      when.textContent = "  · " + timeAgo(new Date(a.created_at));
      row.appendChild(sentence);
      row.appendChild(when);
      host.appendChild(row);
    }
  }

  async function renderPhotos(photos) {
    if (!photos || photos.length === 0) return;
    const section = document.getElementById("photosSection");
    const host = document.getElementById("photos");
    host.replaceChildren();
    for (const p of photos) {
      const path = p.file_urls?.[0];
      if (!path) continue;
      // Get a signed read URL
      const { data, error } = await sb.storage
        .from("trial-uploads")
        .createSignedUrl(path, 3600);
      if (error) continue;
      const img = document.createElement("img");
      img.src = data.signedUrl;
      img.alt = p.caption ?? "trial photo";
      img.loading = "lazy";
      host.appendChild(img);
    }
    if (host.childElementCount > 0) section.hidden = false;
  }

  function timeAgo(d) {
    const diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  }
})();
```

**Step 3: Smoke-test**

Reload `http://localhost:8000/trial.html`. Expect headline stats (all 0 or close), aggregates empty-state message, activity populated from any events that exist.

**Step 4: Commit**

```bash
git add trial.html trial.js
git commit -m "feat(frontend): public trial dashboard with privacy floor"
```

---

### Task 22: Link the public dashboard from the landing page

**Files:**
- Modify: `index.html`

**Step 1: Add a footer or header link to the trial dashboard**

Add a small nav link near the top of the page (inside the existing header section):

```html
<a href="/trial.html" style="position: absolute; top: 18px; right: 18px; color: #2e2e30; text-decoration: underline; font-size: 14px;">See live trial results →</a>
```

Exact placement depends on the layout — put it where it's visible but not overbearing.

**Step 2: Smoke-test**

Reload `index.html` in browser. Click the link. Verify it lands on `trial.html`.

**Step 3: Commit**

```bash
git commit -am "feat(frontend): link to live trial results from landing page"
```

---

## Phase 7 — Vendor console updates

### Task 23: Add "Copy farmer link" button to vendor.html rows

**Files:**
- Modify: `vendor.html`
- Modify: `vendor.js`

**Step 1: Locate the row-rendering code in `vendor.js`**

Find where each signup row is constructed (look for `createElement("tr")` or similar). We add a button cell.

**Step 2: Add the copy-link handler**

```javascript
// Somewhere near the top of vendor.js (or wherever other row helpers live)
async function copyFarmerLink(signupId, btn) {
  const prev = btn.textContent;
  btn.textContent = "…";
  const { data, error } = await window.SB.rpc("vendor_mint_farmer_token", {
    p_signup_id: signupId,
  });
  if (error) {
    btn.textContent = "error";
    setTimeout(() => (btn.textContent = prev), 1500);
    return;
  }
  const url = `${location.origin}/farmer.html?token=${encodeURIComponent(data)}`;
  await navigator.clipboard.writeText(url);
  btn.textContent = "copied ✓";
  setTimeout(() => (btn.textContent = prev), 1800);
}
```

**Step 3: Add a cell in the row render**

Next to the existing paid/liters/delivered controls, gate the button on `delivered=true`:

```javascript
const linkCell = document.createElement("td");
if (row.delivered) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.textContent = "Copy farmer link";
  btn.addEventListener("click", () => copyFarmerLink(row.id, btn));
  linkCell.appendChild(btn);
} else {
  linkCell.textContent = "—";
}
tr.appendChild(linkCell);
```

Also add a matching header cell (`<th>Farmer link</th>`) to the thead.

**Step 4: Smoke-test**

Sign in as vendor at `vendor.html`. Click Copy on any delivered row. Paste into a new tab — verify it opens `farmer.html?token=…` and the dashboard loads.

**Step 5: Commit**

```bash
git commit -am "feat(vendor): add copy-farmer-link button on delivered rows"
```

---

### Task 24: Add "Rebind Telegram" vendor action

**Files:**
- Modify: migration — `20260420000014_vendor_rebind_telegram`
- Modify: `vendor.js`

**Step 1: Write the RPC**

```sql
CREATE OR REPLACE FUNCTION public.vendor_unbind_farmer_telegram(p_signup_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = bio_trial, public
AS $$
BEGIN
  IF NOT bio_trial.is_vendor() THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  UPDATE bio_trial.signups
  SET farmer_telegram_chat_id = NULL,
      farmer_linked_at = NULL
  WHERE id = p_signup_id;
END$$;

GRANT EXECUTE ON FUNCTION public.vendor_unbind_farmer_telegram(uuid) TO authenticated;
```

Apply via `apply_migration`.

**Step 2: Add a button in vendor.js**

In the same row render, add another button (or merge into a small actions dropdown):

```javascript
const rebindBtn = document.createElement("button");
rebindBtn.type = "button";
rebindBtn.textContent = row.farmer_telegram_chat_id ? "Rebind Telegram" : "—";
rebindBtn.disabled = !row.farmer_telegram_chat_id;
rebindBtn.addEventListener("click", async () => {
  if (!confirm("Clear the Telegram binding? The farmer will need to tap /start on a fresh link.")) return;
  const { error } = await window.SB.rpc("vendor_unbind_farmer_telegram", { p_signup_id: row.id });
  if (error) {
    alert("Failed: " + error.message);
    return;
  }
  location.reload();
});
linkCell.appendChild(rebindBtn);
```

Also update `list_bio_trial_signups` if it doesn't already include `farmer_telegram_chat_id` — check and amend the migration if needed.

**Step 3: Smoke-test**

With a bound signup, click Rebind, confirm, verify:

```sql
SELECT farmer_telegram_chat_id FROM bio_trial.signups WHERE id = '<id>';
```

Expected: NULL.

**Step 4: Commit**

```bash
git commit -am "feat(vendor): add Telegram rebind action"
```

---

### Task 25: Add "Events" tab on vendor console

Shows all `trial_events` for a chosen signup — useful for support calls.

**Files:**
- Migration: `20260420000015_vendor_list_events`
- Modify: `vendor.html`, `vendor.js`

**Step 1: RPC**

```sql
CREATE OR REPLACE FUNCTION public.vendor_list_trial_events(p_signup_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = bio_trial, public
AS $$
BEGIN
  IF NOT bio_trial.is_vendor() THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;
  RETURN (
    SELECT coalesce(jsonb_agg(to_jsonb(e) ORDER BY e.created_at DESC), '[]'::jsonb)
    FROM bio_trial.trial_events e
    WHERE e.signup_id = p_signup_id
  );
END$$;

GRANT EXECUTE ON FUNCTION public.vendor_list_trial_events(uuid) TO authenticated;
```

**Step 2: UI — add a small "Events" column/button per row**

Add to each row:

```javascript
const eventsBtn = document.createElement("button");
eventsBtn.type = "button";
eventsBtn.textContent = "Events";
eventsBtn.addEventListener("click", () => openEventsPanel(row.id));
linkCell.appendChild(eventsBtn);
```

And add an `openEventsPanel` helper that fetches and renders in a modal/panel:

```javascript
async function openEventsPanel(signupId) {
  const host = document.getElementById("eventsPanel") ?? (() => {
    const d = document.createElement("div");
    d.id = "eventsPanel";
    d.style.position = "fixed";
    d.style.top = "0";
    d.style.right = "0";
    d.style.bottom = "0";
    d.style.width = "min(480px, 90vw)";
    d.style.background = "#fff";
    d.style.borderLeft = "1px solid #e5e5e5";
    d.style.padding = "16px";
    d.style.overflow = "auto";
    d.style.zIndex = "100";
    document.body.appendChild(d);
    return d;
  })();
  host.replaceChildren();

  const close = document.createElement("button");
  close.type = "button";
  close.textContent = "Close";
  close.addEventListener("click", () => host.remove());
  host.appendChild(close);

  const { data, error } = await window.SB.rpc("vendor_list_trial_events", { p_signup_id: signupId });
  if (error) {
    const p = document.createElement("p");
    p.textContent = "Error: " + error.message;
    host.appendChild(p);
    return;
  }
  if (!data || data.length === 0) {
    const p = document.createElement("p");
    p.textContent = "No events yet.";
    host.appendChild(p);
    return;
  }
  for (const e of data) {
    const row = document.createElement("div");
    row.style.padding = "8px 0";
    row.style.borderBottom = "1px solid #eee";
    const badge = document.createElement("strong");
    badge.textContent = e.kind;
    const when = document.createElement("span");
    when.style.color = "#666";
    when.textContent = "  " + new Date(e.created_at).toLocaleString();
    const body = document.createElement("div");
    body.textContent = JSON.stringify(e.payload ?? {});
    row.appendChild(badge);
    row.appendChild(when);
    row.appendChild(body);
    host.appendChild(row);
  }
}
```

**Step 3: Smoke-test**

Click Events on a row with trial events — panel opens with a list.

**Step 4: Commit**

```bash
git commit -am "feat(vendor): add per-signup events panel"
```

---

## Phase 8 — Smoke test + docs

### Task 26: End-to-end smoke test

**Step 1: Create a fresh test signup**

```sql
INSERT INTO bio_trial.signups (name, farm_name, email, province, acres, logistics_method, paid, delivered)
VALUES ('Smoke Test', 'SmokeFarm', 'smoke@example.com', 'SK', 100, 'pickup', true, true)
RETURNING id;
```

Record the `id`.

**Step 2: Vendor mints farmer link**

Sign in as vendor, click Copy on that row, get the URL.

**Step 3: Farmer opens link**

Open `farmer.html?token=…`, verify bootstrap loads. Add a field "Test NW" (crop: wheat, acres: 80). Verify it appears.

**Step 4: Connect Telegram**

Click the Telegram deep link, tap Start. Verify bot replies "Connected, Smoke Test".

**Step 5: Text + photo from Telegram**

Send: "Looking healthy, some lodging." Expect "Saved ✓". Send a photo — expect "Photo saved 📷".

**Step 6: /apply + /yield**

Send `/apply`, tap Test NW, expect "Application logged ✓".
Send `/yield 55`, tap Test NW, expect "Yield saved: 55 bu/ac ✓".

**Step 7: Verify public dashboard reflects activity**

Open `trial.html` — headline stats should increment (1 farm, 100 acres, 1 application, 1 yield). Aggregates still empty (only 1 farm). Activity feed shows the events (redacted).

**Step 8: Cleanup**

```sql
DELETE FROM bio_trial.signups WHERE email = 'smoke@example.com';
-- (ON DELETE CASCADE clears trial_fields and trial_events)
DELETE FROM storage.objects WHERE bucket_id = 'trial-uploads' AND name LIKE '<signup_id>/%';
```

**Step 9: Commit the smoke test log**

```bash
git commit --allow-empty -m "test: E2E smoke test passed — signup → farmer dash → telegram → public"
```

---

### Task 27: README + design doc updates

**Files:**
- Modify: `README.md`
- Modify: `docs/plans/2026-04-19-trial-dashboard-design.md` (mark as shipped)

**Step 1: Update README**

Add three sections:

1. **Farmer inbox (Telegram)** — describe the `@BuperacTrialBot` webhook, the `/start <signup_id>` binding, list supported commands (text observations, photos, `/apply`, `/yield`), and the secrets required: `BIO_TRIAL_TG_BOT_TOKEN`, `BIO_TRIAL_TG_WEBHOOK_SECRET`.
2. **Webhook setup** — the one-time `setWebhook` curl command.
3. **Farmer dashboard + public trial dashboard** — what `/farmer.html` does (JWT-authed), what `/trial.html` does (anon), privacy floor mention.

Extend the RPC table with the new functions: `vendor_mint_farmer_token`, `vendor_unbind_farmer_telegram`, `vendor_list_trial_events`, `farmer_bootstrap`, `farmer_upsert_field`, `farmer_register_event`, `farmer_signed_upload_url`, `get_trial_dashboard`.

**Step 2: Mark design doc as shipped**

Change `**Status:** Approved for implementation planning` to `**Status:** Shipped YYYY-MM-DD` with today's date.

**Step 3: Commit**

```bash
git commit -am "docs: README + design doc updates for trial dashboard ship"
```

---

## Done criteria

All of the following work end-to-end:

- [ ] A vendor can mint a farmer link from `vendor.html`
- [ ] The farmer can open the link, see signup summary, add fields, log events with file attachments
- [ ] The farmer can tap the Telegram deep link, bind their chat, send text + photos + `/apply` + `/yield`, and see events appear in the farmer dashboard timeline
- [ ] The public `trial.html` shows headline stats, respects the privacy floor for aggregates, and shows a redacted activity feed
- [ ] No raw farmer PII (name, email, phone, farm_name, RM/county) ever surfaces in public RPC output
- [ ] Smoke test in Task 26 passes cleanly on a fresh signup

## Things to watch for while executing

- **The security hook rejects any literal `innerHTML`** in committed code. Every DOM build in this plan uses `createElement` + `textContent` + `replaceChildren` for that reason. Don't introduce `innerHTML` as a "shortcut" during implementation.
- **Supabase JS client default schema is `public`.** All reads/writes against `bio_trial.*` tables from the edge function need `sb.schema('bio_trial')`.
- **Migration numbering follows existing convention** (`YYYYMMDD######_name`). Check `list_migrations` before applying to avoid collision.
- **Don't rotate `bio_trial_farmer_jwt_secret`** casually — every outstanding farmer link breaks. If you must rotate, plan to reissue every unexpired link via vendor console.
- **The Telegram `getFile` URL expires in ~1 hour** — that's fine because we fetch bytes inside the same function invocation that gets the URL. Don't cache the URL and try to use it later.
