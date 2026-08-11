DO $$
DECLARE
  near_expiry_days integer := 30;
  demand_record record;
  batch_record record;
  release_quantity integer;
  remaining_quantity integer;
BEGIN
  CREATE TEMP TABLE tmp_distribution_fifo_demand ON COMMIT DROP AS
  SELECT
    dt.id AS distribution_transaction_id,
    dt.disaster_event_id,
    dt.verified_by,
    dt.remarks AS distribution_remarks,
    COALESCE(dt.distribution_date, dt.received_at, dt.created_at) AS distribution_at,
    dti.inventory_item_id,
    SUM(dti.quantity_released)::integer AS quantity_required
  FROM public.distribution_transaction_items dti
  INNER JOIN public.distribution_transactions dt
    ON dt.id = dti.distribution_transaction_id
  WHERE dt.distribution_status = 'CLAIMED'
  GROUP BY
    dt.id,
    dt.disaster_event_id,
    dt.verified_by,
    dt.remarks,
    COALESCE(dt.distribution_date, dt.received_at, dt.created_at),
    dti.inventory_item_id;

  UPDATE public.inventory_batches ib
  SET quantity_available = ib.quantity_available + restored.quantity_released,
      updated_at = NOW()
  FROM (
    SELECT
      inventory_batch_id,
      SUM(quantity)::integer AS quantity_released
    FROM public.inventory_transactions
    INNER JOIN public.distribution_transactions dt
      ON dt.id = inventory_transactions.reference_id
    WHERE transaction_type = 'OUTFLOW'
      AND reference_type = 'DISTRIBUTION'
      AND dt.distribution_status = 'CLAIMED'
    GROUP BY inventory_batch_id
  ) restored
  WHERE ib.id = restored.inventory_batch_id;

  DELETE FROM public.inventory_transactions
  USING public.distribution_transactions dt
  WHERE transaction_type = 'OUTFLOW'
    AND reference_type = 'DISTRIBUTION'
    AND reference_id = dt.id
    AND dt.distribution_status = 'CLAIMED';

  DELETE FROM public.distribution_transaction_items dti
  USING public.distribution_transactions dt
  WHERE dti.distribution_transaction_id = dt.id
    AND dt.distribution_status = 'CLAIMED';

  FOR demand_record IN
    SELECT *
    FROM tmp_distribution_fifo_demand
    ORDER BY distribution_at ASC, distribution_transaction_id ASC, inventory_item_id ASC
  LOOP
    remaining_quantity := demand_record.quantity_required;

    FOR batch_record IN
      SELECT
        id,
        batch_no,
        quantity_available,
        expiration_date
      FROM public.inventory_batches
      WHERE inventory_item_id = demand_record.inventory_item_id
        AND COALESCE(quantity_available, 0) > 0
        AND status IN ('AVAILABLE', 'LOW_STOCK')
        AND (
          expiration_date IS NULL
          OR expiration_date > (CURRENT_DATE + (near_expiry_days || ' days')::interval)
        )
      ORDER BY
        received_at ASC NULLS LAST,
        created_at ASC,
        batch_no ASC
      FOR UPDATE
    LOOP
      EXIT WHEN remaining_quantity <= 0;

      release_quantity := LEAST(remaining_quantity, batch_record.quantity_available);

      IF release_quantity <= 0 THEN
        CONTINUE;
      END IF;

      INSERT INTO public.distribution_transaction_items (
        distribution_transaction_id,
        inventory_batch_id,
        inventory_item_id,
        quantity_released,
        created_at
      )
      VALUES (
        demand_record.distribution_transaction_id,
        batch_record.id,
        demand_record.inventory_item_id,
        release_quantity,
        NOW()
      );

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
      VALUES (
        demand_record.disaster_event_id,
        batch_record.id,
        'OUTFLOW',
        release_quantity,
        'DISTRIBUTION',
        demand_record.distribution_transaction_id,
        demand_record.verified_by,
        demand_record.distribution_at,
        COALESCE(NULLIF(TRIM(demand_record.distribution_remarks), ''), 'Relief distribution outflow'),
        NOW()
      );

      UPDATE public.inventory_batches
      SET quantity_available = quantity_available - release_quantity,
          status = CASE
            WHEN quantity_available - release_quantity <= 0 THEN 'DEPLETED'
            WHEN expiration_date IS NOT NULL AND expiration_date < CURRENT_DATE THEN 'EXPIRED'
            WHEN quantity_available - release_quantity <= 10 THEN 'LOW_STOCK'
            ELSE 'AVAILABLE'
          END,
          updated_at = NOW()
      WHERE id = batch_record.id;

      remaining_quantity := remaining_quantity - release_quantity;
    END LOOP;

    IF remaining_quantity > 0 THEN
      RAISE EXCEPTION
        'Cannot rebalance distribution % item % with FIFO: % unit(s) still need valid non-expired, non-near-expiry stock.',
        demand_record.distribution_transaction_id,
        demand_record.inventory_item_id,
        remaining_quantity;
    END IF;
  END LOOP;

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
    CASE
      WHEN ib.status = 'MISSING' THEN 'MISSING'
      WHEN ib.status = 'DAMAGED' THEN 'DAMAGED'
      ELSE 'EXPIRED'
    END,
    ib.quantity_available,
    'SYSTEM',
    NULL,
    NULL,
    NOW(),
    CASE
      WHEN ib.status IN ('MISSING', 'DAMAGED') THEN 'Written-off batch stock removed'
      ELSE 'Expired batch stock removed'
    END,
    NOW()
  FROM public.inventory_batches ib
  WHERE COALESCE(ib.quantity_available, 0) > 0
    AND (
      ib.status IN ('MISSING', 'DAMAGED')
      OR (
        ib.expiration_date IS NOT NULL
        AND ib.expiration_date < CURRENT_DATE
      )
    );

  UPDATE public.inventory_batches
  SET quantity_available = 0,
      status = CASE
        WHEN status = 'MISSING' THEN 'MISSING'
        WHEN status = 'DAMAGED' THEN 'DAMAGED'
        ELSE 'EXPIRED'
      END,
      updated_at = NOW()
  WHERE COALESCE(quantity_available, 0) > 0
    AND (
      status IN ('MISSING', 'DAMAGED')
      OR (
        expiration_date IS NOT NULL
        AND expiration_date < CURRENT_DATE
      )
    );

  UPDATE public.inventory_batches
  SET status = CASE
        WHEN status = 'EXPIRED'
          OR (expiration_date IS NOT NULL AND expiration_date < CURRENT_DATE)
          THEN 'EXPIRED'
        WHEN quantity_available <= 0 THEN 'DEPLETED'
        WHEN quantity_available <= 10 THEN 'LOW_STOCK'
        ELSE 'AVAILABLE'
      END,
      updated_at = NOW()
  WHERE status IN ('AVAILABLE', 'LOW_STOCK', 'EXPIRED', 'DEPLETED');
END $$;
