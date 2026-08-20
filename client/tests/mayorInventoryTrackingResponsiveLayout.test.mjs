import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const sourcePath = (...segments) => path.join(process.cwd(), "src", ...segments);

const readSource = (relativePath) =>
  fs.readFile(sourcePath(...relativePath), "utf8");

test("Mayor inventory tracking page exposes scoped responsive hooks", async () => {
  const [pageSource, cssSource] = await Promise.all([
    readSource(["pages", "inventory", "InventoryTransactionsPage.jsx"]),
    readSource(["index.css"]),
  ]);

  assert.match(pageSource, /className="inventory-tracking-page"/);
  assert.match(pageSource, /className="inventory-tracking-filter-grid"/);
  assert.match(pageSource, /className="inventory-tracking-summary-grid"/);
  assert.match(pageSource, /className="inventory-tracking-toolbar"/);
  assert.match(pageSource, /className="inventory-tracking-search-wrap"/);
  assert.match(pageSource, /className="inventory-tracking-movement-filter"/);
  assert.match(pageSource, /className="inventory-tracking-filter-button-wrap"/);
  assert.match(pageSource, /className="inventory-tracking-export-button"/);
  assert.match(pageSource, /className="inventory-tracking-records-card"/);
  assert.doesNotMatch(pageSource, /overflowX:\s*"hidden"/);
  assert.match(
    cssSource,
    /\.inventory-tracking-page,[\s\S]*?\.inventory-tracking-page \*,[\s\S]*?\.inventory-tracking-detail-modal,[\s\S]*?\.inventory-tracking-detail-modal \* \{[\s\S]*?min-width: 0;/,
  );
  assert.match(
    cssSource,
    /@media \(max-width: 768px\)[\s\S]*?\.inventory-tracking-search-wrap,[\s\S]*?\.inventory-tracking-movement-filter,[\s\S]*?\.inventory-tracking-filter-button-wrap,[\s\S]*?\.inventory-tracking-export-button \{[\s\S]*?flex: 1 1 100% !important;[\s\S]*?width: 100%;/,
  );
  assert.match(
    cssSource,
    /@media \(max-width: 480px\)[\s\S]*?\.inventory-tracking-summary-grid \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\) !important;/,
  );
});

test("Mayor inventory tracking table keeps overflow local and preserves columns", async () => {
  const [tableSource, cssSource] = await Promise.all([
    readSource(["components", "inventory-transactions", "InventoryTransactionsTable.jsx"]),
    readSource(["index.css"]),
  ]);

  assert.match(tableSource, /className="inventory-tracking-table-scroll"/);
  assert.match(tableSource, /className="inventory-tracking-table"/);
  assert.match(tableSource, /className="inventory-tracking-table-header-cell"/);
  assert.match(tableSource, /className="inventory-tracking-table-cell inventory-tracking-text-cell"/);
  assert.match(tableSource, /className="inventory-tracking-action-button"/);
  assert.match(tableSource, /overflowX:\s*"auto"/);
  assert.doesNotMatch(tableSource, /overflowX:\s*"hidden"/);
  assert.match(
    tableSource,
    /Item Name[\s\S]*?Batch Number[\s\S]*?ITR No\.[\s\S]*?Quantity[\s\S]*?Movement[\s\S]*?Transaction Type[\s\S]*?Date[\s\S]*?Performed By[\s\S]*?Action/,
  );
  assert.match(
    cssSource,
    /\.inventory-tracking-table-scroll \{[\s\S]*?overflow-x: auto !important;[\s\S]*?-webkit-overflow-scrolling: touch;/,
  );
  assert.match(
    cssSource,
    /@media \(max-width: 480px\)[\s\S]*?\.inventory-tracking-table-cell \{[\s\S]*?line-height: 1\.35 !important;[\s\S]*?padding: 10px 8px !important;/,
  );
});

test("Mayor inventory tracking detail modal is phone safe", async () => {
  const [detailSource, cssSource] = await Promise.all([
    readSource(["components", "inventory-transactions", "InventoryTransactionDetailModal.jsx"]),
    readSource(["index.css"]),
  ]);

  assert.match(detailSource, /panelClassName="inventory-tracking-detail-modal"/);
  assert.match(detailSource, /overlayClassName="inventory-tracking-detail-modal-backdrop"/);
  assert.match(detailSource, /className="inventory-tracking-detail-stack"/);
  assert.match(detailSource, /className="inventory-tracking-detail-section"/);
  assert.match(detailSource, /className="inventory-tracking-detail-grid"/);
  assert.match(
    cssSource,
    /@media \(max-width: 768px\)[\s\S]*?\.inventory-tracking-detail-modal-backdrop \{[\s\S]*?align-items: stretch !important;[\s\S]*?padding: 12px !important;/,
  );
  assert.match(
    cssSource,
    /@media \(max-width: 768px\)[\s\S]*?\.inventory-tracking-filter-grid,[\s\S]*?\.inventory-tracking-detail-grid \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\) !important;/,
  );
});
