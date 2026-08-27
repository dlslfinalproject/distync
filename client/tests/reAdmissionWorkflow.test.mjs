import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const clientRoot = path.resolve(process.cwd(), "src");

const readSource = (...segments) =>
  fs.readFileSync(path.join(clientRoot, ...segments), "utf8");

test("re-admission form mode reuses household data but strips historical IDs and requests fresh privacy", () => {
  const source = readSource(
    "features",
    "household-registration",
    "useHouseholdRegistrationForm.js",
  );

  assert.match(source, /const isReAdmissionMode = mode === "reAdmission"/);
  assert.match(
    source,
    /isReAdmissionMode \|\|\s*requiresHouseholdPrivacyPrompt/s,
  );
  assert.match(source, /household_id:\s*isEditMode\s*\?/);
  assert.match(source, /id:\s*isEditMode\s*\? member\.id \|\| null : null/);
  assert.match(source, /registration_operation: "CREATE_NEW_HOUSEHOLD_OCCURRENCE"/);
  assert.match(source, /sourceArchivedHouseholdId = null/);
  assert.match(source, /retainedSourceArchivedHouseholdId/);
  assert.match(
    source,
    /re_admission_source_household_id:\s*retainedSourceArchivedHouseholdId/,
  );
  assert.doesNotMatch(
    source,
    /re_admission_source_household_id:\s*initialHouseholdDetails\?\.household\?\.id/,
  );
});

test("re-admission action opens the shared Register Family modal with the exact archived source", () => {
  const barangaySource = readSource(
    "pages",
    "barangay",
    "BarangayMasterlistPage.jsx",
  );
  const mswdoHookSource = readSource(
    "features",
    "mswdo-masterlist",
    "useMswdoMasterlistPage.js",
  );
  const modalSource = readSource(
    "components",
    "household-registration",
    "RegisterFamilyModal.jsx",
  );

  assert.match(
    barangaySource,
    /const sourceArchivedHouseholdId = String\(householdId \|\| ""\)\.trim\(\)/,
  );
  assert.match(barangaySource, /fetchHouseholdDetails\(sourceArchivedHouseholdId\)/);
  assert.match(barangaySource, /loadedHouseholdId/);
  assert.match(barangaySource, /details\?\.household\?\.is_active !== false/);
  assert.match(barangaySource, /sourceArchivedHouseholdId: reAdmissionSourceArchivedHouseholdId/);
  assert.match(barangaySource, /reAdmissionRequestSequenceRef/);
  assert.match(mswdoHookSource, /fetchHouseholdDetails\(sourceArchivedHouseholdId\)/);
  assert.match(mswdoHookSource, /sourceArchivedHouseholdId: reAdmissionSourceArchivedHouseholdId/);
  assert.match(barangaySource, /mode: "reAdmission"/);
  assert.match(mswdoHookSource, /mode: "reAdmission"/);
  assert.match(modalSource, /Register Family - Re-admission/);
  assert.match(modalSource, /Submit Re-admission/);

  const barangayReAdmissionBranch = barangaySource
    .split("const handleOpenRestoreHousehold", 2)[1]
    .split("setPendingRestoreHouseholdId", 2)[0];
  const mswdoReAdmissionBranch = mswdoHookSource
    .split("const handleOpenRestoreHousehold", 2)[1]
    .split("setPendingRestoreHouseholdId", 2)[0];

  assert.doesNotMatch(barangayReAdmissionBranch, /restoreHousehold\(/);
  assert.doesNotMatch(mswdoReAdmissionBranch, /restoreHousehold\(/);
});

test("re-admission service maps stale-source errors without weakening the backend guard", () => {
  const serviceSource = readSource(
    "features",
    "household-registration",
    "householdRegistrationService.js",
  );

  assert.match(
    serviceSource,
    /RE_ADMISSION_SOURCE_NOT_ARCHIVED:\s*[\s\S]*?This household is no longer archived/,
  );
  assert.match(
    serviceSource,
    /HOUSEHOLD_ALREADY_ADMITTED:\s*[\s\S]*?already been re-admitted/,
  );
  assert.match(
    readSource("..", "..", "server", "src", "services", "householdRegistration.service.js"),
    /Only an archived household occurrence can be re-admitted\./,
  );
});

test("offline re-admission uses a create-occurrence sync action", () => {
  const serviceSource = readSource(
    "features",
    "household-registration",
    "householdRegistrationService.js",
  );
  const syncPresentationSource = readSource(
    "features",
    "sync",
    "syncManagementHelpers.js",
  );
  const masterlistSyncSource = readSource(
    "features",
    "masterlist",
    "useBarangayMasterlistSync.js",
  );
  const stubOfflineSource = readSource(
    "features",
    "stubs",
    "stubOfflineRows.js",
  );

  assert.match(serviceSource, /HOUSEHOLD_RE_ADMISSION/);
  assert.match(serviceSource, /if \(!isReAdmission\)/);
  assert.match(syncPresentationSource, /HOUSEHOLD_RE_ADMISSION: "Re-admit Household"/);
  assert.match(masterlistSyncSource, /HOUSEHOLD_RE_ADMISSION/);
  assert.match(stubOfflineSource, /HOUSEHOLD_RE_ADMISSION/);
});
