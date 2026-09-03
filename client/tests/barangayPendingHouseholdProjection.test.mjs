import assert from "node:assert/strict";
import test from "node:test";

import { buildQueuedHouseholdRow } from "../src/features/masterlist/barangayMasterlistUi.js";

const sectorOptions = [
  { id: "adult-id", source_sector_id: "adult-id", code: "ADULT", name: "Adult" },
  { id: "toddler-id", source_sector_id: "toddler-id", code: "TODDLER", name: "Toddler" },
  {
    id: "senior-id",
    source_sector_id: "senior-id",
    code: "SENIOR_CITIZEN",
    name: "Senior Citizen",
  },
  { id: "pwd-id", source_sector_id: "pwd-id", code: "PWD", name: "Persons with Disabilities" },
];

const buildEntry = (payload, status = "PENDING") => ({
  id: "sync-1",
  entityLocalId: "local-1",
  actionKey: "HOUSEHOLD_REGISTER",
  status,
  clientTimestamp: "2026-09-03T08:22:00.000Z",
  payload: {
    disaster_event_id: "event-1",
    barangay_id: "barangay-1",
    ...payload,
  },
});

test("pending head-only registration projects household size and head sectors", () => {
  const row = buildQueuedHouseholdRow(
    buildEntry({
      family_head: { first_name: "Anne", last_name: "Curtis", sector_ids: ["adult-id"] },
      members: [],
      household_size: 1,
    }),
    "Santiago",
    sectorOptions,
  );

  assert.equal(row.members_count, 1);
  assert.equal(row.sectors_text, "Adult");
});

test("pending household size is the family head plus submitted members", () => {
  for (const memberCount of [1, 2, 5]) {
    const row = buildQueuedHouseholdRow(
      buildEntry({
        family_head: { first_name: "Head", last_name: "Family", sector_ids: [] },
        members: Array.from({ length: memberCount }, (_, index) => ({
          first_name: `Member${index + 1}`,
          last_name: "Family",
          sector_ids: [],
        })),
        household_size: memberCount + 1,
      }),
      "Santiago",
      sectorOptions,
    );

    assert.equal(row.members_count, memberCount + 1);
  }
});

test("pending registration projects valid members and deduplicated sectors", () => {
  const row = buildQueuedHouseholdRow(
    buildEntry({
      family_head: { first_name: "Toni", last_name: "Gonzaga", sector_ids: ["adult-id"] },
      members: [
        { first_name: "Polly", last_name: "Gonzaga", sector_ids: ["toddler-id"] },
        { first_name: "", last_name: "", sector_ids: ["pwd-id"] },
        { first_name: "Sam", last_name: "Gonzaga", sector_ids: ["adult-id", "senior-id", "pwd-id"] },
      ],
      household_sector_ids: [],
      household_size: 3,
    }),
    "Santiago",
    sectorOptions,
  );

  assert.equal(row.members_count, 3);
  assert.equal(row.sectors_text, "Toddler, Adult, Senior Citizen, Persons with Disabilities");
});

test("pending derived fields remain the same across sync statuses", () => {
  const payload = {
    family_head: { first_name: "Toni", last_name: "Gonzaga", sector_ids: ["adult-id"] },
    members: [{ first_name: "Polly", last_name: "Gonzaga", sector_ids: ["toddler-id"] }],
    household_size: 2,
  };
  const pending = buildQueuedHouseholdRow(buildEntry(payload, "PENDING"), "Santiago", sectorOptions);
  const synced = buildQueuedHouseholdRow(buildEntry(payload, "SYNCED"), "Santiago", sectorOptions);

  assert.equal(pending.members_count, synced.members_count);
  assert.equal(pending.sectors_text, synced.sectors_text);
});
