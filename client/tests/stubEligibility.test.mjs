import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

import {
  getStubClaimUnavailableMessage,
  getStubPresenceState,
  isCurrentlyPresentStubRow,
} from "../src/features/stubs/stubEligibility.js";

const readSource = async (relativePath) =>
  fs.readFile(new URL(relativePath, import.meta.url), "utf8");

test("stub attendance eligibility accepts only a current PRESENT record", () => {
  assert.equal(
    isCurrentlyPresentStubRow({
      latest_attendance_status: "PRESENT",
      latest_attendance_time_out: null,
    }),
    true,
  );
  assert.equal(
    isCurrentlyPresentStubRow({ latest_attendance_status: "LEFT" }),
    false,
  );
  assert.equal(
    isCurrentlyPresentStubRow({ latest_attendance_status: "TRANSFERRED" }),
    false,
  );
  assert.equal(
    isCurrentlyPresentStubRow({
      latest_attendance_status: "PRESENT",
      latest_attendance_time_out: "2026-08-28T02:00:00.000Z",
    }),
    false,
  );
  assert.equal(isCurrentlyPresentStubRow({}), false);
});

test("stub claim feedback distinguishes absence, unknown presence, and other blockers", () => {
  const presentRowBlockedForAnotherReason = {
    family_head_name: "Maria Santos",
    latest_attendance_status: "PRESENT",
    latest_attendance_time_out: null,
    presentation_status: "NOT_PRESENT",
  };
  const absentRow = {
    family_head_name: "Juan Dela Cruz",
    latest_attendance_status: "LEFT",
    latest_attendance_time_out: "2026-09-26T02:00:00.000Z",
  };
  const unknownRow = { family_head_name: "Ana Reyes" };
  const archivedRow = {
    family_head_name: "Pedro Garcia",
    is_active: false,
    latest_attendance_status: "PRESENT",
    latest_attendance_time_out: null,
  };

  assert.equal(getStubPresenceState(presentRowBlockedForAnotherReason), "PRESENT");
  assert.match(
    getStubClaimUnavailableMessage(presentRowBlockedForAnotherReason),
    /^Maria Santos: This relief stub is not currently available to claim\./,
  );
  assert.doesNotMatch(
    getStubClaimUnavailableMessage(presentRowBlockedForAnotherReason),
    /not currently present/i,
  );

  assert.equal(getStubPresenceState(absentRow), "ABSENT");
  assert.match(
    getStubClaimUnavailableMessage(absentRow),
    /^Juan Dela Cruz: This household is not currently present in the evacuation center for this disaster event\./,
  );

  assert.equal(getStubPresenceState(unknownRow), "UNKNOWN");
  assert.match(
    getStubClaimUnavailableMessage(unknownRow),
    /^Ana Reyes: Current evacuation presence could not be confirmed\./,
  );
  assert.doesNotMatch(
    getStubClaimUnavailableMessage(unknownRow),
    /not currently present/i,
  );

  assert.match(
    getStubClaimUnavailableMessage(archivedRow),
    /^Pedro Garcia: This household is archived/,
  );
});

test("Barangay and MSWDO claim controls require both ISSUED and current PRESENT attendance", async () => {
  const [barangayPage, mswdoPage, barangayTable, mswdoTable, cache] =
    await Promise.all([
      readSource("../src/pages/barangay/StubDistributionPage.jsx"),
      readSource("../src/pages/mswdo/StubDistributionPage.jsx"),
      readSource("../src/components/stubs/StubResultsTable.jsx"),
      readSource("../src/components/stubs/MswdoStubResultsTable.jsx"),
      readSource("../src/features/stubs/stubCache.js"),
    ]);

  for (const source of [barangayPage, mswdoPage, barangayTable, mswdoTable]) {
    assert.match(source, /isCurrentlyPresentStubRow/);
    assert.match(source, /row\??\.status === "ISSUED"/);
  }

  assert.match(barangayPage, /HOUSEHOLD_NOT_PRESENT_IN_EVAC_CENTER/);
  assert.match(mswdoPage, /HOUSEHOLD_NOT_PRESENT_IN_EVAC_CENTER/);
  assert.match(mswdoPage, /getStubClaimUnavailableMessage\(selectedRow\)/);
  assert.match(mswdoPage, /getStubClaimUnavailableMessage\(blockedRow\)/);
  assert.match(mswdoTable, /getStubClaimUnavailableMessage\(row\)/);
  assert.doesNotMatch(
    `${mswdoPage}\n${mswdoTable}`,
    /Only households currently present in the evacuation center can receive a relief distribution\./,
  );
  assert.match(mswdoTable, /role="alert"/);

  assert.match(cache, /latest_attendance_status/);
  assert.match(cache, /latest_attendance_time_out/);
});
