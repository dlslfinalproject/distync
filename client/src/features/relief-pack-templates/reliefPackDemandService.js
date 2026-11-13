const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

const handleJsonResponse = async (response, fallbackMessage) => {
  const responseData = await response.json().catch(() => null);

  if (!response.ok) {
    const error = new Error(responseData?.message || fallbackMessage);
    error.statusCode = response.status;
    error.code = responseData?.code || null;
    error.payload = responseData;
    throw error;
  }

  return responseData;
};

export const fetchReliefPackDemand = async ({ disasterEventIds = [] } = {}) => {
  const normalizedDisasterEventIds = Array.from(
    new Set(
      (Array.isArray(disasterEventIds) ? disasterEventIds : [])
        .map((disasterEventId) => String(disasterEventId || "").trim())
        .filter(Boolean),
    ),
  );

  if (normalizedDisasterEventIds.length === 0) {
    return {
      data: [],
    };
  }

  const searchParams = new URLSearchParams({
    disaster_event_ids: normalizedDisasterEventIds.join(","),
  });
  const response = await fetch(
    `${API_BASE_URL}/api/v1/relief-pack-templates/demand?${searchParams.toString()}`,
  );

  return handleJsonResponse(
    response,
    "Failed to fetch relief pack demand aggregates",
  );
};
