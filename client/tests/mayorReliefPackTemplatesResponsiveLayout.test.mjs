import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const sourcePath = (...segments) => path.join(process.cwd(), "src", ...segments);

const readSource = (relativePath) =>
  fs.readFile(sourcePath(...relativePath), "utf8");

test("Mayor relief pack templates page exposes scoped responsive hooks", async () => {
  const [pageSource, cssSource] = await Promise.all([
    readSource(["pages", "inventory", "ReliefPackTemplatesPage.jsx"]),
    readSource(["index.css"]),
  ]);

  assert.match(pageSource, /className="mayor-relief-pack-templates-page"/);
  assert.match(pageSource, /className="mayor-relief-pack-toolbar"/);
  assert.match(pageSource, /className="mayor-relief-pack-toolbar-controls"/);
  assert.match(pageSource, /className="mayor-relief-pack-search-wrap"/);
  assert.match(pageSource, /className="mayor-relief-pack-type-filter"/);
  assert.match(pageSource, /className="mayor-relief-pack-action-group"/);
  assert.match(pageSource, /className="mayor-relief-pack-card-grid"/);
  assert.match(pageSource, /className="mayor-relief-pack-tabs"/);
  assert.doesNotMatch(pageSource, /overflowX:\s*"hidden"/);

  assert.match(
    cssSource,
    /@media \(max-width: 768px\)[\s\S]*?\.mayor-relief-pack-search-wrap,[\s\S]*?\.mayor-relief-pack-type-filter,[\s\S]*?\.mayor-relief-pack-filter-button-wrap,[\s\S]*?\.mayor-relief-pack-action-group \{[\s\S]*?flex: 1 1 100% !important;/,
  );
  assert.match(
    cssSource,
    /@media \(max-width: 1100px\)[\s\S]*?\.mayor-relief-pack-card-grid \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\) !important;/,
  );
  assert.match(
    cssSource,
    /@media \(max-width: 768px\)[\s\S]*?\.mayor-relief-pack-tabs \{[\s\S]*?overflow-x: auto !important;/,
  );
});

test("Mayor relief pack template table and detail tables keep overflow local", async () => {
  const [pageSource, cssSource] = await Promise.all([
    readSource(["pages", "inventory", "ReliefPackTemplatesPage.jsx"]),
    readSource(["index.css"]),
  ]);

  assert.match(pageSource, /className="mayor-relief-pack-template-table-scroll"/);
  assert.match(pageSource, /className="mayor-relief-pack-template-table"/);
  assert.match(pageSource, /className="mayor-relief-pack-template-name"/);
  assert.match(pageSource, /className="mayor-relief-pack-template-item-name"/);
  assert.match(pageSource, /className="mayor-relief-pack-detail-table-scroll"/);
  assert.match(pageSource, /className="mayor-relief-pack-detail-table"/);
  assert.match(pageSource, />\s*Name\s*</);
  assert.match(pageSource, />\s*Pack Type\s*</);
  assert.match(pageSource, />\s*Items\s*</);
  assert.match(pageSource, />\s*Qty \/ Item\s*</);
  assert.match(pageSource, />\s*Rule\s*</);
  assert.match(pageSource, />\s*Applies To\s*</);
  assert.match(pageSource, />\s*Available\s*</);
  assert.match(pageSource, />\s*Actions\s*</);
  assert.match(pageSource, /className="mayor-relief-pack-template-rule-cell"/);
  assert.match(pageSource, /className="mayor-relief-pack-template-applies-cell"/);
  assert.match(pageSource, /className="mayor-relief-pack-template-available-cell"/);
  assert.match(pageSource, /className="mayor-relief-pack-template-actions-cell"/);
  assert.match(pageSource, /className="mayor-relief-pack-template-rule-chip"/);
  assert.match(pageSource, /className="mayor-relief-pack-template-applies-chip"/);
  assert.match(
    cssSource,
    /\.mayor-relief-pack-template-table-scroll,[\s\S]*?\.mayor-relief-pack-detail-table-scroll \{[\s\S]*?overflow-x: auto !important;[\s\S]*?-webkit-overflow-scrolling: touch;/,
  );
  assert.match(
    cssSource,
    /\.mayor-relief-pack-template-table \{[\s\S]*?table-layout: auto !important;[\s\S]*?min-width: 920px !important;/,
  );
  assert.match(cssSource, /\.mayor-relief-pack-template-rule-cell \{[\s\S]*?min-width: 130px;/);
  assert.match(cssSource, /\.mayor-relief-pack-template-applies-cell \{[\s\S]*?min-width: 140px;/);
  assert.match(cssSource, /\.mayor-relief-pack-template-available-cell \{[\s\S]*?min-width: 88px;[\s\S]*?white-space: nowrap;/);
  assert.match(cssSource, /\.mayor-relief-pack-template-actions-cell \{[\s\S]*?min-width: 76px;[\s\S]*?white-space: nowrap;/);
  assert.match(
    cssSource,
    /\.mayor-relief-pack-template-rule-chip,[\s\S]*?\.mayor-relief-pack-template-applies-chip \{[\s\S]*?max-width: 100%;[\s\S]*?white-space: normal;/,
  );
  assert.doesNotMatch(pageSource, /pagination=\{/);
});

test("Mayor relief pack form modal is mobile-safe without changing payload semantics", async () => {
  const [formSource, serviceSource, routesSource, cssSource] = await Promise.all([
    readSource(["components", "relief-pack-templates", "ReliefPackTemplateFormModal.jsx"]),
    readSource(["features", "relief-pack-templates", "reliefPackTemplateService.js"]),
    readSource(["routes", "AppRoutes.jsx"]),
    readSource(["index.css"]),
  ]);

  assert.match(formSource, /className="mayor-relief-pack-form-modal-backdrop"/);
  assert.match(formSource, /className="mayor-relief-pack-form-modal"/);
  assert.match(formSource, /className="mayor-relief-pack-form-grid"/);
  assert.match(formSource, /className="mayor-relief-pack-item-entry-grid"/);
  assert.match(formSource, /className="mayor-relief-pack-composition-row"/);
  assert.match(formSource, /className="mayor-relief-pack-composition-item-name"/);
  assert.match(formSource, /className="mayor-relief-pack-form-footer-actions"/);
  assert.match(formSource, /inventory_item_id: packItem\.inventory_item_id/);
  assert.match(formSource, /quantity_required: Number\.parseInt\(packItem\.quantity, 10\)/);
  assert.match(serviceSource, /\/api\/v1\/relief-pack-templates/);
  assert.match(routesSource, /path: "relief-pack-templates"/);
  assert.match(
    cssSource,
    /@media \(max-width: 768px\)[\s\S]*?\.mayor-relief-pack-form-grid,[\s\S]*?\.mayor-relief-pack-form-pack-type-grid,[\s\S]*?\.mayor-relief-pack-item-entry-grid,[\s\S]*?\.mayor-relief-pack-chip-grid \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\) !important;/,
  );
  assert.match(
    cssSource,
    /@media \(max-width: 768px\)[\s\S]*?\.mayor-relief-pack-composition-row \{[\s\S]*?flex-direction: column;/,
  );
});
