-- Bio trial RLS policies
-- Extracted from Bushel Board 2026-04-19. The is_vendor() helper is defined
-- in 20260419000003_bio_trial_functions.sql, so this must be applied AFTER
-- that migration. (Postgres parses policies lazily — expressions referencing
-- bio_trial.is_vendor() are only resolved at query time.)

ALTER TABLE bio_trial.signups      ENABLE ROW LEVEL SECURITY;
ALTER TABLE bio_trial.vendor_users ENABLE ROW LEVEL SECURITY;

-- Anyone (anon) can insert signups. The public.submit_bio_trial_signup
-- wrapper is SECURITY DEFINER so it bypasses RLS; this policy is a
-- belt-and-braces for any direct-insert callers.
CREATE POLICY "anon can insert signups"
  ON bio_trial.signups
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- service_role full access (used by edge functions running with service role key).
CREATE POLICY "service role full access"
  ON bio_trial.signups
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Vendors (rows in vendor_users) can read all signups.
CREATE POLICY "vendors can read all signups"
  ON bio_trial.signups
  FOR SELECT
  TO authenticated
  USING (bio_trial.is_vendor());

-- Vendors can update signups (gated inside wrapper RPC as well).
CREATE POLICY "vendors can update logistics and status"
  ON bio_trial.signups
  FOR UPDATE
  TO authenticated
  USING      (bio_trial.is_vendor())
  WITH CHECK (bio_trial.is_vendor());

-- A vendor user can read their own membership row (so the UI can detect
-- "am I a vendor?" without calling a function).
CREATE POLICY "vendor users can read own membership"
  ON bio_trial.vendor_users
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());
