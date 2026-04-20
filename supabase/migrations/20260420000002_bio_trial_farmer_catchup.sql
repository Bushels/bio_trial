-- Bio trial farmer schema — catch-up migration.
--
-- The standalone bio_trial repo was seeded with a design-level subset of the
-- migrations that actually ran against Bushel Board (project ibgsloyjxdopkvwqcqwh).
-- Live has: trial_fields, trial_events, two farmer-binding columns on signups,
-- JWT helpers, and the farmer/vendor RPCs that trial.js, farmer.js, and vendor.js
-- depend on. None of those were committed here.
--
-- This migration reproduces the live state so a fresh rebuild (e.g. when the
-- Buperac Trial Supabase project is stood up per docs/plans/2026-04-19-bio-trial-standalone-design.md)
-- reproduces prod exactly. Everything is idempotent so re-running against the
-- Bushel Board project is a no-op.
--
-- Prereqs (Supabase provides these; asserted here):
--   * extensions.pgjwt  — sign/verify for farmer magic-link JWTs
--   * extensions.pgcrypto — gen_random_uuid()
--   * extensions.pg_net — notify trigger (already required by 20260419000004)
--   * vault secrets: bio_trial_farmer_jwt_secret
--                    (plus bio_trial_fn_url / bio_trial_webhook_secret from the trigger migration)

CREATE EXTENSION IF NOT EXISTS pgjwt    WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- =============================================================
-- 1. signups — farmer <-> telegram binding columns
-- =============================================================
ALTER TABLE bio_trial.signups
  ADD COLUMN IF NOT EXISTS farmer_telegram_chat_id bigint,
  ADD COLUMN IF NOT EXISTS farmer_linked_at        timestamptz;

COMMENT ON COLUMN bio_trial.signups.farmer_telegram_chat_id
  IS 'Chat id of the farmer who completed /start <signup_id> on the bio-trial Telegram bot. Nulled by vendor_unbind_farmer_telegram so the link can be reclaimed.';
COMMENT ON COLUMN bio_trial.signups.farmer_linked_at
  IS 'Timestamp of first successful Telegram bind. Used by the farmer console to surface "Telegram connected ✓".';

-- =============================================================
-- 2. trial_fields — one row per farmer-declared field
--    RLS stays OFF: all writes go through farmer_upsert_field (SECURITY DEFINER,
--    signup-scoped via JWT) and vendor reads go through vendor_list_* RPCs.
-- =============================================================
CREATE TABLE IF NOT EXISTS bio_trial.trial_fields (
  id                 uuid        NOT NULL DEFAULT gen_random_uuid(),
  signup_id          uuid        NOT NULL,
  label              text        NOT NULL,
  crop               text,
  prev_crop          text,
  application_method text,
  seed_rate_payload  jsonb,
  fert_rate_payload  jsonb,
  tank_mix           jsonb,
  acres              numeric,
  created_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trial_fields_pkey                     PRIMARY KEY (id),
  CONSTRAINT trial_fields_signup_id_fkey           FOREIGN KEY (signup_id) REFERENCES bio_trial.signups(id) ON DELETE CASCADE,
  CONSTRAINT trial_fields_application_method_check CHECK (application_method IS NULL OR application_method = ANY (ARRAY['liquid_seeding','foliar_spray']))
);

CREATE INDEX IF NOT EXISTS trial_fields_signup_idx ON bio_trial.trial_fields (signup_id);

COMMENT ON TABLE bio_trial.trial_fields IS 'Per-field declarations: crop, application method, seed/fert rates. One signup can have many fields.';

-- =============================================================
-- 3. trial_events — every farmer-submitted observation/photo/yield
-- =============================================================
CREATE TABLE IF NOT EXISTS bio_trial.trial_events (
  id                  uuid        NOT NULL DEFAULT gen_random_uuid(),
  signup_id           uuid        NOT NULL,
  field_id            uuid,
  kind                text        NOT NULL,
  payload             jsonb       NOT NULL DEFAULT '{}'::jsonb,
  source              text        NOT NULL,
  telegram_message_id bigint,
  file_urls           text[]      NOT NULL DEFAULT ARRAY[]::text[],
  public_opt_in       boolean     NOT NULL DEFAULT false,
  created_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trial_events_pkey           PRIMARY KEY (id),
  CONSTRAINT trial_events_signup_id_fkey FOREIGN KEY (signup_id) REFERENCES bio_trial.signups(id)      ON DELETE CASCADE,
  CONSTRAINT trial_events_field_id_fkey  FOREIGN KEY (field_id)  REFERENCES bio_trial.trial_fields(id) ON DELETE SET NULL,
  CONSTRAINT trial_events_kind_check     CHECK (kind   = ANY (ARRAY['field_created','application','observation','stand_count','yield','protein','soil_test','moisture_test','photo','heat_event_timing'])),
  CONSTRAINT trial_events_source_check   CHECK (source = ANY (ARRAY['telegram','farmer_web','vendor_admin']))
);

CREATE INDEX        IF NOT EXISTS trial_events_signup_idx        ON bio_trial.trial_events (signup_id, created_at DESC);
CREATE INDEX        IF NOT EXISTS trial_events_kind_idx          ON bio_trial.trial_events (kind);
-- Telegram webhook retry can replay the same update; dedupe by (non-null) message id.
CREATE UNIQUE INDEX IF NOT EXISTS trial_events_telegram_dedupe   ON bio_trial.trial_events (telegram_message_id) WHERE telegram_message_id IS NOT NULL;

COMMENT ON TABLE  bio_trial.trial_events            IS 'Append-only event log: observations, photos, yield, stand count, application, soil/moisture tests, heat events.';
COMMENT ON COLUMN bio_trial.trial_events.public_opt_in IS 'Farmer consented to this event surfacing on the public dashboard. Default false — the public ledger filters on = true.';

-- =============================================================
-- 4. trial-uploads storage bucket (private; service-role writes only).
--    Farmer uploads hit the bio-trial-farmer-upload-url edge function,
--    which uses the service role to sign an upload URL.
-- =============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'trial-uploads',
  'trial-uploads',
  false,
  20971520,  -- 20 MB
  ARRAY['image/jpeg','image/png','image/webp','application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public             = EXCLUDED.public,
  file_size_limit    = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy p
    JOIN pg_class  c ON c.oid = p.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'storage' AND c.relname = 'objects'
      AND p.polname = 'trial_uploads_service_role_all'
  ) THEN
    CREATE POLICY "trial_uploads_service_role_all"
      ON storage.objects
      FOR ALL
      TO service_role
      USING      (bucket_id = 'trial-uploads')
      WITH CHECK (bucket_id = 'trial-uploads');
  END IF;
END $$;

-- =============================================================
-- 5. JWT helpers — sign/verify the farmer magic-link token.
--    Secret lives in vault (set out-of-band); token scopes to a signup_id
--    for 180 days and carries aud='bio_trial.farmer'.
-- =============================================================
CREATE OR REPLACE FUNCTION bio_trial.mint_farmer_jwt(p_signup_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'bio_trial', 'extensions', 'public'
AS $function$
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
      'exp', v_now + (180 * 86400)
    ),
    v_secret,
    'HS256'
  );
END$function$;

CREATE OR REPLACE FUNCTION bio_trial.verify_farmer_jwt(p_token text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'bio_trial', 'extensions', 'public'
AS $function$
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
END$function$;

-- =============================================================
-- 6. Farmer RPCs (public schema) — called from farmer.js with the anon key
--    and the magic-link token in p_token. All gate on verify_farmer_jwt.
-- =============================================================
CREATE OR REPLACE FUNCTION public.farmer_verify_token(p_token text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'bio_trial'
AS $function$
DECLARE v_signup_id uuid;
BEGIN
  SELECT bio_trial.verify_farmer_jwt(p_token) INTO v_signup_id;
  RETURN v_signup_id;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.farmer_bootstrap(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'bio_trial', 'public'
AS $function$
DECLARE
  v_signup_id uuid;
  v_signup    jsonb;
  v_fields    jsonb;
  v_events    jsonb;
  v_bound     boolean;
BEGIN
  v_signup_id := bio_trial.verify_farmer_jwt(p_token);

  SELECT to_jsonb(s) INTO v_signup
  FROM (
    SELECT id,
           name,
           farm_name,
           province_state AS province,
           acres,
           logistics_method,
           crops,
           (payment_status = 'paid')             AS paid,
           liters_purchased                      AS liters,
           (product_delivered_at IS NOT NULL)    AS delivered,
           (product_shipped_at   IS NOT NULL)    AS shipped,
           (farmer_telegram_chat_id IS NOT NULL) AS telegram_bound
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
    'signup',         v_signup,
    'fields',         v_fields,
    'events',         v_events,
    'telegram_bound', v_bound
  );
END$function$;

CREATE OR REPLACE FUNCTION public.farmer_upsert_field(p_token text, p_patch jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'bio_trial', 'public'
AS $function$
DECLARE
  v_signup_id uuid;
  v_field_id  uuid;
  v_row       bio_trial.trial_fields;
BEGIN
  v_signup_id := bio_trial.verify_farmer_jwt(p_token);

  IF NOT (p_patch ?| ARRAY['label','crop','prev_crop','application_method',
                           'seed_rate_payload','fert_rate_payload','tank_mix','acres','id']) THEN
    RAISE EXCEPTION 'no valid keys in patch';
  END IF;

  v_field_id := nullif(p_patch->>'id', '')::uuid;

  IF v_field_id IS NULL THEN
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

    INSERT INTO bio_trial.trial_events (signup_id, field_id, kind, payload, source)
    VALUES (v_signup_id, v_row.id, 'field_created',
            jsonb_build_object('label', v_row.label, 'crop', v_row.crop),
            'farmer_web');
  ELSE
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
END$function$;

CREATE OR REPLACE FUNCTION public.farmer_register_event(
  p_token         text,
  p_kind          text,
  p_field_id      uuid,
  p_payload       jsonb,
  p_file_urls     text[],
  p_public_opt_in boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'bio_trial', 'public'
AS $function$
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
END$function$;

-- =============================================================
-- 7. Vendor RPCs (public schema) — gated on bio_trial.is_vendor()
-- =============================================================
CREATE OR REPLACE FUNCTION public.vendor_mint_farmer_token(p_signup_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'bio_trial', 'public'
AS $function$
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
END$function$;

CREATE OR REPLACE FUNCTION public.vendor_list_trial_events(p_signup_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'bio_trial', 'public'
AS $function$
BEGIN
  IF NOT bio_trial.is_vendor() THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;
  RETURN (
    SELECT coalesce(jsonb_agg(to_jsonb(e) ORDER BY e.created_at DESC), '[]'::jsonb)
    FROM bio_trial.trial_events e
    WHERE e.signup_id = p_signup_id
  );
END$function$;

CREATE OR REPLACE FUNCTION public.vendor_unbind_farmer_telegram(p_signup_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'bio_trial', 'public'
AS $function$
BEGIN
  IF NOT bio_trial.is_vendor() THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  UPDATE bio_trial.signups
  SET farmer_telegram_chat_id = NULL,
      farmer_linked_at        = NULL
  WHERE id = p_signup_id;
END$function$;

-- =============================================================
-- 8. Grants — farmer RPCs are anon-callable (token is the gate).
--    Vendor RPCs require authenticated + vendor_users row (gated inside).
-- =============================================================
GRANT EXECUTE ON FUNCTION public.farmer_verify_token(text)                           TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.farmer_bootstrap(text)                              TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.farmer_upsert_field(text, jsonb)                    TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.farmer_register_event(text, text, uuid, jsonb, text[], boolean)
                                                                                     TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.vendor_mint_farmer_token(uuid)                      TO authenticated;
GRANT EXECUTE ON FUNCTION public.vendor_list_trial_events(uuid)                      TO authenticated;
GRANT EXECUTE ON FUNCTION public.vendor_unbind_farmer_telegram(uuid)                 TO authenticated;
