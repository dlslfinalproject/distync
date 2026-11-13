BEGIN;

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

CREATE TABLE IF NOT EXISTS public.inventory_transaction_reference_counters (
  reference_year integer PRIMARY KEY CHECK (reference_year BETWEEN 1000 AND 9999),
  last_sequence integer NOT NULL CHECK (last_sequence >= 0)
);

INSERT INTO public.inventory_transaction_reference_counters (
  reference_year,
  last_sequence
)
SELECT
  substring(it.inventory_transaction_reference_no FROM 5 FOR 4)::integer,
  MAX(RIGHT(it.inventory_transaction_reference_no, 6)::integer)
FROM public.inventory_transactions it
WHERE it.inventory_transaction_reference_no IS NOT NULL
GROUP BY substring(it.inventory_transaction_reference_no FROM 5 FOR 4)::integer
ON CONFLICT (reference_year) DO UPDATE
SET last_sequence = GREATEST(
  public.inventory_transaction_reference_counters.last_sequence,
  EXCLUDED.last_sequence
);

CREATE OR REPLACE FUNCTION public.assign_inventory_transaction_reference_no()
RETURNS trigger AS $$
DECLARE
  v_reference_year integer;
  v_next_sequence integer;
BEGIN
  IF NULLIF(BTRIM(NEW.inventory_transaction_reference_no), '') IS NOT NULL THEN
    NEW.inventory_transaction_reference_no := UPPER(
      BTRIM(NEW.inventory_transaction_reference_no)
    );

    IF NEW.inventory_transaction_reference_no ~ '^ITR-[0-9]{4}-[0-9]{6}$'
       AND RIGHT(NEW.inventory_transaction_reference_no, 6) <> '000000' THEN
      v_reference_year := substring(
        NEW.inventory_transaction_reference_no FROM 5 FOR 4
      )::integer;
      v_next_sequence := RIGHT(
        NEW.inventory_transaction_reference_no, 6
      )::integer;

      INSERT INTO public.inventory_transaction_reference_counters (
        reference_year,
        last_sequence
      )
      VALUES (v_reference_year, v_next_sequence)
      ON CONFLICT (reference_year) DO UPDATE
      SET last_sequence = GREATEST(
        public.inventory_transaction_reference_counters.last_sequence,
        EXCLUDED.last_sequence
      );
    END IF;

    RETURN NEW;
  END IF;

  v_reference_year := EXTRACT(
    YEAR FROM COALESCE(NEW.performed_at, NOW())
  )::integer;

  INSERT INTO public.inventory_transaction_reference_counters (
    reference_year,
    last_sequence
  )
  VALUES (v_reference_year, 1)
  ON CONFLICT (reference_year) DO UPDATE
  SET last_sequence =
    public.inventory_transaction_reference_counters.last_sequence + 1
  RETURNING last_sequence INTO v_next_sequence;

  IF v_next_sequence > 999999 THEN
    RAISE EXCEPTION
      'Inventory transaction reference sequence is exhausted for %',
      v_reference_year;
  END IF;

  NEW.inventory_transaction_reference_no := FORMAT(
    'ITR-%s-%s',
    v_reference_year,
    LPAD(v_next_sequence::text, 6, '0')
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS inventory_transactions_reference_no_before_insert
ON public.inventory_transactions;

CREATE TRIGGER inventory_transactions_reference_no_before_insert
BEFORE INSERT
ON public.inventory_transactions
FOR EACH ROW
EXECUTE FUNCTION public.assign_inventory_transaction_reference_no();

DO $$
DECLARE
  transaction_record RECORD;
  next_sequence integer;
BEGIN
  FOR transaction_record IN
    SELECT
      it.id,
      EXTRACT(
        YEAR FROM COALESCE(it.performed_at, it.created_at, NOW())
      )::integer AS reference_year
    FROM public.inventory_transactions it
    WHERE it.inventory_transaction_reference_no IS NULL
    ORDER BY it.performed_at ASC, it.created_at ASC, it.id ASC
  LOOP
    INSERT INTO public.inventory_transaction_reference_counters (
      reference_year,
      last_sequence
    )
    VALUES (transaction_record.reference_year, 1)
    ON CONFLICT (reference_year) DO UPDATE
    SET last_sequence =
      public.inventory_transaction_reference_counters.last_sequence + 1
    RETURNING last_sequence INTO next_sequence;

    IF next_sequence > 999999 THEN
      RAISE EXCEPTION
        'Inventory transaction reference sequence is exhausted for %',
        transaction_record.reference_year;
    END IF;

    UPDATE public.inventory_transactions
    SET inventory_transaction_reference_no = FORMAT(
      'ITR-%s-%s',
      transaction_record.reference_year,
      LPAD(next_sequence::text, 6, '0')
    )
    WHERE id = transaction_record.id;
  END LOOP;
END;
$$;

INSERT INTO public.inventory_transactions (
  disaster_event_id,
  inventory_batch_id,
  transaction_type,
  quantity,
  reference_type,
  reference_id,
  performed_by,
  performed_at,
  remarks,
  created_at
)
SELECT
  NULL,
  ib.id,
  'INFLOW',
  COALESCE(ib.quantity_received, 0),
  'SYSTEM',
  ib.id,
  ib.created_by,
  COALESCE(ib.received_at, ib.created_at, NOW()),
  'Opening stock/restock transaction backfilled from inventory batch',
  COALESCE(ib.created_at, NOW())
FROM public.inventory_batches ib
WHERE NOT EXISTS (
  SELECT 1
  FROM public.inventory_transactions it
  WHERE it.inventory_batch_id = ib.id
    AND it.transaction_type = 'INFLOW'
);

ALTER TABLE public.inventory_transactions
ALTER COLUMN inventory_transaction_reference_no SET NOT NULL;

DROP INDEX IF EXISTS public.inventory_transactions_reference_no_unique;

CREATE UNIQUE INDEX inventory_transactions_reference_no_unique
ON public.inventory_transactions (inventory_transaction_reference_no);

COMMIT;
