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

const loadServiceWithMocks = (repositoryOverrides = {}, dbOverrides = {}) => {
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
    lockHouseholdRegistrationScope: async () => ({
      id: "event-1",
      status: "ACTIVE",
    }),
    findPotentialDuplicatePersonMatches: async () => [],
    findActiveCrossEventFamilyHeadMatches: async () => [],
    getActiveHouseholdSuccessorById: async () => null,
    ...repositoryOverrides,
  };
  if (!mockRepository.getHouseholdSummaryByIdForUpdate) {
    mockRepository.getHouseholdSummaryByIdForUpdate =
      mockRepository.getHouseholdSummaryById;
  }
  const mockDb = {
    connect: async () => ({
      query: async () => ({ rows: [] }),
      release: () => {},
    }),
    ...dbOverrides,
  };

  const mockEntries = new Map([
    [dependencyPaths.db, mockDb],
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

const buildValidRegistrationRequest = (overrides = {}) => ({
  disaster_event_id: "event-1",
  barangay_id: "barangay-1",
  residency_status: "RESIDENT",
  current_stay_type: "RELATIVES",
  household_size: 1,
  registered_by: "user-1",
  contact_number: "0917 000 0000",
  current_address_details: "Purok 1",
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
  ...overrides,
});

const buildDuplicateMatch = (overrides = {}) => ({
  person_key: "family_head",
  household_id: "household-123",
  barangay_id: "barangay-1",
  barangay_name: "Bagong Pook",
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
  matched_age_value: 24,
  matched_age_unit: "YEARS",
  matched_contact_number: "09170000000",
  matched_relationship_to_head: "HEAD",
  current_stay_type: "EVAC_CENTER",
  household_size: 1,
  is_active: true,
  registered_at: "2026-08-04T03:33:00.000Z",
  ...overrides,
});

const buildDuplicateSuggestionRequest = (overrides = {}) => ({
  disaster_event_id: "event-1",
  barangay_id: "barangay-1",
  registered_by: "barangay-user-1",
  contact_number: "0917 000 0000",
  family_head: {
    first_name: "HOSHI",
    middle_name: "",
    last_name: "KWON",
    suffix: "",
    sex: "MALE",
    age_value: 24,
    age_unit: "YEARS",
  },
  members: [],
  requester: {
    userId: "barangay-user-1",
    roleCode: "BARANGAY",
    defaultBarangayId: "barangay-1",
  },
  ...overrides,
});

const assertNoRestrictedExternalLeak = (match) => {
  const serializedMatch = JSON.stringify(match);

  [
    "Santiago",
    "barangay-santiago",
    "household-santiago",
    "evacuee-santiago",
    "External",
    "Santiago Head",
    "09179999999",
  ].forEach((protectedValue) => {
    assert.equal(
      serializedMatch.includes(protectedValue),
      false,
      `${protectedValue} leaked in ${serializedMatch}`,
    );
  });
};

test("duplicate suggestions preserve same-barangay Barangay match details", async () => {
  const harness = loadServiceWithMocks({
    getUserBarangayScopeById: async () => ({
      id: "barangay-user-1",
      role_code: "BARANGAY",
      default_barangay_id: "barangay-1",
    }),
    findPotentialDuplicatePersonMatches: async () => [buildDuplicateMatch()],
  });

  try {
    const result = await harness.service.getDuplicateRegistrationSuggestions(
      buildDuplicateSuggestionRequest(),
    );
    const match = result.groups[0].matches[0];

    assert.equal(result.total_matches, 1);
    assert.equal(match.visibility, "AUTHORIZED");
    assert.equal(match.details_restricted, false);
    assert.equal(match.household_id, "household-123");
    assert.equal(match.barangay_id, "barangay-1");
    assert.equal(match.barangay_name, "Bagong Pook");
    assert.equal(match.family_head_name, "HOSHI KWON");
  } finally {
    harness.restore();
  }
});

test("duplicate suggestions redact cross-barangay Barangay match details", async () => {
  const harness = loadServiceWithMocks({
    getUserBarangayScopeById: async () => ({
      id: "barangay-user-1",
      role_code: "BARANGAY",
      default_barangay_id: "barangay-1",
    }),
    findPotentialDuplicatePersonMatches: async () => [
      buildDuplicateMatch({
        household_id: "household-santiago",
        barangay_id: "barangay-santiago",
        barangay_name: "Santiago",
        household_family_head_first_name: "External",
        household_family_head_middle_name: "",
        household_family_head_last_name: "Head",
        matched_first_name: "External",
        matched_middle_name: "",
        matched_last_name: "Head",
        matched_contact_number: "09179999999",
      }),
    ],
  });

  try {
    const result = await harness.service.getDuplicateRegistrationSuggestions(
      buildDuplicateSuggestionRequest(),
    );
    const match = result.groups[0].matches[0];

    assert.equal(result.total_matches, 1);
    assert.equal(match.visibility, "RESTRICTED_EXTERNAL_BARANGAY");
    assert.equal(match.details_restricted, true);
    assert.deepEqual(Object.keys(match).sort(), [
      "details_restricted",
      "visibility",
    ]);
    assertNoRestrictedExternalLeak(match);
    assertNoRestrictedExternalLeak(result);
  } finally {
    harness.restore();
  }
});

test("duplicate suggestions keep authorized matches and aggregate external Barangay matches", async () => {
  const harness = loadServiceWithMocks({
    getUserBarangayScopeById: async () => ({
      id: "barangay-user-1",
      role_code: "BARANGAY",
      default_barangay_id: "barangay-1",
    }),
    findPotentialDuplicatePersonMatches: async () => [
      buildDuplicateMatch({ household_id: "household-bagong-pook" }),
      buildDuplicateMatch({
        household_id: "household-santiago",
        barangay_id: "barangay-santiago",
        barangay_name: "Santiago",
        household_family_head_first_name: "External",
        household_family_head_last_name: "Head",
        matched_first_name: "External",
        matched_last_name: "Head",
      }),
    ],
  });

  try {
    const result = await harness.service.getDuplicateRegistrationSuggestions(
      buildDuplicateSuggestionRequest(),
    );
    const matches = result.groups[0].matches;

    assert.equal(matches.length, 2);
    assert.equal(matches[0].visibility, "AUTHORIZED");
    assert.equal(matches[0].household_id, "household-bagong-pook");
    assert.equal(matches[1].visibility, "RESTRICTED_EXTERNAL_BARANGAY");
    assert.equal(JSON.stringify(result).includes("Santiago"), false);
    assert.equal(JSON.stringify(result).includes("household-santiago"), false);
  } finally {
    harness.restore();
  }
});

test("duplicate suggestions collapse multiple external Barangay matches into one restricted indication", async () => {
  const harness = loadServiceWithMocks({
    getUserBarangayScopeById: async () => ({
      id: "barangay-user-1",
      role_code: "BARANGAY",
      default_barangay_id: "barangay-1",
    }),
    findPotentialDuplicatePersonMatches: async () => [
      buildDuplicateMatch({
        household_id: "household-santiago",
        barangay_id: "barangay-santiago",
        barangay_name: "Santiago",
        household_family_head_first_name: "External",
        household_family_head_last_name: "Head",
      }),
      buildDuplicateMatch({
        household_id: "household-san-andres",
        barangay_id: "barangay-san-andres",
        barangay_name: "San Andres",
        household_family_head_first_name: "Another",
        household_family_head_last_name: "External",
      }),
    ],
  });

  try {
    const result = await harness.service.getDuplicateRegistrationSuggestions(
      buildDuplicateSuggestionRequest(),
    );
    const serializedResult = JSON.stringify(result);

    assert.equal(result.total_matches, 1);
    assert.equal(result.groups[0].matches.length, 1);
    assert.equal(
      result.groups[0].matches[0].visibility,
      "RESTRICTED_EXTERNAL_BARANGAY",
    );
    assert.equal(serializedResult.includes("Santiago"), false);
    assert.equal(serializedResult.includes("San Andres"), false);
    assert.equal(serializedResult.includes("household-san-andres"), false);
  } finally {
    harness.restore();
  }
});

test("duplicate suggestions preserve MSWDO cross-barangay match details", async () => {
  const harness = loadServiceWithMocks({
    getUserBarangayScopeById: async () => ({
      id: "mswdo-user-1",
      role_code: "MSWDO",
      default_barangay_id: null,
    }),
    findPotentialDuplicatePersonMatches: async () => [
      buildDuplicateMatch({
        household_id: "household-santiago",
        barangay_id: "barangay-santiago",
        barangay_name: "Santiago",
      }),
    ],
  });

  try {
    const result = await harness.service.getDuplicateRegistrationSuggestions(
      buildDuplicateSuggestionRequest({
        registered_by: "mswdo-user-1",
        requester: {
          userId: "mswdo-user-1",
          roleCode: "MSWDO",
          defaultBarangayId: null,
        },
      }),
    );
    const match = result.groups[0].matches[0];

    assert.equal(match.visibility, "AUTHORIZED");
    assert.equal(match.details_restricted, false);
    assert.equal(match.household_id, "household-santiago");
    assert.equal(match.barangay_name, "Santiago");
  } finally {
    harness.restore();
  }
});

test("getHouseholdDetails still denies direct cross-barangay Barangay access", async () => {
  const harness = loadServiceWithMocks({
    getHouseholdSummaryById: async () => ({
      id: "household-santiago",
      barangay_id: "barangay-santiago",
      disaster_event_id: "event-1",
      disaster_event_status: "ACTIVE",
      family_head_first_name: "External",
      family_head_last_name: "Head",
      is_active: true,
    }),
  });

  try {
    await assert.rejects(
      harness.service.getHouseholdDetails({
        householdId: "household-santiago",
        requester: {
          userId: "barangay-user-1",
          roleCode: "BARANGAY",
          defaultBarangayId: "barangay-1",
        },
      }),
      (error) => {
        assert.equal(error.statusCode, 403);
        assert.match(error.message, /do not have access/i);
        return true;
      },
    );
  } finally {
    harness.restore();
  }
});

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

test("H04-01/H04-02 registerHousehold locks scope before authoritative duplicate recheck and inserts nothing", async () => {
  const events = [];
  const fakeClient = {
    query: async (query) => {
      events.push(String(query).trim());
      return { rows: [] };
    },
    release: () => {
      events.push("RELEASE");
    },
  };
  let duplicateLookupCount = 0;
  let insertHouseholdCalled = false;
  const harness = loadServiceWithMocks(
    {
      getSectorsByIds: async () => [],
      getSectorsByCodes: async () => [{ id: "adult-sector", code: "ADULT" }],
      getAgeGroupSectors: async () => [{ id: "adult-sector", code: "ADULT" }],
      lockHouseholdRegistrationScope: async (disasterEventId, dbClient) => {
        events.push(`LOCK:${disasterEventId}:${dbClient === fakeClient}`);
        return { id: disasterEventId, status: "ACTIVE" };
      },
      findPotentialDuplicatePersonMatches: async (_payload, dbClient) => {
        duplicateLookupCount += 1;
        events.push(`DUPLICATE:${dbClient === fakeClient}`);
        return duplicateLookupCount === 1 ? [] : [buildDuplicateMatch()];
      },
      insertHousehold: async () => {
        insertHouseholdCalled = true;
        throw new Error("insertHousehold should not be called");
      },
    },
    {
      connect: async () => fakeClient,
    },
  );

  try {
    await assert.rejects(
      harness.service.registerHousehold(buildValidRegistrationRequest()),
      (error) => {
        assert.equal(error.code, "DUPLICATE_HOUSEHOLD_REGISTRATION");
        assert.equal(error.statusCode, 409);
        return true;
      },
    );

    assert.equal(insertHouseholdCalled, false);
    assert.deepEqual(events, [
      "DUPLICATE:false",
      "BEGIN",
      "LOCK:event-1:true",
      "DUPLICATE:true",
      "ROLLBACK",
      "RELEASE",
    ]);
  } finally {
    harness.restore();
  }
});

test("EE-FIX-01 registerHousehold allows only ACTIVE locked disaster events before domain writes", async () => {
  const blockedStatuses = ["PLANNED", "CLOSED", "ARCHIVED"];

  for (const status of blockedStatuses) {
    const events = [];
    const fakeClient = {
      query: async (query) => {
        events.push(String(query).trim());
        return { rows: [] };
      },
      release: () => {
        events.push("RELEASE");
      },
    };
    const forbiddenMutation = (name) => async () => {
      events.push(name);
      throw new Error(`${name} must not be called for ${status}`);
    };
    const harness = loadServiceWithMocks(
      {
        getSectorsByIds: async () => [],
        getSectorsByCodes: async () => [{ id: "adult-sector", code: "ADULT" }],
        getAgeGroupSectors: async () => [{ id: "adult-sector", code: "ADULT" }],
        lockHouseholdRegistrationScope: async (disasterEventId, dbClient) => {
          events.push(`LOCK:${disasterEventId}:${status}:${dbClient === fakeClient}`);
          return { id: disasterEventId, status };
        },
        findPotentialDuplicatePersonMatches: async (_payload, dbClient) => {
          events.push(`DUPLICATE:${dbClient === fakeClient}`);
          return [];
        },
        insertHousehold: forbiddenMutation("INSERT_HOUSEHOLD"),
        insertHouseholdPrivacyConsent: forbiddenMutation("INSERT_PRIVACY"),
        insertEvacuee: forbiddenMutation("INSERT_EVACUEE"),
        insertEvacueeSectors: forbiddenMutation("INSERT_EVACUEE_SECTORS"),
        insertEvacuationLog: forbiddenMutation("INSERT_ATTENDANCE"),
        updateHouseholdFamilyHeadEvacueeId: forbiddenMutation("UPDATE_HEAD"),
        insertHouseholdSectors: forbiddenMutation("INSERT_HOUSEHOLD_SECTORS"),
        generateStubNumbers: forbiddenMutation("GENERATE_STUB"),
        insertStub: forbiddenMutation("INSERT_STUB"),
        archiveHousehold: forbiddenMutation("ARCHIVE_HOUSEHOLD"),
        deactivateEvacueesByHouseholdId: forbiddenMutation("DEACTIVATE_EVACUEES"),
      },
      {
        connect: async () => fakeClient,
      },
    );

    try {
      await assert.rejects(
        harness.service.registerHousehold(buildValidRegistrationRequest()),
        (error) => {
          assert.equal(error.code, "DISASTER_EVENT_NOT_ACTIVE");
          assert.equal(error.statusCode, 400);
          assert.match(error.message, /disaster event is not active/i);
          return true;
        },
      );

      assert.deepEqual(events, [
        "DUPLICATE:false",
        "BEGIN",
        `LOCK:event-1:${status}:true`,
        "ROLLBACK",
        "RELEASE",
      ]);
    } finally {
      harness.restore();
    }
  }
});

test("H04-03/H04-06 sequential fuzzy duplicate still uses existing duplicate error", async () => {
  const harness = loadServiceWithMocks({
    findPotentialDuplicatePersonMatches: async () => [
      buildDuplicateMatch({
        matched_age_value: 25,
        matched_contact_number: null,
      }),
    ],
  });

  try {
    await assert.rejects(
      harness.service.registerHousehold(buildValidRegistrationRequest()),
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

test("H04-05 different household in the same lock scope still registers", async () => {
  const events = [];
  const fakeClient = {
    query: async (query) => {
      events.push(String(query).trim());
      return { rows: [] };
    },
    release: () => {
      events.push("RELEASE");
    },
  };
  const harness = loadServiceWithMocks(
    {
      getSectorsByIds: async () => [],
      getSectorsByCodes: async () => [{ id: "adult-sector", code: "ADULT" }],
      getAgeGroupSectors: async () => [{ id: "adult-sector", code: "ADULT" }],
      lockHouseholdRegistrationScope: async (disasterEventId, dbClient) => {
        events.push(`LOCK:${disasterEventId}:${dbClient === fakeClient}`);
        return { id: disasterEventId, status: "ACTIVE" };
      },
      findPotentialDuplicatePersonMatches: async (_payload, dbClient) => {
        events.push(`DUPLICATE:${dbClient === fakeClient}`);
        return [];
      },
      insertHousehold: async (_payload, dbClient) => {
        events.push(`INSERT_HOUSEHOLD:${dbClient === fakeClient}`);
        return {
          id: "household-new",
          disaster_event_id: "event-1",
          barangay_id: "barangay-1",
        };
      },
      insertHouseholdPrivacyConsent: async (_payload, dbClient) => {
        events.push(`INSERT_PRIVACY:${dbClient === fakeClient}`);
        return { id: "privacy-1", device_id: null };
      },
      insertEvacuee: async (_householdId, member, dbClient) => {
        events.push(`INSERT_EVACUEE:${member.is_family_head}:${dbClient === fakeClient}`);
        return { id: "family-head-1", ...member };
      },
      insertEvacueeSectors: async () => [],
      updateHouseholdFamilyHeadEvacueeId: async (_householdId, _evacueeId, dbClient) => {
        events.push(`UPDATE_HEAD:${dbClient === fakeClient}`);
      },
      insertHouseholdSectors: async () => [],
      archiveHousehold: async () => null,
      deactivateEvacueesByHouseholdId: async () => [],
      getHouseholdSummaryById: async () => ({
        id: "household-new",
        disaster_event_id: "event-1",
        barangay_id: "barangay-1",
        family_head_first_name: "HOSHI",
        family_head_last_name: "KWON",
        is_active: true,
      }),
      getEvacueesByHouseholdId: async () => [],
      getEvacueeSectorAssignmentsByHouseholdId: async () => [],
      getHouseholdSectorAssignmentsByHouseholdId: async () => [],
      getStubByHouseholdId: async () => null,
      getLatestAttendanceByHouseholdId: async () => null,
      getLatestDistributionTransactionByStubId: async () => null,
      getLatestHouseholdPrivacyConsentByHouseholdId: async () => null,
    },
    {
      connect: async () => fakeClient,
    },
  );

  try {
    const result = await harness.service.registerHousehold(
      buildValidRegistrationRequest(),
    );

    assert.equal(result.household.id, "household-new");
    assert.deepEqual(events, [
      "DUPLICATE:false",
      "BEGIN",
      "LOCK:event-1:true",
      "DUPLICATE:true",
      "INSERT_HOUSEHOLD:true",
      "INSERT_PRIVACY:true",
      "INSERT_EVACUEE:true:true",
      "UPDATE_HEAD:true",
      "COMMIT",
      "RELEASE",
    ]);
  } finally {
    harness.restore();
  }
});

test("re-admission registration preserves the archived-source guard for an active source", async () => {
  const events = [];
  const activeSource = {
    id: "active-household",
    disaster_event_id: "event-1",
    barangay_id: "barangay-1",
    is_active: true,
  };
  let insertHouseholdCalled = false;
  const fakeClient = {
    query: async (query) => {
      events.push(String(query).trim());
      return { rows: [] };
    },
    release: () => events.push("RELEASE"),
  };
  const harness = loadServiceWithMocks(
    {
      getSectorsByIds: async () => [],
      getSectorsByCodes: async () => [],
      getAgeGroupSectors: async () => [{ id: "adult-sector", code: "ADULT" }],
      getHouseholdSummaryByIdForUpdate: async (householdId, dbClient) => {
        assert.equal(householdId, activeSource.id);
        assert.equal(dbClient, fakeClient);
        return activeSource;
      },
      insertHousehold: async () => {
        insertHouseholdCalled = true;
        return { id: "should-not-be-created" };
      },
    },
    {
      connect: async () => fakeClient,
    },
  );

  try {
    const request = buildValidRegistrationRequest({
      registration_operation: "CREATE_NEW_HOUSEHOLD_OCCURRENCE",
      re_admission_source_household_id: activeSource.id,
    });

    await assert.rejects(
      harness.service.registerHousehold(request, {
        operation: "RE_ADMISSION",
        sourceHouseholdId: activeSource.id,
      }),
      (error) => {
        assert.equal(error.statusCode, 400);
        assert.equal(error.code, "RE_ADMISSION_SOURCE_NOT_ARCHIVED");
        assert.equal(
          error.message,
          "Only an archived household occurrence can be re-admitted.",
        );
        return true;
      },
    );

    assert.equal(insertHouseholdCalled, false);
    assert.equal(events.includes("UPDATE_SOURCE"), false);
    assert.equal(events.includes("ROLLBACK"), true);
  } finally {
    harness.restore();
  }
});

test("re-admission registration creates a new occurrence without reusing archived IDs", async () => {
  const events = [];
  const archivedSource = {
    id: "source-household",
    disaster_event_id: "event-1",
    barangay_id: "barangay-1",
    is_active: false,
  };
  const createdHousehold = {
    id: "new-household-occurrence",
    disaster_event_id: "event-1",
    barangay_id: "barangay-1",
    family_head_first_name: "HOSHI",
    family_head_last_name: "KWON",
    is_active: true,
    family_head_evacuee_id: null,
  };
  const createdMembers = [];
  let savedPrivacy = null;
  let insertedHead = null;
  let insertedMember = null;
  const fakeClient = {
    query: async (query) => {
      events.push(String(query).trim());
      return { rows: [] };
    },
    release: () => events.push("RELEASE"),
  };
  const harness = loadServiceWithMocks(
    {
      getEvacuationCenterById: async () => ({
        id: "center-1",
        barangay_id: "barangay-1",
        is_active: true,
      }),
      getSectorsByIds: async () => [],
      getSectorsByCodes: async () => [{ id: "adult-sector", code: "ADULT" }],
      getAgeGroupSectors: async () => [{ id: "adult-sector", code: "ADULT" }],
      getHouseholdSummaryByIdForUpdate: async (householdId, dbClient) => {
        assert.equal(householdId, archivedSource.id);
        assert.equal(dbClient, fakeClient);
        events.push("LOCK_SOURCE");
        return archivedSource;
      },
      getActiveEvacuationLogsByHouseholdId: async () => [],
      insertHousehold: async (payload) => {
        events.push("INSERT_HOUSEHOLD");
        assert.equal(payload.household_size, 2);
        return createdHousehold;
      },
      insertHouseholdPrivacyConsent: async (payload) => {
        savedPrivacy = payload;
        events.push("INSERT_PRIVACY");
        return { id: "new-privacy", ...payload, device_id: null };
      },
      insertEvacuee: async (householdId, member) => {
        assert.equal(householdId, createdHousehold.id);
        assert.equal(member.id, null);
        const createdMember = {
          id: member.is_family_head ? "new-head" : "new-member",
          household_id: householdId,
          ...member,
          is_active: true,
        };
        if (member.is_family_head) {
          insertedHead = member;
        } else {
          insertedMember = member;
        }
        createdMembers.push(createdMember);
        return createdMember;
      },
      insertEvacueeSectors: async () => [],
      insertEvacuationLog: async (payload) => ({
        id: `log-${payload.evacuee_id}`,
        ...payload,
        time_in: "2026-08-25T01:00:00.000Z",
      }),
      updateHouseholdFamilyHeadEvacueeId: async (_householdId, memberId) => {
        createdHousehold.family_head_evacuee_id = memberId;
      },
      insertHouseholdSectors: async () => [],
      generateStubNumbers: async () => ({
        stub_no: "STUB-NEW",
        serial_no: "SER-NEW",
      }),
      insertStub: async () => ({
        id: "new-stub",
        household_id: createdHousehold.id,
      }),
      getHouseholdSummaryById: async (householdId) =>
        householdId === createdHousehold.id ? createdHousehold : null,
      getEvacueesByHouseholdId: async () => createdMembers,
      getEvacueeSectorAssignmentsByHouseholdId: async () => [],
      getHouseholdSectorAssignmentsByHouseholdId: async () => [],
      getStubByHouseholdId: async () => ({
        id: "new-stub",
        household_id: createdHousehold.id,
      }),
      getLatestAttendanceByHouseholdId: async () => null,
      getLatestDistributionTransactionByStubId: async () => null,
      getLatestHouseholdPrivacyConsentByHouseholdId: async () => savedPrivacy,
    },
    {
      connect: async () => fakeClient,
    },
  );

  try {
    const request = buildValidRegistrationRequest({
      current_stay_type: "EVAC_CENTER",
      evacuation_center_id: "center-1",
      household_size: 2,
      registration_operation: "CREATE_NEW_HOUSEHOLD_OCCURRENCE",
      re_admission_source_household_id: archivedSource.id,
      family_head: {
        ...buildValidRegistrationRequest().family_head,
        id: "archived-head",
      },
      members: [
        {
          first_name: "MINA",
          middle_name: "",
          last_name: "KWON",
          suffix: "",
          sex: "FEMALE",
          age_value: 22,
          age_unit: "YEARS",
          relationship_to_head: "SPOUSE",
          sector_ids: [],
          id: "archived-member",
        },
      ],
    });

    const result = await harness.service.registerHousehold(request, {
      operation: "RE_ADMISSION",
      sourceHouseholdId: archivedSource.id,
    });

    assert.equal(result.household.id, createdHousehold.id);
    assert.equal(result.registration_operation, "CREATE_NEW_HOUSEHOLD_OCCURRENCE");
    assert.equal(result.source_household_id, archivedSource.id);
    assert.equal(savedPrivacy.household_id, createdHousehold.id);
    assert.equal(insertedHead.id, null);
    assert.equal(insertedMember.id, null);
    assert.equal(events.includes("LOCK_SOURCE"), true);
    assert.equal(events.includes("UPDATE_SOURCE"), false);
  } finally {
    harness.restore();
  }
});

test("registerHousehold returns non-blocking active cross-event information after successful create", async () => {
  const fakeClient = {
    query: async () => ({ rows: [] }),
    release: () => {},
  };
  const harness = loadServiceWithMocks(
    {
      getSectorsByIds: async () => [],
      getSectorsByCodes: async () => [{ id: "adult-sector", code: "ADULT" }],
      getAgeGroupSectors: async () => [{ id: "adult-sector", code: "ADULT" }],
      findPotentialDuplicatePersonMatches: async () => [],
      insertHousehold: async () => ({
        id: "household-new",
        disaster_event_id: "event-1",
        barangay_id: "barangay-1",
      }),
      insertHouseholdPrivacyConsent: async () => ({
        id: "privacy-1",
        device_id: null,
      }),
      insertEvacuee: async (_householdId, member) => ({
        id: member.is_family_head ? "family-head-1" : "member-1",
        ...member,
      }),
      insertEvacueeSectors: async () => [],
      updateHouseholdFamilyHeadEvacueeId: async () => {},
      insertHouseholdSectors: async () => [],
      archiveHousehold: async () => null,
      deactivateEvacueesByHouseholdId: async () => [],
      findActiveCrossEventFamilyHeadMatches: async () => [
        {
          household_id: "other-household-1",
          disaster_event_id: "event-active-other",
          disaster_event_title: "Typhoon Quiapo",
          disaster_event_status: "ACTIVE",
          family_head_first_name: "HOSHI",
          family_head_middle_name: "",
          family_head_last_name: "KWON",
          family_head_suffix: "",
          sex: "MALE",
          age_value: 24,
          age_unit: "YEARS",
          contact_number: "0917 000 0000",
        },
      ],
      getHouseholdSummaryById: async () => ({
        id: "household-new",
        disaster_event_id: "event-1",
        barangay_id: "barangay-1",
        family_head_first_name: "HOSHI",
        family_head_last_name: "KWON",
        is_active: true,
      }),
      getEvacueesByHouseholdId: async () => [],
      getEvacueeSectorAssignmentsByHouseholdId: async () => [],
      getHouseholdSectorAssignmentsByHouseholdId: async () => [],
      getStubByHouseholdId: async () => null,
      getLatestAttendanceByHouseholdId: async () => null,
      getLatestDistributionTransactionByStubId: async () => null,
      getLatestHouseholdPrivacyConsentByHouseholdId: async () => null,
    },
    {
      connect: async () => fakeClient,
    },
  );

  try {
    const result = await harness.service.registerHousehold(
      buildValidRegistrationRequest(),
    );

    assert.equal(result.household.id, "household-new");
    assert.deepEqual(result.active_cross_event_information, {
      has_active_cross_event_match: true,
      active_disaster_events: [
        {
          disaster_event_title: "Typhoon Quiapo",
        },
      ],
    });
  } finally {
    harness.restore();
  }
});

test("registerHousehold does not fail a committed registration when active cross-event notice lookup fails", async () => {
  const fakeClient = {
    query: async () => ({ rows: [] }),
    release: () => {},
  };
  const harness = loadServiceWithMocks(
    {
      getSectorsByIds: async () => [],
      getSectorsByCodes: async () => [{ id: "adult-sector", code: "ADULT" }],
      getAgeGroupSectors: async () => [{ id: "adult-sector", code: "ADULT" }],
      findPotentialDuplicatePersonMatches: async () => [],
      insertHousehold: async () => ({
        id: "household-new",
        disaster_event_id: "event-1",
        barangay_id: "barangay-1",
      }),
      insertHouseholdPrivacyConsent: async () => ({
        id: "privacy-1",
        device_id: null,
      }),
      insertEvacuee: async (_householdId, member) => ({
        id: "family-head-1",
        ...member,
      }),
      insertEvacueeSectors: async () => [],
      updateHouseholdFamilyHeadEvacueeId: async () => {},
      insertHouseholdSectors: async () => [],
      archiveHousehold: async () => null,
      deactivateEvacueesByHouseholdId: async () => [],
      findActiveCrossEventFamilyHeadMatches: async () => {
        throw new Error("temporary metadata lookup failure");
      },
      getHouseholdSummaryById: async () => ({
        id: "household-new",
        disaster_event_id: "event-1",
        barangay_id: "barangay-1",
        family_head_first_name: "HOSHI",
        family_head_last_name: "KWON",
        is_active: true,
      }),
      getEvacueesByHouseholdId: async () => [],
      getEvacueeSectorAssignmentsByHouseholdId: async () => [],
      getHouseholdSectorAssignmentsByHouseholdId: async () => [],
      getStubByHouseholdId: async () => null,
      getLatestAttendanceByHouseholdId: async () => null,
      getLatestDistributionTransactionByStubId: async () => null,
      getLatestHouseholdPrivacyConsentByHouseholdId: async () => null,
    },
    {
      connect: async () => fakeClient,
    },
  );

  try {
    const result = await harness.service.registerHousehold(
      buildValidRegistrationRequest(),
    );

    assert.equal(result.household.id, "household-new");
    assert.equal(result.active_cross_event_information, null);
  } finally {
    harness.restore();
  }
});

test("registerHousehold does not swallow same-event duplicate lookup failures as optional metadata", async () => {
  let insertHouseholdCalled = false;
  const harness = loadServiceWithMocks({
    getSectorsByIds: async () => [],
    getSectorsByCodes: async () => [{ id: "adult-sector", code: "ADULT" }],
    getAgeGroupSectors: async () => [{ id: "adult-sector", code: "ADULT" }],
    findPotentialDuplicatePersonMatches: async () => {
      throw new Error("same-event duplicate lookup failed");
    },
    insertHousehold: async () => {
      insertHouseholdCalled = true;
      return { id: "household-should-not-exist" };
    },
  });

  try {
    await assert.rejects(
      harness.service.registerHousehold(buildValidRegistrationRequest()),
      /same-event duplicate lookup failed/,
    );
    assert.equal(insertHouseholdCalled, false);
  } finally {
    harness.restore();
  }
});

test("registerHousehold isolates optional active cross-event lookup from supplied sync transaction client", async () => {
  const externalClient = {
    query: async () => ({ rows: [] }),
  };
  const optionalLookupClients = [];
  const harness = loadServiceWithMocks({
    getSectorsByIds: async () => [],
    getSectorsByCodes: async () => [{ id: "adult-sector", code: "ADULT" }],
    getAgeGroupSectors: async () => [{ id: "adult-sector", code: "ADULT" }],
    findPotentialDuplicatePersonMatches: async () => [],
    insertHousehold: async (_payload, dbClient) => {
      assert.equal(dbClient, externalClient);
      return {
        id: "household-sync-new",
        disaster_event_id: "event-1",
        barangay_id: "barangay-1",
      };
    },
    insertHouseholdPrivacyConsent: async () => ({
      id: "privacy-1",
      device_id: null,
    }),
    insertEvacuee: async (_householdId, member, dbClient) => {
      assert.equal(dbClient, externalClient);
      return {
        id: member.is_family_head ? "family-head-1" : "member-1",
        ...member,
      };
    },
    insertEvacueeSectors: async () => [],
    updateHouseholdFamilyHeadEvacueeId: async () => {},
    insertHouseholdSectors: async () => [],
    archiveHousehold: async () => null,
    deactivateEvacueesByHouseholdId: async () => [],
    findActiveCrossEventFamilyHeadMatches: async (_payload, dbClient) => {
      optionalLookupClients.push(dbClient);
      throw new Error("optional lookup must not poison sync transaction");
    },
    getHouseholdSummaryById: async (_householdId, dbClient) => {
      assert.equal(dbClient, externalClient);
      return {
        id: "household-sync-new",
        disaster_event_id: "event-1",
        barangay_id: "barangay-1",
        family_head_first_name: "HOSHI",
        family_head_last_name: "KWON",
        is_active: true,
      };
    },
    getEvacueesByHouseholdId: async () => [],
    getEvacueeSectorAssignmentsByHouseholdId: async () => [],
    getHouseholdSectorAssignmentsByHouseholdId: async () => [],
    getStubByHouseholdId: async () => null,
    getLatestAttendanceByHouseholdId: async () => null,
    getLatestDistributionTransactionByStubId: async () => null,
    getLatestHouseholdPrivacyConsentByHouseholdId: async () => null,
  });

  try {
    const result = await harness.service.registerHousehold(
      buildValidRegistrationRequest({
        enforce_sync_duplicate_guard: true,
        dbClient: externalClient,
      }),
    );

    assert.equal(result.household.id, "household-sync-new");
    assert.deepEqual(optionalLookupClients, [undefined]);
    assert.equal(result.active_cross_event_information, null);
  } finally {
    harness.restore();
  }
});

test("H04-12/H04-13 sync registration uses supplied transaction client for lock, recheck, and older duplicate timestamp update", async () => {
  const events = [];
  const externalClient = {
    query: async (query) => {
      events.push(`SQL:${String(query).trim()}`);
      return { rows: [] };
    },
  };
  let duplicateLookupCount = 0;
  let insertHouseholdCalled = false;
  const harness = loadServiceWithMocks({
    getSectorsByIds: async () => [],
    getSectorsByCodes: async () => [{ id: "adult-sector", code: "ADULT" }],
    getAgeGroupSectors: async () => [{ id: "adult-sector", code: "ADULT" }],
    lockHouseholdRegistrationScope: async (disasterEventId, dbClient) => {
      events.push(`LOCK:${disasterEventId}:${dbClient === externalClient}`);
      return { id: disasterEventId, status: "ACTIVE" };
    },
    findPotentialDuplicatePersonMatches: async (_payload, dbClient) => {
      duplicateLookupCount += 1;
      events.push(`DUPLICATE:${dbClient === externalClient}`);
      return duplicateLookupCount === 1
        ? []
        : [
            buildDuplicateMatch({
              registered_at: "2026-08-04T03:33:00.000Z",
            }),
          ];
    },
    updateHouseholdRegistrationTimestamp: async (
      householdId,
      registeredAt,
      dbClient,
    ) => {
      events.push(`UPDATE_TS:${householdId}:${registeredAt}:${dbClient === externalClient}`);
      return { id: householdId };
    },
    insertHousehold: async () => {
      insertHouseholdCalled = true;
      throw new Error("insertHousehold should not be called");
    },
    getHouseholdSummaryById: async (_householdId, dbClient) => {
      events.push(`RESPONSE:${dbClient === externalClient}`);
      return {
        id: "household-123",
        disaster_event_id: "event-1",
        barangay_id: "barangay-1",
        family_head_first_name: "HOSHI",
        family_head_last_name: "KWON",
        is_active: true,
      };
    },
    getEvacueesByHouseholdId: async () => [],
    getEvacueeSectorAssignmentsByHouseholdId: async () => [],
    getHouseholdSectorAssignmentsByHouseholdId: async () => [],
    getStubByHouseholdId: async () => null,
    getLatestAttendanceByHouseholdId: async () => null,
    getLatestDistributionTransactionByStubId: async () => null,
    getLatestHouseholdPrivacyConsentByHouseholdId: async () => null,
  });

  try {
    const result = await harness.service.registerHousehold(
      buildValidRegistrationRequest({
        synced_client_timestamp: "2026-08-04T03:32:00.000Z",
        enforce_sync_duplicate_guard: true,
        dbClient: externalClient,
      }),
    );

    assert.equal(result.household.id, "household-123");
    assert.equal(insertHouseholdCalled, false);
    assert.deepEqual(events, [
      "DUPLICATE:false",
      "LOCK:event-1:true",
      "DUPLICATE:true",
      "UPDATE_TS:household-123:2026-08-04T03:32:00.000Z:true",
      "RESPONSE:true",
    ]);
  } finally {
    harness.restore();
  }
});

test("BRG-SC-06-H01 TEST A rejects foreign Barangay departure before active-log and mutation reads", async () => {
  const events = [];
  const harness = loadServiceWithMocks({
    getHouseholdSummaryById: async () => {
      events.push("SUMMARY");
      return {
        id: "household-foreign-active",
        disaster_event_id: "event-1",
        barangay_id: "barangay-foreign",
        is_active: true,
      };
    },
    getActiveEvacuationLogsByHouseholdId: async () => {
      events.push("ACTIVE_LOGS");
      throw new Error("Foreign departure must not inspect active logs");
    },
    markHouseholdDeparture: async () => {
      events.push("MARK_DEPARTURE");
      throw new Error("Foreign departure must not mutate logs");
    },
    archiveHousehold: async () => {
      events.push("ARCHIVE");
      throw new Error("Foreign departure must not archive household");
    },
    deactivateEvacueesByHouseholdId: async () => {
      events.push("DEACTIVATE");
      throw new Error("Foreign departure must not deactivate evacuees");
    },
  });

  try {
    await assert.rejects(
      harness.service.departHousehold(
        "household-foreign-active",
        {
          departure_time: "2026-08-09T03:00:00.000Z",
          remarks: "Offline departure",
        },
        {
          userId: "barangay-user-a",
          roleCode: "BARANGAY",
          defaultBarangayId: "barangay-a",
        },
      ),
      (error) => {
        assert.equal(error.statusCode, 403);
        assert.equal(error.message, "You do not have access to depart this household");
        return true;
      },
    );

    assert.deepEqual(events, ["SUMMARY"]);
  } finally {
    harness.restore();
  }
});

test("BRG-SC-06-H01 TEST B rejects foreign already-departed Barangay household before duplicate logic", async () => {
  const events = [];
  const harness = loadServiceWithMocks({
    getHouseholdSummaryById: async () => {
      events.push("SUMMARY");
      return {
        id: "household-foreign-archived",
        disaster_event_id: "event-1",
        barangay_id: "barangay-foreign",
        is_active: false,
      };
    },
    getLatestAttendanceByHouseholdId: async () => {
      events.push("LATEST_ATTENDANCE");
      throw new Error("Foreign already-departed household must not expose duplicate state");
    },
    updateHouseholdDepartureTimestamp: async () => {
      events.push("REWRITE_DEPARTURE_TIME");
      throw new Error("Foreign duplicate must not rewrite departure timestamp");
    },
  });

  try {
    await assert.rejects(
      harness.service.departHousehold(
        "household-foreign-archived",
        {
          departure_time: "2026-08-09T02:00:00.000Z",
          allow_duplicate_departure_resolution: true,
        },
        {
          userId: "barangay-user-a",
          roleCode: "BARANGAY",
          defaultBarangayId: "barangay-a",
        },
      ),
      (error) => {
        assert.equal(error.statusCode, 403);
        assert.equal(error.code, undefined);
        assert.equal(error.serverPayload, undefined);
        return true;
      },
    );

    assert.deepEqual(events, ["SUMMARY"]);
  } finally {
    harness.restore();
  }
});

[
  {
    label: "earlier",
    incomingTime: "2026-08-09T02:30:00.000Z",
  },
  {
    label: "equal",
    incomingTime: "2026-08-09T03:00:00.000Z",
  },
  {
    label: "later",
    incomingTime: "2026-08-09T03:30:00.000Z",
  },
].forEach(({ label, incomingTime }) => {
  test(`BRG-SC-06-H02 ${label} duplicate departure returns FIRST_ACCEPTED domain duplicate without mutation`, async () => {
    const events = [];
    const acceptedAttendance = {
      id: "accepted-log-1",
      household_id: "household-local-archived",
      status: "LEFT",
      time_in: "2026-08-09T01:00:00.000Z",
      time_out: "2026-08-09T03:00:00.000Z",
    };
    const harness = loadServiceWithMocks({
      getHouseholdSummaryById: async () => {
        events.push("SUMMARY");
        return {
          id: "household-local-archived",
          disaster_event_id: "event-1",
          barangay_id: "barangay-a",
          is_active: false,
        };
      },
      getHouseholdSummaryByIdForUpdate: async (_householdId, dbClient) => {
        events.push(`LOCK:${Boolean(dbClient)}`);
        return {
          id: "household-local-archived",
          disaster_event_id: "event-1",
          barangay_id: "barangay-a",
          is_active: false,
        };
      },
      getLatestAttendanceByHouseholdId: async (householdId, dbClient) => {
        events.push(`LATEST:${householdId}:${Boolean(dbClient)}`);
        return acceptedAttendance;
      },
      getActiveEvacuationLogsByHouseholdId: async () => {
        events.push("ACTIVE_LOGS");
        throw new Error("Duplicate departure must not inspect active logs");
      },
      markHouseholdDeparture: async () => {
        events.push("MARK_DEPARTURE");
        throw new Error("Duplicate departure must not mark departure again");
      },
      updateHouseholdDepartureTimestamp: async () => {
        events.push("REWRITE_DEPARTURE_TIME");
        throw new Error("Duplicate departure must not rewrite accepted time_out");
      },
      archiveHousehold: async () => {
        events.push("ARCHIVE");
        throw new Error("Duplicate departure must not archive again");
      },
      deactivateEvacueesByHouseholdId: async () => {
        events.push("DEACTIVATE");
        throw new Error("Duplicate departure must not deactivate evacuees again");
      },
    });

    try {
      await assert.rejects(
        harness.service.departHousehold(
          "household-local-archived",
          {
            departure_time: incomingTime,
            allow_duplicate_departure_resolution: true,
          },
          {
            userId: "barangay-user-a",
            roleCode: "BARANGAY",
            defaultBarangayId: "barangay-a",
          },
        ),
        (error) => {
          assert.equal(error.statusCode, 409);
          assert.equal(error.code, "DUPLICATE_HOUSEHOLD_DEPARTURE");
          assert.equal(error.entityServerId, "household-local-archived");
          assert.deepEqual(error.serverPayload, acceptedAttendance);
          return true;
        },
      );

      assert.deepEqual(events, [
        "SUMMARY",
        "LOCK:true",
        "LATEST:household-local-archived:true",
      ]);
    } finally {
      harness.restore();
    }
  });
});

test("BRG-SC-06-H01 TEST C keeps same-Barangay departure success unchanged", async () => {
  const events = [];
  const externalClient = {
    query: async (query) => {
      events.push(`SQL:${String(query).trim()}`);
      return { rows: [] };
    },
  };
  const harness = loadServiceWithMocks({
    getHouseholdSummaryById: async () => {
      events.push("SUMMARY");
      return {
        id: "household-local",
        disaster_event_id: "event-1",
        barangay_id: "barangay-a",
        family_head_first_name: "Local",
        family_head_last_name: "Family",
        is_active: true,
      };
    },
    getHouseholdSummaryByIdForUpdate: async (_householdId, dbClient) => {
      events.push(`LOCK:${dbClient === externalClient}`);
      return {
        id: "household-local",
        disaster_event_id: "event-1",
        barangay_id: "barangay-a",
        family_head_first_name: "Local",
        family_head_last_name: "Family",
        is_active: true,
      };
    },
    getActiveEvacuationLogsByHouseholdId: async () => {
      events.push("ACTIVE_LOGS");
      return [{ id: "log-1" }];
    },
    markHouseholdDeparture: async (_householdId, _details, dbClient) => {
      events.push(`MARK:${dbClient === externalClient}`);
      return [{ id: "log-1", time_out: "2026-08-09T03:00:00.000Z" }];
    },
    archiveHousehold: async (_householdId, dbClient) => {
      events.push(`ARCHIVE:${dbClient === externalClient}`);
      return {
        id: "household-local",
        barangay_id: "barangay-a",
        is_active: false,
      };
    },
    deactivateEvacueesByHouseholdId: async (_householdId, dbClient) => {
      events.push(`DEACTIVATE:${dbClient === externalClient}`);
      return [{ id: "evacuee-1" }];
    },
  });

  try {
    const result = await harness.service.departHousehold(
      "household-local",
      {
        departure_time: "2026-08-09T03:00:00.000Z",
      },
      {
        userId: "barangay-user-a",
        roleCode: "BARANGAY",
        defaultBarangayId: "barangay-a",
      },
      { dbClient: externalClient },
    );

    assert.equal(result.household_id, "household-local");
    assert.equal(result.status, "ARCHIVED");
    assert.equal(result.affected_logs_count, 1);
    assert.equal(result.archived_members_count, 1);
    assert.deepEqual(events, [
      "SUMMARY",
      "LOCK:true",
      "ACTIVE_LOGS",
      "MARK:true",
      "ARCHIVE:true",
      "DEACTIVATE:true",
    ]);
  } finally {
    harness.restore();
  }
});

test("BRG-SC-06-H01 TEST D preserves MSWDO broader departure access", async () => {
  const events = [];
  const externalClient = {
    query: async () => ({ rows: [] }),
  };
  const harness = loadServiceWithMocks({
    getHouseholdSummaryById: async () => ({
      id: "household-mswdo",
      disaster_event_id: "event-1",
      barangay_id: "barangay-foreign",
      family_head_first_name: "Municipal",
      family_head_last_name: "Access",
      is_active: true,
    }),
    getActiveEvacuationLogsByHouseholdId: async () => {
      events.push("ACTIVE_LOGS");
      return [{ id: "log-1" }];
    },
    markHouseholdDeparture: async () => {
      events.push("MARK");
      return [{ id: "log-1", time_out: "2026-08-09T03:00:00.000Z" }];
    },
    archiveHousehold: async () => {
      events.push("ARCHIVE");
      return { id: "household-mswdo", barangay_id: "barangay-foreign" };
    },
    deactivateEvacueesByHouseholdId: async () => {
      events.push("DEACTIVATE");
      return [];
    },
  });

  try {
    const result = await harness.service.departHousehold(
      "household-mswdo",
      {
        departure_time: "2026-08-09T03:00:00.000Z",
      },
      {
        userId: "mswdo-user",
        roleCode: "MSWDO",
        defaultBarangayId: null,
      },
      { dbClient: externalClient },
    );

    assert.equal(result.status, "ARCHIVED");
    assert.deepEqual(events, ["ACTIVE_LOGS", "MARK", "ARCHIVE", "DEACTIVATE"]);
  } finally {
    harness.restore();
  }
});

test("BRG-SC-06-M01 revalidates changed household state after acquiring departure lock", async () => {
  const events = [];
  const externalClient = {
    query: async () => ({ rows: [] }),
  };
  const acceptedAttendance = {
    id: "accepted-log-1",
    household_id: "household-race",
    status: "LEFT",
    time_out: "2026-08-09T03:00:00.000Z",
  };
  const harness = loadServiceWithMocks({
    getHouseholdSummaryById: async (_householdId, dbClient) => {
      events.push(`SCOPE:${dbClient === externalClient}`);
      return {
        id: "household-race",
        disaster_event_id: "event-1",
        barangay_id: "barangay-a",
        is_active: true,
      };
    },
    getHouseholdSummaryByIdForUpdate: async (_householdId, dbClient) => {
      events.push(`LOCK:${dbClient === externalClient}`);
      return {
        id: "household-race",
        disaster_event_id: "event-1",
        barangay_id: "barangay-a",
        is_active: false,
      };
    },
    getLatestAttendanceByHouseholdId: async (_householdId, dbClient) => {
      events.push(`LATEST:${dbClient === externalClient}`);
      return acceptedAttendance;
    },
    getActiveEvacuationLogsByHouseholdId: async () => {
      events.push("ACTIVE_LOGS");
      throw new Error("Changed locked state must not inspect active logs");
    },
    markHouseholdDeparture: async () => {
      events.push("MARK");
      throw new Error("Changed locked state must not mutate");
    },
  });

  try {
    await assert.rejects(
      harness.service.departHousehold(
        "household-race",
        {
          departure_time: "2026-08-09T03:01:00.000Z",
          allow_duplicate_departure_resolution: true,
        },
        {
          userId: "barangay-user-a",
          roleCode: "BARANGAY",
          defaultBarangayId: "barangay-a",
        },
        { dbClient: externalClient },
      ),
      (error) => {
        assert.equal(error.code, "DUPLICATE_HOUSEHOLD_DEPARTURE");
        assert.deepEqual(error.serverPayload, acceptedAttendance);
        return true;
      },
    );

    assert.deepEqual(events, ["SCOPE:true", "LOCK:true", "LATEST:true"]);
  } finally {
    harness.restore();
  }
});

test("BRG-SC-06-M01 uses the same supplied dbClient for departure reads and writes", async () => {
  const events = [];
  const externalClient = {
    query: async (query) => {
      events.push(`SQL:${String(query).trim()}`);
      return { rows: [] };
    },
  };
  const household = {
    id: "household-client",
    disaster_event_id: "event-1",
    barangay_id: "barangay-a",
    family_head_first_name: "Client",
    family_head_last_name: "Check",
    is_active: true,
  };
  const harness = loadServiceWithMocks({
    getHouseholdSummaryById: async (_householdId, dbClient) => {
      events.push(`SCOPE:${dbClient === externalClient}`);
      return household;
    },
    getHouseholdSummaryByIdForUpdate: async (_householdId, dbClient) => {
      events.push(`LOCK:${dbClient === externalClient}`);
      return household;
    },
    getActiveEvacuationLogsByHouseholdId: async (_householdId, dbClient) => {
      events.push(`ACTIVE:${dbClient === externalClient}`);
      return [{ id: "log-1" }];
    },
    markHouseholdDeparture: async (_householdId, _details, dbClient) => {
      events.push(`MARK:${dbClient === externalClient}`);
      return [{ id: "log-1", time_out: "2026-08-09T03:00:00.000Z" }];
    },
    archiveHousehold: async (_householdId, dbClient) => {
      events.push(`ARCHIVE:${dbClient === externalClient}`);
      return { ...household, is_active: false };
    },
    deactivateEvacueesByHouseholdId: async (_householdId, dbClient) => {
      events.push(`DEACTIVATE:${dbClient === externalClient}`);
      return [];
    },
  });

  try {
    const result = await harness.service.departHousehold(
      "household-client",
      {
        departure_time: "2026-08-09T03:00:00.000Z",
      },
      {
        userId: "barangay-user-a",
        roleCode: "BARANGAY",
        defaultBarangayId: "barangay-a",
      },
      { dbClient: externalClient },
    );

    assert.equal(result.status, "ARCHIVED");
    assert.deepEqual(events, [
      "SCOPE:true",
      "LOCK:true",
      "ACTIVE:true",
      "MARK:true",
      "ARCHIVE:true",
      "DEACTIVATE:true",
    ]);
  } finally {
    harness.restore();
  }
});

test("BRG-SC-06-M01 HTTP departure owns one local transaction around reads and writes", async () => {
  const events = [];
  const fakeClient = {
    query: async (query) => {
      events.push(String(query).trim());
      return { rows: [] };
    },
    release: () => {
      events.push("RELEASE");
    },
  };
  const household = {
    id: "household-http",
    disaster_event_id: "event-1",
    barangay_id: "barangay-a",
    family_head_first_name: "Http",
    family_head_last_name: "Path",
    is_active: true,
  };
  const harness = loadServiceWithMocks(
    {
      getHouseholdSummaryById: async (_householdId, dbClient) => {
        events.push(`SCOPE:${dbClient === fakeClient}`);
        return household;
      },
      getHouseholdSummaryByIdForUpdate: async (_householdId, dbClient) => {
        events.push(`LOCK:${dbClient === fakeClient}`);
        return household;
      },
      getActiveEvacuationLogsByHouseholdId: async (_householdId, dbClient) => {
        events.push(`ACTIVE:${dbClient === fakeClient}`);
        return [{ id: "log-1" }];
      },
      markHouseholdDeparture: async (_householdId, _details, dbClient) => {
        events.push(`MARK:${dbClient === fakeClient}`);
        return [{ id: "log-1", time_out: "2026-08-09T03:00:00.000Z" }];
      },
      archiveHousehold: async (_householdId, dbClient) => {
        events.push(`ARCHIVE:${dbClient === fakeClient}`);
        return { ...household, is_active: false };
      },
      deactivateEvacueesByHouseholdId: async (_householdId, dbClient) => {
        events.push(`DEACTIVATE:${dbClient === fakeClient}`);
        return [];
      },
    },
    {
      connect: async () => fakeClient,
    },
  );

  try {
    const result = await harness.service.departHousehold(
      "household-http",
      {
        departure_time: "2026-08-09T03:00:00.000Z",
      },
      {
        userId: "barangay-user-a",
        roleCode: "BARANGAY",
        defaultBarangayId: "barangay-a",
      },
    );

    assert.equal(result.status, "ARCHIVED");
    assert.deepEqual(events, [
      "BEGIN",
      "SCOPE:true",
      "LOCK:true",
      "ACTIVE:true",
      "MARK:true",
      "ARCHIVE:true",
      "DEACTIVATE:true",
      "COMMIT",
      "RELEASE",
    ]);
  } finally {
    harness.restore();
  }
});

test("BRG-SC-06-M01 supplied sync transaction client is reused without nested BEGIN", async () => {
  const events = [];
  const externalClient = {
    query: async (query) => {
      events.push(String(query).trim());
      throw new Error("departHousehold must not issue transaction control on supplied dbClient");
    },
  };
  const household = {
    id: "household-sync",
    disaster_event_id: "event-1",
    barangay_id: "barangay-a",
    family_head_first_name: "Sync",
    family_head_last_name: "Path",
    is_active: true,
  };
  const harness = loadServiceWithMocks({
    getHouseholdSummaryById: async (_householdId, dbClient) => {
      events.push(`SCOPE:${dbClient === externalClient}`);
      return household;
    },
    getHouseholdSummaryByIdForUpdate: async (_householdId, dbClient) => {
      events.push(`LOCK:${dbClient === externalClient}`);
      return household;
    },
    getActiveEvacuationLogsByHouseholdId: async (_householdId, dbClient) => {
      events.push(`ACTIVE:${dbClient === externalClient}`);
      return [{ id: "log-1" }];
    },
    markHouseholdDeparture: async (_householdId, _details, dbClient) => {
      events.push(`MARK:${dbClient === externalClient}`);
      return [{ id: "log-1", time_out: "2026-08-09T03:00:00.000Z" }];
    },
    archiveHousehold: async (_householdId, dbClient) => {
      events.push(`ARCHIVE:${dbClient === externalClient}`);
      return { ...household, is_active: false };
    },
    deactivateEvacueesByHouseholdId: async (_householdId, dbClient) => {
      events.push(`DEACTIVATE:${dbClient === externalClient}`);
      return [];
    },
  });

  try {
    const result = await harness.service.departHousehold(
      "household-sync",
      {
        departure_time: "2026-08-09T03:00:00.000Z",
      },
      {
        userId: "barangay-user-a",
        roleCode: "BARANGAY",
        defaultBarangayId: "barangay-a",
      },
      { dbClient: externalClient },
    );

    assert.equal(result.status, "ARCHIVED");
    assert.deepEqual(events, [
      "SCOPE:true",
      "LOCK:true",
      "ACTIVE:true",
      "MARK:true",
      "ARCHIVE:true",
      "DEACTIVATE:true",
    ]);
  } finally {
    harness.restore();
  }
});

test("BRG-SC-06-M01 zero affected departure rows cannot return success", async () => {
  const events = [];
  const externalClient = {
    query: async () => ({ rows: [] }),
  };
  const household = {
    id: "household-zero",
    disaster_event_id: "event-1",
    barangay_id: "barangay-a",
    family_head_first_name: "Zero",
    family_head_last_name: "Rows",
    is_active: true,
  };
  const harness = loadServiceWithMocks({
    getHouseholdSummaryById: async (_householdId, dbClient) => {
      events.push(`SUMMARY:${dbClient === externalClient}`);
      return household;
    },
    getHouseholdSummaryByIdForUpdate: async (_householdId, dbClient) => {
      events.push(`LOCK:${dbClient === externalClient}`);
      return household;
    },
    getActiveEvacuationLogsByHouseholdId: async (_householdId, dbClient) => {
      events.push(`ACTIVE:${dbClient === externalClient}`);
      return [{ id: "log-1" }];
    },
    markHouseholdDeparture: async (_householdId, _details, dbClient) => {
      events.push(`MARK:${dbClient === externalClient}`);
      return [];
    },
    archiveHousehold: async () => {
      events.push("ARCHIVE");
      throw new Error("Zero affected rows must not archive");
    },
    deactivateEvacueesByHouseholdId: async () => {
      events.push("DEACTIVATE");
      throw new Error("Zero affected rows must not deactivate evacuees");
    },
  });

  try {
    await assert.rejects(
      harness.service.departHousehold(
        "household-zero",
        {
          departure_time: "2026-08-09T03:00:00.000Z",
          allow_duplicate_departure_resolution: true,
        },
        {
          userId: "barangay-user-a",
          roleCode: "BARANGAY",
          defaultBarangayId: "barangay-a",
        },
        { dbClient: externalClient },
      ),
      (error) => {
        assert.equal(error.statusCode, 409);
        assert.equal(error.code, "HOUSEHOLD_DEPARTURE_STATE_CONSUMED");
        return true;
      },
    );

    assert.deepEqual(events, [
      "SUMMARY:true",
      "LOCK:true",
      "ACTIVE:true",
      "MARK:true",
      "SUMMARY:true",
    ]);
  } finally {
    harness.restore();
  }
});

test("restoreHousehold creates an independent occurrence and protects archived snapshots", async () => {
  const sourceHouseholdId = "household-archived";
  const sourceHeadId = "head-1";
  const sourceMemberId = "member-1";
  const targetHouseholdId = "household-readmitted";
  const targetHeadId = "readmitted-head-1";
  const targetMemberId = "readmitted-member-1";
  const secondHouseholdId = "household-readmitted-2";
  const secondHeadId = "readmitted-head-2";
  const secondMemberIds = [
    "readmitted-member-2-1",
    "readmitted-member-2-2",
  ];
  const sourceStubId = "stub-1";
  const targetStubId = "stub-readmitted-1";
  const secondStubId = "stub-readmitted-2";
  const occurrenceIds = {
    [targetHouseholdId]: {
      headId: targetHeadId,
      memberIds: [targetMemberId],
    },
    [secondHouseholdId]: {
      headId: secondHeadId,
      memberIds: secondMemberIds,
    },
  };
  const readmissionHouseholdIds = [targetHouseholdId, secondHouseholdId];
  const readmissionStubIds = [targetStubId, secondStubId];
  const successorHouseholdIdBySource = {
    [sourceHouseholdId]: targetHouseholdId,
  };
  const events = [];
  const householdRecords = {
    [sourceHouseholdId]: {
      id: sourceHouseholdId,
      disaster_event_id: "event-1",
      disaster_event_status: "ACTIVE",
      barangay_id: "barangay-1",
      evacuation_center_id: "center-1",
      residency_status: "RESIDENT",
      family_head_first_name: "JUAN",
      family_head_middle_name: null,
      family_head_last_name: "DELA CRUZ",
      family_head_suffix: null,
      sex: "MALE",
      birth_date: null,
      current_stay_type: "EVAC_CENTER",
      current_address_details: "Zone 1",
      contact_number: "09171234567",
      household_size: 2,
      is_active: false,
      registered_by: "user-1",
      family_head_photo_url: null,
      photo_captured_at: null,
      photo_captured_by: null,
      photo_verification_notes: null,
      registered_at: "2026-08-09T09:00:00.000Z",
      updated_at: "2026-08-09T10:00:00.000Z",
      family_head_evacuee_id: sourceHeadId,
    },
  };
  const membersByHouseholdId = {
    [sourceHouseholdId]: [
      {
        id: sourceHeadId,
        household_id: sourceHouseholdId,
        first_name: "JUAN",
        middle_name: null,
        last_name: "DELA CRUZ",
        suffix: null,
        sex: "MALE",
        birth_date: null,
        age: 40,
        age_value: 40,
        age_unit: "YEARS",
        civil_status: null,
        relationship_to_head: "HEAD",
        is_family_head: true,
        is_pregnant: false,
        is_lactating: false,
        has_disability: false,
        is_active: false,
      },
      {
        id: sourceMemberId,
        household_id: sourceHouseholdId,
        first_name: "MARIA",
        middle_name: null,
        last_name: "DELA CRUZ",
        suffix: null,
        sex: "FEMALE",
        birth_date: null,
        age: 12,
        age_value: 12,
        age_unit: "YEARS",
        civil_status: null,
        relationship_to_head: "DAUGHTER",
        is_family_head: false,
        is_pregnant: false,
        is_lactating: false,
        has_disability: false,
        is_active: false,
      },
    ],
  };
  const evacuationLogsByHouseholdId = {
    [sourceHouseholdId]: [
      {
        id: "old-log-head",
        household_id: sourceHouseholdId,
        evacuee_id: sourceHeadId,
        evacuation_center_id: "center-1",
        status: "LEFT",
        time_in: "2026-08-09T09:00:00.000Z",
        time_out: "2026-08-09T10:00:00.000Z",
      },
      {
        id: "old-log-member",
        household_id: sourceHouseholdId,
        evacuee_id: sourceMemberId,
        evacuation_center_id: "center-1",
        status: "LEFT",
        time_in: "2026-08-09T09:00:00.000Z",
        time_out: "2026-08-09T10:00:00.000Z",
      },
    ],
  };
  const stubsByHouseholdId = {
    [sourceHouseholdId]: {
      id: sourceStubId,
      household_id: sourceHouseholdId,
      disaster_event_id: "event-1",
      stub_no: "STUB-OLD",
      serial_no: "SER-OLD",
      status: "CLAIMED",
    },
  };
  const distributionByStubId = {
    [sourceStubId]: {
      id: "distribution-old",
      household_id: sourceHouseholdId,
      stub_id: sourceStubId,
      distribution_status: "CLAIMED",
    },
  };
  const privacyByHouseholdId = {
    [sourceHouseholdId]: {
      id: "privacy-old",
      household_id: sourceHouseholdId,
      disaster_event_id: "event-1",
      consent_status: "ACKNOWLEDGED",
      notice_version: "v1",
      acknowledged_at: "2026-08-09T08:00:00.000Z",
      acknowledged_by_name: "JUAN DELA CRUZ",
      representative_relationship: null,
      recorded_by: "user-1",
    },
  };
  let readmissionSequence = 0;
  let currentCreatedHouseholdId = null;
  let nextNonHeadMemberIndex = 0;
  const fakeClient = {
    query: async (query) => {
      const command = String(query).trim().split(/\s+/)[0];
      if (["BEGIN", "COMMIT", "ROLLBACK"].includes(command)) {
        events.push(command);
      }
      return { rows: [] };
    },
    release: () => events.push("RELEASE"),
  };
  const getHousehold = (householdId) => householdRecords[householdId] || null;
  const getMembers = (householdId, options = {}) => {
    const members = membersByHouseholdId[householdId] || [];
    return members
      .filter((member) => options.includeInactive || member.is_active)
      .map((member) => ({ ...member }));
  };
  const getLatestAttendance = (householdId) => {
    const logs = evacuationLogsByHouseholdId[householdId] || [];
    return logs[logs.length - 1] || null;
  };
  const harness = loadServiceWithMocks(
    {
      getHouseholdSummaryById: async (householdId) => getHousehold(householdId),
      getHouseholdSummaryByIdForUpdate: async (householdId, dbClient) => {
        events.push(`LOCK:${dbClient === fakeClient}`);
        return getHousehold(householdId);
      },
      getEvacueesByHouseholdId: async (householdId, options) =>
        getMembers(householdId, options),
      getEvacueeSectorAssignmentsByHouseholdId: async () => [],
      getHouseholdSectorAssignmentsByHouseholdId: async () => [],
      getStubByHouseholdId: async (householdId) =>
        stubsByHouseholdId[householdId] || null,
      getLatestAttendanceByHouseholdId: async (householdId) =>
        getLatestAttendance(householdId),
      getLatestDistributionTransactionByStubId: async (stubId) =>
        distributionByStubId[stubId] || null,
      getLatestHouseholdPrivacyConsentByHouseholdId: async (householdId) =>
        privacyByHouseholdId[householdId] || null,
      getEvacuationCenterById: async () => ({
        id: "center-1",
        barangay_id: "barangay-1",
        is_active: true,
      }),
      getActiveEvacuationLogsByHouseholdId: async (householdId) =>
        (evacuationLogsByHouseholdId[householdId] || []).filter(
          (log) => log.status === "PRESENT" && !log.time_out,
        ),
      getActiveHouseholdSuccessorById: async (householdId) =>
        householdRecords[successorHouseholdIdBySource[householdId]]?.is_active
          ? householdRecords[successorHouseholdIdBySource[householdId]]
          : null,
      getSectorsByIds: async () => [],
      getSectorsByCodes: async () => [{ id: "adult-sector", code: "ADULT" }],
      getAgeGroupSectors: async () => [{ id: "adult-sector", code: "ADULT" }],
      insertHousehold: async (payload) => {
        events.push("INSERT_HOUSEHOLD");
        const householdId = readmissionHouseholdIds[readmissionSequence];
        const occurrence = occurrenceIds[householdId];
        currentCreatedHouseholdId = householdId;
        nextNonHeadMemberIndex = 0;
        readmissionSequence += 1;
        const household = {
          id: householdId,
          disaster_event_id: payload.disaster_event_id,
          disaster_event_status: "ACTIVE",
          barangay_id: payload.barangay_id,
          evacuation_center_id: payload.evacuation_center_id,
          residency_status: payload.residency_status,
          family_head_first_name: payload.family_head.first_name,
          family_head_middle_name: payload.family_head.middle_name,
          family_head_last_name: payload.family_head.last_name,
          family_head_suffix: payload.family_head.suffix,
          sex: payload.family_head.sex,
          birth_date: null,
          current_stay_type: payload.current_stay_type,
          current_address_details: payload.current_address_details,
          contact_number: payload.contact_number,
          household_size: payload.household_size,
          is_active: true,
          registered_by: payload.registered_by,
          family_head_photo_url: payload.family_head_photo_url || null,
          photo_captured_at: null,
          photo_captured_by: null,
          photo_verification_notes: payload.photo_verification_notes || null,
          registered_at:
            householdId === secondHouseholdId
              ? "2026-08-09T13:00:00.000Z"
              : "2026-08-09T11:00:00.000Z",
          updated_at:
            householdId === secondHouseholdId
              ? "2026-08-09T13:00:00.000Z"
              : "2026-08-09T11:00:00.000Z",
          family_head_evacuee_id: null,
        };
        assert.ok(occurrence, `No occurrence identity configured for ${householdId}`);
        householdRecords[householdId] = household;
        return household;
      },
      insertHouseholdPrivacyConsent: async (payload) => {
        const consent = {
          id: `privacy-${currentCreatedHouseholdId}`,
          ...payload,
        };
        privacyByHouseholdId[currentCreatedHouseholdId] = consent;
        return consent;
      },
      insertEvacuee: async (householdId, member) => {
        const occurrence = occurrenceIds[householdId];
        const configuredMemberId = occurrence?.memberIds[nextNonHeadMemberIndex];
        const id = member.is_family_head
          ? occurrence?.headId
          : configuredMemberId || `new-member-${householdId}-${nextNonHeadMemberIndex}`;
        if (!member.is_family_head) {
          nextNonHeadMemberIndex += 1;
        }
        const createdMember = {
          household_id: householdId,
          ...member,
          id,
          is_active: true,
        };
        membersByHouseholdId[householdId] = [
          ...(membersByHouseholdId[householdId] || []),
          createdMember,
        ];
        events.push(`INSERT_EVACUEE:${id}`);
        return createdMember;
      },
      insertEvacueeSectors: async () => [],
      updateHouseholdFamilyHeadEvacueeId: async (householdId, memberId) => {
        householdRecords[householdId].family_head_evacuee_id = memberId;
      },
      insertHouseholdSectors: async () => [],
      deleteHouseholdSectorsByHouseholdId: async () => {},
      deleteEvacueeSectorsByEvacueeId: async () => {},
      deactivateEvacuee: async () => {},
      updateHousehold: async (householdId, payload) => {
        const household = householdRecords[householdId];
        Object.assign(household, {
          evacuation_center_id: payload.evacuation_center_id,
          residency_status: payload.residency_status,
          contact_number: payload.contact_number,
          current_stay_type: payload.current_stay_type,
          current_address_details: payload.current_address_details,
          household_size: payload.household_size,
        });
        return household;
      },
      updateEvacuee: async (memberId, member) => {
        const householdId = Object.keys(membersByHouseholdId).find((candidateHouseholdId) =>
          (membersByHouseholdId[candidateHouseholdId] || []).some(
            (candidate) => candidate.id === memberId,
          ),
        );
        const existingMember = (membersByHouseholdId[householdId] || []).find(
          (candidate) => candidate.id === memberId,
        );
        Object.assign(existingMember, member);
        return existingMember;
      },
      insertEvacuationLog: async (payload) => {
        const logs = evacuationLogsByHouseholdId[payload.household_id] || [];
        const createdLog = {
          id: `new-log-${logs.length + 1}-${payload.household_id}`,
          ...payload,
          time_in: payload.time_in || `2026-08-09T11:${logs.length}0:00.000Z`,
          time_out: null,
        };
        evacuationLogsByHouseholdId[payload.household_id] = [
          ...logs,
          createdLog,
        ];
        events.push(`INSERT_LOG:${payload.household_id}:${payload.evacuee_id}`);
        return createdLog;
      },
      generateStubNumbers: async () => ({
        stub_no: "STUB-NEW",
        serial_no: "SER-NEW",
      }),
      insertStub: async (payload) => {
        const stubId = readmissionStubIds[readmissionSequence - 1];
        const stub = {
          id: stubId,
          ...payload,
        };
        stubsByHouseholdId[currentCreatedHouseholdId] = stub;
        events.push("INSERT_STUB");
        return stub;
      },
    },
    {
      connect: async () => fakeClient,
    },
  );

  try {
    const historicalSnapshot = structuredClone({
      household: householdRecords[sourceHouseholdId],
      members: membersByHouseholdId[sourceHouseholdId],
      logs: evacuationLogsByHouseholdId[sourceHouseholdId],
      stub: stubsByHouseholdId[sourceHouseholdId],
      distribution: distributionByStubId[sourceStubId],
      privacy: privacyByHouseholdId[sourceHouseholdId],
    });

    const result = await harness.service.restoreHousehold({
      householdId: sourceHouseholdId,
      requester: {
        userId: "user-1",
        roleCode: "BARANGAY",
        defaultBarangayId: "barangay-1",
      },
      restoreData: {
        restore_mode: "RETURN_TO_EVAC_CENTER",
      },
    });

    assert.equal(result.household_id, targetHouseholdId);
    assert.equal(result.source_household_id, sourceHouseholdId);
    assert.equal(result.status, "ACTIVE");
    assert.equal(result.household.id, targetHouseholdId);
    assert.equal(result.household.is_active, true);
    assert.notEqual(result.household.family_head_evacuee_id, sourceHeadId);
    assert.notEqual(stubsByHouseholdId[targetHouseholdId].id, sourceStubId);
    assert.equal(events.includes("RESTORE:true"), false);
    assert.equal(events.includes("REACTIVATE:true"), false);
    assert.deepEqual(
      {
        household: householdRecords[sourceHouseholdId],
        members: membersByHouseholdId[sourceHouseholdId],
        logs: evacuationLogsByHouseholdId[sourceHouseholdId],
        stub: stubsByHouseholdId[sourceHouseholdId],
        distribution: distributionByStubId[sourceStubId],
        privacy: privacyByHouseholdId[sourceHouseholdId],
      },
      historicalSnapshot,
    );
    assert.deepEqual(
      membersByHouseholdId[targetHouseholdId].map((member) => member.id),
      [targetHeadId, targetMemberId],
    );

    await assert.rejects(
      harness.service.restoreHousehold({
        householdId: sourceHouseholdId,
        requester: {
          userId: "user-1",
          roleCode: "BARANGAY",
          defaultBarangayId: "barangay-1",
        },
        restoreData: {
          restore_mode: "RETURN_TO_EVAC_CENTER",
        },
      }),
      (error) => {
        assert.equal(error.statusCode, 400);
        assert.equal(error.code, "HOUSEHOLD_ALREADY_ADMITTED");
        assert.equal(error.message, "This household is already admitted.");
        return true;
      },
    );

    const editedResult = await harness.service.updateHouseholdDetails({
      householdId: targetHouseholdId,
      requester: {
        userId: "user-1",
        roleCode: "BARANGAY",
        defaultBarangayId: "barangay-1",
      },
      requestData: {
        disaster_event_id: "event-1",
        barangay_id: "barangay-1",
        residency_status: "RESIDENT",
        evacuation_center_id: "center-1",
        current_stay_type: "EVAC_CENTER",
        contact_number: "09999999999",
        current_address_details: "Zone 2",
        members: [
          {
            id: targetMemberId,
            first_name: "MARIA UPDATED",
            middle_name: null,
            last_name: "DELA CRUZ",
            suffix: null,
            sex: "FEMALE",
            age_value: 12,
            age_unit: "YEARS",
            relationship_to_head: "DAUGHTER",
            sector_ids: [],
          },
          {
            first_name: "PEDRO",
            middle_name: null,
            last_name: "DELA CRUZ",
            suffix: null,
            sex: "MALE",
            age_value: 10,
            age_unit: "YEARS",
            relationship_to_head: "SON",
            sector_ids: [],
          },
        ],
        household_sector_ids: [],
      },
    });

    assert.equal(editedResult.household.contact_number, "09999999999");
    assert.equal(editedResult.household.current_address_details, "Zone 2");
    assert.equal(editedResult.household.household_size, 3);
    assert.equal(
      membersByHouseholdId[sourceHouseholdId][1].first_name,
      "MARIA",
    );
    assert.equal(
      membersByHouseholdId[sourceHouseholdId].length,
      historicalSnapshot.members.length,
    );

    const eventBHouseholdId = "household-event-b";
    const eventBHeadId = "event-b-head-1";
    const eventBHousehold = {
      ...structuredClone(householdRecords[targetHouseholdId]),
      id: eventBHouseholdId,
      disaster_event_id: "event-2",
      contact_number: "09080000000",
      current_address_details: "Event B Zone 1",
      family_head_evacuee_id: eventBHeadId,
      registered_at: "2027-08-09T09:00:00.000Z",
    };
    householdRecords[eventBHouseholdId] = eventBHousehold;
    membersByHouseholdId[eventBHouseholdId] = [
      {
        ...structuredClone(membersByHouseholdId[targetHouseholdId][0]),
        id: eventBHeadId,
        household_id: eventBHouseholdId,
        is_family_head: true,
        is_active: true,
      },
    ];
    privacyByHouseholdId[eventBHouseholdId] = {
      ...structuredClone(privacyByHouseholdId[targetHouseholdId]),
      id: "privacy-event-b",
      household_id: eventBHouseholdId,
      disaster_event_id: "event-2",
    };
    const eventASnapshotBeforeEventBEdit = structuredClone({
      household: householdRecords[sourceHouseholdId],
      members: membersByHouseholdId[sourceHouseholdId],
      logs: evacuationLogsByHouseholdId[sourceHouseholdId],
    });
    const eventBEditResult = await harness.service.updateHouseholdDetails({
      householdId: eventBHouseholdId,
      requester: {
        userId: "user-1",
        roleCode: "BARANGAY",
        defaultBarangayId: "barangay-1",
      },
      requestData: {
        disaster_event_id: "event-2",
        barangay_id: "barangay-1",
        residency_status: "RESIDENT",
        evacuation_center_id: "center-1",
        current_stay_type: "EVAC_CENTER",
        contact_number: "09081111111",
        current_address_details: "Event B Zone 2",
        members: [],
        household_sector_ids: [],
      },
    });

    assert.equal(eventBEditResult.household.disaster_event_id, "event-2");
    assert.equal(eventBEditResult.household.contact_number, "09081111111");
    assert.equal(eventBEditResult.household.current_address_details, "Event B Zone 2");
    assert.deepEqual(
      {
        household: householdRecords[sourceHouseholdId],
        members: membersByHouseholdId[sourceHouseholdId],
        logs: evacuationLogsByHouseholdId[sourceHouseholdId],
      },
      eventASnapshotBeforeEventBEdit,
    );

    householdRecords[targetHouseholdId].is_active = false;
    membersByHouseholdId[targetHouseholdId].forEach((member) => {
      member.is_active = false;
    });
    evacuationLogsByHouseholdId[targetHouseholdId] = (
      evacuationLogsByHouseholdId[targetHouseholdId] || []
    ).map((log) => ({
      ...log,
      status: "LEFT",
      time_out: "2026-08-09T14:00:00.000Z",
    }));
    successorHouseholdIdBySource[targetHouseholdId] = secondHouseholdId;
    const firstArchivedSnapshot = structuredClone({
      household: householdRecords[targetHouseholdId],
      members: membersByHouseholdId[targetHouseholdId],
      logs: evacuationLogsByHouseholdId[targetHouseholdId],
      stub: stubsByHouseholdId[targetHouseholdId],
      privacy: privacyByHouseholdId[targetHouseholdId],
    });

    const secondResult = await harness.service.restoreHousehold({
      householdId: targetHouseholdId,
      requester: {
        userId: "user-1",
        roleCode: "BARANGAY",
        defaultBarangayId: "barangay-1",
      },
      restoreData: {
        restore_mode: "RETURN_TO_EVAC_CENTER",
      },
    });

    assert.equal(secondResult.household_id, secondHouseholdId);
    assert.equal(secondResult.source_household_id, targetHouseholdId);
    assert.deepEqual(
      membersByHouseholdId[secondHouseholdId].map((member) => member.id),
      [secondHeadId, ...secondMemberIds],
    );
    assert.equal(stubsByHouseholdId[secondHouseholdId].id, secondStubId);

    const newestEditedResult = await harness.service.updateHouseholdDetails({
      householdId: secondHouseholdId,
      requester: {
        userId: "user-1",
        roleCode: "BARANGAY",
        defaultBarangayId: "barangay-1",
      },
      requestData: {
        disaster_event_id: "event-1",
        barangay_id: "barangay-1",
        residency_status: "RESIDENT",
        evacuation_center_id: "center-1",
        current_stay_type: "EVAC_CENTER",
        contact_number: "08888888888",
        current_address_details: "Zone 3",
        members: [
          {
            id: secondMemberIds[0],
            first_name: "MARIA SECOND UPDATED",
            middle_name: null,
            last_name: "DELA CRUZ",
            suffix: null,
            sex: "FEMALE",
            age_value: 12,
            age_unit: "YEARS",
            relationship_to_head: "DAUGHTER",
            sector_ids: [],
          },
        ],
        household_sector_ids: [],
      },
    });

    assert.equal(newestEditedResult.household.contact_number, "08888888888");
    assert.equal(newestEditedResult.household.current_address_details, "Zone 3");
    assert.equal(newestEditedResult.household.household_size, 2);
    assert.deepEqual(
      {
        household: householdRecords[targetHouseholdId],
        members: membersByHouseholdId[targetHouseholdId],
        logs: evacuationLogsByHouseholdId[targetHouseholdId],
        stub: stubsByHouseholdId[targetHouseholdId],
        privacy: privacyByHouseholdId[targetHouseholdId],
      },
      firstArchivedSnapshot,
    );
    assert.deepEqual(
      {
        household: householdRecords[sourceHouseholdId],
        members: membersByHouseholdId[sourceHouseholdId],
        logs: evacuationLogsByHouseholdId[sourceHouseholdId],
        stub: stubsByHouseholdId[sourceHouseholdId],
        distribution: distributionByStubId[sourceStubId],
        privacy: privacyByHouseholdId[sourceHouseholdId],
      },
      historicalSnapshot,
    );
  } finally {
    harness.restore();
  }
});

test("restoreHousehold blocks a household with an existing open admission", async () => {
  const harness = loadServiceWithMocks({
    getHouseholdSummaryById: async () => ({
      id: "household-active",
      disaster_event_id: "event-1",
      barangay_id: "barangay-1",
      evacuation_center_id: "center-1",
      residency_status: "RESIDENT",
      family_head_first_name: "HOSHI",
      family_head_last_name: "KWON",
      current_stay_type: "EVAC_CENTER",
      current_address_details: "Purok 1",
      contact_number: "09170000000",
      household_size: 2,
      is_active: true,
      registered_by: "user-1",
      family_head_evacuee_id: "head-1",
    }),
    getEvacueesByHouseholdId: async () => [
      {
        id: "head-1",
        household_id: "household-active",
        first_name: "HOSHI",
        last_name: "KWON",
        is_family_head: true,
      },
    ],
    getEvacueeSectorAssignmentsByHouseholdId: async () => [],
    getHouseholdSectorAssignmentsByHouseholdId: async () => [],
    getStubByHouseholdId: async () => null,
    getLatestAttendanceByHouseholdId: async () => ({
      id: "open-log",
      status: "PRESENT",
      time_in: "2026-08-09T11:00:00.000Z",
      time_out: null,
      evacuation_center_id: "center-1",
    }),
    getLatestDistributionTransactionByStubId: async () => null,
    getLatestHouseholdPrivacyConsentByHouseholdId: async () => ({
      id: "privacy-1",
      consent_status: "ACKNOWLEDGED",
      notice_version: "v1",
      acknowledged_at: "2026-08-04T03:32:00.000Z",
    }),
    getActiveEvacuationLogsByHouseholdId: async () => [
      {
        id: "open-log",
        status: "PRESENT",
        time_in: "2026-08-09T11:00:00.000Z",
        time_out: null,
      },
    ],
    restoreHousehold: async () => {
      throw new Error("restoreHousehold should not be called when admission is open");
    },
  });

  try {
    await assert.rejects(
      harness.service.restoreHousehold({
        householdId: "household-active",
        requester: {
          userId: "user-1",
          roleCode: "BARANGAY",
          defaultBarangayId: "barangay-1",
        },
        restoreData: {
          restore_mode: "RETURN_TO_EVAC_CENTER",
        },
      }),
      (error) => {
        assert.equal(error.statusCode, 400);
        assert.match(error.message, /already admitted/i);
        return true;
      },
    );
  } finally {
    harness.restore();
  }
});

test("getHouseholdDetails returns the selected evacuation log instead of the latest attendance when requested", async () => {
  const latestAttendance = {
    id: "log-latest",
    household_id: "household-history-1",
    status: "PRESENT",
    time_in: "2026-08-09T11:51:00.000Z",
    time_out: null,
  };
  const historicalAttendance = {
    id: "log-history",
    household_id: "household-history-1",
    status: "LEFT",
    time_in: "2026-08-09T09:43:00.000Z",
    time_out: "2026-08-09T09:44:00.000Z",
  };
  let selectedLogLookup = 0;
  const harness = loadServiceWithMocks({
    getHouseholdSummaryById: async () => ({
      id: "household-history-1",
      barangay_id: "barangay-1",
      disaster_event_id: "event-1",
      disaster_event_status: "ACTIVE",
      family_head_first_name: "Gerardo",
      family_head_last_name: "Katigbak",
      current_stay_type: "EVAC_CENTER",
      is_active: true,
    }),
    getEvacueesByHouseholdId: async () => [],
    getEvacueeSectorAssignmentsByHouseholdId: async () => [],
    getHouseholdSectorAssignmentsByHouseholdId: async () => [],
    getStubByHouseholdId: async () => null,
    getLatestAttendanceByHouseholdId: async () => latestAttendance,
    getLatestDistributionTransactionByStubId: async () => null,
    getLatestHouseholdPrivacyConsentByHouseholdId: async () => null,
    getEvacuationLogByIdForHousehold: async (householdId, evacuationLogId) => {
      selectedLogLookup += 1;
      assert.equal(householdId, "household-history-1");
      assert.equal(evacuationLogId, "log-history");
      return historicalAttendance;
    },
  });

  try {
    const result = await harness.service.getHouseholdDetails({
      householdId: "household-history-1",
      evacuationLogId: "log-history",
      requester: {
        userId: "barangay-user-1",
        roleCode: "BARANGAY",
        defaultBarangayId: "barangay-1",
      },
    });

    assert.equal(selectedLogLookup, 1);
    assert.deepEqual(result.latest_attendance, historicalAttendance);
    assert.notDeepEqual(result.latest_attendance, latestAttendance);
    assert.equal(result.household.id, "household-history-1");
  } finally {
    harness.restore();
  }
});

test("updateHouseholdDetails validates members against persisted family head without registration-only variable", async () => {
  const fakeClient = {
    query: async () => ({ rows: [] }),
    release: () => {},
  };
  let updateHouseholdCalls = 0;
  let insertHouseholdCalls = 0;
  const existingHousehold = {
    id: "household-edit-1",
    disaster_event_id: "event-1",
    disaster_event_status: "ACTIVE",
    barangay_id: "barangay-1",
    evacuation_center_id: "center-1",
    residency_status: "RESIDENT",
    family_head_first_name: "Ana",
    family_head_middle_name: null,
    family_head_last_name: "Dela Cruz",
    family_head_suffix: null,
    sex: "FEMALE",
    current_stay_type: "EVAC_CENTER",
    current_address_details: "Purok 1",
    contact_number: "+639171234567",
    household_size: 2,
    is_active: true,
    family_head_evacuee_id: "head-1",
  };
  const existingMembers = [
    {
      id: "head-1",
      household_id: "household-edit-1",
      first_name: "Ana",
      middle_name: null,
      last_name: "Dela Cruz",
      suffix: null,
      sex: "FEMALE",
      age_value: 34,
      age_unit: "YEARS",
      relationship_to_head: "HEAD",
      is_family_head: true,
      is_active: true,
    },
    {
      id: "member-1",
      household_id: "household-edit-1",
      first_name: "Marco",
      middle_name: null,
      last_name: "Dela Cruz",
      suffix: null,
      sex: "MALE",
      age_value: 12,
      age_unit: "YEARS",
      relationship_to_head: "SON",
      is_family_head: false,
      is_active: true,
    },
  ];
  const harness = loadServiceWithMocks(
    {
      getHouseholdSummaryById: async () => existingHousehold,
      getLatestHouseholdPrivacyConsentByHouseholdId: async () => ({
        id: "privacy-1",
        consent_status: "ACKNOWLEDGED",
        notice_version: "v1",
      }),
      getEvacueesByHouseholdId: async () => existingMembers,
      getEvacueeSectorAssignmentsByHouseholdId: async () => [],
      getHouseholdSectorAssignmentsByHouseholdId: async () => [],
      getSectorsByIds: async () => [],
      getSectorsByCodes: async () => [{ id: "adult-sector", code: "ADULT" }],
      getAgeGroupSectors: async () => [{ id: "adult-sector", code: "ADULT" }],
      updateHousehold: async (_householdId, payload) => {
        updateHouseholdCalls += 1;
        existingHousehold.contact_number = payload.contact_number;
        existingHousehold.household_size = payload.household_size;
        return existingHousehold;
      },
      deleteEvacueeSectorsByEvacueeId: async () => {},
      deactivateEvacuee: async () => {},
      getActiveEvacuationLogsByHouseholdId: async () => [],
      updateEvacuee: async (_memberId, member) => ({
        id: "member-1",
        ...member,
      }),
      insertEvacuee: async () => {
        insertHouseholdCalls += 1;
        throw new Error("member insert should not be needed");
      },
      insertEvacueeSectors: async () => {},
      deleteHouseholdSectorsByHouseholdId: async () => {},
      insertHouseholdSectors: async () => {},
      getStubByHouseholdId: async () => null,
      getLatestAttendanceByHouseholdId: async () => null,
      getLatestDistributionTransactionByStubId: async () => null,
    },
    {
      connect: async () => fakeClient,
    },
  );

  try {
    const result = await harness.service.updateHouseholdDetails({
      householdId: "household-edit-1",
      requester: {
        userId: "barangay-user-1",
        roleCode: "BARANGAY",
        defaultBarangayId: "barangay-1",
      },
      requestData: {
        disaster_event_id: "event-1",
        barangay_id: "barangay-1",
        residency_status: "RESIDENT",
        evacuation_center_id: "center-1",
        current_stay_type: "EVAC_CENTER",
        registered_by: "barangay-user-1",
        contact_number: "+639179999999",
        current_address_details: "Purok 2",
        members: [
          {
            id: "member-1",
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
      },
    });

    assert.equal(result.household.id, "household-edit-1");
    assert.equal(updateHouseholdCalls, 1);
    assert.equal(insertHouseholdCalls, 0);
    assert.equal(result.active_cross_event_information, undefined);
  } finally {
    harness.restore();
  }
});

test("updateHouseholdDetails rejects direct edits to a departed historical occurrence", async () => {
  let updateCalled = false;
  const harness = loadServiceWithMocks({
    getHouseholdSummaryById: async () => ({
      id: "household-archived-edit",
      disaster_event_id: "event-1",
      disaster_event_status: "ACTIVE",
      barangay_id: "barangay-1",
      current_stay_type: "EVAC_CENTER",
      is_active: false,
    }),
    updateHousehold: async () => {
      updateCalled = true;
      throw new Error("Historical household must not be mutated");
    },
  });

  try {
    await assert.rejects(
      harness.service.updateHouseholdDetails({
        householdId: "household-archived-edit",
        requester: {
          userId: "user-1",
          roleCode: "BARANGAY",
          defaultBarangayId: "barangay-1",
        },
        requestData: {
          disaster_event_id: "event-1",
          barangay_id: "barangay-1",
        },
      }),
      (error) => {
        assert.equal(error.statusCode, 400);
        assert.equal(error.code, "HISTORICAL_HOUSEHOLD_IMMUTABLE");
        assert.equal(error.message, "Archived households cannot be edited");
        return true;
      },
    );
    assert.equal(updateCalled, false);
  } finally {
    harness.restore();
  }
});

test("EE-FIX-02 updateHouseholdDetails blocks authorized non-ACTIVE disaster events before ordinary update validation", async () => {
  for (const disasterEventStatus of ["PLANNED", "CLOSED", "ARCHIVED"]) {
    let privacyReadCalled = false;
    let updateCalled = false;
    const harness = loadServiceWithMocks({
      getHouseholdSummaryById: async () => ({
        id: "household-ee-fix-02",
        disaster_event_id: "event-1",
        disaster_event_status: disasterEventStatus,
        barangay_id: "barangay-1",
        residency_status: "RESIDENT",
        current_stay_type: "RELATIVES",
        is_active: false,
        updated_at: "2026-08-08T01:00:00.000Z",
      }),
      getLatestHouseholdPrivacyConsentByHouseholdId: async () => {
        privacyReadCalled = true;
        return null;
      },
      updateHousehold: async () => {
        updateCalled = true;
        throw new Error("non-ACTIVE event must not mutate");
      },
    });

    try {
      await assert.rejects(
        harness.service.updateHouseholdDetails({
          householdId: "household-ee-fix-02",
          requester: {
            userId: "barangay-user-1",
            roleCode: "BARANGAY",
            defaultBarangayId: "barangay-1",
          },
          requestData: {
            disaster_event_id: "event-1",
            barangay_id: "barangay-1",
          },
        }),
        (error) => {
          assert.equal(error.code, "DISASTER_EVENT_NOT_ACTIVE");
          assert.equal(error.statusCode, 400);
          assert.match(error.message, /disaster event is not active/i);
          return true;
        },
      );

      assert.equal(privacyReadCalled, false, disasterEventStatus);
      assert.equal(updateCalled, false, disasterEventStatus);
    } finally {
      harness.restore();
    }
  }
});
