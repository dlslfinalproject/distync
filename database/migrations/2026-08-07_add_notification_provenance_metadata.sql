-- Block 2: preserve canonical provenance and safe structured notification context.
-- rule_code remains nullable so historical rows are not assigned guessed provenance.
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS rule_code text;

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Existing final notifications intentionally retain NULL rule_code. Their original
-- canonical rule cannot be derived reliably from title/message prose.
