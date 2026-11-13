const assert = require("node:assert/strict");
const test = require("node:test");

const EVENT_ID = "11111111-1111-4111-8111-111111111111";
const BARANGAY_A = "22222222-2222-4222-8222-222222222222";
const BARANGAY_B = "33333333-3333-4333-8333-333333333333";

const restoreModuleCache = (entries) => {
  entries.forEach(([modulePath, originalEntry]) => {
    if (originalEntry) {
      require.cache[modulePath] = originalEntry;
    } else {
      delete require.cache[modulePath];
    }
  });
};

const buildHouseholdRow = ({
  householdId,
  firstName,
  barangayId,
  barangayName,
  householdSize,
  timeIn,
}) => ({
  household_id: householdId,
  source_household_id: null,
  masterlist_record_id: `attendance-${householdId}`,
  family_head_first_name: firstName,
  family_head_middle_name: null,
  family_head_last_name: "Family",
  family_head_suffix: null,
  family_head_photo_url: null,
  household_size: householdSize,
  current_stay_type: "EVAC_CENTER",
  current_address_details: `${barangayName} address`,
  contact_number: null,
  is_active: true,
  registered_at: timeIn,
  attendance_log_id: `attendance-${householdId}`,
  attendance_status: "PRESENT",
  attendance_time_in: timeIn,
  attendance_time_out: null,
  attendance_evacuation_center_id: "44444444-4444-4444-8444-444444444444",
  barangay_id: barangayId,
  barangay_code: barangayName.slice(0, 3).toUpperCase(),
  barangay_name: barangayName,
});

test("MSWDO export summary follows selected modal filters", async () => {
  const servicePath = require.resolve("../src/services/masterlist.service");
  const repositoryPath = require.resolve("../src/repositories/masterlist.repository");
  const disasterEventServicePath = require.resolve("../src/services/disasterEvent.service");
  const exportUtilsPath = require.resolve("../src/utils/masterlistExport");
  const originalEntries = [
    [servicePath, require.cache[servicePath]],
    [repositoryPath, require.cache[repositoryPath]],
    [disasterEventServicePath, require.cache[disasterEventServicePath]],
    [exportUtilsPath, require.cache[exportUtilsPath]],
  ];
  const rows = [
    buildHouseholdRow({
      householdId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      firstName: "Anna",
      barangayId: BARANGAY_A,
      barangayName: "Bagong Pook",
      householdSize: 3,
      timeIn: "2026-09-15T01:00:00.000Z",
    }),
    buildHouseholdRow({
      householdId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      firstName: "Bella",
      barangayId: BARANGAY_B,
      barangayName: "Bulihan",
      householdSize: 8,
      timeIn: "2026-09-15T02:00:00.000Z",
    }),
  ];
  const calls = {
    sync: 0,
    dashboard: 0,
    getHouseholds: [],
    summary: null,
  };

  delete require.cache[servicePath];
  require.cache[repositoryPath] = {
    id: repositoryPath,
    filename: repositoryPath,
    loaded: true,
    exports: {
      getDisasterEventSummaryById: async () => ({
        id: EVENT_ID,
        event_code: "EVT-2026-001",
        title: "Test Flood Response",
        disaster_type: "Flood",
      }),
      getHouseholdsByFilters: async (...args) => {
        calls.getHouseholds.push(args);
        return rows;
      },
      getStubsByHouseholdIds: async () => [],
      getHouseholdSectorsByHouseholdIds: async () => [],
      getMembersByHouseholdIds: async () => [],
      getMemberSectorsByHouseholdIds: async () => [],
      getMswdoMasterlistAnalytics: async () => {
        calls.dashboard += 1;
        return {};
      },
    },
  };
  require.cache[disasterEventServicePath] = {
    id: disasterEventServicePath,
    filename: disasterEventServicePath,
    loaded: true,
    exports: {
      syncOverdueActiveDisasterEvents: async () => {
        calls.sync += 1;
      },
    },
  };

  const exportUtils = require(exportUtilsPath);
  const originalBuildExcelBuffer = exportUtils.buildExcelBuffer;
  exportUtils.buildExcelBuffer = async ({ summaryMetrics }) => {
    calls.summary = summaryMetrics;
    return Buffer.from("test workbook");
  };

  try {
    const service = require(servicePath);
    const result = await service.exportMswdoMasterlist({
      disaster_event_id: EVENT_ID,
      barangay_ids: [BARANGAY_A],
      barangay_id: null,
      sector_ids: [],
      record_status: "active",
      search: "Anna",
      sort_order: "newest",
      source_role: "MSWDO",
      format: "excel",
    });

    assert.equal(result.contentType, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    assert.equal(calls.sync, 1);
    assert.equal(calls.dashboard, 0);
    assert.deepEqual(calls.getHouseholds[0][3], {
      page: undefined,
      pageSize: undefined,
      search: undefined,
      sector_ids: undefined,
      sector_codes: undefined,
      sort_order: undefined,
      mode: "legacy",
    });
    assert.deepEqual(calls.summary, {
      total_number_of_evacuees_individuals: 3,
      total_number_of_families: 1,
      average_household_size: 3,
      currently_admitted_evacuees: 3,
      total_departed_evacuees: 0,
      total_barangays_covered: 1,
    });
  } finally {
    exportUtils.buildExcelBuffer = originalBuildExcelBuffer;
    delete require.cache[servicePath];
    restoreModuleCache(originalEntries);
  }
});
