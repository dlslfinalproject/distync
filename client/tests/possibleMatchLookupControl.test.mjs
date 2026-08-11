import test from "node:test";
import assert from "node:assert/strict";
import {
  POSSIBLE_MATCH_LOOKUP_DEBOUNCE_MS,
  buildPossibleMatchLookupState,
} from "../src/features/household-registration/possibleMatchLookupControl.js";

const baseInput = {
  householdId: null,
  disasterEventId: "event-1",
  barangayId: "barangay-1",
  registeredBy: "user-1",
  contactNumber: "+639171234567",
  familyHead: {
    first_name: "Juan",
    middle_name: "Santos",
    last_name: "Dela Cruz",
    suffix: "",
    sex: "MALE",
    age_value: "42",
    age_unit: "YEARS",
  },
  members: [],
};

test("PM-LC-01 incomplete identity is not eligible for possible-match lookup", () => {
  const onlyFirstName = buildPossibleMatchLookupState({
    ...baseInput,
    familyHead: {
      ...baseInput.familyHead,
      first_name: "Juan",
      last_name: "",
    },
  });

  assert.equal(onlyFirstName.isEligible, false);
  assert.equal(onlyFirstName.payload, null);
  assert.equal(onlyFirstName.lookupKey, "");
});

test("PM-LC-01B one-letter name plus surname is still too thin for lookup", () => {
  const state = buildPossibleMatchLookupState({
    ...baseInput,
    familyHead: {
      ...baseInput.familyHead,
      first_name: "J",
      last_name: "Dela Cruz",
    },
  });

  assert.equal(state.isEligible, false);
});

test("PM-LC-02 family head first and last name make lookup eligible", () => {
  const state = buildPossibleMatchLookupState(baseInput);

  assert.equal(state.isEligible, true);
  assert.deepEqual(state.eligibleFields, ["family_head"]);
  assert.equal(state.payload.disaster_event_id, "event-1");
  assert.equal(state.payload.barangay_id, "barangay-1");
  assert.equal(state.payload.family_head.first_name, "Juan");
  assert.equal(state.payload.family_head.last_name, "Dela Cruz");
});

test("PM-LC-03 lookup key normalizes whitespace and case for identical identities", () => {
  const firstState = buildPossibleMatchLookupState(baseInput);
  const secondState = buildPossibleMatchLookupState({
    ...baseInput,
    contactNumber: "+63917 123 4567",
    familyHead: {
      ...baseInput.familyHead,
      first_name: "  JUAN",
      middle_name: "Santos ",
      last_name: " dela   cruz ",
    },
  });

  assert.equal(secondState.lookupKey, firstState.lookupKey);
});

test("PM-LC-04 unrelated household fields do not change the lookup key", () => {
  const firstState = buildPossibleMatchLookupState(baseInput);
  const secondState = buildPossibleMatchLookupState({
    ...baseInput,
    household: {
      current_stay_type: "RELATIVES",
      current_address_details: "Purok 2",
      evacuation_center_id: "center-2",
    },
  });

  assert.equal(secondState.lookupKey, firstState.lookupKey);
});

test("PM-LC-05 match-relevant fields change the lookup key", () => {
  const firstState = buildPossibleMatchLookupState(baseInput);
  const changedLastName = buildPossibleMatchLookupState({
    ...baseInput,
    familyHead: {
      ...baseInput.familyHead,
      last_name: "Dela Rosa",
    },
  });
  const changedEvent = buildPossibleMatchLookupState({
    ...baseInput,
    disasterEventId: "event-2",
  });

  assert.notEqual(changedLastName.lookupKey, firstState.lookupKey);
  assert.notEqual(changedEvent.lookupKey, firstState.lookupKey);
});

test("PM-LC-06 member first and last name make member lookup eligible", () => {
  const state = buildPossibleMatchLookupState({
    ...baseInput,
    familyHead: {
      ...baseInput.familyHead,
      first_name: "",
      last_name: "",
    },
    members: [
      {
        first_name: "Maria",
        middle_name: "",
        last_name: "Reyes",
        suffix: "",
        sex: "FEMALE",
        age_value: 12,
        age_unit: "YEARS",
        relationship_option: "DAUGHTER",
      },
    ],
    resolveMemberRelationship: (member) => member.relationship_option,
  });

  assert.equal(state.isEligible, true);
  assert.deepEqual(state.eligibleFields, ["member_0"]);
  assert.equal(state.payload.members[0].relationship_to_head, "DAUGHTER");
});

test("PM-LC-07 debounce duration uses controlled request interval", () => {
  assert.equal(POSSIBLE_MATCH_LOOKUP_DEBOUNCE_MS, 700);
});
