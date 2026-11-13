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
  "Data Privacy Acknowledgement",
  "Privacy Acknowledgement",
  "Privacy Acknowledgment",
  "Privacy Notice Version",
  "Acknowledged On",
  "Sync Status",
  "Recorded Offline",
];

test("PM-HD-01 duplicate suggestions do not open a household-details modal", () => {
  assert.doesNotMatch(registerModalSource, /HouseholdDetailModal/);
  assert.doesNotMatch(registerModalSource, /fetchHouseholdDetails/);
  assert.doesNotMatch(suggestionsSource, /View Household Details/);
});

test("PM-HD-02 family-head and member suggestions keep the shared card without navigation", () => {
  assert.match(familyHeadSource, /<DuplicateRegistrationSuggestionsSection/);
  assert.match(membersSource, /<DuplicateRegistrationSuggestionsSection/);
  assert.doesNotMatch(familyHeadSource, /onViewHousehold/);
  assert.doesNotMatch(membersSource, /onViewHousehold/);
  assert.doesNotMatch(suggestionsSource, /onClick=/);
});

test("PM-HD-08 restricted external Barangay matches use a limited card summary", () => {
  assert.match(suggestionsSource, /RESTRICTED_EXTERNAL_BARANGAY/);
  assert.match(suggestionsSource, /match\.family_head_name/);
  assert.match(suggestionsSource, /match\.barangay_name/);
  assert.match(suggestionsSource, /formatDateTime\(match\.registered_at\)/);
  assert.match(suggestionsSource, /Details restricted/);
});

test("PM-HD-09 restricted external Barangay matches do not receive household navigation", () => {
  assert.doesNotMatch(suggestionsSource, /onViewHousehold/);
  assert.doesNotMatch(suggestionsSource, /View Household Details/);
  assert.doesNotMatch(suggestionsSource, /onClick=/);
});

test("PM-HD-10 add-member possible matches use the restricted-aware shared section", () => {
  assert.match(
    membersSource,
    /form\.members\.map\(\(member, index\) => \{[\s\S]*<DuplicateRegistrationSuggestionsSection[\s\S]*groups=\{memberSuggestionGroups\}/,
  );
  assert.match(
    suggestionsSource,
    /if \(match\.details_restricted\) \{[\s\S]*return true;/,
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

  unwantedAdministrativeLabels.slice(2).forEach((label) => {
    assert.match(detailModalSource, new RegExp(label));
  });
});

test("PM-HD-07 duplicate suggestions do not expose household-detail controls", () => {
  assert.match(detailModalSource, /showDataPrivacyAcknowledgement = false/);
  assert.doesNotMatch(registerModalSource, /HouseholdDetailModal/);

  unwantedAdministrativeLabels.forEach((label) => {
    assert.doesNotMatch(registerModalSource, new RegExp(label));
  });
});
