const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");

const {
  isCurrentlyPresentEvacuationAttendance,
} = require("../src/utils/reliefPackEligibility");

const automaticClaimSource = fs.readFileSync(
  require.resolve("../src/services/automaticReliefPackClaim.service"),
  "utf8",
);
const distributionSource = fs.readFileSync(
  require.resolve("../src/services/distributionTransaction.service"),
  "utf8",
);

test("relief-pack attendance accepts only PRESENT records without a timeout", () => {
  assert.equal(
    isCurrentlyPresentEvacuationAttendance({
      status: "PRESENT",
      time_in: "2026-08-28T08:00:00.000Z",
      time_out: null,
    }),
    true,
  );

  for (const attendance of [
    null,
    { status: "LEFT", time_in: "2026-08-28T08:00:00.000Z", time_out: null },
    {
      status: "ARRIVED",
      time_in: "2026-08-28T08:00:00.000Z",
      time_out: null,
    },
    {
      status: "TRANSFERRED",
      time_in: "2026-08-28T08:00:00.000Z",
      time_out: null,
    },
    {
      status: "PRESENT",
      time_in: "2026-08-28T08:00:00.000Z",
      time_out: "2026-08-28T12:00:00.000Z",
    },
    { status: "", time_in: "2026-08-28T08:00:00.000Z", time_out: null },
  ]) {
    assert.equal(
      isCurrentlyPresentEvacuationAttendance(attendance),
      false,
      `attendance ${JSON.stringify(attendance)} should not qualify`,
    );
  }
});

test("automatic and manual relief-pack claim services use the shared attendance predicate", () => {
  assert.match(
    automaticClaimSource,
    /isCurrentlyPresentEvacuationAttendance\(latestAttendance\)/,
  );
  assert.match(
    distributionSource,
    /return isCurrentlyPresentEvacuationAttendance\(latestAttendance\);/,
  );
});
