const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "../..");
const read = (relativePath) =>
  fs.readFileSync(path.join(repoRoot, relativePath), "utf8");

test("Mayor offline stock-in preserves client occurrence timestamps without changing online defaults", () => {
  const batchRepository = read("server/src/repositories/inventoryBatch.repository.js");
  const transactionRepository = read(
    "server/src/repositories/inventoryTransaction.repository.js",
  );
  const itemService = read("server/src/services/inventoryItem.service.js");
  const syncService = read("server/src/services/sync.service.js");

  assert.match(batchRepository, /hasReceivedAt/);
  assert.match(batchRepository, /\$11::timestamptz/);
  assert.match(batchRepository, /values\.push\(batchData\.received_at\)/);
  assert.match(transactionRepository, /hasPerformedAt/);
  assert.match(transactionRepository, /\$11::timestamptz/);
  assert.match(
    transactionRepository,
    /values\.push\(transactionData\.performed_at\)/,
  );
  assert.match(itemService, /received_at: options\.clientTimestamp/);
  assert.match(itemService, /performed_at: options\.clientTimestamp/);
  assert.match(syncService, /received_at: clientTimestamp/);
  assert.match(syncService, /clientTimestamp,\s*dbClient/);
});

test("Mayor offline stock-in remains authorized and server-idempotent through the existing sync pipeline", () => {
  const syncService = read("server/src/services/sync.service.js");
  const syncRepository = read("server/src/repositories/sync.repository.js");

  assert.match(syncService, /INVENTORY_BATCH_CREATE:[\s\S]*roles: \[ROLE_CODES\.MAYOR\]/);
  assert.match(syncService, /ensureActionAccess\(actionConfig, auth\)/);
  assert.match(syncService, /claimSyncTransaction\(claimPayload, dbClient\)/);
  assert.match(syncService, /REPLAY_TERMINAL/);
  assert.match(syncRepository, /sync_transactions_client_sync_id_unique/);
  assert.match(syncRepository, /isSameSyncRequest/);
});
