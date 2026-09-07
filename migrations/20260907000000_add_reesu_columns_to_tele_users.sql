-- Adds the reesu_* (resume integration) columns to tele_users.
--
-- These columns are declared in supabase_schema.sql's CREATE TABLE, but any
-- database created before that was added needs this migration applied
-- directly, e.g. via the Supabase SQL editor or `psql`:
--
--   Symptom: "Could not find the 'reesu_access_token' column of
--   'tele_users' in the schema cache" from PostgREST.

ALTER TABLE tele_users
  ADD COLUMN IF NOT EXISTS reesu_user_id UUID,
  ADD COLUMN IF NOT EXISTS reesu_access_token TEXT,
  ADD COLUMN IF NOT EXISTS reesu_refresh_token TEXT;

-- Force PostgREST to pick up the new columns immediately instead of
-- waiting for its next schema cache refresh.
NOTIFY pgrst, 'reload schema';
