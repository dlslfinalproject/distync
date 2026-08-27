const pool = require("../config/db");
const {
  INVENTORY_BATCH_IDENTITY_CONSTRAINT,
} = require("../utils/inventoryBatchIdentity");

const baseSelectQuery = `
  SELECT
    ib.id,
    ib.inventory_item_id,
    ib.inventory_item_stock_form_id,
    ib.batch_no,
    ib.supplier_id,
    ib.source_type,
    ib.quantity_received,
    ib.quantity_available,
    ib.stock_version,
    ib.expiration_date,
    ib.received_at,
    ib.storage_location,
    ib.status,
    ib.created_by,
    ib.created_at,
    ib.updated_at,
    CAST(COALESCE((
      SELECT SUM(COALESCE(item_stock.quantity_available, 0))
      FROM inventory_batches item_stock
      WHERE item_stock.inventory_item_id = ib.inventory_item_id
    ), 0) AS integer) AS item_total_stock,
    ii.item_code,
    ii.item_name,
    ii.category,
    ii.unit_of_measure,
    ii.reorder_level,
    ii.barcode,
    ii.is_perishable,
    ii.is_active,
    stock_forms.barcode AS stock_form_barcode,
    stock_forms.packaging AS stock_form_packaging,
    stock_forms.units_per_packaging AS stock_form_units_per_packaging,
    stock_forms.unit_of_measure AS stock_form_unit_of_measure,
    stock_forms.unit_of_measure_value AS stock_form_unit_of_measure_value,
    stock_forms.is_active AS stock_form_is_active,
    u.first_name AS created_by_first_name,
    u.last_name AS created_by_last_name,
    s.name AS supplier_name,
    s.contact_person AS supplier_contact_person,
    s.contact_number AS supplier_contact_number,
    s.address AS supplier_address,
    s.has_moa AS supplier_has_moa,
    s.notes AS supplier_notes,
    source_donation.donation_id AS source_donation_id,
    source_donation.donor_name AS source_donor_name
  FROM inventory_batches ib
  INNER JOIN inventory_items ii ON ii.id = ib.inventory_item_id
  LEFT JOIN inventory_item_stock_forms stock_forms
    ON stock_forms.id = ib.inventory_item_stock_form_id
  LEFT JOIN users u ON u.id = ib.created_by
  LEFT JOIN suppliers s ON s.id = ib.supplier_id
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
`;

const getInventoryBatches = async (filters) => {
  const values = [];
  const conditions = [];

  if (filters.inventory_item_id) {
    values.push(filters.inventory_item_id);
    conditions.push(`ib.inventory_item_id = $${values.length}`);
  }

  if (filters.supplier_id) {
    values.push(filters.supplier_id);
    conditions.push(`ib.supplier_id = $${values.length}`);
  }

  if (filters.source_type) {
    values.push(filters.source_type);
    conditions.push(`ib.source_type = $${values.length}`);
  }

  if (filters.status) {
    values.push(filters.status);
    conditions.push(`ib.status = $${values.length}`);
  }

  if (filters.is_expiring === true) {
    conditions.push(
      `ib.expiration_date IS NOT NULL AND ib.expiration_date > CURRENT_DATE AND ib.expiration_date <= CURRENT_DATE + INTERVAL '30 days'`,
    );
  }

  if (filters.is_expired === true) {
    conditions.push(`ib.expiration_date IS NOT NULL AND ib.expiration_date <= CURRENT_DATE`);
  }

  if (filters.search) {
    values.push(`%${filters.search}%`);
    conditions.push(
      `(ib.batch_no ILIKE $${values.length} OR ib.storage_location ILIKE $${values.length} OR ii.item_name ILIKE $${values.length} OR ii.item_code ILIKE $${values.length})`,
    );
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const query = `
    ${baseSelectQuery}
    ${whereClause}
    ORDER BY ib.received_at DESC
  `;

  const result = await pool.query(query, values);
  return result.rows;
};

const getInventoryBatchById = async (id, dbClient = pool) => {
  const query = `
    ${baseSelectQuery}
    WHERE ib.id = $1
  `;

  const result = await dbClient.query(query, [id]);
  return result.rows[0] || null;
};

const getInventoryItemById = async (id, dbClient = pool) => {
  const query = `
    SELECT
      id,
      item_code,
      item_name,
      category,
      unit_of_measure,
      reorder_level,
      CAST(COALESCE((
        SELECT SUM(COALESCE(item_stock.quantity_available, 0))
        FROM inventory_batches item_stock
        WHERE item_stock.inventory_item_id = inventory_items.id
      ), 0) AS integer) AS item_total_stock,
      barcode,
      is_perishable,
      is_active
    FROM inventory_items
    WHERE id = $1
  `;

  const result = await dbClient.query(query, [id]);
  return result.rows[0] || null;
};

const getSupplierById = async (id, dbClient = pool) => {
  const query = `
    SELECT
      id,
      name,
      contact_person,
      contact_number,
      address,
      has_moa,
      notes
    FROM suppliers
    WHERE id = $1
  `;

  const result = await dbClient.query(query, [id]);
  return result.rows[0] || null;
};

const getInventoryBatchByItemIdAndBatchNo = async (
  inventoryItemId,
  batchNo,
  dbClient = pool,
) => {
  const query = `
    SELECT
      id,
      inventory_item_id,
      inventory_item_stock_form_id,
      batch_no,
      supplier_id,
      source_type,
      quantity_received,
      quantity_available,
      stock_version,
      expiration_date,
      received_at,
      storage_location,
      status,
      created_by,
      created_at,
      updated_at
    FROM inventory_batches
    WHERE inventory_item_id = $1
      AND batch_no = $2
  `;

  const result = await dbClient.query(query, [inventoryItemId, batchNo]);
  return result.rows[0] || null;
};

const insertInventoryBatch = async (batchData, dbClient = pool) => {
  const query = `
    INSERT INTO inventory_batches (
      inventory_item_id,
      inventory_item_stock_form_id,
      batch_no,
      supplier_id,
      source_type,
      quantity_received,
      quantity_available,
      expiration_date,
      received_at,
      storage_location,
      status,
      created_by,
      created_at,
      updated_at
    )
    VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, NOW(), $9, $10, $11, NOW(), NOW()
    )
    ON CONFLICT ON CONSTRAINT ${INVENTORY_BATCH_IDENTITY_CONSTRAINT}
    DO NOTHING
    RETURNING
      id,
      inventory_item_id,
      inventory_item_stock_form_id,
      batch_no,
      supplier_id,
      source_type,
      quantity_received,
      quantity_available,
      stock_version,
      expiration_date,
      received_at,
      storage_location,
      status,
      created_by,
      created_at,
      updated_at
  `;

  const values = [
    batchData.inventory_item_id,
    batchData.inventory_item_stock_form_id,
    batchData.batch_no,
    batchData.supplier_id,
    batchData.source_type,
    batchData.quantity_received,
    batchData.quantity_available,
    batchData.expiration_date,
    batchData.storage_location,
    batchData.status,
    batchData.created_by,
  ];

  const result = await dbClient.query(query, values);
  return result.rows[0];
};

const updateInventoryBatchExpiry = async (
  id,
  { expiration_date, status },
  dbClient = pool,
) => {
  const query = `
    UPDATE inventory_batches
    SET expiration_date = $2,
        status = $3,
        updated_at = NOW()
    WHERE id = $1
    RETURNING
      id,
      inventory_item_id,
      inventory_item_stock_form_id,
      batch_no,
      supplier_id,
      source_type,
      quantity_received,
      quantity_available,
      stock_version,
      expiration_date,
      received_at,
      storage_location,
      status,
      created_by,
      created_at,
      updated_at
  `;

  const result = await dbClient.query(query, [id, expiration_date, status]);
  return result.rows[0] || null;
};

module.exports = {
  getInventoryBatches,
  getInventoryBatchById,
  getInventoryItemById,
  getSupplierById,
  getInventoryBatchByItemIdAndBatchNo,
  insertInventoryBatch,
  updateInventoryBatchExpiry,
};
