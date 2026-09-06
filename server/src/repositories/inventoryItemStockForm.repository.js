const pool = require("../config/db");

let hasInventoryItemStockFormIsActiveColumnCache = null;

const hasInventoryItemStockFormIsActiveColumn = async (dbClient = pool) => {
  if (hasInventoryItemStockFormIsActiveColumnCache !== null) {
    return hasInventoryItemStockFormIsActiveColumnCache;
  }

  const result = await dbClient.query(
    `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'inventory_item_stock_forms'
          AND column_name = 'is_active'
      ) AS has_column
    `,
  );

  hasInventoryItemStockFormIsActiveColumnCache = Boolean(
    result.rows[0]?.has_column,
  );
  return hasInventoryItemStockFormIsActiveColumnCache;
};

const buildStockFormSelectFields = (hasIsActiveColumn) => `
  id,
  inventory_item_id,
  barcode,
  packaging,
  units_per_packaging,
  unit_of_measure,
  unit_of_measure_value,
  ${hasIsActiveColumn ? "is_active" : "TRUE AS is_active"},
  created_at,
  updated_at
`;

const getInventoryItemStockFormsByItemId = async (inventoryItemId, dbClient = pool) => {
  const hasIsActiveColumn = await hasInventoryItemStockFormIsActiveColumn(dbClient);
  const query = `
    SELECT
      ${buildStockFormSelectFields(hasIsActiveColumn)}
    FROM inventory_item_stock_forms
    WHERE inventory_item_id = $1
    ORDER BY created_at ASC, packaging ASC
  `;

  const result = await dbClient.query(query, [inventoryItemId]);
  return result.rows;
};

const getInventoryItemStockFormById = async (id, dbClient = pool) => {
  const hasIsActiveColumn = await hasInventoryItemStockFormIsActiveColumn(dbClient);
  const query = `
    SELECT
      ${buildStockFormSelectFields(hasIsActiveColumn)}
    FROM inventory_item_stock_forms
    WHERE id = $1
  `;

  const result = await dbClient.query(query, [id]);
  return result.rows[0] || null;
};

const getInventoryItemStockFormByBarcode = async (barcode, dbClient = pool) => {
  const hasIsActiveColumn = await hasInventoryItemStockFormIsActiveColumn(dbClient);
  const query = `
    SELECT
      ${buildStockFormSelectFields(hasIsActiveColumn)}
    FROM inventory_item_stock_forms
    WHERE barcode = $1
  `;

  const result = await dbClient.query(query, [barcode]);
  return result.rows[0] || null;
};

const getInventoryItemStockFormByDefinition = async (
  {
    inventory_item_id,
    barcode,
    packaging,
    units_per_packaging,
    unit_of_measure,
    unit_of_measure_value,
  },
  dbClient = pool,
) => {
  const hasIsActiveColumn = await hasInventoryItemStockFormIsActiveColumn(dbClient);
  const query = `
    SELECT
      ${buildStockFormSelectFields(hasIsActiveColumn)}
    FROM inventory_item_stock_forms
    WHERE inventory_item_id = $1
      ${hasIsActiveColumn ? "AND is_active = true" : ""}
      AND (
        (barcode IS NULL AND $2::text IS NULL)
        OR barcode = $2
      )
      AND packaging = $3
      AND units_per_packaging = $4
      AND unit_of_measure = $5
      AND (
        (unit_of_measure_value IS NULL AND $6::numeric IS NULL)
        OR unit_of_measure_value = $6
      )
  `;

  const result = await dbClient.query(query, [
    inventory_item_id,
    barcode,
    packaging,
    units_per_packaging,
    unit_of_measure,
    unit_of_measure_value,
  ]);
  return result.rows[0] || null;
};

const insertInventoryItemStockForm = async (stockFormData, dbClient = pool) => {
  const hasIsActiveColumn = await hasInventoryItemStockFormIsActiveColumn(dbClient);
  const columns = [
    "inventory_item_id",
    "barcode",
    "packaging",
    "units_per_packaging",
    "unit_of_measure",
    "unit_of_measure_value",
  ];
  const values = [
    stockFormData.inventory_item_id,
    stockFormData.barcode,
    stockFormData.packaging,
    stockFormData.units_per_packaging,
    stockFormData.unit_of_measure,
    stockFormData.unit_of_measure_value,
  ];

  if (hasIsActiveColumn) {
    columns.push("is_active");
    values.push(stockFormData.is_active ?? true);
  }

  const query = `
    INSERT INTO inventory_item_stock_forms (
      ${columns.join(",\n      ")},
      created_at,
      updated_at
    )
    VALUES (${values.map((_, index) => `$${index + 1}`).join(", ")}, NOW(), NOW())
    RETURNING
      ${buildStockFormSelectFields(hasIsActiveColumn)}
  `;

  const result = await dbClient.query(query, values);

  return result.rows[0];
};

const updateInventoryItemStockForm = async (id, stockFormData, dbClient = pool) => {
  const hasIsActiveColumn = await hasInventoryItemStockFormIsActiveColumn(dbClient);
  const values = [
    id,
    stockFormData.barcode,
    stockFormData.packaging,
    stockFormData.units_per_packaging,
    stockFormData.unit_of_measure,
    stockFormData.unit_of_measure_value,
  ];
  const assignments = [
    "barcode = $2",
    "packaging = $3",
    "units_per_packaging = $4",
    "unit_of_measure = $5",
    "unit_of_measure_value = $6",
  ];

  if (hasIsActiveColumn) {
    assignments.push("is_active = $7");
    values.push(stockFormData.is_active ?? true);
  }

  const query = `
    UPDATE inventory_item_stock_forms
    SET ${assignments.join(",\n        ")},
        updated_at = NOW()
    WHERE id = $1
    RETURNING
      ${buildStockFormSelectFields(hasIsActiveColumn)}
  `;

  const result = await dbClient.query(query, values);

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
