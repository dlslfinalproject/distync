import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const sourcePath = (...segments) => path.join(process.cwd(), "src", ...segments);

const readSource = (relativePath) =>
  fs.readFile(sourcePath(...relativePath), "utf8");

test("Mayor small-screen toolbars keep searches full-width and pair actions", async () => {
  const [itemsPage, batchesPage, reliefPackPage, donationFilters, anomalyPage, css] =
    await Promise.all([
      readSource(["pages", "inventory", "InventoryItemsPage.jsx"]),
      readSource(["pages", "inventory", "InventoryBatchesPage.jsx"]),
      readSource(["pages", "inventory", "ReliefPackTemplatesPage.jsx"]),
      readSource(["components", "donations", "DonationFilters.jsx"]),
      readSource(["pages", "mswdo", "AnomalyTrackingPage.jsx"]),
      readSource(["index.css"]),
    ]);

  assert.match(itemsPage, /className="inventory-items-management-toolbar"/);
  assert.match(batchesPage, /className="mayor-inventory-batches-toolbar"/);
  assert.match(reliefPackPage, /data-active-tab=\{activeTab\}/);
  assert.match(donationFilters, /data-toolbar-tab="donations"/);
  assert.match(donationFilters, /data-toolbar-tab="transparency"/);
  assert.match(anomalyPage, /"mayor-anomaly-toolbar"/);

  const toolbarCss = css.split("/* Mayor dashboard toolbar layout:")[1] || "";

  assert.match(
    toolbarCss,
    /\.inventory-items-page-top-actions \.inventory-items-actions-row\s*\{[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\) !important;/,
  );
  assert.match(
    toolbarCss,
    /\.inventory-items-management-toolbar\s*\{[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\) !important;/,
  );
  assert.match(
    toolbarCss,
    /\.mayor-inventory-batches-search-wrap,[\s\S]*?\.mayor-anomaly-toolbar-search,[\s\S]*?\.sync-center-toolbar__search\s*\{[\s\S]*?grid-column: 1 \/ -1;/,
  );
  assert.match(
    toolbarCss,
    /\.mayor-inventory-batches-action-group > div\s*\{[\s\S]*?grid-column: 2;/,
  );
  assert.match(
    toolbarCss,
    /\.mayor-donation-management-toolbar\[data-toolbar-tab="transparency"\][\s\S]*?\.mayor-donation-management-export-button\s*\{[\s\S]*?grid-column: 2;[\s\S]*?grid-row: 2;/,
  );
  assert.match(
    toolbarCss,
    /\.mayor-relief-pack-toolbar\[data-active-tab="relief-packs"\][\s\S]*?\.mayor-relief-pack-action-group button\s*\{[\s\S]*?grid-column: 1 \/ -1;/,
  );
  assert.match(
    toolbarCss,
    /\.sync-center-toolbar\s*\{[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\) !important;/,
  );
});
