import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

const readSource = (relativePath) =>
  fs.readFile(new URL(`../src/${relativePath}`, import.meta.url), "utf8");

test("defense masterlist rows use structured barangay and projected registrar/center fields", async () => {
  const [serviceSource, tableSource] = await Promise.all([
    readSource("features/masterlist/masterlistService.js"),
    readSource("components/masterlist/MasterlistTable.jsx"),
  ]);

  assert.match(serviceSource, /const barangayName = household\.barangay\?\.name/);
  assert.match(serviceSource, /address: barangayName \|\| "-"/);
  assert.match(serviceSource, /evacuation_center_name:/);
  assert.match(serviceSource, /registered_by_name:/);
  assert.doesNotMatch(serviceSource, /address:\s*\n?\s*household\.current_address_details/);
  assert.match(tableSource, />Barangay<\/th>/);
  assert.match(tableSource, />Evacuation Center<\/th>/);
  assert.match(tableSource, />Registered By<\/th>/);
  assert.match(tableSource, /row\.barangay_name/);
  assert.match(tableSource, /row\.evacuation_center_name/);
  assert.match(tableSource, /row\.registered_by_name/);
});

test("defense edit/detail paths never use the generic saved-center label", async () => {
  const [formSource, detailSource, photoSource] = await Promise.all([
    readSource("features/household-registration/useHouseholdRegistrationForm.js"),
    readSource("components/masterlist/HouseholdDetailModal.jsx"),
    readSource("features/masterlist/familyHeadPhoto.js"),
  ]);

  assert.doesNotMatch(formSource, /Saved evacuation center/);
  assert.match(formSource, /savedEditEvacuationCenterName/);
  assert.match(detailSource, /label: "Evacuation Center"/);
  assert.match(detailSource, /household\?\.registered_by_name \|\| "Not recorded"/);
  assert.match(photoSource, /data:image/);
  assert.match(photoSource, /base64/);
});
