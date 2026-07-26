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
    it.performed_by,
    it.performed_at,
    it.remarks,
    it.created_at,
    ib.batch_no,
    ib.inventory_item_stock_form_id,
    ib.status AS batch_status,
    ib.quantity_available,
    ib.expiration_date,
    ii.id AS inventory_item_id,
    ii.item_code,
    ii.item_name,
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
      `(ib.batch_no ILIKE $${values.length} OR ii.item_name ILIKE $${values.length} OR ii.item_code ILIKE $${values.length} OR it.remarks ILIKE $${values.length})`,
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
      performed_by,
      performed_at,
      remarks,
      created_at
    )
    VALUES (
      $1, $2, $3, $4, $5, $6, $7, NOW(), $8, NOW()
    )
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
  getInventoryBatchByIdForUpdate,
  getDisasterEventById,
  getUserById,
  insertInventoryTransaction,
  updateInventoryBatchQuantityAndStatus,
};
