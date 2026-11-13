import test from "node:test";
import assert from "node:assert/strict";
import {
  LOCAL_DUPLICATE_HOUSEHOLD_REGISTRATION_CODE,
  buildLocalDuplicateCandidates,
  buildLocalDuplicateRegistrationError,
  classifyDuplicateMatch,
  runLocalDuplicatePreflight,
} from "../src/features/household-registration/localDuplicatePreflight.js";

const basePayload = {
  disaster_event_id: "event-a",
  barangay_id: "barangay-a",
  contact_number: "+639171234567",
  family_head: {
    first_name: "Maria",
    middle_name: "Santos",
    last_name: "Reyes",
    suffix: null,
    sex: "FEMALE",
    age_value: 42,
    age_unit: "YEARS",
  },
  members: [
    {
      first_name: "Juan",
      middle_name: "",
      last_name: "Reyes",
      suffix: null,
      sex: "MALE",
      age_value: 17,
      age_unit: "YEARS",
      relationship_to_head: "SON",
    },
  ],
};

const buildCachedRow = (overrides = {}) => ({
  household_id: "household-1",
  family_head_name: "Maria Santos Reyes",
  is_active: true,
  registered_at: "2026-08-08T01:00:00.000Z",
  local_duplicate_profile: {
    household_id: "household-1",
    disaster_event_id: "event-a",
    barangay_id: "barangay-a",
    barangay_name: "Barangay A",
    contact_number: "+639171234567",
    household_size: 2,
    family_head: {
      first_name: " Maria ",
      middle_name: "Santos",
      last_name: "Reyes",
      suffix: null,
      sex: "FEMALE",
      age_value: 42,
      age_unit: "YEARS",
    },
    members: [
      {
        first_name: "Juan",
        middle_name: null,
        last_name: "Reyes",
        suffix: null,
        sex: "MALE",
        age_value: 17,
        age_unit: "YEARS",
        relationship_to_head: "SON",
      },
    ],
    ...overrides.profile,
  },
  ...overrides.row,
});

const buildPendingEntry = (overrides = {}) => ({
  id: "client-sync-1",
  status: "PENDING",
  moduleName: "barangay-households",
  actionKey: "HOUSEHOLD_REGISTER",
  entityType: "HOUSEHOLD",
  entityLocalId: "local-household-1",
  clientTimestamp: "2026-08-08T02:00:00.000Z",
  payload: basePayload,
  ...overrides,
});

test("M03-01 cached same-event household high-confidence duplicate is detected", () => {
  const result = runLocalDuplicatePreflight({
    payload: basePayload,
    cachedHouseholds: [buildCachedRow()],
    syncQueueEntries: [],
  });

  assert.equal(result.hasHighConfidenceDuplicate, true);
  assert.equal(result.candidates[0].source_type, "cached");
  assert.equal(result.candidates[0].match_confidence, "HIGH");
});

test("M03-02 pending HOUSEHOLD_REGISTER duplicate is detected before a second queue item", () => {
  const result = runLocalDuplicatePreflight({
    payload: basePayload,
    cachedHouseholds: [],
    syncQueueEntries: [buildPendingEntry()],
  });

  assert.equal(result.hasHighConfidenceDuplicate, true);
  assert.equal(result.candidates[0].source_type, "pending");
  assert.equal(result.candidates[0].client_sync_id, "client-sync-1");
});

test("M03-03 cross-event candidate does not block local registration", () => {
  const result = runLocalDuplicatePreflight({
    payload: { ...basePayload, disaster_event_id: "event-b" },
    cachedHouseholds: [buildCachedRow()],
    syncQueueEntries: [buildPendingEntry()],
  });

  assert.equal(result.hasHighConfidenceDuplicate, false);
  assert.equal(result.sourceCoverage.cachedHouseholds, 0);
  assert.equal(result.sourceCoverage.pendingHouseholdRegistrations, 0);
});

test("M03-04 different barangay candidate does not contaminate the local preflight", () => {
  const result = runLocalDuplicatePreflight({
    payload: { ...basePayload, barangay_id: "barangay-b" },
    cachedHouseholds: [buildCachedRow()],
    syncQueueEntries: [buildPendingEntry()],
  });

  assert.equal(result.hasHighConfidenceDuplicate, false);
  assert.equal(result.sourceCoverage.cachedHouseholds, 0);
  assert.equal(result.sourceCoverage.pendingHouseholdRegistrations, 0);
});

test("M03-06 valid offline registration has no blocking local duplicate", () => {
  const result = runLocalDuplicatePreflight({
    payload: {
      ...basePayload,
      family_head: {
        ...basePayload.family_head,
        first_name: "Ana",
        last_name: "Cruz",
      },
      contact_number: "+639181111111",
      members: [],
    },
    cachedHouseholds: [buildCachedRow()],
    syncQueueEntries: [buildPendingEntry()],
  });

  assert.equal(result.hasHighConfidenceDuplicate, false);
});

test("M03-07 self-exclusion ignores the same pending client_sync_id only", () => {
  const candidates = buildLocalDuplicateCandidates({
    payload: basePayload,
    cachedHouseholds: [],
    syncQueueEntries: [
      buildPendingEntry({ id: "client-sync-1" }),
      buildPendingEntry({ id: "client-sync-2" }),
    ],
    excludeClientSyncId: "client-sync-1",
  });

  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].client_sync_id, "client-sync-2");
});

test("M03-20 local matching mirrors same extended-name high confidence", () => {
  const result = classifyDuplicateMatch({
    sourcePerson: basePayload.family_head,
    matchedPerson: {
      ...basePayload.family_head,
      first_name: "  MARIA",
      last_name: "Reyes  ",
    },
    sourceRole: "FAMILY_HEAD",
    matchedRole: "FAMILY_HEAD",
  });

  assert.equal(result.match_confidence, "HIGH");
  assert.equal(result.is_strong_match, true);
});

test("M03-21 local matching mirrors same sex plus age high confidence", () => {
  const result = classifyDuplicateMatch({
    sourcePerson: basePayload.family_head,
    matchedPerson: {
      ...basePayload.family_head,
      middle_name: "Different",
      suffix: "Jr",
    },
    sourceRole: "MEMBER",
    matchedRole: "MEMBER",
  });

  assert.equal(result.match_confidence, "HIGH");
  assert.equal(result.is_strong_match, true);
});

test("M03-22 local matching mirrors family-head contact high confidence", () => {
  const result = classifyDuplicateMatch({
    sourcePerson: {
      ...basePayload.family_head,
      middle_name: "Different",
      age_value: 50,
      contact_number: "+639171234567",
    },
    matchedPerson: {
      ...basePayload.family_head,
      middle_name: "",
      age_value: 42,
    },
    sourceRole: "FAMILY_HEAD",
    matchedRole: "FAMILY_HEAD",
    sourceContactNumber: "+639171234567",
    matchedContactNumber: "639171234567",
  });

  assert.equal(result.match_confidence, "HIGH");
  assert.equal(result.is_strong_match, true);
});

test("M03-23 same first and last without strong factors remains possible only", () => {
  const result = classifyDuplicateMatch({
    sourcePerson: basePayload.family_head,
    matchedPerson: {
      ...basePayload.family_head,
      middle_name: "Different",
      sex: "MALE",
      age_value: 20,
    },
    sourceRole: "MEMBER",
    matchedRole: "MEMBER",
  });

  assert.equal(result.match_confidence, "POSSIBLE");
  assert.equal(result.is_strong_match, false);
});

test("M03-24 local duplicate error keeps the authoritative server duplicate code", () => {
  const error = buildLocalDuplicateRegistrationError({
    source_type: "pending",
    household_id: "local-household-1",
  });

  assert.equal(error.statusCode, 409);
  assert.equal(error.code, LOCAL_DUPLICATE_HOUSEHOLD_REGISTRATION_CODE);
  assert.match(error.message, /pending offline registration/);
});
