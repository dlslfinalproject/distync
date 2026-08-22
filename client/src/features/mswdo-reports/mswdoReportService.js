const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

const handleJsonResponse = async (response, fallbackMessage) => {
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const error = new Error(payload?.message || fallbackMessage);
    error.statusCode = response.status;
    error.code = payload?.code || null;
    error.payload = payload;
    throw error;
  }

  return payload;
};

export const fetchMswdoAnomalies = async (filters = {}) => {
  const searchParams = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") {
      return;
    }

    searchParams.set(key, value);
  });

  const response = await fetch(
    `${API_BASE_URL}/api/v1/mswdo-reports/anomalies${
      searchParams.toString() ? `?${searchParams.toString()}` : ""
    }`,
  );

  return handleJsonResponse(response, "Failed to fetch MSWDO anomalies");
};

export const saveBarangayAnomalyReview = async (payload) => {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/mswdo-reports/anomalies/reviews`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );

  return handleJsonResponse(response, "Failed to save Barangay anomaly review");
};
