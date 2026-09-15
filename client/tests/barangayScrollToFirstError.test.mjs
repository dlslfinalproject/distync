import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const readSource = (relativePath) =>
  readFile(resolve(projectRoot, relativePath), "utf8");

test("portal forms use the shared smooth scroll-to-first-error hook", async () => {
  const source = await readSource("src/components/layout/BarangayLayout.jsx");

  assert.match(
    source,
    /!isMayorPortal && !isBarangayPortal && !isMswdoPortal[\s\S]*scheduleScrollToFirstError\(event\.target\)/,
  );
  assert.match(
    source,
    /\}, \[isBarangayPortal, isMayorPortal, isMswdoPortal\]\);/,
  );
});

test("Household registration exposes existing field errors to the shared scroller", async () => {
  const [householdSource, familyHeadSource, membersSource] = await Promise.all([
    readSource("src/components/household-registration/HouseholdFormSection.jsx"),
    readSource("src/components/household-registration/FamilyHeadSection.jsx"),
    readSource("src/components/household-registration/MembersSection.jsx"),
  ]);

  assert.match(
    householdSource,
    /aria-invalid=\{Boolean\(form\.validationErrors\.evacuation_center_id\)\}/,
  );
  assert.match(
    householdSource,
    /aria-invalid=\{Boolean\(form\.validationErrors\.contact_number\)\}/,
  );
  assert.match(
    familyHeadSource,
    /aria-invalid=\{Boolean\(form\.validationErrors\.familyHead\.first_name\)\}/,
  );
  assert.match(
    familyHeadSource,
    /aria-invalid=\{Boolean\(form\.validationErrors\.family_head_photo_url\)\}/,
  );
  assert.match(
    membersSource,
    /form\.validationErrors\.members\[index\]\?\.relationship_option/,
  );
});

test("Barangay validated non-form modals schedule the same first-error scroll", async () => {
  const [stubPrintSource, masterlistSource, syncSource, transactionSource] = await Promise.all([
    readSource("src/components/stubs/StubPrintSheetModal.jsx"),
    readSource("src/pages/barangay/BarangayMasterlistPage.jsx"),
    readSource("src/pages/SyncManagementPage.jsx"),
    readSource("src/pages/barangay/DistributionTransactionPage.jsx"),
  ]);

  assert.match(stubPrintSource, /scheduleScrollToFirstError\(modalRef\)/);
  assert.match(stubPrintSource, /aria-invalid=\{Boolean\(errors\.disasterEventId\)\}/);
  assert.match(masterlistSource, /const exportModalRef = useRef\(null\);/);
  assert.match(masterlistSource, /scheduleScrollToFirstError\(exportModalRef\)/);
  assert.match(masterlistSource, /modalRef=\{exportModalRef\}/);
  assert.match(syncSource, /const isBarangayPortal = currentRole === ROLE_CODES\.BARANGAY;/);
  assert.match(
    syncSource,
    /isMayorPortal \|\| isBarangayPortal \|\| isMswdoPortal[\s\S]*scrollToErrorElement\(/,
  );
  assert.match(transactionSource, /scrollToErrorElement\(qrLookupInputRef\)/);
  assert.match(transactionSource, /ref=\{qrLookupInputRef\}/);
});

test("MSWDO validation surfaces expose the first-error targets", async () => {
  const [eventFormSource, eventPageSource, masterlistSource, syncSource] =
    await Promise.all([
      readSource("src/components/disaster-events/DisasterEventFormModal.jsx"),
      readSource("src/pages/mswdo/DisasterEventsPage.jsx"),
      readSource("src/pages/mswdo/ConsolidatedMasterlistPage.jsx"),
      readSource("src/pages/SyncManagementPage.jsx"),
    ]);

  assert.match(
    eventFormSource,
    /aria-invalid=\{Boolean\(fieldErrors\.event_name\)\}/,
  );
  assert.match(
    eventFormSource,
    /data-error-anchor=\{[\s\S]*fieldErrors\.barangay_ids/,
  );
  assert.match(eventPageSource, /const exportModalRef = useRef\(null\);/);
  assert.match(eventPageSource, /scheduleScrollToFirstError\(exportModalRef\)/);
  assert.match(eventPageSource, /modalRef=\{exportModalRef\}/);
  assert.match(masterlistSource, /const exportModalRef = useRef\(null\);/);
  assert.match(
    masterlistSource,
    /scheduleScrollToFirstError\(exportModalRef\)/,
  );
  assert.match(masterlistSource, /modalRef=\{exportModalRef\}/);
  assert.match(
    syncSource,
    /isMayorPortal \|\| isBarangayPortal \|\| isMswdoPortal/,
  );
});
