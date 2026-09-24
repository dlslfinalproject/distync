import {
  buildOfflineQueuedResponse,
  performSyncableMutation,
} from "../../offline/syncService";
import { getOfflineDeviceId } from "../../offline/deviceIdentity.js";
import {
  canUseOfflineStubCacheFallback,
  applyLocalStubClaimSyncState,
  applyLocalStubClaimSyncStates,
  getClaimSyncEntryForStub,
  getCachedStubClaimSyncEntry,
  getCachedStubDetailsById,
  getCachedStubDetailsByQrValue,
  isLocalStubClaimBlocked,
  markCachedStubClaimTerminal,
  upsertOfflineStubSnapshots,
} from "./stubCache.js";
import { resolveStubSectorIdsForApi } from "./stubSectorFilters.js";
import { QR_SCAN_ERROR_CODES } from "./stubQrScanErrors.js";
import {
  getVisibleStubClaimSyncEntriesForStub,
  getVisibleSyncQueueEntries,
  getVisibleSyncQueueEntriesForBarangay,
} from "../../offline/syncQueue.js";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

const buildSearchUrl = ({ query, disasterEventId, barangayId }) => {
  const searchParams = new URLSearchParams();

  searchParams.set("q", query.trim());

  if (disasterEventId) {
    searchParams.set("disaster_event_id", disasterEventId);
  }

  if (barangayId) {
    searchParams.set("barangay_id", barangayId);
  }

  return `${API_BASE_URL}/api/v1/stubs/search?${searchParams.toString()}`;
};

const handleJsonResponse = async (response, fallbackMessage) => {
  const responseData = await response.json().catch(() => null);

  if (!response.ok) {
    const error = new Error(responseData?.message || fallbackMessage);
    error.code = responseData?.code || responseData?.error || "";
    error.details = responseData?.details || null;
    error.statusCode = response.status;
    throw error;
  }

  return responseData;
};

const getOfflineVerificationFailure = (details = {}) => {
  const localSyncStatus = String(details.sync_status || "").toUpperCase();
  if (localSyncStatus === "PENDING" || localSyncStatus === "FAILED" || details.is_claim_pending) {
    return {
      code: QR_SCAN_ERROR_CODES.STUB_CLAIM_PENDING,
      reason:
        "This relief stub has a local claim awaiting synchronization on this device. Retry or review synchronization before trying again.",
    };
  }
  if (localSyncStatus === "CONFLICT") {
    return {
      code: QR_SCAN_ERROR_CODES.STUB_CLAIM_CONFLICT,
      reason:
        "This relief stub has a synchronization conflict and cannot be claimed again until it is reviewed.",
    };
  }

  const stubStatus = String(details.status || "").trim().toUpperCase();
  const qrStatus = String(details.qr_status || "").trim().toUpperCase();
  const eventStatus = String(
    details.disaster_event?.status || details.disaster_event_status || "",
  )
    .trim()
    .toUpperCase();
  const attendanceStatus = String(
    details.latest_attendance_status ?? details.latest_attendance?.status ?? "",
  )
    .trim()
    .toUpperCase();
  const attendanceTimeOut =
    details.latest_attendance_time_out ?? details.latest_attendance?.time_out;

  if (stubStatus === "CLAIMED") {
    return {
      code: QR_SCAN_ERROR_CODES.STUB_ALREADY_CLAIMED,
      reason:
        "This relief stub has already been used in a completed distribution and cannot be claimed again.",
    };
  }

  if (stubStatus === "CANCELLED" || stubStatus === "VOID") {
    return {
      code:
        stubStatus === "CANCELLED"
          ? QR_SCAN_ERROR_CODES.STUB_CANCELLED
          : QR_SCAN_ERROR_CODES.STUB_VOID,
      reason: "This relief stub is not available for distribution processing.",
    };
  }

  if (stubStatus !== "ISSUED") {
    return {
      code: QR_SCAN_ERROR_CODES.STUB_UNAVAILABLE,
      reason: "This relief stub is not available for distribution processing.",
    };
  }

  if (details.household?.is_active === false) {
    return {
      code: QR_SCAN_ERROR_CODES.HOUSEHOLD_ARCHIVED,
      reason:
        "This household is archived and cannot receive a new relief distribution.",
    };
  }

  if (qrStatus && qrStatus !== "ACTIVE") {
    return {
      code: QR_SCAN_ERROR_CODES.QR_INACTIVE,
      reason:
        "This QR reference is inactive and cannot be used for relief distribution.",
    };
  }

  if (eventStatus && eventStatus !== "ACTIVE") {
    return {
      code: QR_SCAN_ERROR_CODES.DISASTER_EVENT_NOT_ACTIVE,
      reason:
        "This relief claim cannot be completed because the disaster event is no longer active.",
    };
  }

  if (attendanceStatus !== "PRESENT" || attendanceTimeOut) {
    return {
      code: QR_SCAN_ERROR_CODES.HOUSEHOLD_NOT_PRESENT_IN_EVAC_CENTER,
      reason:
        "This stub cannot be claimed because the household is not currently present in an evacuation center.",
    };
  }

  return null;
};

const assertNoBlockingLocalStubClaim = async (stubId, scope = {}) => {
  let syncEntry;

  try {
    syncEntry = await getCachedStubClaimSyncEntry(stubId, scope);
  } catch (error) {
    // Online claims still have server-side duplicate protection. If local
    // storage is unavailable, do not regress the existing online path; an
    // offline claim must still fail safely instead of queueing unverified data.
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      throw error;
    }

    return;
  }

  if (!syncEntry) {
    return;
  }

  const isConflict = syncEntry.status === "CONFLICT";
  const isSynced = syncEntry.status === "SYNCED";
  const error = new Error(
    isConflict
      ? "This relief stub has a synchronization conflict and cannot be claimed again until it is reviewed."
      : isSynced
        ? "This relief stub already has a centrally confirmed claim."
        : "This relief stub already has a local claim awaiting synchronization. Review or retry it before trying again.",
  );
  error.code = isConflict
    ? "STUB_CLAIM_CONFLICT"
    : isSynced
      ? "STUB_ALREADY_CLAIMED"
      : "STUB_CLAIM_PENDING";
  error.statusCode = 409;
  throw error;
};

const isOfflineClaimLocallyReady = async ({
  stubId,
  currentBarangayId,
  disasterEventId,
  householdId,
  proofType,
  qrReferenceValue,
}) => {
  if (typeof navigator !== "undefined" && navigator.onLine !== false) {
    return true;
  }

  const details = await getCachedStubDetailsById(stubId, {
    currentBarangayId: currentBarangayId || undefined,
  });
  if (!details || details.is_local_only || details.status !== "ISSUED") {
    return false;
  }

  const cachedEventId =
    details.disaster_event?.id || details.disaster_event_id || "";
  const cachedHouseholdId = details.household?.id || details.household_id || "";
  const attendanceStatus = String(
    details.latest_attendance?.status || details.latest_attendance_status || "",
  ).toUpperCase();
  const attendanceTimeOut =
    details.latest_attendance?.time_out ?? details.latest_attendance_time_out;
  const eventStatus = String(
    details.disaster_event?.status || details.disaster_event_status || "",
  ).toUpperCase();
  const assignedPacks = Array.isArray(details.assigned_relief_packs)
    ? details.assigned_relief_packs
    : [];
  const hasStandardPack = assignedPacks.some(
    (pack) => pack?.id && !pack?.is_additional_pack,
  );

  if (
    !cachedEventId ||
    !disasterEventId ||
    String(cachedEventId) !== String(disasterEventId) ||
    (eventStatus && eventStatus !== "ACTIVE") ||
    !cachedHouseholdId ||
    (householdId && String(cachedHouseholdId) !== String(householdId)) ||
    details.household?.is_active === false ||
    attendanceStatus !== "PRESENT" ||
    attendanceTimeOut ||
    !hasStandardPack
  ) {
    return false;
  }

  if (proofType === "QR") {
    return Boolean(
      qrReferenceValue &&
        details.qr_code_value === qrReferenceValue &&
        String(details.qr_status || "").toUpperCase() === "ACTIVE",
    );
  }

  return proofType === "PHOTO";
};

export const fetchBarangayStubDashboard = async ({
  userId,
  disasterEventId,
  barangayId,
  overrideBarangayId,
  page,
  pageSize,
  search,
  status,
  sectorIds,
  sectorOptions = [],
  sortOrder,
  skipOfflineCache = false,
}) => {
  const searchParams = new URLSearchParams({
    disaster_event_id: disasterEventId,
  });

  if (userId) {
    searchParams.set("user_id", userId);
  }

  if (barangayId) {
    searchParams.set("barangay_id", barangayId);
  }

  if (overrideBarangayId) {
    searchParams.set("override_barangay_id", overrideBarangayId);
  }

  if (page) {
    searchParams.set("page", page);
  }

  if (pageSize) {
    searchParams.set("pageSize", pageSize);
  }

  if (typeof search === "string" && search.trim()) {
    searchParams.set("search", search.trim());
  }

  if (status) {
    searchParams.set("status", status);
  }

  const resolvedSectorIds = resolveStubSectorIdsForApi(
    sectorIds,
    sectorOptions,
  );

  if (resolvedSectorIds.length > 0) {
    searchParams.set("sector_ids", resolvedSectorIds.join(","));
  }

  if (sortOrder) {
    searchParams.set("sort_order", sortOrder);
  }

  const response = await fetch(
    `${API_BASE_URL}/api/v1/stubs/barangay-dashboard?${searchParams.toString()}`,
  );

  const responseData = await handleJsonResponse(
    response,
    "Failed to fetch stub dashboard",
  );

  // Dashboard rows inherit event/barangay context from the response envelope.
  // Copy it onto each cached row so automatic preparation has the same shape
  // as the manual fetchStubDetails path used by offline QR validation.
  responseData.data = (Array.isArray(responseData.data) ? responseData.data : []).map((row) => ({
    ...row,
    disaster_event_id: row.disaster_event_id || responseData.disaster_event?.id || disasterEventId,
    disaster_event: row.disaster_event || responseData.disaster_event || { id: disasterEventId },
    barangay_id: row.barangay_id || responseData.assigned_barangay?.id || barangayId || "",
    barangay: row.barangay || responseData.assigned_barangay || null,
  }));

  if (!skipOfflineCache) {
    await upsertOfflineStubSnapshots(responseData?.data || []);
  }

  const scopedBarangayId =
    responseData?.assigned_barangay?.id ||
    responseData?.assigned_barangay_id ||
    overrideBarangayId ||
    barangayId ||
    "";
  const syncEntries = await getVisibleSyncQueueEntriesForBarangay(scopedBarangayId);
  responseData.data = applyLocalStubClaimSyncStates(responseData?.data || [], syncEntries);

  return responseData;
};

export const fetchMunicipalStubDashboard = async ({
  disasterEventId,
  page,
  pageSize,
  search,
  status,
  sectorIds,
  sectorOptions = [],
  sortOrder,
  skipOfflineCache = false,
}) => {
  const searchParams = new URLSearchParams({
    disaster_event_id: disasterEventId,
  });

  if (page) {
    searchParams.set("page", page);
  }

  if (pageSize) {
    searchParams.set("pageSize", pageSize);
  }

  if (typeof search === "string" && search.trim()) {
    searchParams.set("search", search.trim());
  }

  if (status) {
    searchParams.set("status", status);
  }

  const resolvedSectorIds = resolveStubSectorIdsForApi(
    sectorIds,
    sectorOptions,
  );

  if (resolvedSectorIds.length > 0) {
    searchParams.set("sector_ids", resolvedSectorIds.join(","));
  }

  if (sortOrder) {
    searchParams.set("sort_order", sortOrder);
  }

  const response = await fetch(
    `${API_BASE_URL}/api/v1/stubs/municipal-dashboard?${searchParams.toString()}`,
  );
  const responseData = await handleJsonResponse(
    response,
    "Failed to fetch municipal stub dashboard",
  );

  responseData.data = (
    Array.isArray(responseData.data) ? responseData.data : []
  ).map((row) => ({
    ...row,
    disaster_event_id:
      row.disaster_event_id || responseData.disaster_event?.id || disasterEventId,
    disaster_event:
      row.disaster_event || responseData.disaster_event || { id: disasterEventId },
    barangay_id: row.barangay_id || "",
    barangay:
      row.barangay ||
      (row.barangay_id || row.barangay_name
        ? { id: row.barangay_id || "", name: row.barangay_name || "" }
        : null),
  }));

  if (!skipOfflineCache) {
    await upsertOfflineStubSnapshots(responseData.data);
  }

  const syncEntries = await getVisibleSyncQueueEntries();
  responseData.data = applyLocalStubClaimSyncStates(responseData.data, syncEntries);

  return responseData;
};

export const searchStubs = async ({ query, disasterEventId, barangayId }) => {
  const response = await fetch(
    buildSearchUrl({ query, disasterEventId, barangayId }),
  );

  const responseData = await handleJsonResponse(response, "Failed to search stubs");
  if (Array.isArray(responseData?.data)) {
    const syncEntries = await getVisibleSyncQueueEntriesForBarangay(barangayId);
    responseData.data = applyLocalStubClaimSyncStates(responseData.data, syncEntries);
  }
  return responseData;
};

export const verifyStub = async ({ stubNo, serialNo, qrCodeValue, currentBarangayId = "" }) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/stubs/verify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        stub_no: stubNo || null,
        serial_no: serialNo || null,
        qr_code_value: qrCodeValue || null,
      }),
    });
    const responseData = await handleJsonResponse(response, "Failed to verify stub");
    const stub = responseData?.data?.stub;
    const stubId = stub?.id || stub?.stub_id;
    if (stubId) {
      const syncEntries = await getVisibleStubClaimSyncEntriesForStub(stubId);
      const syncEntry = getClaimSyncEntryForStub(syncEntries, stubId, {
        disasterEventId: stub?.disaster_event?.id || stub?.disaster_event_id || "",
        barangayId: stub?.barangay?.id || stub?.barangay_id || currentBarangayId,
      });
      const locallyDecoratedStub = applyLocalStubClaimSyncState(stub, syncEntry);
      responseData.data.stub = locallyDecoratedStub;
      if (isLocalStubClaimBlocked(locallyDecoratedStub)) {
        const pendingFailure = getOfflineVerificationFailure(locallyDecoratedStub);
        responseData.data.is_claimable = false;
        responseData.data.code = pendingFailure?.code || "STUB_CLAIM_PENDING";
        responseData.data.reason = pendingFailure?.reason || "This relief stub has a local claim awaiting synchronization.";
        responseData.message = responseData.data.reason;
      }
    }
    return responseData;
  } catch (error) {
    if (!canUseOfflineStubCacheFallback(error)) throw error;
    const details = await getCachedStubDetailsByQrValue(qrCodeValue, { currentBarangayId });
    if (!details) throw error;
    const verificationFailure = getOfflineVerificationFailure(details);
    const claimable = !verificationFailure;
    return {
      message: claimable
        ? "Offline QR stub verified."
        : verificationFailure.reason,
      data: {
        stub: details,
        details: { stubNumber: details.display_stub_no || details.stub_no || details.stub_number },
        is_claimable: claimable,
        code: verificationFailure?.code || null,
        reason: verificationFailure?.reason || null,
        offline: true,
      },
    };
  }
};

export const fetchStubDetails = async (stubId, { currentBarangayId = "" } = {}) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/stubs/${stubId}`);
    const responseData = await handleJsonResponse(response, "Failed to fetch stub details");

    await upsertOfflineStubSnapshots(responseData ? [responseData] : []);
    const syncEntries = await getVisibleStubClaimSyncEntriesForStub(stubId);
    const syncEntry = getClaimSyncEntryForStub(syncEntries, stubId, {
      disasterEventId:
        responseData?.disaster_event?.id || responseData?.disaster_event_id || "",
      barangayId:
        responseData?.barangay?.id || responseData?.barangay_id || currentBarangayId,
    });
    return applyLocalStubClaimSyncState(responseData, syncEntry);
  } catch (error) {
    if (!canUseOfflineStubCacheFallback(error)) {
      throw error;
    }

    const cachedDetails = await getCachedStubDetailsById(stubId, {
      currentBarangayId,
    });

    if (!cachedDetails) {
      throw error;
    }

    return cachedDetails;
  }
};

export const fetchStubFamilyHeadPhoto = async (stubId) => {
  if (!stubId) {
    return null;
  }
  const response = await fetch(
    `${API_BASE_URL}/api/v1/stubs/${stubId}/family-head-photo`,
    { cache: "no-store" },
  );
  const responseData = await handleJsonResponse(
    response,
    "Failed to fetch family-head photo",
  );
  return responseData?.data || null;
};

export const claimStub = async ({
  stubId,
  userId,
  barangayId,
  overrideBarangayId,
  disasterEventId,
  disasterEventTitle,
  householdId,
  reliefPackContext = [],
  proofType,
  qrReferenceValue,
  proofPhotoDataUrl,
  proofPhotoCapturedAt,
}) => {
  const normalizedProofType = String(proofType || "").trim().toUpperCase();
  if (
    normalizedProofType === "QR" &&
    !String(qrReferenceValue || "").trim()
  ) {
    const error = new Error("Scan and verify the stub QR before confirming.");
    error.code = "DISTRIBUTION_QR_PROOF_REQUIRED";
    throw error;
  }
  if (
    normalizedProofType === "PHOTO" &&
    !String(proofPhotoDataUrl || "").trim()
  ) {
    const error = new Error("Capture a claim-time photo before confirming.");
    error.code = "DISTRIBUTION_PHOTO_PROOF_REQUIRED";
    throw error;
  }

  const payload = {
    user_id: userId || null,
    barangay_id: barangayId || null,
    override_barangay_id: overrideBarangayId || null,
    ...(disasterEventId ? { disaster_event_id: disasterEventId } : {}),
    ...(householdId ? { household_id: householdId } : {}),
    relief_pack_context: (Array.isArray(reliefPackContext) ? reliefPackContext : [])
      .filter((pack) => pack?.id)
      .map((pack) => ({
        id: pack.id,
        name: String(pack.name || "").slice(0, 160),
        is_additional_pack: Boolean(pack.is_additional_pack),
      })),
    proof_type: normalizedProofType,
    qr_reference_value: qrReferenceValue || null,
    proof_photo_data_url: proofPhotoDataUrl || null,
    proof_photo_captured_at: proofPhotoCapturedAt || null,
  };

  await assertNoBlockingLocalStubClaim(stubId, {
    disasterEventId,
    barangayId: barangayId || overrideBarangayId,
  });

  return performSyncableMutation({
    moduleName: "stubs",
    actionKey: "STUB_CLAIM",
    entityType: "STUB",
    entityServerId: stubId,
    payload,
    requiredFields: ["proof_type"],
    persistBeforeRequest: true,
    canQueueOffline: () =>
      isOfflineClaimLocallyReady({
        stubId,
        currentBarangayId: barangayId || overrideBarangayId,
        disasterEventId,
        householdId,
        proofType: normalizedProofType,
        qrReferenceValue,
      }),
    queueDisplayContext: disasterEventTitle
      ? { disaster_event_title: disasterEventTitle }
      : null,
    reconcileBeforeQueueCleanup: async (responseData) => {
      if (responseData?.sync_status === "SYNCED" || responseData?.sync_status === "CONFLICT") {
        await markCachedStubClaimTerminal(stubId, responseData.sync_status);
      }
    },
    request: async ({ clientSyncId, clientTimestamp }) => {
      const response = await fetch(`${API_BASE_URL}/api/v1/sync/process`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          entries: [
            {
              client_sync_id: clientSyncId,
              action_key: "STUB_CLAIM",
              entity_type: "STUB",
              entity_local_id: stubId,
              entity_server_id: stubId,
              device_id: getOfflineDeviceId(),
              client_timestamp: clientTimestamp,
              client_updated_at: clientTimestamp,
              payload,
            },
          ],
        }),
      });

      const responseData = await handleJsonResponse(
        response,
        "Failed to mark the stub as claimed",
      );

      const syncResult = Array.isArray(responseData?.data)
        ? responseData.data.find(
            (entry) => entry?.client_sync_id === clientSyncId,
          )
        : null;

      if (!syncResult || syncResult.sync_status !== "SYNCED") {
        const error = new Error(
          syncResult?.message || "The relief distribution could not be confirmed.",
        );
        error.code = syncResult?.error_code || syncResult?.conflict?.conflict_type || "STUB_CLAIM_SYNC_FAILED";
        error.statusCode = syncResult?.status_code || 409;
        error.syncResult = syncResult || null;
        throw error;
      }

      return {
        ...responseData,
        ...syncResult,
        data: syncResult.data,
      };
    },
    buildQueuedResponse: ({ clientSyncId, clientTimestamp }) =>
      buildOfflineQueuedResponse({
        message:
          "Stub claim saved offline. Pending sync once connection is restored.",
        data: {
          id: stubId,
          status: "PENDING_SYNC",
          claimed_at: clientTimestamp,
        },
        clientSyncId,
        entityLocalId: stubId,
        clientTimestamp,
      }),
  });
};
