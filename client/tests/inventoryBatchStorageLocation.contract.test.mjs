import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const testDirectory = dirname(fileURLToPath(import.meta.url));
const formSource = readFileSync(
  resolve(
    testDirectory,
    "../src/components/inventory-batches/InventoryBatchFormModal.jsx",
  ),
  "utf8",
);

test("inventory batch storage location input exposes the 200-character limit", () => {
  assert.match(
    formSource,
    /const INVENTORY_BATCH_STORAGE_LOCATION_MAX_LENGTH = 200;/,
  );
  assert.match(
    formSource,
    /id="storage_location"[\s\S]*maxLength=\{INVENTORY_BATCH_STORAGE_LOCATION_MAX_LENGTH\}/,
  );
});

test("inventory batch form preserves trimmed nullable storage location payloads", () => {
  assert.match(
    formSource,
    /storage_location: formValues\.storage_location\.trim\(\) \|\| null/,
  );
});
