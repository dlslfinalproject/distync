import {
  buildOfflineQueuedResponse,
  performSyncableMutation,
} from "../../offline/syncService";
import {
  canUseOfflineStubCacheFallback,
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

export const fetchBarangayStubDashboard = async ({
  userId,
  disasterEventId,
  overrideBarangayId,
}) => {
  const searchParams = new URLSearchParams({
    disaster_event_id: disasterEventId,
  });

  if (userId) {
    searchParams.set("user_id", userId);
  }

  if (overrideBarangayId) {
    searchParams.set("override_barangay_id", overrideBarangayId);
  }

  const response = await fetch(
    `${API_BASE_URL}/api/v1/stubs/barangay-dashboard?${searchParams.toString()}`,
  );

  const responseData = await handleJsonResponse(
    response,
    "Failed to fetch stub dashboard",
  );

  await upsertOfflineStubSnapshots(responseData?.data || []);

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
  overrideBarangayId,
}) => {
  const payload = {
    user_id: userId || null,
    override_barangay_id: overrideBarangayId || null,
  };

  return performSyncableMutation({
    moduleName: "stubs",
    actionKey: "STUB_CLAIM",
    entityType: "STUB",
    entityServerId: stubId,
    payload,
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
