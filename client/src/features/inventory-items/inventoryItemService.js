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
    return "inventory-items.xlsx";
  }

  if (format === "pdf") {
    return "inventory-items.pdf";
  }

  return "inventory-items.csv";
};

const appendInventoryItemFilters = (searchParams, filters = {}) => {
  if (filters.search) {
    searchParams.set("search", filters.search.trim());
  }

  if (filters.category && filters.category !== "All") {
    searchParams.set("category", filters.category.trim());
  }

  if (
    filters.is_active === true ||
    filters.is_active === false ||
    filters.is_active === "true" ||
    filters.is_active === "false"
  ) {
    searchParams.set("is_active", filters.is_active);
  }

  if (
    filters.is_perishable === true ||
    filters.is_perishable === false ||
    filters.is_perishable === "true" ||
    filters.is_perishable === "false"
  ) {
    searchParams.set("is_perishable", filters.is_perishable);
  }

  if (filters.status && filters.status !== "All") {
    searchParams.set("status", filters.status);
  }
};

export const fetchInventoryItems = async (filters = {}) => {
  const searchParams = new URLSearchParams();
  appendInventoryItemFilters(searchParams, filters);

  const queryString = searchParams.toString();
  const url = `${API_BASE_URL}/api/v1/inventory-items${
    queryString ? `?${queryString}` : ""
  }`;

  const response = await fetch(url);
  return handleJsonResponse(response, "Failed to fetch inventory items");
};

export const exportInventoryItems = async ({ format, filters = {} }) => {
  const searchParams = new URLSearchParams({ format });
  appendInventoryItemFilters(searchParams, filters);

  if (filters.report_type) {
    searchParams.set("report_type", filters.report_type);
  }

  if (filters.near_expiry_days) {
    searchParams.set("near_expiry_days", filters.near_expiry_days);
  }

  const response = await fetch(
    `${API_BASE_URL}/api/v1/inventory-items/export?${searchParams.toString()}`,
  );

  if (!response.ok) {
    let message = "Failed to export inventory items";

    try {
      const payload = await response.json();
      message = payload.message || message;
    } catch (_error) {
      message = "Failed to export inventory items";
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

export const fetchInventoryItemById = async (inventoryItemId) => {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/inventory-items/${inventoryItemId}`,
  );

  return handleJsonResponse(response, "Failed to fetch inventory item");
};

export const createInventoryItem = async (payload) => {
  return performSyncableMutation({
    moduleName: "mayor-inventory",
    actionKey: "INVENTORY_ITEM_CREATE",
    entityType: "INVENTORY_ITEM",
    entityLocalId: payload?.item_code || payload?.item_name || null,
    payload,
    requiredFields: ["item_name", "category", "unit_of_measure"],
    request: async () => {
      const response = await fetch(`${API_BASE_URL}/api/v1/inventory-items`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      return handleJsonResponse(response, "Failed to create inventory item");
    },
    buildQueuedResponse: ({ clientSyncId, entityLocalId, clientTimestamp }) =>
      buildOfflineQueuedResponse({
        message:
          "Inventory item saved offline. Pending sync once connection is restored.",
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

export const updateInventoryItem = async (inventoryItemId, payload) => {
  return performSyncableMutation({
    moduleName: "mayor-inventory",
    actionKey: "INVENTORY_ITEM_UPDATE",
    entityType: "INVENTORY_ITEM",
    entityServerId: inventoryItemId,
    payload,
    requiredFields: ["item_name", "category", "unit_of_measure"],
    request: async () => {
      const response = await fetch(
        `${API_BASE_URL}/api/v1/inventory-items/${inventoryItemId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
      );

      return handleJsonResponse(response, "Failed to update inventory item");
    },
    buildQueuedResponse: ({ clientSyncId, clientTimestamp }) =>
      buildOfflineQueuedResponse({
        message:
          "Inventory item update saved offline. Pending sync once connection is restored.",
        data: {
          id: inventoryItemId,
          updated_at: clientTimestamp,
        },
        clientSyncId,
        entityLocalId: inventoryItemId,
        clientTimestamp,
      }),
  });
};

export const runInventoryForecast = async (payload) => {
  const response = await fetch(`${API_BASE_URL}/api/v1/inventory-items/forecast/run`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return handleJsonResponse(response, "Failed to run inventory forecast");
};

export const fetchLatestInventoryForecast = async (disasterEventId) => {
  const searchParams = new URLSearchParams({
    disaster_event_id: disasterEventId,
  });
  const response = await fetch(
    `${API_BASE_URL}/api/v1/inventory-items/forecast/latest?${searchParams.toString()}`,
  );

  return handleJsonResponse(response, "Failed to fetch latest inventory forecast");
};

export const fetchForecastHealth = async () => {
  const response = await fetch(`${API_BASE_URL}/api/v1/inventory-items/forecast/health`);

  return handleJsonResponse(response, "Failed to fetch analytics health");
};

export const fetchForecastHistory = async ({
  disasterEventId = null,
  limit = 10,
} = {}) => {
  const searchParams = new URLSearchParams();

  if (disasterEventId) {
    searchParams.set("disaster_event_id", disasterEventId);
  }

  if (limit) {
    searchParams.set("limit", String(limit));
  }

  const response = await fetch(
    `${API_BASE_URL}/api/v1/inventory-items/forecast/history${
      searchParams.toString() ? `?${searchParams.toString()}` : ""
    }`,
  );

  return handleJsonResponse(response, "Failed to fetch forecast history");
};

export const fetchForecastRunDetails = async (runId) => {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/inventory-items/forecast/history/${runId}`,
  );

  return handleJsonResponse(response, "Failed to fetch forecast run details");
};
