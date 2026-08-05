const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const servicePath = path.resolve(
  __dirname,
  "../src/services/householdRegistration.service.js",
);
const dependencyPaths = {
  db: path.resolve(__dirname, "../src/config/db.js"),
  privacyNotice: path.resolve(__dirname, "../src/config/privacyNotice.js"),
  repository: path.resolve(
    __dirname,
    "../src/repositories/householdRegistration.repository.js",
  ),
  notificationService: path.resolve(
    __dirname,
    "../src/modules/notifications/notification.service.js",
  ),
  ageGroup: path.resolve(__dirname, "../src/utils/ageGroup.js"),
  systemLog: path.resolve(__dirname, "../src/utils/systemLog.js"),
  registrationOptions: path.resolve(
    __dirname,
    "../src/utils/registrationOptions.js",
  ),
};

const loadServiceWithMocks = (repositoryOverrides = {}) => {
  const originalEntries = new Map();
  const mockRepository = {
    getDisasterEventById: async () => ({ id: "event-1" }),
    getUserBarangayScopeById: async () => null,
    getBarangayById: async () => ({
      id: "barangay-1",
      code: "BAGONG_POOK",
    }),
    getDisasterEventBarangayLink: async () => ({
      disaster_event_id: "event-1",
      barangay_id: "barangay-1",
    }),
    findPotentialDuplicatePersonMatches: async () => [],
    ...repositoryOverrides,
  };

  const mockEntries = new Map([
    [dependencyPaths.db, { connect: async () => ({}) }],
    [
      dependencyPaths.privacyNotice,
      {
        HOUSEHOLD_PRIVACY_NOTICE_VERSION: "v1",
        HOUSEHOLD_PRIVACY_CONSENT_STATUS: {
          ACKNOWLEDGED: "ACKNOWLEDGED",
        },
        HOUSEHOLD_PRIVACY_SYNC_STATUS: {
          SYNCED: "SYNCED",
        },
      },
    ],
    [dependencyPaths.repository, mockRepository],
    [dependencyPaths.notificationService, { emitSafely: async () => {} }],
    [
      dependencyPaths.ageGroup,
      {
        deriveAgeGroup: (ageValue, ageUnit) =>
          ageUnit === "YEARS" && Number.isInteger(ageValue) && ageValue >= 0
            ? "ADULT"
            : null,
      },
    ],
    [
      dependencyPaths.systemLog,
      {
        logAuditSafely: async () => {},
        pickDefined: (source, keys) =>
          keys.reduce((result, key) => {
            if (source?.[key] !== undefined) {
              result[key] = source[key];
            }

            return result;
          }, {}),
      },
    ],
    [
      dependencyPaths.registrationOptions,
      {
        HOUSEHOLD_CONDITION_CODES: {},
        MANUAL_MEMBER_SECTOR_CODES: [],
        buildAgeSectorLookupCodes: () => [],
        getCanonicalAgeSectorCodeFromValue: (value) => value || null,
        getCanonicalMemberSectorCode: (value) => value || null,
        getMemberFlagsFromSectorCodes: () => ({}),
      },
    ],
  ]);

  delete require.cache[servicePath];

  for (const [dependencyPath, exportsValue] of mockEntries.entries()) {
    originalEntries.set(dependencyPath, require.cache[dependencyPath]);
    require.cache[dependencyPath] = {
      id: dependencyPath,
      filename: dependencyPath,
      loaded: true,
      exports: exportsValue,
    };
  }

  const service = require(servicePath);

  const restore = () => {
    delete require.cache[servicePath];

    for (const [dependencyPath, originalEntry] of originalEntries.entries()) {
      if (originalEntry) {
        require.cache[dependencyPath] = originalEntry;
      } else {
        delete require.cache[dependencyPath];
      }
    }
  };

  return {
    service,
    restore,
  };
};

test("registerHousehold blocks exact full-name duplicate matches", async () => {
  const harness = loadServiceWithMocks({
    findPotentialDuplicatePersonMatches: async () => [
      {
        person_key: "family_head",
        household_id: "household-123",
        household_barangay_name: "Bagong Pook",
        household_family_head_first_name: "HOSHI",
        household_family_head_middle_name: "",
        household_family_head_last_name: "KWON",
        household_family_head_suffix: "",
        matched_role: "FAMILY_HEAD",
        matched_first_name: "HOSHI",
        matched_middle_name: "",
        matched_last_name: "KWON",
        matched_suffix: "",
        matched_sex: "MALE",
        matched_age_value: null,
        matched_age_unit: "YEARS",
        matched_contact_number: null,
        matched_relationship_to_head: "HEAD",
        current_stay_type: "EVAC_CENTER",
        household_size: 1,
        is_active: true,
        registered_at: "2026-08-04T03:33:00.000Z",
      },
    ],
  });

  try {
    await assert.rejects(
      harness.service.registerHousehold({
        disaster_event_id: "event-1",
        barangay_id: "barangay-1",
        residency_status: "RESIDENT",
        current_stay_type: "EVAC_CENTER",
        household_size: 1,
        registered_by: "user-1",
        contact_number: null,
        household_sector_ids: [],
        family_head_photo_url: null,
        photo_verification_notes: null,
        family_head: {
          first_name: "HOSHI",
          middle_name: "",
          last_name: "KWON",
          suffix: "",
          sex: "MALE",
          age_value: 24,
          age_unit: "YEARS",
          sector_ids: [],
        },
        members: [],
        privacy_acknowledgment: {
          consent_status: "ACKNOWLEDGED",
          notice_version: "v1",
          acknowledged_at: "2026-08-04T03:32:00.000Z",
          acknowledged_by_name: "HOSHI KWON",
        },
      }),
      (error) => {
        assert.equal(error.code, "DUPLICATE_HOUSEHOLD_REGISTRATION");
        assert.equal(error.statusCode, 409);
        assert.match(error.message, /duplicate evacuee registration/i);
        return true;
      },
    );
  } finally {
    harness.restore();
  }
});

test("registerHousehold blocks members that duplicate the family head name", async () => {
  const harness = loadServiceWithMocks();

  try {
    await assert.rejects(
      harness.service.registerHousehold({
        disaster_event_id: "event-1",
        barangay_id: "barangay-1",
        residency_status: "RESIDENT",
        current_stay_type: "EVAC_CENTER",
        household_size: 2,
        registered_by: "user-1",
        contact_number: null,
        household_sector_ids: [],
        family_head_photo_url: null,
        photo_verification_notes: null,
        family_head: {
          first_name: "HOSHI",
          middle_name: "",
          last_name: "KWON",
          suffix: "",
          sex: "MALE",
          age_value: 24,
          age_unit: "YEARS",
          sector_ids: [],
        },
        members: [
          {
            id: null,
            first_name: "HOSHI",
            middle_name: "",
            last_name: "KWON",
            suffix: "",
            sex: "MALE",
            age_value: 10,
            age_unit: "YEARS",
            relationship_to_head: "SON",
            sector_ids: [],
          },
        ],
        privacy_acknowledgment: {
          consent_status: "ACKNOWLEDGED",
          notice_version: "v1",
          acknowledged_at: "2026-08-04T03:32:00.000Z",
          acknowledged_by_name: "HOSHI KWON",
        },
      }),
      (error) => {
        assert.equal(error.code, "DUPLICATE_HOUSEHOLD_MEMBER_NAME");
        assert.equal(error.statusCode, 400);
        assert.match(error.message, /same full name as the family head/i);
        return true;
      },
    );
  } finally {
    harness.restore();
  }
});
