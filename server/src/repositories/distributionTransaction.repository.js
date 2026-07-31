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
      h.barangay_id,
      h.household_size,
      h.current_stay_type,
      h.is_active,
      h.family_head_first_name,
      h.family_head_middle_name,
      h.family_head_last_name,
      h.family_head_suffix
    FROM stubs s
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
    ORDER BY
      CASE WHEN ib.expiration_date IS NULL THEN 1 ELSE 0 END,
      ib.expiration_date ASC,
      ib.received_at ASC,
      ib.created_at ASC,
      ib.batch_no ASC
    FOR UPDATE OF ib
  `;

  const result = await dbClient.query(query, [inventoryItemId]);
  return result.rows;
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

const getDistributionHistory = async ({
  barangayId = null,
  disasterEventId = null,
  status = null,
  dateFrom = null,
  dateTo = null,
  limit = 100,
}) => {
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

  values.push(limit);

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

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
      de.event_code,
      de.title AS disaster_event_title,
      de.status AS disaster_event_status,
      b.id AS barangay_id,
      b.name AS barangay_name,
      s.stub_no,
      s.serial_no,
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
      ) AS stub_sequence_no,
      h.household_size,
      (
        SELECT COUNT(*)::int
        FROM evacuees e
        WHERE e.household_id = h.id
      ) AS members_count,
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
      rpt.name AS relief_pack_template_name,
      COALESCE(item_summary.total_quantity_released, 0) AS total_quantity_released,
      COALESCE(item_summary.released_items_summary, '') AS released_items_summary
    FROM distribution_transactions dt
    INNER JOIN households h ON h.id = dt.household_id
    INNER JOIN barangays b ON b.id = h.barangay_id
    INNER JOIN disaster_events de ON de.id = dt.disaster_event_id
    INNER JOIN stubs s ON s.id = dt.stub_id
    LEFT JOIN users u ON u.id = dt.verified_by
    LEFT JOIN relief_pack_templates rpt ON rpt.id = dt.relief_pack_template_id
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
      WHERE dti.distribution_transaction_id = dt.id
    ) item_summary ON TRUE
    ${whereClause}
    ORDER BY dt.distribution_date DESC, dt.created_at DESC
    LIMIT $${values.length}
  `;

  const result = await pool.query(query, values);
  return result.rows;
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
}) => {
  return getDistributionHistory({
    barangayId,
    disasterEventId,
    status,
    dateFrom,
    dateTo,
    limit: 1000,
  });
};

module.exports = {
  getDistributionReceiptSequence,
  getStubByIdForUpdate,
  getInventoryBatchByIdForUpdate,
  getReliefPackTemplateByIdForUpdate,
  getReliefPackTemplateItemsByTemplateIdForUpdate,
  getLatestAttendanceByHouseholdId,
  getAvailableInventoryBatchesByItemIdForUpdate,
  insertDistributionTransaction,
  insertDistributionTransactionItem,
  insertInventoryTransaction,
  updateInventoryBatchQuantityAndStatus,
  updateStubAsClaimed,
  getDistributionTransactionByIdForUpdate,
  getDistributionTransactionItemsForUpdate,
  updateDistributionTransactionStatus,
  updateStubStatus,
  getDistributionHistory,
  getDistributionHistoryStubSummaryByEventIds,
  getDistributionHistoryExportRows,
};
