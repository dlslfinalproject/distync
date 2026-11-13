import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";
import {
  buildOwnerScopedOfflineCleanupPlan,
  cleanupOwnerScopedOfflineDataInDatabase,
  getActorLogoutDecisionEntries,
  isLogoutDecisionRequiredQueueEntry,
  isOfflineQueueEntryOwnedByActor,
} from "../src/offline/offlineDataLifecycleCore.mjs";

const actorA = {
  accessMode: "DEMO",
  userId: "synthetic-user-a",
  roleCode: "BARANGAY",
  barangayId: "barangay-x",
  deviceId: "synthetic-device-1",
};

const source = (relativePath) =>
  fs.readFile(new URL(relativePath, import.meta.url), "utf8");

const makeFakeDatabase = (records) => {
  const deleted = {};
  const makeTable = (name) => ({
    async toArray() {
      return [...records[name]];
    },
    async bulkDelete(ids) {
      deleted[name] = [...(deleted[name] || []), ...ids];
      records[name] = records[name].filter((row) => !ids.includes(row.id));
    },
  });
  const database = {
    syncQueue: makeTable("syncQueue"),
    offlineMasterlistCache: makeTable("offlineMasterlistCache"),
    offlineStubCache: makeTable("offlineStubCache"),
    offlinePreparation: makeTable("offlinePreparation"),
    offlineInventoryCache: makeTable("offlineInventoryCache"),
    async transaction(mode, ...args) {
      assert.equal(mode, "rw");
      const callback = args.pop();
      assert.deepEqual(args, [
        database.syncQueue,
        database.offlineMasterlistCache,
        database.offlineStubCache,
        database.offlinePreparation,
      ]);
      return callback();
    },
  };
  return { database, records, deleted };
};

test("logout decisions recognize pending, failed, and unresolved conflict rows only", () => {
  assert.equal(isLogoutDecisionRequiredQueueEntry({ id: "p", status: "PENDING" }), true);
  assert.equal(isLogoutDecisionRequiredQueueEntry({ id: "f", status: "FAILED" }), true);
  assert.equal(isLogoutDecisionRequiredQueueEntry({ id: "c", status: "CONFLICT" }), true);
  assert.equal(isLogoutDecisionRequiredQueueEntry({ id: "s", status: "SYNCED" }), false);
  assert.equal(
    isLogoutDecisionRequiredQueueEntry({
      id: "r",
      status: "CONFLICT",
      resolutionStatus: "RESOLVED",
    }),
    false,
  );
  assert.equal(
    isLogoutDecisionRequiredQueueEntry({ id: "unknown", status: "QUEUED" }),
    true,
  );
});

test("queue ownership includes mode, user, role, device, and Barangay scope", () => {
  const base = {
    accessMode: "DEMO",
    userId: "synthetic-user-a",
    roleCode: "BARANGAY",
    barangayId: "barangay-x",
    deviceId: "synthetic-device-1",
  };

  assert.equal(isOfflineQueueEntryOwnedByActor(base, actorA), true);
  assert.equal(
    isOfflineQueueEntryOwnedByActor({ ...base, userId: "synthetic-user-b" }, actorA),
    false,
  );
  assert.equal(
    isOfflineQueueEntryOwnedByActor({ ...base, accessMode: "DEVELOPMENT" }, actorA),
    false,
  );
  assert.equal(
    isOfflineQueueEntryOwnedByActor({ ...base, roleCode: "MSWDO" }, actorA),
    false,
  );
  assert.equal(
    isOfflineQueueEntryOwnedByActor({ ...base, deviceId: "synthetic-device-2" }, actorA),
    false,
  );
  assert.equal(
    isOfflineQueueEntryOwnedByActor({ ...base, barangayId: "barangay-y" }, actorA),
    false,
  );
});

test("ordinary logout cannot clean while owner-scoped work remains unresolved", () => {
  const queueRows = [
    { id: "a-pending", ...actorA, status: "PENDING" },
    { id: "b-pending", ...actorA, userId: "synthetic-user-b", status: "PENDING" },
  ];

  assert.deepEqual(getActorLogoutDecisionEntries(queueRows, actorA).map((row) => row.id), [
    "a-pending",
  ]);
  assert.throws(
    () =>
      buildOwnerScopedOfflineCleanupPlan({
        actor: actorA,
        reason: "logout",
        queueRows,
      }),
    (error) => error.code === "OFFLINE_WORK_REQUIRES_DECISION",
  );
});

test("normal logout clears only outgoing beneficiary snapshots and terminal queue rows", () => {
  const plan = buildOwnerScopedOfflineCleanupPlan({
    actor: actorA,
    reason: "logout",
    queueRows: [
      { id: "a-synced", ...actorA, status: "SYNCED", payload: { photo: "data:image/png;base64,a" } },
      { id: "b-synced", ...actorA, userId: "synthetic-user-b", status: "SYNCED" },
    ],
    masterlistRows: [
      { id: "a-masterlist", ...actorA, row: { family_head_photo_data_url: "data:image/png;base64,a" } },
      { id: "b-masterlist", ...actorA, userId: "synthetic-user-b" },
    ],
    stubRows: [
      { id: "a-stub", ...actorA, family_head_photo_data_url: "data:image/png;base64,a" },
      { id: "b-stub", ...actorA, userId: "synthetic-user-b" },
    ],
    preparationRows: [
      { id: "a-preparation", ...actorA, datasets: { masterlist: { rows: ["PII"] } } },
      { id: "b-preparation", ...actorA, userId: "synthetic-user-b" },
      { id: "a-inventory-preparation", ...actorA, roleCode: "MAYOR" },
    ],
  });

  assert.deepEqual(plan.queueIds, ["a-synced"]);
  assert.deepEqual(plan.masterlistIds, ["a-masterlist"]);
  assert.deepEqual(plan.stubIds, ["a-stub"]);
  assert.deepEqual(plan.preparationIds, ["a-preparation"]);
});

test("explicit discard includes only this owner's unresolved payload and embedded media", () => {
  const plan = buildOwnerScopedOfflineCleanupPlan({
    actor: actorA,
    reason: "user-confirmed-discard",
    queueRows: [
      {
        id: "a-pending-registration",
        ...actorA,
        status: "PENDING",
        payload: { family_head_photo_url: "data:image/jpeg;base64,synthetic" },
      },
      {
        id: "b-pending-registration",
        ...actorA,
        userId: "synthetic-user-b",
        status: "PENDING",
        payload: { family_head_photo_url: "data:image/jpeg;base64,other" },
      },
    ],
    masterlistRows: [{ id: "a-masterlist", ...actorA }],
    stubRows: [{ id: "a-stub-photo", ...actorA, family_head_photo_data_url: "data:image/jpeg;base64,synthetic" }],
    preparationRows: [{ id: "a-photo-preparation", ...actorA }],
  });

  assert.deepEqual(plan.queueIds, ["a-pending-registration"]);
  assert.deepEqual(plan.masterlistIds, ["a-masterlist"]);
  assert.deepEqual(plan.stubIds, ["a-stub-photo"]);
  assert.deepEqual(plan.preparationIds, ["a-photo-preparation"]);
});

test("database cleanup preserves unresolved work unless the owner confirms discard", async () => {
  const fixture = makeFakeDatabase({
    syncQueue: [
      { id: "a-pending", ...actorA, status: "PENDING" },
      { id: "b-pending", ...actorA, userId: "synthetic-user-b", status: "PENDING" },
    ],
    offlineMasterlistCache: [
      { id: "a-masterlist", ...actorA, row: { beneficiary: "synthetic A" } },
      { id: "b-masterlist", ...actorA, userId: "synthetic-user-b" },
    ],
    offlineStubCache: [
      { id: "a-stub", ...actorA, family_head_photo_data_url: "data:image/png;base64,a" },
      { id: "b-stub", ...actorA, userId: "synthetic-user-b" },
    ],
    offlinePreparation: [
      { id: "a-preparation", ...actorA, photo: "data:image/png;base64,a" },
      { id: "b-preparation", ...actorA, userId: "synthetic-user-b" },
      { id: "mayor-preparation", ...actorA, roleCode: "MAYOR" },
    ],
    offlineInventoryCache: [{ id: "mayor-inventory", ...actorA }],
  });

  await assert.rejects(
    cleanupOwnerScopedOfflineDataInDatabase({
      actor: actorA,
      reason: "logout",
      database: fixture.database,
    }),
    (error) => error.code === "OFFLINE_WORK_REQUIRES_DECISION",
  );
  assert.deepEqual(fixture.deleted, {});
  assert.equal(fixture.records.syncQueue.length, 2);

  const result = await cleanupOwnerScopedOfflineDataInDatabase({
    actor: actorA,
    reason: "user-confirmed-discard",
    database: fixture.database,
  });

  assert.deepEqual(fixture.deleted, {
    syncQueue: ["a-pending"],
    offlineMasterlistCache: ["a-masterlist"],
    offlineStubCache: ["a-stub"],
    offlinePreparation: ["a-preparation"],
  });
  assert.equal(result.deletedQueueCount, 1);
  assert.equal(fixture.records.syncQueue.some((row) => row.id === "b-pending"), true);
  assert.equal(fixture.records.offlineMasterlistCache.some((row) => row.id === "b-masterlist"), true);
  assert.equal(fixture.records.offlineStubCache.some((row) => row.id === "b-stub"), true);
  assert.equal(fixture.records.offlinePreparation.some((row) => row.id === "b-preparation"), true);
  assert.equal(fixture.records.offlinePreparation.some((row) => row.id === "mayor-preparation"), true);
  assert.equal(fixture.records.offlineInventoryCache.length, 1);
});

test("database cleanup refuses to delete when account ownership changes mid-transaction", async () => {
  const fixture = makeFakeDatabase({
    syncQueue: [{ id: "a-synced", ...actorA, status: "SYNCED" }],
    offlineMasterlistCache: [],
    offlineStubCache: [],
    offlinePreparation: [],
    offlineInventoryCache: [],
  });

  await assert.rejects(
    cleanupOwnerScopedOfflineDataInDatabase({
      actor: actorA,
      reason: "logout",
      database: fixture.database,
      isActorContextCurrent: () => false,
    }),
    (error) => error.code === "OFFLINE_ACTOR_CONTEXT_CHANGED",
  );
  assert.deepEqual(fixture.deleted, {});
  assert.equal(fixture.records.syncQueue.length, 1);
});

test("successful transaction cleanup does not target prepared reference stores", async () => {
  const queueSource = await source("../src/offline/syncQueue.js");
  const lifecycleSource = await source("../src/offline/offlineDataLifecycle.js");
  const clearSyncedSection = queueSource.slice(
    queueSource.indexOf("export const clearSyncedEntries"),
    queueSource.indexOf("const getResolvedSyncTransactionIds"),
  );

  assert.match(clearSyncedSection, /isOfflineQueueEntryOwnedByActor/);
  assert.match(clearSyncedSection, /isTerminalOfflineQueueEntry/);
  assert.doesNotMatch(clearSyncedSection, /offlineMasterlistCache|offlineStubCache|offlinePreparation/);
  assert.match(lifecycleSource, /reason,/);
  assert.match(lifecycleSource, /cleanupOwnerScopedOfflineDataInDatabase/);
});
