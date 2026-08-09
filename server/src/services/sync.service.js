const syncRepository = require("../repositories/sync.repository");
const householdRegistrationRepository = require("../repositories/householdRegistration.repository");
const inventoryItemRepository = require("../repositories/inventoryItem.repository");
const supplierRepository = require("../repositories/supplier.repository");
const householdRegistrationService = require("./householdRegistration.service");
const distributionTransactionService = require("./distributionTransaction.service");
const inventoryItemService = require("./inventoryItem.service");
const inventoryBatchService = require("./inventoryBatch.service");
const supplierService = require("./supplier.service");
const inventoryTransactionService = require("./inventoryTransaction.service");
const stubService = require("./stub.service");
const notificationService = require("../modules/notifications/notification.service");
const { ROLE_CODES } = require("../modules/auth/auth.middleware");
const { logAuditSafely, logErrorSafely, pickDefined } = require("../utils/systemLog");
const {
  DUPLICATE_INVENTORY_TRANSACTION_REFERENCE_NO,
} = require("../utils/inventoryTransactionReference");

const SYNC_STATUS = {
  PENDING: "PENDING",
  SYNCED: "SYNCED",
  CONFLICT: "CONFLICT",
  FAILED: "FAILED",
};

const CONFLICT_STATUS = {
  OPEN: "OPEN",
  RESOLVED: "RESOLVED",
};

const RESOLUTION_STRATEGY = {
  FIRST_ACCEPTED: "FIRST_ACCEPTED",
  LATEST_TIMESTAMP: "LATEST_TIMESTAMP",
  MANUAL_REVIEW: "MANUAL_REVIEW",
};

const createConflictPersistenceError = (message) => {
  const error = new Error(message);
  error.code = "SYNC_CONFLICT_PERSISTENCE_FAILED";
  error.statusCode = 500;
  return error;
};

const createPermissionError = () => {
  const error = new Error("You do not have permission to sync this action");
  error.statusCode = 403;
  return error;
};

const createIdempotencyMismatchError = () => {
  const error = new Error("client_sync_id was already used for a different sync request");
  error.code = "IDEMPOTENCY_KEY_REUSE_MISMATCH";
  error.statusCode = 409;
  return error;
};

const createUnsupportedSyncActionError = () => {
  const error = new Error("This type of change is not supported for offline synchronization.");
  error.code = "SYNC_OPERATION_NOT_SUPPORTED";
  error.statusCode = 400;
  return error;
};

const markPostBusinessBookkeepingFailure = (error) => {
  error.rollbackSyncTransaction = true;
  return error;
};

const buildPersistedReplayResult = ({
  entry,
  syncTransaction,
  conflictRecord = null,
  message = null,
}) => ({
  client_sync_id: entry.client_sync_id,
  sync_transaction_id: syncTransaction.id,
  sync_status: syncTransaction.sync_status,
  message:
    message ||
    syncTransaction.error_message ||
    (syncTransaction.sync_status === SYNC_STATUS.SYNCED
      ? "Sync completed successfully."
      : syncTransaction.sync_status === SYNC_STATUS.CONFLICT
        ? "Conflict detected during sync."
        : syncTransaction.sync_status === SYNC_STATUS.PENDING
          ? "Sync is already being processed. Please retry shortly."
          : "Sync failed."),
  data: {
    id: syncTransaction.entity_server_id || null,
    sync_transaction_id: syncTransaction.id,
  },
  conflict: conflictRecord,
  replayed: true,
});

const getComparableTimestamp = (value) => {
  if (!value) {
    return null;
  }

  const parsedDate = new Date(value);
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
};

const getRequesterForSync = (auth) => ({
  userId: auth.userId,
  roleCode: auth.roleCode,
  defaultBarangayId: auth.defaultBarangayId || null,
});

const ACTION_HANDLERS = {
  HOUSEHOLD_REGISTER: {
    entityType: "HOUSEHOLD",
    operationType: "CREATE",
    roles: [ROLE_CODES.BARANGAY, ROLE_CODES.MSWDO],
    execute: async ({ payload, auth, clientTimestamp, dbClient }) =>
      householdRegistrationService.registerHousehold({
        ...payload,
        registered_by: auth.userId,
        synced_client_timestamp: clientTimestamp,
        enforce_sync_duplicate_guard: true,
        dbClient,
      }),
  },
  HOUSEHOLD_UPDATE: {
    entityType: "HOUSEHOLD",
    operationType: "UPDATE",
    roles: [ROLE_CODES.BARANGAY, ROLE_CODES.MSWDO],
    getCurrentRecord: async ({ entityServerId, dbClient }) =>
      householdRegistrationRepository.getHouseholdSummaryById(
        entityServerId,
        dbClient,
      ),
    execute: async ({ entityServerId, payload, auth, dbClient }) =>
      householdRegistrationService.updateHouseholdDetails({
        householdId: entityServerId,
        requester: getRequesterForSync(auth),
        requestData: {
          ...payload,
          registered_by: auth.userId,
        },
        dbClient,
      }),
  },
  HOUSEHOLD_DEPART: {
    entityType: "HOUSEHOLD",
    operationType: "TIME_OUT",
    roles: [ROLE_CODES.BARANGAY, ROLE_CODES.MSWDO],
    execute: async ({ entityServerId, payload, auth, clientTimestamp, dbClient }) =>
      householdRegistrationService.departHousehold(
        entityServerId,
        {
          ...payload,
          departure_time: payload.departure_time || clientTimestamp,
          allow_duplicate_departure_resolution: true,
        },
        getRequesterForSync(auth),
        { dbClient },
      ),
  },
  STUB_CLAIM: {
    entityType: "STUB",
    operationType: "CLAIM",
    roles: [ROLE_CODES.BARANGAY, ROLE_CODES.MSWDO],
    execute: async ({ entityServerId, auth, clientTimestamp, dbClient }) =>
      stubService.claimBarangayStub({
        id: entityServerId,
        user_id: auth.roleCode === ROLE_CODES.BARANGAY ? auth.userId : null,
        verified_by: auth.userId,
        claimed_at: clientTimestamp,
        override_barangay_id: null,
        dbClient,
      }),
  },
  DISTRIBUTION_CREATE: {
    entityType: "DISTRIBUTION_TRANSACTION",
    operationType: "CREATE",
    roles: [ROLE_CODES.BARANGAY, ROLE_CODES.MSWDO],
    execute: async ({ payload, auth, dbClient }) =>
      distributionTransactionService.createDistributionTransaction({
        ...payload,
        verified_by: auth.userId,
        requester: getRequesterForSync(auth),
        dbClient,
      }),
  },
  DISTRIBUTION_QR_CLAIM: {
    entityType: "DISTRIBUTION_TRANSACTION",
    operationType: "QR_SCAN",
    roles: [ROLE_CODES.BARANGAY, ROLE_CODES.MSWDO],
    execute: async ({ payload, auth, dbClient }) =>
      distributionTransactionService.claimDistributionTransactionFromQr({
        ...payload,
        verified_by: auth.userId,
        requester: getRequesterForSync(auth),
        dbClient,
      }),
  },
  INVENTORY_ITEM_CREATE: {
    entityType: "INVENTORY_ITEM",
    operationType: "CREATE",
    roles: [ROLE_CODES.MAYOR],
    execute: async ({ payload, auth, dbClient }) =>
      inventoryItemService.createInventoryItem(payload, auth, { dbClient }),
  },
  INVENTORY_ITEM_UPDATE: {
    entityType: "INVENTORY_ITEM",
    operationType: "UPDATE",
    roles: [ROLE_CODES.MAYOR],
    getCurrentRecord: async ({ entityServerId, dbClient }) =>
      inventoryItemRepository.getInventoryItemById(entityServerId, dbClient),
    execute: async ({ entityServerId, payload, auth, dbClient }) =>
      inventoryItemService.updateInventoryItem(entityServerId, payload, auth, {
        dbClient,
      }),
  },
  INVENTORY_BATCH_CREATE: {
    entityType: "INVENTORY_BATCH",
    operationType: "CREATE",
    roles: [ROLE_CODES.MAYOR],
    execute: async ({ payload, auth, dbClient }) =>
      inventoryBatchService.createInventoryBatch({
        ...payload,
        created_by: auth.userId,
        dbClient,
      }),
  },
  SUPPLIER_CREATE: {
    entityType: "SUPPLIER",
    operationType: "CREATE",
    roles: [ROLE_CODES.MAYOR],
    execute: async ({ payload, dbClient }) =>
      supplierService.createSupplier(payload, { dbClient }),
  },
  SUPPLIER_UPDATE: {
    entityType: "SUPPLIER",
    operationType: "UPDATE",
    roles: [ROLE_CODES.MAYOR],
    getCurrentRecord: async ({ entityServerId, dbClient }) =>
      supplierRepository.getSupplierById(entityServerId, dbClient),
    execute: async ({ entityServerId, payload, dbClient }) =>
      supplierService.updateSupplier(entityServerId, payload, { dbClient }),
  },
  INVENTORY_TRANSACTION_CREATE: {
    entityType: "INVENTORY_TRANSACTION",
    operationType: "INVENTORY_ADJUSTMENT",
    roles: [ROLE_CODES.MAYOR],
    execute: async ({ payload, auth, dbClient }) =>
      inventoryTransactionService.createInventoryTransaction({
        ...payload,
        reference_type: "MANUAL",
        reference_id: null,
        performed_by: auth.userId,
        dbClient,
      }),
  },
};

const SUPPORTED_SYNC_ACTION_KEYS = Object.freeze(Object.keys(ACTION_HANDLERS));
const SUPPORTED_SYNC_ACTION_KEY_SET = new Set(SUPPORTED_SYNC_ACTION_KEYS);

const isSupportedSyncAction = (actionKey) =>
  SUPPORTED_SYNC_ACTION_KEY_SET.has(actionKey);

const ensureActionAccess = (actionConfig, auth) => {
  if (!actionConfig.roles.includes(auth.roleCode)) {
    throw createPermissionError();
  }
};

const maybeResolveTimestampConflict = async ({
  entry,
  auth,
  actionConfig,
  syncTransaction,
  dbClient,
}) => {
  if (!actionConfig.getCurrentRecord || !entry.entity_server_id) {
    return {
      hasConflict: false,
      shouldApplyLocalChange: true,
      currentRecord: null,
      conflictRecord: null,
    };
  }

  const currentRecord = await actionConfig.getCurrentRecord({
    entityServerId: entry.entity_server_id,
    payload: entry.payload,
    auth,
    dbClient,
  });

  if (!currentRecord) {
    return {
      hasConflict: false,
      shouldApplyLocalChange: true,
      currentRecord: null,
      conflictRecord: null,
    };
  }

  const localTimestamp =
    getComparableTimestamp(entry.client_updated_at) ||
    getComparableTimestamp(entry.client_timestamp);
  const serverTimestamp = getComparableTimestamp(currentRecord.updated_at);

  if (!localTimestamp || !serverTimestamp) {
    return {
      hasConflict: false,
      shouldApplyLocalChange: true,
      currentRecord,
      conflictRecord: null,
    };
  }

  if (serverTimestamp.getTime() === localTimestamp.getTime()) {
    return {
      hasConflict: false,
      shouldApplyLocalChange: true,
      currentRecord,
      conflictRecord: null,
    };
  }

  const shouldApplyLocalChange = localTimestamp > serverTimestamp;

  return {
    hasConflict: true,
    shouldApplyLocalChange,
    currentRecord,
    conflictPayload: {
      sync_transaction_id: syncTransaction.id,
      entity_type: actionConfig.entityType,
      entity_server_id: entry.entity_server_id,
      conflict_type: "UPDATED_AT_MISMATCH",
      local_payload_json: entry.payload,
      server_payload_json: currentRecord,
      resolution_strategy: RESOLUTION_STRATEGY.LATEST_TIMESTAMP,
      resolved_by: auth.userId,
      status: CONFLICT_STATUS.RESOLVED,
    },
  };
};

const recordConflictAndUpdateSyncTransactionSafely = async ({
  auth,
  actionConfig,
  entry,
  syncTransactionId,
  transactionPayload,
  conflictPayload,
  dbClient,
}) => {
  try {
    return await syncRepository.recordConflictAndUpdateSyncTransaction({
      syncTransactionId,
      transactionPayload,
      conflictPayload,
      dbClient,
    });
  } catch (error) {
    const failureMessage =
      "Sync conflict could not be recorded safely. Please retry synchronization.";

    await logErrorSafely({
      actor: auth,
      moduleName: "sync",
      errorCode: "SYNC_CONFLICT_RESOLUTION_FAILED",
      errorMessage: `Failed to record sync conflict resolution for ${entry.action_key || actionConfig.entityType}`,
      error,
    });

    throw createConflictPersistenceError(failureMessage);
  }
};

const recordSyncFailureAndNotificationIntent = async ({
  syncTransactionId,
  transactionPayload,
  dbClient,
}) => {
  if (typeof syncRepository.recordSyncFailureAndNotificationIntent === "function") {
    return syncRepository.recordSyncFailureAndNotificationIntent({
      syncTransactionId,
      transactionPayload,
      dbClient,
    });
  }

  const syncTransaction = await syncRepository.updateSyncTransaction(
    syncTransactionId,
    {
      ...transactionPayload,
      sync_status: SYNC_STATUS.FAILED,
    },
    dbClient,
  );

  return { syncTransaction, notificationOutboxEvent: null };
};

const processCommittedNotificationIntentsSafely = async ({
  eventIds,
  auth,
  syncResult,
}) => {
  const uniqueEventIds = [...new Set(eventIds.filter(Boolean))];

  for (const eventId of uniqueEventIds) {
    try {
      await notificationService.processNotificationOutboxEventById(eventId);
    } catch (error) {
      await logErrorSafely({
        actor: auth,
        moduleName: "sync",
        errorCode: "SYNC_NOTIFICATION_OUTBOX_PROCESSING_FAILED",
        errorMessage: `Committed sync notification intent ${eventId} could not be processed immediately.`,
        error,
        reference_type: "NOTIFICATION_OUTBOX",
        reference_id: eventId,
      });
    }
  }

  return syncResult;
};

const processSingleSyncEntry = async (entry, auth) => {
  const actionConfig = ACTION_HANDLERS[entry.action_key];

  if (!isSupportedSyncAction(entry.action_key)) {
    throw createUnsupportedSyncActionError();
  }

  if (entry.entity_type !== actionConfig.entityType) {
    throw createUnsupportedSyncActionError();
  }

  ensureActionAccess(actionConfig, auth);

  const claimPayload = {
    client_sync_id: entry.client_sync_id,
    device_id: entry.device_id,
    user_id: auth.userId,
    entity_type: actionConfig.entityType,
    entity_local_id: entry.entity_local_id,
    entity_server_id: entry.entity_server_id,
    operation_type: actionConfig.operationType,
    payload_json: {
      action_key: entry.action_key,
      payload: entry.payload,
    },
    client_timestamp: entry.client_timestamp,
    sync_status: SYNC_STATUS.PENDING,
    error_message: null,
  };

  const runSyncProcessingTransaction =
    syncRepository.withSyncProcessingTransaction ||
    (async (callback) => callback(undefined));
  const notificationOutboxEventIds = [];

  const syncResult = await runSyncProcessingTransaction(async (dbClient) => {
    const claim = await syncRepository.claimSyncTransaction(claimPayload, dbClient);

    if (claim.decision === "REUSE_MISMATCH") {
      throw createIdempotencyMismatchError();
    }

    if (claim.decision === "REPLAY_TERMINAL") {
      return buildPersistedReplayResult({
        entry,
        syncTransaction: claim.transaction,
        conflictRecord: claim.conflictRecord,
      });
    }

    if (
      claim.decision === "IN_PROGRESS" ||
      claim.decision === "LEGACY_STALE_PENDING"
    ) {
      return buildPersistedReplayResult({
        entry,
        syncTransaction: claim.transaction,
        message:
          claim.decision === "LEGACY_STALE_PENDING"
            ? "Sync is still pending server confirmation and requires controlled reconciliation before replay."
            : "Sync is already being processed. Please retry shortly.",
      });
    }

    const syncTransaction = claim.transaction;
    let businessEffectApplied = false;

    try {
      const conflictState = await maybeResolveTimestampConflict({
        entry,
        auth,
        actionConfig,
        syncTransaction,
        dbClient,
      });

    if (conflictState.hasConflict && !conflictState.shouldApplyLocalChange) {
      const serverTimestamp = new Date().toISOString();
      const {
        syncTransaction: conflictTransaction,
        conflictRecord,
        notificationOutboxEvent,
      } =
        await recordConflictAndUpdateSyncTransactionSafely({
          auth,
          actionConfig,
          entry,
          syncTransactionId: syncTransaction.id,
          transactionPayload: {
            entity_server_id: entry.entity_server_id,
            server_timestamp: serverTimestamp,
            sync_status: SYNC_STATUS.CONFLICT,
            error_message:
              "Server version was newer. Server data was kept automatically.",
          },
          conflictPayload: {
            ...conflictState.conflictPayload,
            resolved_payload_json: {
              winner: "SERVER",
              local_payload: entry.payload,
              server_payload: conflictState.currentRecord,
              authoritative_payload: conflictState.currentRecord,
            },
            resolved_at: serverTimestamp,
          },
          dbClient,
        });
      if (notificationOutboxEvent?.id) {
        notificationOutboxEventIds.push(notificationOutboxEvent.id);
      }

      return {
        client_sync_id: entry.client_sync_id,
        sync_transaction_id: syncTransaction.id,
        sync_status: SYNC_STATUS.CONFLICT,
        message: "Conflict detected. Server version was newer and was kept.",
        data: conflictState.currentRecord,
        conflict: conflictRecord,
      };
    }

    const result = await actionConfig.execute({
      entityServerId: entry.entity_server_id,
      entityLocalId: entry.entity_local_id,
      payload: entry.payload,
      auth,
      clientTimestamp: entry.client_timestamp,
      dbClient,
    });
    businessEffectApplied = true;

    const resolvedEntityServerId =
      entry.entity_server_id ||
      result?.id ||
      result?.household?.id ||
      result?.data?.id ||
      result?.distribution_transaction_id ||
      result?.transaction_id ||
      null;

    const nextStatus = conflictState.hasConflict
      ? SYNC_STATUS.CONFLICT
      : SYNC_STATUS.SYNCED;

    const serverTimestamp = new Date().toISOString();
    let conflictRecord = null;

    if (conflictState.hasConflict) {
      try {
        const recordedConflict = await recordConflictAndUpdateSyncTransactionSafely({
          auth,
          actionConfig,
          entry,
          syncTransactionId: syncTransaction.id,
          transactionPayload: {
            entity_server_id: resolvedEntityServerId,
            server_timestamp: serverTimestamp,
            sync_status: nextStatus,
            error_message: null,
          },
          conflictPayload: {
            ...conflictState.conflictPayload,
            entity_server_id: resolvedEntityServerId,
            resolved_payload_json: {
              winner: "LOCAL",
              local_payload: entry.payload,
              server_payload: conflictState.currentRecord,
              authoritative_payload: result,
            },
            resolved_at: serverTimestamp,
          },
          dbClient,
        });

        conflictRecord = recordedConflict.conflictRecord;
        if (recordedConflict.notificationOutboxEvent?.id) {
          notificationOutboxEventIds.push(recordedConflict.notificationOutboxEvent.id);
        }
      } catch (error) {
        throw markPostBusinessBookkeepingFailure(error);
      }
    } else {
      try {
        await syncRepository.updateSyncTransaction(
          syncTransaction.id,
          {
            entity_server_id: resolvedEntityServerId,
            server_timestamp: serverTimestamp,
            sync_status: nextStatus,
            error_message: null,
          },
          dbClient,
        );
      } catch (error) {
        throw markPostBusinessBookkeepingFailure(error);
      }
    }

    return {
      client_sync_id: entry.client_sync_id,
      sync_transaction_id: syncTransaction.id,
      sync_status: nextStatus,
      message: conflictState.hasConflict
        ? "Conflict detected. Local version was newer and has been applied."
        : "Sync completed successfully.",
      data: result,
      conflict: conflictRecord,
    };
    } catch (error) {
      if (businessEffectApplied || error.rollbackSyncTransaction) {
        await logErrorSafely({
          actor: auth,
          moduleName: "sync",
          errorCode: "SYNC_POST_EFFECT_BOOKKEEPING_FAILED",
          errorMessage: `Sync terminal bookkeeping failed after business processing for ${entry.action_key}`,
          error,
        });

        throw error;
      }

    const isDuplicateConflict =
      error.code === "DUPLICATE_HOUSEHOLD_REGISTRATION" ||
      error.code === "DUPLICATE_HOUSEHOLD_DEPARTURE" ||
      error.code === "STUB_ALREADY_CLAIMED" ||
      error.code === DUPLICATE_INVENTORY_TRANSACTION_REFERENCE_NO;

    if (isDuplicateConflict) {
      const serverTimestamp = new Date().toISOString();
      const entityServerId = entry.entity_server_id || error.entityServerId || null;
      const isInventoryItrDuplicate =
        error.code === DUPLICATE_INVENTORY_TRANSACTION_REFERENCE_NO;

      try {
        const {
          syncTransaction: conflictTransaction,
          conflictRecord,
          notificationOutboxEvent,
        } =
          await syncRepository.recordConflictAndUpdateSyncTransaction({
            syncTransactionId: syncTransaction.id,
            transactionPayload: {
              entity_server_id: entityServerId,
              server_timestamp: serverTimestamp,
              sync_status: SYNC_STATUS.CONFLICT,
              error_message:
                error.message || "Duplicate offline action was ignored",
            },
            conflictPayload: {
              sync_transaction_id: syncTransaction.id,
              entity_type: actionConfig.entityType,
              entity_server_id: entityServerId,
              conflict_type: error.code,
              local_payload_json: entry.payload,
              server_payload_json: error.serverPayload || {},
              resolution_strategy: RESOLUTION_STRATEGY.FIRST_ACCEPTED,
              resolved_payload_json: {
                winner: "SERVER",
                reason: error.message,
                authoritative_payload: error.serverPayload || {},
              },
              resolved_by: isInventoryItrDuplicate ? null : auth.userId,
              resolved_at: serverTimestamp,
              status: CONFLICT_STATUS.RESOLVED,
            },
            dbClient,
          });
        if (notificationOutboxEvent?.id) {
          notificationOutboxEventIds.push(notificationOutboxEvent.id);
        }

        return {
          client_sync_id: entry.client_sync_id,
          sync_transaction_id: syncTransaction.id,
          sync_status: SYNC_STATUS.CONFLICT,
          message: error.message || "Duplicate offline action was ignored",
          data: conflictTransaction,
          conflict: conflictRecord,
        };
      } catch (conflictError) {
        await logErrorSafely({
          actor: auth,
          moduleName: "sync",
          errorCode: "SYNC_DUPLICATE_CONFLICT_RECORD_FAILED",
          errorMessage: `Failed to record duplicate conflict for ${entry.action_key}`,
          error: conflictError,
        });

        const failureMessage =
          "Sync conflict could not be recorded safely. Please retry synchronization.";

        const failureRecord = await recordSyncFailureAndNotificationIntent({
          syncTransactionId: syncTransaction.id,
          transactionPayload: {
            entity_server_id: entityServerId,
            server_timestamp: serverTimestamp,
            error_message: failureMessage,
          },
          dbClient,
        });
        if (failureRecord.notificationOutboxEvent?.id) {
          notificationOutboxEventIds.push(failureRecord.notificationOutboxEvent.id);
        }

        return {
          client_sync_id: entry.client_sync_id,
          sync_transaction_id: syncTransaction.id,
          sync_status: SYNC_STATUS.FAILED,
          message: failureMessage,
          data: null,
          conflict: null,
          error_code: createConflictPersistenceError(failureMessage).code,
        };
      }
    }

    if (error.code === "SYNC_CONFLICT_PERSISTENCE_FAILED") {
      const failureRecord = await recordSyncFailureAndNotificationIntent({
        syncTransactionId: syncTransaction.id,
        transactionPayload: {
          entity_server_id: entry.entity_server_id || null,
          server_timestamp: new Date().toISOString(),
          error_message: error.message,
        },
        dbClient,
      });
      if (failureRecord.notificationOutboxEvent?.id) {
        notificationOutboxEventIds.push(failureRecord.notificationOutboxEvent.id);
      }

      return {
        client_sync_id: entry.client_sync_id,
        sync_transaction_id: syncTransaction.id,
        sync_status: SYNC_STATUS.FAILED,
        message: error.message,
        data: null,
        conflict: null,
        error_code: error.code,
      };
    }

    const failureRecord = await recordSyncFailureAndNotificationIntent({
      syncTransactionId: syncTransaction.id,
      transactionPayload: {
        entity_server_id: entry.entity_server_id || null,
        server_timestamp: new Date().toISOString(),
        error_message: error.message || "Sync failed",
      },
      dbClient,
    });
    if (failureRecord.notificationOutboxEvent?.id) {
      notificationOutboxEventIds.push(failureRecord.notificationOutboxEvent.id);
    }

    await logErrorSafely({
      actor: auth,
      moduleName: "sync",
      errorCode: "SYNC_PROCESS_FAILED",
      errorMessage: `Sync failed for ${entry.action_key}: ${error.message || "Unknown error"}`,
      error,
    });

    return {
      client_sync_id: entry.client_sync_id,
      sync_transaction_id: syncTransaction.id,
      sync_status: SYNC_STATUS.FAILED,
      message: error.message || "Sync failed",
      data: null,
      conflict: null,
    };
    }
  });

  return processCommittedNotificationIntentsSafely({
    eventIds: notificationOutboxEventIds,
    auth,
    syncResult,
  });
};

const processSyncEntries = async ({ entries, auth }) => {
  const results = [];
  const orderedEntries = [...entries].sort((a, b) => {
    const aTime = getComparableTimestamp(a.client_timestamp)?.getTime() || 0;
    const bTime = getComparableTimestamp(b.client_timestamp)?.getTime() || 0;
    return aTime - bTime;
  });

  for (const entry of orderedEntries) {
    const result = await processSingleSyncEntry(entry, auth);
    results.push(result);
  }

  return results;
};

const getSyncHistory = async ({ auth, syncStatus, conflictStatus, limit }) => {
  const [transactions, conflicts] = await Promise.all([
    syncRepository.getSyncTransactionsByUser({
      userId: auth.userId,
      syncStatus,
      limit,
    }),
    syncRepository.getSyncConflictsByUser({
      userId: auth.userId,
      status: conflictStatus,
      limit,
    }),
  ]);

  return {
    transactions,
    conflicts,
  };
};

const getSyncStatusSummary = async ({ auth }) => {
  const [conflictCount, lastSuccessfulSyncAt] = await Promise.all([
    syncRepository.countOpenSyncConflictsByUser({
      userId: auth.userId,
    }),
    syncRepository.getLastSuccessfulSyncAtByUser({
      userId: auth.userId,
    }),
  ]);

  return {
    conflictCount,
    lastSuccessfulSyncAt,
    backendReachable: true,
  };
};

const getSyncConflictDetail = async ({ auth, conflictId }) => {
  const conflict = await syncRepository.getSyncConflictByIdForUser({
    id: conflictId,
    userId: auth.userId,
  });

  if (!conflict) {
    const error = new Error("Sync conflict not found");
    error.statusCode = 404;
    throw error;
  }

  await logAuditSafely({
    actor: auth,
    action: "SYNC_CONFLICT_REVIEW",
    entityType: "SYNC_CONFLICT",
    entityId: conflict.id,
    oldValues: {},
    newValues: {
      sync_transaction_id: conflict.sync_transaction_id,
      entity_type: conflict.entity_type,
      entity_server_id: conflict.entity_server_id,
      conflict_type: conflict.conflict_type,
      resolution_strategy: conflict.resolution_strategy,
      winner: conflict.resolved_payload_json?.winner || null,
      resolution_status: conflict.status,
    },
  });

  return {
    ...conflict,
    local_payload_summary: pickDefined(conflict.local_payload_json?.payload || conflict.local_payload_json, [
      "disaster_event_id",
      "household_id",
      "stub_id",
      "claimed_by_name",
      "item_name",
      "remarks",
      "status",
      "batch_no",
      "donor_name",
    ]),
    server_payload_summary: pickDefined(conflict.server_payload_json, [
      "id",
      "updated_at",
      "status",
      "remarks",
      "item_name",
      "batch_no",
      "donor_name",
    ]),
  };
};

const auditSyncRetryRequest = async ({ auth, entries }) => {
  const normalizedEntries = Array.isArray(entries) ? entries : [];

  await logAuditSafely({
    actor: auth,
    action: "SYNC_RETRY_REQUEST",
    entityType: "SYNC_TRANSACTION",
    entityId: normalizedEntries[0]?.sync_transaction_id || null,
    oldValues: {},
    newValues: {
      retry_count: normalizedEntries.length,
      entries: normalizedEntries.slice(0, 10).map((entry) => ({
        id: entry.id || null,
        module_name: entry.module_name || null,
        entity_type: entry.entity_type || null,
        action_key: entry.action_key || null,
        status: entry.status || null,
      })),
    },
  });
};

module.exports = {
  processSyncEntries,
  getSyncHistory,
  getSyncStatusSummary,
  getSyncConflictDetail,
  auditSyncRetryRequest,
  isSupportedSyncAction,
  SUPPORTED_SYNC_ACTION_KEYS,
};
