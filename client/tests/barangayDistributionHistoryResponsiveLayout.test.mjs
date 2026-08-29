import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const sourcePath = (...segments) => path.join(process.cwd(), "src", ...segments);

const readSource = (relativePath) =>
  fs.readFile(sourcePath(...relativePath), "utf8");

test("Distribution History exposes scoped responsive hooks for filters, toolbar, and tables", async () => {
  const [pageSource, cssSource] = await Promise.all([
    readSource(["pages", "DistributionHistoryPage.jsx"]),
    readSource(["index.css"]),
  ]);

  assert.match(pageSource, /className="distribution-history-filter-card"/);
  assert.match(pageSource, /className="distribution-history-filter-grid"/);
  assert.match(pageSource, /className="distribution-history-toolbar"/);
  assert.match(pageSource, /className="distribution-history-toolbar-search"/);
  assert.match(pageSource, /className="distribution-history-export-button"/);
  assert.match(pageSource, /aria-label="Search distribution history"/);
  assert.match(pageSource, /className="distribution-history-table-scroll distribution-history-summary-scroll"/);
  assert.match(pageSource, /className="distribution-history-table distribution-history-summary-table"/);
  assert.match(pageSource, /className="distribution-history-table-scroll distribution-history-detail-scroll"/);
  assert.match(pageSource, /className="distribution-history-table distribution-history-detail-table"/);
  assert.match(
    cssSource,
    /\.distribution-history-filter-card,[\s\S]*?\.distribution-history-detail-table \{[\s\S]*?min-width: 0;/,
  );
});

test("Distribution History table overflow is contained and keeps readable table geometry", async () => {
  const cssSource = await readSource(["index.css"]);

  assert.match(
    cssSource,
    /\.distribution-history-table-scroll \{[\s\S]*?max-width: 100%;[\s\S]*?overflow-x: auto !important;[\s\S]*?-webkit-overflow-scrolling: touch;/,
  );
  assert.doesNotMatch(cssSource, /\.distribution-history-table\s*\{[\s\S]*?table-layout:\s*fixed/);
  assert.doesNotMatch(cssSource, /\.distribution-history-summary-table\s*\{[\s\S]*?min-width:\s*(?:940|980)px/);
  assert.doesNotMatch(cssSource, /\.distribution-history-detail-table\s*\{[\s\S]*?min-width:\s*(?:1060|1120)px/);
  assert.match(
    cssSource,
    /\.distribution-history-text-cell \{[\s\S]*?overflow-wrap: break-word;/,
  );
  assert.doesNotMatch(cssSource, /word-break:\s*break-all/);
});

test("Distribution History mobile toolbar controls fill available width without page overflow", async () => {
  const cssSource = await readSource(["index.css"]);

  assert.match(
    cssSource,
    /@media \(max-width: 768px\)[\s\S]*?\.distribution-history-toolbar-search,[\s\S]*?\.distribution-history-export-button \{[\s\S]*?flex: 1 1 100% !important;[\s\S]*?width: 100%;/,
  );
  assert.match(
    cssSource,
    /@media \(max-width: 480px\)[\s\S]*?\.distribution-history-filter-grid \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\) !important;/,
  );
  assert.match(
    cssSource,
    /@media \(max-width: 480px\)[\s\S]*?\.distribution-history-export-button \{[\s\S]*?justify-content: center;/,
  );
});

test("Distribution History canonical pagination bar is compact and adapts on narrow screens", async () => {
  const [paginationSource, cssSource] = await Promise.all([
    readSource(["components", "shared", "TablePagination.jsx"]),
    readSource(["index.css"]),
  ]);
  const normalizedPaginationSource = paginationSource.replace(/\r\n/g, "\n");
  const normalizedCssSource = cssSource.replace(/\r\n/g, "\n");

  assert.match(
    normalizedCssSource,
    /\.table-pagination-bar \{[\s\S]*?justify-content: space-between;[\s\S]*?margin-bottom: 14px;/,
  );
  assert.match(
    normalizedCssSource,
    /\.table-pagination-size select \{[\s\S]*?min-height: 36px;[\s\S]*?padding: 7px 10px;/,
  );
  assert.match(
    normalizedCssSource,
    /@media \(max-width: 768px\)[\s\S]*?\.table-pagination-bar \{[\s\S]*?flex-direction: column;[\s\S]*?gap: 8px;/,
  );
  assert.match(
    normalizedCssSource,
    /@media \(max-width: 768px\)[\s\S]*?\.table-pagination-controls \{[\s\S]*?flex-wrap: wrap;[\s\S]*?width: 100%;/,
  );
  assert.match(
    normalizedCssSource,
    /@media \(max-width: 768px\)[\s\S]*?\.table-pagination-button \{[\s\S]*?flex: 0 0 44px;/,
  );

  const navigationStart = normalizedPaginationSource.indexOf(
    '<div className="table-pagination-navigation">',
  );
  const navigationEnd = normalizedPaginationSource.indexOf(
    "</div>",
    navigationStart + 1,
  );
  assert.ok(navigationStart >= 0);
  assert.ok(navigationEnd > navigationStart);
  const navigationSource = normalizedPaginationSource.slice(
    navigationStart,
    navigationEnd,
  );
  assert.match(
    navigationSource,
    /<button[\s\S]*?<span aria-live="polite">[\s\S]*?<button/,
  );
  assert.match(
    normalizedPaginationSource,
    /getLoadedEntriesLabel\(pagination\.totalItems\)/,
  );
  assert.ok(
    normalizedPaginationSource.indexOf(
      '<label className="table-pagination-size">',
    ) < navigationStart,
  );

  const basePaginationStart = normalizedCssSource.indexOf(
    ".table-pagination-bar {",
  );
  const mobilePaginationBarStart = normalizedCssSource.indexOf(
    ".table-pagination-bar {",
    basePaginationStart + 1,
  );
  const mobileMediaStart = normalizedCssSource.lastIndexOf(
    "@media (max-width: 768px)",
    mobilePaginationBarStart,
  );
  const mobileMediaEnd = normalizedCssSource.indexOf("\n}", mobileMediaStart);
  const mobilePaginationSource = normalizedCssSource.slice(
    mobileMediaStart,
    mobileMediaEnd,
  );
  const mobileNavigationStart = mobilePaginationSource.indexOf(
    ".table-pagination-navigation {",
  );
  const mobileNavigationEnd = mobilePaginationSource.indexOf(
    "\n  }",
    mobileNavigationStart,
  );
  const mobileNavigationSource = mobilePaginationSource.slice(
    mobileNavigationStart,
    mobileNavigationEnd,
  );
  assert.match(
    normalizedCssSource,
    /\.table-pagination-navigation \{[\s\S]*?display: flex;[\s\S]*?flex-direction: row;[\s\S]*?flex-wrap: nowrap;/,
  );
  assert.match(
    mobileNavigationSource,
    /flex: 1 1 100%;[\s\S]*?justify-content: center;[\s\S]*?width: 100%;/,
  );
  assert.doesNotMatch(mobileNavigationSource, /flex-direction:\s*column/);
  assert.match(
    mobilePaginationSource,
    /\.table-pagination-size \{[\s\S]*?flex: 0 0 auto;/,
  );
  assert.match(
    mobilePaginationSource,
    /\.table-pagination-controls \{[\s\S]*?row-gap: 6px;/,
  );
});

test("Distribution History detail action is accessible and does not expose raw QR payload", async () => {
  const pageSource = await readSource(["pages", "DistributionHistoryPage.jsx"]);

  assert.match(pageSource, /aria-label=\{`View details for \$\{formatDisplayStubNumber\(row\)\}`\}/);
  assert.match(pageSource, /formatDisplayStubNumber\(row\)/);
  assert.doesNotMatch(pageSource, /row\.qr_code_value/);
});
