const test = require("node:test");
const assert = require("node:assert/strict");

const pool = require("../src/config/db");
const disasterEventRepository = require("../src/repositories/disasterEvent.repository");
const householdRegistrationRepository = require("../src/repositories/householdRegistration.repository");
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
  updateDisasterEventById: disasterEventRepository.updateDisasterEventById,
  closeDisasterEventIfActive: disasterEventRepository.closeDisasterEventIfActive,
};
const originalHouseholdRegistrationRepositoryMethods = {
  markDisasterEventHouseholdDepartures:
    householdRegistrationRepository.markDisasterEventHouseholdDepartures,
  archiveHouseholdsByIds:
    householdRegistrationRepository.archiveHouseholdsByIds,
  deactivateEvacueesByHouseholdIds:
    householdRegistrationRepository.deactivateEvacueesByHouseholdIds,
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
  Object.assign(
    householdRegistrationRepository,
    originalHouseholdRegistrationRepositoryMethods,
  );
  Object.assign(notificationService, originalNotificationMethods);
  disasterEventService.stopDisasterEventLifecycleMaintenance();
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

test("updateDisasterEvent immediately closes an edited active event when the new end date is already overdue", async () => {
  const fakeClient = buildFakeClient();
  const emittedActions = [];
  let closePayload = null;
  let getDisasterEventByIdCallCount = 0;

  pool.connect = async () => fakeClient;
  disasterEventRepository.getActiveDisasterEvents = async () => [];
  disasterEventRepository.getDisasterEventById = async (id) => {
    getDisasterEventByIdCallCount += 1;

    if (getDisasterEventByIdCallCount === 1) {
      return {
        id,
        event_code: "DE-2026-0003",
        title: "Typhoon Egay",
        disaster_type: "Typhoon",
        description: null,
        start_date: "1999-12-30",
        end_date: "2026-08-15",
        ended_at: null,
        status: "ACTIVE",
      };
    }

    return {
      id,
      event_code: "DE-2026-0003",
      title: "Typhoon Egay",
      disaster_type: "Typhoon",
      description: "Updated details",
      start_date: "1999-12-30",
      end_date: "2000-01-01",
      ended_at: closePayload?.endedAt || null,
      status: "CLOSED",
    };
  };
  disasterEventRepository.findConflictingOpenDisasterEventByTitle = async () => null;
  disasterEventRepository.getLatestHouseholdActivityByDisasterEventId = async () => null;
  disasterEventRepository.getAffectedBarangaysByDisasterEventId = async () => [
    { id: "barangay-1", name: "San Juan" },
  ];
  disasterEventRepository.getHouseholdCountsByDisasterEventBarangayIds = async () => [];
  disasterEventRepository.updateDisasterEventById = async () => ({
    id: "event-3",
  });
  disasterEventRepository.deleteDisasterEventBarangaysByDisasterEventId = async () => {};
  disasterEventRepository.insertDisasterEventBarangays = async () => [];
  disasterEventRepository.closeDisasterEventIfActive = async (payload) => {
    closePayload = payload;
    return {
      id: payload.id,
      event_code: "DE-2026-0003",
      title: "Typhoon Egay",
      disaster_type: "Typhoon",
      description: "Updated details",
      start_date: "2026-08-01",
      end_date: payload.endDate,
      ended_at: payload.endedAt,
      status: "CLOSED",
    };
  };
  householdRegistrationRepository.markDisasterEventHouseholdDepartures =
    async () => [];
  householdRegistrationRepository.archiveHouseholdsByIds = async () => {};
  householdRegistrationRepository.deactivateEvacueesByHouseholdIds =
    async () => {};
  notificationService.emitSafely = async (callback) => callback();
  notificationService.emitDisasterEventUpdate = async (payload) => {
    emittedActions.push(payload.action);
  };

  const result = await disasterEventService.updateDisasterEvent("event-3", {
    title: "Typhoon Egay",
    disaster_type: "Typhoon",
    description: "Updated details",
    start_date: "1999-12-30",
    end_date: "2000-01-01",
    barangay_ids: ["barangay-1"],
  });

  assert.equal(result.status, "CLOSED");
  assert.equal(closePayload.id, "event-3");
  assert.equal(closePayload.endDate, "2000-01-01");
  assert.equal(closePayload.endedAt, "2000-01-01T15:59:59.999Z");
  assert.deepEqual(emittedActions, ["ended"]);
});

test("updateDisasterEvent preserves the normal update notification when the event stays active", async () => {
  const fakeClient = buildFakeClient();
  const emittedActions = [];

  pool.connect = async () => fakeClient;
  disasterEventRepository.getActiveDisasterEvents = async () => [];
  disasterEventRepository.getDisasterEventById = async (id) => ({
    id,
    event_code: "DE-2026-0004",
    title: "Flood Response A",
    disaster_type: "Flood",
    description: "Updated details",
    start_date: "2026-08-01",
    end_date: "2999-12-31",
    ended_at: null,
    status: "ACTIVE",
  });
  disasterEventRepository.findConflictingOpenDisasterEventByTitle = async () => null;
  disasterEventRepository.getLatestHouseholdActivityByDisasterEventId = async () => null;
  disasterEventRepository.getAffectedBarangaysByDisasterEventId = async () => [];
  disasterEventRepository.getHouseholdCountsByDisasterEventBarangayIds = async () => [];
  disasterEventRepository.updateDisasterEventById = async () => ({
    id: "event-4",
  });
  disasterEventRepository.deleteDisasterEventBarangaysByDisasterEventId = async () => {};
  disasterEventRepository.insertDisasterEventBarangays = async () => [];
  disasterEventRepository.closeDisasterEventIfActive = async () => {
    throw new Error("closeDisasterEventIfActive should not run for active updates");
  };
  notificationService.emitSafely = async (callback) => callback();
  notificationService.emitDisasterEventUpdate = async (payload) => {
    emittedActions.push(payload.action);
  };

  const result = await disasterEventService.updateDisasterEvent("event-4", {
    title: "Flood Response A",
    disaster_type: "Flood",
    description: "Updated details",
    start_date: "2026-08-01",
    end_date: "2999-12-31",
    barangay_ids: [],
  });

  assert.equal(result.status, "ACTIVE");
  assert.deepEqual(emittedActions, ["updated"]);
});

test("syncOverdueActiveDisasterEvents does not emit an ended notification when another process already closed the event", async () => {
  const fakeClient = buildFakeClient();
  const emittedActions = [];
  let getDisasterEventByIdCallCount = 0;

  pool.connect = async () => fakeClient;
  disasterEventRepository.getActiveDisasterEvents = async () => [
    {
      id: "event-5",
      event_code: "DE-2026-0005",
      title: "Typhoon Frank",
      end_date: "2000-01-01",
      status: "ACTIVE",
    },
  ];
  disasterEventRepository.closeDisasterEventIfActive = async () => null;
  disasterEventRepository.getDisasterEventById = async () => {
    getDisasterEventByIdCallCount += 1;
    return {
      id: "event-5",
      event_code: "DE-2026-0005",
      title: "Typhoon Frank",
      disaster_type: "Typhoon",
      description: null,
      start_date: "1999-12-30",
      end_date: "2000-01-01",
      ended_at: "2000-01-01T15:59:59.999Z",
      status: "CLOSED",
    };
  };
  disasterEventRepository.getAffectedBarangaysByDisasterEventId = async () => [];
  householdRegistrationRepository.markDisasterEventHouseholdDepartures =
    async () => {
      throw new Error("closure side effects should not run without a transition");
    };
  notificationService.emitSafely = async (callback) => callback();
  notificationService.emitDisasterEventUpdate = async (payload) => {
    emittedActions.push(payload.action);
  };

  const result = await disasterEventService.syncOverdueActiveDisasterEvents();

  assert.equal(result.closedCount, 0);
  assert.equal(getDisasterEventByIdCallCount, 1);
  assert.deepEqual(emittedActions, []);
});

test("startDisasterEventLifecycleMaintenance only creates one interval", () => {
  const originalSetInterval = global.setInterval;
  const originalClearInterval = global.clearInterval;
  const scheduledIntervals = [];

  global.setInterval = (handler, intervalMs) => {
    const handle = {
      handler,
      intervalMs,
      unrefCalled: false,
      unref() {
        this.unrefCalled = true;
      },
    };
    scheduledIntervals.push(handle);
    return handle;
  };
  global.clearInterval = () => {};

  try {
    disasterEventService.startDisasterEventLifecycleMaintenance();
    disasterEventService.startDisasterEventLifecycleMaintenance();

    assert.equal(scheduledIntervals.length, 1);
    assert.equal(
      scheduledIntervals[0].intervalMs,
      disasterEventService.DISASTER_EVENT_RECONCILIATION_INTERVAL_MS,
    );
    assert.equal(scheduledIntervals[0].unrefCalled, true);
  } finally {
    disasterEventService.stopDisasterEventLifecycleMaintenance();
    global.setInterval = originalSetInterval;
    global.clearInterval = originalClearInterval;
  }
});
