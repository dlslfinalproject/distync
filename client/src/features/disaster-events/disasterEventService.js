const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

const handleJsonResponse = async (response, fallbackMessage) => {
  const responseData = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(responseData?.message || fallbackMessage);
  }

  return responseData;
};

const getFallbackExportFilename = (format) => {
  if (format === "excel") {
    return "mswdo-disaster-events.xlsx";
  }

  if (format === "pdf") {
    return "mswdo-disaster-events.pdf";
  }

  return "mswdo-disaster-events.csv";
};

export const fetchAllDisasterEvents = async () => {
  const response = await fetch(`${API_BASE_URL}/api/v1/disaster-events`);
  return handleJsonResponse(response, "Failed to fetch disaster events");
};

export const fetchActiveDisasterEvents = async () => {
  const response = await fetch(`${API_BASE_URL}/api/v1/disaster-events/active`);
  return handleJsonResponse(response, "Failed to fetch active disaster events");
};

export const fetchEndedDisasterEvents = async () => {
  const response = await fetch(`${API_BASE_URL}/api/v1/disaster-events/ended`);
  return handleJsonResponse(response, "Failed to fetch ended disaster events");
};

export const fetchDisasterEventById = async (eventId) => {
  const response = await fetch(`${API_BASE_URL}/api/v1/disaster-events/${eventId}`);
  return handleJsonResponse(response, "Failed to fetch disaster event details");
};

export const createDisasterEvent = async (payload) => {
  const response = await fetch(`${API_BASE_URL}/api/v1/disaster-events`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return handleJsonResponse(response, "Failed to create disaster event");
};

export const extendDisasterEvent = async (eventId, newEndDate) => {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/disaster-events/${eventId}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        end_date: newEndDate,
      }),
    }
  );

  return handleJsonResponse(response, "Failed to extend disaster event");
};

export const endDisasterEvent = async (eventId) => {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/disaster-events/${eventId}/end`,
    {
      method: "PATCH",
    }
  );

  return handleJsonResponse(response, "Failed to end disaster event");
};

export const fetchBarangays = async () => {
  const response = await fetch(`${API_BASE_URL}/api/v1/barangays`);
  return handleJsonResponse(response, "Failed to fetch barangays");
};

export const exportDisasterEvents = async ({
  selectedFilter,
  search,
  disasterType,
  affectedBarangayId,
  format,
}) => {
  const searchParams = new URLSearchParams({
    scope: selectedFilter,
    format,
  });

  if (search && search.trim()) {
    searchParams.set("search", search.trim());
  }

  if (disasterType && disasterType.trim()) {
    searchParams.set("disaster_type", disasterType.trim());
  }

  if (affectedBarangayId && affectedBarangayId.trim()) {
    searchParams.set("affected_barangay_id", affectedBarangayId.trim());
  }

  const response = await fetch(
    `${API_BASE_URL}/api/v1/disaster-events/export?${searchParams.toString()}`,
  );

  if (!response.ok) {
    let message = "Failed to export disaster events";

    try {
      const payload = await response.json();
      message = payload.message || message;
    } catch (_error) {
      message = "Failed to export disaster events";
    }

    throw new Error(message);
  }

  const blob = await response.blob();
  const contentDisposition = response.headers.get("Content-Disposition") || "";
  const fileNameMatch = contentDisposition.match(/filename="([^"]+)"/i);

  return {
    blob,
    filename: fileNameMatch?.[1] || getFallbackExportFilename(format),
  };
};
