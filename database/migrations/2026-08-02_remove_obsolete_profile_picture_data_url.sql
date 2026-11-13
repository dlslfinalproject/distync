-- profile_picture_path remains the authoritative database reference for
-- private Supabase Storage objects. Signed URLs are generated dynamically,
-- and permanent Base64 profile-picture persistence is obsolete.
ALTER TABLE public.user_role_settings
DROP COLUMN IF EXISTS profile_picture_data_url;
