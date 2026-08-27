const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

const handleJsonResponse = async (response, fallbackMessage) => {
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.message || fallbackMessage);
  }

  return payload;
};

export const fetchSyncHistory = async (filters = {}) => {
  const searchParams = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") {
      return;
    }

    searchParams.set(key, value);
  });

  const response = await fetch(
    `${API_BASE_URL}/api/v1/sync/history${
      searchParams.toString() ? `?${searchParams.toString()}` : ""
    }`,
  );

  return handleJsonResponse(response, "Failed to load sync history");
};

export const fetchSyncBarangays = async () => {
  const response = await fetch(`${API_BASE_URL}/api/v1/barangays`);
  const payload = await handleJsonResponse(response, "Failed to load Barangay options");

  return Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.data)
      ? payload.data
      : [];
};

export const fetchSyncConflictDetail = async (conflictId) => {
  const response = await fetch(`${API_BASE_URL}/api/v1/sync/conflicts/${conflictId}`);
  return handleJsonResponse(response, "Failed to load sync conflict detail");
};

export const resolveSyncConflict = async (conflictId, { action, reason }) => {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/sync/conflicts/${conflictId}/resolve`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action, reason }),
    },
  );

  return handleJsonResponse(response, "Failed to resolve sync conflict");
};

export const fetchSyncStatusSummary = async () => {
  const response = await fetch(`${API_BASE_URL}/api/v1/sync/status-summary`);
  const payload = await handleJsonResponse(
    response,
    "Failed to load sync status summary",
  );

  return payload?.data || {};
};

export const auditSyncRetryRequest = async (entries = []) => {
  const response = await fetch(`${API_BASE_URL}/api/v1/sync/retry-audit`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ entries }),
  });

  return handleJsonResponse(response, "Failed to log sync retry request");
};
