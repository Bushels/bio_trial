-- Split the single "Provinces / States" plaque into two separate tiles on the
-- public dashboard: one counts distinct Canadian provinces, the other counts
-- distinct US states. province_state is stored free-text like "SK — Saskatchewan"
-- / "ND — North Dakota", so we classify on the 2-letter prefix.
--
-- provinces_count is preserved in the JSON (older frontends still read it) but
-- its meaning narrows from "distinct province_state values" to "distinct CA
-- provinces only". A new states_count is added alongside. Both feed separate
-- plaques in trial.html.
--
-- Forward-only + idempotent. Only the headline block of get_trial_dashboard
-- changes vs. 20260420000007_yield_field_required_and_hide_tiered.sql.

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
  select coalesce(jsonb_agg(c order by c), '[]'::jsonb)
    into v_crops_list
  from (
    select distinct lower(c) as c
    from bio_trial.signups, unnest(crops) as c
    where c is not null
      and c <> ''
      and lower(c) <> 'other'
  ) distinct_crops;

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

  -- Classify each signup's province_state into 'CA' (Canadian province) or
  -- 'US' (US state) by the 2-letter prefix. Anything unrecognised falls into
  -- 'US' by default -- the signup form code-prefixes both groups so this
  -- matches real data without a separate country column.
  with signup_region as (
    select
      s.id,
      s.acres,
      s.province_state,
      case
        when substr(s.province_state, 1, 2) in
          ('AB','BC','MB','NB','NL','NS','ON','PE','QC','SK','NT','NU','YT')
          then 'CA'
        else 'US'
      end as region_kind
    from bio_trial.signups s
  )
  select jsonb_build_object(
    'acres_enrolled',     coalesce(sum(acres), 0),
    'farms_count',        count(distinct id),
    'provinces_count',    count(distinct province_state) filter (where region_kind = 'CA'),
    'states_count',       count(distinct province_state) filter (where region_kind = 'US'),
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
  from signup_region;

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

  -- See 20260420000007 for why aggregates_by_tier stays empty.
  v_aggregates_by_tier := '[]'::jsonb;

  -- Province/state-only activity feed (last 20).
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
  'Public trial scoreboard. provinces_count = distinct CA provinces, states_count = distinct US states (split on 2-letter prefix of signups.province_state). aggregates_by_tier stays empty until role-aware delta math lands.';
