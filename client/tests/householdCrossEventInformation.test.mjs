import test from "node:test";
import assert from "node:assert/strict";
import { buildActiveCrossEventInfoMessage } from "../src/features/household-registration/crossEventInformation.js";

test("active cross-event information builds non-blocking post-success copy with event titles", () => {
  const message = buildActiveCrossEventInfoMessage(
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
    {
      title: "Typhoon Dolphy",
    },
  );

  assert.equal(
    message,
    'Note: This household is also registered under the active disaster event "Typhoon Quiapo". Records for "Typhoon Dolphy" are maintained separately.',
  );
  assert.doesNotMatch(message, /confirm|continue|cancel|duplicate|failed|uuid/i);
});

test("multiple active cross-event titles are listed without backend identifiers", () => {
  const message = buildActiveCrossEventInfoMessage(
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
          ],
        },
      },
    },
    {
      title: "Typhoon Dolphy",
    },
  );

  assert.equal(
    message,
    "Note: This household is also registered under other active disaster events: Typhoon Quiapo and Typhoon Example. Records remain separate for each event.",
  );
  assert.doesNotMatch(message, /11111111|22222222/);
});

test("completed or absent cross-event metadata produces no extra notice", () => {
  assert.equal(buildActiveCrossEventInfoMessage({ data: {} }, { title: "Event B" }), "");
  assert.equal(
    buildActiveCrossEventInfoMessage(
      { data: { active_cross_event_information: null } },
      { title: "Event B" },
    ),
    "",
  );
  assert.equal(
    buildActiveCrossEventInfoMessage(
      {
        data: {
          active_cross_event_information: {
            has_active_cross_event_match: false,
            active_disaster_events: [],
          },
        },
      },
      { title: "Event B" },
    ),
    "",
  );
});
