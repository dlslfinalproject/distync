const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");

const {
  isCurrentlyPresentEvacuationAttendance,
  isReliefPackClaimHouseholdCurrentlyEligible,
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

test("relief-pack claim eligibility also requires an active evacuation-center household", () => {
  const presentAttendance = {
    status: "PRESENT",
    time_in: "2026-08-28T08:00:00.000Z",
    time_out: null,
  };

  assert.equal(
    isReliefPackClaimHouseholdCurrentlyEligible(
      { is_active: true, current_stay_type: "EVAC_CENTER" },
      presentAttendance,
    ),
    true,
  );

  for (const stub of [
    { is_active: false, current_stay_type: "EVAC_CENTER" },
    { is_active: true, current_stay_type: "RELATIVES" },
    { is_active: true, current_stay_type: "" },
  ]) {
    assert.equal(
      isReliefPackClaimHouseholdCurrentlyEligible(stub, presentAttendance),
      false,
      `stub ${JSON.stringify(stub)} should not qualify`,
    );
  }
});

test("automatic and manual relief-pack claim services use the shared attendance predicate", () => {
  assert.match(
    automaticClaimSource,
    /isReliefPackClaimHouseholdCurrentlyEligible\(stub, latestAttendance\)/,
  );
  assert.match(
    distributionSource,
    /isReliefPackClaimHouseholdCurrentlyEligible\(stub, latestAttendance\)/,
  );
});
