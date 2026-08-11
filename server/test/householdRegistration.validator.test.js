const test = require("node:test");
const assert = require("node:assert/strict");

const {
  validateAndNormalizeHouseholdRegistrationPayload,
  validateCreateHouseholdRegistration,
  validateDuplicateRegistrationSuggestions,
  validateGetHouseholdDetails,
  validateUpdateHouseholdDetails,
} = require("../src/validators/householdRegistration.validator");
const {
  HOUSEHOLD_PRIVACY_NOTICE_VERSION,
} = require("../src/config/privacyNotice");

const VALID_UUIDS = {
  disasterEventId: "11111111-1111-4111-8111-111111111111",
  barangayId: "22222222-2222-4222-8222-222222222222",
  evacuationCenterId: "33333333-3333-4333-8333-333333333333",
  registeredBy: "44444444-4444-4444-8444-444444444444",
  householdId: "55555555-5555-4555-8555-555555555555",
  evacuationLogId: "66666666-6666-4666-8666-666666666666",
};

const buildValidPayload = () => ({
  disaster_event_id: VALID_UUIDS.disasterEventId,
  barangay_id: VALID_UUIDS.barangayId,
  residency_status: "RESIDENT",
  evacuation_center_id: VALID_UUIDS.evacuationCenterId,
  family_head: {
    first_name: "Ana",
    middle_name: null,
    last_name: "Dela Cruz",
    suffix: null,
    sex: "FEMALE",
    age_value: 34,
    age_unit: "YEARS",
    sector_ids: [],
  },
  current_stay_type: "EVAC_CENTER",
  household_size: 2,
  registered_by: VALID_UUIDS.registeredBy,
  contact_number: "+639171234567",
  current_address_details: "Poblacion, Malvar, Batangas",
  family_head_photo_url: "data:image/jpeg;base64,ZmFrZQ==",
  photo_verification_notes: "Verified during registration.",
  members: [
    {
      id: null,
      first_name: "Marco",
      middle_name: null,
      last_name: "Dela Cruz",
      suffix: null,
      sex: "MALE",
      age_value: 12,
      age_unit: "YEARS",
      relationship_to_head: "SON",
      sector_ids: [],
    },
  ],
  household_sector_ids: [],
  privacy_acknowledgment: {
    consent_status: "ACKNOWLEDGED",
    notice_version: HOUSEHOLD_PRIVACY_NOTICE_VERSION,
    acknowledged_at: "2026-07-30T09:15:00.000Z",
    acknowledged_by_name: "Ana Dela Cruz",
    representative_relationship: null,
    device_id: null,
    is_offline_encoded: false,
    sync_status: "SYNCED",
  },
});

const runMiddleware = async (
  middleware,
  { body = {}, params = {}, query = {} } = {},
) => {
  const req = { body, params, query };
  const result = {
    statusCode: 200,
    jsonPayload: null,
    nextCalled: false,
    req,
  };
  const res = {
    status(code) {
      result.statusCode = code;
      return this;
    },
    json(payload) {
      result.jsonPayload = payload;
      return this;
    },
  };

  await new Promise((resolve) => {
    middleware(req, res, () => {
      result.nextCalled = true;
      resolve();
    });

    if (!result.nextCalled && result.jsonPayload) {
      resolve();
    }
  });

  return result;
};

test("create validation rejects missing privacy acknowledgment", async () => {
  const payload = buildValidPayload();
  delete payload.privacy_acknowledgment;

  const result = await runMiddleware(validateCreateHouseholdRegistration, {
    body: payload,
  });

  assert.equal(result.nextCalled, false);
  assert.equal(result.statusCode, 400);
  assert.match(
    result.jsonPayload.message,
    /Data Privacy Notice acknowledgment is required/i,
  );
});

test("create validation accepts a valid privacy acknowledgment payload", async () => {
  const result = await runMiddleware(validateCreateHouseholdRegistration, {
    body: buildValidPayload(),
  });

  assert.equal(result.nextCalled, true);
  assert.equal(
    result.req.validatedBody.privacy_acknowledgment.notice_version,
    HOUSEHOLD_PRIVACY_NOTICE_VERSION,
  );
  assert.equal(
    result.req.validatedBody.privacy_acknowledgment.consent_status,
    "ACKNOWLEDGED",
  );
});

test("shared create validator normalizes the same payload without Express middleware", () => {
  const payload = buildValidPayload();
  payload.contact_number = "  +639171234567  ";
  payload.current_address_details = "  Poblacion, Malvar, Batangas  ";
  payload.family_head_photo_url = "  data:image/jpeg;base64,ZmFrZQ==  ";
  payload.privacy_acknowledgment.acknowledged_by_name = "  Ana Dela Cruz  ";

  const normalized = validateAndNormalizeHouseholdRegistrationPayload(payload);

  assert.equal(normalized.contact_number, "+639171234567");
  assert.equal(normalized.current_address_details, "Poblacion, Malvar, Batangas");
  assert.equal(normalized.family_head_photo_url, "data:image/jpeg;base64,ZmFrZQ==");
  assert.equal(
    normalized.privacy_acknowledgment.acknowledged_by_name,
    "Ana Dela Cruz",
  );
});

test("shared create validator rejects missing family-head photo", () => {
  const payload = buildValidPayload();
  delete payload.family_head_photo_url;

  assert.throws(
    () => validateAndNormalizeHouseholdRegistrationPayload(payload),
    /Family head photo is required/i,
  );
});

test("create validation rejects unsupported privacy notice versions", async () => {
  const payload = buildValidPayload();
  payload.privacy_acknowledgment.notice_version = "2026-06-01-v1";

  const result = await runMiddleware(validateCreateHouseholdRegistration, {
    body: payload,
  });

  assert.equal(result.nextCalled, false);
  assert.equal(result.statusCode, 400);
  assert.match(result.jsonPayload.message, /invalid or outdated/i);
});

test("update validation allows ordinary edits without a new privacy acknowledgment", async () => {
  const payload = buildValidPayload();
  delete payload.privacy_acknowledgment;
  delete payload.family_head;
  delete payload.family_head_photo_url;
  delete payload.photo_verification_notes;
  delete payload.household_size;

  const result = await runMiddleware(validateUpdateHouseholdDetails, {
    params: {
      householdId: VALID_UUIDS.householdId,
    },
    body: payload,
  });

  assert.equal(result.nextCalled, true);
  assert.equal(result.req.validatedParams.householdId, VALID_UUIDS.householdId);
  assert.equal(result.req.validatedBody.privacy_acknowledgment, null);
  assert.equal(result.req.validatedBody.family_head, undefined);
  assert.equal(result.req.validatedBody.family_head_photo_url, undefined);
  assert.equal(result.req.validatedBody.household_size, undefined);
});

test("get household details validation accepts and normalizes an optional evacuation_log_id query", async () => {
  const result = await runMiddleware(validateGetHouseholdDetails, {
    params: {
      householdId: VALID_UUIDS.householdId,
    },
    query: {
      evacuation_log_id: `  ${VALID_UUIDS.evacuationLogId}  `,
    },
  });

  assert.equal(result.nextCalled, true);
  assert.equal(result.req.validatedParams.householdId, VALID_UUIDS.householdId);
  assert.equal(
    result.req.validatedQuery.evacuationLogId,
    VALID_UUIDS.evacuationLogId,
  );
});

test("duplicate suggestion validation accepts partial household lookup data", async () => {
  const payload = buildValidPayload();
  delete payload.privacy_acknowledgment;
  delete payload.family_head_photo_url;
  delete payload.photo_verification_notes;

  const result = await runMiddleware(validateDuplicateRegistrationSuggestions, {
    body: payload,
  });

  assert.equal(result.nextCalled, true);
  assert.equal(result.req.validatedBody.disaster_event_id, VALID_UUIDS.disasterEventId);
  assert.equal(result.req.validatedBody.family_head.first_name, "Ana");
  assert.equal(result.req.validatedBody.members[0].first_name, "Marco");
});

test("create validation rejects a member with the exact same full name as the family head", async () => {
  const payload = buildValidPayload();
  payload.members[0].first_name = "Ana";
  payload.members[0].last_name = "Dela Cruz";
  payload.members[0].middle_name = null;
  payload.members[0].suffix = null;

  const result = await runMiddleware(validateCreateHouseholdRegistration, {
    body: payload,
  });

  assert.equal(result.nextCalled, false);
  assert.equal(result.statusCode, 400);
  assert.match(result.jsonPayload.message, /same full name as the family head/i);
});

test("create validation rejects exact duplicate household member names", async () => {
  const payload = buildValidPayload();
  payload.household_size = 3;
  payload.members.push({
    id: null,
    first_name: "Marco",
    middle_name: null,
    last_name: "Dela Cruz",
    suffix: null,
    sex: "MALE",
    age_value: 8,
    age_unit: "YEARS",
    relationship_to_head: "SON",
    sector_ids: [],
  });

  const result = await runMiddleware(validateCreateHouseholdRegistration, {
    body: payload,
  });

  assert.equal(result.nextCalled, false);
  assert.equal(result.statusCode, 400);
  assert.match(result.jsonPayload.message, /duplicate full names/i);
});
