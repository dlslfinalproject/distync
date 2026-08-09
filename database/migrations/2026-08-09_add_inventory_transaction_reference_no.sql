ALTER TABLE public.inventory_transactions
ADD COLUMN IF NOT EXISTS inventory_transaction_reference_no character varying(15);

ALTER TABLE public.inventory_transactions
DROP CONSTRAINT IF EXISTS inventory_transactions_reference_no_format_check;

ALTER TABLE public.inventory_transactions
ADD CONSTRAINT inventory_transactions_reference_no_format_check
CHECK (
  inventory_transaction_reference_no IS NULL
  OR (
    inventory_transaction_reference_no ~ '^ITR-[0-9]{4}-[0-9]{6}$'
    AND RIGHT(inventory_transaction_reference_no, 6) <> '000000'
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS inventory_transactions_reference_no_unique
ON public.inventory_transactions (inventory_transaction_reference_no)
WHERE inventory_transaction_reference_no IS NOT NULL;
