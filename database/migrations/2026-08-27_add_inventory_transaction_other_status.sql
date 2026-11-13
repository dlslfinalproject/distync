BEGIN;

ALTER TABLE public.inventory_transactions
ADD COLUMN IF NOT EXISTS other_status character varying(80);

COMMIT;
