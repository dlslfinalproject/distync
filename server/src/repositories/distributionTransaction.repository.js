const pool = require("../config/db");

const getDistributionReceiptSequence = async (dbClient) => {
  const currentYear = new Date().getFullYear();
  const receiptPrefix = `RCPT-${currentYear}-`;
  const advisoryLockNamespace = 4119;

  await dbClient.query("SELECT pg_advisory_xact_lock($1, $2)", [
    advisoryLockNamespace,
    currentYear,
  ]);

  const sequenceQuery = `
    SELECT
      COALESCE(
        MAX(CAST(SUBSTRING(receipt_no FROM '^RCPT-\\d{4}-(\\d{6})$') AS INTEGER)),
        0
      ) + 1 AS next_sequence
    FROM distribution_transactions
    WHERE receipt_no LIKE $1
  `;

  const sequenceResult = await dbClient.query(sequenceQuery, [`${receiptPrefix}%`]);
  const nextSequence = Number(sequenceResult.rows[0]?.next_sequence || 1);

  return `${receiptPrefix}${String(nextSequence).padStart(6, "0")}`;
};

const getStubByIdForUpdate = async (stubId, dbClient) => {
  const query = `
    SELECT
      s.id,
      s.disaster_event_id,
      s.household_id,
      s.stub_no,
      s.serial_no,
      s.status,
      s.qr_code_value,
      s.qr_generated_at,
      s.qr_generated_by,
      s.qr_status,
      s.qr_notes,
      s.claimed_at,
      de.status AS disaster_event_status,
      h.barangay_id,
      h.household_size,
      h.current_stay_type,
      h.is_active,
      h.family_head_first_name,
      h.family_head_middle_name,
      h.family_head_last_name,
      h.family_head_suffix
    FROM stubs s
    INNER JOIN disaster_events de ON de.id = s.disaster_event_id
    INNER JOIN households h ON h.id = s.household_id
    WHERE s.id = $1
    FOR UPDATE
  `;

  const result = await dbClient.query(query, [stubId]);
  return result.rows[0] || null;
};

const getInventoryBatchByIdForUpdate = async (batchId, dbClient) => {
  const query = `
    SELECT
      ib.id,
      ib.inventory_item_id,
      ib.batch_no,
      ib.quantity_available,
      ib.stock_version,
      ib.expiration_date,
      ib.status,
      ii.item_code,
      ii.item_name,
      ii.unit_of_measure
    FROM inventory_batches ib
    INNER JOIN inventory_items ii ON ii.id = ib.inventory_item_id
    WHERE ib.id = $1
    FOR UPDATE
  `;

  const result = await dbClient.query(query, [batchId]);
  return result.rows[0] || null;
};

const getReliefPackTemplateByIdForUpdate = async (templateId, dbClient) => {
  const query = `
    SELECT
      id,
      name,
      description,
      based_on_family_size,
      based_on_sector,
      is_additional_pack,
      sector_id,
      applies_to_all_disasters,
      is_active
    FROM relief_pack_templates
    WHERE id = $1
    FOR SHARE
  `;

  const result = await dbClient.query(query, [templateId]);
  return result.rows[0] || null;
};

const getReliefPackTemplateItemsByTemplateIdForUpdate = async (templateId, dbClient) => {
  const query = `
    SELECT
      rpti.id,
      rpti.template_id,
      rpti.inventory_item_id,
      rpti.quantity_required,
      ii.item_code,
      ii.item_name,
      ii.unit_of_measure,
      ii.is_active
    FROM relief_pack_template_items rpti
    INNER JOIN inventory_items ii ON ii.id = rpti.inventory_item_id
    WHERE rpti.template_id = $1
    ORDER BY ii.item_name ASC
  `;

  const result = await dbClient.query(query, [templateId]);
  return result.rows;
};

const getLatestAttendanceByHouseholdId = async (
  householdId,
  disasterEventId,
  dbClient,
) => {
  const query = `
    SELECT
      id,
      household_id,
      disaster_event_id,
      status,
      time_in,
      time_out
    FROM evacuation_logs
    WHERE household_id = $1
      AND disaster_event_id = $2
    ORDER BY
      COALESCE(time_out, time_in) DESC,
      updated_at DESC,
      created_at DESC
    LIMIT 1
  `;

  const result = await dbClient.query(query, [householdId, disasterEventId]);
  return result.rows[0] || null;
};

const getAvailableInventoryBatchesByItemIdForUpdate = async (
  inventoryItemId,
  dbClient,
) => {
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
      ii.item_code,
      ii.item_name,
      ii.unit_of_measure
    FROM inventory_batches ib
    INNER JOIN inventory_items ii ON ii.id = ib.inventory_item_id
    WHERE ib.inventory_item_id = $1
      AND COALESCE(ib.quantity_available, 0) > 0
      AND ib.status IN ('AVAILABLE', 'LOW_STOCK')
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
      ib.received_at ASC NULLS LAST,
      ib.created_at ASC,
      ib.batch_no ASC
    FOR UPDATE OF ib
  `;

  const result = await dbClient.query(query, [inventoryItemId]);
  return result.rows;
};

const getDonatedReliefPackItemsByDisasterEventId = async (
  disasterEventId,
  dbClient = pool,
  { forUpdate = false } = {},
) => {
  const query = `
    SELECT
      d.id AS donation_id,
      d.donor_name,
      d.received_at AS donation_received_at,
      d.created_at AS donation_created_at,
      di.id AS donation_item_id,
      di.inventory_item_id,
      di.inventory_batch_id,
      di.quantity_received,
      di.remarks,
      di.created_at AS donation_item_created_at,
      ib.batch_no,
      ib.quantity_available,
      ib.stock_version,
      ib.expiration_date,
      ib.status,
      ii.item_code,
      ii.item_name,
      ii.unit_of_measure
    FROM donation_items di
    INNER JOIN donations d ON d.id = di.donation_id
    INNER JOIN inventory_batches ib ON ib.id = di.inventory_batch_id
    INNER JOIN inventory_items ii ON ii.id = di.inventory_item_id
    WHERE d.disaster_event_id = $1
      AND d.status <> 'CANCELLED'
      AND ib.source_type = 'DONATED'
      AND COALESCE(di.remarks, '') ILIKE 'Relief Pack:%'
    ORDER BY
      d.received_at ASC,
      d.created_at ASC,
      d.id ASC,
      di.created_at ASC,
      ii.item_name ASC
    ${forUpdate ? "FOR UPDATE OF ib" : ""}
  `;

  const result = await dbClient.query(query, [disasterEventId]);
  return result.rows;
};

const getAvailableDonatedLooseItemsByDisasterEventId = async (
  disasterEventId,
  dbClient = pool,
  { forUpdate = false } = {},
) => {
  const query = `
    SELECT
      d.id AS donation_id,
      d.donor_name,
      d.received_at AS donation_received_at,
      d.created_at AS donation_created_at,
      di.id AS donation_item_id,
      di.inventory_item_id,
      di.inventory_batch_id,
      di.quantity_received,
      di.remarks,
      ib.batch_no,
      ib.quantity_available,
      ib.stock_version,
      ib.expiration_date,
      ib.status,
      ii.item_code,
      ii.item_name,
      ii.unit_of_measure
    FROM donation_items di
    INNER JOIN donations d ON d.id = di.donation_id
    INNER JOIN inventory_batches ib ON ib.id = di.inventory_batch_id
    INNER JOIN inventory_items ii ON ii.id = di.inventory_item_id
    WHERE d.disaster_event_id = $1
      AND d.status <> 'CANCELLED'
      AND ib.source_type = 'DONATED'
      AND COALESCE(di.remarks, '') NOT ILIKE 'Relief Pack:%'
      AND COALESCE(ib.quantity_available, 0) > 0
      AND ib.status IN ('AVAILABLE', 'LOW_STOCK')
      AND (
        ib.expiration_date IS NULL
        OR ib.expiration_date >= CURRENT_DATE
      )
    ORDER BY
      d.received_at ASC,
      d.created_at ASC,
      d.id ASC,
      di.created_at ASC,
      ii.item_name ASC
    ${forUpdate ? "FOR UPDATE OF ib" : ""}
  `;

  const result = await dbClient.query(query, [disasterEventId]);
  return result.rows;
};

const updateDonationStatusesByIds = async (donationIds, dbClient) => {
  if (!Array.isArray(donationIds) || donationIds.length === 0) {
    return [];
  }

  const query = `
    WITH donation_totals AS (
      SELECT
        d.id,
        COALESCE(SUM(di.quantity_received), 0)::integer AS quantity_received,
        COALESCE(SUM(ib.quantity_available), 0)::integer AS quantity_available
      FROM donations d
      LEFT JOIN donation_items di ON di.donation_id = d.id
      LEFT JOIN inventory_batches ib ON ib.id = di.inventory_batch_id
      WHERE d.id = ANY($1::uuid[])
        AND d.status <> 'CANCELLED'
      GROUP BY d.id
    )
    UPDATE donations d
    SET status = CASE
          WHEN donation_totals.quantity_received > 0
            AND donation_totals.quantity_available <= 0
            THEN 'DISTRIBUTED'
          WHEN donation_totals.quantity_available < donation_totals.quantity_received
            THEN 'PARTIALLY_DISTRIBUTED'
          ELSE 'RECEIVED'
        END,
        updated_at = NOW()
    FROM donation_totals
    WHERE d.id = donation_totals.id
    RETURNING d.id, d.status, d.updated_at
  `;

  const result = await dbClient.query(query, [donationIds]);
  return result.rows;
};

const getPresentUnclaimedStubQueuePosition = async (stubId, dbClient = pool) => {
  const query = `
    WITH target_stub AS (
      SELECT
        s.id,
        s.disaster_event_id,
        h.barangay_id
      FROM stubs s
      INNER JOIN households h ON h.id = s.household_id
      WHERE s.id = $1
    ),
    eligible_queue AS (
      SELECT
        s.id,
        ROW_NUMBER() OVER (
          ORDER BY
            latest_attendance.time_in ASC,
            s.issued_at ASC,
            s.id ASC
        )::integer AS queue_position
      FROM stubs s
      INNER JOIN households h ON h.id = s.household_id
      INNER JOIN target_stub target
        ON target.disaster_event_id = s.disaster_event_id
        AND h.barangay_id IS NOT DISTINCT FROM target.barangay_id
      INNER JOIN LATERAL (
        SELECT el.status, el.time_in, el.time_out
        FROM evacuation_logs el
        WHERE el.household_id = h.id
          AND el.disaster_event_id = s.disaster_event_id
        ORDER BY
          COALESCE(el.time_out, el.time_in) DESC,
          el.updated_at DESC,
          el.created_at DESC
        LIMIT 1
      ) latest_attendance ON TRUE
      WHERE s.status = 'ISSUED'
        AND h.current_stay_type = 'EVAC_CENTER'
        AND h.is_active = TRUE
        AND latest_attendance.status = 'PRESENT'
        AND latest_attendance.time_out IS NULL
    )
    SELECT queue_position
    FROM eligible_queue
    WHERE id = $1
  `;

  const result = await dbClient.query(query, [stubId]);
  return Number(result.rows[0]?.queue_position || 0);
};

const getPresentUnclaimedStubQueueContext = async (stubId, dbClient = pool) => {
  const query = `
    WITH target_stub AS (
      SELECT
        s.id,
        s.disaster_event_id,
        h.barangay_id
      FROM stubs s
      INNER JOIN households h ON h.id = s.household_id
      WHERE s.id = $1
    ),
    eligible_queue AS (
      SELECT
        s.id,
        ROW_NUMBER() OVER (
          ORDER BY
            latest_attendance.time_in ASC,
            s.issued_at ASC,
            s.id ASC
        )::integer AS queue_position,
        COUNT(*) OVER ()::integer AS eligible_households_count
      FROM stubs s
      INNER JOIN households h ON h.id = s.household_id
      INNER JOIN target_stub target
        ON target.disaster_event_id = s.disaster_event_id
        AND h.barangay_id IS NOT DISTINCT FROM target.barangay_id
      INNER JOIN LATERAL (
        SELECT el.status, el.time_in, el.time_out
        FROM evacuation_logs el
        WHERE el.household_id = h.id
          AND el.disaster_event_id = s.disaster_event_id
        ORDER BY
          COALESCE(el.time_out, el.time_in) DESC,
          el.updated_at DESC,
          el.created_at DESC
        LIMIT 1
      ) latest_attendance ON TRUE
      WHERE s.status = 'ISSUED'
        AND h.current_stay_type = 'EVAC_CENTER'
        AND h.is_active = TRUE
        AND latest_attendance.status = 'PRESENT'
        AND latest_attendance.time_out IS NULL
    )
    SELECT queue_position, eligible_households_count
    FROM eligible_queue
    WHERE id = $1
  `;

  const result = await dbClient.query(query, [stubId]);

  return {
    queue_position: Number(result.rows[0]?.queue_position || 0),
    eligible_households_count: Number(
      result.rows[0]?.eligible_households_count || 0,
    ),
  };
};

const insertDistributionTransaction = async (transactionData, dbClient) => {
  const query = `
    INSERT INTO distribution_transactions (
      disaster_event_id,
      household_id,
      stub_id,
      distribution_date,
      distribution_status,
      claimed_by_name,
      verified_by,
      device_id,
      is_offline_encoded,
      sync_status,
      qr_reference_value,
      qr_scanned_at,
      qr_scanned_by,
      receipt_no,
      receipt_status,
      received_at,
      relief_pack_template_id,
      remarks,
      created_at,
      updated_at
    )
    VALUES (
      $1, $2, $3, NOW(), $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW(), NOW()
    )
    RETURNING
      id,
      disaster_event_id,
      household_id,
      stub_id,
      distribution_date,
      distribution_status,
      claimed_by_name,
      verified_by,
      device_id,
      is_offline_encoded,
      sync_status,
      qr_reference_value,
      qr_scanned_at,
      qr_scanned_by,
      receipt_no,
      receipt_status,
      received_at,
      relief_pack_template_id,
      remarks,
      created_at,
      updated_at
  `;

  const values = [
    transactionData.disaster_event_id,
    transactionData.household_id,
    transactionData.stub_id,
    transactionData.distribution_status,
    transactionData.claimed_by_name,
    transactionData.verified_by,
    transactionData.device_id,
    transactionData.is_offline_encoded,
    transactionData.sync_status,
    transactionData.qr_reference_value,
    transactionData.qr_scanned_at,
    transactionData.qr_scanned_by,
    transactionData.receipt_no,
    transactionData.receipt_status,
    transactionData.received_at,
    transactionData.relief_pack_template_id,
    transactionData.remarks,
  ];

  const result = await dbClient.query(query, values);
  return result.rows[0];
};

const insertDistributionTransactionItem = async (itemData, dbClient) => {
  const query = `
    INSERT INTO distribution_transaction_items (
      distribution_transaction_id,
      inventory_batch_id,
      inventory_item_id,
      quantity_released,
      created_at
    )
    VALUES ($1, $2, $3, $4, NOW())
    RETURNING
      id,
      distribution_transaction_id,
      inventory_batch_id,
      inventory_item_id,
      quantity_released,
      created_at
  `;

  const values = [
    itemData.distribution_transaction_id,
    itemData.inventory_batch_id,
    itemData.inventory_item_id,
    itemData.quantity_released,
  ];

  const result = await dbClient.query(query, values);
  return result.rows[0];
};

const insertInventoryTransaction = async (transactionData, dbClient) => {
  const query = `
    INSERT INTO inventory_transactions (
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
    VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8, NOW())
    RETURNING
      id,
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
  `;

  const values = [
    transactionData.disaster_event_id,
    transactionData.inventory_batch_id,
    transactionData.transaction_type,
    transactionData.quantity,
    transactionData.reference_type,
    transactionData.reference_id,
    transactionData.performed_by,
    transactionData.remarks,
  ];

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
      status,
      updated_at
  `;

  const result = await dbClient.query(query, [batchId, quantityAvailable, status]);
  return result.rows[0] || null;
};

const updateStubAsClaimed = async (stubId, dbClient, claimedAt = null) => {
  const query = `
    UPDATE stubs
    SET status = 'CLAIMED',
        claimed_at = COALESCE($2::timestamptz, NOW()),
        updated_at = NOW()
    WHERE id = $1
    RETURNING
      id,
      stub_no,
      serial_no,
      status,
      qr_code_value,
      qr_generated_at,
      qr_generated_by,
      qr_status,
      qr_notes,
      claimed_at,
      updated_at
  `;

  const result = await dbClient.query(query, [stubId, claimedAt]);
  return result.rows[0] || null;
};

const getDistributionTransactionByIdForUpdate = async (transactionId, dbClient) => {
  const query = `
    SELECT
      dt.id,
      dt.disaster_event_id,
      dt.household_id,
      dt.stub_id,
      dt.distribution_date,
      dt.distribution_status,
      dt.claimed_by_name,
      dt.verified_by,
      dt.qr_reference_value,
      dt.receipt_no,
      dt.receipt_status,
      dt.received_at,
      dt.relief_pack_template_id,
      dt.remarks,
      dt.sync_status,
      dt.created_at,
      dt.updated_at,
      s.stub_no,
      s.serial_no,
      s.status AS stub_status,
      h.barangay_id,
      h.family_head_first_name,
      h.family_head_middle_name,
      h.family_head_last_name,
      h.family_head_suffix
    FROM distribution_transactions dt
    INNER JOIN households h ON h.id = dt.household_id
    INNER JOIN stubs s ON s.id = dt.stub_id
    WHERE dt.id = $1
    FOR UPDATE
  `;

  const result = await dbClient.query(query, [transactionId]);
  return result.rows[0] || null;
};

const getDistributionTransactionItemsForUpdate = async (
  distributionTransactionId,
  dbClient,
) => {
  const query = `
    SELECT
      dti.id,
      dti.distribution_transaction_id,
      dti.inventory_batch_id,
      dti.inventory_item_id,
      dti.quantity_released,
      ib.batch_no,
      ib.quantity_available,
      ib.status,
      ii.item_name,
      ii.unit_of_measure
    FROM distribution_transaction_items dti
    INNER JOIN inventory_batches ib ON ib.id = dti.inventory_batch_id
    INNER JOIN inventory_items ii ON ii.id = dti.inventory_item_id
    WHERE dti.distribution_transaction_id = $1
    FOR UPDATE OF ib
  `;

  const result = await dbClient.query(query, [distributionTransactionId]);
  return result.rows;
};

const getLatestDistributionReliefSourcesByStubIds = async (stubIds = []) => {
  if (!Array.isArray(stubIds) || stubIds.length === 0) {
    return [];
  }

  const query = `
    WITH latest_distributions AS (
      SELECT DISTINCT ON (dt.stub_id)
        dt.id,
        dt.stub_id,
        dt.relief_pack_template_id,
        dt.distribution_date,
        dt.received_at
      FROM distribution_transactions dt
      WHERE dt.stub_id = ANY($1::uuid[])
      ORDER BY dt.stub_id, dt.distribution_date DESC, dt.created_at DESC
    )
    SELECT
      ld.stub_id,
      ld.distribution_date,
      ld.received_at,
      rpt.name AS relief_pack_template_name,
      d.donor_name,
      di.remarks AS donation_item_remarks,
      COALESCE(di.remarks, '') ILIKE 'Relief Pack:%' AS is_relief_pack_donation
    FROM latest_distributions ld
    LEFT JOIN relief_pack_templates rpt ON rpt.id = ld.relief_pack_template_id
    LEFT JOIN distribution_transaction_items dti
      ON dti.distribution_transaction_id = ld.id
    LEFT JOIN inventory_batches ib ON ib.id = dti.inventory_batch_id
    LEFT JOIN donation_items di
      ON di.inventory_batch_id = ib.id
      AND di.inventory_item_id = dti.inventory_item_id
    LEFT JOIN donations d ON d.id = di.donation_id
    ORDER BY ld.stub_id ASC, rpt.name ASC, d.donor_name ASC, di.remarks ASC
  `;

  const result = await pool.query(query, [stubIds]);
  return result.rows;
};

const updateDistributionTransactionStatus = async (
  transactionId,
  {
    distribution_status,
    receipt_status,
    remarks,
  },
  dbClient,
) => {
  const query = `
    UPDATE distribution_transactions
    SET distribution_status = $2,
        receipt_status = $3,
        remarks = $4,
        updated_at = NOW()
    WHERE id = $1
    RETURNING
      id,
      disaster_event_id,
      household_id,
      stub_id,
      distribution_date,
      distribution_status,
      claimed_by_name,
      verified_by,
      qr_reference_value,
      receipt_no,
      receipt_status,
      received_at,
      relief_pack_template_id,
      remarks,
      sync_status,
      created_at,
      updated_at
  `;

  const result = await dbClient.query(query, [
    transactionId,
    distribution_status,
    receipt_status,
    remarks,
  ]);
  return result.rows[0] || null;
};

const updateStubStatus = async (stubId, status, dbClient) => {
  const query = `
    UPDATE stubs
    SET status = $2,
        updated_at = NOW()
    WHERE id = $1
    RETURNING
      id,
      stub_no,
      serial_no,
      status,
      qr_code_value,
      qr_generated_at,
      qr_generated_by,
      qr_status,
      qr_notes,
      claimed_at,
      updated_at
  `;

  const result = await dbClient.query(query, [stubId, status]);
  return result.rows[0] || null;
};

const DISTRIBUTION_HISTORY_SORTS = {
  newest: {
    detail: "distribution_date DESC, created_at DESC, id DESC",
    summary:
      "latest_distribution_date DESC NULLS LAST, start_date DESC NULLS LAST, disaster_event_id DESC",
  },
  oldest: {
    detail: "distribution_date ASC, created_at ASC, id ASC",
    summary:
      "latest_distribution_date ASC NULLS LAST, start_date ASC NULLS LAST, disaster_event_id ASC",
  },
  az: {
    detail:
      "family_head_name ASC NULLS LAST, distribution_date DESC, created_at DESC, id DESC",
    summary:
      "disaster_event_title ASC NULLS LAST, latest_distribution_date DESC NULLS LAST, disaster_event_id ASC",
  },
  za: {
    detail:
      "family_head_name DESC NULLS LAST, distribution_date DESC, created_at DESC, id DESC",
    summary:
      "disaster_event_title DESC NULLS LAST, latest_distribution_date DESC NULLS LAST, disaster_event_id DESC",
  },
};

const getDistributionHistoryOrderBy = (sortOrder = "newest", mode = "detail") =>
  DISTRIBUTION_HISTORY_SORTS[sortOrder]?.[mode] ||
  DISTRIBUTION_HISTORY_SORTS.newest[mode];

const buildDistributionHistoryFilters = ({
  barangayId = null,
  disasterEventId = null,
  status = null,
  dateFrom = null,
  dateTo = null,
  search = "",
} = {}) => {
  const values = [];
  const conditions = [];

  if (barangayId) {
    values.push(barangayId);
    conditions.push(`h.barangay_id = $${values.length}`);
  }

  if (disasterEventId) {
    values.push(disasterEventId);
    conditions.push(`dt.disaster_event_id = $${values.length}`);
  }

  if (status) {
    values.push(status);
    conditions.push(`dt.distribution_status = $${values.length}`);
  }

  if (dateFrom) {
    values.push(dateFrom);
    conditions.push(`dt.distribution_date >= $${values.length}`);
  }

  if (dateTo) {
    values.push(dateTo);
    conditions.push(`dt.distribution_date < ($${values.length}::date + INTERVAL '1 day')`);
  }

  const normalizedSearch = String(search || "").trim();

  if (normalizedSearch) {
    values.push(`%${normalizedSearch}%`);
    const searchParam = `$${values.length}`;
    conditions.push(`(
      CONCAT_WS(' ', h.family_head_first_name, h.family_head_middle_name, h.family_head_last_name, h.family_head_suffix) ILIKE ${searchParam}
      OR b.name ILIKE ${searchParam}
      OR s.stub_no ILIKE ${searchParam}
      OR s.serial_no ILIKE ${searchParam}
      OR CONCAT_WS(' ', u.first_name, u.middle_name, u.last_name) ILIKE ${searchParam}
      OR CONCAT(
        'STUB#',
        (
          SELECT COUNT(*)::int
          FROM stubs sequence_stubs
          INNER JOIN households sequence_households
            ON sequence_households.id = sequence_stubs.household_id
          WHERE sequence_stubs.disaster_event_id = s.disaster_event_id
            AND sequence_households.barangay_id IS NOT DISTINCT FROM h.barangay_id
            AND sequence_households.current_stay_type = 'EVAC_CENTER'
            AND sequence_stubs.status IN ('ISSUED', 'CLAIMED')
            AND (
              sequence_stubs.issued_at < s.issued_at
              OR (
                sequence_stubs.issued_at = s.issued_at
                AND sequence_stubs.id <= s.id
              )
            )
        )
      ) ILIKE ${searchParam}
      OR de.title ILIKE ${searchParam}
      OR de.event_code ILIKE ${searchParam}
      OR rpt.name ILIKE ${searchParam}
      OR EXISTS (
        SELECT 1
        FROM distribution_transaction_items dti_search
        INNER JOIN inventory_items ii_search
          ON ii_search.id = dti_search.inventory_item_id
        WHERE dti_search.distribution_transaction_id = dt.id
          AND ii_search.item_name ILIKE ${searchParam}
      )
      OR EXISTS (
        SELECT 1
        FROM household_sectors hs_search
        INNER JOIN sectors household_sector_search
          ON household_sector_search.id = hs_search.sector_id
        WHERE hs_search.household_id = h.id
          AND (
            household_sector_search.name ILIKE ${searchParam}
            OR household_sector_search.code ILIKE ${searchParam}
          )
      )
      OR EXISTS (
        SELECT 1
        FROM evacuees e_search
        INNER JOIN evacuee_sectors es_search
          ON es_search.evacuee_id = e_search.id
        INNER JOIN sectors member_sector_search
          ON member_sector_search.id = es_search.sector_id
        WHERE e_search.household_id = h.id
          AND e_search.is_active = TRUE
          AND (
            member_sector_search.name ILIKE ${searchParam}
            OR member_sector_search.code ILIKE ${searchParam}
          )
      )
    )`);
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  return {
    values,
    whereClause,
  };
};

const buildDistributionHistoryLimitClause = ({ values, limit, offset }) => {
  if (!Number.isInteger(limit)) {
    return "";
  }

  values.push(limit);
  const limitParam = `$${values.length}`;

  if (!Number.isInteger(offset)) {
    return `LIMIT ${limitParam}`;
  }

  values.push(offset);
  return `LIMIT ${limitParam} OFFSET $${values.length}`;
};

const selectDistributionHistoryRows = async ({
  barangayId = null,
  disasterEventId = null,
  status = null,
  dateFrom = null,
  dateTo = null,
  search = "",
  sortOrder = "newest",
  limit = 100,
  offset = null,
}) => {
  const { values, whereClause } = buildDistributionHistoryFilters({
    barangayId,
    disasterEventId,
    status,
    dateFrom,
    dateTo,
    search,
  });
  const limitClause = buildDistributionHistoryLimitClause({
    values,
    limit,
    offset,
  });
  const orderBy = getDistributionHistoryOrderBy(sortOrder, "detail");

  const query = `
    WITH history_base AS (
      SELECT
        dt.id,
        dt.disaster_event_id,
        dt.household_id,
        dt.stub_id,
        dt.distribution_date,
        dt.distribution_status,
        dt.claimed_by_name,
        dt.verified_by,
        dt.qr_reference_value,
        dt.receipt_no,
        dt.receipt_status,
        dt.received_at,
        dt.relief_pack_template_id,
        dt.remarks,
        dt.sync_status,
        dt.created_at,
        dt.updated_at,
        de.event_code,
        de.title AS disaster_event_title,
        de.status AS disaster_event_status,
        de.start_date,
        b.id AS barangay_id,
        b.name AS barangay_name,
        s.stub_no,
        s.serial_no,
        h.household_size,
        CONCAT_WS(
          ' ',
          h.family_head_first_name,
          h.family_head_middle_name,
          h.family_head_last_name,
          h.family_head_suffix
        ) AS family_head_name,
        CONCAT_WS(
          ' ',
          u.first_name,
          u.middle_name,
          u.last_name
        ) AS verified_by_name,
        rpt.name AS relief_pack_template_name
      FROM distribution_transactions dt
      INNER JOIN households h ON h.id = dt.household_id
      INNER JOIN barangays b ON b.id = h.barangay_id
      INNER JOIN disaster_events de ON de.id = dt.disaster_event_id
      INNER JOIN stubs s ON s.id = dt.stub_id
      LEFT JOIN users u ON u.id = dt.verified_by
      LEFT JOIN relief_pack_templates rpt ON rpt.id = dt.relief_pack_template_id
      ${whereClause}
    )
    SELECT
      history_base.*,
      (
        SELECT COUNT(*)::int
        FROM stubs sequence_stubs
        INNER JOIN households sequence_households
          ON sequence_households.id = sequence_stubs.household_id
        WHERE sequence_stubs.disaster_event_id = history_base.disaster_event_id
          AND sequence_households.barangay_id IS NOT DISTINCT FROM history_base.barangay_id
          AND sequence_households.current_stay_type = 'EVAC_CENTER'
          AND sequence_stubs.status IN ('ISSUED', 'CLAIMED')
          AND (
            sequence_stubs.issued_at < (
              SELECT current_stub.issued_at FROM stubs current_stub WHERE current_stub.id = history_base.stub_id
            )
            OR (
              sequence_stubs.issued_at = (
                SELECT current_stub.issued_at FROM stubs current_stub WHERE current_stub.id = history_base.stub_id
              )
              AND sequence_stubs.id <= history_base.stub_id
            )
          )
      ) AS stub_sequence_no,
      (
        SELECT COUNT(*)::int
        FROM evacuees e
        WHERE e.household_id = history_base.household_id
      ) AS members_count,
      COALESCE(item_summary.total_quantity_released, 0) AS total_quantity_released,
      COALESCE(item_summary.released_items_summary, '') AS released_items_summary
    FROM history_base
    LEFT JOIN LATERAL (
      SELECT
        SUM(dti.quantity_released)::integer AS total_quantity_released,
        STRING_AGG(
          CONCAT(ii.item_name, ' x', dti.quantity_released),
          ', '
          ORDER BY ib.received_at ASC, ib.created_at ASC, ii.item_name ASC
        ) AS released_items_summary
      FROM distribution_transaction_items dti
      INNER JOIN inventory_items ii ON ii.id = dti.inventory_item_id
      INNER JOIN inventory_batches ib ON ib.id = dti.inventory_batch_id
      WHERE dti.distribution_transaction_id = history_base.id
    ) item_summary ON TRUE
    ORDER BY ${orderBy}
    ${limitClause}
  `;

  const result = await pool.query(query, values);
  return result.rows;
};

const countDistributionHistory = async ({
  barangayId = null,
  disasterEventId = null,
  status = null,
  dateFrom = null,
  dateTo = null,
  search = "",
}) => {
  const { values, whereClause } = buildDistributionHistoryFilters({
    barangayId,
    disasterEventId,
    status,
    dateFrom,
    dateTo,
    search,
  });

  const query = `
    SELECT COUNT(DISTINCT dt.id)::int AS total_items
    FROM distribution_transactions dt
    INNER JOIN households h ON h.id = dt.household_id
    INNER JOIN barangays b ON b.id = h.barangay_id
    INNER JOIN disaster_events de ON de.id = dt.disaster_event_id
    INNER JOIN stubs s ON s.id = dt.stub_id
    LEFT JOIN users u ON u.id = dt.verified_by
    LEFT JOIN relief_pack_templates rpt ON rpt.id = dt.relief_pack_template_id
    ${whereClause}
  `;

  const result = await pool.query(query, values);
  return Number(result.rows[0]?.total_items || 0);
};

const buildSummarySearchClause = ({ values, search = "" }) => {
  const normalizedSearch = String(search || "").trim();

  if (!normalizedSearch) {
    return "";
  }

  values.push(`%${normalizedSearch}%`);
  const searchParam = `$${values.length}`;

  return `AND EXISTS (
      SELECT 1
      FROM distribution_transactions dt_search
      INNER JOIN households h_search ON h_search.id = dt_search.household_id
      INNER JOIN barangays b_search ON b_search.id = h_search.barangay_id
      INNER JOIN stubs s_search ON s_search.id = dt_search.stub_id
      LEFT JOIN users u_search ON u_search.id = dt_search.verified_by
      LEFT JOIN relief_pack_templates rpt_search
        ON rpt_search.id = dt_search.relief_pack_template_id
      WHERE dt_search.disaster_event_id = de.id
        AND ($1::uuid IS NULL OR h_search.barangay_id = $1::uuid)
        AND ($2::text IS NULL OR dt_search.distribution_status = $2::text)
        AND ($3::timestamptz IS NULL OR dt_search.distribution_date >= $3::timestamptz)
        AND ($4::date IS NULL OR dt_search.distribution_date < ($4::date + INTERVAL '1 day'))
        AND (
          CONCAT_WS(
            ' ',
            h_search.family_head_first_name,
            h_search.family_head_middle_name,
            h_search.family_head_last_name,
            h_search.family_head_suffix
          ) ILIKE ${searchParam}
          OR b_search.name ILIKE ${searchParam}
          OR s_search.stub_no ILIKE ${searchParam}
          OR s_search.serial_no ILIKE ${searchParam}
          OR CONCAT_WS(
            ' ',
            u_search.first_name,
            u_search.middle_name,
            u_search.last_name
          ) ILIKE ${searchParam}
          OR CONCAT(
            'STUB#',
            (
              SELECT COUNT(*)::int
              FROM stubs sequence_stubs
              INNER JOIN households sequence_households
                ON sequence_households.id = sequence_stubs.household_id
              WHERE sequence_stubs.disaster_event_id = s_search.disaster_event_id
                AND sequence_households.barangay_id IS NOT DISTINCT FROM h_search.barangay_id
                AND sequence_households.current_stay_type = 'EVAC_CENTER'
                AND sequence_stubs.status IN ('ISSUED', 'CLAIMED')
                AND (
                  sequence_stubs.issued_at < s_search.issued_at
                  OR (
                    sequence_stubs.issued_at = s_search.issued_at
                    AND sequence_stubs.id <= s_search.id
                  )
                )
            )
          ) ILIKE ${searchParam}
          OR rpt_search.name ILIKE ${searchParam}
          OR EXISTS (
            SELECT 1
            FROM distribution_transaction_items dti_search
            INNER JOIN inventory_items ii_search
              ON ii_search.id = dti_search.inventory_item_id
            WHERE dti_search.distribution_transaction_id = dt_search.id
              AND ii_search.item_name ILIKE ${searchParam}
          )
          OR EXISTS (
            SELECT 1
            FROM household_sectors hs_search
            INNER JOIN sectors household_sector_search
              ON household_sector_search.id = hs_search.sector_id
            WHERE hs_search.household_id = h_search.id
              AND (
                household_sector_search.name ILIKE ${searchParam}
                OR household_sector_search.code ILIKE ${searchParam}
              )
          )
          OR EXISTS (
            SELECT 1
            FROM evacuees e_search
            INNER JOIN evacuee_sectors es_search
              ON es_search.evacuee_id = e_search.id
            INNER JOIN sectors member_sector_search
              ON member_sector_search.id = es_search.sector_id
            WHERE e_search.household_id = h_search.id
              AND e_search.is_active = TRUE
              AND (
                member_sector_search.name ILIKE ${searchParam}
                OR member_sector_search.code ILIKE ${searchParam}
              )
          )
        )
    )`;
};

const buildDistributionHistorySummaryQuery = ({
  barangayId = null,
  status = null,
  dateFrom = null,
  dateTo = null,
  search = "",
  sortOrder = "newest",
  limit = 25,
  offset = null,
  countOnly = false,
}) => {
  const values = [
    barangayId || null,
    status || null,
    dateFrom || null,
    dateTo || null,
    ["ACTIVE", "CLOSED", "ARCHIVED"],
  ];
  const searchClause = buildSummarySearchClause({ values, search });
  const limitClause = countOnly
    ? ""
    : buildDistributionHistoryLimitClause({ values, limit, offset });
  const orderBy = getDistributionHistoryOrderBy(sortOrder, "summary");

  const summaryCte = `
    WITH summary_rows AS (
      SELECT
        de.id AS disaster_event_id,
        de.event_code,
        de.title AS disaster_event_title,
        de.status AS disaster_event_status,
        de.start_date,
        COALESCE(barangay_summary.barangay_summary, '--') AS barangay_summary,
        COALESCE(barangay_summary.barangay_count, 0)::int AS barangay_count,
        COALESCE(stub_summary.issued_stubs_count, 0)::int AS issued_stubs_count,
        COALESCE(stub_summary.claimed_stubs_count, 0)::int AS claimed_stubs_count,
        COALESCE(stub_summary.unclaimed_stubs_count, 0)::int AS unclaimed_stubs_count,
        COALESCE(relief_summary.relief_pack_summary, '--') AS relief_pack_summary,
        distribution_summary.latest_distribution_date
      FROM disaster_events de
      LEFT JOIN LATERAL (
        SELECT
          STRING_AGG(DISTINCT b.name, ', ' ORDER BY b.name) AS barangay_summary,
          COUNT(DISTINCT b.id)::int AS barangay_count
        FROM disaster_event_barangays deb
        INNER JOIN barangays b ON b.id = deb.barangay_id
        WHERE deb.disaster_event_id = de.id
          AND ($1::uuid IS NULL OR deb.barangay_id = $1::uuid)
      ) barangay_summary ON TRUE
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*) FILTER (WHERE s.status = 'CLAIMED')::int AS claimed_stubs_count,
          COUNT(*) FILTER (WHERE s.status = 'ISSUED')::int AS unclaimed_stubs_count,
          COUNT(*) FILTER (WHERE s.status IN ('ISSUED', 'CLAIMED'))::int AS issued_stubs_count
        FROM stubs s
        INNER JOIN households h ON h.id = s.household_id
        WHERE s.disaster_event_id = de.id
          AND ($1::uuid IS NULL OR h.barangay_id = $1::uuid)
      ) stub_summary ON TRUE
      LEFT JOIN LATERAL (
        SELECT MAX(dt.distribution_date) AS latest_distribution_date
        FROM distribution_transactions dt
        INNER JOIN households h ON h.id = dt.household_id
        WHERE dt.disaster_event_id = de.id
          AND ($1::uuid IS NULL OR h.barangay_id = $1::uuid)
          AND ($2::text IS NULL OR dt.distribution_status = $2::text)
          AND ($3::timestamptz IS NULL OR dt.distribution_date >= $3::timestamptz)
          AND ($4::date IS NULL OR dt.distribution_date < ($4::date + INTERVAL '1 day'))
      ) distribution_summary ON TRUE
      LEFT JOIN LATERAL (
        SELECT STRING_AGG(DISTINCT relief_name, ', ' ORDER BY relief_name) AS relief_pack_summary
        FROM (
          SELECT COALESCE(rpt.name, item_summary.released_items_summary) AS relief_name
          FROM distribution_transactions dt
          INNER JOIN households h ON h.id = dt.household_id
          LEFT JOIN relief_pack_templates rpt ON rpt.id = dt.relief_pack_template_id
          LEFT JOIN LATERAL (
            SELECT STRING_AGG(
              CONCAT(ii.item_name, ' x', dti.quantity_released),
              ', '
              ORDER BY ib.received_at ASC, ib.created_at ASC, ii.item_name ASC
            ) AS released_items_summary
            FROM distribution_transaction_items dti
            INNER JOIN inventory_items ii ON ii.id = dti.inventory_item_id
            INNER JOIN inventory_batches ib ON ib.id = dti.inventory_batch_id
            WHERE dti.distribution_transaction_id = dt.id
          ) item_summary ON TRUE
          WHERE dt.disaster_event_id = de.id
            AND ($1::uuid IS NULL OR h.barangay_id = $1::uuid)
            AND ($2::text IS NULL OR dt.distribution_status = $2::text)
            AND ($3::timestamptz IS NULL OR dt.distribution_date >= $3::timestamptz)
            AND ($4::date IS NULL OR dt.distribution_date < ($4::date + INTERVAL '1 day'))
        ) relief_names
        WHERE relief_name IS NOT NULL AND relief_name <> ''
      ) relief_summary ON TRUE
      WHERE de.status = ANY($5::text[])
        AND EXISTS (
          SELECT 1
          FROM disaster_event_barangays deb_scope
          WHERE deb_scope.disaster_event_id = de.id
            AND ($1::uuid IS NULL OR deb_scope.barangay_id = $1::uuid)
        )
        ${searchClause}
    )
  `;

  if (countOnly) {
    return {
      query: `
        ${summaryCte}
        SELECT COUNT(*)::int AS total_items
        FROM summary_rows
      `,
      values,
    };
  }

  return {
    query: `
      ${summaryCte}
      SELECT *
      FROM summary_rows
      ORDER BY ${orderBy}
      ${limitClause}
    `,
    values,
  };
};

const getDistributionHistorySummaryRows = async (options = {}) => {
  const { query, values } = buildDistributionHistorySummaryQuery(options);
  const result = await pool.query(query, values);
  return result.rows;
};

const countDistributionHistorySummaryRows = async (options = {}) => {
  const { query, values } = buildDistributionHistorySummaryQuery({
    ...options,
    countOnly: true,
  });
  const result = await pool.query(query, values);
  return Number(result.rows[0]?.total_items || 0);
};

const getDistributionHistory = async ({
  barangayId = null,
  disasterEventId = null,
  status = null,
  dateFrom = null,
  dateTo = null,
  search = "",
  sortOrder = "newest",
  limit = 100,
  offset = null,
}) => {
  return selectDistributionHistoryRows({
    barangayId,
    disasterEventId,
    status,
    dateFrom,
    dateTo,
    search,
    sortOrder,
    limit,
    offset,
  });
};

const getDistributionHistoryStubSummaryByEventIds = async ({
  eventIds = [],
  barangayId = null,
}) => {
  if (!Array.isArray(eventIds) || eventIds.length === 0) {
    return [];
  }

  const values = [eventIds];
  let barangayCondition = "";

  if (barangayId) {
    values.push(barangayId);
    barangayCondition = `AND h.barangay_id = $${values.length}`;
  }

  const query = `
    SELECT
      s.disaster_event_id,
      COUNT(*) FILTER (WHERE s.status = 'CLAIMED')::int AS claimed_stubs_count,
      COUNT(*) FILTER (WHERE s.status = 'ISSUED')::int AS unclaimed_stubs_count,
      COUNT(*) FILTER (WHERE s.status IN ('ISSUED', 'CLAIMED'))::int AS issued_stubs_count
    FROM stubs s
    INNER JOIN households h ON h.id = s.household_id
    WHERE s.disaster_event_id = ANY($1::uuid[])
      ${barangayCondition}
    GROUP BY s.disaster_event_id
  `;

  const result = await pool.query(query, values);
  return result.rows;
};

const getDistributionHistoryExportRows = async ({
  barangayId = null,
  disasterEventId = null,
  status = null,
  dateFrom = null,
  dateTo = null,
  search = "",
  sortOrder = "newest",
}) => {
  return getDistributionHistory({
    barangayId,
    disasterEventId,
    status,
    dateFrom,
    dateTo,
    search,
    sortOrder,
    limit: null,
  });
};

const getInventoryDistributionDetailByStubId = async (stubId) => {
  const baseQuery = `
    SELECT
      s.id AS stub_id,
      s.disaster_event_id,
      s.household_id,
      s.stub_no,
      s.serial_no,
      s.status AS stub_status,
      s.issued_at,
      s.claimed_at,
      s.updated_at AS stub_updated_at,
      s.qr_code_value,
      s.qr_generated_at,
      s.qr_status,
      s.qr_notes,
      de.event_code,
      de.title AS disaster_event_title,
      de.disaster_type,
      h.residency_status,
      h.family_head_first_name,
      h.family_head_middle_name,
      h.family_head_last_name,
      h.family_head_suffix,
      h.household_size,
      h.current_stay_type,
      h.current_address_details,
      h.contact_number,
      h.is_active,
      h.registered_at,
      h.registered_by,
      CONCAT_WS(' ', registered_user.first_name, registered_user.middle_name, registered_user.last_name) AS registered_by_name,
      h.family_head_photo_url,
      h.photo_captured_at,
      h.photo_verification_notes,
      b.id AS barangay_id,
      b.code AS barangay_code,
      b.name AS barangay_name
    FROM stubs s
    INNER JOIN disaster_events de ON de.id = s.disaster_event_id
    INNER JOIN households h ON h.id = s.household_id
    LEFT JOIN users registered_user ON registered_user.id = h.registered_by
    LEFT JOIN barangays b ON b.id = h.barangay_id
    WHERE s.id = $1
  `;
  const baseResult = await pool.query(baseQuery, [stubId]);
  const baseRow = baseResult.rows[0] || null;

  if (!baseRow) {
    return null;
  }

  const householdId = baseRow.household_id;

  const membersQuery = `
    SELECT
      id AS evacuee_id,
      household_id,
      first_name,
      middle_name,
      last_name,
      suffix,
      sex,
      age,
      age_value,
      age_unit,
      relationship_to_head,
      is_family_head
    FROM evacuees
    WHERE household_id = $1
      AND is_active = TRUE
    ORDER BY is_family_head DESC, created_at ASC
  `;
  const householdSectorsQuery = `
    SELECT
      hs.household_id,
      s.id,
      s.code,
      s.name
    FROM household_sectors hs
    INNER JOIN sectors s ON s.id = hs.sector_id
    WHERE hs.household_id = $1
    ORDER BY s.name ASC
  `;
  const memberSectorsQuery = `
    SELECT
      e.household_id,
      es.evacuee_id,
      s.id,
      s.code,
      s.name
    FROM evacuee_sectors es
    INNER JOIN evacuees e ON e.id = es.evacuee_id
    INNER JOIN sectors s ON s.id = es.sector_id
    WHERE e.household_id = $1
      AND e.is_active = TRUE
    ORDER BY e.household_id ASC, s.name ASC
  `;
  const attendanceQuery = `
    SELECT
      id,
      household_id,
      disaster_event_id,
      status,
      time_in,
      time_out,
      evacuation_center_id
    FROM evacuation_logs
    WHERE household_id = $1
      AND disaster_event_id = $2
    ORDER BY
      COALESCE(time_out, time_in) DESC,
      updated_at DESC,
      created_at DESC
    LIMIT 1
  `;
  const transactionQuery = `
    SELECT
      dt.id,
      dt.disaster_event_id,
      dt.household_id,
      dt.stub_id,
      dt.distribution_date,
      dt.distribution_status,
      dt.claimed_by_name,
      dt.verified_by,
      CONCAT_WS(' ', u.first_name, u.middle_name, u.last_name) AS verified_by_name,
      dt.qr_reference_value,
      dt.qr_scanned_at,
      dt.receipt_no,
      dt.receipt_status,
      dt.received_at,
      dt.relief_pack_template_id,
      rpt.name AS relief_pack_template_name,
      dt.remarks,
      dt.sync_status,
      dt.created_at,
      dt.updated_at
    FROM distribution_transactions dt
    LEFT JOIN users u ON u.id = dt.verified_by
    LEFT JOIN relief_pack_templates rpt ON rpt.id = dt.relief_pack_template_id
    WHERE dt.stub_id = $1
    ORDER BY dt.distribution_date DESC, dt.created_at DESC
    LIMIT 1
  `;
  const [
    membersResult,
    householdSectorsResult,
    memberSectorsResult,
    attendanceResult,
    transactionResult,
  ] = await Promise.all([
    pool.query(membersQuery, [householdId]),
    pool.query(householdSectorsQuery, [householdId]),
    pool.query(memberSectorsQuery, [householdId]),
    pool.query(attendanceQuery, [householdId, baseRow.disaster_event_id]),
    pool.query(transactionQuery, [stubId]),
  ]);

  const transaction = transactionResult.rows[0] || null;

  return {
    base: baseRow,
    members: membersResult.rows,
    household_sectors: householdSectorsResult.rows,
    member_sectors: memberSectorsResult.rows,
    latest_attendance: attendanceResult.rows[0] || null,
    distribution_transaction: transaction,
  };
};

module.exports = {
  getDistributionReceiptSequence,
  getStubByIdForUpdate,
  getInventoryBatchByIdForUpdate,
  getReliefPackTemplateByIdForUpdate,
  getReliefPackTemplateItemsByTemplateIdForUpdate,
  getLatestAttendanceByHouseholdId,
  getAvailableInventoryBatchesByItemIdForUpdate,
  getDonatedReliefPackItemsByDisasterEventId,
  getAvailableDonatedLooseItemsByDisasterEventId,
  updateDonationStatusesByIds,
  getPresentUnclaimedStubQueuePosition,
  getPresentUnclaimedStubQueueContext,
  insertDistributionTransaction,
  insertDistributionTransactionItem,
  insertInventoryTransaction,
  updateInventoryBatchQuantityAndStatus,
  updateStubAsClaimed,
  getDistributionTransactionByIdForUpdate,
  getDistributionTransactionItemsForUpdate,
  getLatestDistributionReliefSourcesByStubIds,
  updateDistributionTransactionStatus,
  updateStubStatus,
  getDistributionHistory,
  countDistributionHistory,
  getDistributionHistorySummaryRows,
  countDistributionHistorySummaryRows,
  getDistributionHistoryStubSummaryByEventIds,
  getDistributionHistoryExportRows,
  getInventoryDistributionDetailByStubId,
};
