const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "../..");

const readSource = (relativePath) =>
  fs.readFileSync(path.join(repoRoot, relativePath), "utf8");

const stockMovementServicePaths = [
  "server/src/services/inventoryTransaction.service.js",
  "server/src/services/donation.service.js",
  "server/src/services/distributionTransaction.service.js",
  "server/src/services/automaticReliefPackClaim.service.js",
];

test("stock movements no longer contain parent packaging metadata snapshot writers", () => {
  const repositorySource = readSource(
    "server/src/repositories/inventoryItem.repository.js",
  );

  assert.doesNotMatch(
    repositorySource,
    /updateInventoryItemStockSnapshot|SET quantity = \$2,\s*packaging_count = \$3/s,
  );

  for (const relativePath of stockMovementServicePaths) {
    const source = readSource(relativePath);

    assert.doesNotMatch(
      source,
      /updateInventoryItemStockSnapshot|buildUpdatedItemStockSnapshot|refreshInventoryItemStockSnapshot|recomputeAndUpdateInventoryItemSnapshots|syncTouchedInventoryItems/,
      `${relativePath} must not rewrite item packaging metadata after stock movement`,
    );
    assert.match(
      source,
      /refreshDerivedInventoryBatchStatusesForItem/,
      `${relativePath} must retain batch status reconciliation`,
    );
  }
});

test("persisted current stock does not fall back to parent packaging metadata", () => {
  const pageSource = readSource("client/src/pages/inventory/InventoryItemsPage.jsx");
  const formattingSource = readSource(
    "client/src/features/inventory-items/inventoryItemFormatting.js",
  );

  assert.doesNotMatch(pageSource, /getTotalItemQuantityValue/);
  assert.doesNotMatch(formattingSource, /getTotalItemQuantityValue/);
  assert.match(
    pageSource,
    /const getMonitorQuantity = \(item, trackingStats\) => \{\s*return Number\(trackingStats\?\.onHand \|\| 0\);\s*\};/s,
  );
});

test("opening stock still converts package count to base units", () => {
  const source = readSource("server/src/services/inventoryItem.service.js");

  assert.match(
    source,
    /Number\(createdItem\.packaging_count \|\| 0\)\s*\*\s*Number\(createdItem\.quantity \|\| 0\)/,
  );
});

test("item quantity remains the stock-form units-per-packaging source", () => {
  const source = readSource("server/src/services/inventoryItem.service.js");

  assert.match(source, /units_per_packaging: getUnitsPerPackagingValue\(itemData\)/);
});
