const pool = require("../config/db");

const getStubByIdForUpdate = async (stubId, dbClient) => {
  const query = `
    SELECT
      s.id,
      s.disaster_event_id,
      s.household_id,
      s.stub_no,
      s.serial_no,
      s.status,
      s.claimed_at,
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
      remarks,
      created_at,
      updated_at
    )
    VALUES (
      $1, $2, $3, NOW(), $4, $5, $6, $7, $8, $9, $10, NOW(), NOW()
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

const updateStubAsClaimed = async (stubId, dbClient) => {
  const query = `
    UPDATE stubs
    SET status = 'CLAIMED',
        claimed_at = NOW(),
        updated_at = NOW()
    WHERE id = $1
    RETURNING
      id,
      stub_no,
      serial_no,
      status,
      claimed_at,
      updated_at
  `;

  const result = await dbClient.query(query, [stubId]);
  return result.rows[0] || null;
};

module.exports = {
  getStubByIdForUpdate,
  getInventoryBatchByIdForUpdate,
  insertDistributionTransaction,
  insertDistributionTransactionItem,
  updateInventoryBatchQuantityAndStatus,
  updateStubAsClaimed,
};
