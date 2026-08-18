import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const sourcePath = (...segments) => path.join(process.cwd(), "src", ...segments);

const readSource = (relativePath) =>
  fs.readFile(sourcePath(...relativePath), "utf8");

test("Mayor inventory items page exposes responsive hooks for toolbar, summary, and records", async () => {
  const [pageSource, filtersSource, actionsSource, cardsSource, cssSource] =
    await Promise.all([
      readSource(["pages", "inventory", "InventoryItemsPage.jsx"]),
      readSource(["components", "inventory-items", "InventoryFilters.jsx"]),
      readSource(["components", "inventory-items", "InventoryPageActions.jsx"]),
      readSource(["components", "inventory-items", "InventoryOverviewCards.jsx"]),
      readSource(["index.css"]),
    ]);

  assert.match(pageSource, /className="inventory-items-page"/);
  assert.match(pageSource, /className="inventory-items-management-toolbar"/);
  assert.match(pageSource, /className="inventory-items-records-card"/);
  assert.doesNotMatch(pageSource, /overflowX:\s*"hidden"/);
  assert.match(filtersSource, /className="inventory-items-filter-controls"/);
  assert.match(filtersSource, /className="inventory-items-search-wrap"/);
  assert.match(actionsSource, /className="inventory-items-actions-row"/);
  assert.match(cardsSource, /className="inventory-items-summary-grid"/);
  assert.match(
    cssSource,
    /@media \(max-width: 768px\)[\s\S]*?\.inventory-items-filter-controls,[\s\S]*?\.inventory-items-search-wrap,[\s\S]*?\.inventory-items-category-filter,[\s\S]*?\.inventory-items-filter-button-wrap,[\s\S]*?\.inventory-items-actions-row \{[\s\S]*?flex: 1 1 100% !important;/,
  );
  assert.match(
    cssSource,
    /@media \(max-width: 480px\)[\s\S]*?\.inventory-items-summary-grid \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\) !important;/,
  );
});

test("Mayor inventory item table keeps overflow local without hiding columns", async () => {
  const [tableSource, cssSource] = await Promise.all([
    readSource(["components", "inventory-items", "InventoryItemsTable.jsx"]),
    readSource(["index.css"]),
  ]);

  assert.match(tableSource, /className="inventory-items-table-scroll"/);
  assert.match(tableSource, /className="inventory-items-table"/);
  assert.match(tableSource, /overflowX:\s*"auto"/);
  assert.doesNotMatch(tableSource, /overflowX:\s*"hidden"/);
  assert.match(tableSource, /"Item Name"[\s\S]*?"Category"[\s\S]*?"Total Stock"[\s\S]*?"Stock Forms"[\s\S]*?"Reorder Level"[\s\S]*?"Stock Status"[\s\S]*?"Actions"/);
  assert.match(
    cssSource,
    /\.inventory-items-table-scroll,[\s\S]*?\.inventory-item-detail-table-scroll \{[\s\S]*?overflow-x: auto !important;/,
  );
  assert.doesNotMatch(tableSource, /pagination=\{/);
});

test("Mayor inventory forms and modals expose mobile-safe hooks while preserving payload semantics", async () => {
  const [formSource, scanSource, detailSource, statusSource, exportSource, expirySource, cssSource] =
    await Promise.all([
      readSource(["components", "inventory-items", "InventoryItemFormModal.jsx"]),
      readSource(["components", "inventory-items", "InventoryItemScanModal.jsx"]),
      readSource(["components", "inventory-items", "InventoryItemDetailModal.jsx"]),
      readSource(["components", "inventory-items", "InventoryItemStatusLogModal.jsx"]),
      readSource(["components", "inventory-items", "InventoryExportModal.jsx"]),
      readSource(["components", "inventory-items", "InventoryBatchExpiryModal.jsx"]),
      readSource(["index.css"]),
    ]);

  assert.match(formSource, /className="inventory-item-form-modal-backdrop"/);
  assert.match(formSource, /className="inventory-item-form-grid/);
  assert.match(formSource, /existing_item_id: matchedExistingItem\?\.id \|\| null/);
  assert.match(formSource, /restock_match_type: isExactBarcodeStockFormMatch/);
  assert.match(scanSource, /className="inventory-item-scan-modal-backdrop"/);
  assert.match(scanSource, /className="inventory-item-scan-grid/);
  assert.doesNotMatch(scanSource, /getUserMedia|Html5Qrcode|BrowserMultiFormatReader|QrScanner/);
  assert.match(detailSource, /panelClassName="inventory-item-detail-modal"/);
  assert.match(detailSource, /className="inventory-item-detail-table-scroll"/);
  assert.match(statusSource, /className="inventory-item-status-modal-backdrop"/);
  assert.match(exportSource, /className="inventory-export-grid"/);
  assert.match(expirySource, /className="inventory-batch-expiry-grid"/);
  assert.match(
    cssSource,
    /@media \(max-width: 768px\)[\s\S]*?\.inventory-item-form-grid,[\s\S]*?\.inventory-item-form-identity-grid,[\s\S]*?\.inventory-item-form-stock-grid,[\s\S]*?\.inventory-item-scan-grid,[\s\S]*?\.inventory-item-scan-info-grid,[\s\S]*?\.inventory-item-detail-info-grid,[\s\S]*?\.inventory-item-detail-stock-form-grid,[\s\S]*?\.inventory-item-status-grid,[\s\S]*?\.inventory-export-grid,[\s\S]*?\.inventory-batch-expiry-grid \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\) !important;/,
  );
});
