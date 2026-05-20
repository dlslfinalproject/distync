const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

const handleJsonResponse = async (response, fallbackMessage) => {
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.message || fallbackMessage);
  }

  return payload;
};

const appendFilters = (searchParams, filters = {}) => {
  Object.entries(filters).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") {
      return;
    }

    searchParams.set(key, value);
  });
};

export const fetchDonationPortalData = async (filters = {}) => {
  const searchParams = new URLSearchParams();
  appendFilters(searchParams, filters);

  const response = await fetch(
    `${API_BASE_URL}/api/v1/donations/public-portal${
      searchParams.toString() ? `?${searchParams.toString()}` : ""
    }`,
  );

  return handleJsonResponse(response, "Failed to fetch donor portal data");
};

export const fetchDonationNeeds = async (filters = {}) => {
  const searchParams = new URLSearchParams();
  appendFilters(searchParams, filters);

  const response = await fetch(
    `${API_BASE_URL}/api/v1/donations/needs${
      searchParams.toString() ? `?${searchParams.toString()}` : ""
    }`,
  );

  return handleJsonResponse(response, "Failed to fetch donation needs");
};

export const createDonationNeed = async (payload) => {
  const response = await fetch(`${API_BASE_URL}/api/v1/donations/needs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return handleJsonResponse(response, "Failed to create donation need");
};

export const updateDonationNeed = async (donationNeedId, payload) => {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/donations/needs/${donationNeedId}`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );

  return handleJsonResponse(response, "Failed to update donation need");
};

export const deleteDonationNeed = async (donationNeedId) => {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/donations/needs/${donationNeedId}`,
    {
      method: "DELETE",
    },
  );

  return handleJsonResponse(response, "Failed to delete donation need");
};

export const fetchDonations = async (filters = {}) => {
  const searchParams = new URLSearchParams();
  appendFilters(searchParams, filters);

  const response = await fetch(
    `${API_BASE_URL}/api/v1/donations${
      searchParams.toString() ? `?${searchParams.toString()}` : ""
    }`,
  );

  return handleJsonResponse(response, "Failed to fetch donations");
};

export const fetchDonationById = async (donationId) => {
  const response = await fetch(`${API_BASE_URL}/api/v1/donations/${donationId}`);
  return handleJsonResponse(response, "Failed to fetch donation details");
};

export const createDonation = async (payload) => {
  const response = await fetch(`${API_BASE_URL}/api/v1/donations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return handleJsonResponse(response, "Failed to record donation");
};

export const updateDonation = async (donationId, payload) => {
  const response = await fetch(`${API_BASE_URL}/api/v1/donations/${donationId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return handleJsonResponse(response, "Failed to update donation");
};

export const deleteDonation = async (donationId) => {
  const response = await fetch(`${API_BASE_URL}/api/v1/donations/${donationId}`, {
    method: "DELETE",
  });

  return handleJsonResponse(response, "Failed to delete donation");
};

export const createDonationItem = async (donationId, payload) => {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/donations/${donationId}/items`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );

  return handleJsonResponse(response, "Failed to record donation item");
};

export const updateDonationItem = async (donationItemId, payload) => {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/donations/items/${donationItemId}`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );

  return handleJsonResponse(response, "Failed to update donation item");
};

export const deleteDonationItem = async (donationItemId) => {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/donations/items/${donationItemId}`,
    {
      method: "DELETE",
    },
  );

  return handleJsonResponse(response, "Failed to delete donation item");
};
