import {
  buildOfflineQueuedResponse,
  performSyncableMutation,
} from "../../offline/syncService";
import {
  canUseOfflineStubCacheFallback,
  getCachedStubClaimSyncEntry,
  getCachedStubDetailsById,
  markCachedStubClaimTerminal,
  upsertOfflineStubSnapshots,
} from "./stubCache.js";

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

  if (Array.isArray(sectorIds) && sectorIds.length > 0) {
    searchParams.set("sector_ids", sectorIds.join(","));
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

export const verifyStub = async ({ stubNo, serialNo, qrCodeValue }) => {
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
