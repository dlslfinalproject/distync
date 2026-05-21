const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

const handleJsonResponse = async (response, fallbackMessage) => {
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.message || fallbackMessage);
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
