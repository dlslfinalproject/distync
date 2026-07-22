-- Remove credential-login fields after migrating Demo Mode to Google Sign-In only.
ALTER TABLE public.users
  DROP COLUMN IF EXISTS password_hash,
  DROP COLUMN IF EXISTS demo_access_enabled;
