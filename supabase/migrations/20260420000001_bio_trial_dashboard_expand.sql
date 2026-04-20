-- Expand public.get_trial_dashboard() to surface every kind of trial data we
-- capture: crop count (derived from signups.crops), a public-safe crops list,
-- photo / field / yield-farm counters that power the richer Ledger design.
--
-- All additions are privacy-safe:
--   * crops_list — distinct crop tokens from signups.crops, no farm identifiers
--   * *_count    — simple counts, no per-farm detail
-- The per-crop yield table still enforces the ≥ 3-farm privacy floor.

CREATE OR REPLACE FUNCTION public.get_trial_dashboard()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'bio_trial'
AS $function$
declare
  v_headline   jsonb;
  v_aggregates jsonb;
  v_activity   jsonb;
  v_photos     jsonb;
  v_crops_list jsonb;
  v_floor      int := 3;
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
      (select count(distinct signup_id) from bio_trial.trial_events where kind = 'yield')
  ) into v_headline
  from bio_trial.signups s;

  -- Per-crop yield aggregates (≥ 3 farms per crop).
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
    'headline',      v_headline,
    'crops_list',    v_crops_list,
    'aggregates',    v_aggregates,
    'activity',      v_activity,
    'photos',        v_photos,
    'privacy_floor', v_floor
  );
end;
$function$;
