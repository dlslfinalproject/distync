import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const readSource = (...segments) =>
  fs.readFile(path.join(process.cwd(), "src", ...segments), "utf8");

test("Mayor filter popovers expand short option lists before scrolling", async () => {
  const [sharedSource, transactionSource, itemSource, distributionSource, reliefPackSource, donationSource] =
    await Promise.all([
      readSource("components", "shared", "ResponsiveFilterPopover.jsx"),
      readSource("pages", "inventory", "InventoryTransactionsPage.jsx"),
      readSource("components", "inventory-items", "InventoryFilters.jsx"),
      readSource("pages", "inventory", "InventoryDistributionPage.jsx"),
      readSource("pages", "inventory", "ReliefPackTemplatesPage.jsx"),
      readSource("components", "donations", "DonationFilters.jsx"),
    ]);

  assert.match(sharedSource, /maxHeight: "240px"/);
  assert.match(sharedSource, /overflowY: "auto"/);
  assert.match(sharedSource, /overscrollBehavior: "contain"/);
  assert.match(sharedSource, /maxHeight: "min\(86dvh, calc\(100dvh - 24px\)\)"/);
  assert.match(sharedSource, /maxHeight: "calc\(100vh - 32px\)"/);

  for (const source of [
    transactionSource,
    itemSource,
    distributionSource,
    reliefPackSource,
    donationSource,
  ]) {
    assert.match(source, /maxHeight: "240px"/);
    assert.match(source, /overscrollBehavior: "contain"/);
  }
});
