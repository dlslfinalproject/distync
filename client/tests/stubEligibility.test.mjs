import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

import { isCurrentlyPresentStubRow } from "../src/features/stubs/stubEligibility.js";

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

  assert.match(cache, /latest_attendance_status/);
  assert.match(cache, /latest_attendance_time_out/);
});
