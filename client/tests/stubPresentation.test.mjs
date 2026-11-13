import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  resolveStubPresentationStatus,
  sortPresentedStubRows,
} from "../src/features/stubs/stubPresentation.js";
import { STATUS_FILTERS, matchesStubStatusFilter } from "../src/features/stubs/stubStatusFilters.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const row = (sequence, status = "ISSUED", overrides = {}) => ({
  id: `stub-${sequence}-${status}`,
  status,
  stub_sequence_no: sequence,
  household_id: `household-${sequence}`,
  household: { id: `household-${sequence}`, is_active: true },
  latest_attendance_status: "PRESENT",
  latest_attendance_time_out: null,
  ...overrides,
});

test("Relief Distribution presentation statuses honor claimed and lifecycle precedence", () => {
  assert.equal(resolveStubPresentationStatus(row(1)), "FOR_CLAIM");
  assert.equal(resolveStubPresentationStatus(row(2, "CLAIMED", {
    household: { is_active: false },
  })), "CLAIMED");
  assert.equal(resolveStubPresentationStatus(row(3, "ISSUED", {
    household: { is_active: false },
  })), "NOT_PRESENT");
  assert.equal(resolveStubPresentationStatus(row(4, "ISSUED", {
    latest_attendance_status: "LEFT",
    latest_attendance_time_out: "2026-09-14T01:00:00.000Z",
  })), "NOT_PRESENT");
});

test("pending persisted HOUSEHOLD_DEPART projects an issued stub to Unclaimed", () => {
  const pendingDeparture = {
    id: "queue-departure-1",
    actionKey: "HOUSEHOLD_DEPART",
    entityType: "HOUSEHOLD",
    entityServerId: "household-7",
    status: "PENDING",
    clientTimestamp: "2026-09-14T01:00:00.000Z",
    payload: {
      disaster_event_id: "event-1",
      barangay_id: "barangay-1",
    },
  };

  assert.equal(
    resolveStubPresentationStatus(
      row(7, "ISSUED"),
      [pendingDeparture],
      { disasterEventId: "event-1", barangayId: "barangay-1" },
    ),
    "NOT_PRESENT",
  );
});

test("presentation sorting uses status priority, numeric sequence, and stable tie breakers", () => {
  const rows = [
    { ...row(10), presentation_status: "FOR_CLAIM" },
    { ...row(2), presentation_status: "FOR_CLAIM" },
    { ...row(1, "CLAIMED"), presentation_status: "CLAIMED" },
    { ...row(3), presentation_status: "NOT_PRESENT" },
  ];

  assert.deepEqual(
    sortPresentedStubRows(rows).map((item) => item.stub_sequence_no),
    [2, 10, 1, 3],
  );
});

test("status filters map presentation statuses without exposing Unclaimed as claimable", () => {
  assert.equal(matchesStubStatusFilter("FOR_CLAIM", STATUS_FILTERS.UNCLAIMED), true);
  assert.equal(matchesStubStatusFilter("CLAIMED", STATUS_FILTERS.UNCLAIMED), false);
  assert.equal(matchesStubStatusFilter("NOT_PRESENT", STATUS_FILTERS.NOT_PRESENT), true);
  assert.equal(matchesStubStatusFilter("ISSUED", STATUS_FILTERS.NOT_PRESENT), false);
});

test("Barangay dropdown exposes the required status order and table blocks Unclaimed claims", async () => {
  const pageSource = await fs.readFile(
    path.join(__dirname, "../src/pages/barangay/StubDistributionPage.jsx"),
    "utf8",
  );
  const tableSource = await fs.readFile(
    path.join(__dirname, "../src/components/stubs/StubResultsTable.jsx"),
    "utf8",
  );

  const options = pageSource.match(/\{ value: STATUS_FILTERS\.[A-Z_]+, label: "[^"]+" \}/g);
  assert.deepEqual(options?.slice(-4), [
    '{ value: STATUS_FILTERS.ALL, label: "All" }',
    '{ value: STATUS_FILTERS.UNCLAIMED, label: "For Claim" }',
    '{ value: STATUS_FILTERS.CLAIMED, label: "Claimed" }',
    '{ value: STATUS_FILTERS.NOT_PRESENT, label: "Unclaimed" }',
  ]);
  assert.match(tableSource, /presentationStatus === "FOR_CLAIM"/);
  assert.match(tableSource, /presentationStatus === "NOT_PRESENT"/);
});
