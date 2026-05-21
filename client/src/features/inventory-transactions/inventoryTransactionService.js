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

const downloadResponseAsFile = async (response, fallbackMessage) => {
  if (!response.ok) {
    return handleJsonResponse(response, fallbackMessage);
  }

  const blob = await response.blob();
  const contentDisposition = response.headers.get("Content-Disposition") || "";
  const fileNameMatch = contentDisposition.match(/filename="([^"]+)"/i);

  return {
    blob,
    filename: fileNameMatch?.[1] || "inventory-transactions.csv",
  };
};

export const fetchInventoryTransactions = async (filters = {}) => {
  const searchParams = new URLSearchParams();

  if (filters.search) {
    searchParams.set("search", filters.search.trim());
  }

  if (filters.inventory_batch_id) {
    searchParams.set("inventory_batch_id", filters.inventory_batch_id);
  }

  if (filters.inventory_item_id) {
    searchParams.set("inventory_item_id", filters.inventory_item_id);
  }

  if (filters.transaction_type) {
    searchParams.set("transaction_type", filters.transaction_type);
  }

  if (filters.reference_type) {
    searchParams.set("reference_type", filters.reference_type);
  }

  const queryString = searchParams.toString();
  const url = `${API_BASE_URL}/api/v1/inventory-transactions${
    queryString ? `?${queryString}` : ""
  }`;

  const response = await fetch(url);
  return handleJsonResponse(response, "Failed to fetch inventory transactions");
};

export const fetchInventoryTransactionById = async (transactionId) => {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/inventory-transactions/${transactionId}`,
  );

  return handleJsonResponse(response, "Failed to fetch inventory transaction");
};

export const exportInventoryTransactions = async (format = "csv", filters = {}) => {
  const searchParams = new URLSearchParams();
  searchParams.set("format", format);

  if (filters.search) {
    searchParams.set("search", filters.search.trim());
  }

  if (filters.inventory_batch_id) {
    searchParams.set("inventory_batch_id", filters.inventory_batch_id);
  }

  if (filters.inventory_item_id) {
    searchParams.set("inventory_item_id", filters.inventory_item_id);
  }

  if (filters.transaction_type) {
    searchParams.set("transaction_type", filters.transaction_type);
  }

  if (filters.reference_type) {
    searchParams.set("reference_type", filters.reference_type);
  }

  const response = await fetch(
    `${API_BASE_URL}/api/v1/inventory-transactions/export${
      searchParams.toString() ? `?${searchParams.toString()}` : ""
    }`,
  );

  return downloadResponseAsFile(
    response,
    "Failed to export inventory transactions",
  );
};

export const createInventoryTransaction = async (payload) => {
  return performSyncableMutation({
    moduleName: "mayor-inventory",
    actionKey: "INVENTORY_TRANSACTION_CREATE",
    entityType: "INVENTORY_TRANSACTION",
    entityLocalId: payload?.inventory_batch_id || null,
    payload,
    requiredFields: ["inventory_batch_id", "transaction_type", "quantity"],
    request: async () => {
      const response = await fetch(`${API_BASE_URL}/api/v1/inventory-transactions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      return handleJsonResponse(response, "Failed to record inventory transaction");
    },
    buildQueuedResponse: ({ clientSyncId, entityLocalId, clientTimestamp }) =>
      buildOfflineQueuedResponse({
        message:
          "Inventory transaction saved offline. Pending sync once connection is restored.",
        data: {
          transaction_id: entityLocalId,
          performed_at: clientTimestamp,
        },
        clientSyncId,
        entityLocalId,
        clientTimestamp,
      }),
  });
};

export const fetchInventoryBatches = async () => {
  const response = await fetch(`${API_BASE_URL}/api/v1/inventory-batches`);

  return handleJsonResponse(response, "Failed to fetch inventory batches");
};
