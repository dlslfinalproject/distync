const syncRepository = require("../repositories/sync.repository");
const deviceService = require("./device.service");
const inventoryItemRepository = require("../repositories/inventoryItem.repository");
const inventoryItemStockFormRepository = require("../repositories/inventoryItemStockForm.repository");
const inventoryBatchRepository = require("../repositories/inventoryBatch.repository");
const inventoryTransactionRepository = require("../repositories/inventoryTransaction.repository");
const householdRegistrationService = require("./householdRegistration.service");
const distributionTransactionService = require("./distributionTransaction.service");
const inventoryItemService = require("./inventoryItem.service");
const inventoryBatchService = require("./inventoryBatch.service");
const inventoryTransactionService = require("./inventoryTransaction.service");
const stubService = require("./stub.service");
const notificationService = require("../modules/notifications/notification.service");
const {
  validateAndNormalizeHouseholdRegistrationPayload,
} = require("../validators/householdRegistration.validator");
const { ROLE_CODES } = require("../modules/auth/auth.middleware");
const { logAuditSafely, logErrorSafely, pickDefined } = require("../utils/systemLog");
const { insertAuditLog } = require("../repositories/systemLog.repository");
const {
  DUPLICATE_INVENTORY_TRANSACTION_REFERENCE_NO,
} = require("../utils/inventoryTransactionReference");
const {
  DUPLICATE_INVENTORY_BATCH,
} = require("../utils/inventoryBatchIdentity");
const {
  DUPLICATE_INVENTORY_ITEM,
  DUPLICATE_INVENTORY_BARCODE,
} = require("../utils/inventoryItemIdentity");
const { normalizeInventoryBarcode } = require("../utils/inventoryBarcode");
const {
  verifyInventoryStateBasis,
} = require("../utils/inventoryStateBasis");
const {
  CONFLICT_STATUS,
  RESOLUTION_STRATEGY,
  RESOLUTION_ACTION,
  INVENTORY_STOCK_STATE_DRIFT,
  POSSIBLE_CROSS_BARANGAY_HOUSEHOLD_DUPLICATE,
  getSyncConflictReviewCapability,
} = require("../utils/syncConflictReviewPolicy");

const SYNC_STATUS = {
  PENDING: "PENDING",
  SYNCED: "SYNCED",
  CONFLICT: "CONFLICT",
  FAILED: "FAILED",
};
const subtractiveInventoryTransactionTypes = new Set([
  "OUTFLOW",
  "EXPIRED",
  "MISSING",
  "DAMAGED",
  "SPOILED",
  "STOLEN",
  "OTHER",
]);
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MSWDO_MUNICIPAL_SYNC_ENTITY_TYPES = new Set([
  "HOUSEHOLD",
  "STUB",
  "DISTRIBUTION_TRANSACTION",
]);
const MAYOR_MUNICIPAL_SYNC_ENTITY_TYPES = new Set([
  "INVENTORY_ITEM",
  "INVENTORY_BATCH",
  "INVENTORY_TRANSACTION",
]);

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

const createDisasterEventNotActiveError = () => {
  const error = new Error(
    "Household registration cannot be completed because the disaster event is not active.",
  );
  error.statusCode = 400;
  error.code = "DISASTER_EVENT_NOT_ACTIVE";
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
  deviceId: auth.deviceId || null,
});

const resolveMayorInventoryBatchPayload = async ({
  payload = {},
  auth,
  dbClient,
}) => {
  const localItemId = String(payload.inventory_item_local_id || "").trim();

  if (!localItemId) {
    return payload;
  }

  const syncedItem =
    typeof syncRepository.findSyncedEntityServerIdByLocalId === "function"
      ? await syncRepository.findSyncedEntityServerIdByLocalId(
          {
            entityType: "INVENTORY_ITEM",
            actionKey: "INVENTORY_ITEM_CREATE",
            entityLocalId: String(localItemId).trim(),
            userId: auth.userId,
          },
          dbClient,
        )
      : null;

  if (!syncedItem?.entity_server_id) {
    const error = new Error(
      "This stock entry is waiting for its new inventory item to finish syncing. Try again after the item is accepted.",
    );
    error.statusCode = 409;
    error.code = "INVENTORY_ITEM_PENDING_SYNC";
    throw error;
  }

  return {
    ...payload,
    inventory_item_id: syncedItem.entity_server_id,
    inventory_item_stock_form_id:
      uuidPattern.test(String(payload.inventory_item_stock_form_id || "").trim())
        ? payload.inventory_item_stock_form_id
        : null,
  };
};

const canUseMswdoMunicipalitySyncRead = (auth) =>
  auth?.roleCode === ROLE_CODES.MSWDO &&
  typeof syncRepository.getSyncTransactionsByMunicipality === "function" &&
  typeof syncRepository.getSyncConflictsByMunicipality === "function";

const canUseMayorMunicipalitySyncRead = (auth) =>
  auth?.roleCode === ROLE_CODES.MAYOR &&
  typeof syncRepository.getSyncTransactionsByMayor === "function" &&
  typeof syncRepository.getSyncConflictsByMayor === "function";

const getMunicipalSyncReadScope = (auth) => {
  if (canUseMswdoMunicipalitySyncRead(auth)) {
    return {
      transactions: syncRepository.getSyncTransactionsByMunicipality,
      conflicts: syncRepository.getSyncConflictsByMunicipality,
      conflictById: syncRepository.getSyncConflictByIdForMunicipality,
      countOpenConflicts: syncRepository.countOpenSyncConflictsByMunicipality,
      lastSuccessfulSyncAt: syncRepository.getLastSuccessfulSyncAtForMunicipality,
      entityTypes: MSWDO_MUNICIPAL_SYNC_ENTITY_TYPES,
    };
  }

  if (canUseMayorMunicipalitySyncRead(auth)) {
    return {
      transactions: syncRepository.getSyncTransactionsByMayor,
      conflicts: syncRepository.getSyncConflictsByMayor,
      conflictById: syncRepository.getSyncConflictByIdForMayor,
      countOpenConflicts: syncRepository.countOpenSyncConflictsByMayor,
      lastSuccessfulSyncAt: syncRepository.getLastSuccessfulSyncAtForMayor,
      entityTypes: MAYOR_MUNICIPAL_SYNC_ENTITY_TYPES,
    };
  }

  return null;
};

const getMunicipalSyncConflictDetailScope = (auth) => {
  if (
    auth?.roleCode === ROLE_CODES.MSWDO &&
    typeof syncRepository.getSyncConflictByIdForMunicipality === "function"
  ) {
    return {
      conflictById: syncRepository.getSyncConflictByIdForMunicipality,
      entityTypes: MSWDO_MUNICIPAL_SYNC_ENTITY_TYPES,
    };
  }

  if (
    auth?.roleCode === ROLE_CODES.MAYOR &&
    typeof syncRepository.getSyncConflictByIdForMayor === "function"
  ) {
    return {
      conflictById: syncRepository.getSyncConflictByIdForMayor,
      entityTypes: MAYOR_MUNICIPAL_SYNC_ENTITY_TYPES,
    };
  }

  return null;
};

const isRestrictedMswdoConflict = (conflict, auth) =>
  auth?.roleCode === ROLE_CODES.MSWDO &&
  conflict?.user_id &&
  conflict.user_id !== auth.userId &&
  conflict.resolution_strategy === RESOLUTION_STRATEGY.MANUAL_REVIEW &&
  conflict.conflict_type === INVENTORY_STOCK_STATE_DRIFT;

const ACTION_HANDLERS = {
  HOUSEHOLD_REGISTER: {
    entityType: "HOUSEHOLD",
    operationType: "CREATE",
    roles: [ROLE_CODES.BARANGAY, ROLE_CODES.MSWDO],
    execute: async ({ payload, auth, clientTimestamp, dbClient }) => {
      const validatedPayload =
        validateAndNormalizeHouseholdRegistrationPayload(payload);

      return householdRegistrationService.registerHousehold({
        ...validatedPayload,
        registered_by: auth.userId,
        synced_client_timestamp: clientTimestamp,
        enforce_sync_duplicate_guard: true,
        dbClient,
      });
    },
  },
  HOUSEHOLD_RE_ADMISSION: {
    entityType: "HOUSEHOLD",
    operationType: "CREATE",
    roles: [ROLE_CODES.BARANGAY, ROLE_CODES.MSWDO],
    execute: async ({ payload, auth, clientTimestamp, dbClient }) => {
      const validatedPayload =
        validateAndNormalizeHouseholdRegistrationPayload(payload);

      if (
        validatedPayload.registration_operation !==
        "CREATE_NEW_HOUSEHOLD_OCCURRENCE"
      ) {
        const error = new Error(
          "Re-admission sync entries must create a new household occurrence.",
        );
        error.statusCode = 400;
        error.code = "INVALID_RE_ADMISSION_OPERATION";
        throw error;
      }

      return householdRegistrationService.registerHousehold(
        {
          ...validatedPayload,
          registered_by: auth.userId,
          synced_client_timestamp: clientTimestamp,
          enforce_sync_duplicate_guard: true,
          dbClient,
        },
        {
          operation: "RE_ADMISSION",
          sourceHouseholdId:
            validatedPayload.re_admission_source_household_id,
          dbClient,
        },
      );
    },
  },
  HOUSEHOLD_UPDATE: {
    entityType: "HOUSEHOLD",
    operationType: "UPDATE",
    roles: [ROLE_CODES.BARANGAY, ROLE_CODES.MSWDO],
    getCurrentRecord: async ({ entityServerId, auth, dbClient }) =>
      householdRegistrationService.getAuthorizedHouseholdSummaryForUpdate({
        householdId: entityServerId,
        requester: getRequesterForSync(auth),
        dbClient,
      }),
    assertCurrentRecordCanSync: ({ currentRecord }) => {
      if (
        typeof householdRegistrationService.assertHouseholdUpdateDisasterEventActive ===
        "function"
      ) {
        householdRegistrationService.assertHouseholdUpdateDisasterEventActive(
          currentRecord,
        );
        return;
      }

      if (
        Object.prototype.hasOwnProperty.call(
          currentRecord || {},
          "disaster_event_status",
        ) &&
        currentRecord.disaster_event_status !== "ACTIVE"
      ) {
        throw createDisasterEventNotActiveError();
      }
    },
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
    execute: async ({ entityServerId, payload, auth, clientTimestamp, dbClient }) =>
      stubService.claimBarangayStub({
        id: entityServerId,
        user_id: auth.roleCode === ROLE_CODES.BARANGAY ? auth.userId : null,
        barangay_id:
          auth.roleCode === ROLE_CODES.MSWDO ? payload?.barangay_id || null : null,
        verified_by: auth.userId,
        claimed_at: clientTimestamp,
        disaster_event_id: payload?.disaster_event_id || null,
        override_barangay_id: null,
        dbClient,
      }),
  },
  DISTRIBUTION_CREATE: {
    entityType: "DISTRIBUTION_TRANSACTION",
    operationType: "CREATE",
    roles: [ROLE_CODES.BARANGAY, ROLE_CODES.MSWDO],
    execute: async ({ payload, auth, dbClient, canonicalDeviceId }) =>
      distributionTransactionService.createDistributionTransaction({
        ...payload,
        device_id: canonicalDeviceId || null,
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
    execute: async ({ payload, auth, clientTimestamp, dbClient }) =>
      inventoryItemService.createInventoryItem(payload, auth, {
        clientTimestamp,
        dbClient,
      }),
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
    execute: async ({ payload, auth, clientTimestamp, dbClient }) => {
      const resolvedPayload = await resolveMayorInventoryBatchPayload({
        payload,
        auth,
        dbClient,
      });

      return inventoryBatchService.createInventoryBatch({
        ...resolvedPayload,
        created_by: auth.userId,
        // Preserve the time the Mayor captured stock-in while keeping the
        // server-created audit timestamps authoritative for synchronization.
        received_at: clientTimestamp,
        // Two devices can generate the same next batch number while offline.
        // The sync path may assign the next available number instead of
        // turning a genuinely different packaging into a duplicate conflict.
        allowBatchNumberReassignment: true,
        // Accepting the same packaging twice is an explicit Conflict Review
        // decision; an offline payload must never bypass that review.
        forceBatchNumberReassignment: false,
        dbClient,
      });
    },
  },
  INVENTORY_TRANSACTION_CREATE: {
    entityType: "INVENTORY_TRANSACTION",
    operationType: "INVENTORY_ADJUSTMENT",
    roles: [ROLE_CODES.MAYOR],
    execute: async ({
      payload,
      auth,
      dbClient,
      entry,
      syncTransaction,
      canonicalDeviceId,
      deferDomainSideEffect,
    }) =>
      inventoryTransactionService.createInventoryTransaction({
        ...payload,
        reference_type: "MANUAL",
        reference_id: null,
        performed_by: auth.userId,
        syncTransactionId: syncTransaction.id,
        auditActor: {
          userId: auth.userId,
          roleCode: auth.roleCode,
          deviceId: canonicalDeviceId || null,
        },
        deferDomainSideEffect,
        dbClient,
      }),
  },
};

const SUPPORTED_SYNC_ACTION_KEYS = Object.freeze(Object.keys(ACTION_HANDLERS));
const SUPPORTED_SYNC_ACTION_KEY_SET = new Set(SUPPORTED_SYNC_ACTION_KEYS);

const isSupportedSyncAction = (actionKey) =>
  SUPPORTED_SYNC_ACTION_KEY_SET.has(actionKey);

const normalizeUuid = (value) => {
  const text = String(value || "").trim();
  return uuidPattern.test(text) ? text : null;
};

const getFirstValidUuid = (...values) =>
  values.map(normalizeUuid).find(Boolean) || null;

const getSyncHistoryDisasterEventId = (transaction = {}) => {
  const payloadJson = transaction.payload_json || {};
  const payload = payloadJson.payload || transaction.payload || {};

  return getFirstValidUuid(
    transaction.disaster_event_id,
    transaction.sync_history_disaster_event_id,
    payloadJson.disaster_event_id,
    payloadJson.disasterEventId,
    payloadJson.disaster_event?.id,
    payloadJson.disasterEvent?.id,
    payload.disaster_event_id,
    payload.disasterEventId,
    payload.disaster_event?.id,
    payload.disasterEvent?.id,
    payload.household?.disaster_event_id,
    payload.household?.disaster_event?.id,
    payload.distribution?.disaster_event_id,
    payload.distribution?.disaster_event?.id,
    payload.stub?.disaster_event_id,
    payload.stub?.disaster_event?.id,
  );
};

const enrichSyncTransactionsWithDisasterEventTitles = async ({
  transactions,
  auth,
}) => {
  const transactionsWithEventIds = transactions.map((transaction) => ({
    transaction,
    disasterEventId: getSyncHistoryDisasterEventId(transaction),
  }));
  const eventIds = transactionsWithEventIds
    .map((entry) => entry.disasterEventId)
    .filter(Boolean);

  if (
    eventIds.length === 0 ||
    typeof syncRepository.getDisasterEventTitlesByIds !== "function"
  ) {
    return transactions;
  }

  const titleLookup = await syncRepository.getDisasterEventTitlesByIds({
    eventIds,
    roleCode: auth.roleCode,
    defaultBarangayId: auth.defaultBarangayId || null,
  });

  return transactionsWithEventIds.map(({ transaction, disasterEventId }) => {
    const disasterEventTitle = disasterEventId ? titleLookup[disasterEventId] : null;

    if (!disasterEventTitle) {
      return transaction;
    }

    return {
      ...transaction,
      sync_history_disaster_event_title: disasterEventTitle,
    };
  });
};

const ensureActionAccess = (actionConfig, auth) => {
  if (!actionConfig.roles.includes(auth.roleCode)) {
    throw createPermissionError();
  }
};

const normalizeSyncPayloadDeviceReferences = (payload, canonicalDeviceId) => {
  if (
    !canonicalDeviceId ||
    !payload ||
    typeof payload !== "object" ||
    Array.isArray(payload)
  ) {
    return payload;
  }

  const normalizedPayload = { ...payload };

  if (Object.prototype.hasOwnProperty.call(normalizedPayload, "device_id")) {
    normalizedPayload.device_id = canonicalDeviceId;
  }

  const privacyAcknowledgment = normalizedPayload.privacy_acknowledgment;

  if (
    privacyAcknowledgment &&
    typeof privacyAcknowledgment === "object" &&
    !Array.isArray(privacyAcknowledgment) &&
    Object.prototype.hasOwnProperty.call(privacyAcknowledgment, "device_id")
  ) {
    normalizedPayload.privacy_acknowledgment = {
      ...privacyAcknowledgment,
      device_id: canonicalDeviceId,
    };
  }

  return normalizedPayload;
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

  if (typeof actionConfig.assertCurrentRecordCanSync === "function") {
    actionConfig.assertCurrentRecordCanSync({ currentRecord, entry, auth });
  }

  const { disaster_event_status, ...syncSafeCurrentRecord } = currentRecord;

  const localTimestamp =
    getComparableTimestamp(entry.client_updated_at) ||
    getComparableTimestamp(entry.client_timestamp);
  const serverTimestamp = getComparableTimestamp(syncSafeCurrentRecord.updated_at);

  if (!localTimestamp || !serverTimestamp) {
    return {
      hasConflict: false,
      shouldApplyLocalChange: true,
      currentRecord: syncSafeCurrentRecord,
      conflictRecord: null,
    };
  }

  if (serverTimestamp.getTime() === localTimestamp.getTime()) {
    return {
      hasConflict: false,
      shouldApplyLocalChange: true,
      currentRecord: syncSafeCurrentRecord,
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
      server_payload_json: syncSafeCurrentRecord,
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

const createConflictNotFoundError = () => {
  const error = new Error("Sync conflict not found");
  error.statusCode = 404;
  return error;
};

const createConflictAlreadyResolvedError = () => {
  const error = new Error("Sync conflict has already been resolved");
  error.statusCode = 409;
  error.code = "SYNC_CONFLICT_ALREADY_RESOLVED";
  return error;
};

const createResolutionActionNotAllowedError = () => {
  const error = new Error("This resolution action is not allowed for this conflict");
  error.statusCode = 403;
  error.code = "SYNC_CONFLICT_RESOLUTION_ACTION_NOT_ALLOWED";
  return error;
};

const getResolutionCapability = (conflict, auth) => {
  const isOpen = conflict?.status === CONFLICT_STATUS.OPEN;

  if (!isOpen || conflict?.resolution_strategy !== RESOLUTION_STRATEGY.MANUAL_REVIEW) {
    return {
      availableResolutionActions: [],
      canResolve: false,
      domainOwner: null,
      basis: "Only OPEN MANUAL_REVIEW conflicts can be manually resolved.",
    };
  }

  if (conflict.conflict_type === INVENTORY_STOCK_STATE_DRIFT) {
    const mayResolve =
      auth?.roleCode === ROLE_CODES.MAYOR &&
      conflict.entity_type === "INVENTORY_TRANSACTION";

    return {
      availableResolutionActions: mayResolve
        ? [RESOLUTION_ACTION.MARK_REVIEWED, RESOLUTION_ACTION.KEEP_SERVER]
        : [],
      canResolve: mayResolve,
      domainOwner: ROLE_CODES.MAYOR,
      basis:
        "Mayor inventory authority may review stock-state drift; losing inventory movement replay is not supported.",
    };
  }

  if (
    [
      DUPLICATE_INVENTORY_ITEM,
      DUPLICATE_INVENTORY_BARCODE,
      DUPLICATE_INVENTORY_BATCH,
    ].includes(conflict.conflict_type)
  ) {
    const mayResolve =
      auth?.roleCode === ROLE_CODES.MAYOR &&
      ["INVENTORY_ITEM", "INVENTORY_BATCH"].includes(conflict.entity_type);
    const availableResolutionActions = mayResolve
      ? conflict.conflict_type === DUPLICATE_INVENTORY_BATCH
        ? [RESOLUTION_ACTION.KEEP_SERVER, RESOLUTION_ACTION.ACCEPT_BOTH]
        : conflict.conflict_type === DUPLICATE_INVENTORY_BARCODE
          ? [RESOLUTION_ACTION.KEEP_SERVER, RESOLUTION_ACTION.APPLY_LOCAL]
          : getInventoryDuplicateItemPlan({
                existingItem: conflict.server_payload_json || {},
                stockForms:
                  conflict.server_payload_json?.inventory_item_stock_forms ||
                  [],
                localPayload:
                  conflict.local_payload_json?.payload ||
                  conflict.local_payload_json ||
                  {},
              }).kind === "SAME_PACKAGING"
            ? [RESOLUTION_ACTION.KEEP_SERVER, RESOLUTION_ACTION.ACCEPT_BOTH]
            : [RESOLUTION_ACTION.KEEP_SERVER]
      : [];

    return {
      availableResolutionActions,
      canResolve: mayResolve,
      domainOwner: ROLE_CODES.MAYOR,
      basis:
        "Mayor inventory authority must review duplicate item, barcode, and batch identities before the queued action is closed.",
    };
  }

  return {
    availableResolutionActions: [],
    canResolve: false,
    domainOwner: null,
    basis: "No safe manual resolution path is configured for this conflict type.",
  };
};

const isReviewableConflictStatusFilter = (status) =>
  !status || status === CONFLICT_STATUS.OPEN;

const mergeConflictsById = (...conflictLists) =>
  conflictLists.flat().reduce((current, conflict) => {
    if (conflict?.id && !current.has(conflict.id)) {
      current.set(conflict.id, conflict);
    }

    return current;
  }, new Map());

const sortConflictsByCreatedAtDesc = (conflicts) =>
  [...conflicts].sort((first, second) => {
    const firstTime = new Date(first.created_at || 0).getTime() || 0;
    const secondTime = new Date(second.created_at || 0).getTime() || 0;
    return secondTime - firstTime;
  });

const getSafeConflictServerSummary = (conflict) => ({
  conflict_id: conflict.id,
  entity_type: conflict.entity_type,
  entity_server_id: conflict.entity_server_id || null,
  conflict_type: conflict.conflict_type,
  authoritative_payload: conflict.server_payload_json || {},
});

const getSafeAutomaticCrossBarangayPayload = (payload = {}) => ({
  family_head: payload.family_head
    ? {
        first_name: payload.family_head.first_name || null,
        middle_name: payload.family_head.middle_name || null,
        last_name: payload.family_head.last_name || null,
        suffix: payload.family_head.suffix || null,
      }
    : null,
  barangay_name: payload.barangay_name || null,
  disaster_event_title: payload.disaster_event_title || null,
  registered_at: payload.registered_at || null,
  household_size: payload.household_size || null,
  current_address_details: payload.current_address_details || null,
  result: payload.result || null,
});

const isInsufficientInventoryStockError = (error) =>
  error?.statusCode === 400 &&
  /Insufficient quantity_available/i.test(String(error?.message || ""));

const buildInventoryBasisEvidence = ({ basis, currentBatch, payload }) => ({
  basis: {
    basisVersion: basis.basisVersion,
    inventoryBatchId: basis.inventoryBatchId,
    inventoryItemId: basis.inventoryItemId,
    stockVersion: basis.stockVersion,
    quantityAvailable: basis.quantityAvailable,
    status: basis.status,
    expirationDate: basis.expirationDate,
    observedServerAt: basis.observedServerAt,
  },
  current: currentBatch
    ? {
        inventoryBatchId: currentBatch.id,
        inventoryItemId: currentBatch.inventory_item_id,
        stockVersion: Number(currentBatch.stock_version),
        quantityAvailable: Number(currentBatch.quantity_available),
        status: currentBatch.status || null,
        expirationDate: currentBatch.expiration_date || null,
      }
    : null,
  requested: {
    inventoryBatchId: payload.inventory_batch_id || null,
    transactionType: payload.transaction_type || null,
    quantity: Number(payload.quantity || 0),
    inventoryTransactionReferenceNo:
      payload.inventoryTransactionReferenceNo ||
      payload.inventory_transaction_reference_no ||
      null,
  },
});

const maybeRecordInventoryStockStateDriftConflict = async ({
  error,
  entry,
  auth,
  actionConfig,
  syncTransaction,
  dbClient,
}) => {
  const payload = entry.payload || {};

  if (
    entry.action_key !== "INVENTORY_TRANSACTION_CREATE" ||
    !isInsufficientInventoryStockError(error) ||
    !subtractiveInventoryTransactionTypes.has(payload.transaction_type)
  ) {
    return null;
  }

  const verification = verifyInventoryStateBasis(payload.inventoryStateBasis);

  if (!verification.valid) {
    return null;
  }

  const basis = verification.basis;

  if (String(basis.inventoryBatchId) !== String(payload.inventory_batch_id || "")) {
    return null;
  }

  if (Number(basis.quantityAvailable) < Number(payload.quantity || 0)) {
    return null;
  }

  const currentBatch =
    await inventoryTransactionRepository.getInventoryBatchByIdForUpdate(
      payload.inventory_batch_id,
      dbClient,
    );

  if (!currentBatch) {
    return null;
  }

  const currentStockVersion = Number(currentBatch.stock_version);
  const currentQuantityAvailable = Number(currentBatch.quantity_available);
  const currentEvidence = buildInventoryBasisEvidence({
    basis,
    currentBatch,
    payload,
  });

  if (
    currentStockVersion <= Number(basis.stockVersion) ||
    currentQuantityAvailable >= Number(payload.quantity || 0)
  ) {
    return null;
  }

  const serverTimestamp = new Date().toISOString();
  const {
    syncTransaction: conflictTransaction,
    conflictRecord,
    notificationOutboxEvent,
  } = await recordConflictAndUpdateSyncTransactionSafely({
    auth,
    actionConfig,
    entry,
    syncTransactionId: syncTransaction.id,
    transactionPayload: {
      entity_server_id: null,
      server_timestamp: serverTimestamp,
      sync_status: SYNC_STATUS.CONFLICT,
      error_message:
        "Inventory stock changed after the offline state basis. Manual review is required.",
    },
    conflictPayload: {
      sync_transaction_id: syncTransaction.id,
      entity_type: actionConfig.entityType,
      entity_server_id: null,
      conflict_type: INVENTORY_STOCK_STATE_DRIFT,
      local_payload_json: {
        payload,
        inventory_state_basis: currentEvidence.basis,
      },
      server_payload_json: currentEvidence.current,
      resolution_strategy: RESOLUTION_STRATEGY.MANUAL_REVIEW,
      resolved_payload_json: null,
      resolved_by: null,
      resolved_at: null,
      status: CONFLICT_STATUS.OPEN,
    },
    dbClient,
  });

  return {
    notificationOutboxEvent,
    result: {
      client_sync_id: entry.client_sync_id,
      sync_transaction_id: syncTransaction.id,
      sync_status: SYNC_STATUS.CONFLICT,
      message:
        "Inventory stock changed after this offline transaction was recorded. Manual review is required.",
      data: conflictTransaction,
      conflict: conflictRecord,
    },
  };
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

const processCommittedDomainSideEffectsSafely = async ({
  sideEffects,
  auth,
  syncResult,
}) => {
  for (const sideEffect of sideEffects) {
    try {
      await sideEffect();
    } catch (error) {
      await logErrorSafely({
        actor: auth,
        moduleName: "sync",
        errorCode: "SYNC_DOMAIN_SIDE_EFFECT_PROCESSING_FAILED",
        errorMessage:
          "Committed inventory domain side effect could not be processed immediately.",
        error,
      });
    }
  }

  return syncResult;
};

const getValidRegistrationTimestamp = (value) => {
  const time = new Date(value || "").getTime();
  return Number.isFinite(time) ? time : null;
};

const buildAutomaticCrossBarangayResolution = ({
  incomingPayload,
  existingPayload,
  existingSummary,
  incomingTimestamp,
  existingTimestamp,
  resolvedAt,
}) => {
  const incomingTime = getValidRegistrationTimestamp(incomingTimestamp);
  const existingTime = getValidRegistrationTimestamp(existingTimestamp);

  if (incomingTime === null || existingTime === null) {
    return null;
  }

  const incomingIsEarlier = incomingTime < existingTime;
  const earlierPayload = incomingIsEarlier ? incomingPayload : existingPayload;
  const laterPayload = incomingIsEarlier ? existingPayload : incomingPayload;

  return {
    automatic: true,
    resolution_status: "RESOLVED_AUTOMATICALLY",
    winner: incomingIsEarlier ? "INCOMING" : "EXISTING",
    result: incomingIsEarlier
      ? "EARLIER_REGISTRATION_RETAINED"
      : "LATER_REGISTRATION_RESOLVED_AS_DUPLICATE",
    earlier_registration: {
      ...earlierPayload,
      barangay_name:
        earlierPayload?.barangay_name ||
        (incomingIsEarlier ? null : existingSummary?.barangay_name) ||
        null,
      registered_at: incomingIsEarlier ? incomingTimestamp : existingTimestamp,
      result: "RETAINED",
    },
    later_registration: {
      ...laterPayload,
      barangay_name:
        laterPayload?.barangay_name ||
        (!incomingIsEarlier ? null : existingSummary?.barangay_name) ||
        null,
      registered_at: incomingIsEarlier ? existingTimestamp : incomingTimestamp,
      result: "RESOLVED_AS_DUPLICATE",
    },
    authoritative_payload: earlierPayload,
    resolved_at: resolvedAt,
    tie_breaker: incomingTime === existingTime
      ? "EXISTING_SERVER_ACCEPTANCE_ORDER"
      : null,
  };
};

const normalizeInventoryConflictText = (value) =>
  String(value ?? "").trim().toLowerCase();

const normalizeInventoryConflictCategory = (value) => {
  const normalized = normalizeInventoryConflictText(value);

  if (normalized === "perishable") {
    return "perishable";
  }

  if (normalized === "non-perishable") {
    return "non-perishable";
  }

  return normalized;
};

const normalizeInventoryConflictNumber = (value) => {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : null;
};

const normalizeInventoryConflictBoolean = (value, category) => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = normalizeInventoryConflictText(value);

    if (normalized === "true") {
      return true;
    }

    if (normalized === "false") {
      return false;
    }
  }

  return normalizeInventoryConflictCategory(category) === "perishable";
};

const areInventoryConflictNumbersEqual = (firstValue, secondValue) => {
  const firstNumber = normalizeInventoryConflictNumber(firstValue);
  const secondNumber = normalizeInventoryConflictNumber(secondValue);

  return firstNumber === secondNumber;
};

const buildInventoryStockFormDefinitionFromItemPayload = (payload = {}) => {
  const packaging = normalizeInventoryConflictText(payload.packaging) || "piece";
  const requestedUnits = normalizeInventoryConflictNumber(
    payload.quantity ?? payload.units_per_packaging,
  );
  const unitsPerPackaging =
    Number.isInteger(requestedUnits) && requestedUnits > 0
      ? requestedUnits
      : packaging === "piece"
        ? 1
        : null;

  return {
    barcode: normalizeInventoryBarcode(payload.barcode) || null,
    packaging,
    units_per_packaging: unitsPerPackaging,
    unit_of_measure: normalizeInventoryConflictText(
      payload.unit_of_measure,
    ) || "pc",
    unit_of_measure_value: normalizeInventoryConflictNumber(
      payload.unit_of_measure_value,
    ),
  };
};

const areInventoryStockFormDefinitionsEqual = (firstDefinition, secondDefinition) =>
  normalizeInventoryConflictText(firstDefinition?.packaging) ===
    normalizeInventoryConflictText(secondDefinition?.packaging) &&
  areInventoryConflictNumbersEqual(
    firstDefinition?.units_per_packaging,
    secondDefinition?.units_per_packaging,
  ) &&
  normalizeInventoryConflictText(firstDefinition?.unit_of_measure) ===
    normalizeInventoryConflictText(secondDefinition?.unit_of_measure) &&
  areInventoryConflictNumbersEqual(
    firstDefinition?.unit_of_measure_value,
    secondDefinition?.unit_of_measure_value,
  );

const getInventoryItemForSyncConflict = async (itemId, dbClient) => {
  if (!itemId) {
    return null;
  }

  const getItem =
    typeof inventoryItemRepository.getInventoryItemByIdForUpdate === "function"
      ? inventoryItemRepository.getInventoryItemByIdForUpdate
      : inventoryItemRepository.getInventoryItemById;

  if (typeof getItem !== "function") {
    return null;
  }

  return getItem(itemId, dbClient);
};

const getInventoryStockFormsForSyncConflict = async (itemId, dbClient) => {
  if (
    !itemId ||
    typeof inventoryItemStockFormRepository.getInventoryItemStockFormsByItemId !==
      "function"
  ) {
    return [];
  }

  return inventoryItemStockFormRepository.getInventoryItemStockFormsByItemId(
    itemId,
    dbClient,
  );
};

const getInventoryDuplicateItemPlan = ({
  existingItem,
  stockForms,
  localPayload,
}) => {
  const existingItemName = normalizeInventoryConflictText(
    existingItem?.item_name,
  );
  const incomingItemName = normalizeInventoryConflictText(localPayload?.item_name);
  const existingItemCode = normalizeInventoryConflictText(
    existingItem?.item_code,
  );
  const incomingItemCode = normalizeInventoryConflictText(
    localPayload?.item_code,
  );
  const sameItemName = Boolean(
    existingItemName && incomingItemName && existingItemName === incomingItemName,
  );
  const sameItemCode = Boolean(
    existingItemCode && incomingItemCode && existingItemCode === incomingItemCode,
  );

  // A matching name is enough when the client generated different item codes
  // offline. A matching code with a different name is kept for review because
  // silently joining differently named records could hide a data-entry error.
  if (!sameItemName && !(sameItemCode && !incomingItemName)) {
    return { kind: "INCOMPATIBLE_ITEM" };
  }

  const existingCategory = normalizeInventoryConflictCategory(
    existingItem?.category,
  );
  const incomingCategory = normalizeInventoryConflictCategory(
    localPayload?.category,
  );
  const existingIsPerishable = normalizeInventoryConflictBoolean(
    existingItem?.is_perishable,
    existingItem?.category,
  );
  const incomingIsPerishable = normalizeInventoryConflictBoolean(
    localPayload?.is_perishable,
    localPayload?.category,
  );

  if (
    existingCategory !== incomingCategory ||
    existingIsPerishable !== incomingIsPerishable ||
    normalizeInventoryConflictText(existingItem?.unit_of_measure) !==
      normalizeInventoryConflictText(localPayload?.unit_of_measure) ||
    !areInventoryConflictNumbersEqual(
      existingItem?.unit_of_measure_value,
      localPayload?.unit_of_measure_value,
    )
  ) {
    return { kind: "INCOMPATIBLE_ITEM" };
  }

  const requestedDefinition =
    buildInventoryStockFormDefinitionFromItemPayload(localPayload);
  const activeStockForms = (Array.isArray(stockForms) ? stockForms : []).filter(
    (stockForm) => stockForm?.is_active !== false,
  );
  const matchingStockForm = activeStockForms.find((stockForm) =>
    areInventoryStockFormDefinitionsEqual(stockForm, requestedDefinition),
  ) || null;
  const incomingBarcode = requestedDefinition.barcode;

  if (matchingStockForm) {
    const existingBarcode = normalizeInventoryBarcode(matchingStockForm.barcode);

    if (incomingBarcode && existingBarcode && incomingBarcode !== existingBarcode) {
      return {
        kind: "BARCODE_CONFLICT",
        stockForm: matchingStockForm,
      };
    }

    return {
      kind: "SAME_PACKAGING",
      stockForm: matchingStockForm,
      definition: requestedDefinition,
    };
  }

  const barcodeOwner = incomingBarcode
    ? activeStockForms.find(
        (stockForm) =>
          normalizeInventoryBarcode(stockForm?.barcode) === incomingBarcode,
      ) ||
      (normalizeInventoryBarcode(existingItem?.barcode) === incomingBarcode
        ? { inventory_item_id: existingItem.id }
        : null)
    : null;

  if (barcodeOwner) {
    return {
      kind: "BARCODE_CONFLICT",
      stockForm: barcodeOwner,
      definition: requestedDefinition,
    };
  }

  const itemHasBarcode = Boolean(
    normalizeInventoryBarcode(existingItem?.barcode) ||
      activeStockForms.some((stockForm) =>
        Boolean(normalizeInventoryBarcode(stockForm?.barcode)),
      ),
  );

  if (itemHasBarcode && !incomingBarcode) {
    return {
      kind: "INCOMPATIBLE_ITEM",
      reason: "A barcode is required when adding a packaging to this item.",
    };
  }

  return {
    kind: "DIFFERENT_PACKAGING",
    stockForm: null,
    definition: requestedDefinition,
  };
};

const getInventoryOpeningQuantity = (payload = {}) => {
  if (payload.skip_opening_stock) {
    return 0;
  }

  const packageCount = normalizeInventoryConflictNumber(payload.packaging_count);
  const unitsPerPackaging = normalizeInventoryConflictNumber(payload.quantity);
  const quantity = (packageCount || 0) * (unitsPerPackaging || 0);

  return Number.isFinite(quantity) && quantity > 0 ? quantity : 0;
};

const buildNextMergedInventoryBatchNumber = (inventoryItem, batches = []) => {
  const identifier =
    String(
      inventoryItem?.item_code ||
        inventoryItem?.barcode ||
        inventoryItem?.id ||
        "ITEM",
    )
      .replace(/[^a-z0-9]/gi, "")
      .slice(-8)
      .toUpperCase() || "ITEM";
  const prefix = `${identifier}-BATCH-`;
  const existingSequences = (Array.isArray(batches) ? batches : [])
    .map((batch) => {
      const batchNumber = normalizeInventoryConflictText(batch?.batch_no).toUpperCase();

      if (!batchNumber.startsWith(prefix)) {
        return null;
      }

      const sequence = Number(batchNumber.slice(prefix.length));
      return Number.isInteger(sequence) && sequence > 0 ? sequence : null;
    })
    .filter(Boolean);
  const nextSequence = Math.max(
    Array.isArray(batches) ? batches.length : 0,
    0,
    ...existingSequences,
  ) + 1;

  return `${prefix}${String(nextSequence).padStart(3, "0")}`;
};

const getInventoryBatchesForDuplicateMerge = async (itemId, dbClient) => {
  if (
    !itemId ||
    typeof inventoryBatchRepository.getInventoryBatchesByItemIdForUpdate !==
      "function"
  ) {
    return null;
  }

  return inventoryBatchRepository.getInventoryBatchesByItemIdForUpdate(
    itemId,
    dbClient,
  );
};

const createBatchForDuplicateInventoryItem = async ({
  existingItem,
  stockForm,
  localPayload,
  actorUserId,
  clientTimestamp,
  existingBatches,
  dbClient,
}) => {
  const definition = buildInventoryStockFormDefinitionFromItemPayload(
    localPayload,
  );
  const quantityReceived = getInventoryOpeningQuantity(localPayload);

  if (!quantityReceived || !existingBatches) {
    return null;
  }

  const batchNo = buildNextMergedInventoryBatchNumber(
    existingItem,
    existingBatches,
  );
  const createdBatch = await inventoryBatchService.createInventoryBatch({
    inventory_item_id: existingItem.id,
    inventory_item_stock_form_id: stockForm?.id || null,
    stock_form_barcode: definition.barcode,
    stock_form_packaging: definition.packaging,
    stock_form_units_per_packaging: definition.units_per_packaging,
    stock_form_unit_of_measure: definition.unit_of_measure,
    stock_form_unit_of_measure_value: definition.unit_of_measure_value,
    batch_no: batchNo,
    source_type: "LGU",
    quantity_received: quantityReceived,
    expiration_date: existingItem.is_perishable
      ? localPayload.expiration_date || null
      : null,
    storage_location: "Mayor's Office Inventory",
    created_by: actorUserId,
    received_at: clientTimestamp || null,
    allowBatchNumberReassignment: true,
    forceBatchNumberReassignment: false,
    dbClient,
  });

  return {
    createdBatch,
    batchNo,
    quantityReceived,
    definition,
  };
};

const getEnrichedInventoryDuplicateServerPayload = async ({
  error,
  dbClient,
}) => {
  const fallbackPayload = error?.serverPayload || {};

  if (error?.code !== DUPLICATE_INVENTORY_ITEM || !error?.entityServerId) {
    return fallbackPayload;
  }

  try {
    const existingItem = await getInventoryItemForSyncConflict(
      error.entityServerId,
      dbClient,
    );
    const stockForms = await getInventoryStockFormsForSyncConflict(
      error.entityServerId,
      dbClient,
    );

    return {
      ...fallbackPayload,
      ...(existingItem || {}),
      inventory_item_stock_forms: stockForms,
    };
  } catch (_enrichmentError) {
    return fallbackPayload;
  }
};

const tryAutoMergeDuplicateInventoryItem = async ({
  error,
  entry,
  auth,
  actionConfig,
  syncTransaction,
  dbClient,
}) => {
  if (
    error.code !== DUPLICATE_INVENTORY_ITEM ||
    entry.action_key !== "INVENTORY_ITEM_CREATE"
  ) {
    return null;
  }

  const savepointName = "sync_duplicate_inventory_item_merge";
  const canUseSavepoint = dbClient && typeof dbClient.query === "function";

  if (canUseSavepoint) {
    await dbClient.query(`SAVEPOINT ${savepointName}`);
  }

  try {
    const existingItem = await getInventoryItemForSyncConflict(
      error.entityServerId,
      dbClient,
    );
    const stockForms = await getInventoryStockFormsForSyncConflict(
      error.entityServerId,
      dbClient,
    );
    const plan = getInventoryDuplicateItemPlan({
      existingItem,
      stockForms,
      localPayload: entry.payload,
    });

    if (plan.kind !== "DIFFERENT_PACKAGING") {
      if (canUseSavepoint) {
        await dbClient.query(`ROLLBACK TO SAVEPOINT ${savepointName}`);
      }
      return null;
    }

    const existingBatches = await getInventoryBatchesForDuplicateMerge(
      existingItem?.id,
      dbClient,
    );
    const mergeResult = await createBatchForDuplicateInventoryItem({
      existingItem,
      stockForm: plan.stockForm,
      localPayload: entry.payload,
      actorUserId: auth.userId,
      clientTimestamp: entry.client_timestamp,
      existingBatches,
      dbClient,
    });

    if (!mergeResult) {
      if (canUseSavepoint) {
        await dbClient.query(`ROLLBACK TO SAVEPOINT ${savepointName}`);
      }
      return null;
    }

    const resolvedAt = new Date().toISOString();
    const resolution = {
      automatic: true,
      resolution_status: "RESOLVED_AUTOMATICALLY",
      winner: "MERGED",
      result: "PACKAGING_ADDED_AS_BATCH",
      inventory_item_id: existingItem.id,
      batch_id: mergeResult.createdBatch?.id || null,
      batch_no: mergeResult.createdBatch?.batch_no || mergeResult.batchNo,
      packaging: mergeResult.definition.packaging,
      quantity_received: mergeResult.quantityReceived,
      reason:
        "The inventory item already existed, so the different packaging was added as a separate batch.",
      resolved_at: resolvedAt,
    };
    const serverPayload = {
      ...(error.serverPayload || {}),
      ...existingItem,
      inventory_item_stock_forms: stockForms,
    };
    const current = await syncRepository.recordConflictAndUpdateSyncTransaction({
      syncTransactionId: syncTransaction.id,
      transactionPayload: {
        entity_server_id: existingItem.id,
        server_timestamp: resolvedAt,
        sync_status: SYNC_STATUS.SYNCED,
        error_message: null,
      },
      conflictPayload: {
        sync_transaction_id: syncTransaction.id,
        entity_type: actionConfig.entityType,
        entity_server_id: existingItem.id,
        conflict_type: DUPLICATE_INVENTORY_ITEM,
        local_payload_json: entry.payload,
        server_payload_json: serverPayload,
        resolution_strategy: RESOLUTION_STRATEGY.MERGED,
        resolution_reason:
          "The same inventory item was already saved; its different packaging was added as a separate batch automatically.",
        resolved_payload_json: resolution,
        resolved_by: null,
        resolved_at: resolvedAt,
        status: CONFLICT_STATUS.RESOLVED,
      },
      dbClient,
    });

    return {
      ...current,
      resolution,
      createdBatch: mergeResult.createdBatch,
      existingItem,
    };
  } catch (mergeError) {
    if (canUseSavepoint) {
      try {
        await dbClient.query(`ROLLBACK TO SAVEPOINT ${savepointName}`);
      } catch (_rollbackError) {
        // The outer sync error path will record the original duplicate safely.
      }
    }

    await logErrorSafely({
      actor: auth,
      moduleName: "sync",
      errorCode: "SYNC_DUPLICATE_INVENTORY_ITEM_AUTO_MERGE_FAILED",
      errorMessage:
        "Automatic inventory packaging merge could not be completed; the duplicate was left for review.",
      error: mergeError,
    });
    return null;
  }
};

const tryAutoResolveCrossBarangayDuplicate = async ({
  error,
  entry,
  auth,
  actionConfig,
  syncTransaction,
  dbClient,
}) => {
  if (error.code !== POSSIBLE_CROSS_BARANGAY_HOUSEHOLD_DUPLICATE) {
    return null;
  }

  if (
    typeof syncRepository.findHouseholdRegistrationSyncTransaction !==
      "function" ||
    typeof syncRepository.getBarangayNamesByIds !== "function"
  ) {
    return null;
  }

  const duplicate = error.duplicateRegistration || {};
  const existingTimestamp = error.serverPayload?.registered_at;
  const resolvedAt = new Date().toISOString();
  const existingSyncTransaction =
    await syncRepository.findHouseholdRegistrationSyncTransaction({
      householdId: error.entityServerId,
      disasterEventId: duplicate.registration_data?.disaster_event_id,
      excludeSyncTransactionId: syncTransaction.id,
    }, dbClient);
  const existingPayload =
    existingSyncTransaction?.payload_json?.payload ||
    existingSyncTransaction?.payload_json ||
    {};
  const barangayNames = await syncRepository.getBarangayNamesByIds([
    entry.payload?.barangay_id,
    existingPayload?.barangay_id,
    error.serverPayload?.barangay_id,
  ], dbClient);
  const incomingComparisonPayload = {
    ...entry.payload,
    barangay_name:
      entry.payload?.barangay_name ||
      barangayNames[entry.payload?.barangay_id] ||
      null,
  };
  const existingComparisonPayload = {
    ...existingPayload,
    barangay_name:
      existingPayload?.barangay_name ||
      error.serverPayload?.barangay_name ||
      barangayNames[existingPayload?.barangay_id] ||
      barangayNames[error.serverPayload?.barangay_id] ||
      null,
    disaster_event_title:
      existingPayload?.disaster_event_title ||
      error.serverPayload?.disaster_event_title ||
      null,
  };
  const resolution = buildAutomaticCrossBarangayResolution({
    incomingPayload: incomingComparisonPayload,
    existingPayload: existingComparisonPayload,
    existingSummary: error.serverPayload,
    incomingTimestamp: entry.client_timestamp,
    existingTimestamp,
    resolvedAt,
  });

  if (!resolution) {
    return null;
  }

  resolution.duplicate_group_key = [
    duplicate.registration_data?.disaster_event_id || "unknown-event",
    error.entityServerId || "unknown-household",
    [
      incomingComparisonPayload.barangay_id,
      existingComparisonPayload.barangay_id || error.serverPayload?.barangay_id,
    ]
      .filter(Boolean)
      .map(String)
      .sort()
      .join(":"),
  ].join(":");

  const incomingIsEarlier = resolution.winner === "INCOMING";
  let authoritativeData = null;

  if (incomingIsEarlier) {
    authoritativeData =
      await householdRegistrationService.reconcileCrossBarangayDuplicateWithEarlierRegistration({
        householdId: error.entityServerId,
        registrationData: duplicate.registration_data,
        dbClient,
      });

    if (!authoritativeData) {
      return null;
    }
  }

  const currentConflictPayload = {
    sync_transaction_id: syncTransaction.id,
    entity_type: actionConfig.entityType,
    entity_server_id: error.entityServerId || null,
    conflict_type: POSSIBLE_CROSS_BARANGAY_HOUSEHOLD_DUPLICATE,
    local_payload_json: entry.payload,
    server_payload_json: incomingIsEarlier
      ? existingPayload
      : error.serverPayload || {},
    resolution_strategy: RESOLUTION_STRATEGY.FIRST_ACCEPTED,
    resolution_reason: "Automatically resolved using the earliest valid original registration timestamp.",
    resolved_payload_json: resolution,
    resolved_by: null,
    resolved_at: resolvedAt,
    status: CONFLICT_STATUS.RESOLVED,
  };
  const current = await syncRepository.recordConflictAndUpdateSyncTransaction({
    syncTransactionId: syncTransaction.id,
    transactionPayload: {
      entity_server_id: incomingIsEarlier ? error.entityServerId : null,
      server_timestamp: resolvedAt,
      sync_status: incomingIsEarlier ? SYNC_STATUS.SYNCED : SYNC_STATUS.CONFLICT,
      error_message: incomingIsEarlier
        ? null
        : "Resolved automatically as a duplicate; the earlier registration was retained.",
    },
    conflictPayload: currentConflictPayload,
    dbClient,
  });

  if (existingSyncTransaction?.id) {
    const existingWasWinner = !incomingIsEarlier;
    if (!existingWasWinner) {
      await syncRepository.updateSyncTransaction(existingSyncTransaction.id, {
        entity_server_id: error.entityServerId,
        server_timestamp: resolvedAt,
        sync_status: SYNC_STATUS.CONFLICT,
        error_message: "Resolved automatically as a duplicate; an earlier registration was retained.",
      }, dbClient);
    }

    await syncRepository.recordSyncConflictOnly({
      sync_transaction_id: existingSyncTransaction.id,
      entity_type: actionConfig.entityType,
      entity_server_id: error.entityServerId || null,
      conflict_type: POSSIBLE_CROSS_BARANGAY_HOUSEHOLD_DUPLICATE,
      local_payload_json: existingPayload,
      server_payload_json: entry.payload,
      resolution_strategy: RESOLUTION_STRATEGY.FIRST_ACCEPTED,
      resolution_reason: "Automatically resolved using the earliest valid original registration timestamp.",
      resolved_payload_json: resolution,
      resolved_by: null,
      resolved_at: resolvedAt,
      status: CONFLICT_STATUS.RESOLVED,
    }, dbClient);
  }

  return {
    ...current,
    resolution,
    authoritativeData,
    existingSyncTransaction,
  };
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

  const runSyncProcessingTransaction =
    syncRepository.withSyncProcessingTransaction ||
    (async (callback) => callback(undefined));
  const notificationOutboxEventIds = [];
  const domainSideEffects = [];

  const syncResult = await runSyncProcessingTransaction(async (dbClient) => {
    const clientDeviceUuid = entry.device_id || null;
    const canonicalDeviceId =
      await deviceService.resolveCanonicalDeviceId({
        clientDeviceUuid,
        dbClient,
      });
    const syncAuth = canonicalDeviceId
      ? { ...auth, deviceId: canonicalDeviceId }
      : auth;
    const payloadForAction = normalizeSyncPayloadDeviceReferences(
      entry.payload,
      canonicalDeviceId,
    );
    const claimPayload = {
      client_sync_id: entry.client_sync_id,
      device_id: canonicalDeviceId,
      user_id: syncAuth.userId,
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
    const syncBusinessSavepoint = "sync_business_action";
    const canUseSyncBusinessSavepoint =
      dbClient && typeof dbClient.query === "function";

    try {
      if (canUseSyncBusinessSavepoint) {
        await dbClient.query(`SAVEPOINT ${syncBusinessSavepoint}`);
      }

      const conflictState = await maybeResolveTimestampConflict({
        entry,
        auth: syncAuth,
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
          auth: syncAuth,
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
      payload: payloadForAction,
      auth: syncAuth,
      clientTimestamp: entry.client_timestamp,
      dbClient,
      entry,
      syncTransaction,
      canonicalDeviceId,
      deferDomainSideEffect: (sideEffect) => {
        if (typeof sideEffect === "function") {
          domainSideEffects.push(sideEffect);
        }
      },
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
          auth: syncAuth,
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
      if (!businessEffectApplied && canUseSyncBusinessSavepoint) {
        try {
          await dbClient.query(`ROLLBACK TO SAVEPOINT ${syncBusinessSavepoint}`);
        } catch (rollbackError) {
          await logErrorSafely({
            actor: syncAuth,
            moduleName: "sync",
            errorCode: "SYNC_SAVEPOINT_ROLLBACK_FAILED",
            errorMessage:
              "The sync action failed and its savepoint could not be restored.",
            error: rollbackError,
          });
        }
      }

      if (businessEffectApplied || error.rollbackSyncTransaction) {
        await logErrorSafely({
          actor: syncAuth,
          moduleName: "sync",
          errorCode: "SYNC_POST_EFFECT_BOOKKEEPING_FAILED",
          errorMessage: `Sync terminal bookkeeping failed after business processing for ${entry.action_key}`,
          error,
        });

        throw error;
      }

    const isCrossBarangayDuplicateConflict =
      error.code === POSSIBLE_CROSS_BARANGAY_HOUSEHOLD_DUPLICATE;
    const isDuplicateConflict =
      isCrossBarangayDuplicateConflict ||
      error.code === "DUPLICATE_HOUSEHOLD_REGISTRATION" ||
      error.code === "DUPLICATE_HOUSEHOLD_DEPARTURE" ||
      error.code === "STUB_ALREADY_CLAIMED" ||
      error.code === DUPLICATE_INVENTORY_TRANSACTION_REFERENCE_NO ||
      error.code === DUPLICATE_INVENTORY_BATCH ||
      error.code === DUPLICATE_INVENTORY_ITEM ||
      error.code === DUPLICATE_INVENTORY_BARCODE;

    if (isDuplicateConflict) {
      const serverTimestamp = new Date().toISOString();
      const entityServerId = isCrossBarangayDuplicateConflict
      ? null
      : entry.entity_server_id || error.entityServerId || null;
      const conflictEntityServerId = error.entityServerId || entityServerId;
      const isInventoryItrDuplicate =
        error.code === DUPLICATE_INVENTORY_TRANSACTION_REFERENCE_NO;
      const isManualInventoryDuplicateConflict = [
        DUPLICATE_INVENTORY_ITEM,
        DUPLICATE_INVENTORY_BARCODE,
        DUPLICATE_INVENTORY_BATCH,
      ].includes(error.code);
      const isSystemResolvedDuplicate =
        isInventoryItrDuplicate;
      const isEarlierDepartureResolution =
        error.code === "DUPLICATE_HOUSEHOLD_DEPARTURE" &&
        error.incomingDepartureWasEarlier === true;
      const departureResolutionStrategy =
        error.code === "DUPLICATE_HOUSEHOLD_DEPARTURE"
          ? RESOLUTION_STRATEGY.EARLIEST_ORIGINAL
          : RESOLUTION_STRATEGY.FIRST_ACCEPTED;

      if (
        isEarlierDepartureResolution &&
        typeof syncRepository.findHouseholdDepartureSyncTransactions === "function"
      ) {
        const priorDepartureTransactions =
          await syncRepository.findHouseholdDepartureSyncTransactions({
            householdId: conflictEntityServerId,
            disasterEventId: entry.payload?.disaster_event_id,
            barangayId: entry.payload?.barangay_id,
            excludeSyncTransactionId: syncTransaction.id,
          }, dbClient);
        const resolvedAt = new Date().toISOString();

        for (const priorTransaction of priorDepartureTransactions) {
          await syncRepository.updateSyncTransaction(
            priorTransaction.id,
            {
              entity_server_id: conflictEntityServerId,
              server_timestamp: resolvedAt,
              sync_status: SYNC_STATUS.CONFLICT,
              error_message:
                "Superseded automatically by an earlier original departure timestamp.",
            },
            dbClient,
          );
          await syncRepository.recordSyncConflictOnly({
            sync_transaction_id: priorTransaction.id,
            entity_type: actionConfig.entityType,
            entity_server_id: conflictEntityServerId,
            conflict_type: error.code,
            local_payload_json: priorTransaction.payload_json?.payload || {},
            server_payload_json: entry.payload,
            resolution_strategy: departureResolutionStrategy,
            resolution_reason:
              "The earlier valid original departure timestamp became authoritative.",
            resolved_payload_json: {
              winner: "INCOMING",
              authoritative_payload: entry.payload,
              authoritative_departure_time: error.serverPayload?.time_out || null,
            },
            resolved_by: null,
            resolved_at: resolvedAt,
            status: CONFLICT_STATUS.RESOLVED,
          }, dbClient);
        }
      }

      if (isCrossBarangayDuplicateConflict) {
        const automaticResolution = await tryAutoResolveCrossBarangayDuplicate({
          error,
          entry,
          auth: syncAuth,
          actionConfig,
          syncTransaction,
          dbClient,
        });

        if (automaticResolution) {
          if (automaticResolution.notificationOutboxEvent?.id) {
            notificationOutboxEventIds.push(
              automaticResolution.notificationOutboxEvent.id,
            );
          }

          return {
            client_sync_id: entry.client_sync_id,
            sync_transaction_id: syncTransaction.id,
            sync_status: automaticResolution.syncTransaction.sync_status,
            resolution_status: "RESOLVED_AUTOMATICALLY",
            message:
              automaticResolution.resolution.result ===
              "EARLIER_REGISTRATION_RETAINED"
                ? "Earlier registration retained automatically."
                : "Later registration resolved automatically as a duplicate.",
            data:
              automaticResolution.authoritativeData ||
              automaticResolution.syncTransaction,
            conflict: automaticResolution.conflictRecord,
          };
        }
      }

      if (error.code === DUPLICATE_INVENTORY_ITEM) {
        const automaticResolution = await tryAutoMergeDuplicateInventoryItem({
          error,
          entry,
          auth: syncAuth,
          actionConfig,
          syncTransaction,
          dbClient,
        });

        if (automaticResolution) {
          if (automaticResolution.notificationOutboxEvent?.id) {
            notificationOutboxEventIds.push(
              automaticResolution.notificationOutboxEvent.id,
            );
          }

          return {
            client_sync_id: entry.client_sync_id,
            sync_transaction_id: syncTransaction.id,
            sync_status:
              automaticResolution.syncTransaction?.sync_status ||
              SYNC_STATUS.SYNCED,
            resolution_status: "RESOLVED_AUTOMATICALLY",
            message:
              "The existing item was kept and this packaging was added as a new batch.",
            data: {
              inventory_item: automaticResolution.existingItem,
              inventory_batch: automaticResolution.createdBatch,
            },
            conflict: automaticResolution.conflictRecord,
          };
        }
      }

      const duplicateConflictServerPayload =
        await getEnrichedInventoryDuplicateServerPayload({
          error,
          dbClient,
        });

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
              sync_status: isEarlierDepartureResolution
                ? SYNC_STATUS.SYNCED
                : SYNC_STATUS.CONFLICT,
              error_message: isEarlierDepartureResolution
                ? null
                : error.message || "Duplicate offline action was ignored",
            },
            conflictPayload: {
              sync_transaction_id: syncTransaction.id,
              entity_type: actionConfig.entityType,
              entity_server_id: conflictEntityServerId,
              conflict_type: error.code,
              local_payload_json: entry.payload,
              server_payload_json: duplicateConflictServerPayload,
              resolution_strategy:
                isCrossBarangayDuplicateConflict ||
                isManualInventoryDuplicateConflict
                ? RESOLUTION_STRATEGY.MANUAL_REVIEW
                : departureResolutionStrategy,
              resolved_payload_json:
                isCrossBarangayDuplicateConflict ||
                isManualInventoryDuplicateConflict
                ? null
                : {
                    winner: isEarlierDepartureResolution ? "INCOMING" : "SERVER",
                    reason: error.message,
                    authoritative_payload: duplicateConflictServerPayload,
                    authoritative_departure_time: error.serverPayload?.time_out || null,
                  },
              resolved_by:
                isCrossBarangayDuplicateConflict ||
                isManualInventoryDuplicateConflict
                ? null
                : isSystemResolvedDuplicate
                  ? null
                  : syncAuth.userId,
              resolved_at:
                isCrossBarangayDuplicateConflict ||
                isManualInventoryDuplicateConflict
                ? null
                : serverTimestamp,
              status:
                isCrossBarangayDuplicateConflict ||
                isManualInventoryDuplicateConflict
                ? CONFLICT_STATUS.OPEN
                : CONFLICT_STATUS.RESOLVED,
            },
            dbClient,
          });
        if (notificationOutboxEvent?.id) {
          notificationOutboxEventIds.push(notificationOutboxEvent.id);
        }

        return {
          client_sync_id: entry.client_sync_id,
          sync_transaction_id: syncTransaction.id,
          sync_status: isEarlierDepartureResolution
            ? SYNC_STATUS.SYNCED
            : SYNC_STATUS.CONFLICT,
          message: isEarlierDepartureResolution
            ? "Earlier departure timestamp retained automatically."
            : error.message || "Duplicate offline action was ignored",
          data: conflictTransaction,
          conflict: conflictRecord,
        };
      } catch (conflictError) {
        await logErrorSafely({
          actor: syncAuth,
          moduleName: "sync",
          errorCode: "SYNC_DUPLICATE_CONFLICT_RECORD_FAILED",
          errorMessage: `Failed to record duplicate conflict for ${entry.action_key}`,
          error: conflictError,
        });

        if (canUseSyncBusinessSavepoint) {
          try {
            await dbClient.query(`ROLLBACK TO SAVEPOINT ${syncBusinessSavepoint}`);
          } catch (rollbackError) {
            await logErrorSafely({
              actor: syncAuth,
              moduleName: "sync",
              errorCode: "SYNC_CONFLICT_SAVEPOINT_ROLLBACK_FAILED",
              errorMessage:
                "The duplicate sync conflict could not restore its transaction savepoint.",
              error: rollbackError,
            });
          }
        }

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

    const stockStateDriftConflict =
      await maybeRecordInventoryStockStateDriftConflict({
        error,
        entry,
        auth: syncAuth,
        actionConfig,
        syncTransaction,
        dbClient,
      });

    if (stockStateDriftConflict) {
      if (stockStateDriftConflict.notificationOutboxEvent?.id) {
        notificationOutboxEventIds.push(
          stockStateDriftConflict.notificationOutboxEvent.id,
        );
      }

      return stockStateDriftConflict.result;
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
      actor: syncAuth,
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
      error_code: error.code || null,
    };
    }
  });

  const syncResultWithProcessedNotificationIntents =
    await processCommittedNotificationIntentsSafely({
    eventIds: notificationOutboxEventIds,
    auth,
    syncResult,
  });

  return processCommittedDomainSideEffectsSafely({
    sideEffects: domainSideEffects,
    auth,
    syncResult: syncResultWithProcessedNotificationIntents,
  });
};

const processSyncEntries = async ({ entries, auth }) => {
  const results = [];

  for (const entry of entries) {
    const result = await processSingleSyncEntry(entry, auth);
    results.push(result);
  }

  return results;
};

const getSyncHistory = async ({
  auth,
  syncStatus,
  conflictStatus,
  barangayId = null,
  limit,
}) => {
  const municipalSyncReadScope = getMunicipalSyncReadScope(auth);
  const effectiveLimit = Number(limit) > 0 ? Number(limit) : 50;

  const [rawTransactions, conflicts] = await Promise.all([
    municipalSyncReadScope
      ? municipalSyncReadScope.transactions({
          syncStatus,
          ...(auth.roleCode === ROLE_CODES.MSWDO
            ? { barangayId }
            : {}),
          limit: effectiveLimit,
        })
      : syncRepository.getSyncTransactionsByUser({
          userId: auth.userId,
          syncStatus,
          limit: effectiveLimit,
        }),
    municipalSyncReadScope
      ? municipalSyncReadScope.conflicts({
          status: conflictStatus,
          ...(auth.roleCode === ROLE_CODES.MSWDO
            ? { barangayId }
            : {}),
          limit: effectiveLimit,
        })
      : syncRepository.getSyncConflictsByUser({
          userId: auth.userId,
          status: conflictStatus,
          limit: effectiveLimit,
        }),
  ]);
  const transactions = await enrichSyncTransactionsWithDisasterEventTitles({
    transactions: rawTransactions,
    auth,
  });

  const sortedConflicts = sortConflictsByCreatedAtDesc(conflicts).reduce(
    (uniqueConflicts, conflict) => {
      if (
        auth.roleCode === ROLE_CODES.MSWDO &&
        conflict?.resolved_payload_json?.duplicate_group_key
      ) {
        const groupKey = conflict.resolved_payload_json.duplicate_group_key;
        if (uniqueConflicts.some(
          (candidate) =>
            candidate?.resolved_payload_json?.duplicate_group_key === groupKey,
        )) {
          return uniqueConflicts;
        }
      }
      uniqueConflicts.push(conflict);
      return uniqueConflicts;
    },
    [],
  ).slice(
    0,
    effectiveLimit,
  );

  return {
    transactions,
    conflicts: sortedConflicts.map((conflict) => ({
      ...conflict,
      availableResolutionActions:
        getResolutionCapability(conflict, auth).availableResolutionActions,
    })),
  };
};

const getSyncStatusSummary = async ({ auth }) => {
  const isMswdoMunicipalityStatusScope =
    auth.roleCode === ROLE_CODES.MSWDO &&
    typeof syncRepository.countOpenSyncConflictsByMunicipality === "function" &&
    typeof syncRepository.getLastSuccessfulSyncAtForMunicipality === "function";
  const isMayorMunicipalityStatusScope =
    auth.roleCode === ROLE_CODES.MAYOR &&
    typeof syncRepository.countOpenSyncConflictsByMayor === "function" &&
    typeof syncRepository.getLastSuccessfulSyncAtForMayor === "function";

  if (isMswdoMunicipalityStatusScope || isMayorMunicipalityStatusScope) {
    const [conflictCount, lastSuccessfulSyncAt] = await Promise.all([
      isMswdoMunicipalityStatusScope
        ? syncRepository.countOpenSyncConflictsByMunicipality({})
        : syncRepository.countOpenSyncConflictsByMayor({}),
      isMswdoMunicipalityStatusScope
        ? syncRepository.getLastSuccessfulSyncAtForMunicipality({})
        : syncRepository.getLastSuccessfulSyncAtForMayor({}),
    ]);

    return {
      conflictCount,
      lastSuccessfulSyncAt,
      backendReachable: true,
    };
  }

  const [ownedConflictCount, lastSuccessfulSyncAt] = await Promise.all([
    syncRepository.countOpenSyncConflictsByUser({
      userId: auth.userId,
    }),
    syncRepository.getLastSuccessfulSyncAtByUser({
      userId: auth.userId,
    }),
  ]);

  return {
    conflictCount: ownedConflictCount,
    lastSuccessfulSyncAt,
    backendReachable: true,
  };
};

const getSyncConflictDetail = async ({ auth, conflictId }) => {
  const municipalSyncConflictDetailScope =
    getMunicipalSyncConflictDetailScope(auth);
  const conflict = municipalSyncConflictDetailScope
    ? await municipalSyncConflictDetailScope.conflictById({
        id: conflictId,
      })
    : await syncRepository.getSyncConflictById({
        id: conflictId,
      });
  const capability = getSyncConflictReviewCapability(conflict, auth);
  const isMswdoMunicipalityConflict =
    auth.roleCode === ROLE_CODES.MSWDO &&
    municipalSyncConflictDetailScope?.entityTypes &&
    MSWDO_MUNICIPAL_SYNC_ENTITY_TYPES.has(conflict?.entity_type) &&
    !isRestrictedMswdoConflict(conflict, auth);
  const isMayorMunicipalityConflict =
    auth.roleCode === ROLE_CODES.MAYOR &&
    municipalSyncConflictDetailScope?.entityTypes &&
    MAYOR_MUNICIPAL_SYNC_ENTITY_TYPES.has(conflict?.entity_type);

  if (
    !conflict ||
    (!capability.isOwnedByUser &&
      !capability.canReview &&
      !isMswdoMunicipalityConflict &&
      !isMayorMunicipalityConflict)
  ) {
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

  const isCrossBarangayConflict =
    conflict?.conflict_type === POSSIBLE_CROSS_BARANGAY_HOUSEHOLD_DUPLICATE;
  const isAutomaticCrossBarangayConflict =
    isCrossBarangayConflict && conflict?.resolved_payload_json?.automatic;
  const safeConflict =
    isAutomaticCrossBarangayConflict && auth.roleCode === ROLE_CODES.BARANGAY
      ? {
          ...conflict,
          server_payload_json: {},
          resolved_payload_json: {
            ...conflict.resolved_payload_json,
            earlier_registration: getSafeAutomaticCrossBarangayPayload(
              conflict.resolved_payload_json.earlier_registration,
            ),
            later_registration: getSafeAutomaticCrossBarangayPayload(
              conflict.resolved_payload_json.later_registration,
            ),
          },
        }
      : isCrossBarangayConflict && auth.roleCode === ROLE_CODES.BARANGAY
      ? {
          ...conflict,
          server_payload_json: {
            visibility: "restricted",
            review_message:
              "A similar household registration exists under another Barangay. Municipality-level review is required.",
          },
        }
      : conflict;

  return {
    ...safeConflict,
    availableResolutionActions:
      getResolutionCapability(conflict, auth).availableResolutionActions,
    local_payload_summary: pickDefined(safeConflict.local_payload_json?.payload || safeConflict.local_payload_json, [
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
    server_payload_summary: pickDefined(safeConflict.server_payload_json, [
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

const MANUAL_INVENTORY_DUPLICATE_CONFLICT_TYPES = new Set([
  DUPLICATE_INVENTORY_ITEM,
  DUPLICATE_INVENTORY_BARCODE,
  DUPLICATE_INVENTORY_BATCH,
]);

const getConflictLocalPayload = (conflict) => {
  const localPayload = conflict?.local_payload_json || {};

  if (localPayload?.payload && typeof localPayload.payload === "object") {
    return localPayload.payload;
  }

  return localPayload;
};

const createInvalidConflictResolutionInputError = (message) => {
  const error = new Error(message);
  error.statusCode = 400;
  error.code = "SYNC_CONFLICT_RESOLUTION_INPUT_INVALID";
  return error;
};

const applyManualInventoryDuplicateResolution = async ({
  conflict,
  action,
  replacementBarcode,
  dbClient,
}) => {
  if (action === RESOLUTION_ACTION.KEEP_SERVER) {
    return {
      winner: "SERVER",
      entityServerId: conflict.entity_server_id || null,
    };
  }

  const localPayload = getConflictLocalPayload(conflict);
  const actor = {
    userId: conflict.user_id,
    roleCode: ROLE_CODES.MAYOR,
  };

  if (
    conflict.conflict_type === DUPLICATE_INVENTORY_ITEM &&
    action === RESOLUTION_ACTION.ACCEPT_BOTH
  ) {
    const existingItem = await getInventoryItemForSyncConflict(
      conflict.entity_server_id,
      dbClient,
    );
    const stockForms = await getInventoryStockFormsForSyncConflict(
      conflict.entity_server_id,
      dbClient,
    );
    const plan = getInventoryDuplicateItemPlan({
      existingItem,
      stockForms,
      localPayload,
    });

    if (plan.kind !== "SAME_PACKAGING") {
      throw createInvalidConflictResolutionInputError(
        "Accept Both is available only when both offline entries use the same packaging.",
      );
    }

    const existingBatches = await getInventoryBatchesForDuplicateMerge(
      existingItem?.id,
      dbClient,
    );
    const mergeResult = await createBatchForDuplicateInventoryItem({
      existingItem,
      stockForm: plan.stockForm,
      localPayload,
      actorUserId: conflict.user_id,
      clientTimestamp: conflict.client_timestamp,
      existingBatches,
      dbClient,
    });

    if (!mergeResult) {
      throw createInvalidConflictResolutionInputError(
        "Both entries could not be kept because the saved inventory batch data is incomplete.",
      );
    }

    const lastSavedBatch =
      Array.isArray(existingBatches) && existingBatches.length > 0
        ? existingBatches[existingBatches.length - 1]
        : null;

    return {
      winner: "BOTH",
      entityServerId: existingItem.id,
      acceptedEntity: "INVENTORY_BATCH",
      createdBatchId: mergeResult.createdBatch?.id || null,
      batchNumber: mergeResult.createdBatch?.batch_no || mergeResult.batchNo,
      requestedBatchNumber: mergeResult.batchNo,
      batchNumberOrdering: {
        basis: "EXISTING_ITEM_BATCH_SEQUENCE",
        localEntryOrder: "NEXT_BATCH",
        savedBatchNumberBefore: lastSavedBatch?.batch_no || null,
        savedBatchNumberAfter: lastSavedBatch?.batch_no || null,
        changes: [],
      },
    };
  }

  if (
    conflict.conflict_type === DUPLICATE_INVENTORY_BATCH &&
    action === RESOLUTION_ACTION.ACCEPT_BOTH
  ) {
    const localCapturedAt =
      conflict.client_timestamp || localPayload.received_at || null;
    const batchResequencing =
      typeof inventoryBatchService.resequenceInventoryBatchForAcceptBoth ===
      "function"
        ? await inventoryBatchService.resequenceInventoryBatchForAcceptBoth({
            existingBatchId: conflict.entity_server_id,
            requestedBatchNo: localPayload.batch_no,
            localCapturedAt,
            dbClient,
          })
        : { reordered: false };
    const createdBatch = await inventoryBatchService.createInventoryBatch({
      ...localPayload,
      ...(batchResequencing.inventoryItemId
        ? { inventory_item_id: batchResequencing.inventoryItemId }
        : {}),
      created_by: conflict.user_id,
      received_at: localCapturedAt,
      allowBatchNumberReassignment: true,
      // If the incoming entry was recorded later, keep the saved batch at the
      // requested number and place this entry at the next free number. If it
      // was recorded earlier, the saved batch was moved first so this entry
      // can keep the requested number.
      forceBatchNumberReassignment: batchResequencing.reordered !== true,
      dbClient,
    });

    return {
      winner: "BOTH",
      entityServerId: createdBatch?.id || null,
      acceptedEntity: "INVENTORY_BATCH",
      batchNumber: createdBatch?.batch_no || null,
      requestedBatchNumber: localPayload.batch_no || null,
      batchNumberOrdering: {
        basis: batchResequencing.orderingBasis || "OFFLINE_CAPTURE_TIME",
        localEntryOrder: batchResequencing.reordered
          ? "EARLIER"
          : "LATER_OR_TIE",
        savedBatchNumberBefore:
          batchResequencing.existingBatchNumberBefore ||
          conflict.server_payload_json?.batch_no ||
          null,
        savedBatchNumberAfter:
          batchResequencing.existingBatchNumberAfter ||
          conflict.server_payload_json?.batch_no ||
          null,
        changes: batchResequencing.batchNumberChanges || [],
      },
    };
  }

  if (
    conflict.conflict_type === DUPLICATE_INVENTORY_BARCODE &&
    action === RESOLUTION_ACTION.APPLY_LOCAL
  ) {
    if (!replacementBarcode) {
      throw createInvalidConflictResolutionInputError(
        "A new barcode is required before accepting this device record.",
      );
    }

    const correctedPayload = {
      ...localPayload,
    };

    if (conflict.entity_type === "INVENTORY_ITEM") {
      correctedPayload.barcode = replacementBarcode;
      const createdItem = await inventoryItemService.createInventoryItem(
        correctedPayload,
        actor,
        {
          clientTimestamp: conflict.client_timestamp,
          dbClient,
        },
      );

      return {
        winner: "LOCAL",
        entityServerId: createdItem?.id || null,
        acceptedEntity: "INVENTORY_ITEM",
        replacementBarcode,
      };
    }

    if (conflict.entity_type === "INVENTORY_BATCH") {
      correctedPayload.stock_form_barcode = replacementBarcode;
      const createdBatch = await inventoryBatchService.createInventoryBatch({
        ...correctedPayload,
        created_by: conflict.user_id,
        received_at:
          correctedPayload.received_at || conflict.client_timestamp || null,
        allowBatchNumberReassignment: true,
        forceBatchNumberReassignment: false,
        dbClient,
      });

      return {
        winner: "LOCAL",
        entityServerId: createdBatch?.id || null,
        acceptedEntity: "INVENTORY_BATCH",
        replacementBarcode,
        batchNumber: createdBatch?.batch_no || null,
      };
    }
  }

  throw createResolutionActionNotAllowedError();
};

const resolveSyncConflict = async ({
  auth,
  conflictId,
  action,
  reason = null,
  replacementBarcode = null,
}) => {
  const notificationOutboxEventIds = [];
  let resolvedConflict = null;

  const result = await syncRepository.withSyncProcessingTransaction(
    async (dbClient) => {
      const conflict = await syncRepository.lockSyncConflictById(
        { id: conflictId },
        dbClient,
      );

      if (!conflict) {
        throw createConflictNotFoundError();
      }

      if (conflict.status !== CONFLICT_STATUS.OPEN) {
        throw createConflictAlreadyResolvedError();
      }

      const capability = getResolutionCapability(conflict, auth);

      if (!capability.availableResolutionActions.includes(action)) {
        throw createResolutionActionNotAllowedError();
      }

      const isManualInventoryDuplicateConflict =
        MANUAL_INVENTORY_DUPLICATE_CONFLICT_TYPES.has(conflict.conflict_type);
      const inventoryResolution = isManualInventoryDuplicateConflict
        ? await applyManualInventoryDuplicateResolution({
            conflict,
            action,
            replacementBarcode,
            dbClient,
          })
        : null;
      const resolutionServerTimestamp = new Date().toISOString();

      if (isManualInventoryDuplicateConflict) {
        const updatedSyncTransaction =
          await syncRepository.updateSyncTransaction(
            conflict.sync_transaction_id,
            {
              entity_server_id:
                inventoryResolution.entityServerId ||
                conflict.entity_server_id ||
                null,
              server_timestamp: resolutionServerTimestamp,
              sync_status: SYNC_STATUS.SYNCED,
              error_message: null,
            },
            dbClient,
          );

        if (!updatedSyncTransaction) {
          throw createConflictPersistenceError(
            "The sync transaction could not be updated after conflict resolution.",
          );
        }
      }

      const resolvedPayload = {
        ...getSafeConflictServerSummary(conflict),
        resolution_action: action,
        reviewer_role_code: auth.roleCode,
        ...(inventoryResolution || {}),
      };

      const updatedConflict = await syncRepository.markSyncConflictResolved(
        {
          conflictId: conflict.id,
          resolutionAction: action,
          resolutionReason: reason,
          resolvedPayloadJson: resolvedPayload,
          resolvedBy: auth.userId,
        },
        dbClient,
      );

      if (!updatedConflict) {
        throw createConflictAlreadyResolvedError();
      }

      await insertAuditLog(
        {
          user_id: auth.userId,
          role_code: auth.roleCode,
          device_id: null,
          action: "SYNC_CONFLICT_RESOLUTION",
          entity_type: "SYNC_CONFLICT",
          entity_id: conflict.id,
          old_values_json: {
            status: conflict.status,
            resolution_strategy: conflict.resolution_strategy,
            resolution_action: conflict.resolution_action || null,
          },
          new_values_json: {
            status: updatedConflict.status,
            resolution_strategy: updatedConflict.resolution_strategy,
            resolution_action: updatedConflict.resolution_action,
            conflict_type: updatedConflict.conflict_type,
            reason_provided: Boolean(reason),
            sync_transaction_id: updatedConflict.sync_transaction_id,
            batch_number_ordering:
              inventoryResolution?.batchNumberOrdering || null,
          },
          ip_address: null,
          source_event_key: `SYNC_CONFLICT_RESOLUTION:${conflict.id}:${action}`,
        },
        dbClient,
      );

      if (action !== RESOLUTION_ACTION.MARK_REVIEWED) {
        const notificationOutboxEvent =
          await notificationService.ensureSyncNotificationIntent(
            {
              eventType: "SYNC_CONFLICT_RESOLVED",
              sourceType: "SYNC_CONFLICT",
              sourceId: conflict.id,
            },
            dbClient,
          );

        if (notificationOutboxEvent?.id) {
          notificationOutboxEventIds.push(notificationOutboxEvent.id);
        }
      }

      resolvedConflict = {
        ...conflict,
        ...updatedConflict,
        sync_status:
          isManualInventoryDuplicateConflict ||
          action === RESOLUTION_ACTION.APPLY_LOCAL
            ? SYNC_STATUS.SYNCED
            : conflict.sync_status,
        entity_server_id:
          inventoryResolution?.entityServerId || conflict.entity_server_id,
        user_id: conflict.user_id,
        client_timestamp: conflict.client_timestamp,
        server_timestamp: conflict.server_timestamp,
        operation_type: conflict.operation_type,
        availableResolutionActions: [],
      };

      return resolvedConflict;
    },
  );

  await processCommittedNotificationIntentsSafely({
    eventIds: notificationOutboxEventIds,
    auth,
    syncResult: result,
  });

  return resolvedConflict;
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
  resolveSyncConflict,
  auditSyncRetryRequest,
  isSupportedSyncAction,
  SUPPORTED_SYNC_ACTION_KEYS,
};
