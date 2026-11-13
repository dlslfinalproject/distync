const assert = require("node:assert/strict");
const test = require("node:test");

const servicePath = require.resolve("../src/services/masterlist.service");
const repositoryPath = require.resolve("../src/repositories/masterlist.repository");
const disasterEventServicePath = require.resolve("../src/services/disasterEvent.service");
const authMiddlewarePath = require.resolve("../src/modules/auth/auth.middleware");
const reliefPackSnapshotPath = require.resolve("../src/utils/reliefPackAssignmentSnapshot");
const analyticsExportPath = require.resolve("../src/utils/mswdoAnalyticsReportExport");
const masterlistExportPath = require.resolve("../src/utils/masterlistExport");
const dependencyPaths = [
  repositoryPath,
  disasterEventServicePath,
  authMiddlewarePath,
  reliefPackSnapshotPath,
  analyticsExportPath,
  masterlistExportPath,
];

const canonicalBarangays = [
  ["BAGONG_POOK", "Bagong Pook"],
  ["BILUCAO", "Bilucao"],
  ["BULIHAN", "Bulihan"],
  ["LUTA_DEL_NORTE", "Luta del Norte"],
  ["LUTA_DEL_SUR", "Luta del Sur"],
  ["POBLACION", "Poblacion"],
  ["SAN_ANDRES", "San Andres"],
  ["SAN_FERNANDO", "San Fernando"],
  ["SAN_GREGORIO", "San Gregorio"],
  ["SAN_ISIDRO_EAST", "San Isidro East"],
  ["SAN_JUAN", "San Juan"],
  ["SAN_PEDRO_I", "San Pedro I"],
  ["SAN_PEDRO_II", "San Pedro II"],
  ["SAN_PIOQUINTO", "San Pioquinto"],
  ["SANTIAGO", "Santiago"],
];

const makeModule = (id, exports) => ({ id, filename: id, loaded: true, exports });

const withStubbedMasterlistService = async (repository, runTest) => {
  const originalEntries = new Map(
    [servicePath, ...dependencyPaths].map((modulePath) => [
      modulePath,
      require.cache[modulePath],
    ]),
  );
  const stubbedModules = new Map([
    [repositoryPath, repository],
    [disasterEventServicePath, { syncOverdueActiveDisasterEvents: async () => {} }],
    [authMiddlewarePath, { ROLE_CODES: { MSWDO: "MSWDO", BARANGAY: "BARANGAY" } }],
    [reliefPackSnapshotPath, {}],
    [analyticsExportPath, {}],
    [masterlistExportPath, {}],
  ]);

  delete require.cache[servicePath];
  for (const [modulePath, exports] of stubbedModules) {
    require.cache[modulePath] = makeModule(modulePath, exports);
  }

  try {
    await runTest(require(servicePath));
  } finally {
    delete require.cache[servicePath];
    for (const modulePath of dependencyPaths) {
      const originalEntry = originalEntries.get(modulePath);
      if (originalEntry) require.cache[modulePath] = originalEntry;
      else delete require.cache[modulePath];
    }
    const originalService = originalEntries.get(servicePath);
    if (originalService) require.cache[servicePath] = originalService;
  }
};

const buildReferenceRows = () =>
  canonicalBarangays.map(([barangayCode, barangayName], index) => ({
    barangay_id: `barangay-${index + 1}`,
    barangay_code: barangayCode,
    barangay_name: barangayName,
    is_affected: index === 0 || index === 2,
    issued_stubs: index === 0 ? "3" : 0,
    claimed_stubs: index === 0 ? "1" : 0,
    pending_relief_claims: index === 0 ? "2" : 0,
  }));

const buildAnalytics = ({ totalFamilies, admitted, rows }) => ({
  total_number_of_evacuees_individuals: 0,
  total_number_of_families: totalFamilies,
  average_household_size: 0,
  currently_admitted_evacuees: admitted,
  total_departed_evacuees: 0,
  total_barangays_covered: 0,
  per_barangay_chart_dataset: rows,
});

const buildRepository = ({ eventStatus = "ACTIVE", analyticsForBarangay }) => {
  const analyticsCalls = [];
  let referenceQueryCalls = 0;
  const repository = {
    getDisasterEventSummaryById: async () => ({
      id: "event-1",
      event_code: "EVT-1",
      title: "Test event",
      disaster_type: "FLOOD",
      status: eventStatus,
    }),
    getBarangaySummaryById: async (id) => ({ id, code: "BAGONG_POOK", name: "Bagong Pook" }),
    getMswdoMasterlistAnalytics: async (_eventId, barangayId = null) => {
      analyticsCalls.push(barangayId);
      return analyticsForBarangay(barangayId);
    },
    getMswdoBarangayHeatmapReferenceMetrics: async () => {
      referenceQueryCalls += 1;
      return buildReferenceRows();
    },
  };

  return { repository, analyticsCalls, getReferenceQueryCalls: () => referenceQueryCalls };
};

test("MSWDO heatmap stays event-wide and reconciles with existing analytics under a barangay filter", async () => {
  const selectedBarangayId = "barangay-1";
  const { repository, analyticsCalls, getReferenceQueryCalls } = buildRepository({
    eventStatus: "CLOSED",
    analyticsForBarangay: (barangayId) =>
      barangayId
        ? buildAnalytics({
            totalFamilies: 1,
            admitted: 1,
            rows: [{
              barangay_id: selectedBarangayId,
              families_count: "1",
              admitted_evacuees_count: "1",
            }],
          })
        : buildAnalytics({
            totalFamilies: 4,
            admitted: 2,
            rows: [
              {
                barangay_id: "barangay-1",
                families_count: "2",
                admitted_evacuees_count: "1",
              },
              {
                barangay_id: "barangay-6",
                families_count: "2",
                admitted_evacuees_count: "1",
              },
            ],
          }),
  });

  await withStubbedMasterlistService(repository, async (service) => {
    const dashboard = await service.getMswdoMasterlistDashboard({
      disaster_event_id: "event-1",
      barangay_id: selectedBarangayId,
    });
    const heatmap = dashboard.barangay_heatmap;

    assert.equal(dashboard.disaster_event.status, "CLOSED");
    assert.equal(dashboard.summary_metrics.total_number_of_families, 1);
    assert.equal(dashboard.charts.per_barangay.length, 1);
    assert.equal(heatmap.length, 15);
    assert.deepEqual(
      heatmap.map(({ barangay_code, barangay_name }) => [barangay_code, barangay_name]),
      canonicalBarangays,
    );
    assert.deepEqual(analyticsCalls, [selectedBarangayId, null]);
    assert.equal(getReferenceQueryCalls(), 1);

    const selectedRow = heatmap[0];
    assert.deepEqual(Object.keys(selectedRow), [
      "barangay_id",
      "barangay_code",
      "barangay_name",
      "is_affected",
      "registered_households",
      "active_evacuees",
      "issued_stubs",
      "claimed_stubs",
      "pending_relief_claims",
    ]);
    assert.equal(selectedRow.registered_households, 2);
    assert.equal(selectedRow.active_evacuees, 1);
    assert.equal(selectedRow.issued_stubs, 3);
    assert.equal(selectedRow.claimed_stubs, 1);
    assert.equal(selectedRow.pending_relief_claims, 2);
    assert.equal(selectedRow.issued_stubs, selectedRow.claimed_stubs + selectedRow.pending_relief_claims);

    assert.equal(heatmap[2].is_affected, true);
    assert.equal(heatmap[2].registered_households, 0);
    assert.equal(heatmap[2].active_evacuees, 0);
    assert.equal(heatmap[3].is_affected, false);
    assert.equal(heatmap[3].registered_households, 0);
    assert.equal(heatmap[3].active_evacuees, 0);
    assert.equal(heatmap[3].issued_stubs, 0);
    for (const row of heatmap) {
      for (const field of [
        "registered_households",
        "active_evacuees",
        "issued_stubs",
        "claimed_stubs",
        "pending_relief_claims",
      ]) {
        assert.equal(typeof row[field], "number");
      }
      assert.equal(row.issued_stubs, row.claimed_stubs + row.pending_relief_claims);
      assert.equal(Object.hasOwn(row, "distribution_coverage_percent"), false);
      assert.equal(Object.hasOwn(row, "household_name"), false);
    }

    assert.equal(
      heatmap.reduce((total, row) => total + row.registered_households, 0),
      4,
    );
    assert.equal(
      heatmap.reduce((total, row) => total + row.active_evacuees, 0),
      2,
    );
  });
});

test("MSWDO heatmap accepts active and ended event selections", async () => {
  for (const eventStatus of ["ACTIVE", "CLOSED"]) {
    const { repository, analyticsCalls } = buildRepository({
      eventStatus,
      analyticsForBarangay: () => buildAnalytics({
        totalFamilies: 0,
        admitted: 0,
        rows: [],
      }),
    });

    await withStubbedMasterlistService(repository, async (service) => {
      const dashboard = await service.getMswdoMasterlistDashboard({
        disaster_event_id: "event-1",
        barangay_id: null,
      });

      assert.equal(dashboard.disaster_event.status, eventStatus);
      assert.equal(dashboard.barangay_heatmap.length, 15);
      assert.deepEqual(analyticsCalls, [null]);
    });
  }
});
