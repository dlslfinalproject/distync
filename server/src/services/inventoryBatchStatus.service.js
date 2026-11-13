const pool = require("../config/db");
const inventoryBatchStatusRepository = require("../repositories/inventoryBatchStatus.repository");
const {
  DERIVED_INVENTORY_BATCH_STATUSES,
  MANUAL_INVENTORY_BATCH_STATUSES,
  getInventoryBatchStatus,
  isInventoryBatchDerivedStatus,
} = require("../utils/inventoryBatchStatus");

const INVENTORY_BATCH_STATUS_MAINTENANCE_INTERVAL_MS = 15 * 60 * 1000;
const INVENTORY_BATCH_STATUS_MAINTENANCE_ADVISORY_LOCK_KEY = 2026090701;

let inventoryBatchStatusMaintenanceInterval = null;
let isInventoryBatchStatusMaintenanceRunning = false;

const createEmptySummary = (itemId) => ({
  itemId,
  examined: 0,
  changed: 0,
  skippedManual: 0,
  transitions: {},
  changedBatchIds: [],
});

const normalizeOptions = (optionsOrClient = {}) => {
  if (typeof optionsOrClient?.query === "function") {
    return { dbClient: optionsOrClient };
  }

  return optionsOrClient || {};
};

const addTransition = (summary, currentStatus, nextStatus) => {
  const transitionKey = `${currentStatus}->${nextStatus}`;
  summary.transitions[transitionKey] =
    (summary.transitions[transitionKey] || 0) + 1;
};

const reconcileItemWithinTransaction = async (
  inventoryItemId,
  dbClient,
  { dryRun = false } = {},
) => {
  const summary = createEmptySummary(inventoryItemId);
  const inventoryItem =
    await inventoryBatchStatusRepository.getInventoryItemStatusContextForUpdate(
      inventoryItemId,
      dbClient,
    );

  if (!inventoryItem) {
    return summary;
  }

  const batches =
    await inventoryBatchStatusRepository.getInventoryBatchesForStatusRefresh(
      inventoryItemId,
      dbClient,
    );
  const totalQuantityAvailable = batches.reduce(
    (total, batch) => total + Number(batch.quantity_available || 0),
    0,
  );

  summary.examined = batches.length;

  for (const batch of batches) {
    const currentStatus = String(batch.status || "").toUpperCase();

    if (!isInventoryBatchDerivedStatus(currentStatus)) {
      if (MANUAL_INVENTORY_BATCH_STATUSES.includes(currentStatus)) {
        summary.skippedManual += 1;
      }
      continue;
    }

    const nextStatus = getInventoryBatchStatus({
      quantityAvailable: batch.quantity_available,
      expirationDate: batch.expiration_date,
      reorderLevel: inventoryItem.reorder_level,
      totalQuantityAvailable,
    });

    if (nextStatus === currentStatus) {
      continue;
    }

    if (dryRun) {
      summary.changed += 1;
      addTransition(summary, currentStatus, nextStatus);
      summary.changedBatchIds.push(batch.id);
      continue;
    }

    const updatedBatch =
      await inventoryBatchStatusRepository.updateInventoryBatchStatusIfChanged(
        batch.id,
        nextStatus,
        DERIVED_INVENTORY_BATCH_STATUSES,
        dbClient,
      );

    if (!updatedBatch) {
      continue;
    }

    summary.changed += 1;
    addTransition(summary, currentStatus, updatedBatch.status);
    summary.changedBatchIds.push(updatedBatch.id);
  }

  return summary;
};

const runWithOptionalTransaction = async (
  options,
  operation,
) => {
  const externalClient = options.dbClient || null;
  const client = externalClient || (await pool.connect());
  const ownsTransaction = !externalClient;
  let completed = false;

  try {
    if (ownsTransaction) {
      await client.query("BEGIN");
    }

    const result = await operation(client);

    if (ownsTransaction) {
      await client.query(options.dryRun ? "ROLLBACK" : "COMMIT");
    }

    completed = true;
    return result;
  } catch (error) {
    if (ownsTransaction && !completed) {
      await client.query("ROLLBACK");
    }
    throw error;
  } finally {
    if (ownsTransaction) {
      client.release();
    }
  }
};

const refreshDerivedInventoryBatchStatusesForItem = async (
  inventoryItemId,
  optionsOrClient = {},
) => {
  const options = normalizeOptions(optionsOrClient);

  return runWithOptionalTransaction(options, (client) =>
    reconcileItemWithinTransaction(inventoryItemId, client, options),
  );
};

const refreshDerivedInventoryBatchStatusesForItems = async (
  inventoryItemIds,
  optionsOrClient = {},
) => {
  const options = normalizeOptions(optionsOrClient);
  const uniqueInventoryItemIds = [
    ...new Set((inventoryItemIds || []).filter(Boolean).map(String)),
  ].sort();

  return runWithOptionalTransaction(options, async (client) => {
    const itemSummaries = [];

    for (const inventoryItemId of uniqueInventoryItemIds) {
      itemSummaries.push(
        await reconcileItemWithinTransaction(
          inventoryItemId,
          client,
          options,
        ),
      );
    }

    return summarizeItemResults(itemSummaries);
  });
};

const summarizeItemResults = (itemSummaries) => {
  const summary = {
    itemCount: itemSummaries.length,
    examined: 0,
    changed: 0,
    skippedManual: 0,
    transitions: {},
    changedBatchIds: [],
    itemSummaries,
  };

  for (const itemSummary of itemSummaries) {
    summary.examined += itemSummary.examined;
    summary.changed += itemSummary.changed;
    summary.skippedManual += itemSummary.skippedManual;
    summary.changedBatchIds.push(...itemSummary.changedBatchIds);

    for (const [transition, count] of Object.entries(
      itemSummary.transitions,
    )) {
      summary.transitions[transition] =
        (summary.transitions[transition] || 0) + count;
    }
  }

  return summary;
};

const executeExpiredInventoryBatchStatusRefresh = async () => {
  const client = await pool.connect();
  let transactionStarted = false;
  let committed = false;

  try {
    await client.query("BEGIN");
    transactionStarted = true;

    const lockResult = await client.query(
      "SELECT pg_try_advisory_xact_lock($1::bigint) AS acquired",
      [INVENTORY_BATCH_STATUS_MAINTENANCE_ADVISORY_LOCK_KEY],
    );

    if (!lockResult.rows[0]?.acquired) {
      await client.query("ROLLBACK");
      transactionStarted = false;
      return {
        skipped: true,
        reason: "advisory-lock-unavailable",
        itemCount: 0,
        examined: 0,
        changed: 0,
        transitions: {},
        changedBatchIds: [],
        itemSummaries: [],
      };
    }

    const itemIds =
      await inventoryBatchStatusRepository.getExpiredDerivedInventoryItemIds(
        DERIVED_INVENTORY_BATCH_STATUSES,
        client,
      );
    const summary = await refreshDerivedInventoryBatchStatusesForItems(itemIds, {
      dbClient: client,
    });

    await client.query("COMMIT");
    committed = true;

    return {
      skipped: false,
      ...summary,
    };
  } catch (error) {
    if (transactionStarted && !committed) {
      await client.query("ROLLBACK");
    }
    throw error;
  } finally {
    client.release();
  }
};

const runInventoryBatchStatusMaintenance = async () => {
  if (isInventoryBatchStatusMaintenanceRunning) {
    return {
      skipped: true,
      reason: "already-running",
      itemCount: 0,
      examined: 0,
      changed: 0,
      transitions: {},
      changedBatchIds: [],
      itemSummaries: [],
    };
  }

  isInventoryBatchStatusMaintenanceRunning = true;
  console.log("Inventory batch status maintenance started.");

  try {
    const result = await executeExpiredInventoryBatchStatusRefresh();
    console.log(
      `Inventory batch status maintenance completed: examined=${result.examined}, changed=${result.changed}, skipped=${result.skipped}.`,
    );
    return result;
  } catch (error) {
    console.error(
      `Inventory batch status maintenance failed: ${error.message}`,
    );
    return {
      skipped: false,
      error,
      itemCount: 0,
      examined: 0,
      changed: 0,
      transitions: {},
      changedBatchIds: [],
      itemSummaries: [],
    };
  } finally {
    isInventoryBatchStatusMaintenanceRunning = false;
  }
};

const startInventoryBatchStatusMaintenance = () => {
  if (inventoryBatchStatusMaintenanceInterval) {
    return;
  }

  inventoryBatchStatusMaintenanceInterval = setInterval(() => {
    void runInventoryBatchStatusMaintenance();
  }, INVENTORY_BATCH_STATUS_MAINTENANCE_INTERVAL_MS);

  if (
    typeof inventoryBatchStatusMaintenanceInterval?.unref === "function"
  ) {
    inventoryBatchStatusMaintenanceInterval.unref();
  }
};

const stopInventoryBatchStatusMaintenance = () => {
  if (!inventoryBatchStatusMaintenanceInterval) {
    return;
  }

  clearInterval(inventoryBatchStatusMaintenanceInterval);
  inventoryBatchStatusMaintenanceInterval = null;
  isInventoryBatchStatusMaintenanceRunning = false;
};

const initializeInventoryBatchStatusMaintenance = async () => {
  const result = await runInventoryBatchStatusMaintenance();
  startInventoryBatchStatusMaintenance();
  return result;
};

module.exports = {
  DERIVED_INVENTORY_BATCH_STATUSES,
  MANUAL_INVENTORY_BATCH_STATUSES,
  INVENTORY_BATCH_STATUS_MAINTENANCE_INTERVAL_MS,
  INVENTORY_BATCH_STATUS_MAINTENANCE_ADVISORY_LOCK_KEY,
  refreshDerivedInventoryBatchStatusesForItem,
  refreshDerivedInventoryBatchStatusesForItems,
  executeExpiredInventoryBatchStatusRefresh,
  runInventoryBatchStatusMaintenance,
  startInventoryBatchStatusMaintenance,
  stopInventoryBatchStatusMaintenance,
  initializeInventoryBatchStatusMaintenance,
  summarizeItemResults,
};
