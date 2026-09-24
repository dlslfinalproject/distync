ALTER TABLE public.distribution_transactions
  ADD COLUMN IF NOT EXISTS proof_type text,
  ADD COLUMN IF NOT EXISTS proof_photo_path text,
  ADD COLUMN IF NOT EXISTS proof_photo_sha256 character varying(64),
  ADD COLUMN IF NOT EXISTS proof_photo_mime_type text,
  ADD COLUMN IF NOT EXISTS proof_photo_size_bytes bigint,
  ADD COLUMN IF NOT EXISTS proof_photo_captured_at timestamp with time zone;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE connamespace = 'public'::regnamespace
      AND conrelid = 'public.distribution_transactions'::regclass
      AND conname = 'distribution_transactions_proof_type_check'
  ) THEN
    ALTER TABLE public.distribution_transactions
      ADD CONSTRAINT distribution_transactions_proof_type_check
      CHECK (proof_type IS NULL OR proof_type IN ('QR', 'PHOTO'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE connamespace = 'public'::regnamespace
      AND conrelid = 'public.distribution_transactions'::regclass
      AND conname = 'distribution_transactions_claim_proof_metadata_check'
  ) THEN
    ALTER TABLE public.distribution_transactions
      ADD CONSTRAINT distribution_transactions_claim_proof_metadata_check
      CHECK (
        (proof_type = 'PHOTO'
          AND proof_photo_path IS NOT NULL
          AND proof_photo_sha256 IS NOT NULL
          AND proof_photo_sha256 ~ '^[a-f0-9]{64}$'
          AND proof_photo_mime_type IS NOT NULL
          AND proof_photo_mime_type = 'image/jpeg'
          AND proof_photo_size_bytes IS NOT NULL
          AND proof_photo_size_bytes BETWEEN 1 AND 2097152
          AND proof_photo_captured_at IS NOT NULL)
        OR (proof_type IS DISTINCT FROM 'PHOTO'
          AND proof_photo_path IS NULL
          AND proof_photo_sha256 IS NULL
          AND proof_photo_mime_type IS NULL
          AND proof_photo_size_bytes IS NULL
          AND proof_photo_captured_at IS NULL)
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE connamespace = 'public'::regnamespace
      AND conrelid = 'public.distribution_transactions'::regclass
      AND conname = 'distribution_transactions_qr_proof_reference_check'
  ) THEN
    ALTER TABLE public.distribution_transactions
      ADD CONSTRAINT distribution_transactions_qr_proof_reference_check
      CHECK (proof_type IS DISTINCT FROM 'QR' OR qr_reference_value IS NOT NULL);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS distribution_transactions_claim_proof_photo_path_unique
  ON public.distribution_transactions (proof_photo_path)
  WHERE proof_photo_path IS NOT NULL;

CREATE INDEX IF NOT EXISTS distribution_transactions_proof_type_idx
  ON public.distribution_transactions (proof_type)
  WHERE proof_type IS NOT NULL;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'distync-claim-proof-photos',
  'distync-claim-proof-photos',
  false,
  2097152,
  ARRAY['image/jpeg']
)
ON CONFLICT (id) DO UPDATE
SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;
