import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");

const readSource = (relativePath) =>
  readFileSync(resolve(projectRoot, relativePath), "utf8");

const familyHeadSource = readSource(
  "src/components/household-registration/FamilyHeadSection.jsx",
);
const membersSource = readSource(
  "src/components/household-registration/MembersSection.jsx",
);
const suggestionsSource = readSource(
  "src/components/household-registration/DuplicateRegistrationSuggestionsSection.jsx",
);
const registerModalSource = readSource(
  "src/components/household-registration/RegisterFamilyModal.jsx",
);
const barangayMasterlistSource = readSource(
  "src/pages/barangay/BarangayMasterlistPage.jsx",
);
const mswdoMasterlistSource = readSource(
  "src/pages/mswdo/ConsolidatedMasterlistPage.jsx",
);

const assertBefore = (source, earlierNeedle, laterNeedle, message) => {
  const earlierIndex = source.indexOf(earlierNeedle);
  const laterIndex = source.indexOf(laterNeedle);

  assert.notEqual(earlierIndex, -1, `${earlierNeedle} was not found`);
  assert.notEqual(laterIndex, -1, `${laterNeedle} was not found`);
  assert.equal(earlierIndex < laterIndex, true, message);
};

test("HMR-PM-01 family-head possible-match placement remains after family-head sectors", () => {
  assertBefore(
    familyHeadSource,
    "Member Sectors",
    "<DuplicateRegistrationSuggestionsSection",
    "Family-head suggestions must remain after the family-head sectors section.",
  );
});

test("HMR-PM-02 member possible-match placement is after member personal details and sectors", () => {
  assertBefore(
    membersSource,
    "<span style={fieldStyles.label}>First Name</span>",
    "<span style={fieldStyles.label}>Age</span>",
    "Member age/details must remain after the member name fields.",
  );
  assertBefore(
    membersSource,
    "<span style={fieldStyles.label}>Age</span>",
    "Member Sectors",
    "Member sectors must remain after member age/details.",
  );
  assertBefore(
    membersSource,
    "Member Sectors",
    "<DuplicateRegistrationSuggestionsSection",
    "Member suggestions must render after Member Sectors.",
  );
});

test("HMR-PM-03 member possible-match block remains inside each member card", () => {
  assert.match(
    membersSource,
    /form\.members\.map\(\(member, index\) => \{[\s\S]*const memberSuggestionGroups[\s\S]*return \([\s\S]*key=\{`member-\$\{index\}`\}[\s\S]*Member Sectors[\s\S]*<DuplicateRegistrationSuggestionsSection[\s\S]*groups=\{memberSuggestionGroups\}[\s\S]*<\/div>\s*\);\s*\}\)/,
  );
});

test("HMR-PM-04 member possible-match section is rendered only once per member", () => {
  const memberSuggestionRenderCount = (
    membersSource.match(/<DuplicateRegistrationSuggestionsSection/g) || []
  ).length;

  assert.equal(memberSuggestionRenderCount, 1);
});

test("HMR-PM-05 no-match behavior remains quiet", () => {
  assert.match(
    suggestionsSource,
    /if \(!isLoading && !errorMessage && suggestionGroups\.length === 0\) \{\s*return null;\s*\}/,
  );
});

test("HMR-PM-06 member candidates remain isolated by member index key", () => {
  assert.match(
    membersSource,
    /group\.person_key === `member_\$\{index\}`/,
  );
  assert.match(
    membersSource,
    /groups=\{memberSuggestionGroups\}/,
  );
});

test("HMR-PM-07 existing shared registration UI is used by Barangay and MSWDO", () => {
  assert.match(registerModalSource, /<FamilyHeadSection[\s\S]*form=\{form\}/);
  assert.match(registerModalSource, /<MembersSection[\s\S]*form=\{form\}/);
  assert.match(
    barangayMasterlistSource,
    /import RegisterFamilyModal from "\.\.\/\.\.\/components\/household-registration\/RegisterFamilyModal"/,
  );
  assert.match(
    mswdoMasterlistSource,
    /import RegisterFamilyModal from "\.\.\/\.\.\/components\/household-registration\/RegisterFamilyModal"/,
  );
});

test("HMR-PM-08 MSWDO household details uses Barangay presentation without administrative metadata", () => {
  assert.match(
    barangayMasterlistSource,
    /<HouseholdDetailModal[\s\S]*showAdministrativeMetadata=\{false\}/,
  );
  assert.match(
    mswdoMasterlistSource,
    /<HouseholdDetailModal[\s\S]*showAdministrativeMetadata=\{false\}/,
  );
});

test("HMR-PM-09 household details keeps operational sections available", () => {
  const detailModalSource = readSource(
    "src/components/masterlist/HouseholdDetailModal.jsx",
  );

  [
    "Disaster Event",
    "Barangay",
    "Stay Type",
    "Family Head",
    "Contact Number",
    "Household Size",
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

test("HMR-PM-10 MSWDO household details does not render privacy sync offline metadata", () => {
  assert.match(
    mswdoMasterlistSource,
    /<HouseholdDetailModal[\s\S]*showAdministrativeMetadata=\{false\}/,
  );
  assert.doesNotMatch(
    mswdoMasterlistSource,
    /Privacy Acknowledgment|Privacy Notice Version|Sync Status|Recorded Offline/,
  );
});
