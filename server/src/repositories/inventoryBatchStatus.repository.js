const pool = require("../config/db");

const getInventoryItemStatusContextForUpdate = async (
  inventoryItemId,
  dbClient = pool,
) => {
  const result = await dbClient.query(
    `
      SELECT id, reorder_level
      FROM inventory_items
      WHERE id = $1
      FOR UPDATE
    `,
    [inventoryItemId],
  );

  return result.rows[0] || null;
};

const getInventoryBatchesForStatusRefresh = async (
  inventoryItemId,
  dbClient = pool,
) => {
  const result = await dbClient.query(
    `
      SELECT
        id,
        inventory_item_id,
        quantity_available,
        expiration_date,
        status
      FROM inventory_batches
      WHERE inventory_item_id = $1
      ORDER BY id ASC
      FOR UPDATE
    `,
    [inventoryItemId],
  );

  return result.rows;
};

const updateInventoryBatchStatusIfChanged = async (
  batchId,
  nextStatus,
  derivedStatuses,
  dbClient = pool,
) => {
  const result = await dbClient.query(
    `
      UPDATE inventory_batches
      SET status = $2,
          updated_at = NOW()
      WHERE id = $1
        AND status = ANY($3::varchar[])
        AND status IS DISTINCT FROM $2
      RETURNING id, status, stock_version, updated_at
    `,
    [batchId, nextStatus, derivedStatuses],
  );

  return result.rows[0] || null;
};

const getExpiredDerivedInventoryItemIds = async (
  derivedStatuses,
  dbClient = pool,
) => {
  const result = await dbClient.query(
    `
      SELECT DISTINCT inventory_item_id
      FROM inventory_batches
      WHERE status = ANY($1::varchar[])
        AND expiration_date IS NOT NULL
        AND expiration_date <= CURRENT_DATE
      ORDER BY inventory_item_id ASC
    `,
    [derivedStatuses],
  );

  return result.rows.map((row) => row.inventory_item_id).filter(Boolean);
};

module.exports = {
  getInventoryItemStatusContextForUpdate,
  getInventoryBatchesForStatusRefresh,
  updateInventoryBatchStatusIfChanged,
  getExpiredDerivedInventoryItemIds,
};
