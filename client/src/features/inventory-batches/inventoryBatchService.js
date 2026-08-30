import {
  buildOfflineQueuedResponse,
  performSyncableMutation,
} from "../../offline/syncService";
import { getMayorInventoryCacheSnapshot } from "../../offline/mayorInventoryCache.js";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

const handleJsonResponse = async (response, fallbackMessage) => {
  const responseData = await response.json().catch(() => null);

  if (!response.ok) {
    const error = new Error(responseData?.message || fallbackMessage);
    error.statusCode = response.status;
    throw error;
  }

  return responseData;
};

const downloadResponseAsFile = async (response, fallbackMessage) => {
  if (!response.ok) {
    return handleJsonResponse(response, fallbackMessage);
  }

  const blob = await response.blob();
  const contentDisposition = response.headers.get("Content-Disposition") || "";
  const fileNameMatch = contentDisposition.match(/filename="([^"]+)"/i);

  return {
    blob,
    filename: fileNameMatch?.[1] || "inventory-batches.csv",
  };
};

export const fetchInventoryBatches = async (filters = {}) => {
  const searchParams = new URLSearchParams();

  if (filters.search) {
    searchParams.set("search", filters.search.trim());
  }

  if (filters.inventory_item_id) {
    searchParams.set("inventory_item_id", filters.inventory_item_id);
  }

  if (filters.supplier_id) {
    searchParams.set("supplier_id", filters.supplier_id);
  }

  if (filters.source_type) {
    searchParams.set("source_type", filters.source_type);
  }

  if (filters.status) {
    searchParams.set("status", filters.status);
  }

  const queryString = searchParams.toString();
  const url = `${API_BASE_URL}/api/v1/inventory-batches${
    queryString ? `?${queryString}` : ""
  }`;

  const response = await fetch(url);
  return handleJsonResponse(response, "Failed to fetch inventory batches");
};

export const fetchInventoryBatchById = async (inventoryBatchId) => {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/inventory-batches/${inventoryBatchId}`,
  );

  return handleJsonResponse(response, "Failed to fetch inventory batch");
};

export const fetchInventoryBatchDetail = async (inventoryBatchId) => {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/inventory-batches/${inventoryBatchId}/detail`,
  );

  return handleJsonResponse(response, "Failed to fetch inventory batch detail");
};

export const exportInventoryBatches = async (format = "csv", filters = {}) => {
  const searchParams = new URLSearchParams();
  searchParams.set("format", format);

  if (filters.search) {
    searchParams.set("search", filters.search.trim());
  }

  if (filters.inventory_item_id) {
    searchParams.set("inventory_item_id", filters.inventory_item_id);
  }

  if (filters.supplier_id) {
    searchParams.set("supplier_id", filters.supplier_id);
  }

  if (filters.source_type) {
    searchParams.set("source_type", filters.source_type);
  }

  if (filters.status) {
    searchParams.set("status", filters.status);
  }

  const response = await fetch(
    `${API_BASE_URL}/api/v1/inventory-batches/export${
      searchParams.toString() ? `?${searchParams.toString()}` : ""
    }`,
  );

  return downloadResponseAsFile(response, "Failed to export inventory batches");
};

export const createInventoryBatch = async (payload) => {
  return performSyncableMutation({
    moduleName: "mayor-inventory",
    actionKey: "INVENTORY_BATCH_CREATE",
    entityType: "INVENTORY_BATCH",
    entityLocalId: payload?.batch_no || null,
    payload,
    requiredFields: ["inventory_item_id", "batch_no", "quantity_received"],
    canQueueOffline: async () => Boolean(await getMayorInventoryCacheSnapshot()),
    request: async () => {
      const response = await fetch(`${API_BASE_URL}/api/v1/inventory-batches`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      return handleJsonResponse(response, "Failed to create inventory batch");
    },
    buildQueuedResponse: ({ clientSyncId, entityLocalId, clientTimestamp }) =>
      buildOfflineQueuedResponse({
        message:
          "Inventory batch saved offline. Pending sync once connection is restored.",
        data: {
          id: entityLocalId,
          batch_no: payload?.batch_no || entityLocalId,
          updated_at: clientTimestamp,
        },
        clientSyncId,
        entityLocalId,
        clientTimestamp,
      }),
  });
};

export const updateInventoryBatchExpiry = async (
  inventoryBatchId,
  payload,
) => {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/inventory-batches/${inventoryBatchId}/expiry`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );

  return handleJsonResponse(
    response,
    "Failed to update inventory batch expiry",
  );
};

export const fetchInventoryItems = async () => {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/inventory-items?is_active=true`,
  );

  return handleJsonResponse(response, "Failed to fetch inventory items");
};

export const fetchSuppliers = async () => {
  const response = await fetch(`${API_BASE_URL}/api/v1/suppliers`);

  return handleJsonResponse(response, "Failed to fetch suppliers");
};
