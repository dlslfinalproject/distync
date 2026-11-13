import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (relativePath) =>
  readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");

test("STAGE7A-31 hook uses lifecycle identity instead of a raw online retry", async () => {
  const source = await read(
    "src/features/offline/useMayorInventoryOfflinePreparation.js",
  );

  assert.match(source, /mayorInventoryReconnectCoordinator/);
  assert.match(source, /isNewReconnect/);
  assert.match(source, /beginReconnectGeneration/);
  assert.doesNotMatch(source, /window\.addEventListener\("online"/);
});

test("STAGE7A-32 hook preserves ordinary remount and app-restart cache behavior", async () => {
  const source = await read(
    "src/features/offline/useMayorInventoryOfflinePreparation.js",
  );

  assert.match(source, /cache && !shouldRefreshOnline/);
  assert.match(source, /getMayorInventoryCacheSnapshot/);
  assert.match(source, /hasCompleteCache/);
});

test("STAGE7A-33 explicit retry bypasses reconnect dedup", async () => {
  const source = await read(
    "src/features/offline/useMayorInventoryOfflinePreparation.js",
  );

  assert.match(source, /explicitRetryRef/);
  assert.match(source, /force: explicitRetry/);
  assert.match(source, /explicitRetryRef\.current = true/);
});

test("STAGE7A-34 full preparation still uses unpaginated Items, Batches, and Transactions", async () => {
  const source = await read("src/offline/mayorInventoryPreparation.js");

  assert.match(source, /fetchInventoryItems\(\{ search: "" \}\)/);
  assert.match(source, /fetchInventoryBatches\(\)/);
  assert.match(source, /fetchInventoryTransactions\(\)/);
  assert.doesNotMatch(source, /pageSize/);
});

test("STAGE7A-35 verified generation requires the existing complete preparation result", async () => {
  const source = await read("src/offline/mayorInventoryPreparation.js");

  assert.match(source, /verifiedCompleteGraph: false/);
  assert.match(source, /verifiedCompleteGraph: true/);
  assert.match(source, /persistMayorInventoryCacheSnapshot/);
  assert.match(source, /getMayorInventoryCacheSnapshot/);
});

test("STAGE7A-36 Batches live route remains paginated and separate", async () => {
  const [source, preparation] = await Promise.all([
    read("src/pages/inventory/InventoryBatchesPage.jsx"),
    read("src/offline/mayorInventoryPreparation.js"),
  ]);

  assert.match(source, /fetchInventoryBatchesPage/);
  assert.match(source, /page: activePage/);
  assert.match(source, /pageSize: activePageSize/);
  assert.match(preparation, /fetchInventoryBatches\(\)/);
});

test("STAGE7A-37 Transactions behavior is unchanged and is not a preparation source", async () => {
  const source = await read("src/pages/inventory/InventoryTransactionsPage.jsx");

  assert.doesNotMatch(
    source,
    /useMayorInventoryOfflinePreparation|mayorInventoryReconnectCoordinator/,
  );
  assert.match(source, /fetchInventoryTransactions\(\)/);
  assert.match(source, /fetchInventoryItems\(\)/);
  assert.match(source, /fetchInventoryBatches\(\)/);
});

test("STAGE7A-38 Inventory read coordination remains in-flight only", async () => {
  const source = await read(
    "src/features/inventory/shared/inventoryReadCoordinator.js",
  );

  assert.match(source, /const inFlightReads = new Map/);
  assert.match(source, /inFlightReads\.delete\(key\)/);
  assert.doesNotMatch(source, /setTimeout/);
  assert.doesNotMatch(source, /TTL|staleTime|cacheDuration/i);
});

test("STAGE7A-39 cache and queue schemas remain unchanged", async () => {
  const [dbSource, cacheSource, queueSource] = await Promise.all([
    read("src/offline/db.js"),
    read("src/offline/mayorInventoryCache.js"),
    read("src/offline/syncQueue.js"),
  ]);

  assert.match(dbSource, /this\.version\(5\)/);
  assert.match(dbSource, /offlineInventoryCache:/);
  assert.match(cacheSource, /MAYOR_INVENTORY_CACHE_VERSION/);
  assert.match(queueSource, /await db\.syncQueue\.put/);
  assert.doesNotMatch(cacheSource, /cursor|tombstone/i);
});

test("STAGE7A-40 no server, Service Worker, or package source is part of the lifecycle fix", async () => {
  const [coordinator, pwa, packageSource] = await Promise.all([
    read("src/offline/mayorInventoryReconnectCoordinator.js"),
    read("vite.config.js"),
    read("package.json"),
  ]);

  assert.match(coordinator, /getRetryableSyncEntries/);
  assert.match(coordinator, /flushPendingSyncEntries/);
  assert.match(pwa, /NetworkOnly/);
  assert.doesNotMatch(packageSource, /stage7a|reconnect/i);
});
