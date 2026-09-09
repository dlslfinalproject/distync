import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

const pageSourcePath = new URL("../src/pages/SyncManagementPage.jsx", import.meta.url);
const modalSourcePath = new URL(
  "../src/components/shared/SyncConflictDetailModal.jsx",
  import.meta.url,
);
const queueSourcePath = new URL("../src/offline/syncQueue.js", import.meta.url);
const helperSourcePath = new URL(
  "../src/features/sync/syncManagementHelpers.js",
  import.meta.url,
);

test("sync history distinguishes resolved conflicts from ordinary synced entries", async () => {
  const { getSyncHistoryNotes, getSyncHistoryStatus } = await import(
    helperSourcePath.href
  );

  assert.equal(
    getSyncHistoryStatus({ sync_status: "SYNCED" }),
    "SYNCED",
  );
  assert.equal(
    getSyncHistoryStatus({
      sync_status: "SYNCED",
      sync_conflict_status: "RESOLVED",
    }),
    "RESOLVED",
  );

  const notes = getSyncHistoryNotes({
    sync_status: "SYNCED",
    sync_conflict_status: "RESOLVED",
    sync_conflict_resolution_action: "KEEP_SERVER",
    sync_conflict_resolution_reason: "Duplicate stock entry.",
    payload_json: {
      action_key: "INVENTORY_BATCH_CREATE",
      payload: {},
    },
  });

  assert.match(notes.join(" "), /this device entry was discarded/i);
  assert.match(notes.join(" "), /Duplicate stock entry\./);
});

test("completed local queue rows are removed while server history is retained", async () => {
  const [pageSource, queueSource] = await Promise.all([
    fs.readFile(pageSourcePath, "utf8"),
    fs.readFile(queueSourcePath, "utf8"),
  ]);

  assert.match(pageSource, /await clearSyncedEntries\(\);/);
  assert.match(pageSource, /void clearSyncedEntries\(\)\.catch/);
  assert.match(pageSource, /onClose=\{handleCloseConflictDetail\}/);
  assert.match(pageSource, /const handleCloseConflictDetail = useCallback\(/);
  assert.match(queueSource, /resolutionStatus === "RESOLVED"/);
  assert.match(queueSource, /db\.syncQueue\.bulkDelete/);
});

test("keep saved conflict resolution explains that the losing entry stays in history", async () => {
  const modalSource = await fs.readFile(modalSourcePath, "utf8");

  assert.match(modalSource, /Keep Saved \/ Discard This Entry/);
  assert.match(modalSource, /This device entry is not added to/);
  assert.match(modalSource, /decision remains in Sync History/);
});

test("missing conflict review notes are shown inline under the field", async () => {
  const [pageSource, modalSource] = await Promise.all([
    fs.readFile(pageSourcePath, "utf8"),
    fs.readFile(modalSourcePath, "utf8"),
  ]);

  assert.match(pageSource, /const \[resolutionReasonError, setResolutionReasonError\]/);
  assert.match(pageSource, /setResolutionReasonError\("Review note is required\."\)/);
  assert.doesNotMatch(pageSource, /title: "Resolution Reason Required"/);
  assert.match(pageSource, /Review note is required\./);
  assert.match(modalSource, /resolutionReasonError/);
  assert.match(modalSource, /aria-invalid=\{Boolean\(resolutionReasonError\)\}/);
  assert.match(modalSource, /role="alert"/);
});

test("conflict actions require confirmation and barcode corrections reuse the inventory form", async () => {
  const [pageSource, modalSource, formSource, serviceSource] = await Promise.all([
    fs.readFile(pageSourcePath, "utf8"),
    fs.readFile(modalSourcePath, "utf8"),
    fs.readFile(
      new URL("../src/components/inventory-items/InventoryItemFormModal.jsx", import.meta.url),
      "utf8",
    ),
    fs.readFile(
      new URL("../src/features/sync/syncHistoryService.js", import.meta.url),
      "utf8",
    ),
  ]);

  assert.match(pageSource, /pendingResolutionAction/);
  assert.match(pageSource, /setPendingResolutionAction\(action\)/);
  assert.match(pageSource, /getConflictCorrectionItemData/);
  assert.match(pageSource, /conflictResolution/);
  assert.match(modalSource, /Confirm and Resolve/);
  assert.match(modalSource, /onCancelPendingResolve/);
  assert.match(formSource, /Correct Inventory Record/);
  assert.match(formSource, /Optional\. Leave blank for a manual item\./);
  assert.match(serviceSource, /resolution_payload: resolutionPayload \|\| null/);
});
