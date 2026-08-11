const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const servicePath = path.resolve(
  __dirname,
  "../src/services/disasterEvent.service.js",
);
const dependencyPaths = {
  db: path.resolve(__dirname, "../src/config/db.js"),
  repository: path.resolve(
    __dirname,
    "../src/repositories/disasterEvent.repository.js",
  ),
  householdRepository: path.resolve(
    __dirname,
    "../src/repositories/householdRegistration.repository.js",
  ),
  settingsRepository: path.resolve(
    __dirname,
    "../src/repositories/settings.repository.js",
  ),
  disasterEventExport: path.resolve(
    __dirname,
    "../src/utils/disasterEventExport.js",
  ),
  notificationService: path.resolve(
    __dirname,
    "../src/modules/notifications/notification.service.js",
  ),
  mswdoReportExport: path.resolve(
    __dirname,
    "../src/utils/mswdoReportExport.js",
  ),
};

const loadServiceWithMocks = (repositoryOverrides = {}, exportOverrides = {}) => {
  const originalEntries = new Map();
  const mockRepository = {
    getActiveDisasterEvents: async () => [],
    getDisasterEventReportBarangayBreakdown: async () => [],
    ...repositoryOverrides,
  };
  const mockMswdoReportExport = {
    buildExportFile: async (payload) => ({
      payload,
      buffer: Buffer.from("report"),
      filename: "report.csv",
      contentType: "text/csv",
    }),
    ...exportOverrides,
  };

  const mockEntries = new Map([
    [dependencyPaths.db, { connect: async () => ({}) }],
    [dependencyPaths.repository, mockRepository],
    [dependencyPaths.householdRepository, {}],
    [dependencyPaths.settingsRepository, {}],
    [dependencyPaths.disasterEventExport, {}],
    [dependencyPaths.notificationService, { emitSafely: async () => {} }],
    [dependencyPaths.mswdoReportExport, mockMswdoReportExport],
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
    mockRepository,
    mockMswdoReportExport,
    restore,
  };
};

test("exportDisasterEventReportSummary applies ACTIVE status filtering authoritatively", async () => {
  const capturedCalls = [];
  const harness = loadServiceWithMocks({
    getDisasterEventReportBarangayBreakdown: async (filters) => {
      capturedCalls.push(filters);
      return [
        {
          title: "Flood Quiapo",
          barangay_name: "Bagong Pook",
          status: "ACTIVE",
          disaster_type: "Flood",
          registered_households_count: 3,
          distributed_aid_count: 2,
          claimed_stubs_count: 1,
          unclaimed_stubs_count: 1,
        },
      ];
    },
  });

  try {
    const result = await harness.service.exportDisasterEventReportSummary({
      event_selection: "ACTIVE",
      sort_order: "newest",
      format: "csv",
    });

    assert.deepEqual(capturedCalls[0].statuses, ["ACTIVE"]);
    assert.equal(capturedCalls[0].disasterEventId, null);
    assert.equal(
      result.payload.metadata[0].value,
      "Active disaster events",
    );
  } finally {
    harness.restore();
  }
});

test("exportDisasterEventReportSummary maps ENDED to the canonical ended statuses", async () => {
  const capturedCalls = [];
  const harness = loadServiceWithMocks({
    getDisasterEventReportBarangayBreakdown: async (filters) => {
      capturedCalls.push(filters);
      return [
        {
          title: "Typhoon Joseph",
          barangay_name: "Santiago",
          status: "CLOSED",
          disaster_type: "Typhoon",
          registered_households_count: 4,
          distributed_aid_count: 4,
          claimed_stubs_count: 3,
          unclaimed_stubs_count: 1,
        },
      ];
    },
  });

  try {
    await harness.service.exportDisasterEventReportSummary({
      event_selection: "ENDED",
      sort_order: "oldest",
      format: "csv",
    });

    assert.deepEqual(capturedCalls[0].statuses, ["CLOSED", "ARCHIVED"]);
  } finally {
    harness.restore();
  }
});

test("exportDisasterEventReportSummary uses the selected disaster event id for EVENT selections", async () => {
  const eventId = "11111111-1111-4111-8111-111111111111";
  const capturedCalls = [];
  const harness = loadServiceWithMocks({
    getDisasterEventReportBarangayBreakdown: async (filters) => {
      capturedCalls.push(filters);
      return [
        {
          title: "Flood Quiapo",
          barangay_name: "Luta del Norte",
          status: "ACTIVE",
          disaster_type: "Flood",
          registered_households_count: 2,
          distributed_aid_count: 1,
          claimed_stubs_count: 1,
          unclaimed_stubs_count: 0,
        },
      ];
    },
  });

  try {
    const result = await harness.service.exportDisasterEventReportSummary({
      event_selection: `EVENT:${eventId}`,
      sort_order: "az",
      format: "csv",
    });

    assert.equal(capturedCalls[0].disasterEventId, eventId);
    assert.equal(capturedCalls[0].statuses, null);
    assert.equal(result.payload.metadata[0].value, "Flood Quiapo");
  } finally {
    harness.restore();
  }
});

test("exportDisasterEventReportSummary returns a controlled empty-state message for aggregate selections", async () => {
  const harness = loadServiceWithMocks();

  try {
    await assert.rejects(
      harness.service.exportDisasterEventReportSummary({
        event_selection: "ACTIVE",
        sort_order: "newest",
        format: "csv",
      }),
      /No active disaster events are available for this report\./i,
    );
  } finally {
    harness.restore();
  }
});
