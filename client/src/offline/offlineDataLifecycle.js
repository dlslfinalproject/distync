import db from "./db.js";
import {
  emitSyncQueueUpdated,
  getSyncQueueActorContext,
  isSyncQueueActorContextCurrent,
} from "./syncQueue.js";
import {
  cleanupOwnerScopedOfflineDataInDatabase,
  getActorLogoutDecisionEntries,
  hasCompleteOfflineActorContext,
} from "./offlineDataLifecycleCore.mjs";

const assertActorContext = (actor) => {
  if (!hasCompleteOfflineActorContext(actor)) {
    const error = new Error(
      "The authenticated offline owner context is incomplete.",
    );
    error.code = "OFFLINE_ACTOR_CONTEXT_REQUIRED";
    throw error;
  }
};

export const getActorLogoutDecisionEntriesFromStore = async (
  actor = getSyncQueueActorContext(),
  database = db,
) => {
  assertActorContext(actor);
  const queueRows = await database.syncQueue.toArray();
  return getActorLogoutDecisionEntries(queueRows, actor);
};

export const cleanupOfflineDataForActor = async ({
  actor = getSyncQueueActorContext(),
  reason,
  database = db,
} = {}) => {
  assertActorContext(actor);

  if (!isSyncQueueActorContextCurrent(actor)) {
    const error = new Error(
      "The signed-in account changed before its offline data could be cleared.",
    );
    error.code = "OFFLINE_ACTOR_CONTEXT_CHANGED";
    throw error;
  }

  const result = await cleanupOwnerScopedOfflineDataInDatabase({
    actor,
    reason,
    database,
    isActorContextCurrent: () => isSyncQueueActorContextCurrent(actor),
  });

  if (result.deletedQueueCount > 0) {
    emitSyncQueueUpdated();
  }

  return result;
};
