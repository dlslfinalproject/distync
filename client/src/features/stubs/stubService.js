import {
  buildOfflineQueuedResponse,
  performSyncableMutation,
} from "../../offline/syncService";

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
    error.code = responseData?.error || "";
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

  return handleJsonResponse(response, "Failed to fetch stub dashboard");
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

export const fetchStubDetails = async (stubId) => {
  const response = await fetch(`${API_BASE_URL}/api/v1/stubs/${stubId}`);

  return handleJsonResponse(response, "Failed to fetch stub details");
};

export const fetchStubClaimHistory = async (filters = {}) => {
  const searchParams = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") {
      return;
    }

    searchParams.set(key, value);
  });

  const response = await fetch(
    `${API_BASE_URL}/api/v1/stubs/history${
      searchParams.toString() ? `?${searchParams.toString()}` : ""
    }`,
  );

  return handleJsonResponse(response, "Failed to fetch stub claim history");
};

export const exportStubClaimHistory = async (filters = {}) => {
  const searchParams = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") {
      return;
    }

    searchParams.set(key, value);
  });

  const response = await fetch(
    `${API_BASE_URL}/api/v1/stubs/history/export?${searchParams.toString()}`,
  );

  if (!response.ok) {
    let message = "Failed to export stub claim history";

    try {
      const payload = await response.json();
      message = payload.message || message;
    } catch (_error) {
      message = "Failed to export stub claim history";
    }

    throw new Error(message);
  }

  const blob = await response.blob();
  const contentDisposition = response.headers.get("Content-Disposition") || "";
  const fileNameMatch = contentDisposition.match(/filename="([^"]+)"/i);

  return {
    blob,
    filename: fileNameMatch?.[1] || "mswdo-stub-claim-history.csv",
  };
};

export const claimStub = async ({ stubId, userId, overrideBarangayId }) => {
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

      return handleJsonResponse(response, "Failed to mark the stub as claimed");
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

export const claimStubFromQrVerification = async ({
  disasterEventId,
  householdId,
  stubId,
  claimedByName,
  qrCodeValue,
  remarks,
}) => {
  const payload = {
    disaster_event_id: disasterEventId,
    household_id: householdId,
    stub_id: stubId,
    claimed_by_name: claimedByName,
    qr_reference_value: qrCodeValue || null,
    remarks: remarks || null,
  };

  return performSyncableMutation({
    moduleName: "stubs",
    actionKey: "DISTRIBUTION_QR_CLAIM",
    entityType: "DISTRIBUTION_TRANSACTION",
    entityLocalId: stubId,
    payload,
    requiredFields: [
      "disaster_event_id",
      "household_id",
      "stub_id",
      "claimed_by_name",
    ],
    request: async () => {
      const response = await fetch(
        `${API_BASE_URL}/api/v1/distribution-transactions/claim-from-qr`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
      );

      return handleJsonResponse(
        response,
        "Failed to mark the stub as claimed from QR verification",
      );
    },
    buildQueuedResponse: ({ clientSyncId, entityLocalId, clientTimestamp }) =>
      buildOfflineQueuedResponse({
        message:
          "QR claim saved offline. Pending sync once connection is restored.",
        data: {
          distribution_transaction_id: entityLocalId,
          distribution_date: clientTimestamp,
        },
        clientSyncId,
        entityLocalId,
        clientTimestamp,
      }),
  });
};
