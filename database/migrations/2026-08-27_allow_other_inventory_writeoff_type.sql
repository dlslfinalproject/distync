BEGIN;

ALTER TABLE public.inventory_transactions
  DROP CONSTRAINT IF EXISTS inventory_transactions_transaction_type_check;

ALTER TABLE public.inventory_transactions
  ADD CONSTRAINT inventory_transactions_transaction_type_check
  CHECK (
    transaction_type::text = ANY (
      ARRAY[
        'INFLOW'::character varying,
        'OUTFLOW'::character varying,
        'ADJUSTMENT'::character varying,
        'EXPIRED'::character varying,
        'MISSING'::character varying,
        'DAMAGED'::character varying,
        'SPOILED'::character varying,
        'STOLEN'::character varying,
        'RETURN'::character varying,
        'OTHER'::character varying
      ]::text[]
    )
  );

COMMIT;
