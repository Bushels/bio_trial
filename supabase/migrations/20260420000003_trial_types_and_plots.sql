-- Trial types + plots (Codex item #3a).
--
-- Per the cooperator spec (BioLift_Cooperator_Trial_Spec_v1.md §5 + §6.5):
--   * each field is its own trial and declares one of five trial_types
--     (STRIP / SPLIT / WHOLE_HISTORICAL / WHOLE_NEIGHBOR / OBSERVATIONAL)
--   * each trial has one or more plots with role = treated | check
--   * for WHOLE_HISTORICAL and WHOLE_NEIGHBOR the check is virtual
--     (a historical-yield-average record or a neighboring-field reference)
--
-- This migration adds:
--   1. trial_type + supporting columns on bio_trial.trial_fields
--   2. bio_trial.trial_plots with role, virtual flag, historical/neighbor refs
--   3. plot_id FK on bio_trial.trial_events so yield/application events can be
--      attributed to a specific plot (enables strip/split delta math).
--
-- All additions are optional/nullable so existing rows remain valid. The
-- farmer_set_trial_type RPC (next migration) auto-populates a sensible default
-- plot set when the farmer first declares a type.

-- =============================================================
-- 1. trial_fields — trial-type declaration + tier-specific extras
-- =============================================================
ALTER TABLE bio_trial.trial_fields
  ADD COLUMN IF NOT EXISTS trial_type               text,
  ADD COLUMN IF NOT EXISTS historical_yield_bu_per_ac numeric,
  ADD COLUMN IF NOT EXISTS historical_years_source  text,
  ADD COLUMN IF NOT EXISTS neighbor_field_notes     text,
  ADD COLUMN IF NOT EXISTS trial_type_declared_at   timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'trial_fields_trial_type_check'
      AND conrelid = 'bio_trial.trial_fields'::regclass
  ) THEN
    ALTER TABLE bio_trial.trial_fields
      ADD CONSTRAINT trial_fields_trial_type_check
        CHECK (trial_type IS NULL OR trial_type = ANY (ARRAY[
          'STRIP','SPLIT','WHOLE_HISTORICAL','WHOLE_NEIGHBOR','OBSERVATIONAL'
        ]));
  END IF;
END $$;

COMMENT ON COLUMN bio_trial.trial_fields.trial_type IS
  'Cooperator-chosen trial design (spec §5). NULL until the farmer declares it. Drives how the scoreboard tiers this field''s yield delta (if any).';
COMMENT ON COLUMN bio_trial.trial_fields.historical_yield_bu_per_ac IS
  'Only meaningful for trial_type = WHOLE_HISTORICAL — the farmer''s 3-year average yield for this field, used as the virtual check.';
COMMENT ON COLUMN bio_trial.trial_fields.historical_years_source IS
  'Free-text note on what years / source the historical yield covers (e.g., "2023-2025 combine maps").';
COMMENT ON COLUMN bio_trial.trial_fields.neighbor_field_notes IS
  'Only meaningful for trial_type = WHOLE_NEIGHBOR — describes the untreated neighbor field (same crop, same farm).';

-- =============================================================
-- 2. trial_plots — the comparison unit(s) within a field
-- =============================================================
CREATE TABLE IF NOT EXISTS bio_trial.trial_plots (
  id                          uuid        NOT NULL DEFAULT gen_random_uuid(),
  field_id                    uuid        NOT NULL,
  role                        text        NOT NULL,
  label                       text        NOT NULL,
  acres                       numeric,
  is_virtual                  boolean     NOT NULL DEFAULT false,
  historical_yield_bu_per_ac  numeric,
  neighbor_reference          text,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trial_plots_pkey          PRIMARY KEY (id),
  CONSTRAINT trial_plots_field_fkey    FOREIGN KEY (field_id) REFERENCES bio_trial.trial_fields(id) ON DELETE CASCADE,
  CONSTRAINT trial_plots_role_check    CHECK (role = ANY (ARRAY['treated','check']))
  -- NOTE: acres is intentionally nullable for real plots. Farmers often
  -- declare a STRIP/SPLIT trial type before they know exact strip acreage,
  -- and fake default acres would corrupt scoreboard math worse than NULL
  -- would. An earlier revision of this migration added a virtual-check
  -- CHECK constraint requiring acres on non-virtual plots; it was removed
  -- in 20260420000006_relax_trial_plots_acres.sql after it blocked the
  -- farmer_set_trial_type seeding flow.
);

CREATE INDEX IF NOT EXISTS trial_plots_field_idx ON bio_trial.trial_plots (field_id);
CREATE INDEX IF NOT EXISTS trial_plots_role_idx  ON bio_trial.trial_plots (field_id, role);

COMMENT ON TABLE  bio_trial.trial_plots IS 'One comparison unit inside a trial_fields row. STRIP/SPLIT trials have ≥2 real plots; WHOLE_HISTORICAL/WHOLE_NEIGHBOR have one real treated plot + one virtual check; OBSERVATIONAL has one treated and no check.';
COMMENT ON COLUMN bio_trial.trial_plots.is_virtual IS 'True for historical-average or neighbor-reference check plots (no physical strip). Virtual plots cannot receive event logs with plot_id set — the constraint below enforces that.';

-- =============================================================
-- 3. trial_events.plot_id — link event (yield, application, photo) to plot
-- =============================================================
ALTER TABLE bio_trial.trial_events
  ADD COLUMN IF NOT EXISTS plot_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'trial_events_plot_id_fkey'
      AND conrelid = 'bio_trial.trial_events'::regclass
  ) THEN
    ALTER TABLE bio_trial.trial_events
      ADD CONSTRAINT trial_events_plot_id_fkey
        FOREIGN KEY (plot_id) REFERENCES bio_trial.trial_plots(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS trial_events_plot_idx ON bio_trial.trial_events (plot_id) WHERE plot_id IS NOT NULL;

COMMENT ON COLUMN bio_trial.trial_events.plot_id IS
  'Optional link to a specific plot. Required for strip/split yield deltas — without plot_id we cannot tell treated from check. NULL is fine for signup-level observations.';
