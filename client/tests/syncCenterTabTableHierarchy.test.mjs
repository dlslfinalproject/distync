import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const pageSourcePath = new URL("../src/pages/SyncManagementPage.jsx", import.meta.url);
const stylesSourcePath = new URL("../src/index.css", import.meta.url);

const readSources = async () =>
  Promise.all([
    fs.readFile(pageSourcePath, "utf8"),
    fs.readFile(stylesSourcePath, "utf8"),
  ]);

const getTabSection = (source, tabValue, nextTabValue) => {
  const start = source.indexOf(`{activeSyncTab === "${tabValue}" ? (`);
  const end = nextTabValue
    ? source.indexOf(`{activeSyncTab === "${nextTabValue}" ? (`, start)
    : source.indexOf("<SyncConflictDetailModal", start);

  return source.slice(start, end === -1 ? source.length : end);
};

const getHeaders = (section) =>
  [...section.matchAll(/<th style=\{tableStyles\.th\}>([\s\S]*?)<\/th>/g)].map(
    ([, label]) =>
      label.trim().includes("BARANGAY_COLUMN_LABEL")
        ? "Barangay"
        : label.trim(),
  );

test("Sync Center keeps one stable accessible shell for the three tab views", async () => {
  const [source] = await readSources();

  assert.equal((source.match(/className="sync-center-tablist"/g) || []).length, 1);
  assert.equal((source.match(/className="sync-center-tabs-module"/g) || []).length, 1);
  assert.equal((source.match(/className="sync-center-tabpanel"/g) || []).length, 3);
  assert.equal((source.match(/className="sync-center-table-scroll"/g) || []).length, 3);
  assert.match(source, /role="tablist"/);
  assert.match(source, /role="tab"/);
  assert.match(source, /aria-selected=\{activeSyncTab === tab\.value\}/);
  assert.match(source, /role="tabpanel"/);
  assert.match(source, /aria-controls=\{SYNC_TABPANEL_IDS\[tab\.value\]\}/);
  assert.match(source, /aria-labelledby=\{SYNC_TAB_IDS\.QUEUE\}/);
  assert.match(source, /aria-labelledby=\{SYNC_TAB_IDS\.AUDIT\}/);
  assert.match(source, /aria-labelledby=\{SYNC_TAB_IDS\.CONFLICTS\}/);
});

test("Sync Center preserves distinct audited columns for Queue, History, and Conflicts", async () => {
  const [source] = await readSources();
  const queueSection = getTabSection(source, "QUEUE", "AUDIT");
  const historySection = getTabSection(source, "AUDIT", "CONFLICTS");
  const conflictSection = getTabSection(source, "CONFLICTS");

  assert.deepEqual(getHeaders(queueSection), [
    "Record Type",
    "Barangay",
    "Operation",
    "Affected Record",
    "Disaster Event",
    "Status",
    "Queued At",
    "Notes",
    "Action",
  ]);
  assert.deepEqual(getHeaders(historySection), [
    "Record Type",
    "Barangay",
    "Action",
    "Affected Record",
    "Disaster Event",
    "Status",
    "Queued At",
    "Processed At",
    "Notes",
  ]);
  assert.deepEqual(getHeaders(conflictSection), [
    "Record Type",
    "Barangay",
    "Affected Record",
    "Conflict Reason",
    "Status",
    "Resolved At",
    "Action",
  ]);
  assert.notDeepEqual(getHeaders(queueSection), getHeaders(historySection));
  assert.match(queueSection, /includeOperation: true/);
  assert.match(historySection, /renderRecordCells\(transaction, \{ includeBarangay: false \}\)/);
  assert.match(conflictSection, /getConflictReasonLabel\(conflict\)/);
  assert.match(conflictSection, /formatSyncHistoryDateTime\(conflict\.resolved_at\)/);
});

test("Sync Center keeps Barangay conditional across every table without duplicating role layouts", async () => {
  const [source] = await readSources();
  const sections = [
    getTabSection(source, "QUEUE", "AUDIT"),
    getTabSection(source, "AUDIT", "CONFLICTS"),
    getTabSection(source, "CONFLICTS"),
  ];

  for (const section of sections) {
    assert.match(
      section,
      /isMswdoPortal \? \([\s\S]*<th style=\{tableStyles\.th\}>\{BARANGAY_COLUMN_LABEL\}<\/th>/,
    );
  }

  assert.match(source, /const shouldIncludeBarangay = includeBarangay \|\| isMswdoPortal/);
  assert.match(source, /renderRecordCells\(entry, \{[\s\S]*includeBarangay: false/);
  assert.match(source, /renderRecordCells\(transaction, \{ includeBarangay: false \}\)/);
  assert.match(source, /includeBarangay=\{isMswdoPortal\}/);
});

test("Sync Center gives navigation stronger hierarchy than table headers with scoped visual focus", async () => {
  const [source, styles] = await readSources();
  const tabStyles = source.match(/const syncTabButtonStyles = \(isActive\) => \(\{[\s\S]*?\n\}\);/)?.[0] || "";
  const tabListStyles = source.match(/const syncCenterTabListStyles = \{[\s\S]*?\n\};/)?.[0] || "";
  const tableStyles = source.match(/const tableStyles = \{[\s\S]*?\n\};/)?.[0] || "";

  assert.match(tabStyles, /fontSize: "14px"/);
  assert.match(tabStyles, /fontWeight: 700/);
  assert.match(tabStyles, /minHeight: "48px"/);
  assert.match(tabStyles, /borderBottom: isActive \? "3px solid #17324d"/);
  assert.match(tabListStyles, /borderTopLeftRadius: "17px"/);
  assert.match(tabListStyles, /borderTopRightRadius: "17px"/);
  assert.match(tableStyles, /fontSize: "11px"/);
  assert.match(tableStyles, /color: "#71879a"/);
  assert.match(tableStyles, /padding: "10px 14px"/);
  assert.match(tableStyles, /backgroundColor: "#f8fbff"/);
  assert.match(styles, /\.sync-center-tablist > button:focus-visible/);
  assert.match(styles, /\.sync-center-table-scroll > table thead/);
  assert.match(styles, /\.sync-center-table-scroll\s*\{[\s\S]*border-top: 1px solid #e2ebf3/);
  assert.doesNotMatch(source.match(/const syncCenterTabsModuleStyles = \{[\s\S]*?\n\};/)?.[0] || "", /overflow: "hidden"/);
});

test("Sync Center empty states and actions stay inside the shared tab panels", async () => {
  const [source] = await readSources();

  assert.match(source, /No offline actions are waiting to sync on this device\./);
  assert.match(source, /No synchronization history is available yet\./);
  assert.match(source, /No synchronization conflicts require review\./);
  assert.doesNotMatch(source, /<h3[^>]*>Offline Queue<\/h3>/);
  assert.doesNotMatch(source, /<h3[^>]*>Sync History<\/h3>/);
  assert.doesNotMatch(source, /<h3[^>]*>Conflict Review<\/h3>/);
  assert.match(source, /aria-label=\{`Retry synchronization for \$\{details\.subject\}`\}/);
  assert.match(source, /aria-label="View synchronization details"/);
  assert.match(source, /<SyncStatusBadge status=\{entry\.status\} \/>/);
  assert.match(source, /<SyncStatusBadge status=\{transaction\.sync_status\} \/>/);
  assert.match(source, /<SyncStatusBadge[\s\S]*status=\{conflict\.status === "RESOLVED"/);
});
