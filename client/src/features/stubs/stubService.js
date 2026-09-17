import {
  buildOfflineQueuedResponse,
  performSyncableMutation,
} from "../../offline/syncService";
import {
  canUseOfflineStubCacheFallback,
  getCachedStubClaimSyncEntry,
  getCachedStubDetailsById,
  getCachedStubDetailsByQrValue,
  markCachedStubClaimTerminal,
  upsertOfflineStubSnapshots,
} from "./stubCache.js";
import { resolveStubSectorIdsForApi } from "./stubSectorFilters.js";
import { QR_SCAN_ERROR_CODES } from "./stubQrScanErrors.js";

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

const assertNoBlockingLocalStubClaim = async (stubId) => {
  let syncEntry;

  try {
    syncEntry = await getCachedStubClaimSyncEntry(stubId);
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
  const error = new Error(
    isConflict
      ? "This relief stub has a synchronization conflict and cannot be claimed again until it is reviewed."
      : "This relief stub already has a pending offline claim on this device. Wait for synchronization before trying again.",
  );
  error.code = isConflict ? "STUB_CLAIM_CONFLICT" : "STUB_CLAIM_PENDING";
  error.statusCode = 409;
  throw error;
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

  return responseData;
};

export const searchStubs = async ({ query, disasterEventId, barangayId }) => {
  const response = await fetch(
    buildSearchUrl({ query, disasterEventId, barangayId }),
  );

  return handleJsonResponse(response, "Failed to search stubs");
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
    return handleJsonResponse(response, "Failed to verify stub");
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

    return responseData;
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

export const claimStub = async ({
  stubId,
  userId,
  barangayId,
  overrideBarangayId,
  disasterEventId,
  disasterEventTitle,
}) => {
  const payload = {
    user_id: userId || null,
    barangay_id: barangayId || null,
    override_barangay_id: overrideBarangayId || null,
    ...(disasterEventId ? { disaster_event_id: disasterEventId } : {}),
  };

  await assertNoBlockingLocalStubClaim(stubId);

  return performSyncableMutation({
    moduleName: "stubs",
    actionKey: "STUB_CLAIM",
    entityType: "STUB",
    entityServerId: stubId,
    payload,
    queueDisplayContext: disasterEventTitle
      ? { disaster_event_title: disasterEventTitle }
      : null,
    request: async () => {
      const response = await fetch(`${API_BASE_URL}/api/v1/stubs/${stubId}/claim`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const responseData = await handleJsonResponse(
        response,
        "Failed to mark the stub as claimed",
      );

      await markCachedStubClaimTerminal(stubId);

      return responseData;
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
