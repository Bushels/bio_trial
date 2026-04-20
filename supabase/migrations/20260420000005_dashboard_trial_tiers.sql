-- Trial-type rigor tiers on the public scoreboard (Codex item #3a).
--
-- Cooperator spec §5 defines 5 trial designs with very different statistical
-- strength:
--
--   STRIP / SPLIT            → paired comparison inside the same field
--                              (highest rigor — isolates treatment effect)
--   WHOLE_HISTORICAL /       → whole field vs an external reference
--   WHOLE_NEIGHBOR             (medium rigor — confounded by year/field effects)
--   OBSERVATIONAL            → single-plot observation, no check
--                              (lowest rigor — directional only)
--
-- Previously get_trial_dashboard() averaged every yield event into one number
-- per crop, which lies to readers by mixing tiers. This migration replaces the
-- function so it:
--
--   1. Adds rigor_tier_counts to headline (how many fields in each tier,
--      including "undeclared" for fields with NULL trial_type).
--   2. Emits aggregates_by_tier — per (crop, tier) yield averages, each still
--      gated by the ≥ 3-farm privacy floor. The flat aggregates output stays
--      so the existing trial.html ledger doesn't break.
--   3. Leaves activity/photos/crops_list alone.
--
-- Rigor tier mapping (kept in one place so the frontend mirrors it):
--   controlled   → STRIP, SPLIT
--   referenced   → WHOLE_HISTORICAL, WHOLE_NEIGHBOR
--   observational→ OBSERVATIONAL
--   undeclared   → NULL / missing trial_type
--
-- Forward-only + idempotent — safe to re-run.

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
  -- We bucket NULL/unknown trial_type as 'undeclared' so the four keys are
  -- always present (UI can render a 0 without guarding for missing keys).
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
  select jsonb_build_object(
    'acres_enrolled',     coalesce(sum(s.acres), 0),
    'farms_count',        count(distinct s.id),
    'provinces_count',    count(distinct s.province_state),
    'crops_count',        jsonb_array_length(v_crops_list),
    'applications_count', (select count(*) from bio_trial.trial_events where kind = 'application'),
    'yields_count',       (select count(*) from bio_trial.trial_events where kind = 'yield'),
    'soil_tests_count',   (select count(*) from bio_trial.trial_events where kind = 'soil_test'),
    'observations_count', (select count(*) from bio_trial.trial_events where kind = 'observation'),
    'photos_count',       (select count(*) from bio_trial.trial_events
                           where kind = 'photo' and public_opt_in = true),
    'fields_count',       (select count(*) from bio_trial.trial_fields),
    'farms_with_yields_count',
      (select count(distinct signup_id) from bio_trial.trial_events where kind = 'yield'),
    'rigor_tier_counts',  v_rigor_counts
  ) into v_headline
  from bio_trial.signups s;

  -- Per-crop yield aggregates (flat, legacy shape kept for existing UI).
  -- NOTE: this mixes tiers and will be deprecated once trial.js consumes
  -- aggregates_by_tier. We keep the ≥ 3-farm floor here unchanged.
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

  -- Per-(crop, tier) yield aggregates — the rigor-aware version.
  -- Each (crop, tier) bucket is independently privacy-gated (≥ 3 farms).
  -- A tier with only 1-2 farms is suppressed rather than merged into a
  -- looser tier — suppression is safer than aggregation for re-identification.
  with yield_events_tiered as (
    select f.crop,
           case
             when f.trial_type in ('STRIP','SPLIT') then 'controlled'
             when f.trial_type in ('WHOLE_HISTORICAL','WHOLE_NEIGHBOR') then 'referenced'
             when f.trial_type = 'OBSERVATIONAL' then 'observational'
             else 'undeclared'
           end as tier,
           e.signup_id,
           (e.payload->>'bu_per_ac')::numeric as bu_per_ac
    from bio_trial.trial_events e
    join bio_trial.trial_fields f on f.id = e.field_id
    where e.kind = 'yield'
      and (e.payload->>'bu_per_ac') ~ '^[0-9]+(\.[0-9]+)?$'
      and f.crop is not null
  ),
  crop_tier_groups as (
    select crop,
           tier,
           count(distinct signup_id) as farms,
           round(avg(bu_per_ac), 1)  as avg_yield
    from yield_events_tiered
    group by crop, tier
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'crop',      crop,
      'tier',      tier,
      'avg_yield', avg_yield,
      'farms',     farms
    ) order by crop, tier
  ), '[]'::jsonb) into v_aggregates_by_tier
  from crop_tier_groups
  where farms >= v_floor;

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

-- Grants (re-applied defensively — CREATE OR REPLACE drops privileges on some
-- versions, and we want the anon/auth roles to keep read access).
GRANT EXECUTE ON FUNCTION public.get_trial_dashboard() TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.get_trial_dashboard() IS
  'Public trial scoreboard. Adds rigor_tier_counts (controlled/referenced/observational/undeclared) to headline and aggregates_by_tier so the ledger can show yields segmented by trial rigor. All per-crop and per-(crop,tier) aggregates enforce a ≥ 3-farm privacy floor.';
