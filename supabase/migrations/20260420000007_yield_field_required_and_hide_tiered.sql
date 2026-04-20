-- Codex next-audit P1 fixes:
--
--   1. Require field_id when kind='yield' at the RPC boundary. Without a
--      field the yield can't land in any (crop, tier) bucket in
--      get_trial_dashboard (the aggregates query joins trial_fields), yet
--      the old code was still counting it in the headline "Yield reports"
--      tile. Two sides of the public scoreboard disagreed. Enforcing
--      server-side here (in addition to the farmer.js form guard) makes
--      the invariant a hard one, not a polite-UI one.
--
--   2. Tighten headline yields_count so it ONLY counts field-linked yield
--      events — matches what the aggregate query actually uses. The tile
--      was inflated by orphan rows; if any exist today they silently drop
--      out of the public number here.
--
--   3. Hide aggregates_by_tier from the public RPC output for launch.
--      The prior version averaged raw bu_per_ac per (crop, tier) without
--      joining trial_plots.role, so STRIP/SPLIT trials published a
--      blended treated+check mean under "Controlled" — a number that
--      looks like a treatment effect but is not. Until we build
--      role-aware delta math (treated − check per field, then average of
--      deltas across farms with privacy floor), we return an empty array
--      so the frontend falls back to the flat aggregates table.
--
-- Forward-only + idempotent. Re-applies grants defensively.

-- =============================================================
-- farmer_register_event — require field_id when kind = 'yield'
-- =============================================================
-- Same 7-arg signature as 20260420000004_trial_types_rpcs.sql. We
-- CREATE OR REPLACE rather than DROP+CREATE so existing grants stick.

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

  -- NEW: yield events MUST be attributed to a field. Without a field_id
  -- the event can't enter any crop/tier bucket on the scoreboard (the
  -- aggregate join drops field-less rows), but the headline tile was
  -- still counting it. Close the gate here so no future caller can open
  -- the disagreement back up.
  IF p_kind = 'yield' AND p_field_id IS NULL THEN
    RAISE EXCEPTION 'yield events require a field_id (cannot be signup-level)';
  END IF;

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

GRANT EXECUTE ON FUNCTION public.farmer_register_event(text, text, uuid, jsonb, text[], boolean, uuid)
  TO anon, authenticated;

COMMENT ON FUNCTION public.farmer_register_event(text, text, uuid, jsonb, text[], boolean, uuid) IS
  'Farmer-authored trial event. Requires p_field_id when p_kind = ''yield'' so the event is always placeable in the per-crop/per-tier aggregate (Codex next-audit P1).';

-- =============================================================
-- get_trial_dashboard — tighten yields_count, hide tiered aggregates
-- =============================================================
CREATE OR REPLACE FUNCTION public.get_trial_dashboard()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'bio_trial'
AS $function$
declare
  v_headline            jsonb;
  v_aggregates          jsonb;
  v_aggregates_by_tier  jsonb;
  v_activity            jsonb;
  v_photos              jsonb;
  v_crops_list          jsonb;
  v_rigor_counts        jsonb;
  v_floor               int := 3;
begin
  -- Distinct crops (signup intent), excluding the catch-all 'other' token.
  select coalesce(jsonb_agg(c order by c), '[]'::jsonb)
    into v_crops_list
  from (
    select distinct lower(c) as c
    from bio_trial.signups, unnest(crops) as c
    where c is not null
      and c <> ''
      and lower(c) <> 'other'
  ) distinct_crops;

  -- Rigor-tier counts — how many declared fields sit in each tier.
  with tiered as (
    select case
             when trial_type in ('STRIP','SPLIT') then 'controlled'
             when trial_type in ('WHOLE_HISTORICAL','WHOLE_NEIGHBOR') then 'referenced'
             when trial_type = 'OBSERVATIONAL' then 'observational'
             else 'undeclared'
           end as tier
    from bio_trial.trial_fields
  )
  select jsonb_build_object(
    'controlled',    coalesce(sum(case when tier = 'controlled'    then 1 else 0 end), 0),
    'referenced',    coalesce(sum(case when tier = 'referenced'    then 1 else 0 end), 0),
    'observational', coalesce(sum(case when tier = 'observational' then 1 else 0 end), 0),
    'undeclared',    coalesce(sum(case when tier = 'undeclared'    then 1 else 0 end), 0)
  ) into v_rigor_counts
  from tiered;

  -- Headline counts — scale indicators plus per-kind activity tallies.
  -- yields_count now requires field_id so it matches the aggregate query's
  -- scope (both sides drop orphan field-less yields). Pre-existing orphan
  -- rows, if any, silently exit the public tile here.
  select jsonb_build_object(
    'acres_enrolled',     coalesce(sum(s.acres), 0),
    'farms_count',        count(distinct s.id),
    'provinces_count',    count(distinct s.province_state),
    'crops_count',        jsonb_array_length(v_crops_list),
    'applications_count', (select count(*) from bio_trial.trial_events where kind = 'application'),
    'yields_count',       (select count(*) from bio_trial.trial_events
                           where kind = 'yield' and field_id is not null),
    'soil_tests_count',   (select count(*) from bio_trial.trial_events where kind = 'soil_test'),
    'observations_count', (select count(*) from bio_trial.trial_events where kind = 'observation'),
    'photos_count',       (select count(*) from bio_trial.trial_events
                           where kind = 'photo' and public_opt_in = true),
    'fields_count',       (select count(*) from bio_trial.trial_fields),
    'farms_with_yields_count',
      (select count(distinct signup_id) from bio_trial.trial_events
       where kind = 'yield' and field_id is not null),
    'rigor_tier_counts',  v_rigor_counts
  ) into v_headline
  from bio_trial.signups s;

  -- Per-crop yield aggregates (flat, legacy shape kept for existing UI).
  -- Still mixes treated+check inside STRIP/SPLIT fields — this is the known
  -- limitation the tiered version was meant to fix, and still the known
  -- limitation until role-aware math lands. The ≥ 3-farm privacy floor
  -- stays in place.
  with yield_events as (
    select f.crop,
           e.signup_id,
           (e.payload->>'bu_per_ac')::numeric as bu_per_ac
    from bio_trial.trial_events e
    join bio_trial.trial_fields f on f.id = e.field_id
    where e.kind = 'yield'
      and (e.payload->>'bu_per_ac') ~ '^[0-9]+(\.[0-9]+)?$'
  ),
  crop_groups as (
    select crop,
           count(distinct signup_id) as farms,
           round(avg(bu_per_ac), 1)  as avg_yield
    from yield_events
    where crop is not null
    group by crop
  )
  select coalesce(jsonb_agg(
    jsonb_build_object('crop', crop, 'avg_yield', avg_yield, 'farms', farms)
    order by crop
  ), '[]'::jsonb) into v_aggregates
  from crop_groups
  where farms >= v_floor;

  -- aggregates_by_tier is INTENTIONALLY empty for launch.
  --
  -- The v1 implementation of this block (in 20260420000005) averaged raw
  -- bu_per_ac per (crop, tier) without joining trial_plots.role. For a
  -- STRIP or SPLIT trial that means the "Controlled" tier mean mixed
  -- treated-plot and check-plot yields into one blended number — a
  -- figure that reads like a treatment effect but isn't. Codex flagged
  -- this as a public-dashboard honesty bug.
  --
  -- A correct implementation is non-trivial: for each field, compute
  -- (avg treated yield) − (avg check yield), including virtual checks
  -- for WHOLE_HISTORICAL/WHOLE_NEIGHBOR, then average those per-field
  -- deltas across farms with the ≥ 3-farm privacy floor. Observational
  -- trials have no check so they can't produce a delta at all. That
  -- belongs in its own migration with its own review.
  --
  -- Until then we return an empty array. trial.js sees the empty tiered
  -- list and falls back to the flat aggregates table (which still
  -- carries the same treated+check blend issue for STRIP/SPLIT, but
  -- doesn't label the number as a tier-specific claim).
  v_aggregates_by_tier := '[]'::jsonb;

  -- Province-only activity feed (last 20).
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'kind',       a.kind,
      'province',   a.province_state,
      'crop',       a.crop,
      'created_at', a.created_at
    ) order by a.created_at desc
  ), '[]'::jsonb) into v_activity
  from (
    select e.kind,
           s.province_state,
           f.crop,
           e.created_at
    from bio_trial.trial_events e
    join bio_trial.signups s on s.id = e.signup_id
    left join bio_trial.trial_fields f on f.id = e.field_id
    order by e.created_at desc
    limit 20
  ) a;

  -- Public opt-in photos (farmer consent required).
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'created_at', sub.created_at,
      'file_urls',  sub.file_urls,
      'caption',    sub.caption,
      'province',   sub.province_state,
      'crop',       sub.crop
    ) order by sub.created_at desc
  ), '[]'::jsonb) into v_photos
  from (
    select e.created_at,
           e.file_urls,
           e.payload->>'caption' as caption,
           s.province_state,
           f.crop
    from bio_trial.trial_events e
    join bio_trial.signups s on s.id = e.signup_id
    left join bio_trial.trial_fields f on f.id = e.field_id
    where e.kind = 'photo' and e.public_opt_in = true
    order by e.created_at desc
    limit 30
  ) sub;

  return jsonb_build_object(
    'headline',            v_headline,
    'crops_list',          v_crops_list,
    'aggregates',          v_aggregates,
    'aggregates_by_tier',  v_aggregates_by_tier,
    'activity',            v_activity,
    'photos',              v_photos,
    'privacy_floor',       v_floor
  );
end;
$function$;

GRANT EXECUTE ON FUNCTION public.get_trial_dashboard() TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.get_trial_dashboard() IS
  'Public trial scoreboard. yields_count excludes field-less yields (matches the aggregate query''s scope). aggregates_by_tier is intentionally empty until role-aware treated-vs-check delta math is implemented (Codex next-audit P1).';
