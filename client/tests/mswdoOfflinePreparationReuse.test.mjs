import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const read = (file) => readFile(new URL(`../src/${file}`, import.meta.url), "utf8");

test("MSWDO reuses only a complete READY snapshot unless an explicit retry is pending", async () => {
  const hook = await read("features/offline/useMswdoOfflinePreparation.js");
  const snapshotRead = hook.indexOf("const snapshot = await readMswdoOfflineSnapshot");
  const reuseGate = hook.indexOf('if (snapshot?.status === "READY" && !explicitRefreshRequested)');
  const preparationCall = hook.indexOf("await prepareMswdoOfflineData");

  assert.ok(snapshotRead >= 0);
  assert.ok(reuseGate > snapshotRead && reuseGate < preparationCall);
  assert.match(hook, /retryScopeRef\.current\?\.scopeKey === scopeKey/);
  assert.match(hook, /retryScopeRef\.current = \{ scopeKey: currentScopeKey \}/);
  assert.match(hook, /if \(!snapshot\)\s*\{\s*setReadiness\("NOT_READY"\)/);
});

test("MSWDO snapshot reuse validates actor, event, cache version, datasets, and photo readiness", async () => {
  const preparation = await read("features/offline/mswdoOfflinePreparation.js");

  for (const condition of [
    /record\.accessMode !== owner\.accessMode/,
    /record\.userId !== userId/,
    /record\.roleCode !== ROLE_CODES\.MSWDO/,
    /record\.disaster_event_id[\s\S]*?eventId/,
    /record\?\.cache_version === MSWDO_OFFLINE_CACHE_VERSION/,
    /masterlistRows\.length === masterlistPayloadRows\.length/,
    /filters\?\.complete === true/,
    /distribution\?\.complete === true/,
    /photoCache\?\.complete === true/,
    /photoCache\.prepared === photoCount/,
    /photoCache\.actual_bytes_persisted === photoCount/,
  ]) {
    assert.match(preparation, condition);
  }
  assert.match(preparation, /\["READY", "NEEDS_REFRESH"\]\.includes\(record\.status\)/);
  assert.match(preparation, /if \(!record \|\| !\["READY", "NEEDS_REFRESH"\]\.includes\(record\.status\)\) return null/);
});

test("concurrent identical MSWDO scopes share one in-flight preparation and clear it on settlement", async () => {
  const preparation = await read("features/offline/mswdoOfflinePreparation.js");

  assert.match(preparation, /const preparationJobs = new Map\(\)/);
  assert.match(preparation, /const id = getMswdoOfflineScopeKey\(\{ userId, eventId, mode: owner\.accessMode \}\)/);
  assert.match(preparation, /const existingJob = preparationJobs\.get\(id\);\s*if \(existingJob\) return existingJob/);
  assert.match(preparation, /const job = preparation\.finally\(\(\) => \{\s*if \(preparationJobs\.get\(id\) === job\) preparationJobs\.delete\(id\)/);
  assert.match(preparation, /\[mode, userId, ROLE_CODES\.MSWDO, eventId, MSWDO_OFFLINE_DATASET\]/);
});

test("changing the active event prevents an older preparation result from writing shared references", async () => {
  const preparation = await read("features/offline/mswdoOfflinePreparation.js");
  const hook = await read("features/offline/useMswdoOfflinePreparation.js");
  const staleCheck = preparation.indexOf("if (!isCurrentMswdoPreparation(id, currentGeneration, owner, activeScope.generation)) {");
  const sharedReferenceWrite = preparation.indexOf("cacheRegistrationActiveDisasterEvents(");

  assert.match(hook, /setCurrentMswdoOfflineScope\(\{ userId, eventId \}\)/);
  assert.match(preparation, /const activePreparationScopes = new Map\(\)/);
  assert.match(preparation, /activeScope\.generation === scopeGeneration/);
  assert.ok(staleCheck >= 0 && staleCheck < sharedReferenceWrite);
  assert.match(preparation, /return \{ \.\.\.preparing, stale: true \}/);
});
