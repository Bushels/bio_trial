-- Bio trial schema + tables
-- Extracted from Bushel Board project (ibgsloyjxdopkvwqcqwh) 2026-04-19
-- See docs/plans/2026-04-19-bio-trial-standalone-design.md

CREATE SCHEMA IF NOT EXISTS bio_trial;

-- =============================================================
-- bio_trial.signups — farmer signup rows
-- =============================================================
CREATE TABLE bio_trial.signups (
  id                   uuid        NOT NULL DEFAULT gen_random_uuid(),
  created_at           timestamptz NOT NULL DEFAULT now(),
  name                 text        NOT NULL,
  farm_name            text        NOT NULL,
  email                text        NOT NULL,
  phone                text,
  province_state       text        NOT NULL,
  rm_county            text,
  crops                text[]      NOT NULL,
  crops_other          text,
  acres                integer     NOT NULL,
  status               text        NOT NULL DEFAULT 'new',
  source               text,
  notes                text,
  promoted_user_id     uuid,
  logistics_method     text,
  delivery_street      text,
  delivery_city        text,
  delivery_postal      text,
  payment_status       text        NOT NULL DEFAULT 'pending',
  payment_confirmed_at timestamptz,
  liters_purchased     numeric,
  price_per_acre_cents integer,
  product_shipped_at   timestamptz,
  product_delivered_at timestamptz,
  access_token         uuid                 DEFAULT gen_random_uuid(),
  access_granted_at    timestamptz,
  vendor_notes         text,
  CONSTRAINT signups_pkey             PRIMARY KEY (id),
  CONSTRAINT signups_access_token_key UNIQUE (access_token),
  CONSTRAINT signups_name_check             CHECK (length(TRIM(BOTH FROM name)) > 0),
  CONSTRAINT signups_farm_name_check        CHECK (length(TRIM(BOTH FROM farm_name)) > 0),
  CONSTRAINT signups_email_check            CHECK (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  CONSTRAINT signups_crops_check            CHECK (array_length(crops, 1) >= 1),
  CONSTRAINT signups_acres_check            CHECK (acres > 0 AND acres < 1000000),
  CONSTRAINT signups_status_check           CHECK (status        = ANY (ARRAY['new','contacted','approved','declined','shipped','completed'])),
  CONSTRAINT signups_payment_status_check   CHECK (payment_status = ANY (ARRAY['pending','paid','refunded'])),
  CONSTRAINT signups_logistics_method_check CHECK (logistics_method = ANY (ARRAY['pickup_fob_calgary','ship']))
);

COMMENT ON TABLE  bio_trial.signups                      IS 'Farmer trial signups. promoted_user_id links to auth.users after trial completion.';
COMMENT ON COLUMN bio_trial.signups.logistics_method     IS 'Chosen at signup: pickup_fob_calgary or ship. Drives whether delivery address is required.';
COMMENT ON COLUMN bio_trial.signups.product_delivered_at IS 'Set by vendor when farmer confirms receipt. Triggers access_granted_at and magic-link email.';
COMMENT ON COLUMN bio_trial.signups.access_token         IS 'Opaque token used in the farmer onboarding magic link. Not secret enough to replace auth, but sufficient for claim-based onboarding into Bushy.';

CREATE INDEX signups_created_at_idx     ON bio_trial.signups USING btree (created_at DESC);
CREATE INDEX signups_status_idx         ON bio_trial.signups USING btree (status);
CREATE INDEX signups_email_idx          ON bio_trial.signups USING btree (lower(email));
CREATE INDEX signups_payment_status_idx ON bio_trial.signups USING btree (payment_status);
CREATE INDEX signups_delivered_idx      ON bio_trial.signups USING btree (product_delivered_at);

-- =============================================================
-- bio_trial.vendor_users — allowlist of auth users with vendor access
-- =============================================================
CREATE TABLE bio_trial.vendor_users (
  user_id     uuid        NOT NULL,
  vendor_name text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vendor_users_pkey    PRIMARY KEY (user_id),
  CONSTRAINT vendor_users_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

COMMENT ON TABLE bio_trial.vendor_users IS 'Maps Supabase auth users to vendor access (e.g. SixRing). Presence of a row grants vendor-level dashboard access.';
