import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const read = (file) => readFile(new URL(`../src/${file}`, import.meta.url), "utf8");

test("MSWDO preparation exposes stable failure stages and safe messages", async () => {
  const source = await read("features/offline/mswdoOfflinePreparation.js");
  for (const stage of [
    "DISTRIBUTION_FETCH",
    "DISTRIBUTION_VALIDATE",
    "DISTRIBUTION_PERSIST",
    "PHOTO_FETCH",
    "PHOTO_CONVERT",
    "READ_BACK",
    "PREPARATION_METADATA",
  ]) {
    assert.match(source, new RegExp(`${stage}: "${stage}"`));
    assert.match(source, new RegExp(`failure_stage: failure\\.stage`));
  }
  assert.match(source, /failure_message: failure\.message/);
  assert.doesNotMatch(source, /photoUrl[^\n]*console\.(log|error)/);
});
test("municipal dashboard failures are classified as distribution fetch failures", async () => {
  const source = await read("features/offline/mswdoOfflinePreparation.js");
  assert.match(source, /runPreparationStage\(MSWDO_PREPARATION_FAILURE_STAGES\.DISTRIBUTION_FETCH, \(\) => fetchMunicipalStubDashboard/);
});

test("invalid required stub identity or QR is classified before persistence", async () => {
  const source = await read("features/offline/mswdoOfflinePreparation.js");
  assert.match(source, /!Array\.isArray\(stubDashboard\?\.data\)/);
  assert.match(source, /stubRows\.find\(\(row\) => !row\?\.id \|\| !row\?\.qr_code_value\)/);
  assert.match(source, /DISTRIBUTION_ID_OR_QR/);
});

test("photo network, HTTP, MIME, and conversion failures remain strict and classified", async () => {
  const source = await read("features/offline/mswdoOfflinePreparation.js");
  assert.match(source, /catch \(_error\) \{[\s\S]*PHOTO_NETWORK/);
  assert.match(source, /PHOTO_HTTP_\$\{response\.status\}/);
  assert.match(source, /PHOTO_NON_IMAGE/);
  assert.match(source, /PHOTO_FILEREADER/);
  assert.match(source, /PHOTO_DATA_URL/);
});

test("missing photo rows retain the existing non-blocking policy", async () => {
  const source = await read("features/offline/mswdoOfflinePreparation.js");
  assert.match(source, /if \(!photoUrl\) return ""/);
  assert.match(source, /const requiredPhotoRows = \[\.\.\.masterlistRows, \.\.\.stubRows\]\.filter/);
});

test("distribution and photo persistence failures are not hidden by generic errors", async () => {
  const source = await read("features/offline/mswdoOfflinePreparation.js");
  assert.match(source, /runPreparationStage\(MSWDO_PREPARATION_FAILURE_STAGES\.DISTRIBUTION_PERSIST, \(\) => upsertOfflineStubSnapshots/);
  assert.match(source, /runPreparationStage\(MSWDO_PREPARATION_FAILURE_STAGES\.READ_BACK, \(\) => db\.offlineStubCache\.toArray/);
  assert.match(source, /MswdoOfflinePreparationError\(MSWDO_PREPARATION_FAILURE_STAGES\.READ_BACK/);
});

test("retry cycles use generation guards for terminal metadata and events", async () => {
  const preparation = await read("features/offline/mswdoOfflinePreparation.js");
  const hook = await read("features/offline/useMswdoOfflinePreparation.js");
  assert.match(preparation, /preparationGenerations/);
  assert.match(preparation, /isCurrentPreparationGeneration\(id, currentGeneration\)/);
  assert.match(preparation, /if \(!isCurrentPreparationGeneration\(id, currentGeneration\)\) return snapshot/);
  assert.match(hook, /const generation = \+\+generationRef\.current/);
  assert.match(hook, /generationRef\.current === event\.detail\?\.generation/);
});

test("last-good cache and safe failure diagnostics remain available to the hook and popup", async () => {
  const hook = await read("features/offline/useMswdoOfflinePreparation.js");
  const popup = await read("components/layout/OfflineDataReadiness.jsx");
  assert.match(hook, /existing\?\.previous_complete_cache \? "NEEDS_REFRESH" : "NOT_READY"/);
  assert.match(hook, /failureStage = diagnostics\?\.failure_stage/);
  assert.match(hook, /failureMessage:/);
  assert.match(popup, /safeFailureMessage/);
  assert.match(popup, /!ready && !preparing && safeFailureMessage/);
});

test("event-wide municipal preparation and selected-Barangay page request remain distinct", async () => {
  const preparation = await read("features/offline/mswdoOfflinePreparation.js");
  const service = await read("features/stubs/stubService.js");
  assert.match(preparation, /fetchMunicipalStubDashboard\(\{ disasterEventId: eventId/);
  assert.match(service, /\/api\/v1\/stubs\/municipal-dashboard/);
  assert.match(service, /\/api\/v1\/stubs\/barangay-dashboard/);
});
