import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const readSource = async (relativePath) =>
  fs.readFile(new URL(relativePath, import.meta.url), "utf8");

test("H03C-03 Donation mutations are online-only and do not use the offline queue wrapper", async () => {
  const source = await readSource("../src/features/donations/donationService.js");

  assert.match(source, /performOnlineOnlyMutation/);
  assert.match(
    source,
    /An internet connection is required to save donation changes\./,
  );
  assert.doesNotMatch(source, /performSyncableMutation/);
  assert.doesNotMatch(source, /buildOfflineQueuedResponse/);
  assert.doesNotMatch(source, /saved offline|Pending sync once connection is restored/i);
});

test("H03C-04 Disaster Event mutations are online-only and do not use the offline queue wrapper", async () => {
  const source = await readSource(
    "../src/features/disaster-events/disasterEventService.js",
  );

  assert.match(source, /performOnlineOnlyMutation/);
  assert.match(
    source,
    /An internet connection is required to create or update disaster events\./,
  );
  assert.doesNotMatch(source, /performSyncableMutation/);
  assert.doesNotMatch(source, /buildOfflineQueuedResponse/);
  assert.doesNotMatch(source, /saved offline|Pending sync once connection is restored/i);
});

test("H03C-05 online Donation and Disaster Event services still call their normal API routes", async () => {
  const donationSource = await readSource("../src/features/donations/donationService.js");
  const disasterEventSource = await readSource(
    "../src/features/disaster-events/disasterEventService.js",
  );

  assert.match(donationSource, /\/api\/v1\/donations/);
  assert.match(donationSource, /method:\s*"POST"/);
  assert.match(donationSource, /method:\s*"PUT"/);
  assert.match(disasterEventSource, /\/api\/v1\/disaster-events/);
  assert.match(disasterEventSource, /method:\s*"POST"/);
  assert.match(disasterEventSource, /method:\s*"PATCH"/);
});

test("H03C-07 legacy Donation and Disaster Event queue entries are visible but not retryable", async () => {
  const source = await readSource("../src/offline/syncQueue.js");

  for (const actionKey of [
    "DONATION_NEED_CREATE",
    "DONATION_NEED_UPDATE",
    "DONATION_CREATE",
    "DONATION_UPDATE",
    "DONATION_ITEM_CREATE",
    "DONATION_ITEM_UPDATE",
    "DISASTER_EVENT_CREATE",
    "DISASTER_EVENT_UPDATE",
    "DISASTER_EVENT_EXTEND",
    "DISASTER_EVENT_END",
  ]) {
    assert.match(source, new RegExp(`"${actionKey}"`));
  }

  assert.match(source, /getVisibleSyncQueueEntries[\s\S]*isSyncEntryVisibleForContext/);
  assert.match(source, /export const isNonRetryableSyncEntry/);
  assert.match(source, /getRetryableSyncEntries[\s\S]*!isNonRetryableSyncEntry\(entry\)/);
  assert.match(source, /getFailedSyncEntries[\s\S]*!isNonRetryableSyncEntry\(entry\)/);
});
