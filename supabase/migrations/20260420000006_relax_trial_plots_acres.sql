-- Relax trial_plots acres requirement (Codex follow-up to #3a).
--
-- Migration 20260420000003_trial_types_and_plots.sql added a check
-- constraint:
--
--   CONSTRAINT trial_plots_virtual_check CHECK (is_virtual OR acres IS NOT NULL)
--
-- meaning every non-virtual plot had to know its acreage at insert time.
-- That collided with the seeding flow in farmer_set_trial_type (migration
-- 20260420000004_trial_types_rpcs.sql line ~74), which inserts STRIP and
-- SPLIT default plots with acres = NULL — farmers declare the trial type
-- before they've measured the strips. The first STRIP/SPLIT declaration
-- would have failed with a check-constraint violation.
--
-- Fix: drop the constraint. We deliberately do NOT replace it with "acres
-- > 0" or a backfilled default — a fake half-field acreage would silently
-- corrupt per-acre yield math on the scoreboard, which is strictly worse
-- than a nullable column the UI already handles gracefully.
--
-- Forward-only + idempotent (IF EXISTS) — safe to re-run and safe on a
-- fresh DB that already bootstrapped from the fixed 003.

ALTER TABLE bio_trial.trial_plots
  DROP CONSTRAINT IF EXISTS trial_plots_virtual_check;

COMMENT ON COLUMN bio_trial.trial_plots.acres IS
  'Nullable. Farmers commonly declare trial type (and seed default plots) before measuring strip acreage. UI/RPCs treat NULL as "not yet known". Do not backfill with defaults — fake acreage would silently skew yield-per-acre aggregates.';
