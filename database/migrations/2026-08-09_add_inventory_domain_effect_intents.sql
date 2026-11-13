ALTER TABLE public.audit_logs
ADD COLUMN IF NOT EXISTS source_event_key text;

CREATE UNIQUE INDEX IF NOT EXISTS audit_logs_source_event_key_unique
  ON public.audit_logs(source_event_key)
  WHERE source_event_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.inventory_domain_effect_intents (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  inventory_transaction_id uuid NOT NULL,
  sync_transaction_id uuid,
  effect_payload_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'PROCESSED', 'FAILED')),
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  audit_processed_at timestamp with time zone,
  alerts_processed_at timestamp with time zone,
  processed_at timestamp with time zone,
  last_error text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT inventory_domain_effect_intents_pkey PRIMARY KEY (id),
  CONSTRAINT inventory_domain_effect_intents_inventory_transaction_unique UNIQUE (inventory_transaction_id),
  CONSTRAINT inventory_domain_effect_intents_inventory_transaction_id_fkey FOREIGN KEY (inventory_transaction_id) REFERENCES public.inventory_transactions(id),
  CONSTRAINT inventory_domain_effect_intents_sync_transaction_id_fkey FOREIGN KEY (sync_transaction_id) REFERENCES public.sync_transactions(id)
);

CREATE INDEX IF NOT EXISTS inventory_domain_effect_intents_pending_idx
  ON public.inventory_domain_effect_intents(status, created_at)
  WHERE status IN ('PENDING', 'FAILED', 'PROCESSING');
