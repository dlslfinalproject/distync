import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(
  new URL(
    "../src/features/inventory-distribution/useInventoryDistribution.js",
    import.meta.url,
  ),
  "utf8",
);

test("Inventory Distribution uses supported barangay scope for a selected barangay", () => {
  assert.match(source, /barangayId:\s*selectedBarangayId/);

  assert.doesNotMatch(source, /overrideBarangayId:\s*selectedBarangayId/);
});

test("Inventory Distribution municipality aggregation uses supported barangay scope", () => {
  assert.match(source, /barangayId:\s*barangay\.id/);

  assert.doesNotMatch(source, /overrideBarangayId:\s*barangay\.id/);
});

test("Inventory Distribution does not use development barangay overrides", () => {
  assert.doesNotMatch(source, /overrideBarangayId\s*:/);
});
