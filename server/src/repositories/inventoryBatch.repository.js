const pool = require("../config/db");

const baseSelectQuery = `
  SELECT
    ib.id,
    ib.inventory_item_id,
    ib.batch_no,
    ib.supplier_id,
    ib.source_type,
    ib.quantity_received,
    ib.quantity_available,
    ib.expiration_date,
    ib.received_at,
    ib.storage_location,
    ib.status,
    ib.created_by,
    ib.created_at,
    ib.updated_at,
    ii.item_code,
    ii.item_name,
    ii.category,
    ii.unit_of_measure,
    ii.barcode,
    ii.is_perishable,
    ii.is_active,
    s.name AS supplier_name,
    s.contact_person AS supplier_contact_person,
    s.contact_number AS supplier_contact_number,
    s.address AS supplier_address,
    s.has_moa AS supplier_has_moa,
    s.notes AS supplier_notes
  FROM inventory_batches ib
  INNER JOIN inventory_items ii ON ii.id = ib.inventory_item_id
  LEFT JOIN suppliers s ON s.id = ib.supplier_id
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
      `ib.expiration_date IS NOT NULL AND ib.expiration_date >= CURRENT_DATE AND ib.expiration_date <= CURRENT_DATE + INTERVAL '30 days'`,
    );
  }

  if (filters.is_expired === true) {
    conditions.push(`ib.expiration_date IS NOT NULL AND ib.expiration_date < CURRENT_DATE`);
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

const getInventoryBatchById = async (id) => {
  const query = `
    ${baseSelectQuery}
    WHERE ib.id = $1
  `;

  const result = await pool.query(query, [id]);
  return result.rows[0] || null;
};

const getInventoryItemById = async (id) => {
  const query = `
    SELECT
      id,
      item_code,
      item_name,
      category,
      unit_of_measure,
      barcode,
      is_perishable,
      is_active
    FROM inventory_items
    WHERE id = $1
  `;

  const result = await pool.query(query, [id]);
  return result.rows[0] || null;
};

const getSupplierById = async (id) => {
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

  const result = await pool.query(query, [id]);
  return result.rows[0] || null;
};

const getInventoryBatchByItemIdAndBatchNo = async (inventoryItemId, batchNo) => {
  const query = `
    SELECT
      id,
      inventory_item_id,
      batch_no
    FROM inventory_batches
    WHERE inventory_item_id = $1
      AND batch_no = $2
  `;

  const result = await pool.query(query, [inventoryItemId, batchNo]);
  return result.rows[0] || null;
};

const insertInventoryBatch = async (batchData, dbClient = pool) => {
  const query = `
    INSERT INTO inventory_batches (
      inventory_item_id,
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
      $1, $2, $3, $4, $5, $6, $7, NOW(), $8, $9, $10, NOW(), NOW()
    )
    RETURNING
      id,
      inventory_item_id,
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
  `;

  const values = [
    batchData.inventory_item_id,
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

module.exports = {
  getInventoryBatches,
  getInventoryBatchById,
  getInventoryItemById,
  getSupplierById,
  getInventoryBatchByItemIdAndBatchNo,
  insertInventoryBatch,
};
