import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  DONATION_TYPE_KEYS,
  isDonatedReliefPackBatch,
} from "../src/features/donations/donationType.js";

const readSource = (relativePath) =>
  fs.readFile(path.join(process.cwd(), "src", ...relativePath), "utf8");

test("donated relief-pack batches are identified separately from loose donated batches", () => {
  assert.equal(
    isDonatedReliefPackBatch({
      source_type: "DONATED",
      source_donation_type: DONATION_TYPE_KEYS.RELIEF_PACK,
    }),
    true,
  );
  assert.equal(
    isDonatedReliefPackBatch({
      source_type: "DONATED",
      source_donation_type: DONATION_TYPE_KEYS.LOOSE_ITEM,
    }),
    false,
  );
  assert.equal(
    isDonatedReliefPackBatch({
      source_type: "LGU",
      source_donation_type: DONATION_TYPE_KEYS.RELIEF_PACK,
    }),
    false,
  );
});

test("inventory status logging excludes donated relief-pack batches", async () => {
  const [pageSource, tableSource, modalSource] = await Promise.all([
    readSource(["pages", "inventory", "InventoryItemsPage.jsx"]),
    readSource(["components", "inventory-items", "InventoryItemsTable.jsx"]),
    readSource(["components", "inventory-items", "InventoryItemStatusLogModal.jsx"]),
  ]);

  assert.match(pageSource, /!isDonatedReliefPackBatch\(batch\)/);
  assert.match(pageSource, /can_log_status: statusLogBatchEligibility\.hasWritableBatches/);
  assert.match(tableSource, /item\.can_log_status === false/);
  assert.match(modalSource, /getWritableInventoryBatches/);
  assert.match(modalSource, /cannot be written off/);
});
