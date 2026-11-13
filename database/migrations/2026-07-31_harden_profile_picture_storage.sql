ALTER TABLE public.user_role_settings
  ADD COLUMN IF NOT EXISTS profile_picture_path text,
  ADD COLUMN IF NOT EXISTS profile_picture_updated_at timestamp with time zone;

UPDATE public.user_role_settings
SET
  profile_picture_data_url = NULL,
  profile_picture_file_name = NULL
WHERE profile_picture_data_url IS NOT NULL
  AND NULLIF(BTRIM(profile_picture_data_url), '') IS NOT NULL;

INSERT INTO storage.buckets (id, name, public)
VALUES ('distync-profile-pictures', 'distync-profile-pictures', false)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public;
