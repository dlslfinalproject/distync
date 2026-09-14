import {
  buildOfflineQueuedResponse,
  performSyncableMutation,
} from "../../offline/syncService";
import { getMayorInventoryCacheSnapshot } from "../../offline/mayorInventoryCache.js";
import { coalesceInventoryRead } from "../inventory/shared/inventoryReadCoordinator.js";
import { normalizeInventoryBarcode } from "../inventory-items/inventoryBarcode.js";

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

export const fetchInventoryBatches = (filters = {}) => {
  const hasPage = filters.page !== undefined;
  const hasPageSize = filters.pageSize !== undefined;
  const searchParams = new URLSearchParams();

  if (filters.search) {
    searchParams.set("search", filters.search.trim());
  }

  if (filters.inventory_item_id) {
    searchParams.set("inventory_item_id", filters.inventory_item_id);
  }

  if (filters.source_type) {
    searchParams.set("source_type", filters.source_type);
  }

  if (filters.status) {
    searchParams.set("status", filters.status);
  }

  if (
    filters.is_expiring === true ||
    filters.is_expiring === false ||
    filters.is_expiring === "true" ||
    filters.is_expiring === "false"
  ) {
    searchParams.set("is_expiring", String(filters.is_expiring));
  }

  if (
    filters.is_expired === true ||
    filters.is_expired === false ||
    filters.is_expired === "true" ||
    filters.is_expired === "false"
  ) {
    searchParams.set("is_expired", String(filters.is_expired));
  }

  if (hasPage) {
    searchParams.set("page", String(filters.page));
  }

  if (hasPageSize) {
    searchParams.set("pageSize", String(filters.pageSize));
  }

  const queryString = searchParams.toString();
  const url = `${API_BASE_URL}/api/v1/inventory-batches${
    queryString ? `?${queryString}` : ""
  }`;

  return coalesceInventoryRead("inventory-batches", url, async () => {
    const response = await fetch(url);
    const payload = await handleJsonResponse(
      response,
      "Failed to fetch inventory batches",
    );

    if (!hasPage && !hasPageSize) {
      if (!Array.isArray(payload)) {
        throw new Error(
          "DISTYNC returned an invalid inventory batch list response.",
        );
      }

      return payload;
    }

    if (
      !payload ||
      Array.isArray(payload) ||
      !Array.isArray(payload.data) ||
      !payload.pagination ||
      typeof payload.pagination !== "object"
    ) {
      throw new Error(
        "DISTYNC returned an incomplete paginated inventory batch response.",
      );
    }

    return {
      data: payload.data,
      pagination: payload.pagination,
    };
  });
};

export const fetchInventoryBatchesPage = (filters = {}) => {
  if (filters.page === undefined || filters.pageSize === undefined) {
    throw new TypeError(
      "fetchInventoryBatchesPage requires both page and pageSize",
    );
  }

  return fetchInventoryBatches(filters);
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
  if (
    payload &&
    Object.prototype.hasOwnProperty.call(payload, "stock_form_barcode")
  ) {
    payload = {
      ...payload,
      stock_form_barcode:
        normalizeInventoryBarcode(payload.stock_form_barcode) || null,
    };
  }

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

export { fetchInventoryItems } from "../inventory-items/inventoryItemService.js";
