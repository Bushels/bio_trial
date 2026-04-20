-- Application-method picker: the farmer dashboard + Telegram /apply flow now
-- emit `payload.method` on every new `kind='application'` event, using one of
-- two user-facing tokens:
--
--   * seed_treatment  — applied in-furrow or on-seed at seeding
--   * foliar_spray    — applied to the canopy in-season
--
-- Spec §6.6 permits a richer `seed | in_furrow | foliar` vocabulary; the
-- farmer explainer (§4 "Product plan", §5 "Application method") only promises
-- two labels, so we collapse to two everywhere the farmer interacts. That
-- keeps Telegram's one-hand-in-the-truck flow to two taps and keeps the
-- public scoreboard able to segment trials cleanly.
--
-- This constraint:
--   * Leaves non-application events entirely alone (the outer `kind <>
--     'application'` escape clause).
--   * Leaves legacy application rows alone — they carry no method, so
--     `payload->>'method' IS NULL` passes.
--   * Rejects any future row with a method token outside the enum.
--
-- No data migration: the brief explicitly says free-text notes from early
-- signups stay as-is. NOT VALID + VALIDATE keeps the ACCESS EXCLUSIVE lock
-- window short; both steps pass today because every existing application row
-- is method-less.

ALTER TABLE bio_trial.trial_events
  ADD CONSTRAINT trial_events_application_method_check
  CHECK (
    kind <> 'application'
    OR payload->>'method' IS NULL
    OR payload->>'method' IN ('seed_treatment', 'foliar_spray')
  ) NOT VALID;

ALTER TABLE bio_trial.trial_events
  VALIDATE CONSTRAINT trial_events_application_method_check;
