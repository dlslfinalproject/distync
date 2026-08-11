const pool = require("../config/db");

const stockFormSelectFields = `
  id,
  inventory_item_id,
  barcode,
  packaging,
  units_per_packaging,
  unit_of_measure,
  unit_of_measure_value,
  is_active,
  created_at,
  updated_at
`;

const getInventoryItemStockFormsByItemId = async (inventoryItemId, dbClient = pool) => {
  const query = `
    SELECT
      ${stockFormSelectFields}
    FROM inventory_item_stock_forms
    WHERE inventory_item_id = $1
    ORDER BY created_at ASC, packaging ASC
  `;

  const result = await dbClient.query(query, [inventoryItemId]);
  return result.rows;
};

const getInventoryItemStockFormById = async (id, dbClient = pool) => {
  const query = `
    SELECT
      ${stockFormSelectFields}
    FROM inventory_item_stock_forms
    WHERE id = $1
  `;

  const result = await dbClient.query(query, [id]);
  return result.rows[0] || null;
};

const getInventoryItemStockFormByBarcode = async (barcode, dbClient = pool) => {
  const query = `
    SELECT
      ${stockFormSelectFields}
    FROM inventory_item_stock_forms
    WHERE barcode = $1
  `;

  const result = await dbClient.query(query, [barcode]);
  return result.rows[0] || null;
};

const getInventoryItemStockFormByDefinition = async (
  {
    inventory_item_id,
    packaging,
    units_per_packaging,
    unit_of_measure,
    unit_of_measure_value,
  },
  dbClient = pool,
) => {
  const query = `
    SELECT
      ${stockFormSelectFields}
    FROM inventory_item_stock_forms
    WHERE inventory_item_id = $1
      AND packaging = $2
      AND units_per_packaging = $3
      AND unit_of_measure = $4
      AND (
        (unit_of_measure_value IS NULL AND $5::numeric IS NULL)
        OR unit_of_measure_value = $5
      )
  `;

  const result = await dbClient.query(query, [
    inventory_item_id,
    packaging,
    units_per_packaging,
    unit_of_measure,
    unit_of_measure_value,
  ]);
  return result.rows[0] || null;
};

const insertInventoryItemStockForm = async (stockFormData, dbClient = pool) => {
  const query = `
    INSERT INTO inventory_item_stock_forms (
      inventory_item_id,
      barcode,
      packaging,
      units_per_packaging,
      unit_of_measure,
      unit_of_measure_value,
      is_active,
      created_at,
      updated_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
    RETURNING
      ${stockFormSelectFields}
  `;

  const result = await dbClient.query(query, [
    stockFormData.inventory_item_id,
    stockFormData.barcode,
    stockFormData.packaging,
    stockFormData.units_per_packaging,
    stockFormData.unit_of_measure,
    stockFormData.unit_of_measure_value,
    stockFormData.is_active ?? true,
  ]);

  return result.rows[0];
};

const updateInventoryItemStockForm = async (id, stockFormData, dbClient = pool) => {
  const query = `
    UPDATE inventory_item_stock_forms
    SET barcode = $2,
        packaging = $3,
        units_per_packaging = $4,
        unit_of_measure = $5,
        unit_of_measure_value = $6,
        is_active = $7,
        updated_at = NOW()
    WHERE id = $1
    RETURNING
      ${stockFormSelectFields}
  `;

  const result = await dbClient.query(query, [
    id,
    stockFormData.barcode,
    stockFormData.packaging,
    stockFormData.units_per_packaging,
    stockFormData.unit_of_measure,
    stockFormData.unit_of_measure_value,
    stockFormData.is_active ?? true,
  ]);

  return result.rows[0] || null;
};

module.exports = {
  getInventoryItemStockFormsByItemId,
  getInventoryItemStockFormById,
  getInventoryItemStockFormByBarcode,
  getInventoryItemStockFormByDefinition,
  insertInventoryItemStockForm,
  updateInventoryItemStockForm,
};
