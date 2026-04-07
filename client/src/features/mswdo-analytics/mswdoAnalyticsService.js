const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

const handleJsonResponse = async (response, fallbackMessage) => {
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.message || fallbackMessage);
  }

  return payload;
};

export const fetchDisasterEvents = async () => {
  const response = await fetch(`${API_BASE_URL}/api/v1/disaster-events`);
  return handleJsonResponse(response, "Failed to fetch disaster events");
};

export const fetchActiveDisasterEvents = async () => {
  const response = await fetch(`${API_BASE_URL}/api/v1/disaster-events/active`);
  return handleJsonResponse(response, "Failed to fetch active disaster events");
};

export const fetchBarangays = async () => {
  const response = await fetch(`${API_BASE_URL}/api/v1/barangays`);
  return handleJsonResponse(response, "Failed to fetch barangays");
};

export const fetchMasterlistAnalyticsSource = async ({
  disasterEventId,
  barangayId,
}) => {
  if (!disasterEventId) {
    return {
      disaster_event: null,
      filters: {
        disaster_event_id: null,
        barangay_id: null,
      },
      count: 0,
      data: [],
    };
  }

  const searchParams = new URLSearchParams({
    disaster_event_id: disasterEventId,
  });

  if (barangayId) {
    searchParams.set("barangay_id", barangayId);
  }

  const response = await fetch(
    `${API_BASE_URL}/api/v1/masterlist?${searchParams.toString()}`,
  );

  return handleJsonResponse(response, "Failed to fetch masterlist analytics data");
};
