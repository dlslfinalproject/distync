import test from "node:test";
import assert from "node:assert/strict";

import { sanitizeHouseholdUpdatePayload } from "../src/features/household-registration/householdEditProtection.js";

test("sanitizeHouseholdUpdatePayload removes protected family-head fields from edit payloads", () => {
  const sanitizedPayload = sanitizeHouseholdUpdatePayload({
    household_id: "household-1",
    disaster_event_id: "event-1",
    barangay_id: "barangay-1",
    residency_status: "RESIDENT",
    evacuation_center_id: "center-1",
    current_stay_type: "EVAC_CENTER",
    contact_number: "+639171234567",
    current_address_details: "Poblacion",
    family_head: {
      first_name: "Ana",
      last_name: "Dela Cruz",
      sex: "FEMALE",
    },
    family_head_photo_url: "data:image/jpeg;base64,abc",
    photo_verification_notes: "Protected",
    household_size: 2,
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
    household_sector_ids: ["household-sector-1"],
    privacy_acknowledgment: null,
  });

  assert.deepEqual(sanitizedPayload, {
    disaster_event_id: "event-1",
    barangay_id: "barangay-1",
    residency_status: "RESIDENT",
    evacuation_center_id: "center-1",
    current_stay_type: "EVAC_CENTER",
    contact_number: "+639171234567",
    current_address_details: "Poblacion",
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
    household_sector_ids: ["household-sector-1"],
    privacy_acknowledgment: null,
  });
});
