import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const sourcePath = (...segments) => path.join(process.cwd(), "src", ...segments);

const readSource = (relativePath) =>
  fs.readFile(sourcePath(...relativePath), "utf8");

test("Mayor donation management page exposes scoped responsive hooks", async () => {
  const [pageSource, filtersSource, tabsSource, cssSource] = await Promise.all([
    readSource(["pages", "DonationManagementPage.jsx"]),
    readSource(["components", "donations", "DonationFilters.jsx"]),
    readSource(["components", "donations", "DonationPageTabs.jsx"]),
    readSource(["index.css"]),
  ]);

  assert.match(pageSource, /className="mayor-donation-management-page"/);
  assert.match(pageSource, /className="mayor-donation-management-summary-grid"/);
  assert.match(pageSource, /className="mayor-donation-management-tabs-card"/);
  assert.match(filtersSource, /className="mayor-donation-management-toolbar"/);
  assert.match(filtersSource, /className="mayor-donation-management-search-wrap"/);
  assert.match(filtersSource, /className="mayor-donation-management-toolbar-controls"/);
  assert.match(filtersSource, /className="mayor-donation-management-type-filter"/);
  assert.match(filtersSource, /className="mayor-donation-management-filter-button-wrap"/);
  assert.match(filtersSource, /className="mayor-donation-management-action-group"/);
  assert.match(filtersSource, /row:\s*\{[\s\S]*?flexWrap:\s*"wrap"/);
  assert.match(filtersSource, /controlsWrap:\s*\{[\s\S]*?flexWrap:\s*"wrap"/);
  assert.match(filtersSource, /actionGroup:\s*\{[\s\S]*?flexWrap:\s*"wrap"/);
  assert.match(tabsSource, /className="mayor-donation-management-tabs"/);
  assert.match(
    cssSource,
    /\.mayor-donation-management-page,[\s\S]*?\.mayor-donation-management-page \*,[\s\S]*?\.mayor-donation-management-export-modal \* \{[\s\S]*?min-width: 0;/,
  );
  assert.doesNotMatch(
    cssSource,
    /\.mayor-donation-management-page \{[^}]*overflow-x:\s*hidden;/,
  );
  assert.match(
    cssSource,
    /@media \(max-width: 1100px\)[\s\S]*?\.mayor-donation-management-toolbar \{[\s\S]*?flex-wrap: wrap !important;/,
  );
  assert.match(
    cssSource,
    /@media \(max-width: 1100px\)[\s\S]*?\.mayor-donation-management-toolbar-controls \{[\s\S]*?flex: 1 1 100% !important;[\s\S]*?flex-wrap: wrap !important;/,
  );
  assert.match(
    cssSource,
    /@media \(max-width: 1100px\)[\s\S]*?\.mayor-donation-management-action-group \{[\s\S]*?flex-wrap: wrap !important;/,
  );
  assert.match(
    cssSource,
    /@media \(max-width: 768px\)[\s\S]*?\.mayor-donation-management-search-wrap,[\s\S]*?\.mayor-donation-management-toolbar-controls,[\s\S]*?\.mayor-donation-management-type-filter,[\s\S]*?\.mayor-donation-management-filter-button-wrap,[\s\S]*?\.mayor-donation-management-action-group \{[\s\S]*?flex: 1 1 100% !important;[\s\S]*?width: 100%;/,
  );
  assert.match(
    cssSource,
    /@media \(max-width: 768px\)[\s\S]*?\.mayor-donation-management-type-filter select,[\s\S]*?\.mayor-donation-management-filter-button-wrap button,[\s\S]*?\.mayor-donation-management-action-group button \{[\s\S]*?width: 100%;[\s\S]*?white-space: normal;/,
  );
  assert.match(
    cssSource,
    /@media \(max-width: 480px\)[\s\S]*?\.mayor-donation-management-summary-grid \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\) !important;/,
  );
  assert.match(
    cssSource,
    /@media \(max-width: 480px\)[\s\S]*?\.mayor-donation-management-action-group \{[\s\S]*?display: grid !important;[\s\S]*?grid-template-columns: minmax\(0, 1fr\);/,
  );
});

test("Mayor donation management records and details keep table overflow local", async () => {
  const [donationsSource, transparencySource, detailSource, cssSource] =
    await Promise.all([
      readSource(["components", "donations", "DonationsTab.jsx"]),
      readSource(["components", "donations", "DonorTransparencyTab.jsx"]),
      readSource(["components", "donations", "DonationDetailModal.jsx"]),
      readSource(["index.css"]),
    ]);

  assert.match(donationsSource, /className="mayor-donation-management-records-card"/);
  assert.match(donationsSource, /className="mayor-donation-management-table-scroll"/);
  assert.match(donationsSource, /className="mayor-donation-management-table"/);
  assert.match(transparencySource, /className="mayor-donation-management-table-scroll"/);
  assert.match(detailSource, /panelClassName="mayor-donation-management-detail-modal"/);
  assert.match(detailSource, /className="mayor-donation-management-detail-table-scroll"/);
  assert.match(detailSource, /className="mayor-donation-management-detail-table"/);
  assert.match(donationsSource, /overflowX:\s*"auto"/);
  assert.doesNotMatch(donationsSource, /overflowX:\s*"hidden"/);
  assert.match(
    cssSource,
    /\.mayor-donation-management-table-scroll,[\s\S]*?\.mayor-donation-management-detail-table-scroll \{[\s\S]*?overflow-x: auto !important;[\s\S]*?-webkit-overflow-scrolling: touch;/,
  );
  assert.match(
    cssSource,
    /@media \(max-width: 480px\)[\s\S]*?\.mayor-donation-management-table \{[\s\S]*?min-width: 780px !important;/,
  );
});

test("Mayor donation record and export modals are phone safe without changing payload semantics", async () => {
  const [modalSource, pageSource, cssSource] = await Promise.all([
    readSource(["components", "donations", "DonationModal.jsx"]),
    readSource(["pages", "DonationManagementPage.jsx"]),
    readSource(["index.css"]),
  ]);

  assert.match(modalSource, /className="mayor-donation-management-form-modal-backdrop"/);
  assert.match(modalSource, /className="mayor-donation-management-form-modal"/);
  assert.match(modalSource, /className="mayor-donation-management-form-grid"/);
  assert.match(modalSource, /className="mayor-donation-management-form-actions"/);
  assert.match(modalSource, /expiration_date/);
  assert.match(modalSource, /per_family_allocation/);
  assert.match(pageSource, /className="mayor-donation-management-export-modal-backdrop"/);
  assert.match(pageSource, /className="mayor-donation-management-export-grid"/);
  assert.match(pageSource, /className="mayor-donation-management-export-actions"/);
  assert.match(
    cssSource,
    /@media \(max-width: 768px\)[\s\S]*?\.mayor-donation-management-form-modal-backdrop,[\s\S]*?\.mayor-donation-management-detail-modal-backdrop,[\s\S]*?\.mayor-donation-management-export-modal-backdrop \{[\s\S]*?align-items: stretch !important;[\s\S]*?padding: 12px !important;/,
  );
  assert.match(
    cssSource,
    /@media \(max-width: 768px\)[\s\S]*?\.mayor-donation-management-event-grid,[\s\S]*?\.mayor-donation-management-form-grid,[\s\S]*?\.mayor-donation-management-detail-grid,[\s\S]*?\.mayor-donation-management-export-grid \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\) !important;/,
  );
});
