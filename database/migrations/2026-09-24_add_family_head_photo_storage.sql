ALTER TABLE public.households
  ADD COLUMN IF NOT EXISTS family_head_photo_path text,
  ADD COLUMN IF NOT EXISTS family_head_photo_sha256 character varying(64),
  ADD COLUMN IF NOT EXISTS family_head_photo_mime_type text,
  ADD COLUMN IF NOT EXISTS family_head_photo_size_bytes bigint;

CREATE INDEX IF NOT EXISTS households_family_head_photo_path_idx
  ON public.households (family_head_photo_path)
  WHERE family_head_photo_path IS NOT NULL;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'distync-family-head-photos',
  'distync-family-head-photos',
  false,
  2097152,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE
SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;
