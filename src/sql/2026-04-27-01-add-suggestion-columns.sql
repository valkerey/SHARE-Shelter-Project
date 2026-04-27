-- 2026-04-27-01-add-suggestion-columns.sql
-- Additive schema migration. Safe to run on production data.
-- Adds suggestion-tracking columns to locations.
-- Does NOT enable RLS (see 2026-04-27-02 for that).

ALTER TABLE locations
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'approved'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  ADD COLUMN IF NOT EXISTS submitter_name text,
  ADD COLUMN IF NOT EXISTS submitter_phone text,
  ADD COLUMN IF NOT EXISTS submitter_email text,
  ADD COLUMN IF NOT EXISTS suggestion_mode text
    CHECK (suggestion_mode IN ('owner', 'third_party')),
  ADD COLUMN IF NOT EXISTS review_notes text;

CREATE INDEX IF NOT EXISTS locations_status_idx ON locations(status);
