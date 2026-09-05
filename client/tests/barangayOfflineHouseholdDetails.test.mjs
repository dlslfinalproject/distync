import assert from "node:assert/strict";
import test from "node:test";

import {
  buildHouseholdDetailsSnapshot,
  buildQueuedHouseholdDetails,
} from "../src/features/masterlist/barangayMasterlistUi.js";

const sectors = [{ id: "pwd-1", code: "PWD", name: "Persons with Disabilities" }];

test("cached masterlist household rows retain a modal-ready detail snapshot", () => {
  const details = buildHouseholdDetailsSnapshot({
    household_id: "household-1",
    family_head_name: "Alex Reyes",
    members: [
      {
        id: "member-1",
        is_family_head: true,
        first_name: "Alex",
        last_name: "Reyes",
      },
    ],
    household_sectors: sectors,
    latest_attendance: { status: "PRESENT", time_in: "2026-09-03T08:00:00Z" },
  });

  assert.equal(details.household.id, "household-1");
  assert.equal(details.household.family_head_first_name, "Alex");
  assert.equal(details.members[0].id, "member-1");
  assert.equal(details.latest_attendance.status, "PRESENT");
});

test("queued CREATE payloads project into view-only modal details", () => {
  const details = buildQueuedHouseholdDetails(
    {
      id: "sync-1",
      entityLocalId: "local-1",
      clientTimestamp: "2026-09-03T08:22:00Z",
      payload: {
        disaster_event_title: "Typhoon Test Event",
        barangay_name: "Barangay Test",
        registered_by: "registrar-1",
        family_head_photo_url: "data:image/jpeg;base64,local-photo",
        family_head: {
          first_name: "Alex",
          last_name: "Reyes",
          sector_ids: ["pwd-1"],
        },
        members: [{ first_name: "Sam", last_name: "Reyes" }],
        household_sector_ids: [],
      },
    },
    sectors,
  );

  assert.equal(details.household.id, "local-1");
  assert.equal(details.household.household_size, 2);
  assert.equal(details.members.length, 2);
  assert.equal(details.members[0].is_family_head, true);
  assert.equal(details.members[0].sectors[0].code, "PWD");
  assert.equal(details.household.disaster_event_title, "Typhoon Test Event");
  assert.equal(details.household.barangay_name, "Barangay Test");
  assert.equal(details.household.registered_by_name, "registrar-1");
  assert.equal(details.household.family_head_photo_data_url, "data:image/jpeg;base64,local-photo");
  assert.equal(details.latest_attendance.time_in, "2026-09-03T08:22:00Z");
});

test("missing queued entries do not fabricate household details", () => {
  assert.equal(buildQueuedHouseholdDetails(null), null);
});
