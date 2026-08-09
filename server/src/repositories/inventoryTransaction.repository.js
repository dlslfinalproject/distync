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
    it.created_at,
    ib.batch_no,
    ib.inventory_item_stock_form_id,
    ib.supplier_id,
    ib.source_type,
    ib.status AS batch_status,
    ib.quantity_available,
    ib.expiration_date,
    ii.id AS inventory_item_id,
    ii.item_code,
    ii.item_name,
    d.id AS donation_id,
    d.donor_name,
    source_donation.donation_id AS source_donation_id,
    source_donation.donor_name AS source_donor_name,
    s.name AS supplier_name,
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
  LEFT JOIN suppliers s ON s.id = ib.supplier_id
  LEFT JOIN inventory_item_stock_forms stock_forms
    ON stock_forms.id = ib.inventory_item_stock_form_id
  LEFT JOIN users u ON u.id = it.performed_by
`;

const getInventoryTransactions = async (filters) => {
  const values = [];
  const conditions = [];

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

  if (filters.search) {
    values.push(`%${filters.search}%`);
    conditions.push(
      `(ib.batch_no ILIKE $${values.length} OR ii.item_name ILIKE $${values.length} OR ii.item_code ILIKE $${values.length} OR it.remarks ILIKE $${values.length} OR it.inventory_transaction_reference_no ILIKE $${values.length})`,
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
    WHERE ib.id = $1
    FOR UPDATE OF ib
  `;

  const result = await dbClient.query(query, [id]);
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
      ib.expiration_date,
      ib.status,
      ii.item_code,
      ii.item_name,
      ii.category,
      ii.unit_of_measure
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

const getDistributableInventoryBatchesByItemIdForUpdate = async (
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
      ib.status,
      ii.item_code,
      ii.item_name,
      ii.category,
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
    FOR UPDATE
  `;

  const result = await dbClient.query(query, [inventoryItemId]);
  return result.rows;
};

const getDisasterEventById = async (id) => {
  const query = `
    SELECT id, event_code, title
    FROM disaster_events
    WHERE id = $1
  `;

  const result = await pool.query(query, [id]);
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
      created_at
    )
    VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, NOW(), $9, NOW()
    )
    ON CONFLICT (inventory_transaction_reference_no)
    WHERE inventory_transaction_reference_no IS NOT NULL
    DO NOTHING
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
      expiration_date,
      status,
      updated_at
  `;

  const result = await dbClient.query(query, [batchId, quantityAvailable, status]);
  return result.rows[0] || null;
};

module.exports = {
  getInventoryTransactions,
  getInventoryTransactionById,
  getInventoryTransactionByReferenceNo,
  getInventoryBatchByIdForUpdate,
  getAvailableInventoryBatchesByItemIdForUpdate,
  getDistributableInventoryBatchesByItemIdForUpdate,
  getDisasterEventById,
  getUserById,
  insertInventoryTransaction,
  updateInventoryBatchQuantityAndStatus,
};
