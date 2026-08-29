import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const sourcePath = (...segments) => path.join(process.cwd(), "src", ...segments);

const readSource = (relativePath) => fs.readFile(sourcePath(...relativePath), "utf8");

test("MSWDO masterlist exposes Barangay-parity responsive hooks for target-specific regions", async () => {
  const [controlsSource, scopeSource, summarySource, cardsSource, pageSource, cssSource] =
    await Promise.all([
      readSource(["components", "mswdo-masterlist", "MswdoMasterlistControls.jsx"]),
      readSource(["components", "mswdo-masterlist", "MswdoMasterlistScopeSection.jsx"]),
      readSource(["components", "mswdo-masterlist", "MswdoMasterlistEventSummary.jsx"]),
      readSource(["components", "mswdo-masterlist", "MswdoSummaryCards.jsx"]),
      readSource(["pages", "mswdo", "ConsolidatedMasterlistPage.jsx"]),
      readSource(["index.css"]),
    ]);

  assert.match(controlsSource, /className="mswdo-masterlist-toolbar"/);
  assert.match(controlsSource, /className="masterlist-toolbar-search"/);
  assert.match(controlsSource, /className="masterlist-toolbar-actions"/);
  assert.match(scopeSource, /className="mswdo-masterlist-tabs"/);
  assert.match(scopeSource, /className="mswdo-masterlist-filter-grid"/);
  assert.match(scopeSource, /className="mswdo-masterlist-filter-field"/);
  assert.match(summarySource, /className="mswdo-masterlist-event-title"/);
  assert.match(summarySource, /className="mswdo-masterlist-event-meta"/);
  assert.match(cardsSource, /className="mswdo-masterlist-summary-grid"/);
  assert.match(
    pageSource,
    /<MasterlistTable[\s\S]*?rows=\{paginatedRows\}[\s\S]*?showAddressColumn=\{!selectedBarangayId\}/,
  );
  assert.match(pageSource, /getTablePaginationState/);
  assert.match(pageSource, /paginateRows/);
  assert.match(pageSource, /pagination=\{\{/);
  assert.match(pageSource, /onPageChange=\{setCurrentPage\}/);
  assert.match(pageSource, /totalItems=\{pagination\.totalItems\}/);

  assert.match(
    cssSource,
    /\.mswdo-masterlist-toolbar,[\s\S]*?\.mswdo-masterlist-summary-grid \{[\s\S]*?min-width: 0;/,
  );
  assert.match(
    cssSource,
    /\.mswdo-masterlist-event-title,[\s\S]*?\.mswdo-masterlist-event-meta,[\s\S]*?\.household-registration-modal p \{[\s\S]*?overflow-wrap: anywhere;/,
  );
  assert.match(
    cssSource,
    /@media \(max-width: 768px\)[\s\S]*?\.mswdo-masterlist-tabs \{[\s\S]*?overflow-x: auto !important;/,
  );
  assert.match(
    cssSource,
    /@media \(max-width: 768px\)[\s\S]*?\.mswdo-masterlist-filter-grid \{[\s\S]*?grid-template-columns: repeat\(auto-fit, minmax\(min\(220px, 100%\), 1fr\)\) !important;/,
  );
  assert.match(
    cssSource,
    /@media \(max-width: 480px\)[\s\S]*?\.mswdo-masterlist-summary-grid \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\) !important;/,
  );
});

test("FLT-RWD-001: MSWDO masterlist filter uses controlled open-state lifecycle", async () => {
  const [controlsSource, pageSource, hookSource] = await Promise.all([
    readSource(["components", "mswdo-masterlist", "MswdoMasterlistControls.jsx"]),
    readSource(["pages", "mswdo", "ConsolidatedMasterlistPage.jsx"]),
    readSource(["features", "mswdo-masterlist", "useMswdoMasterlistPage.js"]),
  ]);

  assert.match(controlsSource, /onFilterOpenChange/);
  assert.match(controlsSource, /onFilterOpenChange\(nextOpen\)/);
  assert.match(controlsSource, /scopeKey=\{filterScopeKey\}/);
  assert.match(pageSource, /onFilterOpenChange=\{setIsFilterOpen\}/);
  assert.match(pageSource, /filterScopeKey=\{`\$\{activeTab\}-/);
  assert.match(
    hookSource,
    /useEffect\(\(\) => \{\s*setIsFilterOpen\(false\);\s*}\s*, \[activeTab, selectedBarangayId, selectedDisasterEventId\]\)/,
  );
  assert.doesNotMatch(
    pageSource,
    /onToggleFilterOpen=\{\(\) =>\s*setIsFilterOpen\(\(currentValue\) => !currentValue\)/,
  );
});
