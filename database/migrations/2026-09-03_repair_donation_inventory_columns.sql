-- Repair columns used by donation receipts when earlier migrations were only
-- partially applied to an existing inventory schema.

ALTER TABLE public.inventory_item_stock_forms
ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE public.inventory_batches
ADD COLUMN IF NOT EXISTS inventory_item_stock_form_id UUID,
ADD COLUMN IF NOT EXISTS stock_version INTEGER NOT NULL DEFAULT 0;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'inventory_batches_inventory_item_stock_form_id_fkey'
    ) THEN
        ALTER TABLE public.inventory_batches
        ADD CONSTRAINT inventory_batches_inventory_item_stock_form_id_fkey
            FOREIGN KEY (inventory_item_stock_form_id)
            REFERENCES public.inventory_item_stock_forms(id);
    END IF;
END $$;

ALTER TABLE public.inventory_transactions
ADD COLUMN IF NOT EXISTS other_status VARCHAR(80),
ADD COLUMN IF NOT EXISTS inventory_transaction_reference_no VARCHAR(15);

ALTER TABLE public.donations
ADD COLUMN IF NOT EXISTS donor_type_other VARCHAR;
