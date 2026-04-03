const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

const handleJsonResponse = async (response, fallbackMessage) => {
  const responseData = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(responseData?.message || fallbackMessage);
  }

  return responseData;
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

export const createInventoryTransaction = async (payload) => {
  const response = await fetch(`${API_BASE_URL}/api/v1/inventory-transactions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return handleJsonResponse(response, "Failed to record inventory transaction");
};

export const fetchInventoryBatches = async () => {
  const response = await fetch(`${API_BASE_URL}/api/v1/inventory-batches`);

  return handleJsonResponse(response, "Failed to fetch inventory batches");
};
