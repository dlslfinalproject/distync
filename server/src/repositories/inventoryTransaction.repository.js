const pool = require("../config/db");

const baseSelectQuery = `
  SELECT
    it.id,
    it.disaster_event_id,
    it.inventory_batch_id,
    it.transaction_type,
    it.quantity,
    it.reference_type,
    it.reference_id,
    it.inventory_transaction_reference_no,
    it.performed_by,
    it.performed_at,
    it.remarks,
    it.other_status,
    it.created_at,
    ib.batch_no,
    ib.inventory_item_stock_form_id,
    ib.source_type,
    ib.status AS batch_status,
    ib.quantity_available,
    ib.stock_version,
    ib.expiration_date,
    ii.id AS inventory_item_id,
    ii.item_code,
    ii.item_name,
    d.id AS donation_id,
    d.donor_name,
    source_donation.donation_id AS source_donation_id,
    source_donation.donor_name AS source_donor_name,
    stock_forms.barcode AS stock_form_barcode,
    stock_forms.packaging AS stock_form_packaging,
    stock_forms.units_per_packaging AS stock_form_units_per_packaging,
    stock_forms.unit_of_measure AS stock_form_unit_of_measure,
    stock_forms.unit_of_measure_value AS stock_form_unit_of_measure_value,
    u.first_name AS performed_by_first_name,
    u.last_name AS performed_by_last_name
  FROM inventory_transactions it
  INNER JOIN inventory_batches ib ON ib.id = it.inventory_batch_id
  INNER JOIN inventory_items ii ON ii.id = ib.inventory_item_id
  LEFT JOIN donation_items di
    ON di.id = it.reference_id
    AND it.reference_type = 'DONATION'
  LEFT JOIN donations d
    ON d.id = di.donation_id
  LEFT JOIN LATERAL (
    SELECT
      source_di.donation_id,
      source_d.donor_name
    FROM donation_items source_di
    INNER JOIN donations source_d
      ON source_d.id = source_di.donation_id
    WHERE source_di.inventory_batch_id = ib.id
    ORDER BY source_di.created_at ASC
    LIMIT 1
  ) source_donation ON TRUE
  LEFT JOIN inventory_item_stock_forms stock_forms
    ON stock_forms.id = ib.inventory_item_stock_form_id
  LEFT JOIN users u ON u.id = it.performed_by
`;

const inflowTransactionTypes = ["INFLOW", "RETURN", "ADJUSTMENT"];
const outflowTransactionTypes = [
  "OUTFLOW",
  "EXPIRED",
  "DAMAGED",
  "MISSING",
  "SPOILED",
  "STOLEN",
  "OTHER",
];

const donationAdjustmentCondition = `(
  it.reference_type = 'DONATION'
  AND (
    it.transaction_type = 'ADJUSTMENT'
    OR LOWER(COALESCE(it.remarks, '')) LIKE 'adjusted up donation stock%'
    OR LOWER(COALESCE(it.remarks, '')) LIKE 'adjusted down donation stock%'
    OR LOWER(COALESCE(it.remarks, '')) LIKE '%donation adjustment%'
  )
)`;

const transactionLabelConditions = {
  "Stock-Up": `(
    it.transaction_type = ANY($TRANSACTION_TYPES::text[])
    AND it.reference_type IS DISTINCT FROM 'DONATION'
  )`,
  Donated: `(
    it.transaction_type = ANY($TRANSACTION_TYPES::text[])
    AND it.reference_type = 'DONATION'
    AND NOT ${donationAdjustmentCondition}
  )`,
  "Donation Adjustment": donationAdjustmentCondition,
  Distributed: "it.reference_type = 'DISTRIBUTION'",
  Damaged: "it.transaction_type = 'DAMAGED'",
  Spoiled: "it.transaction_type = 'SPOILED'",
  Missing: "it.transaction_type = 'MISSING'",
  Stolen: "it.transaction_type = 'STOLEN'",
  Expired: "it.transaction_type = 'EXPIRED'",
  Other: "it.transaction_type = 'OTHER'",
};

const getInventoryTransactions = async (filters) => {
  const values = [];
  const conditions = [];

  const addValue = (value) => {
    values.push(value);
    return `$${values.length}`;
  };

  if (filters.inventory_batch_id) {
    values.push(filters.inventory_batch_id);
    conditions.push(`it.inventory_batch_id = $${values.length}`);
  }

  if (filters.inventory_item_id) {
    values.push(filters.inventory_item_id);
    conditions.push(`ib.inventory_item_id = $${values.length}`);
  }

  if (filters.transaction_type) {
    values.push(filters.transaction_type);
    conditions.push(`it.transaction_type = $${values.length}`);
  }

  if (filters.reference_type) {
    values.push(filters.reference_type);
    conditions.push(`it.reference_type = $${values.length}`);
  }

  if (filters.disaster_event_id) {
    values.push(filters.disaster_event_id);
    conditions.push(`it.disaster_event_id = $${values.length}`);
  }

  if (filters.performed_by) {
    values.push(filters.performed_by);
    conditions.push(`it.performed_by = $${values.length}`);
  }

  if (filters.transaction_label) {
    const labelCondition = transactionLabelConditions[filters.transaction_label];

    if (labelCondition) {
      const transactionTypesParameter = labelCondition.includes(
        "$TRANSACTION_TYPES",
      )
        ? addValue(inflowTransactionTypes)
        : null;
      conditions.push(
        labelCondition.replaceAll(
          "$TRANSACTION_TYPES",
          transactionTypesParameter || "$UNUSED_TRANSACTION_TYPES",
        ),
      );
    }
  }

  if (filters.movement === "INFLOW") {
    const parameter = addValue(inflowTransactionTypes);
    conditions.push(`it.transaction_type = ANY(${parameter}::text[])`);
  } else if (filters.movement === "OUTFLOW") {
    const parameter = addValue(outflowTransactionTypes);
    conditions.push(`it.transaction_type = ANY(${parameter}::text[])`);
  }

  if (filters.source === "Donors") {
    conditions.push("(ib.source_type = 'DONATED' OR it.reference_type = 'DONATION')");
  } else if (filters.source === "Malvar LGU") {
    conditions.push(
      "(ib.source_type IS DISTINCT FROM 'DONATED' AND it.reference_type IS DISTINCT FROM 'DONATION')",
    );
  }

  if (filters.date_from) {
    const parameter = addValue(filters.date_from);
    conditions.push(`it.performed_at::date >= ${parameter}::date`);
  }

  if (filters.date_to) {
    const parameter = addValue(filters.date_to);
    conditions.push(`it.performed_at::date <= ${parameter}::date`);
  }

  const stockFormPackagings = Array.isArray(filters.stock_form_packaging)
    ? filters.stock_form_packaging.filter(Boolean)
    : filters.stock_form_packaging
      ? [filters.stock_form_packaging]
      : [];

  if (stockFormPackagings.length > 0) {
    const parameter = addValue(stockFormPackagings);
    conditions.push(`stock_forms.packaging = ANY(${parameter}::text[])`);
  }

  if (filters.search) {
    const parameter = addValue(`%${filters.search}%`);
    conditions.push(
      `(it.id::text ILIKE ${parameter} OR ib.batch_no ILIKE ${parameter} OR ii.item_name ILIKE ${parameter} OR ii.item_code ILIKE ${parameter} OR it.transaction_type ILIKE ${parameter} OR CASE WHEN it.transaction_type = ANY(ARRAY['INFLOW', 'RETURN', 'ADJUSTMENT']) THEN 'INFLOW' ELSE 'OUTFLOW' END ILIKE ${parameter} OR it.remarks ILIKE ${parameter} OR it.other_status ILIKE ${parameter} OR it.inventory_transaction_reference_no ILIKE ${parameter} OR stock_forms.packaging ILIKE ${parameter} OR COALESCE(d.donor_name, source_donation.donor_name, '') ILIKE ${parameter} OR CASE WHEN ib.source_type = 'DONATED' OR it.reference_type = 'DONATION' THEN 'Donors' ELSE 'Malvar LGU' END ILIKE ${parameter})`,
    );
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const query = `
    ${baseSelectQuery}
    ${whereClause}
    ORDER BY it.performed_at DESC, it.created_at DESC
  `;

  const result = await pool.query(query, values);
  return result.rows;
};

const getInventoryTransactionById = async (id) => {
  const query = `
    ${baseSelectQuery}
    WHERE it.id = $1
  `;

  const result = await pool.query(query, [id]);
  return result.rows[0] || null;
};

const getInventoryTransactionByReferenceNo = async (
  inventoryTransactionReferenceNo,
  dbClient = pool,
) => {
  const query = `
    ${baseSelectQuery}
    WHERE it.inventory_transaction_reference_no = $1
    LIMIT 1
  `;

  const result = await dbClient.query(query, [inventoryTransactionReferenceNo]);
  return result.rows[0] || null;
};

const getInventoryBatchByIdForUpdate = async (id, dbClient) => {
  const query = `
    SELECT
      ib.id,
      ib.inventory_item_id,
      ib.inventory_item_stock_form_id,
      ib.batch_no,
      ib.quantity_received,
      ib.quantity_available,
      ib.stock_version,
      ib.source_type,
      source_donation.donation_type AS source_donation_type,
      source_donation.disaster_event_id AS source_donation_event_id,
      ib.expiration_date,
      ib.status,
      ii.item_code,
      ii.item_name,
      ii.category,
      ii.unit_of_measure,
      stock_forms.barcode AS stock_form_barcode,
      stock_forms.packaging AS stock_form_packaging,
      stock_forms.units_per_packaging AS stock_form_units_per_packaging,
      stock_forms.unit_of_measure AS stock_form_unit_of_measure,
      stock_forms.unit_of_measure_value AS stock_form_unit_of_measure_value
    FROM inventory_batches ib
    INNER JOIN inventory_items ii ON ii.id = ib.inventory_item_id
    LEFT JOIN inventory_item_stock_forms stock_forms
      ON stock_forms.id = ib.inventory_item_stock_form_id
    LEFT JOIN LATERAL (
      SELECT CASE
        WHEN ib.source_type = 'DONATED'
          AND COALESCE(source_di.remarks, '') ILIKE 'Relief Pack:%'
          THEN 'RELIEF_PACK'
        WHEN ib.source_type = 'DONATED' THEN 'LOOSE_ITEM'
        ELSE NULL
      END AS donation_type,
      source_d.disaster_event_id
      FROM donation_items source_di
      INNER JOIN donations source_d
        ON source_d.id = source_di.donation_id
      WHERE source_di.inventory_batch_id = ib.id
      ORDER BY source_di.created_at ASC
      LIMIT 1
    ) source_donation ON TRUE
    WHERE ib.id = $1
    FOR UPDATE OF ib
  `;

  const result = await dbClient.query(query, [id]);
  return result.rows[0] || null;
};

const getInventoryBatchById = async (id, dbClient = pool) => {
  const result = await dbClient.query(
    `
      SELECT id, inventory_item_id
      FROM inventory_batches
      WHERE id = $1
    `,
    [id],
  );

  return result.rows[0] || null;
};

const getAvailableInventoryBatchesByItemIdForUpdate = async (inventoryItemId, dbClient) => {
  const query = `
    SELECT
      ib.id,
      ib.inventory_item_id,
      ib.batch_no,
      ib.quantity_received,
      ib.quantity_available,
      ib.stock_version,
      ib.expiration_date,
      ib.status,
      ii.item_code,
      ii.item_name,
      ii.category,
      ii.unit_of_measure,
      ii.reorder_level
    FROM inventory_batches ib
    INNER JOIN inventory_items ii ON ii.id = ib.inventory_item_id
    WHERE ib.inventory_item_id = $1
      AND COALESCE(ib.quantity_available, 0) > 0
    ORDER BY
      ib.received_at ASC NULLS LAST,
      ib.created_at ASC,
      ib.batch_no ASC
    FOR UPDATE
  `;

  const result = await dbClient.query(query, [inventoryItemId]);
  return result.rows;
};

const resolveDistributableBatchQueryArguments = (
  disasterEventIdOrDbClient,
  maybeDbClient,
) => ({
  disasterEventId: maybeDbClient ? disasterEventIdOrDbClient : null,
  dbClient: maybeDbClient || disasterEventIdOrDbClient,
});

const getDistributableInventoryBatchesByItemIdForUpdate = async (
  inventoryItemId,
  disasterEventIdOrDbClient,
  maybeDbClient,
) => {
  const { disasterEventId, dbClient } = resolveDistributableBatchQueryArguments(
    disasterEventIdOrDbClient,
    maybeDbClient,
  );
  const query = `
    SELECT
      ib.id,
      ib.inventory_item_id,
      ib.batch_no,
      ib.quantity_received,
      ib.quantity_available,
      ib.stock_version,
      ib.expiration_date,
      ib.received_at,
      ib.created_at,
      ib.status,
      ib.source_type,
      ii.item_code,
      ii.item_name,
      ii.category,
      ii.unit_of_measure,
      ii.reorder_level,
      loose_donation.donation_id,
      loose_donation.donation_item_id,
      loose_donation.donor_name,
      loose_donation.donation_received_at,
      loose_donation.donation_created_at
    FROM inventory_batches ib
    INNER JOIN inventory_items ii ON ii.id = ib.inventory_item_id
    LEFT JOIN disaster_events target_event
      ON target_event.id = $2
    LEFT JOIN LATERAL (
      SELECT
        loose_di.id AS donation_item_id,
        loose_d.id AS donation_id,
        loose_d.donor_name,
        loose_d.received_at AS donation_received_at,
        loose_d.created_at AS donation_created_at
      FROM donation_items loose_di
      INNER JOIN donations loose_d ON loose_d.id = loose_di.donation_id
      INNER JOIN disaster_events donation_event
        ON donation_event.id = loose_d.disaster_event_id
      WHERE loose_di.inventory_batch_id = ib.id
        AND loose_d.status <> 'CANCELLED'
        AND COALESCE(loose_di.remarks, '') NOT ILIKE 'Relief Pack:%'
        AND (
          loose_d.disaster_event_id = target_event.id
          OR (
            target_event.id IS NOT NULL
            AND target_event.status = 'ACTIVE'
            AND donation_event.status = 'CLOSED'
            AND (
              target_event.created_at > donation_event.created_at
              OR (
                target_event.created_at = donation_event.created_at
                AND target_event.id > donation_event.id
              )
            )
            AND NOT EXISTS (
              SELECT 1
              FROM disaster_events next_event
              WHERE next_event.status = 'ACTIVE'
                AND (
                  next_event.created_at > donation_event.created_at
                  OR (
                    next_event.created_at = donation_event.created_at
                    AND next_event.id > donation_event.id
                  )
                )
                AND (
                  next_event.created_at < target_event.created_at
                  OR (
                    next_event.created_at = target_event.created_at
                    AND next_event.id < target_event.id
                  )
                )
            )
          )
        )
      ORDER BY
        loose_d.received_at ASC NULLS LAST,
        loose_d.created_at ASC,
        loose_di.created_at ASC
      LIMIT 1
    ) loose_donation ON TRUE
    WHERE ib.inventory_item_id = $1
      AND ($2::UUID IS NULL OR target_event.status = 'ACTIVE')
      AND COALESCE(ib.quantity_available, 0) > 0
      AND ib.status IN ('AVAILABLE', 'LOW_STOCK')
      AND (
        ib.source_type = 'LGU'
        OR (
          ib.source_type = 'DONATED'
          AND loose_donation.donation_id IS NOT NULL
        )
      )
      AND NOT EXISTS (
        SELECT 1
        FROM donation_items relief_pack_donation_items
        WHERE relief_pack_donation_items.inventory_batch_id = ib.id
          AND COALESCE(relief_pack_donation_items.remarks, '') ILIKE 'Relief Pack:%'
      )
      AND (
        ib.expiration_date IS NULL
        OR ib.expiration_date > (CURRENT_DATE + INTERVAL '30 days')
      )
    ORDER BY
      CASE WHEN ib.source_type = 'DONATED' THEN 0 ELSE 1 END,
      CASE
        WHEN ib.source_type = 'DONATED'
          THEN loose_donation.donation_received_at
        ELSE ib.received_at
      END ASC NULLS LAST,
      CASE
        WHEN ib.source_type = 'DONATED'
          THEN loose_donation.donation_created_at
        ELSE ib.created_at
      END ASC NULLS LAST,
      ib.received_at ASC NULLS LAST,
      ib.created_at ASC,
      ib.batch_no ASC
    FOR UPDATE OF ib
  `;

  const result = await dbClient.query(query, [inventoryItemId, disasterEventId]);
  return result.rows;
};

const getDistributableInventoryBatchesByItemIdsForUpdate = async (
  inventoryItemIds,
  disasterEventIdOrDbClient,
  maybeDbClient,
) => {
  if (!Array.isArray(inventoryItemIds) || inventoryItemIds.length === 0) {
    return [];
  }

  const { disasterEventId, dbClient } = resolveDistributableBatchQueryArguments(
    disasterEventIdOrDbClient,
    maybeDbClient,
  );

  const query = `
    SELECT
      ib.id,
      ib.inventory_item_id,
      ib.batch_no,
      ib.quantity_received,
      ib.quantity_available,
      ib.stock_version,
      ib.expiration_date,
      ib.received_at,
      ib.created_at,
      ib.status,
      ib.source_type,
      ii.item_code,
      ii.item_name,
      ii.category,
      ii.unit_of_measure,
      ii.reorder_level,
      loose_donation.donation_id,
      loose_donation.donation_item_id,
      loose_donation.donor_name,
      loose_donation.donation_received_at,
      loose_donation.donation_created_at
    FROM inventory_batches ib
    INNER JOIN inventory_items ii ON ii.id = ib.inventory_item_id
    LEFT JOIN disaster_events target_event
      ON target_event.id = $2
    LEFT JOIN LATERAL (
      SELECT
        loose_di.id AS donation_item_id,
        loose_d.id AS donation_id,
        loose_d.donor_name,
        loose_d.received_at AS donation_received_at,
        loose_d.created_at AS donation_created_at
      FROM donation_items loose_di
      INNER JOIN donations loose_d ON loose_d.id = loose_di.donation_id
      INNER JOIN disaster_events donation_event
        ON donation_event.id = loose_d.disaster_event_id
      WHERE loose_di.inventory_batch_id = ib.id
        AND loose_d.status <> 'CANCELLED'
        AND COALESCE(loose_di.remarks, '') NOT ILIKE 'Relief Pack:%'
        AND (
          loose_d.disaster_event_id = target_event.id
          OR (
            target_event.id IS NOT NULL
            AND target_event.status = 'ACTIVE'
            AND donation_event.status = 'CLOSED'
            AND (
              target_event.created_at > donation_event.created_at
              OR (
                target_event.created_at = donation_event.created_at
                AND target_event.id > donation_event.id
              )
            )
            AND NOT EXISTS (
              SELECT 1
              FROM disaster_events next_event
              WHERE next_event.status = 'ACTIVE'
                AND (
                  next_event.created_at > donation_event.created_at
                  OR (
                    next_event.created_at = donation_event.created_at
                    AND next_event.id > donation_event.id
                  )
                )
                AND (
                  next_event.created_at < target_event.created_at
                  OR (
                    next_event.created_at = target_event.created_at
                    AND next_event.id < target_event.id
                  )
                )
            )
          )
        )
      ORDER BY
        loose_d.received_at ASC NULLS LAST,
        loose_d.created_at ASC,
        loose_di.created_at ASC
      LIMIT 1
    ) loose_donation ON TRUE
    WHERE ib.inventory_item_id = ANY($1::uuid[])
      AND ($2::UUID IS NULL OR target_event.status = 'ACTIVE')
      AND COALESCE(ib.quantity_available, 0) > 0
      AND ib.status IN ('AVAILABLE', 'LOW_STOCK')
      AND (
        ib.source_type = 'LGU'
        OR (
          ib.source_type = 'DONATED'
          AND loose_donation.donation_id IS NOT NULL
        )
      )
      AND NOT EXISTS (
        SELECT 1
        FROM donation_items relief_pack_donation_items
        WHERE relief_pack_donation_items.inventory_batch_id = ib.id
          AND COALESCE(relief_pack_donation_items.remarks, '') ILIKE 'Relief Pack:%'
      )
      AND (
        ib.expiration_date IS NULL
        OR ib.expiration_date > (CURRENT_DATE + INTERVAL '30 days')
      )
    ORDER BY
      ib.inventory_item_id ASC,
      CASE WHEN ib.source_type = 'DONATED' THEN 0 ELSE 1 END,
      CASE
        WHEN ib.source_type = 'DONATED'
          THEN loose_donation.donation_received_at
        ELSE ib.received_at
      END ASC NULLS LAST,
      CASE
        WHEN ib.source_type = 'DONATED'
          THEN loose_donation.donation_created_at
        ELSE ib.created_at
      END ASC NULLS LAST,
      ib.received_at ASC NULLS LAST,
      ib.created_at ASC,
      ib.batch_no ASC
    FOR UPDATE OF ib
  `;

  const result = await dbClient.query(query, [inventoryItemIds, disasterEventId]);
  return result.rows;
};

const getDisasterEventById = async (id, dbClient = pool) => {
  const query = `
    SELECT id, event_code, title, status
    FROM disaster_events
    WHERE id = $1
  `;

  const result = await dbClient.query(query, [id]);
  return result.rows[0] || null;
};

const getUserById = async (id) => {
  const query = `
    SELECT id, first_name, last_name
    FROM users
    WHERE id = $1
  `;

  const result = await pool.query(query, [id]);
  return result.rows[0] || null;
};

const insertInventoryTransaction = async (transactionData, dbClient) => {
  const hasPerformedAt =
    transactionData.performed_at !== undefined &&
    transactionData.performed_at !== null;
  const query = `
    INSERT INTO inventory_transactions (
      disaster_event_id,
      inventory_batch_id,
      transaction_type,
      quantity,
      reference_type,
      reference_id,
      inventory_transaction_reference_no,
      performed_by,
      performed_at,
      remarks,
      other_status,
      created_at
    )
    VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, ${hasPerformedAt ? "$11::timestamptz" : "NOW()"}, $9, $10, NOW()
    )
    ON CONFLICT DO NOTHING
    RETURNING
      id,
      disaster_event_id,
      inventory_batch_id,
      transaction_type,
      quantity,
      reference_type,
      reference_id,
      inventory_transaction_reference_no,
      performed_by,
      performed_at,
      remarks,
      other_status,
      created_at
  `;

  const values = [
    transactionData.disaster_event_id,
    transactionData.inventory_batch_id,
    transactionData.transaction_type,
    transactionData.quantity,
    transactionData.reference_type,
    transactionData.reference_id,
    transactionData.inventory_transaction_reference_no || null,
    transactionData.performed_by,
    transactionData.remarks,
    transactionData.other_status || null,
  ];

  if (hasPerformedAt) {
    values.push(transactionData.performed_at);
  }

  const result = await dbClient.query(query, values);
  return result.rows[0];
};

const updateInventoryBatchQuantityAndStatus = async (
  batchId,
  quantityAvailable,
  status,
  dbClient,
) => {
  const query = `
    UPDATE inventory_batches
    SET quantity_available = $2,
        status = $3,
        updated_at = NOW()
    WHERE id = $1
    RETURNING
      id,
      inventory_item_id,
      batch_no,
      quantity_available,
      stock_version,
      expiration_date,
      status,
      updated_at
  `;

  const result = await dbClient.query(query, [batchId, quantityAvailable, status]);
  return result.rows[0] || null;
};

const ensureInventoryDomainEffectIntent = async (payload, dbClient) => {
  const query = `
    INSERT INTO inventory_domain_effect_intents (
      inventory_transaction_id,
      sync_transaction_id,
      effect_payload_json,
      status,
      attempt_count,
      created_at,
      updated_at
    )
    VALUES ($1, $2, $3::jsonb, 'PENDING', 0, NOW(), NOW())
    ON CONFLICT (inventory_transaction_id)
    DO UPDATE SET updated_at = inventory_domain_effect_intents.updated_at
    RETURNING *
  `;

  const values = [
    payload.inventoryTransactionId,
    payload.syncTransactionId || null,
    JSON.stringify(payload.effectPayload || {}),
  ];

  const result = await dbClient.query(query, values);
  return result.rows[0] || null;
};

const claimInventoryDomainEffectIntentById = async (id, dbClient = pool) => {
  const result = await dbClient.query(
    `
      UPDATE inventory_domain_effect_intents
      SET status = 'PROCESSING',
          attempt_count = attempt_count + 1,
          last_error = NULL,
          updated_at = NOW()
      WHERE id = $1
        AND status IN ('PENDING', 'FAILED')
      RETURNING *
    `,
    [id],
  );

  return result.rows[0] || null;
};

const claimPendingInventoryDomainEffectIntents = async (
  limit = 25,
  dbClient = pool,
) => {
  const result = await dbClient.query(
    `
      WITH candidates AS (
        SELECT id
        FROM inventory_domain_effect_intents
        WHERE status IN ('PENDING', 'FAILED')
           OR (status = 'PROCESSING' AND updated_at <= NOW() - (15 * INTERVAL '1 minute'))
        ORDER BY created_at ASC
        LIMIT $1
        FOR UPDATE SKIP LOCKED
      )
      UPDATE inventory_domain_effect_intents idei
      SET status = 'PROCESSING',
          attempt_count = idei.attempt_count + 1,
          last_error = NULL,
          updated_at = NOW()
      FROM candidates
      WHERE idei.id = candidates.id
      RETURNING idei.*
    `,
    [limit],
  );

  return result.rows;
};

const markInventoryDomainEffectAuditProcessed = async (id, dbClient = pool) => {
  const result = await dbClient.query(
    `
      UPDATE inventory_domain_effect_intents
      SET audit_processed_at = COALESCE(audit_processed_at, NOW()),
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [id],
  );

  return result.rows[0] || null;
};

const markInventoryDomainEffectAlertsProcessed = async (id, dbClient = pool) => {
  const result = await dbClient.query(
    `
      UPDATE inventory_domain_effect_intents
      SET alerts_processed_at = COALESCE(alerts_processed_at, NOW()),
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [id],
  );

  return result.rows[0] || null;
};

const markInventoryDomainEffectIntentProcessed = async (id, dbClient = pool) => {
  const result = await dbClient.query(
    `
      UPDATE inventory_domain_effect_intents
      SET status = 'PROCESSED',
          processed_at = COALESCE(processed_at, NOW()),
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [id],
  );

  return result.rows[0] || null;
};

const markInventoryDomainEffectIntentFailed = async (
  { id, errorMessage },
  dbClient = pool,
) => {
  const result = await dbClient.query(
    `
      UPDATE inventory_domain_effect_intents
      SET status = 'FAILED',
          last_error = $2,
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [id, String(errorMessage || "Inventory domain effect processing failed.").slice(0, 500)],
  );

  return result.rows[0] || null;
};

module.exports = {
  getInventoryTransactions,
  getInventoryTransactionById,
  getInventoryTransactionByReferenceNo,
  getInventoryBatchById,
  getInventoryBatchByIdForUpdate,
  getAvailableInventoryBatchesByItemIdForUpdate,
  getDistributableInventoryBatchesByItemIdForUpdate,
  getDistributableInventoryBatchesByItemIdsForUpdate,
  getDisasterEventById,
  getUserById,
  insertInventoryTransaction,
  updateInventoryBatchQuantityAndStatus,
  ensureInventoryDomainEffectIntent,
  claimInventoryDomainEffectIntentById,
  claimPendingInventoryDomainEffectIntents,
  markInventoryDomainEffectAuditProcessed,
  markInventoryDomainEffectAlertsProcessed,
  markInventoryDomainEffectIntentProcessed,
  markInventoryDomainEffectIntentFailed,
};
