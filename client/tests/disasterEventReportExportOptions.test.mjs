import test from "node:test";
import assert from "node:assert/strict";

import {
  buildDisasterEventReportExportOptions,
  DISASTER_EVENT_REPORT_EXPORT_SELECTIONS,
  formatDisasterEventReportSelectionValue,
  getDisasterEventReportEmptyMessage,
  parseDisasterEventReportSelectionValue,
} from "../src/features/disaster-events/disasterEventReportExportOptions.mjs";

const sampleEvents = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    event_code: "DE-2026-0001",
    title: "Flood Quiapo",
    start_date: "2026-07-01",
    status: "ACTIVE",
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    event_code: "DE-2026-0002",
    title: "Flood Quiapo",
    start_date: "2026-07-02",
    status: "CLOSED",
  },
  {
    id: "33333333-3333-4333-8333-333333333333",
    event_code: "DE-2026-0003",
    title: "Typhoon Joseph",
    start_date: "2026-07-03",
    status: "ACTIVE",
  },
];

test("export options include aggregate choices before individual disaster events", () => {
  const options = buildDisasterEventReportExportOptions(sampleEvents);

  assert.deepEqual(
    options.slice(0, 3).map((option) => option.value),
    [
      DISASTER_EVENT_REPORT_EXPORT_SELECTIONS.ALL,
      DISASTER_EVENT_REPORT_EXPORT_SELECTIONS.ACTIVE,
      DISASTER_EVENT_REPORT_EXPORT_SELECTIONS.ENDED,
    ],
  );
  assert.equal(options[0].label, "All disaster events");
  assert.equal(options[1].label, "Active disaster events");
  assert.equal(options[2].label, "Ended disaster events");
});

test("individual event labels show only the disaster event title", () => {
  const options = buildDisasterEventReportExportOptions(sampleEvents);
  const floodOptions = options.filter((option) =>
    option.label.startsWith("Flood Quiapo"),
  );

  assert.equal(floodOptions.length, 2);
  assert.deepEqual(
    floodOptions.map((option) => option.value),
    [
      formatDisasterEventReportSelectionValue(sampleEvents[0].id),
      formatDisasterEventReportSelectionValue(sampleEvents[1].id),
    ],
  );
  assert.equal(floodOptions[0].label, "Flood Quiapo");
  assert.equal(floodOptions[1].label, "Flood Quiapo");
  assert.doesNotMatch(floodOptions[0].label, /DE-\d{4}-\d{4}/);
  assert.doesNotMatch(floodOptions[1].label, /DE-\d{4}-\d{4}/);
  assert.doesNotMatch(floodOptions[0].label, /Jul \d{1,2}, \d{4}/);
  assert.doesNotMatch(floodOptions[1].label, /Jul \d{1,2}, \d{4}/);
  assert.doesNotMatch(floodOptions[0].label, /Active|Ended/);
  assert.doesNotMatch(floodOptions[1].label, /Active|Ended/);
});

test("duplicate visible labels still map to different unique internal values", () => {
  const identicalLabelEvents = [
    {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      event_code: "DE-2026-0101",
      title: "Flood Quiapo",
      start_date: "2026-07-01",
      status: "ACTIVE",
    },
    {
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      event_code: "DE-2026-0102",
      title: "Flood Quiapo",
      start_date: "2026-07-01",
      status: "ACTIVE",
    },
  ];

  const options = buildDisasterEventReportExportOptions(identicalLabelEvents);
  const eventOptions = options.slice(3);

  assert.equal(eventOptions[0].label, "Flood Quiapo");
  assert.equal(eventOptions[1].label, "Flood Quiapo");
  assert.notEqual(eventOptions[0].value, eventOptions[1].value);
  assert.equal(
    eventOptions[0].value,
    formatDisasterEventReportSelectionValue(identicalLabelEvents[0].id),
  );
  assert.equal(
    eventOptions[1].value,
    formatDisasterEventReportSelectionValue(identicalLabelEvents[1].id),
  );
});

test("selection parsing distinguishes aggregate filters from individual disaster events", () => {
  assert.deepEqual(
    parseDisasterEventReportSelectionValue(
      DISASTER_EVENT_REPORT_EXPORT_SELECTIONS.ACTIVE,
    ),
    {
      kind: DISASTER_EVENT_REPORT_EXPORT_SELECTIONS.ACTIVE,
      disasterEventId: "",
    },
  );

  assert.deepEqual(
    parseDisasterEventReportSelectionValue(
      formatDisasterEventReportSelectionValue(sampleEvents[2].id),
    ),
    {
      kind: "EVENT",
      disasterEventId: sampleEvents[2].id,
    },
  );
});

test("empty-result messages remain specific for aggregate export selections", () => {
  assert.equal(
    getDisasterEventReportEmptyMessage(
      DISASTER_EVENT_REPORT_EXPORT_SELECTIONS.ACTIVE,
    ),
    "No active disaster events are available for this report.",
  );
  assert.equal(
    getDisasterEventReportEmptyMessage(
      DISASTER_EVENT_REPORT_EXPORT_SELECTIONS.ENDED,
    ),
    "No ended disaster events are available for this report.",
  );
});

test("visible labels do not expose raw UUIDs or backend-oriented identifiers", () => {
  const options = buildDisasterEventReportExportOptions(sampleEvents);
  const individualLabels = options
    .slice(3)
    .map((option) => option.label)
    .join(" | ");

  assert.doesNotMatch(individualLabels, /DE-\d{4}-\d{4}/);
  assert.doesNotMatch(individualLabels, /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i);
  assert.doesNotMatch(individualLabels, /Jul \d{1,2}, \d{4}/);
  assert.doesNotMatch(individualLabels, /Active|Ended/);
  assert.match(individualLabels, /Typhoon Joseph/);
});
