import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const readSource = (relativePath) =>
  fs.readFile(path.join(process.cwd(), "src", ...relativePath), "utf8");

test("inventory item export submits modal filters to the backend without table preflight", async () => {
  const pageSource = await readSource([
    "pages",
    "inventory",
    "InventoryItemsPage.jsx",
  ]);

  assert.doesNotMatch(pageSource, /hasInventoryExportRows/);
  assert.doesNotMatch(pageSource, /NO_EXPORT_DATA_MESSAGE/);
  assert.match(pageSource, /const normalizedCategory = extraFilters\.category \|\| "All";/);
  assert.match(pageSource, /const normalizedStatus = extraFilters\.status \|\| "All";/);
  assert.match(pageSource, /category: normalizedCategory/);
  assert.match(pageSource, /status: normalizedStatus/);
  assert.match(pageSource, /await exportInventoryItems\(/);
});
