import assert from "node:assert/strict";
import test from "node:test";

import {
  isHouseholdEligibleForReliefPackDemand,
} from "../src/features/relief-pack-templates/reliefPackDemand.js";

const buildHousehold = (overrides = {}) => ({
  is_active: true,
  current_stay_type: "EVAC_CENTER",
  stub: { status: "ISSUED" },
  latest_attendance: {
    status: "PRESENT",
    time_in: "2026-08-28T08:00:00.000Z",
    time_out: null,
  },
  ...overrides,
});

test("relief-pack demand includes an issued stub for a currently present household", () => {
  assert.equal(isHouseholdEligibleForReliefPackDemand(buildHousehold()), true);
});

test("relief-pack demand excludes households without an issued stub", () => {
  assert.equal(
    isHouseholdEligibleForReliefPackDemand(
      buildHousehold({ stub: null }),
    ),
    false,
  );
  assert.equal(
    isHouseholdEligibleForReliefPackDemand(
      buildHousehold({ stub: { status: "CANCELLED" } }),
    ),
    false,
  );
  assert.equal(
    isHouseholdEligibleForReliefPackDemand(
      buildHousehold({ stub: { status: "VOID" } }),
    ),
    false,
  );
  assert.equal(
    isHouseholdEligibleForReliefPackDemand(
      buildHousehold({ stub: { status: "CLAIMED" } }),
    ),
    false,
  );
});

test("relief-pack demand excludes households that are not currently present in an evacuation center", () => {
  assert.equal(
    isHouseholdEligibleForReliefPackDemand(
      buildHousehold({ current_stay_type: "RELATIVES" }),
    ),
    false,
  );
  assert.equal(
    isHouseholdEligibleForReliefPackDemand(
      buildHousehold({ is_active: false }),
    ),
    false,
  );
  assert.equal(
    isHouseholdEligibleForReliefPackDemand(
      buildHousehold({
        latest_attendance: {
          status: "PRESENT",
          time_in: "2026-08-28T08:00:00.000Z",
          time_out: "2026-08-28T12:00:00.000Z",
        },
      }),
    ),
    false,
  );
  assert.equal(
    isHouseholdEligibleForReliefPackDemand(
      buildHousehold({
        latest_attendance: {
          status: "LEFT",
          time_in: "2026-08-28T08:00:00.000Z",
          time_out: null,
        },
      }),
    ),
    false,
  );
});

test("relief-pack demand includes a household again after re-admission creates a new present attendance", () => {
  const householdAfterDeparture = buildHousehold({
    latest_attendance: {
      status: "LEFT",
      time_in: "2026-08-28T08:00:00.000Z",
      time_out: "2026-08-28T12:00:00.000Z",
    },
  });
  const householdAfterReturn = buildHousehold({
    latest_attendance: {
      status: "PRESENT",
      time_in: "2026-08-28T15:00:00.000Z",
      time_out: null,
    },
  });

  assert.equal(
    isHouseholdEligibleForReliefPackDemand(householdAfterDeparture),
    false,
  );
  assert.equal(
    isHouseholdEligibleForReliefPackDemand(householdAfterReturn),
    true,
  );
});

test("relief-pack demand does not treat arrived or timed-in non-present records as eligible", () => {
  assert.equal(
    isHouseholdEligibleForReliefPackDemand(
      buildHousehold({
        latest_attendance: {
          status: "ARRIVED",
          time_in: "2026-08-28T08:00:00.000Z",
          time_out: null,
        },
      }),
    ),
    false,
  );
  assert.equal(
    isHouseholdEligibleForReliefPackDemand(
      buildHousehold({
        latest_attendance: {
          status: "LEFT",
          time_in: "2026-08-28T08:00:00.000Z",
          time_out: null,
        },
      }),
    ),
    false,
  );
});
