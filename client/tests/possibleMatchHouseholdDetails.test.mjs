import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");

const readSource = (relativePath) =>
  readFileSync(resolve(projectRoot, relativePath), "utf8");

const registerModalSource = readSource(
  "src/components/household-registration/RegisterFamilyModal.jsx",
);
const familyHeadSource = readSource(
  "src/components/household-registration/FamilyHeadSection.jsx",
);
const membersSource = readSource(
  "src/components/household-registration/MembersSection.jsx",
);
const suggestionsSource = readSource(
  "src/components/household-registration/DuplicateRegistrationSuggestionsSection.jsx",
);
const detailModalSource = readSource(
  "src/components/masterlist/HouseholdDetailModal.jsx",
);
const barangayMasterlistSource = readSource(
  "src/pages/barangay/BarangayMasterlistPage.jsx",
);
const mswdoMasterlistSource = readSource(
  "src/pages/mswdo/ConsolidatedMasterlistPage.jsx",
);

const unwantedAdministrativeLabels = [
  "Privacy Acknowledgment",
  "Privacy Notice Version",
  "Acknowledged On",
  "Sync Status",
  "Recorded Offline",
];

test("PM-HD-01 possible-match household details uses the shared details modal without administrative metadata", () => {
  assert.match(
    registerModalSource,
    /<HouseholdDetailModal[\s\S]*isOpen=\{Boolean\(viewingSuggestedHouseholdId\)\}[\s\S]*householdDetails=\{suggestedHouseholdDetails\}[\s\S]*showAdministrativeMetadata=\{false\}/,
  );
});

test("PM-HD-02 family-head and member possible matches open the same suggested-household handler", () => {
  assert.match(
    registerModalSource,
    /<FamilyHeadSection[\s\S]*onViewSuggestedHousehold=\{handleOpenSuggestedHouseholdDetails\}/,
  );
  assert.match(
    registerModalSource,
    /<MembersSection[\s\S]*onViewSuggestedHousehold=\{handleOpenSuggestedHouseholdDetails\}/,
  );
  assert.match(
    familyHeadSource,
    /<DuplicateRegistrationSuggestionsSection[\s\S]*onViewHousehold=\{onViewSuggestedHousehold\}/,
  );
  assert.match(
    membersSource,
    /<DuplicateRegistrationSuggestionsSection[\s\S]*onViewHousehold=\{onViewSuggestedHousehold\}/,
  );
  assert.match(
    suggestionsSource,
    /onClick=\{\(\) => onViewHousehold\?\.\(match\.household_id\)\}/,
  );
});

test("PM-HD-03 Barangay and MSWDO registration flows share RegisterFamilyModal possible-match details", () => {
  assert.match(
    barangayMasterlistSource,
    /import RegisterFamilyModal from "\.\.\/\.\.\/components\/household-registration\/RegisterFamilyModal"/,
  );
  assert.match(
    mswdoMasterlistSource,
    /import RegisterFamilyModal from "\.\.\/\.\.\/components\/household-registration\/RegisterFamilyModal"/,
  );
  assert.match(
    barangayMasterlistSource,
    /<RegisterFamilyModal[\s\S]*form=\{registrationForm\}/,
  );
  assert.match(
    mswdoMasterlistSource,
    /<RegisterFamilyModal[\s\S]*form=\{registrationForm\}/,
  );
});

test("PM-HD-04 operational household detail sections remain available in the shared modal", () => {
  [
    "Disaster Event",
    "Barangay",
    "Stay Type",
    "Family Head",
    "Contact Number",
    "Household Size",
    "Registered At",
    "Record Status",
    "Registered By",
    "Family Head Photo",
    "Household Sectors / Vulnerabilities",
    "Evacuation Status",
    "Arrival Time",
    "Departure Time",
    "Family Members",
    "Sectors:",
  ].forEach((label) => {
    assert.match(detailModalSource, new RegExp(label.replace("/", "\\/")));
  });
});

test("PM-HD-05 normal Barangay and MSWDO masterlist details keep administrative metadata disabled", () => {
  assert.match(
    barangayMasterlistSource,
    /<HouseholdDetailModal[\s\S]*showAdministrativeMetadata=\{false\}/,
  );
  assert.match(
    mswdoMasterlistSource,
    /<HouseholdDetailModal[\s\S]*showAdministrativeMetadata=\{false\}/,
  );
});

test("PM-HD-06 administrative labels remain gated by the shared visibility prop", () => {
  assert.match(detailModalSource, /showAdministrativeMetadata = true/);
  assert.match(
    detailModalSource,
    /if \(showAdministrativeMetadata\) \{[\s\S]*summaryItems\.push/,
  );

  unwantedAdministrativeLabels.forEach((label) => {
    assert.match(detailModalSource, new RegExp(label));
  });
});
