const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

const handleJsonResponse = async (response, fallbackMessage) => {
  const responseData = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(responseData?.message || fallbackMessage);
  }

  return responseData;
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

export const createInventoryBatch = async (payload) => {
  const response = await fetch(`${API_BASE_URL}/api/v1/inventory-batches`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return handleJsonResponse(response, "Failed to create inventory batch");
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
