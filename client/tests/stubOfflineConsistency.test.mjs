import test from "node:test";
import assert from "node:assert/strict";

import { deriveStubDashboardMetrics } from "../src/features/stubs/stubDashboardOfflineMetrics.js";
import {
  matchesStubSectorFilter,
  resolveStubSectorIdsForApi,
} from "../src/features/stubs/stubSectorFilters.js";

const PWD_SECTOR_ID = "22222222-2222-4222-8222-222222222222";

test("offline relief distribution metrics are derived from cached issued stubs", () => {
  assert.deepEqual(
    deriveStubDashboardMetrics([
      {
        household_id: "household-1",
        status: "ISSUED",
        presentation_status: "FOR_CLAIM",
      },
      {
        household_id: "household-2",
        status: "CLAIMED",
        presentation_status: "CLAIMED",
      },
      {
        household_id: "household-3",
        status: "ISSUED",
        presentation_status: "NOT_PRESENT",
      },
      {
        household_id: "pending-household",
        status: "ISSUED",
        presentation_status: "FOR_CLAIM",
        is_local_only: true,
      },
    ]),
    {
      total_issued_stubs: 3,
      claimed_stubs: 1,
      unclaimed_stubs: 1,
      beneficiary_families: 3,
    },
  );
});

test("sector filters accept either the UI code or the cached UUID", () => {
  const row = {
    sector_ids: [PWD_SECTOR_ID],
    sector_codes: ["PWD"],
    sectors_text: "Persons with Disabilities",
  };

  assert.equal(matchesStubSectorFilter(row, ["PWD"]), true);
  assert.equal(matchesStubSectorFilter(row, [PWD_SECTOR_ID]), true);
  assert.equal(matchesStubSectorFilter(row, ["SENIOR_CITIZEN"]), false);
});

test("sector filter codes are translated to UUIDs before the dashboard API request", () => {
  assert.deepEqual(
    resolveStubSectorIdsForApi(
      ["PWD"],
      [
        {
          id: "PWD",
          code: "PWD",
          source_sector_id: PWD_SECTOR_ID,
          display_name: "Persons with Disabilities",
        },
      ],
    ),
    [PWD_SECTOR_ID],
  );

  assert.deepEqual(
    resolveStubSectorIdsForApi([PWD_SECTOR_ID], []),
    [PWD_SECTOR_ID],
  );
});
