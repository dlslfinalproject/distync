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
    lockHouseholdRegistrationScope: async () => ({ id: "event-1" }),
    findPotentialDuplicatePersonMatches: async () => [],
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
        return { id: disasterEventId };
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
        return { id: disasterEventId };
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
      return { id: disasterEventId };
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

test("restoreHousehold re-admits the same household and creates new evacuation logs", async () => {
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
  const householdState = {
    id: "household-archived",
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
    is_active: false,
    registered_by: "user-1",
    family_head_evacuee_id: "head-1",
  };
  const evacuees = [
    {
      id: "head-1",
      household_id: "household-archived",
      first_name: "HOSHI",
      last_name: "KWON",
      age_value: 24,
      age_unit: "YEARS",
      sex: "MALE",
      relationship_to_head: "HEAD",
      is_family_head: true,
    },
    {
      id: "member-1",
      household_id: "household-archived",
      first_name: "WOOZI",
      last_name: "LEE",
      age_value: 23,
      age_unit: "YEARS",
      sex: "MALE",
      relationship_to_head: "BROTHER",
      is_family_head: false,
    },
  ];
  let latestAttendance = {
    id: "old-log",
    household_id: "household-archived",
    evacuee_id: "head-1",
    status: "LEFT",
    time_in: "2026-08-09T09:43:50.100Z",
    time_out: "2026-08-09T09:44:14.448Z",
    evacuation_center_id: "center-1",
  };
  let insertedLogCount = 0;

  const harness = loadServiceWithMocks(
    {
      getHouseholdSummaryById: async () => ({ ...householdState }),
      getEvacueesByHouseholdId: async () => evacuees,
      getEvacueeSectorAssignmentsByHouseholdId: async () => [],
      getHouseholdSectorAssignmentsByHouseholdId: async () => [],
      getStubByHouseholdId: async () => ({
        id: "stub-1",
        household_id: "household-archived",
      }),
      getLatestAttendanceByHouseholdId: async () => latestAttendance,
      getLatestDistributionTransactionByStubId: async () => null,
      getLatestHouseholdPrivacyConsentByHouseholdId: async () => ({
        id: "privacy-1",
        consent_status: "ACKNOWLEDGED",
        notice_version: "v1",
        acknowledged_at: "2026-08-04T03:32:00.000Z",
      }),
      getActiveEvacuationLogsByHouseholdId: async () => [],
      getEvacuationCenterById: async () => ({
        id: "center-1",
        barangay_id: "barangay-1",
        is_active: true,
      }),
      restoreHousehold: async (_householdId, dbClient) => {
        events.push(`RESTORE:${dbClient === fakeClient}`);
        householdState.is_active = true;
        return { ...householdState };
      },
      reactivateEvacueesByHouseholdId: async (_householdId, dbClient) => {
        events.push(`REACTIVATE:${dbClient === fakeClient}`);
        return evacuees;
      },
      updateHousehold: async (_householdId, payload, dbClient) => {
        events.push(`UPDATE_HOUSEHOLD:${dbClient === fakeClient}`);
        householdState.evacuation_center_id = payload.evacuation_center_id;
        householdState.current_stay_type = payload.current_stay_type;
        return { ...householdState };
      },
      insertEvacuationLog: async (payload, dbClient) => {
        insertedLogCount += 1;
        events.push(`INSERT_LOG:${payload.evacuee_id}:${dbClient === fakeClient}`);
        const createdLog = {
          id: `log-${insertedLogCount}`,
          household_id: payload.household_id,
          evacuee_id: payload.evacuee_id,
          evacuation_center_id: payload.evacuation_center_id,
          status: payload.status,
          time_in: `2026-08-09T11:3${insertedLogCount}:00.000Z`,
          time_out: null,
        };

        if (payload.evacuee_id === "head-1") {
          latestAttendance = createdLog;
        }

        return createdLog;
      },
      insertHousehold: async () => {
        throw new Error("insertHousehold should not be called during re-admission");
      },
      insertEvacuee: async () => {
        throw new Error("insertEvacuee should not be called during re-admission");
      },
      insertHouseholdPrivacyConsent: async () => {
        throw new Error("insertHouseholdPrivacyConsent should not be called during re-admission");
      },
    },
    {
      connect: async () => fakeClient,
    },
  );

  try {
    const result = await harness.service.restoreHousehold({
      householdId: "household-archived",
      requester: {
        userId: "user-1",
        roleCode: "BARANGAY",
        defaultBarangayId: "barangay-1",
      },
      restoreData: {
        restore_mode: "RETURN_TO_EVAC_CENTER",
      },
    });

    assert.equal(result.household_id, "household-archived");
    assert.equal(result.source_household_id, "household-archived");
    assert.equal(result.status, "ACTIVE");
    assert.equal(result.household.id, "household-archived");
    assert.equal(result.household.is_active, true);
    assert.equal(insertedLogCount, 2);
    assert.deepEqual(events, [
      "BEGIN",
      "RESTORE:true",
      "REACTIVATE:true",
      "UPDATE_HOUSEHOLD:true",
      "INSERT_LOG:head-1:true",
      "INSERT_LOG:member-1:true",
      "COMMIT",
      "RELEASE",
    ]);
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
