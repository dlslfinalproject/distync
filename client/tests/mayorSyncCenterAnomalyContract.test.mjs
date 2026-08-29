import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const sidebarSourcePath = new URL(
  "../src/components/layout/Sidebar.jsx",
  import.meta.url,
);
const routesSourcePath = new URL("../src/routes/AppRoutes.jsx", import.meta.url);
const syncPageSourcePath = new URL(
  "../src/pages/SyncManagementPage.jsx",
  import.meta.url,
);
const syncHelperSourcePath = new URL(
  "../src/features/sync/syncManagementHelpers.js",
  import.meta.url,
);
const anomalyPageSourcePath = new URL(
  "../src/pages/mswdo/AnomalyTrackingPage.jsx",
  import.meta.url,
);
const mayorAnomalyRouteSourcePath = new URL(
  "../src/pages/inventory/MayorAnomalyTrackingPage.jsx",
  import.meta.url,
);
const anomalyPresentationPath = new URL(
  "../src/features/mswdo-reports/anomalyPresentation.js",
  import.meta.url,
);

test("Mayor Monitoring navigation uses the shared hierarchy and Mayor routes", async () => {
  const [sidebarSource, routesSource, wrapperSource] = await Promise.all([
    fs.readFile(sidebarSourcePath, "utf8"),
    fs.readFile(routesSourcePath, "utf8"),
    fs.readFile(mayorAnomalyRouteSourcePath, "utf8"),
  ]);
  const mayorNavBlock =
    sidebarSource.match(
      /\[ROLE_CODES\.MAYOR\]: \{[\s\S]*?navItems: \[([\s\S]*?)\],/,
    )?.[1] || "";

  const monitoringIndex = mayorNavBlock.indexOf(
    '{ type: "section", label: "Monitoring" }',
  );
  const syncIndex = mayorNavBlock.indexOf(
    '{ label: "Sync Center", to: "/inventory/sync", isSectionChild: true }',
  );
  const anomalyIndex = mayorNavBlock.indexOf(
    '{ label: "Anomaly Tracking", to: "/inventory/anomalies", isSectionChild: true }',
  );

  assert.ok(monitoringIndex >= 0);
  assert.ok(syncIndex > monitoringIndex);
  assert.ok(anomalyIndex > syncIndex);
  assert.match(routesSource, /path: "sync", element: <SyncManagementPage \/>/);
  assert.match(
    routesSource,
    /path: "anomalies", element: <MayorAnomalyTrackingPage \/>/,
  );
  assert.match(wrapperSource, /<AnomalyTrackingPage scope="mayor" \/>/);
});

test("Mayor Sync Center is a scoped view of the shared queue and tab contract", async () => {
  const [pageSource, helperSource] = await Promise.all([
    fs.readFile(syncPageSourcePath, "utf8"),
    fs.readFile(syncHelperSourcePath, "utf8"),
  ]);

  assert.match(pageSource, /const MAYOR_RECORD_TYPE_OPTIONS = \[/);
  assert.match(
    pageSource,
    /INVENTORY_ITEM[\s\S]*INVENTORY_BATCH[\s\S]*INVENTORY_TRANSACTION[\s\S]*SUPPLIER/,
  );
  assert.match(pageSource, /const isMayorPortal = currentRole === ROLE_CODES\.MAYOR/);
  assert.match(pageSource, /syncQueueEntries\.filter\(\(entry\) => isMayorOwnedSyncRecord\(entry\)\)/);
  assert.match(helperSource, /MAYOR_SYNC_ENTITY_TYPES/);
  assert.match(helperSource, /export const isMayorOwnedSyncRecord/);
  assert.match(helperSource, /INVENTORY_ITEM_CREATE/);
  assert.match(helperSource, /INVENTORY_TRANSACTION_CREATE/);

  assert.match(
    pageSource,
    /SYNC_SECTION_TABS = \[[\s\S]*QUEUE", label: "Offline Queue"[\s\S]*CONFLICTS", label: "Conflict Review"[\s\S]*AUDIT", label: "Sync History"/,
  );
  assert.match(pageSource, /useState\("QUEUE"\)/);
  assert.match(pageSource, /const SYNC_PAGINATION_TABS = \["QUEUE", "CONFLICTS", "AUDIT"\]/);
  assert.match(pageSource, /DEFAULT_TABLE_PAGE_SIZE/);
  assert.match(pageSource, /<TablePagination/);
  assert.match(pageSource, /setPaginationByTab[\s\S]*page: 1/);
  assert.match(pageSource, /filteredQueueEntries[\s\S]*paginateRows/);
  assert.match(pageSource, /filteredConflicts[\s\S]*paginateRows/);
  assert.match(pageSource, /filteredTransactions[\s\S]*paginateRows/);
});

test("Mayor anomaly tracking keeps only supported inventory anomalies out of Sync Center", async () => {
  const [pageSource, presentationSource, wrapperSource] = await Promise.all([
    fs.readFile(anomalyPageSourcePath, "utf8"),
    fs.readFile(anomalyPresentationPath, "utf8"),
    fs.readFile(mayorAnomalyRouteSourcePath, "utf8"),
  ]);

  assert.match(presentationSource, /scope === "mayor"/);
  assert.match(
    presentationSource,
    /type\.value === "INVENTORY_DISTRIBUTION_MISMATCH"/,
  );
  assert.match(pageSource, /const isMayorScope = scope === "mayor"/);
  assert.match(pageSource, /presentationScope = isBarangayScope[\s\S]*isMayorScope/);
  assert.match(pageSource, /const formatBarangayLabel = \(row, scope = "mswdo"\)[\s\S]*scope === "mayor" \? "—"/);
  assert.match(pageSource, /const canRecordReview =[\s\S]*!isBarangayScope \|\| Boolean\(anomaly\.barangay_id\)/);
  assert.doesNotMatch(pageSource, /needsBarangayAttribution/);
  assert.match(pageSource, /formatAffectedRecord\(row, false, presentationScope\)/);
  assert.match(pageSource, /aria-label="View anomaly details"/);
  assert.match(pageSource, /fetchMswdoAnomalies\([\s\S]*page,[\s\S]*pageSize/);
  assert.match(pageSource, /<TablePagination/);
  assert.match(wrapperSource, /scope="mayor"/);
  assert.doesNotMatch(pageSource, /Mayor Anomaly Tracking/);
});

test("Mayor anomaly presentation uses human-readable inventory identity and safe explanations", async () => {
  const presentation = await import(anomalyPresentationPath.href);
  const mayorTypes = presentation
    .getAnomalyTypesForScope("mayor")
    .map((type) => type.value);

  assert.deepEqual(mayorTypes, ["all", "INVENTORY_DISTRIBUTION_MISMATCH"]);

  const affectedRecord = presentation.formatAffectedRecord(
    {
      anomaly_type: "INVENTORY_DISTRIBUTION_MISMATCH",
      inventory_item_name: "Rice",
      inventory_batch_no: "B-1",
      inventory_transaction_reference_no: "ITR-100",
    },
    false,
    "mayor",
  );
  assert.equal(affectedRecord, "Rice · Batch B-1 · Movement ITR-100");
  assert.equal(
    presentation.getAnomalyExplanation(
      {
        anomaly_type: "INVENTORY_DISTRIBUTION_MISMATCH",
        why_flagged: "payload.entity_id = 123",
      },
      "mayor",
    ),
    "The distribution record does not match the related inventory movement.",
  );
  assert.equal(
    presentation.getAnomalyReviewStatusLabel(
      { anomaly_type: "INVENTORY_DISTRIBUTION_MISMATCH" },
      "mayor",
    ),
    "Open",
  );
});

test("Mayor anomaly pagination remains canonical server pagination", async () => {
  const pageSource = await fs.readFile(anomalyPageSourcePath, "utf8");

  assert.match(pageSource, /useState\(DEFAULT_TABLE_PAGE_SIZE\)/);
  assert.match(pageSource, /const \[pagination, setPagination\]/);
  assert.match(pageSource, /totalItems: 0/);
  assert.match(pageSource, /const shouldShowPaginationControls = totalItems > 0/);
  assert.match(pageSource, /const safePage =/);
  assert.match(pageSource, /setPage\(safePage\)/);
  assert.match(pageSource, /setPage\(1\);\s*setPageSize\(Number\(value\)\)/);
  assert.doesNotMatch(pageSource, /const filteredRows/);
  assert.doesNotMatch(pageSource, /rows\.slice\(/);
});
