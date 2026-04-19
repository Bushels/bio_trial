-- Bio trial notification trigger — fires pg_net POST to edge function on INSERT
-- Requires vault entries bio_trial_fn_url and bio_trial_webhook_secret (set
-- manually after this migration; see docs/plans/2026-04-19-bio-trial-standalone-plan.md).

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION bio_trial.notify_signup_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'vault'
AS $function$
DECLARE
  v_url text;
  v_secret text;
  v_payload jsonb;
  v_request_id bigint;
BEGIN
  SELECT decrypted_secret INTO v_url
    FROM vault.decrypted_secrets
    WHERE name = 'bio_trial_fn_url'
    LIMIT 1;

  SELECT decrypted_secret INTO v_secret
    FROM vault.decrypted_secrets
    WHERE name = 'bio_trial_webhook_secret'
    LIMIT 1;

  IF v_url IS NULL THEN
    RAISE WARNING 'bio_trial.notify_signup_insert: bio_trial_fn_url missing from vault; skipping notification';
    RETURN NEW;
  END IF;

  v_payload := jsonb_build_object(
    'type',   'INSERT',
    'schema', TG_TABLE_SCHEMA,
    'table',  TG_TABLE_NAME,
    'record', to_jsonb(NEW),
    'old_record', NULL
  );

  SELECT net.http_post(
    url     := v_url,
    body    := v_payload,
    headers := jsonb_build_object(
      'Content-Type',    'application/json',
      'X-Webhook-Secret', COALESCE(v_secret, ''),
      'X-Source',        'bio_trial.signups'
    ),
    timeout_milliseconds := 5000
  ) INTO v_request_id;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never block the signup insert if the notification fails.
  RAISE WARNING 'bio_trial.notify_signup_insert failed: % / %', SQLSTATE, SQLERRM;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_signups_notify
  AFTER INSERT ON bio_trial.signups
  FOR EACH ROW
  EXECUTE FUNCTION bio_trial.notify_signup_insert();
