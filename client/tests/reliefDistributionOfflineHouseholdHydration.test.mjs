import assert from "node:assert/strict";
import test from "node:test";

import {
  hydrateStubDetailsWithCachedHousehold,
} from "../src/features/stubs/offlineHouseholdHydrationCore.js";

const makeCachedRow = ({ id, firstName, lastName, photo }) => ({
  offline_household_details: {
    household: {
      id,
      family_head_first_name: firstName,
      family_head_last_name: lastName,
      household_size: 2,
      contact_number: `09${id}`,
      disaster_event_title: "Test Event",
      barangay_name: "Test Barangay",
      family_head_photo_data_url: photo,
    },
    members: [{ full_name: `${firstName} ${lastName}`, is_family_head: true }],
    household_sectors: [{ id: `${id}-sector`, code: "PWD" }],
    latest_attendance: { status: "PRESENT", time_in: "2026-09-06T08:00:00Z" },
  },
});

const makeStub = (id) => ({
  id: `stub-${id}`,
  household_id: id,
  disaster_event_id: "event-1",
  barangay_id: "barangay-1",
  household: { id, family_head_name: "Summary Name", members: [] },
  disaster_event: { id: "event-1", name: "Summary Event" },
  barangay: { id: "barangay-1", name: "Summary Barangay" },
  display_stub_no: `STUB#${id}`,
  qr_code_value: `qr-${id}`,
});

test("offline relief details hydrate the matching cached household and photo", () => {
  const hydrated = hydrateStubDetailsWithCachedHousehold(
    makeStub("household-a"),
    makeCachedRow({
      id: "household-a",
      firstName: "Alex",
      lastName: "Reyes",
      photo: "data:image/jpeg;base64,photo-a",
    }),
  );

  assert.equal(hydrated.household.id, "household-a");
  assert.equal(hydrated.household.family_head_name, "Alex Reyes");
  assert.equal(hydrated.household.contact_number, "09household-a");
  assert.equal(hydrated.household.family_head_photo_url, "data:image/jpeg;base64,photo-a");
  assert.equal(hydrated.household.members_count, 2);
  assert.equal(hydrated.household_sectors[0].code, "PWD");
  assert.equal(hydrated.latest_attendance.status, "PRESENT");
  assert.equal(hydrated.display_stub_no, "STUB#household-a");
  assert.equal(hydrated.qr_code_value, "qr-household-a");
});

test("offline relief hydration is household-identity based, never name based", () => {
  const stubA = makeStub("household-a");
  const stubB = makeStub("household-b");
  stubA.household.family_head_name = "Same Name";
  stubB.household.family_head_name = "Same Name";

  const hydratedA = hydrateStubDetailsWithCachedHousehold(
    stubA,
    makeCachedRow({
      id: "household-a",
      firstName: "Photo",
      lastName: "A",
      photo: "data:image/jpeg;base64,photo-a",
    }),
  );
  const hydratedB = hydrateStubDetailsWithCachedHousehold(
    stubB,
    makeCachedRow({
      id: "household-b",
      firstName: "Photo",
      lastName: "B",
      photo: "data:image/jpeg;base64,photo-b",
    }),
  );

  assert.equal(hydratedA.household.family_head_photo_url, "data:image/jpeg;base64,photo-a");
  assert.equal(hydratedB.household.family_head_photo_url, "data:image/jpeg;base64,photo-b");
  assert.notEqual(hydratedB.household.family_head_photo_url, hydratedA.household.family_head_photo_url);
});
