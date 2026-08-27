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
  assert.match(source, /re_admission_source_household_id:/);
});

test("re-admission action opens the shared Register Family modal after loading archived details", () => {
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

  assert.match(barangaySource, /fetchHouseholdDetails\(householdId\)/);
  assert.match(barangaySource, /mode: "reAdmission"/);
  assert.match(mswdoHookSource, /mode: "reAdmission"/);
  assert.match(modalSource, /Register Family - Re-admission/);
  assert.match(modalSource, /Submit Re-admission/);
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
