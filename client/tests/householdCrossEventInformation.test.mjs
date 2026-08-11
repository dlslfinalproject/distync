import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { getActiveCrossEventTitles } from "../src/features/household-registration/crossEventInformation.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const readClientSource = (relativePath) =>
  readFileSync(resolve(__dirname, "..", relativePath), "utf8");

test("active cross-event information extracts event titles for post-success modal", () => {
  const titles = getActiveCrossEventTitles(
    {
      data: {
        active_cross_event_information: {
          has_active_cross_event_match: true,
          active_disaster_events: [
            {
              disaster_event_title: "Typhoon Quiapo",
            },
          ],
        },
      },
    },
  );

  assert.deepEqual(titles, ["Typhoon Quiapo"]);
});

test("multiple active cross-event titles are listed without backend identifiers", () => {
  const titles = getActiveCrossEventTitles(
    {
      data: {
        active_cross_event_information: {
          has_active_cross_event_match: true,
          active_disaster_events: [
            {
              disaster_event_title: "Typhoon Quiapo",
              disaster_event_id: "11111111-1111-4111-8111-111111111111",
            },
            {
              disaster_event_title: "Typhoon Example",
              disaster_event_id: "22222222-2222-4222-8222-222222222222",
            },
            {
              disaster_event_title: "Typhoon Quiapo",
              disaster_event_id: "33333333-3333-4333-8333-333333333333",
            },
          ],
        },
      },
    },
  );

  assert.deepEqual(titles, ["Typhoon Quiapo", "Typhoon Example"]);
  assert.ok(titles.every((title) => !/11111111|22222222/.test(title)));
});

test("completed or absent cross-event metadata produces no extra notice", () => {
  assert.deepEqual(getActiveCrossEventTitles({ data: {} }), []);
  assert.deepEqual(
    getActiveCrossEventTitles({ data: { active_cross_event_information: null } }),
    [],
  );
  assert.deepEqual(
    getActiveCrossEventTitles(
      {
        data: {
          active_cross_event_information: {
            has_active_cross_event_match: false,
            active_disaster_events: [],
          },
        },
      },
    ),
    [],
  );
});

test("Barangay and MSWDO masterlists route cross-event info to the shared modal", () => {
  const barangayPageSource = readClientSource(
    "src/pages/barangay/BarangayMasterlistPage.jsx",
  );
  const hookSource = readClientSource(
    "src/features/mswdo-masterlist/useMswdoMasterlistPage.js",
  );
  const pageSource = readClientSource("src/pages/mswdo/ConsolidatedMasterlistPage.jsx");
  const modalSource = readClientSource(
    "src/components/masterlist/ActiveCrossEventInformationModal.jsx",
  );

  assert.match(
    hookSource,
    /import \{ getActiveCrossEventTitles \} from "\.\.\/household-registration\/crossEventInformation";/,
  );
  assert.match(
    hookSource,
    /setActiveCrossEventModalTitles\(getActiveCrossEventTitles\(response\)\)/,
  );
  assert.match(
    hookSource,
    /mode: "edit"[\s\S]*?setAttendanceActionMessage\(""\);[\s\S]*?setActiveCrossEventModalTitles\(\[\]\);/,
  );
  assert.match(barangayPageSource, /<ActiveCrossEventInformationModal/);
  assert.match(pageSource, /<ActiveCrossEventInformationModal/);
  assert.match(modalSource, /FormModalShell/);
  assert.match(modalSource, /Household Registered Successfully/);
  assert.match(modalSource, /Okay/);
  assert.doesNotMatch(modalSource, /Cancel|Continue Registration|Confirm Registration|Retry/);
});

test("cross-event modal follows the Disaster Event duplicate modal proportions without an icon", () => {
  const referenceSource = readClientSource(
    "src/components/disaster-events/DisasterEventFormModal.jsx",
  );
  const modalSource = readClientSource(
    "src/components/masterlist/ActiveCrossEventInformationModal.jsx",
  );

  assert.match(referenceSource, /<p style=\{duplicateErrorTitleStyles\}>Duplicate<\/p>/);
  assert.match(
    referenceSource,
    /Active event with this name already exists\./,
  );
  assert.match(referenceSource, /maxWidth="420px"/);
  assert.match(referenceSource, /width: "48px"[\s\S]*height: "48px"/);
  assert.match(referenceSource, /width: "100%"[\s\S]*minHeight: "40px"/);
  assert.match(referenceSource, /textAlign: "center"/);

  assert.doesNotMatch(modalSource, /import \{ FiInfo \} from "react-icons\/fi";/);
  assert.doesNotMatch(modalSource, /data-modal-icon-variant="information"/);
  assert.doesNotMatch(modalSource, /infoIconStyles/);
  assert.doesNotMatch(modalSource, /aria-hidden="true"[\s\S]*<FiInfo/);
  assert.match(modalSource, /maxWidth="420px"/);
  assert.match(modalSource, /bodyStyle=\{\{ marginTop: 0 \}\}/);
  assert.doesNotMatch(modalSource, /width: "48px"[\s\S]*height: "48px"/);
  assert.doesNotMatch(modalSource, /backgroundColor: "#dbeafe"/);
  assert.doesNotMatch(modalSource, /color: "#2878bf"/);
  assert.doesNotMatch(modalSource, /marginBottom: "14px"/);
  assert.match(modalSource, /textAlign: "center"/);
  assert.match(modalSource, /fontSize: "18px"[\s\S]*fontWeight: 700/);
  assert.match(modalSource, /fontSize: "14px"[\s\S]*lineHeight: 1\.6/);
  assert.match(modalSource, /maxWidth: "320px"/);
  assert.match(modalSource, /width: "100%"[\s\S]*minHeight: "40px"/);
  assert.match(modalSource, /\.\.\.pageHeaderStyles\.primaryButton/);
  assert.doesNotMatch(modalSource, /#c53030|#fee2e2|FiX|role="alert"|aria-live="assertive"/);
});

test("cross-event modal preserves singular and multiple-event content rules", () => {
  const modalSource = readClientSource(
    "src/components/masterlist/ActiveCrossEventInformationModal.jsx",
  );

  assert.match(
    modalSource,
    /This household is also registered under the active disaster event/,
  );
  assert.match(modalSource, /&ldquo;\{safeEventTitles\[0\]\}&rdquo;\./);
  assert.match(
    modalSource,
    /This household is also registered under the following active[\s\S]*disaster events:/,
  );
  assert.match(modalSource, /safeEventTitles\.map\(\(eventTitle\) =>/);
  assert.match(modalSource, /<li key=\{eventTitle\}>\{eventTitle\}<\/li>/);
  assert.doesNotMatch(modalSource, /disaster_event_id|event_id|uuid|code/);
});

test("cross-event modal keeps Okay as the only dismiss action", () => {
  const modalSource = readClientSource(
    "src/components/masterlist/ActiveCrossEventInformationModal.jsx",
  );

  assert.match(modalSource, />\s*Okay\s*</);
  assert.match(modalSource, /onClick=\{onClose\}/);
  assert.match(modalSource, /width: "100%"[\s\S]*minHeight: "40px"/);
  assert.doesNotMatch(
    modalSource,
    /Cancel|Continue Registration|Confirm Registration|fetch\(|axios|apiClient|registerHousehold/,
  );
});
