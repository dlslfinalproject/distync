const pool = require("../config/db");

let hasInventoryItemReorderLevelColumnCache = null;

const hasInventoryItemReorderLevelColumn = async () => {
  if (hasInventoryItemReorderLevelColumnCache !== null) {
    return hasInventoryItemReorderLevelColumnCache;
  }

  const result = await pool.query(
    `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'inventory_items'
          AND column_name = 'reorder_level'
      ) AS has_column
    `,
  );

  hasInventoryItemReorderLevelColumnCache = Boolean(result.rows[0]?.has_column);
  return hasInventoryItemReorderLevelColumnCache;
};

const getInventoryItems = async (filters) => {
  const hasReorderLevelColumn = await hasInventoryItemReorderLevelColumn();
  const values = [];
  const conditions = [];

  if (filters.category) {
    values.push(filters.category);
    conditions.push(`category = $${values.length}`);
  }

  if (filters.is_active !== null) {
    values.push(filters.is_active);
    conditions.push(`is_active = $${values.length}`);
  }

  if (filters.is_perishable !== null) {
    values.push(filters.is_perishable);
    conditions.push(`is_perishable = $${values.length}`);
  }

  if (filters.search) {
    values.push(`%${filters.search}%`);
    conditions.push(
      `(item_code ILIKE $${values.length} OR item_name ILIKE $${values.length})`,
    );
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const query = `
    SELECT
      id,
      item_code,
      item_name,
      category,
      unit_of_measure,
      unit_of_measure_value,
      packaging,
      packaging_count,
      quantity,
      ${hasReorderLevelColumn ? "reorder_level," : "NULL::integer AS reorder_level,"}
      expiration_date,
      barcode,
      is_perishable,
      is_active,
      created_at,
      updated_at
    FROM inventory_items
    ${whereClause}
    ORDER BY item_name ASC
  `;

  const result = await pool.query(query, values);
  return result.rows;
};

const getInventoryItemById = async (id, dbClient = pool) => {
  const hasReorderLevelColumn = await hasInventoryItemReorderLevelColumn();
  const query = `
    SELECT
      id,
      item_code,
      item_name,
      category,
      unit_of_measure,
      unit_of_measure_value,
      packaging,
      packaging_count,
      quantity,
      ${hasReorderLevelColumn ? "reorder_level," : "NULL::integer AS reorder_level,"}
      CAST(COALESCE((
        SELECT SUM(COALESCE(item_stock.quantity_available, 0))
        FROM inventory_batches item_stock
        WHERE item_stock.inventory_item_id = inventory_items.id
      ), 0) AS integer) AS item_total_stock,
      expiration_date,
      barcode,
      is_perishable,
      is_active,
      created_at,
      updated_at
    FROM inventory_items
    WHERE id = $1
  `;

  const result = await dbClient.query(query, [id]);
  return result.rows[0] || null;
};

const getInventoryItemByIdForUpdate = async (id, dbClient = pool) => {
  const hasReorderLevelColumn = await hasInventoryItemReorderLevelColumn();
  const query = `
    SELECT
      id,
      item_code,
      item_name,
      category,
      unit_of_measure,
      unit_of_measure_value,
      packaging,
      packaging_count,
      quantity,
      ${hasReorderLevelColumn ? "reorder_level," : "NULL::integer AS reorder_level,"}
      expiration_date,
      barcode,
      is_perishable,
      is_active,
      created_at,
      updated_at
    FROM inventory_items
    WHERE id = $1
    FOR UPDATE
  `;

  const result = await dbClient.query(query, [id]);
  return result.rows[0] || null;
};

const getInventoryItemsByIdsForUpdate = async (ids, dbClient = pool) => {
  if (!Array.isArray(ids) || ids.length === 0) {
    return [];
  }

  const hasReorderLevelColumn = await hasInventoryItemReorderLevelColumn();
  const query = `
    SELECT
      id,
      item_code,
      item_name,
      category,
      unit_of_measure,
      unit_of_measure_value,
      packaging,
      packaging_count,
      quantity,
      ${hasReorderLevelColumn ? "reorder_level," : "NULL::integer AS reorder_level,"}
      expiration_date,
      barcode,
      is_perishable,
      is_active,
      created_at,
      updated_at
    FROM inventory_items
    WHERE id = ANY($1::uuid[])
    FOR UPDATE
  `;

  const result = await dbClient.query(query, [ids]);
  return result.rows;
};

const getInventoryItemByCode = async (itemCode) => {
  const query = `
    SELECT
      id,
      item_code,
      item_name
    FROM inventory_items
    WHERE item_code = $1
  `;

  const result = await pool.query(query, [itemCode]);
  return result.rows[0] || null;
};

const getInventoryItemByName = async (itemName) => {
  const query = `
    SELECT
      id,
      item_code,
      item_name
    FROM inventory_items
    WHERE item_name = $1
  `;

  const result = await pool.query(query, [itemName]);
  return result.rows[0] || null;
};

const getInventoryItemByBarcode = async (barcode, dbClient = pool) => {
  const hasReorderLevelColumn = await hasInventoryItemReorderLevelColumn();
  const query = `
    SELECT
      id,
      item_code,
      item_name,
      category,
      unit_of_measure,
      unit_of_measure_value,
      packaging,
      packaging_count,
      quantity,
      ${hasReorderLevelColumn ? "reorder_level," : "NULL::integer AS reorder_level,"}
      expiration_date,
      barcode,
      is_perishable,
      is_active,
      created_at,
      updated_at
    FROM inventory_items
    WHERE barcode = $1
    LIMIT 1
  `;

  const result = await dbClient.query(query, [barcode]);
  return result.rows[0] || null;
};

const insertInventoryItem = async (itemData, dbClient = pool) => {
  const hasReorderLevelColumn = await hasInventoryItemReorderLevelColumn();
  const query = `
    INSERT INTO inventory_items (
      item_code,
      item_name,
      category,
      unit_of_measure,
      unit_of_measure_value,
      packaging,
      packaging_count,
      quantity,
      ${hasReorderLevelColumn ? "reorder_level," : ""}
      expiration_date,
      barcode,
      is_perishable,
      is_active,
      created_at,
      updated_at
    )
    VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8,
      ${hasReorderLevelColumn ? "$9," : ""}
      $${hasReorderLevelColumn ? 10 : 9},
      $${hasReorderLevelColumn ? 11 : 10},
      $${hasReorderLevelColumn ? 12 : 11},
      $${hasReorderLevelColumn ? 13 : 12},
      NOW(), NOW()
    )
    RETURNING
      id,
      item_code,
      item_name,
      category,
      unit_of_measure,
      unit_of_measure_value,
      packaging,
      packaging_count,
      quantity,
      ${hasReorderLevelColumn ? "reorder_level," : "NULL::integer AS reorder_level,"}
      expiration_date,
      barcode,
      is_perishable,
      is_active,
      created_at,
      updated_at
  `;

  const values = [
    itemData.item_code,
    itemData.item_name,
    itemData.category,
    itemData.unit_of_measure,
    itemData.unit_of_measure_value,
    itemData.packaging,
    itemData.packaging_count,
    itemData.quantity,
    ...(hasReorderLevelColumn ? [itemData.reorder_level] : []),
    itemData.expiration_date,
    itemData.barcode,
    itemData.is_perishable,
    itemData.is_active,
  ];

  const result = await dbClient.query(query, values);
  return result.rows[0];
};

const updateInventoryItem = async (id, itemData, dbClient = pool) => {
  const hasReorderLevelColumn = await hasInventoryItemReorderLevelColumn();
  const query = `
    UPDATE inventory_items
    SET item_code = $2,
        item_name = $3,
        category = $4,
        unit_of_measure = $5,
        unit_of_measure_value = $6,
        packaging = $7,
        packaging_count = $8,
        quantity = $9,
        ${hasReorderLevelColumn ? "reorder_level = $10," : ""}
        expiration_date = $${hasReorderLevelColumn ? 11 : 10},
        barcode = $${hasReorderLevelColumn ? 12 : 11},
        is_perishable = $${hasReorderLevelColumn ? 13 : 12},
        is_active = $${hasReorderLevelColumn ? 14 : 13},
        updated_at = NOW()
    WHERE id = $1
    RETURNING
      id,
      item_code,
      item_name,
      category,
      unit_of_measure,
      unit_of_measure_value,
      packaging,
      packaging_count,
      quantity,
      ${hasReorderLevelColumn ? "reorder_level," : "NULL::integer AS reorder_level,"}
      expiration_date,
      barcode,
      is_perishable,
      is_active,
      created_at,
      updated_at
  `;

  const values = [
    id,
    itemData.item_code,
    itemData.item_name,
    itemData.category,
    itemData.unit_of_measure,
    itemData.unit_of_measure_value,
    itemData.packaging,
    itemData.packaging_count,
    itemData.quantity,
    ...(hasReorderLevelColumn ? [itemData.reorder_level] : []),
    itemData.expiration_date,
    itemData.barcode,
    itemData.is_perishable,
    itemData.is_active,
  ];

  const result = await dbClient.query(query, values);
  return result.rows[0] || null;
};

const updateInventoryItemReorderLevel = async (
  id,
  reorderLevel,
  dbClient = pool,
) => {
  const hasReorderLevelColumn = await hasInventoryItemReorderLevelColumn();

  if (!hasReorderLevelColumn) {
    return getInventoryItemById(id, dbClient);
  }

  const query = `
    UPDATE inventory_items
    SET reorder_level = $2,
        updated_at = NOW()
    WHERE id = $1
    RETURNING
      id,
      item_code,
      item_name,
      category,
      unit_of_measure,
      unit_of_measure_value,
      packaging,
      packaging_count,
      quantity,
      reorder_level,
      expiration_date,
      barcode,
      is_perishable,
      is_active,
      created_at,
      updated_at
  `;

  const result = await dbClient.query(query, [id, reorderLevel]);
  return result.rows[0] || null;
};

const updateInventoryItemStockSnapshot = async (
  id,
  { quantity, packaging_count },
  dbClient = pool,
) => {
  const hasReorderLevelColumn = await hasInventoryItemReorderLevelColumn();
  const query = `
    UPDATE inventory_items
    SET quantity = $2,
        packaging_count = $3,
        updated_at = NOW()
    WHERE id = $1
    RETURNING
      id,
      item_code,
      item_name,
      category,
      unit_of_measure,
      unit_of_measure_value,
      packaging,
      packaging_count,
      quantity,
      ${hasReorderLevelColumn ? "reorder_level," : "NULL::integer AS reorder_level,"}
      expiration_date,
      barcode,
      is_perishable,
      is_active,
      created_at,
      updated_at
  `;

  const result = await dbClient.query(query, [id, quantity, packaging_count]);
  return result.rows[0] || null;
};

module.exports = {
  getInventoryItems,
  getInventoryItemById,
  getInventoryItemByIdForUpdate,
  getInventoryItemsByIdsForUpdate,
  getInventoryItemByBarcode,
  getInventoryItemByCode,
  getInventoryItemByName,
  insertInventoryItem,
  updateInventoryItem,
  updateInventoryItemReorderLevel,
  updateInventoryItemStockSnapshot,
};
