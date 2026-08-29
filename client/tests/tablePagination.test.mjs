import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  DEFAULT_TABLE_PAGE_SIZE,
  getTablePaginationState,
  paginateRows,
  TABLE_PAGE_SIZE_OPTIONS,
} from "../src/features/pagination/pagination.mjs";

const sourcePath = (...segments) =>
  path.join(process.cwd(), "src", ...segments);

const normalizeSource = (source) => source.replace(/\r\n/g, "\n");

const assertOrdered = (source, markers) => {
  let previousIndex = -1;

  for (const marker of markers) {
    const index = source.indexOf(marker, previousIndex + 1);

    assert.ok(index >= 0, `Missing structural marker: ${marker}`);
    assert.ok(
      index > previousIndex,
      `Expected structural marker after the previous marker: ${marker}`,
    );
    previousIndex = index;
  }
};

test("canonical table pagination keeps the required options and empty state safe", () => {
  assert.deepEqual(TABLE_PAGE_SIZE_OPTIONS, [25, 50, 100]);
  assert.equal(DEFAULT_TABLE_PAGE_SIZE, 25);
  assert.deepEqual(
    getTablePaginationState({ totalItems: 0, currentPage: 8, pageSize: 50 }),
    {
      totalItems: 0,
      totalPages: 0,
      currentPage: 1,
      pageSize: 50,
      pageSizeOptions: [25, 50, 100],
      hasPreviousPage: false,
      hasNextPage: false,
    },
  );
});

test("table pagination calculates boundaries from the current dataset", () => {
  const firstPage = getTablePaginationState({
    totalItems: 51,
    currentPage: 1,
    pageSize: 25,
  });
  const middlePage = getTablePaginationState({
    totalItems: 51,
    currentPage: 2,
    pageSize: 25,
  });
  const clampedLastPage = getTablePaginationState({
    totalItems: 51,
    currentPage: 99,
    pageSize: 25,
  });

  assert.equal(firstPage.totalPages, 3);
  assert.equal(firstPage.currentPage, 1);
  assert.equal(firstPage.hasPreviousPage, false);
  assert.equal(firstPage.hasNextPage, true);
  assert.equal(middlePage.currentPage, 2);
  assert.equal(middlePage.hasPreviousPage, true);
  assert.equal(middlePage.hasNextPage, true);
  assert.equal(clampedLastPage.currentPage, 3);
  assert.equal(clampedLastPage.hasPreviousPage, true);
  assert.equal(clampedLastPage.hasNextPage, false);
});

test("changing rows per page recalculates page count and page slicing", () => {
  const rows = Array.from({ length: 101 }, (_, index) => `row-${index + 1}`);

  assert.equal(
    getTablePaginationState({ totalItems: rows.length, pageSize: 50 })
      .totalPages,
    3,
  );
  assert.deepEqual(paginateRows(rows, 3, 50), ["row-101"]);
  assert.deepEqual(paginateRows(rows, 2, 100), ["row-101"]);
});

test("filtered datasets and Sync Center tabs paginate independently", () => {
  const rows = Array.from({ length: 60 }, (_, index) => ({
    id: index + 1,
    status: index % 2 === 0 ? "OPEN" : "RESOLVED",
  }));
  const openRows = rows.filter((row) => row.status === "OPEN");
  const resolvedRows = rows.filter((row) => row.status === "RESOLVED");

  assert.deepEqual(
    paginateRows(openRows, 2, 25).map((row) => row.id),
    [51, 53, 55, 57, 59],
  );
  assert.deepEqual(
    paginateRows(resolvedRows, 1, 25).map((row) => row.id),
    Array.from({ length: 25 }, (_, index) => index * 2 + 2),
  );
});

test("all Barangay table surfaces use the shared paginator and Sync Center slices each tab", async () => {
  const readSource = (relativePath) =>
    fs.readFile(sourcePath(...relativePath), "utf8");
  const [
    inventoryPageSource,
    inventoryTableSource,
    paginationSource,
    masterlistSource,
    stubSource,
    historySource,
    anomalySource,
    syncSource,
  ] = await Promise.all([
    readSource(["pages", "inventory", "InventoryItemsPage.jsx"]),
    readSource(["components", "inventory-items", "InventoryItemsTable.jsx"]),
    readSource(["components", "shared", "TablePagination.jsx"]),
    readSource(["components", "masterlist", "MasterlistTable.jsx"]),
    readSource(["components", "stubs", "StubResultsTable.jsx"]),
    readSource(["pages", "DistributionHistoryPage.jsx"]),
    readSource(["pages", "mswdo", "AnomalyTrackingPage.jsx"]),
    readSource(["pages", "SyncManagementPage.jsx"]),
  ]);

  const normalizedInventoryPageSource = normalizeSource(inventoryPageSource);
  const normalizedInventoryTableSource = normalizeSource(inventoryTableSource);
  const normalizedPaginationSource = normalizeSource(paginationSource);
  const normalizedMasterlistSource = normalizeSource(masterlistSource);
  const normalizedStubSource = normalizeSource(stubSource);
  const normalizedHistorySource = normalizeSource(historySource);
  const normalizedAnomalySource = normalizeSource(anomalySource);
  const normalizedSyncSource = normalizeSource(syncSource);

  assert.match(
    normalizedPaginationSource,
    /Showing \{pagination\.totalItems\} loaded entries/,
  );
  assert.match(normalizedPaginationSource, /Rows per page/);
  assert.match(normalizedPaginationSource, /FiChevronLeft/);
  assert.match(normalizedPaginationSource, /FiChevronRight/);

  for (const source of [
    normalizedMasterlistSource,
    normalizedStubSource,
    normalizedHistorySource,
    normalizedAnomalySource,
  ]) {
    assert.match(source, /<TablePagination/);
  }

  assertOrdered(normalizedInventoryPageSource, [
    '<section className="inventory-items-records-card"',
    '<h3 className="table-card-title">',
    "<InventoryItemsTable",
  ]);
  assertOrdered(normalizedInventoryTableSource, [
    "const paginationBar = (",
    "<TablePagination",
    'className="inventory-items-table-scroll"',
    '<table className="inventory-items-table"',
    "<thead>",
  ]);

  const masterlistPopulatedStart = normalizedMasterlistSource.indexOf(
    '  return (\n    <section style={shellStyles.card}>',
    normalizedMasterlistSource.indexOf("const areAllSelected"),
  );
  assert.ok(masterlistPopulatedStart >= 0);
  assertOrdered(normalizedMasterlistSource.slice(masterlistPopulatedStart), [
    '<h3 className="table-card-title">Registered Family</h3>',
    "<TablePagination",
    '<div style={{ overflowX: "auto" }}>',
    "<table style={tableStyles.table}",
    "<thead>",
  ]);

  const stubPopulatedStart = normalizedStubSource.indexOf(
    '  return (\n    <section className="stub-results-card" style={shellStyles.card}>',
    normalizedStubSource.indexOf("const totalItems"),
  );
  assert.ok(stubPopulatedStart >= 0);
  assertOrdered(normalizedStubSource.slice(stubPopulatedStart), [
    '<h3 className="table-card-title">Stub Information</h3>',
    "<TablePagination",
    'className="stub-results-table-scroll"',
    "<table style={tableStyles.table}",
    "<thead>",
  ]);

  assertOrdered(normalizedHistorySource, [
    '<section className="distribution-history-records-card"',
    '<h3 className="table-card-title">Distribution Records</h3>',
    "<TablePagination",
    'className="distribution-history-table-scroll',
    "<table className=",
    "<thead>",
  ]);

  const anomalyRecordsStart = normalizedAnomalySource.lastIndexOf(
    '<section style={shellStyles.card}>',
  );
  assert.ok(anomalyRecordsStart >= 0);
  assertOrdered(normalizedAnomalySource.slice(anomalyRecordsStart), [
    '<h3\n          className="table-card-title"',
    "Anomaly Records",
    "<TablePagination",
    '<div style={{ overflowX: "auto"',
    "<table",
    "<thead>",
  ]);

  const queueStart = normalizedSyncSource.indexOf(
    'activeSyncTab === "QUEUE" ?',
  );
  const auditStart = normalizedSyncSource.indexOf(
    'activeSyncTab === "AUDIT" ?',
    queueStart + 1,
  );
  const conflictStart = normalizedSyncSource.indexOf(
    'activeSyncTab === "CONFLICTS" ?',
    auditStart + 1,
  );
  const syncTabBlocks = {
    QUEUE: normalizedSyncSource.slice(queueStart, auditStart),
    AUDIT: normalizedSyncSource.slice(auditStart, conflictStart),
    CONFLICTS: normalizedSyncSource.slice(conflictStart),
  };
  assertOrdered(syncTabBlocks.QUEUE, [
    '<h2 style={srOnlyStyles}>Offline Queue</h2>',
    "<TablePagination",
    'ariaLabel="Offline queue pagination"',
    'className="sync-center-table-scroll"',
    "<table style={offlineQueueTableStyles}",
    "<thead>",
  ]);
  assertOrdered(syncTabBlocks.CONFLICTS, [
    '<h2 style={srOnlyStyles}>Conflict Review</h2>',
    "<TablePagination",
    'ariaLabel="Conflict review pagination"',
    'className="sync-center-table-scroll"',
    "<table style={conflictReviewTableStyles}",
    "<thead>",
  ]);
  assertOrdered(syncTabBlocks.AUDIT, [
    '<h2 style={srOnlyStyles}>Sync History</h2>',
    "<TablePagination",
    'ariaLabel="Sync history pagination"',
    'className="sync-center-table-scroll"',
    "<table style={syncHistoryTableStyles}",
    "<thead>",
  ]);

  assert.match(normalizedSyncSource, /paginationByTab/);
  assert.match(
    normalizedSyncSource,
    /const SYNC_PAGINATION_TABS = \["QUEUE", "CONFLICTS", "AUDIT"\]/,
  );
  assert.match(normalizedSyncSource, /const updatePaginationPage = \(tab, page\)/);
  assert.match(
    normalizedSyncSource,
    /const updatePaginationPageSize = \(tab, pageSize\)/,
  );
  assert.doesNotMatch(normalizedSyncSource, /\}, \[activeSyncTab, filters\]\);/);
  assert.match(normalizedSyncSource, /paginateRows\(/);
  assert.match(normalizedSyncSource, /paginatedQueueEntries\.map/);
  assert.match(normalizedSyncSource, /paginatedConflicts\.map/);
  assert.match(normalizedSyncSource, /paginatedTransactions\.map/);

  for (const source of [
    normalizedInventoryTableSource,
    normalizedMasterlistSource,
    normalizedStubSource,
    normalizedHistorySource,
    normalizedAnomalySource,
    normalizedSyncSource,
  ]) {
    assert.doesNotMatch(
      source,
      /inventory-items-pagination-|masterlist-pagination-|stub-results-pagination-|distribution-history-pagination-|distribution-history-records-(?:header|title-group)/,
    );
  }
});
