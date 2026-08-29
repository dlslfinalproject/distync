import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const sourcePath = (...segments) => path.join(process.cwd(), "src", ...segments);

const readSource = (relativePath) =>
  fs.readFile(sourcePath(...relativePath), "utf8");

test("MSWDO Disaster Event page exposes scoped responsive hooks", async () => {
  const [pageSource, tableSource, cssSource] = await Promise.all([
    readSource(["pages", "mswdo", "DisasterEventsPage.jsx"]),
    readSource(["components", "disaster-events", "DisasterEventsTable.jsx"]),
    readSource(["index.css"]),
  ]);

  assert.match(pageSource, /className="disaster-events-tabs"/);
  assert.match(pageSource, /className="disaster-events-toolbar"/);
  assert.match(pageSource, /className="disaster-events-toolbar-search"/);
  assert.match(pageSource, /className="disaster-events-toolbar-actions"/);
  assert.match(pageSource, /className="disaster-events-create-button"/);
  assert.match(pageSource, /className="disaster-events-export-button"/);
  assert.match(pageSource, /className="disaster-events-list-card"/);
  assert.match(tableSource, /className="disaster-events-table-scroll"/);
  assert.match(tableSource, /className="disaster-events-table"/);
  assert.match(tableSource, /import TablePagination/);
  assert.match(tableSource, /getTablePaginationState/);
  assert.match(tableSource, /ariaLabel="Disaster event management pagination"/);
  assert.match(
    cssSource,
    /\.disaster-events-tabs,[\s\S]*?\.disaster-event-detail-barangay-grid \{[\s\S]*?min-width: 0;/,
  );
});

test("MSWDO Disaster Event table overflow is locally contained without fixed layout", async () => {
  const [tableSource, cssSource] = await Promise.all([
    readSource(["components", "disaster-events", "DisasterEventsTable.jsx"]),
    readSource(["index.css"]),
  ]);

  assert.match(tableSource, /tableLayout: "auto"/);
  assert.doesNotMatch(tableSource, /tableLayout: "fixed"/);
  assert.match(tableSource, /className="disaster-events-text-cell"/);
  assert.match(tableSource, /className="disaster-events-date-cell"/);
  assert.match(tableSource, /className="disaster-events-actions-cell"/);
  assert.match(
    cssSource,
    /\.disaster-events-table-scroll \{[\s\S]*?max-width: 100%;[\s\S]*?overflow-x: auto !important;[\s\S]*?-webkit-overflow-scrolling: touch;/,
  );
  assert.match(cssSource, /\.disaster-events-table \{[\s\S]*?table-layout: auto !important;/);
  assert.doesNotMatch(cssSource, /html,[\s\S]*?body,[\s\S]*?#root\s*\{[\s\S]*?overflow-x:\s*hidden/);
  assert.doesNotMatch(cssSource, /\.disaster-events-table\s*\{[\s\S]*?min-width:\s*(?:900|960|1024|1100|1200)px/);
});

test("MSWDO Disaster Event table keeps canonical pagination above its headers", async () => {
  const source = await readSource(["components", "disaster-events", "DisasterEventsTable.jsx"]);

  const normalizedSource = source.replace(/\r\n/g, "\n");
  const populatedStart = normalizedSource.indexOf(
    'return (\n    <div style={{ width: "100%" }}>',
  );
  assert.notEqual(populatedStart, -1);
  const populatedSource = normalizedSource.slice(populatedStart);

  assert.match(populatedSource, /<h3[\s\S]*>Disaster Events<\/h3>[\s\S]*<TablePagination/);
  assert.match(populatedSource, /<TablePagination[\s\S]*paginatedRows\.map/);
  assert.match(populatedSource, /TABLE_PAGE_SIZE_OPTIONS/);
  assert.match(source, /setCurrentPage\(1\)/);
  assert.match(source, /pagination\.totalPages/);
});

test("MSWDO Disaster Event modals expose phone-safe layout hooks", async () => {
  const [formSource, detailSource, exportSource, singleExportSource, cssSource] =
    await Promise.all([
      readSource(["components", "disaster-events", "DisasterEventFormModal.jsx"]),
      readSource(["components", "disaster-events", "DisasterEventDetailModal.jsx"]),
      readSource(["components", "disaster-events", "DisasterEventExportModal.jsx"]),
      readSource([
        "components",
        "disaster-events",
        "DisasterEventSingleExportModal.jsx",
      ]),
      readSource(["index.css"]),
    ]);

  assert.match(formSource, /className="disaster-event-modal-backdrop"/);
  assert.match(formSource, /className="disaster-event-form-modal"/);
  assert.match(formSource, /className="disaster-event-form-grid"/);
  assert.match(formSource, /className="disaster-event-chip-grid"/);
  assert.match(formSource, /className="disaster-event-modal-actions"/);
  assert.match(detailSource, /className="disaster-event-detail-modal"/);
  assert.match(detailSource, /className="disaster-event-detail-value"/);
  assert.doesNotMatch(detailSource, /eventData\?\.id|eventData\.id/);
  assert.match(exportSource, /className="disaster-event-export-modal"/);
  assert.match(exportSource, /className="disaster-event-export-grid"/);
  assert.match(singleExportSource, /className="disaster-event-single-export-modal"/);
  assert.match(
    cssSource,
    /@media \(max-width: 480px\)[\s\S]*?\.disaster-event-modal-backdrop \{[\s\S]*?align-items: stretch !important;[\s\S]*?padding: 12px !important;/,
  );
  assert.match(
    cssSource,
    /@media \(max-width: 480px\)[\s\S]*?\.disaster-event-form-modal,[\s\S]*?\.disaster-event-single-export-modal \{[\s\S]*?max-height: calc\(100vh - 24px\) !important;/,
  );
  assert.match(
    cssSource,
    /@media \(max-width: 480px\)[\s\S]*?\.disaster-event-form-grid,[\s\S]*?\.disaster-event-detail-barangay-grid \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\) !important;/,
  );
});

test("MSWDO Disaster Event toolbar and actions stack without page overflow on mobile", async () => {
  const cssSource = await readSource(["index.css"]);

  assert.match(
    cssSource,
    /@media \(max-width: 768px\)[\s\S]*?\.disaster-events-toolbar-search,[\s\S]*?\.disaster-events-toolbar-actions \{[\s\S]*?flex: 1 1 100% !important;[\s\S]*?width: 100%;/,
  );
  assert.match(
    cssSource,
    /@media \(max-width: 480px\)[\s\S]*?\.disaster-events-toolbar-actions > \*,[\s\S]*?\.disaster-events-toolbar-actions button \{[\s\S]*?width: 100%;[\s\S]*?white-space: normal;/,
  );
  assert.match(
    cssSource,
    /@media \(max-width: 480px\)[\s\S]*?\.disaster-events-tabs \{[\s\S]*?flex-wrap: nowrap !important;/,
  );
});

test("MSWDO Disaster Event affected barangay selector stays compact but touch-safe", async () => {
  const [formSource, cssSource] = await Promise.all([
    readSource(["components", "disaster-events", "DisasterEventFormModal.jsx"]),
    readSource(["index.css"]),
  ]);

  assert.match(formSource, /className="disaster-event-affected-section"/);
  assert.match(formSource, /className="disaster-event-affected-toggle"/);
  assert.match(
    cssSource,
    /\.disaster-event-affected-section \.disaster-event-section-actions \{[\s\S]*?margin-bottom: 8px !important;/,
  );
  assert.match(
    cssSource,
    /\.disaster-event-affected-section \.disaster-event-affected-toggle \{[\s\S]*?min-height: 40px;[\s\S]*?border-radius: 10px !important;[\s\S]*?padding: 7px 12px !important;/,
  );
  assert.match(
    cssSource,
    /\.disaster-event-affected-section \.disaster-event-chip-grid \{[\s\S]*?gap: 7px !important;/,
  );
  assert.match(
    cssSource,
    /\.disaster-event-affected-section \.disaster-event-form-chip \{[\s\S]*?min-height: 40px;[\s\S]*?border-radius: 12px !important;[\s\S]*?padding: 7px 12px !important;[\s\S]*?overflow-wrap: break-word;/,
  );
  const affectedChipRule = cssSource.match(
    /\.disaster-event-affected-section \.disaster-event-form-chip \{[\s\S]*?\n\}/,
  )?.[0];
  assert.ok(affectedChipRule);
  assert.doesNotMatch(affectedChipRule, /[\r\n]\s+height:\s*4[0-9]px/);
});
