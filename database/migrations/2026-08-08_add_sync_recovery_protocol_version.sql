ALTER TABLE public.sync_transactions
ADD COLUMN IF NOT EXISTS processing_protocol_version smallint;

CREATE INDEX IF NOT EXISTS sync_transactions_pending_protocol_updated_at_idx
ON public.sync_transactions (sync_status, processing_protocol_version, updated_at)
WHERE sync_status = 'PENDING';
