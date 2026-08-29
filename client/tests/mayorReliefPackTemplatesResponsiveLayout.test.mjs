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
  assert.match(pageSource, /className="mayor-relief-pack-scope-card"/);
  assert.match(pageSource, /relief-pack-management-status/);
  assert.match(pageSource, /className="mayor-relief-pack-action-group"/);
  assert.doesNotMatch(pageSource, /statusActionButton/);
  assert.match(pageSource, /key: "status"/);
  assert.match(pageSource, /reliefPackCardIdentity/);
  assert.match(pageSource, /reliefPackCardPackType/);
  assert.match(pageSource, /isTemplateInactive\s*\?\s*"—"/);
  assert.match(
    pageSource,
    /<p style=\{reliefPackDetailModalStyles\.label\}>Status<\/p>[\s\S]*?<p style=\{reliefPackDetailModalStyles\.value\}>[\s\S]*?isTemplateInactive\s*\?\s*"Inactive"\s*:\s*"Active"/,
  );
  assert.match(pageSource, /fetchInventoryBatches\(\)/);
  assert.doesNotMatch(pageSource, /isDonatedReliefPackTemplate|isDonatedTemplate/);
  assert.doesNotMatch(pageSource, /Donated relief pack/);
  assert.doesNotMatch(
    pageSource,
    /Inactive packs are excluded from current demand and distribution calculations\./,
  );
  assert.match(pageSource, /className="mayor-relief-pack-card-grid"/);
  assert.match(pageSource, /className="mayor-relief-pack-tabs"/);
  assert.doesNotMatch(pageSource, /Packs Available/);
  assert.match(pageSource, /Packs Needed/);
  assert.match(pageSource, /Item Still Needed/);
  assert.match(pageSource, /const sortTemplateCards = \(/);
  assert.match(pageSource, /leftIsInactive !== rightIsInactive/);
  assert.match(pageSource, /leftIsAdditional !== rightIsAdditional/);
  assert.match(pageSource, /const getTemplateNeededPacks =/);
  assert.match(pageSource, /neededPacksDifference/);
  assert.match(pageSource, /prioritizeDemand: activeTab === "relief-packs"/);
  assert.match(pageSource, /label: "Oldest-Newest"/);
  assert.match(pageSource, /label: "Newest-Oldest"/);
  assert.match(pageSource, /label: "A-Z"/);
  assert.match(pageSource, /label: "Z-A"/);
  assert.match(pageSource, /getTemplateSortableTimestamp/);
  assert.match(
    pageSource,
    /gridTemplateColumns:\s*activeTab === "relief-packs"\s*\n\s*\? "repeat\(4, minmax\(0, 1fr\)\)"/,
  );
  assert.match(pageSource, /const matchesTemplateDisasterEventScope =/);
  assert.match(pageSource, /matchesTemplateDisasterEventScope\(/);
  assert.match(pageSource, /All relief packs/);
  assert.match(pageSource, /!selectedEventId/);
  assert.match(pageSource, /relief-pack-management-pack-type/);
  assert.match(pageSource, /Pack Type/);
  assert.doesNotMatch(pageSource, /className="mayor-relief-pack-type-filter"/);
  assert.doesNotMatch(pageSource, /className="mayor-relief-pack-status-filter"/);
  assert.match(
    pageSource,
    /activeTab === "customization" \? \([\s\S]*?className="mayor-relief-pack-filter-button-wrap"[\s\S]*?<ResponsiveFilterPopover/,
  );
  assert.doesNotMatch(pageSource, /overflowX:\s*"hidden"/);
  assert.match(pageSource, /isHouseholdEligibleForReliefPackDemand/);
  assert.match(pageSource, /\.filter\(isHouseholdEligibleForReliefPackDemand\)/);
  assert.match(pageSource, /isReliefPackInventoryBatchEligible/);
  assert.match(pageSource, /activeDisasterEventIds/);
  assert.match(pageSource, /allocateSharedReliefPackInventory/);
  assert.match(pageSource, /availableStockByItemId/);
  assert.match(pageSource, /matchesTemplateStatusFilter/);
  assert.match(pageSource, /updateReliefPackTemplateStatus/);
  assert.match(
    pageSource,
    /\.forEach\(\(batch\) => \{[\s\S]*?isReliefPackInventoryBatchEligible\(batch,\s*new Date\(\),[\s\S]*?activeDisasterEventIds/,
  );
  assert.match(pageSource, /const hasAllDisasterTypesSelected =/);
  assert.match(
    pageSource,
    /if \(hasAllDisasterTypesSelected\(template\)\) \{[\s\S]*?return \["All disaster types"\];/,
  );
  assert.match(
    pageSource,
    /const getTemplateDisasterApplicabilityDetailLabels[\s\S]*?return DISASTER_TYPE_OPTIONS;/,
  );

  assert.match(
    cssSource,
    /@media \(max-width: 768px\)[\s\S]*?\.mayor-relief-pack-search-wrap,[\s\S]*?\.mayor-relief-pack-filter-button-wrap,[\s\S]*?\.mayor-relief-pack-action-group \{[\s\S]*?flex: 1 1 100% !important;/,
  );
  assert.doesNotMatch(cssSource, /\.mayor-relief-pack-status-filter/);
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
  assert.doesNotMatch(pageSource, /tableStyles\.nameStatus/);
  assert.match(pageSource, /className="mayor-relief-pack-template-item-name"/);
  assert.match(pageSource, /className="mayor-relief-pack-detail-table-scroll"/);
  assert.match(pageSource, /className="mayor-relief-pack-detail-table"/);
  assert.match(pageSource, />\s*Name\s*</);
  assert.match(pageSource, />\s*Pack Type\s*</);
  assert.match(pageSource, />\s*Items\s*</);
  assert.match(pageSource, />\s*Qty \/ Item\s*</);
  assert.match(pageSource, />\s*Rule\s*</);
  assert.match(pageSource, />\s*Applies To\s*</);
  assert.match(
    pageSource,
    /className="mayor-relief-pack-template-status-cell"[\s\S]*?>\s*Status\s*</,
  );
  assert.match(
    pageSource,
    /<span>\s*\{isTemplateInactive\s*\?\s*"Inactive"\s*:\s*"Active"\}\s*<\/span>/,
  );
  assert.doesNotMatch(pageSource, />\s*Available\s*</);
  assert.match(pageSource, />\s*Actions\s*</);
  assert.match(pageSource, /className="mayor-relief-pack-template-rule-cell"/);
  assert.match(pageSource, /className="mayor-relief-pack-template-applies-cell"/);
  assert.match(pageSource, /className="mayor-relief-pack-template-status-cell"/);
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
  assert.match(cssSource, /\.mayor-relief-pack-template-status-cell \{[\s\S]*?min-width: 88px;[\s\S]*?white-space: nowrap;/);
  assert.match(cssSource, /\.mayor-relief-pack-template-actions-cell \{[\s\S]*?min-width: 76px;[\s\S]*?white-space: nowrap;/);
  assert.match(
    cssSource,
    /\.mayor-relief-pack-template-rule-chip,[\s\S]*?\.mayor-relief-pack-template-applies-chip \{[\s\S]*?max-width: 100%;[\s\S]*?white-space: normal;/,
  );
  assert.doesNotMatch(pageSource, /pagination=\{/);
});

test("Relief pack lifecycle confirmation stays concise and text-based", async () => {
  const modalSource = await readSource([
    "components",
    "relief-pack-templates",
    "ReliefPackTemplateStatusConfirmModal.jsx",
  ]);

  assert.match(modalSource, /<ConfirmationModal/);
  assert.match(modalSource, /detailsList/);
  assert.match(modalSource, /detailCard/);
  assert.match(modalSource, /detailLabel/);
  assert.match(modalSource, /detailValue/);
  assert.doesNotMatch(modalSource, /Another standard pack is active/);
  assert.doesNotMatch(modalSource, /StatusPill|FiAlertCircle|FiPower/);
  assert.doesNotMatch(modalSource, /applicabilityPill|summaryCard|explanation/);
});

test("blocked relief pack deactivation uses an acknowledge-only error modal", async () => {
  const [pageSource, modalSource, serviceSource] = await Promise.all([
    readSource(["pages", "inventory", "ReliefPackTemplatesPage.jsx"]),
    readSource([
      "components",
      "relief-pack-templates",
      "ReliefPackTemplateDeactivationBlockedModal.jsx",
    ]),
    readSource([
      "features",
      "relief-pack-templates",
      "reliefPackTemplateService.js",
    ]),
  ]);

  assert.match(pageSource, /ReliefPackTemplateDeactivationBlockedModal/);
  assert.match(pageSource, /RELIEF_PACK_TEMPLATE_DEACTIVATION_BLOCKED/);
  assert.match(pageSource, /setDeactivationBlockedMessage/);
  assert.match(modalSource, /<FormModalShell/);
  assert.match(modalSource, /Cannot Deactivate/);
  assert.match(modalSource, />\s*OK\s*</);
  assert.match(modalSource, /onClick=\{onClose\}/);
  assert.match(modalSource, /role="alert"/);
  assert.doesNotMatch(modalSource, /onConfirm/);
  assert.match(serviceSource, /error\.code\s*=\s*responseData\?\.code/);
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
  assert.match(formSource, /getReliefPackTemplateNameValidationError/);
  assert.match(formSource, /onBlur={handlePackNameBlur}/);
  assert.match(formSource, /getPositiveIntegerValidationError/);
  assert.match(formSource, /is_active: templateData\?\.is_active \?\? false/);
  assert.match(formSource, /quantity_required: parsePositiveInteger\(packItem\.quantity\)/);
  assert.match(
    formSource,
    /id="relief-pack-quantity"[\s\S]*?min="1"[\s\S]*?step="1"[\s\S]*?inputMode="numeric"/,
  );
  assert.match(formSource, /onBlur={handleQuantityBlur}/);
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
