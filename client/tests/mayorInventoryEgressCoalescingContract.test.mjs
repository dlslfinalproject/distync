import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

const readSource = (relativePath) =>
  fs.readFile(new URL(relativePath, import.meta.url), "utf8");

test("Mayor inventory pages refresh only after completed sync and use the shared gate", async () => {
  const [itemsSource, batchesSource, transactionsSource] = await Promise.all([
    readSource("../src/pages/inventory/InventoryItemsPage.jsx"),
    readSource("../src/pages/inventory/InventoryBatchesPage.jsx"),
    readSource("../src/pages/inventory/InventoryTransactionsPage.jsx"),
  ]);

  for (const source of [itemsSource, batchesSource, transactionsSource]) {
    assert.match(source, /createInventoryRefreshGate/);
    assert.match(source, /shouldRefreshInventoryOnSyncEvent/);
    assert.match(source, /trigger: "sync-finished"/);
    assert.doesNotMatch(source, /subscribeToSyncUpdates\(\(\) =>/);
  }

  assert.match(itemsSource, /setInterval\([\s\S]*30000/);
  assert.match(itemsSource, /addEventListener\("focus", handleFocusRefresh\)/);
  assert.match(itemsSource, /addEventListener\("visibilitychange", handleVisibilityRefresh\)/);
  assert.match(itemsSource, /refreshInventoryMonitor\("timer"\)/);
  assert.match(itemsSource, /refreshInventoryMonitor\("focus"\)/);
  assert.match(itemsSource, /refreshInventoryMonitor\("visibility"\)/);
  assert.match(itemsSource, /trigger: "mutation"/);
  assert.match(batchesSource, /trigger: "mutation"/);
});

test("the shared sync policy has one authoritative post-sync refresh event", async () => {
  const source = await readSource(
    "../src/features/inventory/shared/inventoryRefreshGate.js",
  );

  assert.match(source, /event\?\.type === "finished"/);
  assert.doesNotMatch(source, /event\?\.type === "started"/);
});
