-- 2026-04-27-02-enable-rls.sql
-- Enables RLS on locations + contact_overrides and adds policies.

-- locations
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read approved or admin" ON locations;
CREATE POLICY "read approved or admin" ON locations
  FOR SELECT
  USING (status = 'approved' OR auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "public submits pending" ON locations;
CREATE POLICY "public submits pending" ON locations
  FOR INSERT
  WITH CHECK (
    status = 'pending'
    AND submitter_name IS NOT NULL AND length(trim(submitter_name)) > 0
    AND submitter_phone IS NOT NULL AND length(trim(submitter_phone)) > 0
    AND submitter_email IS NOT NULL AND length(trim(submitter_email)) > 0
    AND suggestion_mode IN ('owner', 'third_party')
  );

DROP POLICY IF EXISTS "admin all" ON locations;
CREATE POLICY "admin all" ON locations
  FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- contact_overrides
ALTER TABLE contact_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public reads overrides" ON contact_overrides;
CREATE POLICY "public reads overrides" ON contact_overrides
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "admin writes overrides" ON contact_overrides;
CREATE POLICY "admin writes overrides" ON contact_overrides
  FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);
