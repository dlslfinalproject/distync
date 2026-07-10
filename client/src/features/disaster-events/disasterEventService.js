import {
  buildOfflineQueuedResponse,
  performSyncableMutation,
} from "../../offline/syncService";

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
  return performSyncableMutation({
    moduleName: "mswdo-disaster-events",
    actionKey: "DISASTER_EVENT_CREATE",
    entityType: "DISASTER_EVENT",
    entityLocalId: payload?.event_code || payload?.title || null,
    payload,
    requiredFields: ["title", "disaster_type", "start_date"],
    request: async () => {
      const response = await fetch(`${API_BASE_URL}/api/v1/disaster-events`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      return handleJsonResponse(response, "Failed to create disaster event");
    },
    buildQueuedResponse: ({ clientSyncId, entityLocalId, clientTimestamp }) =>
      buildOfflineQueuedResponse({
        message:
          "Disaster event saved offline. Pending sync once connection is restored.",
        data: {
          id: entityLocalId,
          updated_at: clientTimestamp,
        },
        clientSyncId,
        entityLocalId,
        clientTimestamp,
      }),
  });
};

export const updateDisasterEvent = async (eventId, payload) => {
  return performSyncableMutation({
    moduleName: "mswdo-disaster-events",
    actionKey: "DISASTER_EVENT_UPDATE",
    entityType: "DISASTER_EVENT",
    entityServerId: eventId,
    payload,
    requiredFields: ["title", "disaster_type", "start_date", "end_date"],
    request: async () => {
      const response = await fetch(
        `${API_BASE_URL}/api/v1/disaster-events/${eventId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
      );

      return handleJsonResponse(response, "Failed to update disaster event");
    },
    buildQueuedResponse: ({ clientSyncId, clientTimestamp }) =>
      buildOfflineQueuedResponse({
        message:
          "Disaster event update saved offline. Pending sync once connection is restored.",
        data: {
          id: eventId,
          updated_at: clientTimestamp,
        },
        clientSyncId,
        entityLocalId: eventId,
        clientTimestamp,
      }),
  });
};

export const fetchBarangays = async () => {
  const response = await fetch(`${API_BASE_URL}/api/v1/barangays`);
  return handleJsonResponse(response, "Failed to fetch barangays");
};

export const exportDisasterEvents = async ({
  selectedFilter,
  search,
  disasterTypes = [],
  affectedBarangayIds = [],
  sortOrder = "newest",
  format,
}) => {
  const searchParams = new URLSearchParams({
    scope: selectedFilter,
    sort_order: sortOrder,
    format,
  });

  if (search && search.trim()) {
    searchParams.set("search", search.trim());
  }

  if (Array.isArray(disasterTypes) && disasterTypes.length > 0) {
    searchParams.set("disaster_types", disasterTypes.join(","));
  }

  if (Array.isArray(affectedBarangayIds) && affectedBarangayIds.length > 0) {
    searchParams.set("affected_barangay_ids", affectedBarangayIds.join(","));
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

export const fetchDisasterEventReportSummary = async (filters = {}) => {
  const searchParams = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") {
      return;
    }

    searchParams.set(key, value);
  });

  const response = await fetch(
    `${API_BASE_URL}/api/v1/disaster-events/reports/summary${
      searchParams.toString() ? `?${searchParams.toString()}` : ""
    }`,
  );

  return handleJsonResponse(
    response,
    "Failed to fetch disaster event report summary",
  );
};

export const exportDisasterEventReportSummary = async (filters = {}) => {
  const searchParams = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") {
      return;
    }

    searchParams.set(key, value);
  });

  const response = await fetch(
    `${API_BASE_URL}/api/v1/disaster-events/reports/export?${searchParams.toString()}`,
  );

  if (!response.ok) {
    let message = "Failed to export disaster event summary";

    try {
      const payload = await response.json();
      message = payload.message || message;
    } catch (_error) {
      message = "Failed to export disaster event summary";
    }

    throw new Error(message);
  }

  const blob = await response.blob();
  const contentDisposition = response.headers.get("Content-Disposition") || "";
  const fileNameMatch = contentDisposition.match(/filename="([^"]+)"/i);

  return {
    blob,
    filename: fileNameMatch?.[1] || "mswdo-disaster-event-summary.csv",
  };
};
