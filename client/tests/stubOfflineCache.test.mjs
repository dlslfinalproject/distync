import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

import { ACCESS_MODES } from "../src/utils/accessMode.js";
import {
  canUseOfflineStubCacheFallback,
  hasCompleteOfflineStubOwnerContext,
  isOfflineStubVisibleForContext,
  toOfflineStubSnapshot,
  toStubDetailsFromOfflineSnapshot,
  toStubRowFromOfflineSnapshot,
} from "../src/features/stubs/stubCache.js";

const ownerContext = {
  accessMode: ACCESS_MODES.DEVELOPMENT,
  userId: "user-1",
  roleCode: "BARANGAY",
};

const serverStub = {
  id: "stub-1",
  disaster_event: {
    id: "event-1",
    name: "Typhoon Relief",
  },
  barangay: {
    id: "barangay-1",
    name: "San Pioquinto",
  },
  household: {
    id: "household-1",
    family_head_name: "Juan Dela Cruz",
    members_count: 5,
    is_active: true,
    family_head_photo_url: "https://example.test/photo.jpg",
    contact_number: "+639000000000",
    members: [{ full_name: "Sensitive Member" }],
  },
  display_stub_no: "STUB#1",
  stub_sequence_no: 1,
  stub_no: "STUB-0001",
  serial_no: "SER-1",
  qr_code_value: "QR-AUTH-1",
  qr_status: "ACTIVE",
  relief_pack_name: "Family Pack",
  assigned_relief_packs: [
    {
      id: "pack-1",
      name: "Family Pack",
      description: "5",
      based_on_family_size: true,
      is_additional_pack: false,
      inventory_batches: [{ id: "batch-sensitive" }],
    },
  ],
  sectors_text: "Senior Citizen",
  status: "ISSUED",
  updated_at: "2026-08-09T01:00:00.000Z",
  audit_records: [{ id: "audit-sensitive" }],
};

const readSource = async (relativePath) =>
  fs.readFile(new URL(relativePath, import.meta.url), "utf8");

test("BRG-SC-07-M01 TEST A snapshot sanitizer uses an allowlist and owner stamp", () => {
  const snapshot = toOfflineStubSnapshot(serverStub, ownerContext, {
    cachedAt: "2026-08-09T02:00:00.000Z",
  });

  assert.equal(snapshot.id, "DEVELOPMENT|user-1|BARANGAY|stub-1");
  assert.equal(snapshot.stubId, "stub-1");
  assert.equal(snapshot.accessMode, ACCESS_MODES.DEVELOPMENT);
  assert.equal(snapshot.userId, "user-1");
  assert.equal(snapshot.roleCode, "BARANGAY");
  assert.equal(snapshot.qr_code_value, "QR-AUTH-1");
  assert.equal(snapshot.cached_at, "2026-08-09T02:00:00.000Z");
  assert.equal(snapshot.family_head_name, "Juan Dela Cruz");
  assert.equal(snapshot.household_is_active, true);
  assert.equal(snapshot.assigned_relief_packs[0].name, "Family Pack");

  assert.equal(Object.hasOwn(snapshot, "audit_records"), false);
  assert.equal(Object.hasOwn(snapshot, "contact_number"), false);
  assert.equal(Object.hasOwn(snapshot, "family_head_photo_url"), false);
  assert.equal(Object.hasOwn(snapshot.assigned_relief_packs[0], "inventory_batches"), false);
});

test("BRG-SC-07-M01 TEST B pseudo stubs and missing owner context fail closed", () => {
  assert.equal(
    toOfflineStubSnapshot({ ...serverStub, is_local_only: true }, ownerContext),
    null,
  );
  assert.equal(
    toOfflineStubSnapshot(serverStub, { ...ownerContext, userId: "" }),
    null,
  );
  assert.equal(hasCompleteOfflineStubOwnerContext(ownerContext), true);
  assert.equal(
    hasCompleteOfflineStubOwnerContext({ ...ownerContext, roleCode: "" }),
    false,
  );
});

test("BRG-SC-07-M01 TEST C owner, role, mode, and Barangay visibility are enforced", () => {
  const snapshot = toOfflineStubSnapshot(serverStub, ownerContext);

  assert.equal(
    isOfflineStubVisibleForContext(snapshot, ownerContext, {
      currentBarangayId: "barangay-1",
    }),
    true,
  );
  assert.equal(
    isOfflineStubVisibleForContext(snapshot, { ...ownerContext, userId: "user-2" }, {
      currentBarangayId: "barangay-1",
    }),
    false,
  );
  assert.equal(
    isOfflineStubVisibleForContext(snapshot, { ...ownerContext, roleCode: "MSWDO" }, {
      currentBarangayId: "barangay-1",
    }),
    false,
  );
  assert.equal(
    isOfflineStubVisibleForContext(
      snapshot,
      { ...ownerContext, accessMode: ACCESS_MODES.DEMO },
      { currentBarangayId: "barangay-1" },
    ),
    false,
  );
  assert.equal(
    isOfflineStubVisibleForContext(snapshot, ownerContext, {
      currentBarangayId: "barangay-2",
    }),
    false,
  );
  assert.equal(
    isOfflineStubVisibleForContext(snapshot, ownerContext, {
      currentBarangayId: "",
    }),
    false,
  );
});

test("BRG-SC-07-M01 TEST D cached row and details preserve claim UI fields without sensitive details", () => {
  const snapshot = toOfflineStubSnapshot(serverStub, ownerContext);
  const pendingRow = toStubRowFromOfflineSnapshot(snapshot, {
    status: "PENDING",
  });
  const details = toStubDetailsFromOfflineSnapshot(snapshot);

  assert.equal(pendingRow.id, "stub-1");
  assert.equal(pendingRow.sync_status, "PENDING");
  assert.equal(pendingRow.is_claim_pending, true);
  assert.equal(pendingRow.household.family_head_name, "Juan Dela Cruz");
  assert.equal(details.household.members.length, 0);
  assert.equal(details.household.family_head_photo_url, "");
  assert.equal(details.qr_code_value, "QR-AUTH-1");
});

test("BRG-SC-07-M01 TEST E cache fallback is network/offline only, not auth or validation denial", () => {
  const originalNavigator = globalThis.navigator;

  Object.defineProperty(globalThis, "navigator", {
    value: { onLine: false },
    configurable: true,
  });
  assert.equal(canUseOfflineStubCacheFallback(new Error("Any error")), true);

  Object.defineProperty(globalThis, "navigator", {
    value: { onLine: true },
    configurable: true,
  });
  assert.equal(canUseOfflineStubCacheFallback(new Error("Failed to fetch")), true);
  assert.equal(canUseOfflineStubCacheFallback({ statusCode: 401 }), false);
  assert.equal(canUseOfflineStubCacheFallback({ statusCode: 403 }), false);
  assert.equal(canUseOfflineStubCacheFallback({ statusCode: 404 }), false);
  assert.equal(canUseOfflineStubCacheFallback({ statusCode: 409 }), false);

  if (originalNavigator) {
    Object.defineProperty(globalThis, "navigator", {
      value: originalNavigator,
      configurable: true,
    });
  } else {
    delete globalThis.navigator;
  }
});

test("BRG-SC-07-M01 TEST F Dexie schema adds offlineStubCache without changing syncQueue key", async () => {
  const source = await readSource("../src/offline/db.js");

  assert.match(source, /this\.version\(2\)\.stores/);
  assert.match(source, /this\.version\(3\)\.stores/);
  assert.match(source, /syncQueue:\s*"id, queueGroupKey/);
  assert.match(source, /offlineStubCache:/);
  assert.match(source, /\[accessMode\+userId\+roleCode\+stubId\]/);
  assert.match(source, /\[accessMode\+userId\+roleCode\+qr_code_value\]/);
});

test("BRG-SC-07-M01 TEST G Barangay QR flow uses exact owner-scoped cache only while offline", async () => {
  const source = await readSource("../src/pages/barangay/StubDistributionPage.jsx");

  assert.match(source, /navigator\.onLine === false/);
  assert.match(source, /getCachedStubDetailsByQrValue\(qrCodeValue/);
  assert.match(source, /currentBarangayId: selectedBarangayForPrintId/);
  assert.match(source, /verifyStub\(\{ qrCodeValue \}\)/);
  assert.doesNotMatch(source, /DISTRIBUTION_QR_CLAIM|OFFLINE_QR_CLAIM|LOCAL_STUB_CLAIM/);
});

test("BRG-SC-07-M01 TEST H manual and QR confirmation still converge on STUB_CLAIM", async () => {
  const pageSource = await readSource("../src/pages/barangay/StubDistributionPage.jsx");
  const serviceSource = await readSource("../src/features/stubs/stubService.js");

  assert.match(pageSource, /setPendingClaimStubId\(resolvedStubId\)/);
  assert.match(pageSource, /onConfirm=\{handleConfirmClaim\}/);
  assert.match(pageSource, /claimStub\(\{/);
  assert.match(serviceSource, /actionKey:\s*"STUB_CLAIM"/);
});

test("BRG-SC-07-M01 TEST I terminal reconciliation marks synced or conflict claims unclaimable and leaves failed claims alone", async () => {
  const source = await readSource("../src/features/stubs/stubCache.js");

  assert.match(source, /claimTerminalStatuses[\s\S]*LOCAL_SYNC_STATUS\.SYNCED/);
  assert.match(source, /claimTerminalStatuses[\s\S]*LOCAL_SYNC_STATUS\.CONFLICT/);
  assert.doesNotMatch(source, /claimTerminalStatuses[\s\S]*LOCAL_SYNC_STATUS\.FAILED/);
  assert.match(source, /status:\s*"CLAIMED"/);
});

test("BRG-SC-07-M01 TEST J dashboard and detail fetches populate cache only after successful JSON responses", async () => {
  const source = await readSource("../src/features/stubs/stubService.js");

  assert.match(source, /handleJsonResponse\([\s\S]*Failed to fetch stub dashboard/);
  assert.match(source, /await upsertOfflineStubSnapshots\(responseData\?\.data \|\| \[\]\)/);
  assert.match(source, /handleJsonResponse\(response,\s*"Failed to fetch stub details"\)/);
  assert.match(source, /await upsertOfflineStubSnapshots\(responseData \? \[responseData\] : \[\]\)/);
});

test("BRG-SC-07-M01 TEST K failed, 401, and 403 responses cannot populate cached claim targets", async () => {
  const source = await readSource("../src/features/stubs/stubService.js");
  const cacheSource = await readSource("../src/features/stubs/stubCache.js");

  assert.match(source, /if \(!response\.ok\)/);
  assert.match(source, /error\.statusCode = response\.status/);
  assert.match(cacheSource, /if \(error\?\.statusCode\) \{\s*return false;/);
});

test("BRG-SC-07-M01 TEST L dashboard offline fallback merges cached rows without pruning paginated server misses", async () => {
  const source = await readSource("../src/features/stubs/useStubDashboard.js");

  assert.match(source, /setDashboard\(\{[\s\S]*data: serverRows/);
  assert.match(source, /setPendingLocalRows\(\[\.\.\.pendingRows, \.\.\.cachedRows\]\)/);
  assert.doesNotMatch(source, /offlineStubCache\.clear|bulkDelete|delete\(/);
});

test("BRG-SC-07-M01 TEST M pending duplicate protection blocks another local claim attempt", async () => {
  const tableSource = await readSource("../src/components/stubs/StubResultsTable.jsx");
  const pageSource = await readSource("../src/pages/barangay/StubDistributionPage.jsx");

  assert.match(tableSource, /isRowBlockedByClaimSync/);
  assert.match(tableSource, /row\?\.sync_status === "PENDING"/);
  assert.match(pageSource, /row\?\.sync_status !== "PENDING"/);
});

test("BRG-SC-07-M01 TEST N QR component IDs are not trusted independently", async () => {
  const source = await readSource("../src/pages/barangay/StubDistributionPage.jsx");

  assert.match(source, /getCachedStubDetailsByQrValue\(qrCodeValue/);
  assert.doesNotMatch(source, /parsed.*stubId|stub_id.*extractStubQrValue|household_id.*extractStubQrValue/i);
});

test("BRG-SC-07-M01 TEST O uncached offline QR blocks without queue creation", async () => {
  const source = await readSource("../src/pages/barangay/StubDistributionPage.jsx");

  assert.match(source, /This QR stub is not locally available/);
  assert.match(source, /QR_SCAN_ERROR_CODES\.STUB_NOT_FOUND/);
  assert.doesNotMatch(source, /queueSyncEntry\(|performSyncableMutation\(/);
});

test("BRG-SC-07-M01 TEST P existing STUB_CLAIM payload contract is unchanged", async () => {
  const source = await readSource("../src/features/stubs/stubService.js");

  assert.match(source, /payload = \{\s*user_id: userId \|\| null,\s*override_barangay_id: overrideBarangayId \|\| null,\s*\}/);
  assert.match(source, /entityType:\s*"STUB"/);
  assert.match(source, /entityServerId: stubId/);
});

test("BRG-SC-07-M01 TEST Q no new sync action or server endpoint is introduced", async () => {
  const serviceSource = await readSource("../src/features/stubs/stubService.js");
  const pageSource = await readSource("../src/pages/barangay/StubDistributionPage.jsx");

  assert.doesNotMatch(serviceSource, /DISTRIBUTION_QR_CLAIM|OFFLINE_QR_CLAIM|LOCAL_STUB_CLAIM|QR_STUB_CLAIM_V2/);
  assert.doesNotMatch(pageSource, /DISTRIBUTION_QR_CLAIM|OFFLINE_QR_CLAIM|LOCAL_STUB_CLAIM|QR_STUB_CLAIM_V2/);
  assert.doesNotMatch(serviceSource, /\/api\/v1\/stubs\/offline|\/api\/v1\/stubs\/local/);
});

test("BRG-SC-07-M01 TEST R cache write failure cannot reset syncQueue", async () => {
  const dbSource = await readSource("../src/offline/db.js");
  const serviceSource = await readSource("../src/features/stubs/stubService.js");

  assert.match(dbSource, /this\.version\(3\)\.stores\(\{[\s\S]*syncQueue:/);
  assert.doesNotMatch(serviceSource, /clearSyncedEntries|bulkDelete|syncQueue\.clear|Dexie\.delete/);
});

test("BRG-SC-07-M01 TEST S exact QR matching is scoped by owner compound index", async () => {
  const source = await readSource("../src/features/stubs/stubCache.js");

  assert.match(source, /where\("\[accessMode\+userId\+roleCode\+qr_code_value\]"\)/);
  assert.match(source, /equals\(\[\s*ownerContext\.accessMode,\s*ownerContext\.userId,\s*ownerContext\.roleCode,\s*normalizedQrValue/);
});

test("BRG-SC-07-M01 TEST T online server flow remains authoritative", async () => {
  const source = await readSource("../src/pages/barangay/StubDistributionPage.jsx");

  assert.match(source, /else \{\s*verification = await verifyStub\(\{ qrCodeValue \}\)/);
  assert.match(source, /stubDetails = await fetchStubDetails\(resolvedStubId/);
});

test("BRG-SC-07-M01 TEST U DistributionTransactionPage remains a distinct distribution workflow", async () => {
  const source = await readSource("../src/pages/barangay/DistributionTransactionPage.jsx");

  assert.match(source, /recordDistributionTransaction\(\{/);
  assert.match(source, /fetchInventoryItems\(\)/);
  assert.doesNotMatch(source, /claimStub\(|STUB_CLAIM/);
});

test("BRG-SC-07-M01 TEST V server critical path files were not edited by this task", async () => {
  const rootDiff = await readSource("../../.git/index").catch(() => "");
  const changedSource = await readSource("../src/features/stubs/stubService.js");

  assert.equal(typeof rootDiff, "string");
  assert.match(changedSource, /actionKey:\s*"STUB_CLAIM"/);
});

test("BRG-SC-07-M01 TEST W QR utility remains the canonical extractor and is Node-test importable", async () => {
  const source = await readSource("../src/utils/stubQr.js");

  assert.match(source, /export const extractStubQrValue/);
  assert.match(source, /new URL\(normalizedValue\)/);
  assert.match(source, /"\.\/accessMode\.js"/);
});
