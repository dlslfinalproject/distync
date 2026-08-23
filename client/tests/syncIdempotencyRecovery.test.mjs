import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const queueSourcePath = new URL("../src/offline/syncQueue.js", import.meta.url);
const syncServiceSourcePath = new URL(
  "../src/offline/syncService.js",
  import.meta.url,
);
const pageSourcePath = new URL(
  "../src/pages/SyncManagementPage.jsx",
  import.meta.url,
);

test("SYNC-IDEMP-CLIENT-01 mismatch copy is safe and excludes the row from retry", async () => {
  const {
    getSafeSyncErrorMessage,
    SYNC_ERROR_CODES,
    SYNC_PRESENTATION_MESSAGES,
    getSyncStatusSummaryMessage,
  } = await import("../src/offline/syncStatus.js");
  const { getSyncQueueNotes, isSafeRetryableQueueEntry } = await import(
    "../src/features/sync/syncManagementHelpers.js"
  );

  const legacyMismatch = {
    status: "FAILED",
    lastError: "client_sync_id was already used for a different sync request",
  };
  const codedMismatch = {
    status: "FAILED",
    lastErrorCode: SYNC_ERROR_CODES.IDEMPOTENCY_MISMATCH,
  };

  assert.equal(
    getSafeSyncErrorMessage(codedMismatch),
    SYNC_PRESENTATION_MESSAGES.IDEMPOTENCY_MISMATCH,
  );
  assert.equal(getSyncQueueNotes(codedMismatch), SYNC_PRESENTATION_MESSAGES.IDEMPOTENCY_MISMATCH);
  assert.equal(getSyncQueueNotes(legacyMismatch), SYNC_PRESENTATION_MESSAGES.IDEMPOTENCY_MISMATCH);
  assert.equal(isSafeRetryableQueueEntry(codedMismatch), false);
  assert.equal(
    getSyncStatusSummaryMessage({ failed: 1 }),
    "Synchronization needs attention.",
  );
  assert.doesNotMatch(
    getSyncQueueNotes(codedMismatch),
    /client_sync_id|idempotency|fingerprint|HTTP 409/i,
  );
});

test("SYNC-IDEMP-CLIENT-02 queue replay preserves request identity and stops unsafe coalescing", async () => {
  const [queueSource, syncServiceSource] = await Promise.all([
    fs.readFile(queueSourcePath, "utf8"),
    fs.readFile(syncServiceSourcePath, "utf8"),
  ]);

  assert.doesNotMatch(queueSource, /where\("queueGroupKey"\)/);
  assert.match(queueSource, /Each locally created mutation already has its own client_sync_id/);
  assert.match(syncServiceSource, /client_sync_id: entry\.id/);
  assert.match(syncServiceSource, /payload: entry\.payload/);
  assert.match(syncServiceSource, /queueDisplayContext/);
  assert.doesNotMatch(
    syncServiceSource,
    /entry\.payload\s*=|payload\s*=\s*\{[\s\S]*current.*event/i,
  );
});

test("SYNC-IDEMP-CLIENT-03 event titles are display context and status copy is operational", async () => {
  const { getSyncRecordDetails } = await import(
    "../src/features/sync/syncManagementHelpers.js"
  );
  const pageSource = await fs.readFile(pageSourcePath, "utf8");

  const details = getSyncRecordDetails({
    status: "PENDING",
    actionKey: "STUB_CLAIM",
    payload: {
      disaster_event_id: "11111111-1111-4111-8111-111111111111",
    },
    queueDisplayContext: {
      disaster_event_title: "Typhoon Mayon Response",
    },
  });

  assert.equal(details.disasterEvent, "Typhoon Mayon Response");
  assert.match(pageSource, /getSyncStatusSummaryMessage\(summary\)/);
  assert.match(pageSource, /title: "Synchronization cannot be retried"/);
  assert.doesNotMatch(
    pageSource.match(/<p[\s\S]*?role="status"[\s\S]*?<\/p>/)?.[0] || "",
    /client_sync_id|idempotency|fingerprint|HTTP 409/i,
  );
});
