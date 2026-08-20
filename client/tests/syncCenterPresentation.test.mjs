import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const pageSourcePath = new URL("../src/pages/SyncManagementPage.jsx", import.meta.url);
const helperSourcePath = new URL(
  "../src/features/sync/syncManagementHelpers.js",
  import.meta.url,
);

test("BRG-SC-P01 Sync Center renders last successful sync from status-summary", async () => {
  const source = await fs.readFile(pageSourcePath, "utf8");

  assert.match(source, /fetchSyncStatusSummary/);
  assert.match(source, /lastSuccessfulSyncAt:\s*summaryResponse\.lastSuccessfulSyncAt/);
  assert.match(source, /label="Last Successful Sync"/);
  assert.match(source, /value=\{formatSyncDateTime\(summary\.lastSuccessfulSyncAt\)\}/);
});

test("BRG-SC-P02 local queue and server history are visibly distinct", async () => {
  const source = await fs.readFile(pageSourcePath, "utf8");

  assert.match(source, /Local device actions waiting to be sent or retried from this browser\./);
  assert.match(source, /Server Sync History/);
  assert.match(source, /Central server records for synchronization attempts associated with your account\./);
});

test("BRG-SC-P03 transaction and conflict status filters are not mixed", async () => {
  const source = await fs.readFile(pageSourcePath, "utf8");

  assert.match(source, /const TRANSACTION_STATUS_OPTIONS = \[[\s\S]*LOCAL_SYNC_STATUS\.CONFLICT/);
  assert.doesNotMatch(
    source.match(/const TRANSACTION_STATUS_OPTIONS = \[[\s\S]*?\];/)?.[0] || "",
    /RESOLVED/,
  );
  assert.match(source, /const CONFLICT_STATUS_OPTIONS = \[[\s\S]*\{ value: "RESOLVED", label: "Resolved" \}/);
  assert.match(source, /activeSyncTab === "CONFLICTS" \? "Conflict Status" : "Sync Status"/);
});

test("BRG-SC-P04 non-retryable queue entries explain unavailable retry", async () => {
  const source = await fs.readFile(pageSourcePath, "utf8");

  assert.match(source, /!isSafeRetryableQueueEntry\(entry\)[\s\S]*Retry is unavailable for this entry/);
  assert.match(source, /disabled=\{[\s\S]*!isSafeRetryableQueueEntry\(entry\)/);
});

test("BRG-SC-P05 raw UUIDs are not primary record labels", async () => {
  const helperSource = await fs.readFile(helperSourcePath, "utf8");

  assert.match(helperSource, /uuidPattern\.test/);
  assert.match(helperSource, /fallbackSubject/);
  assert.match(helperSource, /Technical reference available in the sync record\./);
});
