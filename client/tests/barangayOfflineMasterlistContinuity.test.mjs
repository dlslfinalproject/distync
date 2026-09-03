import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const readSource = async (...segments) =>
  fs.readFile(path.join(testDirectory, "..", ...segments), "utf8");

test("Barangay Masterlist cache helper is imported and writes successful results", async () => {
  const source = await readSource("src", "features", "masterlist", "masterlistService.js");

  assert.match(source, /import \{[\s\S]*cacheMasterlistRows[\s\S]*getCachedMasterlistRows[\s\S]*\} from .*offline\/masterlistCache\.js/);
  assert.match(source, /await cacheMasterlistRows\(\{ rows, disasterEventId, barangayId \}\)/);
  assert.match(source, /export const getCachedMasterlistResult = async/);
});

test("offline Masterlist reads durable rows and keeps the effective table scope", async () => {
  const hookSource = await readSource("src", "features", "masterlist", "masterlistHooks.js");
  const uiSource = await readSource("src", "features", "masterlist", "barangayMasterlistUi.js");

  assert.match(hookSource, /const cachedMasterlistRows = await getCachedMasterlistRows/);
  assert.match(hookSource, /const cachedData = buildCachedMasterlistResult/);
  assert.doesNotMatch(hookSource, /Offline mode: showing the last saved Masterlist/);
  assert.match(hookSource, /setErrorMessage\(""\);\s*setInfoMessage\(/);
  assert.match(uiSource, /resolveEffectiveMasterlistRows/);
  assert.match(uiSource, /HOUSEHOLD_REGISTER/);
  assert.match(uiSource, /Pending local address/);
});

test("cached Masterlist fallback remains renderable while offline status is informational", async () => {
  const hookSource = await readSource("src", "features", "masterlist", "masterlistHooks.js");
  const pageSource = await readSource("src", "pages", "barangay", "BarangayMasterlistPage.jsx");

  assert.match(hookSource, /infoMessage/);
  assert.match(pageSource, /infoMessage=\{attendanceActionMessage \|\| masterlistInfoMessage\}/);
});

test("Offline Data Ready requires the persisted Masterlist read-back", async () => {
  const source = await readSource("src", "features", "offline", "useBarangayOfflinePreparation.js");

  assert.match(source, /getCachedMasterlistRows/);
  assert.match(source, /hasRequiredMasterlistCache/);
  assert.match(source, /expectedMasterlistCount === 0 \|\| cachedMasterlistRows\.length > 0/);
});

test("new offline household occurrences do not derive local IDs from names", async () => {
  const source = await readSource("src", "features", "household-registration", "householdRegistrationService.js");

  assert.match(source, /entityLocalId: null/);
  assert.doesNotMatch(source, /entityLocalId: payload\?\.family_head\?\.first_name/);
});

test("offline preparation and Register Family share the persisted evacuation-center path", async () => {
  const preparationSource = await readSource("src", "offline", "offlinePreparation.js");
  const formSource = await readSource("src", "features", "household-registration", "useHouseholdRegistrationForm.js");
  const serviceSource = await readSource("src", "features", "household-registration", "householdRegistrationService.js");

  assert.match(preparationSource, /fetchEvacuationCentersByBarangay/);
  assert.match(preparationSource, /getCachedEvacuationCentersByBarangay/);
  assert.match(preparationSource, /OFFLINE_PREPARATION_REFERENCE_READ_BACK_FAILED/);
  assert.match(formSource, /getCachedEvacuationCentersByBarangay/);
  assert.match(serviceSource, /export const getCachedEvacuationCentersByBarangay/);
  assert.match(serviceSource, /evacuationCentersByBarangay/);
});

test("Barangay queue changes are consumed by the reactive Masterlist path", async () => {
  const pageSource = await readSource("src", "pages", "barangay", "BarangayMasterlistPage.jsx");
  const syncSource = await readSource("src", "features", "masterlist", "useBarangayMasterlistSync.js");

  assert.match(pageSource, /useLiveQuery\(\(\) => getVisibleSyncQueueEntries\(\), \[\], \[\]\)/);
  assert.match(syncSource, /syncQueueEntries/);
  assert.match(syncSource, /resolveEffectiveMasterlistRows/);
});

test("offline Barangay context restores only an authorized prepared event scope", async () => {
  const dashboardSource = await readSource("src", "features", "barangay-dashboard", "useBarangayDashboard.js");
  const preparationSource = await readSource("src", "offline", "offlinePreparation.js");

  assert.match(dashboardSource, /getPreparedBarangayOfflineContexts/);
  assert.match(dashboardSource, /preparation\.disaster_event_id/);
  assert.match(dashboardSource, /selectedPreparedContext\?\.barangay_id/);
  assert.match(dashboardSource, /getCachedRegistrationReferenceData/);
  assert.match(preparationSource, /preparation\.accessMode === owner\.accessMode/);
  assert.match(preparationSource, /preparation\.userId === userId/);
  assert.match(preparationSource, /preparation\.roleCode === ROLE_CODES\.BARANGAY/);
});
