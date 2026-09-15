import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs/promises";
import {
  resolveStubPresentationStatus,
  sortPresentedStubRows,
} from "../src/features/stubs/stubPresentation.js";
import {
  matchesStubStatusFilter,
  STATUS_FILTERS,
} from "../src/features/stubs/stubStatusFilters.js";

const row = ({ status = "ISSUED", active = true, attendance = "PRESENT", timeOut = null, sequence }) => ({
  id: `stub-${sequence}`,
  status,
  stub_sequence_no: sequence,
  household: { id: `household-${sequence}`, is_active: active },
  latest_attendance_status: attendance,
  latest_attendance_time_out: timeOut,
});

test("MSWDO presentation precedence and required filters classify departed issued stubs as Unclaimed", () => {
  const present = row({ sequence: 2 });
  const claimedDeparted = row({ status: "CLAIMED", active: false, attendance: "LEFT", sequence: 3 });
  const departed = row({ active: false, attendance: "LEFT", sequence: 10 });

  assert.equal(resolveStubPresentationStatus(present), "FOR_CLAIM");
  assert.equal(resolveStubPresentationStatus(row({ status: "CLAIMED", active: true, sequence: 4 })), "CLAIMED");
  assert.equal(resolveStubPresentationStatus(claimedDeparted), "CLAIMED");
  assert.equal(resolveStubPresentationStatus(departed), "NOT_PRESENT");
  assert.equal(matchesStubStatusFilter("FOR_CLAIM", STATUS_FILTERS.UNCLAIMED), true);
  assert.equal(matchesStubStatusFilter("CLAIMED", STATUS_FILTERS.CLAIMED), true);
  assert.equal(matchesStubStatusFilter("NOT_PRESENT", STATUS_FILTERS.NOT_PRESENT), true);
  assert.equal(matchesStubStatusFilter("NOT_PRESENT", STATUS_FILTERS.UNCLAIMED), false);
});

test("MSWDO ordering is status priority followed by numeric stub sequence", () => {
  const rows = [
    { ...row({ active: false, attendance: "LEFT", sequence: 1 }), presentation_status: "NOT_PRESENT" },
    { ...row({ status: "CLAIMED", sequence: 6 }), presentation_status: "CLAIMED" },
    { ...row({ sequence: 10 }), presentation_status: "FOR_CLAIM" },
    { ...row({ sequence: 2 }), presentation_status: "FOR_CLAIM" },
  ];

  assert.deepEqual(
    sortPresentedStubRows(rows).map((item) => [item.presentation_status, item.stub_sequence_no]),
    [["FOR_CLAIM", 2], ["FOR_CLAIM", 10], ["CLAIMED", 6], ["NOT_PRESENT", 1]],
  );
});

test("MSWDO exposes all required labels and blocks Unclaimed rows in the UI paths", async () => {
  const page = await fs.readFile(new URL("../src/pages/mswdo/StubDistributionPage.jsx", import.meta.url), "utf8");
  const table = await fs.readFile(new URL("../src/components/stubs/MswdoStubResultsTable.jsx", import.meta.url), "utf8");

  for (const label of ["All", "For Claim", "Claimed", "Unclaimed"]) assert.match(page, new RegExp(`label: "${label}"`));
  assert.match(table, /presentation_status === STUB_PRESENTATION_STATUSES\.FOR_CLAIM/);
  assert.match(table, /presentation_status === STUB_PRESENTATION_STATUSES\.NOT_PRESENT/);
});
