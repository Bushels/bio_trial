-- RPCs for trial_type declaration + plot management, plus payload extension
-- of farmer_bootstrap and farmer_register_event (Codex item #3a follow-up).
--
-- Design notes:
--   * farmer_set_trial_type is write-one-then-read-after: it records the type
--     and, if no plots exist yet for the field, creates a sensible default set
--     the farmer can rename/refine later. It never destroys existing plots, so
--     re-calling with a different type on a field with plots is safe but won't
--     reshape them — the farmer has to delete/edit explicitly.
--   * farmer_upsert_plot is the escape hatch for farmers who want >2 strips or
--     custom labels. Virtual plots (is_virtual=true) can only be created via
--     the set_trial_type defaulting path — farmers don't hand-edit check
--     references because they feed scoreboard math.
--   * farmer_register_event gains p_plot_id so yield/application events can be
--     attributed to a specific plot. Required for strip/split delta math.
--   * farmer_bootstrap now returns plots alongside fields/events.

-- =============================================================
-- farmer_set_trial_type — declares type + creates default plots
-- =============================================================
CREATE OR REPLACE FUNCTION public.farmer_set_trial_type(
  p_token    text,
  p_field_id uuid,
  p_type     text,
  p_extras   jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'bio_trial', 'public'
AS $function$
DECLARE
  v_signup_id  uuid;
  v_field      bio_trial.trial_fields;
  v_existing   int;
  v_historical numeric;
  v_neighbor   text;
BEGIN
  v_signup_id := bio_trial.verify_farmer_jwt(p_token);

  IF p_type IS NULL OR NOT (p_type = ANY (ARRAY['STRIP','SPLIT','WHOLE_HISTORICAL','WHOLE_NEIGHBOR','OBSERVATIONAL'])) THEN
    RAISE EXCEPTION 'invalid trial_type: %', p_type;
  END IF;

  SELECT * INTO v_field
  FROM bio_trial.trial_fields
  WHERE id = p_field_id AND signup_id = v_signup_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'field not found for this signup';
  END IF;

  v_historical := nullif(p_extras->>'historical_yield_bu_per_ac','')::numeric;
  v_neighbor   := nullif(p_extras->>'neighbor_field_notes','');

  IF p_type = 'WHOLE_HISTORICAL' AND v_historical IS NULL THEN
    RAISE EXCEPTION 'WHOLE_HISTORICAL requires historical_yield_bu_per_ac in p_extras';
  END IF;

  IF p_type = 'WHOLE_NEIGHBOR' AND v_neighbor IS NULL THEN
    RAISE EXCEPTION 'WHOLE_NEIGHBOR requires neighbor_field_notes in p_extras';
  END IF;

  UPDATE bio_trial.trial_fields SET
    trial_type                 = p_type,
    historical_yield_bu_per_ac = COALESCE(v_historical, historical_yield_bu_per_ac),
    historical_years_source    = COALESCE(nullif(p_extras->>'historical_years_source',''), historical_years_source),
    neighbor_field_notes       = COALESCE(v_neighbor, neighbor_field_notes),
    trial_type_declared_at     = COALESCE(trial_type_declared_at, now())
  WHERE id = p_field_id;

  -- Only seed default plots if the farmer hasn't created any yet.
  SELECT count(*) INTO v_existing FROM bio_trial.trial_plots WHERE field_id = p_field_id;
  IF v_existing = 0 THEN
    IF p_type = 'STRIP' THEN
      INSERT INTO bio_trial.trial_plots (field_id, role, label, acres) VALUES
        (p_field_id, 'treated', 'Treated strip 1',   NULL),
        (p_field_id, 'check',   'Untreated strip 1', NULL);
    ELSIF p_type = 'SPLIT' THEN
      INSERT INTO bio_trial.trial_plots (field_id, role, label, acres) VALUES
        (p_field_id, 'treated', 'Treated half',   NULL),
        (p_field_id, 'check',   'Untreated half', NULL);
    ELSIF p_type = 'WHOLE_HISTORICAL' THEN
      INSERT INTO bio_trial.trial_plots (field_id, role, label, acres, is_virtual, historical_yield_bu_per_ac) VALUES
        (p_field_id, 'treated', 'Whole field (treated)',           v_field.acres, false, NULL),
        (p_field_id, 'check',   'Historical yield average (check)', NULL,         true,  v_historical);
    ELSIF p_type = 'WHOLE_NEIGHBOR' THEN
      INSERT INTO bio_trial.trial_plots (field_id, role, label, acres, is_virtual, neighbor_reference) VALUES
        (p_field_id, 'treated', 'Whole field (treated)',        v_field.acres, false, NULL),
        (p_field_id, 'check',   'Neighbor field (untreated)',    NULL,         true,  v_neighbor);
    ELSE  -- OBSERVATIONAL: single treated plot, no check.
      INSERT INTO bio_trial.trial_plots (field_id, role, label, acres) VALUES
        (p_field_id, 'treated', 'Whole field (treated)', v_field.acres);
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'field_id',   p_field_id,
    'trial_type', p_type,
    'plots',      (
      SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY p.created_at), '[]'::jsonb)
      FROM bio_trial.trial_plots p WHERE p.field_id = p_field_id
    )
  );
END$function$;

-- =============================================================
-- farmer_upsert_plot — add/edit a physical plot (not virtual ones)
-- =============================================================
CREATE OR REPLACE FUNCTION public.farmer_upsert_plot(p_token text, p_patch jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'bio_trial', 'public'
AS $function$
DECLARE
  v_signup_id uuid;
  v_plot_id   uuid;
  v_field_id  uuid;
  v_row       bio_trial.trial_plots;
  v_field_ok  boolean;
BEGIN
  v_signup_id := bio_trial.verify_farmer_jwt(p_token);

  v_plot_id  := nullif(p_patch->>'id','')::uuid;
  v_field_id := nullif(p_patch->>'field_id','')::uuid;

  IF v_plot_id IS NULL THEN
    IF v_field_id IS NULL THEN
      RAISE EXCEPTION 'field_id required to create a plot';
    END IF;
    SELECT EXISTS (
      SELECT 1 FROM bio_trial.trial_fields
      WHERE id = v_field_id AND signup_id = v_signup_id
    ) INTO v_field_ok;
    IF NOT v_field_ok THEN
      RAISE EXCEPTION 'field does not belong to this signup';
    END IF;
    IF nullif(p_patch->>'role','') IS NULL OR nullif(p_patch->>'label','') IS NULL THEN
      RAISE EXCEPTION 'role and label are required';
    END IF;

    INSERT INTO bio_trial.trial_plots (field_id, role, label, acres)
    VALUES (
      v_field_id,
      p_patch->>'role',
      p_patch->>'label',
      nullif(p_patch->>'acres','')::numeric
    )
    RETURNING * INTO v_row;
  ELSE
    -- Edit existing plot — farmer can only touch their own, and cannot flip is_virtual.
    UPDATE bio_trial.trial_plots SET
      label = coalesce(p_patch->>'label', label),
      acres = coalesce(nullif(p_patch->>'acres','')::numeric, acres),
      role  = coalesce(p_patch->>'role', role)
    WHERE id = v_plot_id
      AND field_id IN (SELECT id FROM bio_trial.trial_fields WHERE signup_id = v_signup_id)
      AND is_virtual = false
    RETURNING * INTO v_row;

    IF v_row IS NULL THEN
      RAISE EXCEPTION 'plot not found, not yours, or is virtual';
    END IF;
  END IF;

  RETURN to_jsonb(v_row);
END$function$;

-- =============================================================
-- farmer_register_event — add optional p_plot_id (ownership-checked)
-- =============================================================
-- The old 6-arg signature must be dropped explicitly: CREATE OR REPLACE
-- FUNCTION on a different arg list creates an OVERLOAD rather than
-- replacing, and PostgREST doesn't resolve overloads deterministically.
DROP FUNCTION IF EXISTS public.farmer_register_event(
  text, text, uuid, jsonb, text[], boolean
);

CREATE OR REPLACE FUNCTION public.farmer_register_event(
  p_token         text,
  p_kind          text,
  p_field_id      uuid,
  p_payload       jsonb,
  p_file_urls     text[],
  p_public_opt_in boolean DEFAULT false,
  p_plot_id       uuid    DEFAULT NULL
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
  v_plot_ok   boolean;
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

  IF p_plot_id IS NOT NULL THEN
    -- Plot must belong to a field on this signup, and if p_field_id is set, to that field.
    SELECT EXISTS (
      SELECT 1
      FROM bio_trial.trial_plots p
      JOIN bio_trial.trial_fields f ON f.id = p.field_id
      WHERE p.id = p_plot_id
        AND f.signup_id = v_signup_id
        AND (p_field_id IS NULL OR p.field_id = p_field_id)
        AND p.is_virtual = false
    ) INTO v_plot_ok;
    IF NOT v_plot_ok THEN
      RAISE EXCEPTION 'plot not found, not yours, belongs to a different field, or is virtual';
    END IF;
  END IF;

  INSERT INTO bio_trial.trial_events (
    signup_id, field_id, plot_id, kind, payload, source, file_urls, public_opt_in
  ) VALUES (
    v_signup_id,
    p_field_id,
    p_plot_id,
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
-- farmer_bootstrap — now returns plots alongside fields/events
-- =============================================================
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
  v_plots     jsonb;
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

  SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY p.field_id, p.created_at), '[]'::jsonb) INTO v_plots
  FROM bio_trial.trial_plots p
  JOIN bio_trial.trial_fields f ON f.id = p.field_id
  WHERE f.signup_id = v_signup_id;

  SELECT coalesce(jsonb_agg(to_jsonb(e) ORDER BY e.created_at DESC), '[]'::jsonb) INTO v_events
  FROM bio_trial.trial_events e
  WHERE e.signup_id = v_signup_id;

  SELECT farmer_telegram_chat_id IS NOT NULL INTO v_bound
  FROM bio_trial.signups WHERE id = v_signup_id;

  RETURN jsonb_build_object(
    'signup',         v_signup,
    'fields',         v_fields,
    'plots',          v_plots,
    'events',         v_events,
    'telegram_bound', v_bound
  );
END$function$;

-- =============================================================
-- Grants
-- =============================================================
GRANT EXECUTE ON FUNCTION public.farmer_set_trial_type(text, uuid, text, jsonb)    TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.farmer_upsert_plot(text, jsonb)                   TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.farmer_register_event(text, text, uuid, jsonb, text[], boolean, uuid)
                                                                                    TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.farmer_bootstrap(text)                            TO anon, authenticated;
