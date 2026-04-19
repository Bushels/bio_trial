-- Bio trial functions
-- Extracted from Bushel Board 2026-04-19. Apply BEFORE the RLS migration
-- (20260419000002_bio_trial_rls.sql) since policies reference bio_trial.is_vendor().

-- =============================================================
-- bio_trial.is_vendor() — true if caller is an authenticated user
-- whose auth.uid() appears in bio_trial.vendor_users
-- =============================================================
CREATE OR REPLACE FUNCTION bio_trial.is_vendor()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'bio_trial', 'public'
AS $function$
  select exists (select 1 from bio_trial.vendor_users where user_id = auth.uid());
$function$;

-- =============================================================
-- bio_trial.total_trial_acres() — sum(acres) across active statuses
-- (Kept for parity with source project; not called by frontend.)
-- =============================================================
CREATE OR REPLACE FUNCTION bio_trial.total_trial_acres()
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'bio_trial', 'public'
AS $function$
  select coalesce(sum(acres), 0)::int
  from bio_trial.signups
  where status in ('new','contacted','approved','shipped','completed');
$function$;

-- =============================================================
-- public.get_bio_trial_acres() — odometer read, anon-callable
-- =============================================================
CREATE OR REPLACE FUNCTION public.get_bio_trial_acres()
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'bio_trial'
AS $function$
  select coalesce(sum(acres), 0)::int
  from bio_trial.signups
  where status in ('new','contacted','approved','shipped','completed');
$function$;

-- =============================================================
-- public.submit_bio_trial_signup(payload jsonb) — anon-callable signup insert,
-- returns new acres total in a single round trip. $2.80/ac is server-authoritative.
-- =============================================================
CREATE OR REPLACE FUNCTION public.submit_bio_trial_signup(payload jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'bio_trial'
AS $function$
declare
  new_total integer;
  v_crops   text[];
  v_method  text;
  v_price_cents integer := 280;  -- $2.80 per acre, server-authoritative
begin
  v_method := payload->>'logistics_method';
  if v_method is not null and v_method not in ('pickup_fob_calgary','ship') then
    raise exception 'invalid logistics_method: %', v_method;
  end if;

  if v_method = 'ship' then
    if coalesce(trim(payload->>'delivery_street'), '') = ''
       or coalesce(trim(payload->>'delivery_city'), '') = ''
       or coalesce(trim(payload->>'delivery_postal'), '') = '' then
      raise exception 'shipping address required when logistics_method is ship';
    end if;
  end if;

  select array_agg(value) into v_crops
  from jsonb_array_elements_text(payload->'crops');

  insert into bio_trial.signups (
    name, farm_name, email, phone, province_state, rm_county,
    crops, crops_other, acres, source,
    logistics_method, delivery_street, delivery_city, delivery_postal,
    price_per_acre_cents
  ) values (
    trim(payload->>'name'),
    trim(payload->>'farm_name'),
    lower(trim(payload->>'email')),
    nullif(trim(payload->>'phone'), ''),
    upper(trim(payload->>'province_state')),
    nullif(trim(payload->>'rm_county'), ''),
    v_crops,
    nullif(trim(payload->>'crops_other'), ''),
    (payload->>'acres')::integer,
    nullif(trim(payload->>'source'), ''),
    v_method,
    nullif(trim(payload->>'delivery_street'), ''),
    nullif(trim(payload->>'delivery_city'), ''),
    nullif(trim(payload->>'delivery_postal'), ''),
    v_price_cents
  );

  select coalesce(sum(acres), 0)::int into new_total
  from bio_trial.signups
  where status in ('new','contacted','approved','shipped','completed');

  return new_total;
end; $function$;

-- =============================================================
-- public.list_bio_trial_signups() — vendor-gated read, returns jsonb array
-- =============================================================
CREATE OR REPLACE FUNCTION public.list_bio_trial_signups()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'bio_trial'
AS $function$
declare
  rows jsonb;
begin
  if not bio_trial.is_vendor() then
    raise exception 'not authorised' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(row_json order by created_at desc), '[]'::jsonb)
  into rows
  from (
    select
      created_at,
      jsonb_build_object(
        'id', id,
        'created_at', created_at,
        'name', name,
        'farm_name', farm_name,
        'email', email,
        'phone', phone,
        'province_state', province_state,
        'rm_county', rm_county,
        'crops', crops,
        'crops_other', crops_other,
        'acres_requested', acres,
        'logistics_method', logistics_method,
        'delivery_street', delivery_street,
        'delivery_city', delivery_city,
        'delivery_postal', delivery_postal,
        'status', status,
        'payment_status', payment_status,
        'payment_confirmed_at', payment_confirmed_at,
        'liters_purchased', liters_purchased,
        'acres_from_liters',
            case when liters_purchased is not null
                 then (liters_purchased * 2)::numeric
                 else null end,
        'product_shipped_at', product_shipped_at,
        'product_delivered_at', product_delivered_at,
        'access_granted_at', access_granted_at,
        'vendor_notes', vendor_notes
      ) as row_json
    from bio_trial.signups
  ) s;

  return rows;
end;
$function$;

-- =============================================================
-- public.vendor_update_bio_trial_signup(p_signup_id uuid, p_patch jsonb)
-- Idempotent partial update. Timestamps stamp on false->true transitions;
-- status is derived from effective state (completed > shipped > approved > new).
-- =============================================================
CREATE OR REPLACE FUNCTION public.vendor_update_bio_trial_signup(p_signup_id uuid, p_patch jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'bio_trial'
AS $function$
declare
  v_row bio_trial.signups%rowtype;
  v_paid boolean;
  v_liters numeric;
  v_delivered boolean;
  v_shipped boolean;
  v_notes text;
  v_allowed_keys constant text[] := array['paid','liters','delivered','shipped','notes'];
  k text;

  -- Effective post-update values. Populated by merging the patch over v_row.
  v_eff_payment_status text;
  v_eff_payment_confirmed_at timestamptz;
  v_eff_liters_purchased numeric;
  v_eff_product_shipped_at timestamptz;
  v_eff_product_delivered_at timestamptz;
  v_eff_access_granted_at timestamptz;
  v_eff_vendor_notes text;
  v_new_status text;
begin
  if not bio_trial.is_vendor() then
    raise exception 'not authorised' using errcode = '42501';
  end if;

  -- Fail closed on unknown keys so typos don't silently become no-ops.
  for k in select jsonb_object_keys(coalesce(p_patch, '{}'::jsonb)) loop
    if not (k = any(v_allowed_keys)) then
      raise exception 'unknown patch key: %', k using errcode = '22023';
    end if;
  end loop;

  v_paid      := case when p_patch ? 'paid'      then (p_patch->>'paid')::boolean      end;
  v_liters    := case when p_patch ? 'liters'    then (p_patch->>'liters')::numeric    end;
  v_delivered := case when p_patch ? 'delivered' then (p_patch->>'delivered')::boolean end;
  v_shipped   := case when p_patch ? 'shipped'   then (p_patch->>'shipped')::boolean   end;
  v_notes     := case when p_patch ? 'notes'     then p_patch->>'notes'                end;

  if v_liters is not null and v_liters < 0 then
    raise exception 'liters must be >= 0';
  end if;

  -- Row lock prevents concurrent vendor updates from interleaving their
  -- effective-state computations against the same signup.
  select * into v_row from bio_trial.signups where id = p_signup_id for update;
  if not found then
    raise exception 'signup not found: %', p_signup_id;
  end if;

  if p_patch ? 'paid' then
    v_eff_payment_status := case when v_paid then 'paid' else 'pending' end;
    v_eff_payment_confirmed_at := case
      when v_paid and v_row.payment_confirmed_at is null then now()
      when v_paid then v_row.payment_confirmed_at
      else null
    end;
  else
    v_eff_payment_status := v_row.payment_status;
    v_eff_payment_confirmed_at := v_row.payment_confirmed_at;
  end if;

  v_eff_liters_purchased := case when p_patch ? 'liters' then v_liters else v_row.liters_purchased end;

  if p_patch ? 'shipped' then
    v_eff_product_shipped_at := case
      when v_shipped and v_row.product_shipped_at is null then now()
      when v_shipped then v_row.product_shipped_at
      else null
    end;
  else
    v_eff_product_shipped_at := v_row.product_shipped_at;
  end if;

  if p_patch ? 'delivered' then
    v_eff_product_delivered_at := case
      when v_delivered and v_row.product_delivered_at is null then now()
      when v_delivered then v_row.product_delivered_at
      else null
    end;
    v_eff_access_granted_at := case
      when v_delivered and v_row.access_granted_at is null then now()
      when v_delivered then v_row.access_granted_at
      else null
    end;
  else
    v_eff_product_delivered_at := v_row.product_delivered_at;
    v_eff_access_granted_at    := v_row.access_granted_at;
  end if;

  v_eff_vendor_notes := case when p_patch ? 'notes' then v_notes else v_row.vendor_notes end;

  v_new_status := case
    when v_eff_product_delivered_at is not null then 'completed'
    when v_eff_product_shipped_at   is not null then 'shipped'
    when v_eff_payment_status = 'paid'          then 'approved'
    else 'new'
  end;

  update bio_trial.signups set
    payment_status       = v_eff_payment_status,
    payment_confirmed_at = v_eff_payment_confirmed_at,
    liters_purchased     = v_eff_liters_purchased,
    product_shipped_at   = v_eff_product_shipped_at,
    product_delivered_at = v_eff_product_delivered_at,
    access_granted_at    = v_eff_access_granted_at,
    status               = v_new_status,
    vendor_notes         = v_eff_vendor_notes
  where id = p_signup_id
  returning * into v_row;

  return jsonb_build_object(
    'id', v_row.id,
    'payment_status', v_row.payment_status,
    'payment_confirmed_at', v_row.payment_confirmed_at,
    'liters_purchased', v_row.liters_purchased,
    'acres_from_liters',
        case when v_row.liters_purchased is not null
             then (v_row.liters_purchased * 2)::numeric
             else null end,
    'product_shipped_at', v_row.product_shipped_at,
    'product_delivered_at', v_row.product_delivered_at,
    'access_granted_at', v_row.access_granted_at,
    'status', v_row.status,
    'vendor_notes', v_row.vendor_notes
  );
end;
$function$;
