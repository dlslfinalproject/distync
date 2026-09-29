const normalize = (value) => String(value || "").trim();
const RESOLVED_QUEUE_STATUSES = new Set(["RESOLVED", "RESOLVED_AUTOMATICALLY"]);
const BENEFICIARY_ROLES = new Set(["BARANGAY", "MSWDO"]);

export const hasCompleteOfflineActorContext = (actor = {}) =>
  Boolean(
    normalize(actor.accessMode) &&
      normalize(actor.userId) &&
      normalize(actor.roleCode),
  );

export const isOfflineQueueEntryOwnedByActor = (entry = {}, actor = {}) => {
  if (
    !hasCompleteOfflineActorContext(actor) ||
    entry.accessMode !== actor.accessMode ||
    entry.userId !== actor.userId ||
    entry.roleCode !== actor.roleCode
  ) {
    return false;
  }

  if (entry.deviceId && actor.deviceId && entry.deviceId !== actor.deviceId) {
    return false;
  }

  if (
    entry.barangayId &&
    actor.roleCode === "BARANGAY" &&
    (!actor.barangayId || entry.barangayId !== actor.barangayId)
  ) {
    return false;
  }

  return true;
};

export const isTerminalOfflineQueueEntry = (entry = {}) => {
  const resolutionStatus = normalize(entry.resolutionStatus).toUpperCase();
  return (
    normalize(entry.status).toUpperCase() === "SYNCED" ||
    RESOLVED_QUEUE_STATUSES.has(resolutionStatus)
  );
};

export const isLogoutDecisionRequiredQueueEntry = (entry = {}) =>
  Boolean(entry?.id) && !isTerminalOfflineQueueEntry(entry);

export const getActorLogoutDecisionEntries = (queueRows = [], actor = {}) =>
  (Array.isArray(queueRows) ? queueRows : []).filter(
    (entry) =>
      isOfflineQueueEntryOwnedByActor(entry, actor) &&
      isLogoutDecisionRequiredQueueEntry(entry),
  );

const isActorPreparedRow = (row = {}, actor = {}) =>
  hasCompleteOfflineActorContext(actor) &&
  row.accessMode === actor.accessMode &&
  row.userId === actor.userId &&
  row.roleCode === actor.roleCode;

export const buildOwnerScopedOfflineCleanupPlan = ({
  actor,
  reason,
  queueRows = [],
  masterlistRows = [],
  stubRows = [],
  preparationRows = [],
} = {}) => {
  if (!hasCompleteOfflineActorContext(actor)) {
    const error = new Error("The authenticated offline owner context is incomplete.");
    error.code = "OFFLINE_ACTOR_CONTEXT_REQUIRED";
    throw error;
  }

  if (!["logout", "user-confirmed-discard"].includes(reason)) {
    throw new Error("An explicit offline cleanup reason is required.");
  }

  const ownedQueueRows = (Array.isArray(queueRows) ? queueRows : []).filter(
    (entry) => isOfflineQueueEntryOwnedByActor(entry, actor),
  );
  const decisionEntries = ownedQueueRows.filter(
    isLogoutDecisionRequiredQueueEntry,
  );

  if (reason === "logout" && decisionEntries.length > 0) {
    const error = new Error(
      "Unsynchronized offline work must be synchronized or explicitly discarded before logout.",
    );
    error.code = "OFFLINE_WORK_REQUIRES_DECISION";
    error.entries = decisionEntries;
    throw error;
  }

  const queueIds = ownedQueueRows
    .filter(
      (entry) =>
        isTerminalOfflineQueueEntry(entry) ||
        (reason === "user-confirmed-discard" &&
          isLogoutDecisionRequiredQueueEntry(entry)),
    )
    .map((entry) => entry.id)
    .filter(Boolean);

  const isSensitiveBeneficiaryActor = BENEFICIARY_ROLES.has(
    normalize(actor.roleCode).toUpperCase(),
  );
  const ownedPreparedIds = (rows = []) =>
    isSensitiveBeneficiaryActor
      ? (Array.isArray(rows) ? rows : [])
          .filter((row) => isActorPreparedRow(row, actor))
          .map((row) => row.id)
          .filter(Boolean)
      : [];

  return {
    queueIds,
    masterlistIds: ownedPreparedIds(masterlistRows),
    stubIds: ownedPreparedIds(stubRows),
    preparationIds: ownedPreparedIds(preparationRows),
    decisionEntryIds: decisionEntries.map((entry) => entry.id),
  };
};

export const cleanupOwnerScopedOfflineDataInDatabase = async ({
  actor,
  reason,
  database,
  isActorContextCurrent = () => true,
} = {}) => {
  if (!hasCompleteOfflineActorContext(actor)) {
    const error = new Error("The authenticated offline owner context is incomplete.");
    error.code = "OFFLINE_ACTOR_CONTEXT_REQUIRED";
    throw error;
  }

  const tables = [
    database?.syncQueue,
    database?.offlineMasterlistCache,
    database?.offlineStubCache,
    database?.offlinePreparation,
  ].filter(Boolean);

  const clean = async () => {
    if (!isActorContextCurrent()) {
      const error = new Error(
        "The signed-in account changed before its offline data could be cleared.",
      );
      error.code = "OFFLINE_ACTOR_CONTEXT_CHANGED";
      throw error;
    }

    const readRows = (table) => (table ? table.toArray() : Promise.resolve([]));
    const [queueRows, masterlistRows, stubRows, preparationRows] =
      await Promise.all([
        readRows(database?.syncQueue),
        readRows(database?.offlineMasterlistCache),
        readRows(database?.offlineStubCache),
        readRows(database?.offlinePreparation),
      ]);
    const plan = buildOwnerScopedOfflineCleanupPlan({
      actor,
      reason,
      queueRows,
      masterlistRows,
      stubRows,
      preparationRows,
    });

    const deleteRows = (table, ids) =>
      ids.length && table ? table.bulkDelete(ids) : Promise.resolve();
    await Promise.all([
      deleteRows(database?.syncQueue, plan.queueIds),
      deleteRows(database?.offlineMasterlistCache, plan.masterlistIds),
      deleteRows(database?.offlineStubCache, plan.stubIds),
      deleteRows(database?.offlinePreparation, plan.preparationIds),
    ]);

    return {
      ...plan,
      deletedQueueCount: plan.queueIds.length,
      deletedMasterlistCount: plan.masterlistIds.length,
      deletedStubCount: plan.stubIds.length,
      deletedPreparationCount: plan.preparationIds.length,
    };
  };

  return typeof database?.transaction === "function"
    ? database.transaction("rw", ...tables, clean)
    : clean();
};
