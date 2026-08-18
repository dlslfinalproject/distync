import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const sourcePath = (...segments) => path.join(process.cwd(), "src", ...segments);

const readSource = (relativePath) =>
  fs.readFile(sourcePath(...relativePath), "utf8");

test("Mayor audit trail exposes scoped responsive hooks without changing route or service contract", async () => {
  const [pageSource, routesSource, serviceSource] = await Promise.all([
    readSource(["pages", "SystemLogReviewPage.jsx"]),
    readSource(["routes", "AppRoutes.jsx"]),
    readSource(["features", "system-logs", "systemLogService.js"]),
  ]);

  assert.match(routesSource, /path: "system-logs", element: <SystemLogReviewPage \/>/);
  assert.match(serviceSource, /\/api\/v1\/system-logs\/review/);
  assert.match(pageSource, /type: "audit"/);
  assert.match(pageSource, /limit: AUDIT_PAGE_SIZE/);
  assert.match(pageSource, /className="mayor-audit-trail-page"/);
  assert.match(pageSource, /className="mayor-audit-trail-filter-card"/);
  assert.match(pageSource, /className="mayor-audit-trail-summary-grid"/);
  assert.match(pageSource, /className="mayor-audit-trail-toolbar"/);
  assert.match(pageSource, /className="mayor-audit-trail-search-wrap"/);
  assert.match(pageSource, /className="mayor-audit-trail-records-card"/);
  assert.match(pageSource, /className="mayor-audit-trail-records-toolbar"/);
  assert.match(pageSource, /className="mayor-audit-trail-paginator"/);
  assert.doesNotMatch(pageSource, /overflowX:\s*"hidden"/);
});

test("Mayor audit trail tables keep horizontal overflow local and paginator outside table scroll", async () => {
  const [pageSource, cssSource] = await Promise.all([
    readSource(["pages", "SystemLogReviewPage.jsx"]),
    readSource(["index.css"]),
  ]);

  assert.match(pageSource, /className="mayor-audit-trail-table-scroll"/);
  assert.match(pageSource, /className="mayor-audit-trail-table"/);
  assert.match(pageSource, /className="mayor-audit-trail-detail-table-scroll"/);
  assert.match(pageSource, /className="mayor-audit-trail-detail-table"/);
  assert.match(pageSource, />\s*Audit Action\s*</);
  assert.match(pageSource, />\s*Module\s*</);
  assert.match(pageSource, />\s*Record\s*</);
  assert.match(pageSource, />\s*Performed By\s*</);
  assert.match(pageSource, />\s*Date & Time\s*</);
  assert.match(pageSource, />\s*Action\s*</);
  assert.match(
    pageSource,
    /className="mayor-audit-trail-records-toolbar"[\s\S]*?className="mayor-audit-trail-paginator"[\s\S]*?className="mayor-audit-trail-table-scroll"/,
  );
  assert.match(
    cssSource,
    /\.mayor-audit-trail-table-scroll,[\s\S]*?\.mayor-audit-trail-detail-table-scroll \{[\s\S]*?overflow-x: auto !important;[\s\S]*?overscroll-behavior-x: contain;/,
  );
  assert.match(
    cssSource,
    /\.mayor-audit-trail-table \{[\s\S]*?table-layout: auto !important;[\s\S]*?min-width: 860px !important;/,
  );
  assert.match(
    cssSource,
    /@media \(max-width: 768px\)[\s\S]*?\.mayor-audit-trail-filter-card \{[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\) !important;/,
  );
  assert.match(
    cssSource,
    /@media \(max-width: 480px\)[\s\S]*?\.mayor-audit-trail-filter-card,[\s\S]*?\.mayor-audit-trail-summary-grid \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\) !important;/,
  );
});

