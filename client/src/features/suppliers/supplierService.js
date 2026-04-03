const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

const handleJsonResponse = async (response, fallbackMessage) => {
  const responseData = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(responseData?.message || fallbackMessage);
  }

  return responseData;
};

export const fetchSuppliers = async (filters = {}) => {
  const searchParams = new URLSearchParams();

  if (filters.search) {
    searchParams.set("search", filters.search.trim());
  }

  if (filters.has_moa !== "") {
    searchParams.set("has_moa", filters.has_moa);
  }

  const queryString = searchParams.toString();
  const url = `${API_BASE_URL}/api/v1/suppliers${
    queryString ? `?${queryString}` : ""
  }`;

  const response = await fetch(url);
  return handleJsonResponse(response, "Failed to fetch suppliers");
};

export const fetchSupplierById = async (supplierId) => {
  const response = await fetch(`${API_BASE_URL}/api/v1/suppliers/${supplierId}`);

  return handleJsonResponse(response, "Failed to fetch supplier");
};

export const createSupplier = async (payload) => {
  const response = await fetch(`${API_BASE_URL}/api/v1/suppliers`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return handleJsonResponse(response, "Failed to create supplier");
};

export const updateSupplier = async (supplierId, payload) => {
  const response = await fetch(`${API_BASE_URL}/api/v1/suppliers/${supplierId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return handleJsonResponse(response, "Failed to update supplier");
};
