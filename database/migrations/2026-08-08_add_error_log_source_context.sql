ALTER TABLE public.error_logs
  ADD COLUMN IF NOT EXISTS reference_type character varying,
  ADD COLUMN IF NOT EXISTS reference_id uuid,
  ADD COLUMN IF NOT EXISTS context_json jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_error_logs_anomaly_source_code_created
  ON public.error_logs (module_name, error_code, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_error_logs_reference
  ON public.error_logs (reference_type, reference_id)
  WHERE reference_type IS NOT NULL AND reference_id IS NOT NULL;
