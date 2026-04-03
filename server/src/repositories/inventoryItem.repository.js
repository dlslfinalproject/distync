const pool = require("../config/db");

const getInventoryItems = async (filters) => {
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
      is_active,
      created_at,
      updated_at
    FROM inventory_items
    WHERE id = $1
  `;

  const result = await pool.query(query, [id]);
  return result.rows[0] || null;
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

const insertInventoryItem = async (itemData) => {
  const query = `
    INSERT INTO inventory_items (
      item_code,
      item_name,
      category,
      unit_of_measure,
      barcode,
      is_perishable,
      is_active,
      created_at,
      updated_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
    RETURNING
      id,
      item_code,
      item_name,
      category,
      unit_of_measure,
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
    itemData.barcode,
    itemData.is_perishable,
    itemData.is_active,
  ];

  const result = await pool.query(query, values);
  return result.rows[0];
};

const updateInventoryItem = async (id, itemData) => {
  const query = `
    UPDATE inventory_items
    SET item_code = $2,
        item_name = $3,
        category = $4,
        unit_of_measure = $5,
        barcode = $6,
        is_perishable = $7,
        is_active = $8,
        updated_at = NOW()
    WHERE id = $1
    RETURNING
      id,
      item_code,
      item_name,
      category,
      unit_of_measure,
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
    itemData.barcode,
    itemData.is_perishable,
    itemData.is_active,
  ];

  const result = await pool.query(query, values);
  return result.rows[0] || null;
};

module.exports = {
  getInventoryItems,
  getInventoryItemById,
  getInventoryItemByCode,
  getInventoryItemByName,
  insertInventoryItem,
  updateInventoryItem,
};
