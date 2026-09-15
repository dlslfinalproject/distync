import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const sourcePath = (...segments) => path.join(process.cwd(), "src", ...segments);

const readSource = (relativePath) =>
  fs.readFile(sourcePath(...relativePath), "utf8");

test("MSWDO relief distribution exposes responsive hooks for scope and event context", async () => {
  const [pageSource, summarySource, cssSource] = await Promise.all([
    readSource(["pages", "mswdo", "StubDistributionPage.jsx"]),
    readSource(["components", "stubs", "StubSummaryCards.jsx"]),
    readSource(["index.css"]),
  ]);

  assert.match(pageSource, /className="mswdo-stub-scope-card"/);
  assert.match(pageSource, /className="mswdo-stub-toolbar-shell"/);
  assert.match(pageSource, /className="mswdo-stub-tabs"/);
  assert.match(pageSource, /className="mswdo-stub-filter-grid"/);
  assert.match(pageSource, /className="mswdo-stub-filter-field"/);
  assert.match(pageSource, /className="mswdo-stub-event-summary-card"/);
  assert.match(pageSource, /className="mswdo-stub-event-summary"/);
  assert.match(pageSource, /className="mswdo-stub-event-title"/);
  assert.match(pageSource, /className="mswdo-stub-event-meta"/);
  assert.doesNotMatch(pageSource, /StatusPill/);
  assert.match(pageSource, /className="stub-distribution-print-button"/);
  assert.match(pageSource, /className="stub-distribution-scan-button"/);
  assert.match(summarySource, /className="stub-summary-grid"/);
  assert.match(
    cssSource,
    /\.stub-summary-grid \{[\s\S]*?grid-template-columns: repeat\(4, minmax\(0, 1fr\)\) !important;/,
  );
  assert.match(
    cssSource,
    /@media \(max-width: 1100px\)[\s\S]*?\.stub-summary-grid \{[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\) !important;/,
  );
  assert.match(
    cssSource,
    /@media \(max-width: 480px\)[\s\S]*?\.stub-summary-grid \{[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\) !important;/,
  );
  assert.match(
    cssSource,
    /@media \(max-width: 768px\)[\s\S]*?\.mswdo-stub-tabs \{[\s\S]*?overflow-x: auto !important;/,
  );
  assert.match(
    cssSource,
    /@media \(max-width: 768px\)[\s\S]*?\.mswdo-stub-filter-grid \{[\s\S]*?grid-template-columns: repeat\(auto-fit, minmax\(min\(220px, 100%\), 1fr\)\) !important;/,
  );
  assert.match(
    cssSource,
    /@media \(max-width: 768px\)[\s\S]*?\.mswdo-stub-event-meta \{[\s\S]*?flex-wrap: wrap;/,
  );
  assert.match(
    cssSource,
    /\.mswdo-stub-toolbar-shell \.stub-distribution-toolbar-search,[\s\S]*?order: -1;[\s\S]*?flex: 1 1 100% !important;[\s\S]*?width: 100% !important;/,
  );
  assert.match(
    cssSource,
    /@media \(max-width: 480px\)[\s\S]*?\.mswdo-stub-tabs button \{[\s\S]*?white-space: normal !important;/,
  );
});

test("MSWDO relief distribution table keeps overflow local and hides raw QR values", async () => {
  const [tableSource, cssSource] = await Promise.all([
    readSource(["components", "stubs", "MswdoStubResultsTable.jsx"]),
    readSource(["index.css"]),
  ]);

  assert.match(tableSource, /className="stub-results-card mswdo-stub-results-card"/);
  assert.match(
    tableSource,
    /className="stub-results-table mswdo-stub-results-table"/,
  );
  assert.match(
    tableSource,
    /className="stub-results-table-scroll mswdo-stub-results-table-scroll"/,
  );
  assert.match(
    tableSource,
    /table: \{[\s\S]*?minWidth: "1040px"[\s\S]*?maxWidth: "none"/,
  );
  assert.match(
    tableSource,
    /pillHeaderCell: \{[\s\S]*?textAlign: "center"/,
  );
  assert.match(
    tableSource,
    /pillBodyCell: \{[\s\S]*?textAlign: "center"[\s\S]*?verticalAlign: "middle"/,
  );
  assert.match(
    tableSource,
    /qrStubColumn: \{[\s\S]*?width: "88px"[\s\S]*?minWidth: "88px"/,
  );
  assert.match(tableSource, /statusColumn: \{[\s\S]*?minWidth: "128px"/);
  assert.match(
    tableSource,
    /<span style=\{\{ fontWeight: 700 \}\}>\{row\.family_head_name\}<\/span>/,
  );
  assert.match(
    tableSource,
    /fontWeight: 700,[\s\S]*?lineHeight: 1,[\s\S]*?whiteSpace: "nowrap"/,
  );
  assert.match(tableSource, /className="stub-results-qr-cell"/);
  assert.match(tableSource, /value=\{row\.qr_code_value \|\| ""\}/);
  assert.match(tableSource, /showValue=\{false\}/);
  assert.doesNotMatch(tableSource, /minWidth:\s*"9[89]0px"/);
  assert.match(
    cssSource,
    /@media \(max-width: 768px\)[\s\S]*?\.stub-results-table-scroll \{[\s\S]*?overflow-x: auto !important;/,
  );
  assert.match(
    cssSource,
    /@media \(max-width: 768px\)[\s\S]*?\.stub-results-table-scroll table \{[\s\S]*?min-width: 920px;/,
  );
});

test("MSWDO relief distribution uses canonical pagination for the loaded table", async () => {
  const pageSource = await readSource(["pages", "mswdo", "StubDistributionPage.jsx"]);
  const tableSource = await readSource([
    "components",
    "stubs",
    "MswdoStubResultsTable.jsx",
  ]);
  assert.match(tableSource, /import TablePagination/);
  assert.match(tableSource, /getTablePaginationState/);
  assert.match(tableSource, /TABLE_PAGE_SIZE_OPTIONS/);
  assert.match(tableSource, /ariaLabel="Relief goods distribution pagination"/);
  assert.match(tableSource, /paginatedRows\.map/);
  assert.match(tableSource, /setCurrentPage\(1\)/);
  assert.match(pageSource, /rows=\{displayedRowsWithSyncStatus\}/);
});
