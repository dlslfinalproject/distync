import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const readSource = async (...segments) =>
  fs.readFile(path.join(testDirectory, "..", ...segments), "utf8");

test("evacuation-center select, validation, and payload use the same form field", async () => {
  const componentSource = await readSource(
    "src",
    "components",
    "household-registration",
    "HouseholdFormSection.jsx",
  );
  const hookSource = await readSource(
    "src",
    "features",
    "household-registration",
    "useHouseholdRegistrationForm.js",
  );

  assert.match(componentSource, /value=\{form\.household\.evacuation_center_id\}/);
  assert.match(
    componentSource,
    /updateHouseholdField\("evacuation_center_id", event\.target\.value\)/,
  );
  assert.match(
    hookSource,
    /fieldName === "evacuation_center_id"[\s\S]*?normalizeEvacuationCenterId\(value\)/,
  );
  assert.match(
    hookSource,
    /if \(!effectiveEvacuationCenterId\)[\s\S]*?Please select an evacuation center\./,
  );
  assert.match(
    hookSource,
    /evacuation_center_id:[\s\S]*?effectiveEvacuationCenterId \|\| null/,
  );
  assert.doesNotMatch(
    hookSource,
    /const inferredSingleEvacuationCenterId =/,
  );
});

test("center reloads do not rerun from selection changes and invalid scope clears the field", async () => {
  const hookSource = await readSource(
    "src",
    "features",
    "household-registration",
    "useHouseholdRegistrationForm.js",
  );
  const loadingEffect = hookSource
    .split("const loadEvacuationCenters = async () =>", 2)[1]
    .split("const updateResidencyStatus", 2)[0];

  assert.doesNotMatch(loadingEffect, /household\.evacuation_center_id,\s*initialHouseholdDetails/);
  assert.match(
    loadingEffect,
    /normalizedCenters\.some\([\s\S]*?nextEvacuationCenterId[\s\S]*?: ""/,
  );
  assert.match(
    hookSource,
    /setHousehold\(\(currentValue\) => \(\{[\s\S]*?evacuation_center_id: "",[\s\S]*?\}\)\);/,
  );
});

test("offline registration requires and queues the authoritative center ID", async () => {
  const serviceSource = await readSource(
    "src",
    "features",
    "household-registration",
    "householdRegistrationService.js",
  );

  assert.match(
    serviceSource,
    /payload\.current_stay_type === "EVAC_CENTER"[\s\S]*?\["evacuation_center_id"\]/,
  );
  assert.match(serviceSource, /body: JSON\.stringify\(payload\)/);
});

