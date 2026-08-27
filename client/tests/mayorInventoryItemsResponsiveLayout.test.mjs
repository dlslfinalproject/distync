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
  assert.match(
    cssSource,
    /@media \(max-width: 480px\)[\s\S]*?\.inventory-items-summary-grid > div \{[\s\S]*?height: auto !important;[\s\S]*?padding: 12px 14px !important;/,
  );
  assert.match(
    cssSource,
    /@media \(max-width: 480px\)[\s\S]*?\.inventory-items-summary-grid > div > p:first-child \{[\s\S]*?min-height: 0 !important;/,
  );
});

test("Mayor inventory item table keeps overflow local without hiding columns", async () => {
  const [tableSource, cssSource] = await Promise.all([
    readSource(["components", "inventory-items", "InventoryItemsTable.jsx"]),
    readSource(["index.css"]),
  ]);

  assert.match(tableSource, /className="inventory-items-table-scroll"/);
  assert.match(tableSource, /className="inventory-items-table"/);
  assert.match(tableSource, /className="inventory-items-table-header-cell"/);
  assert.match(tableSource, /className="inventory-items-table-cell inventory-items-item-cell"/);
  assert.match(tableSource, /className="inventory-items-item-name-text"/);
  assert.match(tableSource, /title=\{itemName\}/);
  assert.match(tableSource, /overflowX:\s*"auto"/);
  assert.doesNotMatch(tableSource, /overflowX:\s*"hidden"/);
  assert.match(tableSource, /"Item Name"[\s\S]*?"Category"[\s\S]*?"Total Stock"[\s\S]*?"Stock Forms"[\s\S]*?"Reorder Level"[\s\S]*?"Stock Status"[\s\S]*?"Actions"/);
  assert.match(
    cssSource,
    /\.inventory-items-table-scroll,[\s\S]*?\.inventory-item-detail-table-scroll \{[\s\S]*?overflow-x: auto !important;/,
  );
  assert.doesNotMatch(tableSource, /pagination=\{/);
  assert.match(
    cssSource,
    /@media \(max-width: 480px\)[\s\S]*?\.inventory-items-table-cell \{[\s\S]*?line-height: 1\.35 !important;[\s\S]*?padding: 10px 8px !important;/,
  );
  assert.match(
    cssSource,
    /@media \(max-width: 480px\)[\s\S]*?\.inventory-items-item-name-text \{[\s\S]*?-webkit-line-clamp: 2;[\s\S]*?white-space: normal !important;/,
  );
});

test("Mayor inventory category filter stacks vertically on narrow phones", async () => {
  const [filtersSource, cssSource] = await Promise.all([
    readSource(["components", "inventory-items", "InventoryFilters.jsx"]),
    readSource(["index.css"]),
  ]);

  assert.match(filtersSource, /className="inventory-items-category-filter"/);
  assert.match(filtersSource, /htmlFor="inventory-category-filter"/);
  assert.match(filtersSource, /id="inventory-category-filter"/);
  assert.match(
    cssSource,
    /@media \(max-width: 480px\)[\s\S]*?\.inventory-items-category-filter \{[\s\S]*?align-items: stretch !important;[\s\S]*?flex-direction: column;[\s\S]*?gap: 6px !important;[\s\S]*?justify-content: flex-start !important;/,
  );
  assert.match(
    cssSource,
    /@media \(max-width: 480px\)[\s\S]*?\.inventory-items-category-filter select \{[\s\S]*?max-width: 100%;[\s\S]*?min-width: 0 !important;/,
  );
});

test("Mayor inventory forms and modals expose mobile-safe hooks while preserving payload semantics", async () => {
  const [
    pageSource,
    formSource,
    scanSource,
    detailSource,
    statusSource,
    exportSource,
    expirySource,
    cssSource,
  ] =
    await Promise.all([
      readSource(["pages", "inventory", "InventoryItemsPage.jsx"]),
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
  assert.doesNotMatch(formSource, /restock_match_type/);
  assert.match(formSource, /hasUnselectedDuplicateName/);
  assert.match(formSource, /This item already exists/);
  assert.match(formSource, /getUnitsPerPackagingForDisplay/);
  assert.match(formSource, /formatPackagingUnit/);
  assert.match(formSource, /\$\{unitsPerPackaging\}/);
  assert.doesNotMatch(pageSource, /Existing item found:/);
  assert.match(formSource, /const scannedBarcode =/);
  assert.match(formSource, /const getEffectiveBarcode =/);
  assert.match(
    formSource,
    /const hasExistingBarcode = Boolean\(\s*normalizeInventoryBarcode\(itemData\?\.barcode\),\s*\);/,
  );
  assert.match(
    formSource,
    /const isBarcodeLocked =\s*\(isEditMode && hasExistingBarcode\)/,
  );
  assert.match(formSource, /disabled=\{isBarcodeLocked\}/);
  assert.match(formSource, /barcode: isBlank\(effectiveBarcode\)/);
  assert.match(formSource, /findMatchingStockFormByDefinition/);
  assert.match(formSource, /The scanned barcode will be assigned to this packaging/);
  assert.match(formSource, /This barcode is already linked to this packaging/);
  assert.doesNotMatch(
    formSource,
    /assignBarcodeToExistingStockForm|assign_barcode_to_existing_stock_form/,
  );
  assert.match(scanSource, /className="inventory-item-scan-modal-backdrop"/);
  assert.match(scanSource, /className="inventory-item-scan-grid/);
  assert.match(scanSource, /Restock Existing Item/);
  assert.doesNotMatch(scanSource, /Existing item found:/);
  assert.doesNotMatch(scanSource, /getUserMedia|Html5Qrcode|BrowserMultiFormatReader|QrScanner/);
  assert.match(detailSource, /panelClassName="inventory-item-detail-modal"/);
  assert.match(detailSource, /className="inventory-item-detail-table-scroll"/);
  assert.match(statusSource, /className="inventory-item-status-modal-backdrop"/);
  assert.match(statusSource, /const parsePositiveWholeQuantity = \(value\) =>/);
  assert.match(statusSource, /\^\[0-9\]\+\$/);
  assert.match(statusSource, /parsedQuantity > selectedBatchAvailableStock/);
  assert.match(statusSource, /quantity: parsePositiveWholeQuantity\(formValues\.quantity\)/);
  assert.match(statusSource, /<form onSubmit=\{handleSubmit\} noValidate>/);
  assert.match(statusSource, /id="status_quantity"[\s\S]*?type="text"/);
  assert.match(statusSource, /inputMode="numeric"/);
  assert.match(statusSource, /const AUTOMATIC_REFERENCE_LABEL = "Assigned automatically on save"/);
  assert.match(statusSource, /value=\{AUTOMATIC_REFERENCE_LABEL\}/);
  assert.match(statusSource, /aria-readonly="true"/);
  assert.doesNotMatch(statusSource, /formValues\.inventoryTransactionReferenceNo/);
  assert.match(exportSource, /className="inventory-export-grid"/);
  assert.match(expirySource, /className="inventory-batch-expiry-grid"/);
  assert.match(
    cssSource,
    /@media \(max-width: 768px\)[\s\S]*?\.inventory-item-form-grid,[\s\S]*?\.inventory-item-form-identity-grid,[\s\S]*?\.inventory-item-form-stock-grid,[\s\S]*?\.inventory-item-scan-grid,[\s\S]*?\.inventory-item-scan-info-grid,[\s\S]*?\.inventory-item-detail-info-grid,[\s\S]*?\.inventory-item-detail-stock-form-grid,[\s\S]*?\.inventory-item-status-grid,[\s\S]*?\.inventory-export-grid,[\s\S]*?\.inventory-batch-expiry-grid \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\) !important;/,
  );
});
