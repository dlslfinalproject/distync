const test = require("node:test");
const assert = require("node:assert/strict");

const {
  FAMILY_HEAD_INFORMATION_LOCKED_MESSAGE,
  assertNoProtectedFamilyHeadChanges,
  sanitizeHouseholdUpdateRequestData,
} = require("../src/services/householdEditProtection.service");

const EXISTING_HOUSEHOLD = {
  family_head_first_name: "Ana",
  family_head_middle_name: null,
  family_head_last_name: "Dela Cruz",
  family_head_suffix: null,
  family_head_photo_url: "data:image/jpeg;base64,abc",
  photo_verification_notes: "Registered photo",
  family_head_evacuee_id: "head-1",
};

const EXISTING_FAMILY_HEAD_MEMBER = {
  id: "head-1",
  sex: "FEMALE",
  age_value: 34,
  age_unit: "YEARS",
};

const FAMILY_HEAD_SECTOR_ASSIGNMENTS = [
  {
    evacuee_id: "head-1",
    sector_id: "sector-1",
    code: "PWD",
  },
];

test("sanitizeHouseholdUpdateRequestData keeps only editable household fields", () => {
  const sanitizedRequestData = sanitizeHouseholdUpdateRequestData({
    disaster_event_id: "event-1",
    barangay_id: "barangay-1",
    current_stay_type: "EVAC_CENTER",
    family_head: {
      first_name: "Ana",
    },
    family_head_photo_url: "data:image/jpeg;base64,abc",
    members: [
      {
        id: "member-1",
        first_name: "Marco",
        last_name: "Dela Cruz",
        sex: "MALE",
        age_value: 12,
        age_unit: "YEARS",
        relationship_to_head: "SON",
        sector_ids: ["sector-1"],
        is_family_head: true,
      },
    ],
    household_sector_ids: ["condition-1"],
  });

  assert.deepEqual(sanitizedRequestData, {
    disaster_event_id: "event-1",
    barangay_id: "barangay-1",
    current_stay_type: "EVAC_CENTER",
    members: [
      {
        id: "member-1",
        first_name: "Marco",
        last_name: "Dela Cruz",
        sex: "MALE",
        age_value: 12,
        age_unit: "YEARS",
        relationship_to_head: "SON",
        sector_ids: ["sector-1"],
      },
    ],
    household_sector_ids: ["condition-1"],
    privacy_acknowledgment: null,
  });
});

test("assertNoProtectedFamilyHeadChanges allows unchanged legacy family-head payloads", () => {
  assert.doesNotThrow(() =>
    assertNoProtectedFamilyHeadChanges({
      requestData: {
        family_head: {
          first_name: "Ana",
          middle_name: null,
          last_name: "Dela Cruz",
          suffix: null,
          sex: "FEMALE",
          age_value: 34,
          age_unit: "YEARS",
          sector_ids: ["sector-1"],
        },
        family_head_photo_url: "data:image/jpeg;base64,abc",
        photo_verification_notes: "Registered photo",
        members: [],
      },
      existingHousehold: EXISTING_HOUSEHOLD,
      existingFamilyHeadMember: EXISTING_FAMILY_HEAD_MEMBER,
      familyHeadSectorAssignments: FAMILY_HEAD_SECTOR_ASSIGNMENTS,
    }),
  );
});

test("assertNoProtectedFamilyHeadChanges rejects family-head identity changes", () => {
  assert.throws(
    () =>
      assertNoProtectedFamilyHeadChanges({
        requestData: {
          family_head: {
            first_name: "Maria",
            middle_name: null,
            last_name: "Dela Cruz",
            suffix: null,
            sex: "FEMALE",
            age_value: 34,
            age_unit: "YEARS",
            sector_ids: ["sector-1"],
          },
          members: [],
        },
        existingHousehold: EXISTING_HOUSEHOLD,
        existingFamilyHeadMember: EXISTING_FAMILY_HEAD_MEMBER,
        familyHeadSectorAssignments: FAMILY_HEAD_SECTOR_ASSIGNMENTS,
      }),
    {
      message: FAMILY_HEAD_INFORMATION_LOCKED_MESSAGE,
    },
  );
});

test("assertNoProtectedFamilyHeadChanges rejects attempts to edit the family head as a member", () => {
  assert.throws(
    () =>
      assertNoProtectedFamilyHeadChanges({
        requestData: {
          members: [
            {
              id: "head-1",
              first_name: "Ana",
            },
          ],
        },
        existingHousehold: EXISTING_HOUSEHOLD,
        existingFamilyHeadMember: EXISTING_FAMILY_HEAD_MEMBER,
        familyHeadSectorAssignments: FAMILY_HEAD_SECTOR_ASSIGNMENTS,
      }),
    {
      message: FAMILY_HEAD_INFORMATION_LOCKED_MESSAGE,
    },
  );
});
