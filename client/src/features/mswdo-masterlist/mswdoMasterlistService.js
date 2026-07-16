const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

const handleJsonResponse = async (response, fallbackMessage) => {
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.message || fallbackMessage);
  }

  return payload;
};

const getFallbackExportFilename = (format) => {
  if (format === "excel") {
    return "mswdo-masterlist.xlsx";
  }

  if (format === "pdf") {
    return "mswdo-masterlist.pdf";
  }

  return "mswdo-masterlist.csv";
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

export const fetchMswdoSectors = async () => {
  const response = await fetch(`${API_BASE_URL}/api/v1/sectors/mswdo`);
  const payload = await handleJsonResponse(response, "Failed to fetch sectors");
  return Array.isArray(payload.data) ? payload.data : payload;
};

export const fetchConsolidatedMasterlist = async ({
  disasterEventId,
  barangayId,
  eventScope,
  recordStatus = "active",
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

  if (eventScope) {
    searchParams.set("event_scope", eventScope);
  }

  const requestedRecordStatus =
    recordStatus === "archived" ? "all" : recordStatus;

  if (requestedRecordStatus) {
    searchParams.set("record_status", requestedRecordStatus);
  }

  const response = await fetch(
    `${API_BASE_URL}/api/v1/masterlist?${searchParams.toString()}`,
  );

  return handleJsonResponse(response, "Failed to fetch consolidated masterlist");
};

export const fetchConsolidatedMasterlistDashboard = async ({
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
      summary_metrics: {
        total_number_of_evacuees_individuals: 0,
        total_number_of_families: 0,
        average_household_size: 0,
        currently_admitted_evacuees: 0,
        total_departed_evacuees: 0,
        total_barangays_covered: 0,
      },
      charts: {
        per_barangay: [],
      },
      has_data: false,
    };
  }

  const searchParams = new URLSearchParams({
    disaster_event_id: disasterEventId,
  });

  if (barangayId) {
    searchParams.set("barangay_id", barangayId);
  }

  const response = await fetch(
    `${API_BASE_URL}/api/v1/masterlist/mswdo-dashboard?${searchParams.toString()}`,
  );

  return handleJsonResponse(
    response,
    "Failed to fetch consolidated masterlist analytics",
  );
};

export const exportConsolidatedMasterlist = async ({
  disasterEventId,
  barangayIds,
  search,
  recordStatus,
  sortOrder,
  sectorIds,
  format,
}) => {
  const searchParams = new URLSearchParams({
    disaster_event_id: disasterEventId,
    format,
  });

  if (Array.isArray(barangayIds) && barangayIds.length > 0) {
    searchParams.set("barangay_ids", barangayIds.join(","));
  }

  if (search && search.trim()) {
    searchParams.set("search", search.trim());
  }

  if (recordStatus) {
    searchParams.set("record_status", recordStatus);
  }

  if (sortOrder) {
    searchParams.set("sort_order", sortOrder);
  }

  if (Array.isArray(sectorIds) && sectorIds.length > 0) {
    searchParams.set("sector_ids", sectorIds.join(","));
  }

  const response = await fetch(
    `${API_BASE_URL}/api/v1/masterlist/export?${searchParams.toString()}`,
  );

  if (!response.ok) {
    let message = "Failed to export masterlist";

    try {
      const payload = await response.json();
      message = payload.message || message;
    } catch (_error) {
      message = "Failed to export masterlist";
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
