const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

const handleJsonResponse = async (response, fallbackMessage) => {
  const payload = await response.json();

  if (!response.ok) {
    const error = new Error(payload.message || fallbackMessage);
    error.code = payload.error || null;
    error.statusCode = response.status;
    throw error;
  }

  return payload;
};

export const fetchBarangayDashboard = async ({
  userId,
  disasterEventId,
  eventScope,
  overrideBarangayId,
}) => {
  const searchParams = new URLSearchParams({
    event_scope: eventScope,
  });

  if (userId) {
    searchParams.set("user_id", userId);
  }

  if (disasterEventId) {
    searchParams.set("disaster_event_id", disasterEventId);
  }

  if (overrideBarangayId) {
    searchParams.set("override_barangay_id", overrideBarangayId);
  }

  const response = await fetch(
    `${API_BASE_URL}/api/v1/masterlist/barangay-dashboard?${searchParams.toString()}`,
  );

  return handleJsonResponse(response, "Failed to fetch barangay dashboard");
};
