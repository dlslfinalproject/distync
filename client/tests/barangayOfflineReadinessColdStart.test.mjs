import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const read = (file) => readFile(new URL(`../src/${file}`, import.meta.url), "utf8");

test("Barangay cold start validates both durable datasets before restoring readiness", async () => {
  const source = await read("features/offline/useBarangayOfflinePreparation.js");

  assert.match(source, /getCachedMasterlistRows/);
  assert.match(source, /getCachedStubSnapshotsForScope/);
  assert.match(source, /hasCompletePreparedCache/);
  assert.match(source, /existing\?\.status === OFFLINE_PREPARATION_STATUS\.NEEDS_REFRESH/);
  assert.match(source, /setReadiness\(/);
});

test("offline cold start checks durable readiness before starting server preparation", async () => {
  const source = await read("features/offline/useBarangayOfflinePreparation.js");
  const cacheCheck = source.indexOf("if (hasCompletePreparedCache)");
  const offlineCheck = source.indexOf("navigator.onLine === false");
  const prepareCall = source.indexOf("const result = await prepareBarangayOfflineData");

  assert.ok(cacheCheck >= 0);
  assert.ok(offlineCheck > cacheCheck);
  assert.ok(prepareCall > offlineCheck);
});

test("Barangay readiness keeps a verified stale snapshot usable as Needs Refresh", async () => {
  const source = await read("features/offline/useBarangayOfflinePreparation.js");

  assert.match(
    source,
    /existing\?\.status === OFFLINE_PREPARATION_STATUS\.NEEDS_REFRESH\s*\?\s*OFFLINE_PREPARATION_STATUS\.NEEDS_REFRESH\s*:\s*OFFLINE_PREPARATION_STATUS\.READY/,
  );
  assert.doesNotMatch(source, /hasCompletePreparedCache[\s\S]*existing\?\.status === OFFLINE_PREPARATION_STATUS\.READY/);
});

test("Barangay cold start waits for the restored actor scope and reruns when it changes", async () => {
  const source = await read("features/offline/useBarangayOfflinePreparation.js");

  assert.match(source, /getSyncQueueActorContext/);
  assert.match(source, /actorUserId !== userId/);
  assert.match(source, /actorRoleCode !== ROLE_CODES\.BARANGAY/);
  assert.match(source, /actorAccessMode,\s*actorRoleCode,\s*actorUserId/);
});

test("zero-row prepared datasets require explicit durable snapshot metadata", async () => {
  const source = await read("features/offline/useBarangayOfflinePreparation.js");

  assert.match(source, /hasPersistedEmptyMasterlistSnapshot/);
  assert.match(source, /hasPersistedEmptyStubSnapshot/);
  assert.match(source, /datasets\?\.masterlist\?\.readBack === true/);
  assert.match(source, /datasets\?\.stubs\?\.readBack === true/);
  assert.match(source, /expectedMasterlistCount > 0/);
  assert.match(source, /expectedStubCount > 0/);
});
