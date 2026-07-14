ALTER TABLE public.user_role_settings
  DROP COLUMN IF EXISTS two_factor_enabled,
  DROP COLUMN IF EXISTS last_local_password_change_at,
  DROP COLUMN IF EXISTS last_two_factor_preference_update_at;
