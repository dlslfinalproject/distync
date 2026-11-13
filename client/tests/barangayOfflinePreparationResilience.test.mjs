import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const read = (file) => readFile(new URL(`../src/${file}`, import.meta.url), "utf8");

test("Barangay preparation retries bounded transient requests and rejects ordinary HTTP errors", async () => {
  const source = await read("offline/offlinePreparation.js");
  assert.match(source, /PREPARATION_MAX_ATTEMPTS = 3/);
  assert.match(source, /OFFLINE_PREPARATION_TIMEOUT/);
  assert.match(source, /\[408, 429\]/);
  assert.match(source, /statusCode >= 500/);
  assert.match(source, /instanceof TypeError/);
  assert.match(source, /attempt === PREPARATION_MAX_ATTEMPTS \|\| !isRetryablePreparationError/);
});

test("photo enrichment and safe household-detail reuse do not make photos bundle-fatal", async () => {
  const source = await read("offline/offlinePreparation.js");
  assert.match(source, /HOUSEHOLD_PHOTO_REUSED/);
  assert.match(source, /HOUSEHOLD_PHOTO_UNAVAILABLE/);
  assert.match(source, /HOUSEHOLD_DETAILS_REUSED/);
  assert.match(source, /cachedRow\?\.offline_household_details/);
  assert.match(source, /cachedRow\.offline_household_details\?\.household\?\.id/);
  assert.doesNotMatch(source, /!details\?\.household\?\.id \|\| !photoDataUrl/);
});

test("references, scope generations, empty snapshots, and safe UI categories are explicit", async () => {
  const [preparation, hook] = await Promise.all([
    read("offline/offlinePreparation.js"),
    read("features/offline/useBarangayOfflinePreparation.js"),
  ]);
  assert.match(preparation, /\["activeEvents", \(\) => fetchActiveDisasterEvents\(\)\]/);
  assert.match(preparation, /\["barangays", \(\) => fetchBarangays\(\)\]/);
  assert.match(preparation, /status: "SUCCESS"/);
  assert.match(preparation, /status: "FAILED"/);
  assert.match(preparation, /generation/);
  assert.match(preparation, /isCurrent\(\)/);
  assert.match(hook, /generationRef/);
  assert.match(hook, /detail\.accessMode === actorAccessMode/);
  assert.match(hook, /detail\.generation === undefined \|\| detail\.generation === generation/);
  assert.match(hook, /connection was interrupted/);
  assert.match(hook, /Reference information could not be refreshed/);
});

test("Barangay preparation has no polling loop and keeps explicit empty snapshot checks", async () => {
  const source = await read("features/offline/useBarangayOfflinePreparation.js");
  assert.match(source, /hasPersistedEmptyMasterlistSnapshot/);
  assert.match(source, /hasPersistedEmptyStubSnapshot/);
  assert.match(source, /window\.addEventListener\("online"/);
  assert.doesNotMatch(source, /setInterval|setTimeout/);
});
