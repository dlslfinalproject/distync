ALTER TABLE public.sync_transactions
ADD COLUMN IF NOT EXISTS client_sync_id character varying(80);

CREATE UNIQUE INDEX IF NOT EXISTS sync_transactions_client_sync_id_unique
ON public.sync_transactions (client_sync_id)
WHERE client_sync_id IS NOT NULL;
