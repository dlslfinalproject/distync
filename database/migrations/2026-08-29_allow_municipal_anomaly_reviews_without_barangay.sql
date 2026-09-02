BEGIN;

-- A municipality-level anomaly may have no meaningful Barangay attribution.
-- Preserve the Barangay foreign key when an attribution is present.
ALTER TABLE public.anomaly_reviews
  ALTER COLUMN barangay_id DROP NOT NULL;

-- The existing four-column identity index remains authoritative for attributed
-- reviews. PostgreSQL treats NULL values as distinct in a unique index, so a
-- second partial index is required to keep one review for each NULL identity.
CREATE UNIQUE INDEX IF NOT EXISTS anomaly_reviews_current_identity_null_barangay_unique
  ON public.anomaly_reviews (source_type, source_id, anomaly_type)
  WHERE barangay_id IS NULL;

COMMIT;
