import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const pageSourcePath = new URL("../src/pages/SyncManagementPage.jsx", import.meta.url);
const helperSourcePath = new URL(
  "../src/features/sync/syncManagementHelpers.js",
  import.meta.url,
);
const serviceSourcePath = new URL(
  "../src/features/sync/syncHistoryService.js",
  import.meta.url,
);
const conflictModalSourcePath = new URL(
  "../src/components/shared/SyncConflictDetailModal.jsx",
  import.meta.url,
);
const helperModulePath = new URL(
  "../src/features/sync/syncManagementHelpers.js",
  import.meta.url,
);

test("MSWDO Sync Center keeps Barangay parity while adding municipality context", async () => {
  const source = await fs.readFile(pageSourcePath, "utf8");

  assert.match(source, /const isMswdoPortal = currentRole === ROLE_CODES\.MSWDO/);
  assert.match(source, /fetchSyncBarangays/);
  assert.match(source, /historyFilters\.barangay_id = filters\.barangayId/);
  assert.match(source, /const BARANGAY_COLUMN_LABEL = "Barangay"/);
  assert.match(source, /value=\{filters\.barangayId\}/);
  assert.match(source, /<option value="">All Barangays<\/option>/);
  assert.match(source, /includeBarangay=\{isMswdoPortal\}/);
});

test("MSWDO uses the same three accessible tabs and operational table behavior", async () => {
  const source = await fs.readFile(pageSourcePath, "utf8");

  assert.match(source, /\{ value: "QUEUE", label: "Offline Queue" \}/);
  assert.match(source, /\{ value: "AUDIT", label: "Sync History" \}/);
  assert.match(source, /\{ value: "CONFLICTS", label: "Conflict Review" \}/);
  assert.match(source, /<SyncHealthStatus health=\{syncHealth\} \/>/);
  assert.match(source, /aria-label="View synchronization details"/);
  assert.match(source, /<div style=\{\{ overflowX: "auto" \}\}>/);
  assert.match(source, /minWidth: "1080px"/);
  assert.match(source, /minWidth: "980px"/);
  assert.match(source, /minWidth: "820px"/);
});

test("MSWDO search opts into Barangay context without changing Barangay's default search", async () => {
  const helperSource = await fs.readFile(helperSourcePath, "utf8");
  const { buildSyncSearchText } = await import(helperModulePath.href);
  const record = {
    entity_type: "HOUSEHOLD",
    payload_json: {
      action_key: "HOUSEHOLD_REGISTER",
      payload: {
        family_head_name: "Ana Dela Cruz",
        barangay_name: "Barangay San Juan",
      },
    },
  };

  assert.doesNotMatch(buildSyncSearchText(record), /barangay san juan/);
  assert.match(
    buildSyncSearchText(record, { includeBarangay: true }),
    /barangay san juan/,
  );
  assert.doesNotMatch(
    helperSource.match(/export const buildSyncSearchText = \([\s\S]*?\n\};/)?.[0] || "",
    /details\.barangay/,
  );
});

test("MSWDO record context uses authoritative IDs and safe display labels", async () => {
  const { getSyncRecordBarangayId, getSyncRecordDetails } = await import(
    helperModulePath.href
  );
  const record = {
    barangay_id: "11111111-1111-4111-8111-111111111111",
    barangay_name: "Barangay Poblacion",
    entity_type: "HOUSEHOLD",
    entity_server_id: "22222222-2222-4222-8222-222222222222",
    payload_json: {
      action_key: "HOUSEHOLD_UPDATE",
      payload: { family_head_name: "Rosa Santos" },
    },
  };

  assert.equal(
    getSyncRecordBarangayId(record),
    "11111111-1111-4111-8111-111111111111",
  );
  const details = getSyncRecordDetails(record);
  assert.equal(details.barangay, "Barangay Poblacion");
  assert.equal(details.subject, "Rosa Santos");
  assert.doesNotMatch(details.subject, /22222222/);
});

test("MSWDO conflict detail adds Barangay only through the shared safe modal", async () => {
  const pageSource = await fs.readFile(pageSourcePath, "utf8");
  const modalSource = await fs.readFile(conflictModalSourcePath, "utf8");

  assert.match(pageSource, /includeBarangay=\{isMswdoPortal\}/);
  assert.match(modalSource, /includeBarangay = false/);
  assert.match(modalSource, /renderMetadataItem\("Barangay", details\.barangay\)/);
  assert.match(modalSource, /closeButtonLabel="Close sync conflict detail"/);
  assert.match(modalSource, /This Device Record[\s\S]*Saved DISTYNC Record/);
});

test("MSWDO Barangay filter reloads the same server result contract", async () => {
  const pageSource = await fs.readFile(pageSourcePath, "utf8");
  const serviceSource = await fs.readFile(serviceSourcePath, "utf8");

  assert.match(pageSource, /const historyFilters = \{ limit: 100 \}/);
  assert.match(pageSource, /fetchSyncHistory\(historyFilters\)/);
  assert.match(pageSource, /\[filters\.barangayId, isMswdoPortal\]/);
  assert.match(serviceSource, /Object\.entries\(filters\)/);
  assert.match(serviceSource, /searchParams\.set\(key, value\)/);
});
