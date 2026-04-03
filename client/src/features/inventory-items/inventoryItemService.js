const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

const handleJsonResponse = async (response, fallbackMessage) => {
  const responseData = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(responseData?.message || fallbackMessage);
  }

  return responseData;
};

export const fetchInventoryItems = async (filters = {}) => {
  const searchParams = new URLSearchParams();

  if (filters.search) {
    searchParams.set("search", filters.search.trim());
  }

  if (filters.category) {
    searchParams.set("category", filters.category.trim());
  }

  if (filters.is_active !== "") {
    searchParams.set("is_active", filters.is_active);
  }

  if (filters.is_perishable !== "") {
    searchParams.set("is_perishable", filters.is_perishable);
  }

  const queryString = searchParams.toString();
  const url = `${API_BASE_URL}/api/v1/inventory-items${
    queryString ? `?${queryString}` : ""
  }`;

  const response = await fetch(url);
  return handleJsonResponse(response, "Failed to fetch inventory items");
};

export const fetchInventoryItemById = async (inventoryItemId) => {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/inventory-items/${inventoryItemId}`,
  );

  return handleJsonResponse(response, "Failed to fetch inventory item");
};

export const createInventoryItem = async (payload) => {
  const response = await fetch(`${API_BASE_URL}/api/v1/inventory-items`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return handleJsonResponse(response, "Failed to create inventory item");
};

export const updateInventoryItem = async (inventoryItemId, payload) => {
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
};
