ALTER TABLE public.forecast_runs
  ADD COLUMN IF NOT EXISTS selection_mode character varying NOT NULL DEFAULT 'FIXED_MODEL',
  ALTER COLUMN model_name DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE connamespace = 'public'::regnamespace
      AND conrelid = 'public.forecast_runs'::regclass
      AND conname = 'forecast_runs_selection_mode_check'
  ) THEN
    ALTER TABLE public.forecast_runs
      ADD CONSTRAINT forecast_runs_selection_mode_check
      CHECK (selection_mode IN ('FIXED_MODEL', 'AUTO_BACKTEST'));
  END IF;
END $$;

ALTER TABLE public.forecast_results
  ADD COLUMN IF NOT EXISTS selected_model_name character varying,
  ADD COLUMN IF NOT EXISTS model_evaluation jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE connamespace = 'public'::regnamespace
      AND conrelid = 'public.forecast_results'::regclass
      AND conname = 'forecast_results_selected_model_name_check'
  ) THEN
    ALTER TABLE public.forecast_results
      ADD CONSTRAINT forecast_results_selected_model_name_check
      CHECK (
        selected_model_name IS NULL
        OR selected_model_name IN (
          'MOVING_AVERAGE',
          'EXPONENTIAL_SMOOTHING',
          'TREND_PROJECTION'
        )
      );
  END IF;
END $$;
