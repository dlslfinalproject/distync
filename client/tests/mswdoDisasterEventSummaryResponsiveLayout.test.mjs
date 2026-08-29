import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const sourcePath = (...segments) => path.join(process.cwd(), "src", ...segments);

const readSource = (relativePath) =>
  fs.readFile(sourcePath(...relativePath), "utf8");

test("MSWDO Disaster Events Summary exposes scoped responsive hooks", async () => {
  const [pageSource, cssSource] = await Promise.all([
    readSource(["pages", "mswdo", "DisasterEventReportsPage.jsx"]),
    readSource(["index.css"]),
  ]);

  assert.match(pageSource, /className="disaster-summary-filter-card"/);
  assert.match(pageSource, /className="disaster-summary-filter-grid"/);
  assert.match(pageSource, /className="disaster-summary-toolbar"/);
  assert.match(pageSource, /className="disaster-summary-toolbar-search"/);
  assert.match(pageSource, /className="disaster-summary-export-button"/);
  assert.match(pageSource, /className="disaster-summary-records-card"/);
  assert.match(pageSource, /className="disaster-summary-table-scroll"/);
  assert.match(pageSource, /className="disaster-summary-table"/);
  assert.match(pageSource, /import TablePagination/);
  assert.match(pageSource, /paginateRows/);
  assert.match(pageSource, /ariaLabel="Disaster events summary pagination"/);
  assert.match(pageSource, /className="disaster-summary-modal-backdrop"/);
  assert.match(pageSource, /className="disaster-summary-export-modal"/);
  assert.match(pageSource, /className="disaster-summary-export-grid"/);
  assert.match(
    cssSource,
    /\.disaster-summary-filter-card,[\s\S]*?\.disaster-summary-export-grid \{[\s\S]*?min-width: 0;/,
  );
});

test("MSWDO Disaster Events Summary table overflow is locally contained without fixed layout", async () => {
  const [pageSource, cssSource] = await Promise.all([
    readSource(["pages", "mswdo", "DisasterEventReportsPage.jsx"]),
    readSource(["index.css"]),
  ]);

  assert.match(pageSource, /tableLayout: "auto"/);
  assert.doesNotMatch(pageSource, /tableLayout: "fixed"/);
  assert.match(pageSource, /className="disaster-summary-text-cell"/);
  assert.match(pageSource, /className="disaster-summary-status-cell"/);
  assert.match(pageSource, /className="disaster-summary-number-cell"/);
  assert.match(
    cssSource,
    /\.disaster-summary-table-scroll \{[\s\S]*?max-width: 100%;[\s\S]*?overflow-x: auto !important;[\s\S]*?-webkit-overflow-scrolling: touch;/,
  );
  assert.match(cssSource, /\.disaster-summary-table \{[\s\S]*?table-layout: auto !important;/);
  assert.doesNotMatch(cssSource, /html,[\s\S]*?body,[\s\S]*?#root\s*\{[\s\S]*?overflow-x:\s*hidden/);
  assert.doesNotMatch(cssSource, /\.disaster-summary-table\s*\{[\s\S]*?min-width:\s*(?:900|960|1024|1100|1200)px/);
});

test("MSWDO Disaster Events Summary toolbar and modal stack on narrow screens", async () => {
  const cssSource = await readSource(["index.css"]);

  assert.match(
    cssSource,
    /@media \(max-width: 768px\)[\s\S]*?\.disaster-summary-toolbar-search,[\s\S]*?\.disaster-summary-export-button \{[\s\S]*?flex: 1 1 100% !important;[\s\S]*?width: 100%;/,
  );
  assert.match(
    cssSource,
    /@media \(max-width: 480px\)[\s\S]*?\.disaster-summary-filter-grid,[\s\S]*?\.disaster-summary-export-grid \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\) !important;/,
  );
  assert.match(
    cssSource,
    /@media \(max-width: 480px\)[\s\S]*?\.disaster-summary-modal-backdrop \{[\s\S]*?align-items: stretch !important;[\s\S]*?padding: 12px !important;/,
  );
  assert.match(
    cssSource,
    /@media \(max-width: 480px\)[\s\S]*?\.disaster-summary-export-modal \{[\s\S]*?max-height: calc\(100vh - 24px\) !important;[\s\S]*?border-radius: 18px !important;[\s\S]*?padding: 16px !important;/,
  );
  assert.match(
    cssSource,
    /@media \(max-width: 480px\)[\s\S]*?\.disaster-summary-modal-actions \{[\s\S]*?display: grid !important;[\s\S]*?grid-template-columns: minmax\(0, 1fr\);/,
  );
});

test("MSWDO Disaster Events Summary preserves presentation-only scope", async () => {
  const [pageSource, serviceSource, routeSource] = await Promise.all([
    readSource(["pages", "mswdo", "DisasterEventReportsPage.jsx"]),
    readSource(["features", "disaster-events", "disasterEventService.js"]),
    fs.readFile(
      path.join(process.cwd(), "..", "server", "src", "routes", "disasterEvent.routes.js"),
      "utf8",
    ),
  ]);

  assert.match(pageSource, /fetchDisasterEventReportSummary\(\{[\s\S]*?disaster_event_id: filters\.disaster_event_id/);
  assert.match(pageSource, /exportDisasterEventReportSummary\(\{[\s\S]*?event_selection: selectedExportEventSelection/);
  assert.match(serviceSource, /\/api\/v1\/disaster-events\/reports\/summary/);
  assert.match(routeSource, /requireRoles\(ROLE_CODES\.MSWDO\)/);
});

test("MSWDO Disaster Events Summary paginates the record collection only", async () => {
  const source = (await readSource(["pages", "mswdo", "DisasterEventReportsPage.jsx"]))
    .replace(/\r\n/g, "\n");
  const recordsCardStart = source.indexOf(
    '<section className="disaster-summary-records-card"',
  );
  assert.notEqual(recordsCardStart, -1);
  const recordsCardSource = source.slice(recordsCardStart);

  assert.match(
    recordsCardSource,
    /<h3[\s\S]*>Disaster Events Record<\/h3>[\s\S]*<TablePagination/,
  );
  assert.match(recordsCardSource, /<TablePagination[\s\S]*paginatedRows\.map/);
  assert.match(source, /setPage\(1\)/);
  assert.match(source, /totalItems: displayedRows\.length/);
});
