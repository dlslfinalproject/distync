import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const sourcePath = (...segments) => path.join(process.cwd(), "src", ...segments);

const readSource = (relativePath) =>
  fs.readFile(sourcePath(...relativePath), "utf8");

test("Mayor inventory distribution page exposes scoped responsive hooks", async () => {
  const [pageSource, cssSource] = await Promise.all([
    readSource(["pages", "inventory", "InventoryDistributionPage.jsx"]),
    readSource(["index.css"]),
  ]);

  assert.match(pageSource, /className="inventory-distribution-page"/);
  assert.match(pageSource, /className="inventory-distribution-tabs"/);
  assert.match(pageSource, /className="inventory-distribution-filter-grid"/);
  assert.match(pageSource, /className="inventory-distribution-summary-grid"/);
  assert.match(pageSource, /className="inventory-distribution-toolbar"/);
  assert.match(pageSource, /className="inventory-distribution-search-wrap"/);
  assert.match(pageSource, /className="inventory-distribution-toolbar-controls"/);
  assert.doesNotMatch(pageSource, /overflowX:\s*"hidden"/);
  assert.match(
    cssSource,
    /\.inventory-distribution-page,[\s\S]*?\.inventory-distribution-page \*,[\s\S]*?\.inventory-distribution-detail-modal,[\s\S]*?\.inventory-distribution-export-modal \* \{[\s\S]*?min-width: 0;/,
  );
  assert.match(
    cssSource,
    /@media \(max-width: 768px\)[\s\S]*?\.inventory-distribution-search-wrap,[\s\S]*?\.inventory-distribution-toolbar-controls,[\s\S]*?\.inventory-distribution-status-filter,[\s\S]*?\.inventory-distribution-filter-button-wrap,[\s\S]*?\.inventory-distribution-export-button \{[\s\S]*?flex: 1 1 100% !important;[\s\S]*?width: 100%;/,
  );
  assert.match(
    cssSource,
    /@media \(max-width: 480px\)[\s\S]*?\.inventory-distribution-summary-grid \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\) !important;/,
  );
});

test("Mayor inventory distribution table keeps overflow local and preserves columns", async () => {
  const [tableSource, cssSource] = await Promise.all([
    readSource(["components", "inventory-distribution", "InventoryDistributionTable.jsx"]),
    readSource(["index.css"]),
  ]);

  assert.match(tableSource, /className="inventory-distribution-records-card"/);
  assert.match(tableSource, /className="inventory-distribution-table-scroll"/);
  assert.match(tableSource, /className="inventory-distribution-table"/);
  assert.match(tableSource, /className="inventory-distribution-status-badge"/);
  assert.match(tableSource, /className="inventory-distribution-action-button"/);
  assert.match(tableSource, /overflowX:\s*"auto"/);
  assert.doesNotMatch(tableSource, /overflowX:\s*"hidden"/);
  assert.match(
    tableSource,
    /Family Head[\s\S]*?Sectors[\s\S]*?Relief Pack[\s\S]*?Status[\s\S]*?Authorized By[\s\S]*?Action/,
  );
  assert.match(
    cssSource,
    /\.inventory-distribution-table-scroll,[\s\S]*?\.inventory-distribution-detail-table-scroll \{[\s\S]*?overflow-x: auto !important;[\s\S]*?-webkit-overflow-scrolling: touch;/,
  );
  assert.match(
    cssSource,
    /@media \(max-width: 480px\)[\s\S]*?\.inventory-distribution-table-cell \{[\s\S]*?line-height: 1\.35 !important;[\s\S]*?padding: 10px 8px !important;/,
  );
});

test("Mayor inventory distribution detail and export modals are phone safe", async () => {
  const [detailSource, exportSource, pageSource, cssSource] = await Promise.all([
    readSource(["components", "inventory-distribution", "InventoryDistributionDetailModal.jsx"]),
    readSource(["components", "mswdo-masterlist", "MswdoExportModal.jsx"]),
    readSource(["pages", "inventory", "InventoryDistributionPage.jsx"]),
    readSource(["index.css"]),
  ]);

  assert.match(detailSource, /panelClassName="inventory-distribution-detail-modal"/);
  assert.match(detailSource, /overlayClassName="inventory-distribution-detail-modal-backdrop"/);
  assert.match(detailSource, /className="inventory-distribution-detail-qr-grid"/);
  assert.match(detailSource, /className="inventory-distribution-detail-table-scroll"/);
  assert.match(exportSource, /modalClassName/);
  assert.match(pageSource, /modalClassName="inventory-distribution-export-modal"/);
  assert.match(pageSource, /gridClassName="inventory-distribution-export-grid"/);
  assert.match(
    cssSource,
    /@media \(max-width: 768px\)[\s\S]*?\.inventory-distribution-detail-modal-backdrop,[\s\S]*?\.inventory-distribution-export-modal-backdrop \{[\s\S]*?align-items: stretch !important;[\s\S]*?padding: 12px !important;/,
  );
  assert.match(
    cssSource,
    /@media \(max-width: 768px\)[\s\S]*?\.inventory-distribution-detail-grid,[\s\S]*?\.inventory-distribution-detail-visual-grid,[\s\S]*?\.inventory-distribution-detail-qr-grid,[\s\S]*?\.inventory-distribution-detail-qr-info-grid,[\s\S]*?\.inventory-distribution-export-grid,[\s\S]*?\.inventory-distribution-export-chip-grid \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\) !important;/,
  );
});
