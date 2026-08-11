import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");

const readSource = (relativePath) =>
  readFileSync(resolve(projectRoot, relativePath), "utf8");

const detailModalSource = readSource(
  "src/components/masterlist/HouseholdDetailModal.jsx",
);
const barangayMasterlistSource = readSource(
  "src/pages/barangay/BarangayMasterlistPage.jsx",
);
const mswdoMasterlistSource = readSource(
  "src/pages/mswdo/ConsolidatedMasterlistPage.jsx",
);
const registerModalSource = readSource(
  "src/components/household-registration/RegisterFamilyModal.jsx",
);

const assertBefore = (source, earlierNeedle, laterNeedle, message) => {
  const earlierIndex = source.indexOf(earlierNeedle);
  const laterIndex = source.indexOf(laterNeedle);

  assert.notEqual(earlierIndex, -1, `${earlierNeedle} was not found`);
  assert.notEqual(laterIndex, -1, `${laterNeedle} was not found`);
  assert.equal(earlierIndex < laterIndex, true, message);
};

test("DP-HD-01 shared modal has a separate safe-default privacy acknowledgement capability", () => {
  assert.match(detailModalSource, /showAdministrativeMetadata = true/);
  assert.match(detailModalSource, /showDataPrivacyAcknowledgement = false/);
  assert.match(
    detailModalSource,
    /const dataPrivacyAcknowledgementItems = \[[\s\S]*label: "Privacy Acknowledgement"[\s\S]*label: "Privacy Notice Version"[\s\S]*label: "Acknowledged On"[\s\S]*\];/,
  );
});

test("DP-HD-02 data privacy acknowledgement renders as the final household detail section", () => {
  assertBefore(
    detailModalSource,
    "<h3 style={{ margin: 0, color: \"#17324d\" }}>Family Members</h3>",
    "Data Privacy Acknowledgement",
    "Data Privacy Acknowledgement must render after Family Members.",
  );
  assert.match(
    detailModalSource,
    /\{showDataPrivacyAcknowledgement \? \([\s\S]*Data Privacy Acknowledgement[\s\S]*dataPrivacyAcknowledgementItems\.map/,
  );
});

test("DP-HD-03 data privacy acknowledgement contains only privacy acknowledgement labels", () => {
  const dataPrivacyItemsMatch = detailModalSource.match(
    /const dataPrivacyAcknowledgementItems = \[[\s\S]*?\];/,
  );
  const sectionMatch = detailModalSource.match(
    /\{showDataPrivacyAcknowledgement \? \([\s\S]*?<section style=\{shellStyles\.card\}>[\s\S]*?<\/section>\s*\) : null\}/,
  );

  assert.ok(
    dataPrivacyItemsMatch,
    "Data privacy acknowledgement items were not found",
  );
  assert.ok(sectionMatch, "Data Privacy Acknowledgement section was not found");

  const dataPrivacyItemsSource = dataPrivacyItemsMatch[0];
  const sectionSource = sectionMatch[0];

  [
    "Privacy Acknowledgement",
    "Privacy Notice Version",
    "Acknowledged On",
  ].forEach((label) => {
    assert.match(dataPrivacyItemsSource, new RegExp(label));
  });
  assert.match(sectionSource, /Data Privacy Acknowledgement/);

  ["Sync Status", "Recorded Offline"].forEach((label) => {
    assert.doesNotMatch(dataPrivacyItemsSource, new RegExp(label));
    assert.doesNotMatch(sectionSource, new RegExp(label));
  });
});

test("DP-HD-04 normal Barangay and MSWDO details opt in to privacy but keep administrative metadata off", () => {
  assert.match(
    barangayMasterlistSource,
    /<HouseholdDetailModal[\s\S]*showAdministrativeMetadata=\{false\}[\s\S]*showDataPrivacyAcknowledgement=\{true\}/,
  );
  assert.match(
    mswdoMasterlistSource,
    /<HouseholdDetailModal[\s\S]*showAdministrativeMetadata=\{false\}[\s\S]*showDataPrivacyAcknowledgement=\{true\}/,
  );
});

test("DP-HD-05 possible-match details explicitly opt out of the privacy section", () => {
  assert.match(
    registerModalSource,
    /<HouseholdDetailModal[\s\S]*isOpen=\{Boolean\(viewingSuggestedHouseholdId\)\}[\s\S]*showAdministrativeMetadata=\{false\}[\s\S]*showDataPrivacyAcknowledgement=\{false\}/,
  );
});
