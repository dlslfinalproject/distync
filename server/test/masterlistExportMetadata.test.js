const assert = require("node:assert/strict");
const express = require("express");
const test = require("node:test");

const EVENT_ID = "11111111-1111-4111-8111-111111111111";
const MISSING_EVENT_ID = "22222222-2222-4222-8222-222222222222";
const BARANGAY_A = "33333333-3333-4333-8333-333333333333";
const BARANGAY_B = "44444444-4444-4444-8444-444444444444";
const SECTOR_PWD = "55555555-5555-4555-8555-555555555555";
const SECTOR_PREGNANT = "66666666-6666-4666-8666-666666666666";
const SECTOR_FOUR_PS = "77777777-7777-4777-8777-777777777777";
const SECTOR_CHILD_HEADED = "88888888-8888-4888-8888-888888888888";
const SECTOR_SENIOR = "99999999-9999-4999-8999-999999999999";

const canonicalSectorCode = (code) => {
  const aliases = {
    LACTATING: "LACTATING_MOTHER",
    INFANT_0_6_MONTHS: "INFANT",
    TODDLER_7M_2Y: "TODDLER",
    PRESCHOOL_3_5: "PRE_SCHOOLER",
    CHILD_6_12: "SCHOOL_AGE",
    TEEN_13_17: "TEENAGE",
    ADULT_18_59: "ADULT",
    SENIOR_60_ABOVE: "SENIOR_CITIZEN",
  };

  return aliases[code] || code;
};

const isOperationallyActive = (row) => {
  if (!row || row.is_active === false) {
    return false;
  }

  const latestStatus = String(row.latest_attendance?.status || "").toUpperCase();

  return !row.latest_attendance?.time_out && latestStatus !== "LEFT";
};

const scopeLegacyRows = (rows, recordStatus) => {
  if (recordStatus === "archived") {
    return rows.filter((row) => !isOperationallyActive(row));
  }

  if (recordStatus === "all") {
    return rows;
  }

  return rows.filter(isOperationallyActive);
};

const deriveLegacyOptions = (rows, recordStatus) => {
  const scopedRows = scopeLegacyRows(rows, recordStatus);
  const barangayIds = new Set();
  const sectorCodes = new Set();
  const sectorIds = new Set();

  scopedRows.forEach((row) => {
    if (row.barangay?.id) {
      barangayIds.add(row.barangay.id);
    }

    [
      ...(row.household_sectors || []),
      ...(row.members || []).flatMap((member) => member.sectors || []),
    ].forEach((sector) => {
      if (sector.id) {
        sectorIds.add(sector.id);
      }

      const code = canonicalSectorCode(sector.code);

      if (code) {
        sectorCodes.add(code);
      }
    });
  });

  return {
    barangay_ids: [...barangayIds],
    sector_ids: [...sectorIds],
    sector_codes: [...sectorCodes],
  };
};

const buildRepresentativeLegacyRows = () => [
  {
    household_id: "household-active-a",
    is_active: true,
    barangay: { id: BARANGAY_A },
    household_sectors: [
      { id: SECTOR_PWD, code: "PWD" },
      { id: SECTOR_PWD, code: "PWD" },
    ],
    members: [
      {
        is_active: true,
        sectors: [{ id: SECTOR_PREGNANT, code: "PREGNANT" }],
      },
      {
        is_active: false,
        sectors: [{ id: SECTOR_FOUR_PS, code: "FOUR_PS" }],
      },
    ],
    latest_attendance: { status: "PRESENT", time_out: null },
  },
  {
    household_id: "household-active-b",
    is_active: true,
    barangay: { id: BARANGAY_B },
    household_sectors: [],
    members: [
      {
        is_active: true,
        sectors: [{ id: SECTOR_SENIOR, code: "SENIOR_60_ABOVE" }],
      },
      { is_active: true, sectors: [] },
    ],
    latest_attendance: null,
  },
  {
    household_id: "household-archived-a",
    is_active: false,
    barangay: { id: BARANGAY_A },
    household_sectors: [{ id: SECTOR_CHILD_HEADED, code: "CHILD_HEADED" }],
    members: [{ is_active: false, sectors: [] }],
    latest_attendance: null,
  },
  {
    household_id: "household-left-b",
    is_active: true,
    barangay: { id: BARANGAY_B },
    household_sectors: [],
    members: [
      {
        is_active: true,
        sectors: [{ id: SECTOR_PWD, code: "PWD" }],
      },
    ],
    latest_attendance: { status: "LEFT", time_out: "2026-09-08T01:00:00.000Z" },
  },
  {
    household_id: "household-active-c",
    is_active: true,
    barangay: { id: BARANGAY_A },
    household_sectors: [{ id: SECTOR_PREGNANT, code: "PREGNANT" }],
    members: [
      {
        is_active: true,
        sectors: [
          { id: SECTOR_PWD, code: "PWD" },
          { id: SECTOR_SENIOR, code: "SENIOR_60_ABOVE" },
        ],
      },
    ],
    latest_attendance: { status: "PRESENT", time_out: null },
  },
  {
    household_id: "household-no-sectors",
    is_active: true,
    barangay: { id: BARANGAY_B },
    household_sectors: [],
    members: [{ is_active: true, sectors: [] }],
    latest_attendance: { status: "PRESENT", time_out: null },
  },
];

const buildMetadataRowsFromLegacyRows = (rows, recordStatus) => {
  return scopeLegacyRows(rows, recordStatus).map((row) => ({
    household_id: row.household_id,
    barangay_id: row.barangay?.id || null,
    household_sector_rows: row.household_sectors || [],
    member_sector_rows: (row.members || []).flatMap(
      (member) => member.sectors || [],
    ),
  }));
};

const deriveMetadataOptions = (rows) => {
  const barangayIds = new Set();
  const sectorIds = new Set();
  const sectorCodes = new Set();

  rows.forEach((row) => {
    if (row.barangay_id) {
      barangayIds.add(row.barangay_id);
    }

    [...row.household_sector_rows, ...row.member_sector_rows].forEach((sector) => {
      if (sector.id) {
        sectorIds.add(sector.id);
      }

      if (sector.code) {
        sectorCodes.add(canonicalSectorCode(String(sector.code).toUpperCase()));
      }
    });
  });

  return {
    barangay_ids: [...barangayIds],
    sector_ids: [...sectorIds],
    sector_codes: [...sectorCodes],
  };
};

const restoreModuleCache = (entries) => {
  entries.forEach(([modulePath, originalEntry]) => {
    if (originalEntry) {
      require.cache[modulePath] = originalEntry;
    } else {
      delete require.cache[modulePath];
    }
  });
};

test("export metadata parity preserves the legacy option universe", () => {
  const rows = buildRepresentativeLegacyRows();

  ["active", "archived", "all"].forEach((recordStatus) => {
    const legacyOptions = deriveLegacyOptions(rows, recordStatus);
    const metadataOptions = deriveMetadataOptions(
      buildMetadataRowsFromLegacyRows(rows, recordStatus),
    );

    assert.deepEqual(metadataOptions, legacyOptions);
  });

  assert.deepEqual(deriveLegacyOptions([], "all"), {
    barangay_ids: [],
    sector_ids: [],
    sector_codes: [],
  });

  const noSectorEventRows = [
    {
      household_id: "event-without-sectors",
      is_active: true,
      barangay: { id: BARANGAY_A },
      household_sectors: [],
      members: [{ is_active: true, sectors: [] }],
      latest_attendance: null,
    },
  ];

  assert.deepEqual(deriveMetadataOptions(buildMetadataRowsFromLegacyRows(
    noSectorEventRows,
    "all",
  )), {
    barangay_ids: [BARANGAY_A],
    sector_ids: [],
    sector_codes: [],
  });
});

test("metadata repository performs one parameterized, PII-free set query", async () => {
  const repositoryPath = require.resolve("../src/repositories/masterlist.repository");
  const poolPath = require.resolve("../src/config/db");
  const originalEntries = [
    [repositoryPath, require.cache[repositoryPath]],
    [poolPath, require.cache[poolPath]],
  ];
  const calls = [];

  delete require.cache[repositoryPath];
  require.cache[poolPath] = {
    id: poolPath,
    filename: poolPath,
    loaded: true,
    exports: {
      query: async (query, values) => {
        calls.push({ query, values });
        return {
          rows: [
            {
              barangay_ids: [BARANGAY_A],
              sector_ids: [SECTOR_PWD],
              sector_codes: ["PWD"],
            },
          ],
        };
      },
    },
  };

  try {
    const repository = require(repositoryPath);
    const metadata = await repository.getMswdoMasterlistExportMetadata(
      EVENT_ID,
      "active",
    );

    assert.deepEqual(metadata, {
      barangay_ids: [BARANGAY_A],
      sector_ids: [SECTOR_PWD],
      sector_codes: ["PWD"],
    });
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0].values, [EVENT_ID, "active"]);
    assert.match(calls[0].query, /WITH household_scope AS/);
    assert.match(calls[0].query, /h\.disaster_event_id = \$1/);
    assert.match(calls[0].query, /\$2::text = 'active'/);
    assert.match(calls[0].query, /household_sectors/);
    assert.match(calls[0].query, /evacuee_sectors/);
    assert.match(calls[0].query, /ARRAY_AGG\(DISTINCT/);
    assert.doesNotMatch(
      calls[0].query,
      /family_head_(first|middle|last|suffix)|contact_number|attendance_log_id|stub_no|assigned_relief|photo/i,
    );
    assert.doesNotMatch(calls[0].query, /e\.is_active\s*=\s*TRUE/);
    assert.doesNotMatch(calls[0].query, /LIMIT\s+\$/i);
  } finally {
    delete require.cache[repositoryPath];
    restoreModuleCache(originalEntries);
  }
});

test("metadata service validates event existence without loading full masterlist data", async () => {
  const servicePath = require.resolve("../src/services/masterlist.service");
  const repositoryPath = require.resolve("../src/repositories/masterlist.repository");
  const disasterEventServicePath = require.resolve("../src/services/disasterEvent.service");
  const originalEntries = [
    [servicePath, require.cache[servicePath]],
    [repositoryPath, require.cache[repositoryPath]],
    [disasterEventServicePath, require.cache[disasterEventServicePath]],
  ];
  const calls = [];

  delete require.cache[servicePath];
  require.cache[repositoryPath] = {
    id: repositoryPath,
    filename: repositoryPath,
    loaded: true,
    exports: {
      getDisasterEventSummaryById: async (eventId) =>
        eventId === MISSING_EVENT_ID ? null : { id: eventId },
      getMswdoMasterlistExportMetadata: async (eventId, recordStatus) => {
        calls.push({ eventId, recordStatus });
        return {
          barangay_ids: [BARANGAY_A],
          sector_ids: [SECTOR_PWD],
          sector_codes: ["PWD"],
        };
      },
    },
  };
  require.cache[disasterEventServicePath] = {
    id: disasterEventServicePath,
    filename: disasterEventServicePath,
    loaded: true,
    exports: {
      syncOverdueActiveDisasterEvents: async () => {
        throw new Error("metadata endpoint must not perform lifecycle sync");
      },
    },
  };

  try {
    const service = require(servicePath);
    const metadata = await service.getMswdoMasterlistExportMetadata({
      disaster_event_id: EVENT_ID,
      record_status: "all",
    });

    assert.deepEqual(metadata, {
      filters: {
        disaster_event_id: EVENT_ID,
        record_status: "all",
      },
      barangay_ids: [BARANGAY_A],
      sector_ids: [SECTOR_PWD],
      sector_codes: ["PWD"],
    });
    assert.deepEqual(calls, [{ eventId: EVENT_ID, recordStatus: "all" }]);

    await assert.rejects(
      () =>
        service.getMswdoMasterlistExportMetadata({
          disaster_event_id: MISSING_EVENT_ID,
          record_status: "active",
        }),
      (error) => error.statusCode === 404 && error.message === "Disaster event not found",
    );
    assert.deepEqual(calls, [{ eventId: EVENT_ID, recordStatus: "all" }]);
  } finally {
    delete require.cache[servicePath];
    restoreModuleCache(originalEntries);
  }
});

const withStubbedMetadataRoute = async (serviceImpl, runTest) => {
  const routesPath = require.resolve("../src/routes/masterlist.routes");
  const authMiddlewarePath = require.resolve("../src/modules/auth/auth.middleware");
  const servicePath = require.resolve("../src/services/masterlist.service");
  const originalEntries = [
    [routesPath, require.cache[routesPath]],
    [authMiddlewarePath, require.cache[authMiddlewarePath]],
    [servicePath, require.cache[servicePath]],
  ];

  delete require.cache[routesPath];
  require.cache[authMiddlewarePath] = {
    id: authMiddlewarePath,
    filename: authMiddlewarePath,
    loaded: true,
    exports: {
      ROLE_CODES: {
        BARANGAY: "BARANGAY",
        MSWDO: "MSWDO",
        MAYOR: "MAYOR",
        DONOR: "DONOR",
      },
      requireAuthentication: (req, res, next) => {
        const roleCode = req.headers["x-test-role"];

        if (!roleCode) {
          return res.status(401).json({
            message: "Authentication is required for this request",
          });
        }

        req.auth = { userId: "test-user", roleCode };
        return next();
      },
      requireRoles: (...allowedRoles) => (req, res, next) => {
        if (!allowedRoles.includes(req.auth?.roleCode)) {
          return res.status(403).json({
            message: "You do not have permission to access this resource",
          });
        }

        return next();
      },
    },
  };
  require.cache[servicePath] = {
    id: servicePath,
    filename: servicePath,
    loaded: true,
    exports: {
      getMswdoMasterlistExportMetadata: serviceImpl,
    },
  };

  try {
    await runTest(require(routesPath));
  } finally {
    delete require.cache[routesPath];
    restoreModuleCache(originalEntries);
  }
};

const listen = async (router) => {
  const app = express();
  app.use(express.json());
  app.use("/api/v1/masterlist", router);

  return new Promise((resolve) => {
    const server = app.listen(0, () => resolve(server));
  });
};

const closeServer = (server) =>
  new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });

test("metadata route is MSWDO-only and returns a strict PII-free allowlist", async () => {
  const calls = [];

  await withStubbedMetadataRoute(
    async (filters) => {
      calls.push(filters);
      return {
        filters,
        barangay_ids: [BARANGAY_A],
        sector_ids: [SECTOR_PWD],
        sector_codes: ["PWD"],
      };
    },
    async (router) => {
      const server = await listen(router);

      try {
        const baseUrl = `http://127.0.0.1:${server.address().port}/api/v1/masterlist/export-metadata`;
        const allowedResponse = await fetch(
          `${baseUrl}?disaster_event_id=${EVENT_ID}&record_status=all`,
          { headers: { "x-test-role": "MSWDO" } },
        );
        const allowedPayload = await allowedResponse.json();

        assert.equal(allowedResponse.status, 200);
        assert.deepEqual(Object.keys(allowedPayload).sort(), [
          "barangay_ids",
          "filters",
          "sector_codes",
          "sector_ids",
        ]);
        assert.deepEqual(Object.keys(allowedPayload.filters).sort(), [
          "disaster_event_id",
          "record_status",
        ]);
        assert.deepEqual(allowedPayload, {
          filters: {
            disaster_event_id: EVENT_ID,
            record_status: "all",
          },
          barangay_ids: [BARANGAY_A],
          sector_ids: [SECTOR_PWD],
          sector_codes: ["PWD"],
        });

        for (const role of ["BARANGAY", "MAYOR", "DONOR"]) {
          const response = await fetch(
            `${baseUrl}?disaster_event_id=${EVENT_ID}`,
            { headers: { "x-test-role": role } },
          );

          assert.equal(response.status, 403, `${role} must be denied`);
        }

        const unauthenticatedResponse = await fetch(
          `${baseUrl}?disaster_event_id=${EVENT_ID}`,
        );
        assert.equal(unauthenticatedResponse.status, 401);
      } finally {
        await closeServer(server);
      }
    },
  );

  assert.deepEqual(calls, [
    {
      disaster_event_id: EVENT_ID,
      record_status: "all",
    },
  ]);
});

test("metadata route validates UUID/status and propagates event-not-found", async () => {
  await withStubbedMetadataRoute(
    async (filters) => {
      if (filters.disaster_event_id === MISSING_EVENT_ID) {
        const error = new Error("Disaster event not found");
        error.statusCode = 404;
        throw error;
      }

      return {
        filters,
        barangay_ids: [],
        sector_ids: [],
        sector_codes: [],
      };
    },
    async (router) => {
      const server = await listen(router);

      try {
        const baseUrl = `http://127.0.0.1:${server.address().port}/api/v1/masterlist/export-metadata`;
        const invalidUuidResponse = await fetch(
          `${baseUrl}?disaster_event_id=not-a-uuid`,
          { headers: { "x-test-role": "MSWDO" } },
        );
        assert.equal(invalidUuidResponse.status, 400);

        const missingEventIdResponse = await fetch(baseUrl, {
          headers: { "x-test-role": "MSWDO" },
        });
        assert.equal(missingEventIdResponse.status, 400);

        const invalidStatusResponse = await fetch(
          `${baseUrl}?disaster_event_id=${EVENT_ID}&record_status=deleted`,
          { headers: { "x-test-role": "MSWDO" } },
        );
        assert.equal(invalidStatusResponse.status, 400);

        const missingEventResponse = await fetch(
          `${baseUrl}?disaster_event_id=${MISSING_EVENT_ID}&record_status=archived`,
          { headers: { "x-test-role": "MSWDO" } },
        );
        assert.equal(missingEventResponse.status, 404);

        const missingEventPayload = await missingEventResponse.json();
        assert.equal(missingEventPayload.message, "Disaster event not found");
      } finally {
        await closeServer(server);
      }
    },
  );
});
