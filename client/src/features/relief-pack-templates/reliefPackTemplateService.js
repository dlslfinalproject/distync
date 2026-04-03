const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

const handleJsonResponse = async (response, fallbackMessage) => {
  const responseData = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(responseData?.message || fallbackMessage);
  }

  return responseData;
};

export const fetchReliefPackTemplates = async (filters = {}) => {
  const searchParams = new URLSearchParams();

  if (filters.search) {
    searchParams.set("search", filters.search.trim());
  }

  if (filters.is_active !== "") {
    searchParams.set("is_active", filters.is_active);
  }

  const queryString = searchParams.toString();
  const url = `${API_BASE_URL}/api/v1/relief-pack-templates${
    queryString ? `?${queryString}` : ""
  }`;

  const response = await fetch(url);
  return handleJsonResponse(response, "Failed to fetch relief pack templates");
};

export const fetchReliefPackTemplateById = async (templateId) => {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/relief-pack-templates/${templateId}`,
  );

  return handleJsonResponse(response, "Failed to fetch relief pack template");
};

export const createReliefPackTemplate = async (payload) => {
  const response = await fetch(`${API_BASE_URL}/api/v1/relief-pack-templates`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return handleJsonResponse(response, "Failed to create relief pack template");
};

export const updateReliefPackTemplate = async (templateId, payload) => {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/relief-pack-templates/${templateId}`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );

  return handleJsonResponse(response, "Failed to update relief pack template");
};

export const replaceReliefPackTemplateItems = async (templateId, payload) => {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/relief-pack-templates/${templateId}/items`,
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
    "Failed to update relief pack template items",
  );
};

export const fetchInventoryItems = async () => {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/inventory-items?is_active=true`,
  );

  return handleJsonResponse(response, "Failed to fetch inventory items");
};
