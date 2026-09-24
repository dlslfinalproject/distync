import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

import { findBlockingStubClaimEntry } from "../src/offline/syncQueue.js";
import {
  applyLocalStubClaimSyncState,
  getClaimSyncEntryForStub,
  isLocalStubClaimBlocked,
} from "../src/features/stubs/stubCache.js";

const readSource = async (relativePath) =>
  fs.readFile(new URL(relativePath, import.meta.url), "utf8");

const owner = {
  accessMode: "DEVELOPMENT",
  userId: "barangay-user-1",
  roleCode: "BARANGAY",
  deviceId: "device-1",
};

const claimEntry = ({
  stubId = "stub-1",
  eventId = "event-1",
  barangayId = "barangay-1",
  proofType = "QR",
  status = "PENDING",
} = {}) => ({
  ...owner,
  id: `claim-${stubId}`,
  moduleName: "stubs",
  actionKey: "STUB_CLAIM",
  entityType: "STUB",
  entityServerId: stubId,
  entityLocalId: stubId,
  status,
  payload: {
    disaster_event_id: eventId,
    barangay_id: barangayId,
    stub_number: "STUB#1",
    proof_type: proofType,
    ...(proofType === "PHOTO"
      ? { proof_photo_data_url: "data:image/jpeg;base64,private-local-photo" }
      : { qr_reference_value: "qr-reference-1" }),
  },
});

test("queue lock rejects all four repeated and cross-proof local claim pairs", () => {
  for (const firstProof of ["QR", "PHOTO"]) {
    for (const attemptedProof of ["QR", "PHOTO"]) {
      const existing = claimEntry({ proofType: firstProof });
      const incoming = {
        ...claimEntry({ proofType: attemptedProof }),
        id: `next-${attemptedProof}`,
        ...owner,
      };

      assert.equal(
        findBlockingStubClaimEntry([existing], incoming),
        existing,
        `${firstProof} pending must block ${attemptedProof}`,
      );
    }
  }
});

test("queue lock uses canonical stub IDs and does not cross event or Barangay rows sharing a number", () => {
  const existing = claimEntry({ stubId: "stub-event-a", eventId: "event-a", barangayId: "barangay-a" });
  const otherContext = {
    ...claimEntry({ stubId: "stub-event-b", eventId: "event-b", barangayId: "barangay-b" }),
    id: "claim-event-b",
  };

  assert.equal(existing.payload.stub_number, otherContext.payload.stub_number);
  assert.equal(findBlockingStubClaimEntry([existing], otherContext), null);
  assert.equal(
    getClaimSyncEntryForStub([existing], "stub-event-b", {
      disasterEventId: "event-b",
      barangayId: "barangay-b",
    }),
    null,
  );
});

test("pending and retryable failed queue rows block local claims without asserting central acceptance", () => {
  for (const status of ["PENDING", "FAILED"]) {
    const entry = claimEntry({ proofType: "PHOTO", status });
    const projected = applyLocalStubClaimSyncState(
      { id: "stub-1", status: "ISSUED" },
      getClaimSyncEntryForStub([entry], "stub-1", {
        disasterEventId: "event-1",
        barangayId: "barangay-1",
      }),
    );

    assert.equal(projected.status, "ISSUED");
    assert.equal(projected.sync_status, status);
    assert.equal(projected.is_claim_pending, true);
    assert.equal(isLocalStubClaimBlocked(projected), true);
    assert.equal(projected.status === "CLAIMED", false);
  }
});

test("conflict stays blocked and synced state projects as centrally claimed", () => {
  const baseRow = { id: "stub-1", status: "ISSUED" };
  const conflict = applyLocalStubClaimSyncState(
    baseRow,
    claimEntry({ status: "CONFLICT" }),
  );
  const synced = applyLocalStubClaimSyncState(
    baseRow,
    claimEntry({ status: "SYNCED" }),
  );

  assert.equal(isLocalStubClaimBlocked(conflict), true);
  assert.equal(conflict.is_claim_pending, false);
  assert.equal(conflict.status, "ISSUED");
  assert.equal(synced.status, "CLAIMED");
  assert.equal(synced.sync_status, "SYNCED");
  assert.equal(synced.is_claim_pending, false);
});

test("same-stub queue check and durable write share one IndexedDB transaction", async () => {
  const source = await readSource("../src/offline/syncQueue.js");

  assert.match(
    source,
    /await db\.transaction\("rw", db\.syncQueue, async \(\) => \{[\s\S]*findBlockingStubClaimEntry\([\s\S]*await db\.syncQueue\.put\(completeStoredEntry\)/,
  );
  assert.match(source, /LOCAL_SYNC_STATUS\.FAILED,[\s\S]*LOCAL_SYNC_STATUS\.CONFLICT,[\s\S]*LOCAL_SYNC_STATUS\.SYNCED/);
});

test("offline queue persistence completes before the queued response is emitted", async () => {
  const source = await readSource("../src/offline/syncService.js");
  const offlinePath = source.match(
    /if \(typeof navigator !== "undefined" && !navigator\.onLine && allowOffline\) \{([\s\S]*?)\n  \}/,
  )?.[1] || "";

  assert.match(offlinePath, /await assertOfflineQueueAllowed\(canQueueOffline\)/);
  assert.match(offlinePath, /await persistOfflineMutation\(\{/);
  assert.match(offlinePath, /emitSyncFeedbackEvent\(\{\s*type: "pending"/);
  assert.match(offlinePath, /return buildQueuedResponse\(/);
  assert.ok(offlinePath.indexOf("await persistOfflineMutation") < offlinePath.indexOf('type: "pending"'));
  const persistPath = source.match(
    /const persistOfflineMutation = async \(entry\) => \{([\s\S]*?)\n\};/,
  )?.[1] || "";
  assert.match(persistPath, /return await queueSyncEntry\(entry\)/);
  assert.match(persistPath, /catch \(error\)[\s\S]*throw error/);
});

test("durable IndexedDB queue shape retains the local camera payload without localStorage copies", async () => {
  const dbSource = await readSource("../src/offline/db.js");
  const queueSource = await readSource("../src/offline/syncQueue.js");
  const claimSource = await readSource("../src/features/stubs/stubService.js");

  assert.match(dbSource, /this\.version\(2\)\.stores\(\{\s*syncQueue:/);
  assert.match(queueSource, /export const getVisibleStubClaimSyncEntriesForStub/);
  assert.match(queueSource, /\.where\("entityServerId"\)[\s\S]*\.toArray\(\)/);
  assert.match(claimSource, /proof_photo_data_url:\s*proofPhotoDataUrl \|\| null/);
  assert.doesNotMatch(claimSource, /localStorage\.setItem\([^\n]*proof/i);
});

test("online exact detail, QR verification, and dashboards project unresolved queue state", async () => {
  const serviceSource = await readSource("../src/features/stubs/stubService.js");
  const barangayPage = await readSource("../src/pages/barangay/StubDistributionPage.jsx");
  const distributionPage = await readSource("../src/pages/barangay/DistributionTransactionPage.jsx");

  assert.match(serviceSource, /applyLocalStubClaimSyncStates\(responseData\?\.data \|\| \[\], syncEntries\)/);
  assert.match(serviceSource, /return applyLocalStubClaimSyncState\(responseData, syncEntry\)/);
  assert.match(serviceSource, /responseData\.data\.is_claimable = false/);
  assert.match(barangayPage, /localClaimStatus === "FAILED"/);
  assert.match(distributionPage, /!isLocalStubClaimBlocked\(verifiedStubDetails\)/);
});

test("failed claims remain blocked in both Barangay and MSWDO distribution tables", async () => {
  const barangayTable = await readSource("../src/components/stubs/StubResultsTable.jsx");
  const mswdoTable = await readSource("../src/components/stubs/MswdoStubResultsTable.jsx");
  const mswdoPage = await readSource("../src/pages/mswdo/StubDistributionPage.jsx");

  assert.match(barangayTable, /row\?\.sync_status === "FAILED"/);
  assert.match(barangayTable, /getClaimSyncStatusLabel\(row\.sync_status\)/);
  assert.match(mswdoTable, /\["PENDING", "FAILED", "CONFLICT"\]/);
  assert.match(mswdoPage, /row\?\.sync_status \|\| ""\)\.toUpperCase\(\)/);
});

test("server-confirmed claims reconcile the cache before releasing the local lock", async () => {
  const syncSource = await readSource("../src/offline/syncService.js");
  const claimSource = await readSource("../src/features/stubs/stubService.js");
  const reconcileAt = syncSource.indexOf("await reconcileOfflineStubCacheForSyncResult(entry, result)");
  const queueTerminalAt = syncSource.indexOf("await updateSyncEntryStatus(entry.id, {", reconcileAt);

  assert.ok(reconcileAt >= 0 && queueTerminalAt >= 0 && reconcileAt < queueTerminalAt);
  assert.match(claimSource, /reconcileBeforeQueueCleanup: async \(responseData\)[\s\S]*markCachedStubClaimTerminal\(stubId, responseData\.sync_status\)/);
});

test("direct terminal conflicts reconcile cached claimed state before queue cleanup", async () => {
  const syncSource = await readSource("../src/offline/syncService.js");
  const terminalResultAt = syncSource.indexOf("const terminalSyncStatus = error?.syncResult?.sync_status");
  const reconcileAt = syncSource.indexOf("await reconcileBeforeQueueCleanup(error.syncResult)", terminalResultAt);
  const cleanupAt = syncSource.indexOf("await removeSyncEntry(clientSyncId)", terminalResultAt);

  assert.ok(terminalResultAt >= 0 && reconcileAt > terminalResultAt && cleanupAt > reconcileAt);
  assert.match(syncSource.slice(terminalResultAt, cleanupAt), /LOCAL_SYNC_STATUS\.CONFLICT/);
  assert.match(syncSource.slice(terminalResultAt, cleanupAt), /retainPersistedEntry = true/);
});
