import db, { LOCAL_SYNC_STATUS } from "../../offline/db.js";
import {
  getSyncQueueActorContext,
  getVisibleSyncQueueEntries,
} from "../../offline/syncQueue.js";
import { ROLE_CODES } from "../../utils/roleSession.js";
import { extractStubQrValue } from "../../utils/stubQr.js";

const STUB_CLAIM_ACTION_KEY = "STUB_CLAIM";
const claimTerminalStatuses = new Set([
  LOCAL_SYNC_STATUS.SYNCED,
  LOCAL_SYNC_STATUS.CONFLICT,
]);
const claimBlockingStatuses = new Set([
  LOCAL_SYNC_STATUS.PENDING,
  LOCAL_SYNC_STATUS.CONFLICT,
]);

const trimValue = (value) => String(value || "").trim();
const getIsoNow = () => new Date().toISOString();

const getFirstValue = (...values) =>
  values.find((value) => value !== undefined && value !== null && value !== "");

export const buildOfflineStubCacheId = ({ accessMode, userId, roleCode, stubId }) =>
  [accessMode, userId, roleCode, stubId].map(trimValue).join("|");

export const hasCompleteOfflineStubOwnerContext = (ownerContext = {}) =>
  Boolean(
    trimValue(ownerContext.accessMode) &&
      trimValue(ownerContext.userId) &&
      trimValue(ownerContext.roleCode),
  );

export const isOfflineStubVisibleForContext = (
  cachedRow,
  ownerContext = getSyncQueueActorContext(),
  { currentBarangayId = "" } = {},
) => {
  if (!cachedRow || !hasCompleteOfflineStubOwnerContext(ownerContext)) {
    return false;
  }

  if (
    cachedRow.accessMode !== ownerContext.accessMode ||
    cachedRow.userId !== ownerContext.userId ||
    cachedRow.roleCode !== ownerContext.roleCode
  ) {
    return false;
  }

  if (ownerContext.roleCode === ROLE_CODES.BARANGAY) {
    const trustedBarangayId = trimValue(currentBarangayId);
    return Boolean(trustedBarangayId && cachedRow.barangay_id === trustedBarangayId);
  }

  return true;
};

const sanitizeAssignedReliefPacks = (row = {}) => {
  const assignedReliefPacks = Array.isArray(row.assigned_relief_packs)
    ? row.assigned_relief_packs
    : [];

  return assignedReliefPacks
    .filter((template) => template && typeof template === "object")
    .map((template) => ({
      id: template.id || "",
      name: template.name || "",
      description: template.description || "",
      based_on_family_size: Boolean(template.based_on_family_size),
      is_additional_pack: Boolean(template.is_additional_pack),
    }));
};

export const toOfflineStubSnapshot = (
  serverRow,
  ownerContext = getSyncQueueActorContext(),
  { cachedAt = getIsoNow() } = {},
) => {
  const stubId = trimValue(getFirstValue(serverRow?.id, serverRow?.stub_id));

  if (!stubId || serverRow?.is_local_only || !hasCompleteOfflineStubOwnerContext(ownerContext)) {
    return null;
  }

  const household = serverRow.household || {};
  const disasterEvent = serverRow.disaster_event || {};
  const barangay = serverRow.barangay || {};
  const qrCodeValue = trimValue(serverRow.qr_code_value);

  return {
    id: buildOfflineStubCacheId({ ...ownerContext, stubId }),
    stubId,
    accessMode: ownerContext.accessMode,
    userId: ownerContext.userId,
    roleCode: ownerContext.roleCode,
    disaster_event_id: trimValue(
      getFirstValue(serverRow.disaster_event_id, disasterEvent.id),
    ),
    disaster_event_name: trimValue(
      getFirstValue(disasterEvent.name, disasterEvent.title, disasterEvent.event_name),
    ),
    barangay_id: trimValue(
      getFirstValue(serverRow.barangay_id, barangay.id, household.barangay_id),
    ),
    barangay_name: trimValue(getFirstValue(barangay.name, serverRow.barangay_name)),
    household_id: trimValue(getFirstValue(serverRow.household_id, household.id)),
    family_head_name: trimValue(
      getFirstValue(serverRow.family_head_name, household.family_head_name),
    ),
    members_count:
      Number(
        getFirstValue(
          household.members_count,
          serverRow.members_count,
          household.household_size,
          serverRow.household_size,
        ),
      ) || 0,
    household_is_active: household.is_active !== false,
    display_stub_no: trimValue(serverRow.display_stub_no),
    stub_sequence_no: getFirstValue(serverRow.stub_sequence_no, null),
    stub_number: trimValue(getFirstValue(serverRow.stub_number, serverRow.stub_no)),
    stub_no: trimValue(serverRow.stub_no),
    serial_no: trimValue(serverRow.serial_no),
    qr_code_value: qrCodeValue,
    qr_status: trimValue(serverRow.qr_status),
    relief_pack_name: trimValue(
      getFirstValue(
        serverRow.relief_pack_name,
        serverRow.relief_pack_template_name,
        serverRow.distribution_transaction?.relief_pack_template_name,
      ),
    ),
    assigned_relief_packs: sanitizeAssignedReliefPacks(serverRow),
    sectors_text: trimValue(serverRow.sectors_text) || "-",
    status: trimValue(serverRow.status) || "ISSUED",
    server_updated_at: trimValue(
      getFirstValue(serverRow.updated_at, serverRow.qr_generated_at, serverRow.issued_at),
    ),
    cached_at: cachedAt,
  };
};

export const toStubRowFromOfflineSnapshot = (snapshot, syncEntry = null) => {
  if (!snapshot) {
    return null;
  }

  const syncStatus = syncEntry?.status || null;

  return {
    id: snapshot.stubId,
    household_id: snapshot.household_id,
    family_head_name: snapshot.family_head_name,
    household: {
      id: snapshot.household_id,
      family_head_name: snapshot.family_head_name,
      members_count: snapshot.members_count,
      is_active: snapshot.household_is_active,
    },
    members_count: snapshot.members_count,
    display_stub_no: snapshot.display_stub_no,
    stub_sequence_no: snapshot.stub_sequence_no,
    stub_number: snapshot.stub_number,
    stub_no: snapshot.stub_no,
    serial_no: snapshot.serial_no,
    qr_code_value: snapshot.qr_code_value,
    qr_status: snapshot.qr_status,
    relief_pack_name: snapshot.relief_pack_name,
    assigned_relief_packs: snapshot.assigned_relief_packs || [],
    sectors_text: snapshot.sectors_text || "-",
    status: snapshot.status || "ISSUED",
    sync_status: syncStatus,
    is_cached_offline: true,
    is_claim_pending: syncStatus === LOCAL_SYNC_STATUS.PENDING,
    cached_at: snapshot.cached_at,
    disaster_event: {
      id: snapshot.disaster_event_id,
      name: snapshot.disaster_event_name,
    },
    barangay: {
      id: snapshot.barangay_id,
      name: snapshot.barangay_name,
    },
  };
};

export const toStubDetailsFromOfflineSnapshot = (snapshot) => {
  const row = toStubRowFromOfflineSnapshot(snapshot);

  if (!row) {
    return null;
  }

  return {
    ...row,
    household: {
      ...row.household,
      household_size: snapshot.members_count,
      members: [],
      family_head_photo_url: "",
      photo_captured_at: "",
    },
    disaster_event: row.disaster_event,
    barangay: row.barangay,
  };
};

const getClaimSyncEntryForStub = (syncEntries = [], stubId) =>
  syncEntries.find(
    (entry) =>
      entry.actionKey === STUB_CLAIM_ACTION_KEY &&
      entry.entityType === "STUB" &&
      entry.entityServerId === stubId &&
      claimBlockingStatuses.has(entry.status),
  ) || null;

export const canUseOfflineStubCacheFallback = (error) => {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return true;
  }

  if (error?.statusCode) {
    return false;
  }

  const message = String(error?.message || "");
  return /Failed to fetch|NetworkError|Load failed/i.test(message);
};

export const upsertOfflineStubSnapshots = async (serverRows = []) => {
  const ownerContext = getSyncQueueActorContext();

  if (!hasCompleteOfflineStubOwnerContext(ownerContext)) {
    return [];
  }

  const snapshots = (Array.isArray(serverRows) ? serverRows : [serverRows])
    .map((row) => toOfflineStubSnapshot(row, ownerContext))
    .filter(Boolean);

  if (snapshots.length > 0) {
    await db.offlineStubCache.bulkPut(snapshots);
  }

  return snapshots;
};

export const getCachedStubSnapshotsForScope = async ({
  disasterEventId,
  currentBarangayId,
}) => {
  const ownerContext = getSyncQueueActorContext();

  if (
    !hasCompleteOfflineStubOwnerContext(ownerContext) ||
    !disasterEventId ||
    !currentBarangayId
  ) {
    return [];
  }

  return db.offlineStubCache
    .where("[accessMode+userId+roleCode+disaster_event_id+barangay_id]")
    .equals([
      ownerContext.accessMode,
      ownerContext.userId,
      ownerContext.roleCode,
      disasterEventId,
      currentBarangayId,
    ])
    .filter((row) =>
      isOfflineStubVisibleForContext(row, ownerContext, { currentBarangayId }),
    )
    .toArray();
};

export const hasCachedStubSnapshotsForScope = async ({
  disasterEventId,
  currentBarangayId,
}) => {
  const snapshots = await getCachedStubSnapshotsForScope({
    disasterEventId,
    currentBarangayId,
  });

  return snapshots.length > 0;
};

export const getCachedStubRowsForScope = async ({
  disasterEventId,
  currentBarangayId,
}) => {
  const [snapshots, syncEntries] = await Promise.all([
    getCachedStubSnapshotsForScope({ disasterEventId, currentBarangayId }),
    getVisibleSyncQueueEntries(),
  ]);

  return snapshots
    .map((snapshot) =>
      toStubRowFromOfflineSnapshot(
        snapshot,
        getClaimSyncEntryForStub(syncEntries, snapshot.stubId),
      ),
    )
    .filter(Boolean);
};

export const getCachedStubSnapshotById = async (stubId, { currentBarangayId }) => {
  const ownerContext = getSyncQueueActorContext();

  if (!hasCompleteOfflineStubOwnerContext(ownerContext) || !stubId) {
    return null;
  }

  const cachedRow = await db.offlineStubCache
    .where("[accessMode+userId+roleCode+stubId]")
    .equals([ownerContext.accessMode, ownerContext.userId, ownerContext.roleCode, stubId])
    .first();

  return isOfflineStubVisibleForContext(cachedRow, ownerContext, { currentBarangayId })
    ? cachedRow
    : null;
};

export const getCachedStubDetailsById = async (stubId, { currentBarangayId }) => {
  const snapshot = await getCachedStubSnapshotById(stubId, { currentBarangayId });
  return toStubDetailsFromOfflineSnapshot(snapshot);
};

export const getCachedStubDetailsByQrValue = async (
  qrCodeValue,
  { currentBarangayId },
) => {
  const normalizedQrValue = extractStubQrValue(qrCodeValue);
  const ownerContext = getSyncQueueActorContext();

  if (!hasCompleteOfflineStubOwnerContext(ownerContext) || !normalizedQrValue) {
    return null;
  }

  const cachedRow = await db.offlineStubCache
    .where("[accessMode+userId+roleCode+qr_code_value]")
    .equals([
      ownerContext.accessMode,
      ownerContext.userId,
      ownerContext.roleCode,
      normalizedQrValue,
    ])
    .first();

  if (!isOfflineStubVisibleForContext(cachedRow, ownerContext, { currentBarangayId })) {
    return null;
  }

  return toStubDetailsFromOfflineSnapshot(cachedRow);
};

export const markCachedStubClaimTerminal = async (
  stubId,
  terminalStatus = LOCAL_SYNC_STATUS.SYNCED,
) => {
  const ownerContext = getSyncQueueActorContext();

  if (!hasCompleteOfflineStubOwnerContext(ownerContext) || !stubId) {
    return;
  }

  const cachedRow = await db.offlineStubCache
    .where("[accessMode+userId+roleCode+stubId]")
    .equals([ownerContext.accessMode, ownerContext.userId, ownerContext.roleCode, stubId])
    .first();

  if (!cachedRow) {
    return;
  }

  await db.offlineStubCache.update(cachedRow.id, {
    status: "CLAIMED",
    last_terminal_sync_status: terminalStatus,
    updated_at: getIsoNow(),
  });
};

export const reconcileOfflineStubCacheForSyncResult = async (entry, result) => {
  if (
    entry?.actionKey !== STUB_CLAIM_ACTION_KEY ||
    !claimTerminalStatuses.has(result?.sync_status)
  ) {
    return;
  }

  await markCachedStubClaimTerminal(entry.entityServerId, result.sync_status);
};
