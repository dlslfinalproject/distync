import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

const readSource = async (relativePath) =>
  fs.readFile(new URL(relativePath, import.meta.url), "utf8");

test("distribution confirmation does not expose arbitrary inventory batch selection", async () => {
  const pageSource = await readSource(
    "../src/pages/barangay/DistributionTransactionPage.jsx",
  );

  assert.match(pageSource, /StubClaimConfirmModal/);
  assert.match(pageSource, /claimStub\(\{/);
  assert.doesNotMatch(
    pageSource,
    /fetchInventoryBatches|fetchInventoryItems|inventory_batch_id|quantity_released/,
  );
});
