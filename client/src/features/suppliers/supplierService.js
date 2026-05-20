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
    filename: fileNameMatch?.[1] || "suppliers.csv",
  };
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

export const exportSuppliers = async (format = "csv", filters = {}) => {
  const searchParams = new URLSearchParams();
  searchParams.set("format", format);

  if (filters.search) {
    searchParams.set("search", filters.search.trim());
  }

  if (filters.has_moa !== "") {
    searchParams.set("has_moa", filters.has_moa);
  }

  const response = await fetch(
    `${API_BASE_URL}/api/v1/suppliers/export${
      searchParams.toString() ? `?${searchParams.toString()}` : ""
    }`,
  );

  return downloadResponseAsFile(response, "Failed to export suppliers");
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
