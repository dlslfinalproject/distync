const test = require("node:test");
const assert = require("node:assert/strict");

const pool = require("../src/config/db");
const disasterEventRepository = require("../src/repositories/disasterEvent.repository");
const notificationService = require("../src/modules/notifications/notification.service");
const disasterEventService = require("../src/services/disasterEvent.service");

const originalPoolConnect = pool.connect;
const originalRepositoryMethods = {
  getActiveDisasterEvents: disasterEventRepository.getActiveDisasterEvents,
  findConflictingOpenDisasterEventByTitle:
    disasterEventRepository.findConflictingOpenDisasterEventByTitle,
  generateDisasterEventCode: disasterEventRepository.generateDisasterEventCode,
  insertDisasterEvent: disasterEventRepository.insertDisasterEvent,
  insertDisasterEventBarangays: disasterEventRepository.insertDisasterEventBarangays,
  getDisasterEventById: disasterEventRepository.getDisasterEventById,
  getAffectedBarangaysByDisasterEventId:
    disasterEventRepository.getAffectedBarangaysByDisasterEventId,
  getLatestHouseholdActivityByDisasterEventId:
    disasterEventRepository.getLatestHouseholdActivityByDisasterEventId,
  getHouseholdCountsByDisasterEventBarangayIds:
    disasterEventRepository.getHouseholdCountsByDisasterEventBarangayIds,
};
const originalNotificationMethods = {
  emitSafely: notificationService.emitSafely,
  emitDisasterEventCreated: notificationService.emitDisasterEventCreated,
  emitDisasterEventUpdate: notificationService.emitDisasterEventUpdate,
};

const buildFakeClient = () => {
  const queries = [];

  return {
    queries,
    async query(sql) {
      queries.push(sql);
      return { rows: [] };
    },
    release() {},
  };
};

const restoreTestDoubles = () => {
  pool.connect = originalPoolConnect;

  Object.assign(disasterEventRepository, originalRepositoryMethods);
  Object.assign(notificationService, originalNotificationMethods);
};

test.afterEach(() => {
  restoreTestDoubles();
});

test("createDisasterEvent blocks duplicate names for active or planned events", async () => {
  const fakeClient = buildFakeClient();

  pool.connect = async () => fakeClient;
  disasterEventRepository.getActiveDisasterEvents = async () => [];
  disasterEventRepository.findConflictingOpenDisasterEventByTitle = async () => ({
    id: "event-1",
    title: "Typhoon Egay",
    status: "ACTIVE",
  });

  await assert.rejects(
    disasterEventService.createDisasterEvent({
      title: "  typhoon   egay  ",
      disaster_type: "Typhoon",
      description: null,
      start_date: "2026-08-04",
      end_date: "2026-08-10",
      status: "ACTIVE",
      created_by: "user-1",
      barangay_ids: [],
    }),
    (error) => {
      assert.equal(
        error.message,
        "An active or planned disaster event with the same name already exists.",
      );
      assert.equal(error.statusCode, 409);
      return true;
    },
  );

  assert.deepEqual(fakeClient.queries, ["BEGIN", "ROLLBACK"]);
});

test("createDisasterEvent allows a name reused from a completed event", async () => {
  const fakeClient = buildFakeClient();

  pool.connect = async () => fakeClient;
  disasterEventRepository.getActiveDisasterEvents = async () => [];
  disasterEventRepository.findConflictingOpenDisasterEventByTitle = async () => null;
  disasterEventRepository.generateDisasterEventCode = async () => "DE-2026-0001";
  disasterEventRepository.insertDisasterEvent = async () => ({
    id: "event-2",
    event_code: "DE-2026-0001",
    title: "Typhoon Egay",
    disaster_type: "Typhoon",
    description: null,
    start_date: "2026-08-04",
    end_date: "2026-08-10",
    ended_at: null,
    status: "ACTIVE",
    created_by: "user-1",
    created_at: "2026-08-04T00:00:00.000Z",
    updated_at: "2026-08-04T00:00:00.000Z",
  });
  disasterEventRepository.insertDisasterEventBarangays = async () => [];
  disasterEventRepository.getDisasterEventById = async () => ({
    id: "event-2",
    event_code: "DE-2026-0001",
    title: "Typhoon Egay",
    disaster_type: "Typhoon",
    description: null,
    start_date: "2026-08-04",
    end_date: "2026-08-10",
    ended_at: null,
    status: "ACTIVE",
    created_by: "user-1",
    created_at: "2026-08-04T00:00:00.000Z",
    updated_at: "2026-08-04T00:00:00.000Z",
  });
  disasterEventRepository.getAffectedBarangaysByDisasterEventId = async () => [];
  disasterEventRepository.getLatestHouseholdActivityByDisasterEventId = async () => null;
  disasterEventRepository.getHouseholdCountsByDisasterEventBarangayIds = async () => [];
  notificationService.emitSafely = async (callback) => callback();
  notificationService.emitDisasterEventCreated = async () => {};
  notificationService.emitDisasterEventUpdate = async () => {};

  const result = await disasterEventService.createDisasterEvent({
    title: "Typhoon Egay",
    disaster_type: "Typhoon",
    description: null,
    start_date: "2026-08-04",
    end_date: "2026-08-10",
    status: "ACTIVE",
    created_by: "user-1",
    barangay_ids: [],
  });

  assert.equal(result.id, "event-2");
  assert.equal(result.title, "Typhoon Egay");
  assert.deepEqual(fakeClient.queries, ["BEGIN", "COMMIT"]);
});

test("updateDisasterEvent checks duplicate names against other open events only", async () => {
  let capturedExcludeId = null;

  disasterEventRepository.getActiveDisasterEvents = async () => [];
  disasterEventRepository.getDisasterEventById = async (id) => ({
    id,
    title: "Flood Response A",
    disaster_type: "Flood",
    description: null,
    start_date: "2026-08-01",
    end_date: "2026-08-10",
    ended_at: null,
    status: "ACTIVE",
  });
  disasterEventRepository.findConflictingOpenDisasterEventByTitle = async ({
    excludeId,
  }) => {
    capturedExcludeId = excludeId;
    return {
      id: "event-9",
      title: "Flood Response B",
      status: "PLANNED",
    };
  };

  await assert.rejects(
    disasterEventService.updateDisasterEvent("event-3", {
      title: "Flood Response B",
      disaster_type: "Flood",
      description: null,
      start_date: "2026-08-01",
      end_date: "2026-08-12",
      barangay_ids: [],
    }),
    /same name already exists/i,
  );

  assert.equal(capturedExcludeId, "event-3");
});
