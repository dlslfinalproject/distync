import { performOnlineOnlyMutation } from "../../offline/syncService";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

const handleJsonResponse = async (response, fallbackMessage) => {
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.message || fallbackMessage);
  }

  return payload;
};

const DONATION_ONLINE_ONLY_MESSAGE =
  "An internet connection is required to save donation changes.";

const downloadResponseAsFile = async (response, fallbackMessage) => {
  if (!response.ok) {
    return handleJsonResponse(response, fallbackMessage);
  }

  const blob = await response.blob();
  const contentDisposition = response.headers.get("Content-Disposition") || "";
  const fileNameMatch = contentDisposition.match(/filename="([^"]+)"/i);

  return {
    blob,
    filename: fileNameMatch?.[1] || "donor-transparency-summary.csv",
  };
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

export const exportDonationTransparencySummary = async (
  format = "csv",
  filters = {},
) => {
  const searchParams = new URLSearchParams();
  searchParams.set("format", format);
  appendFilters(searchParams, filters);

  const response = await fetch(
    `${API_BASE_URL}/api/v1/donations/export/transparency${
      searchParams.toString() ? `?${searchParams.toString()}` : ""
    }`,
  );

  return downloadResponseAsFile(
    response,
    "Failed to export donor transparency summary",
  );
};

export const exportReceivedDonationsReport = async (
  format = "csv",
  filters = {},
) => {
  const searchParams = new URLSearchParams();
  searchParams.set("format", format);
  appendFilters(searchParams, filters);

  const response = await fetch(
    `${API_BASE_URL}/api/v1/donations/export/received${
      searchParams.toString() ? `?${searchParams.toString()}` : ""
    }`,
  );

  return downloadResponseAsFile(
    response,
    "Failed to export received donations report",
  );
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

export const fetchDonationDetail = async (donationId) => {
  const response = await fetch(`${API_BASE_URL}/api/v1/donations/${donationId}/detail`);
  return handleJsonResponse(response, "Failed to fetch donation detail");
};

export const createDonation = async (payload) => {
  return performOnlineOnlyMutation({
    payload,
    requiredFields: ["disaster_event_id", "donor_name", "status"],
    offlineMessage: DONATION_ONLINE_ONLY_MESSAGE,
    request: async () => {
      const response = await fetch(`${API_BASE_URL}/api/v1/donations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      return handleJsonResponse(response, "Failed to record donation");
    },
  });
};

export const updateDonation = async (donationId, payload) => {
  return performOnlineOnlyMutation({
    payload,
    requiredFields: ["disaster_event_id", "donor_name", "status"],
    offlineMessage: DONATION_ONLINE_ONLY_MESSAGE,
    request: async () => {
      const response = await fetch(`${API_BASE_URL}/api/v1/donations/${donationId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      return handleJsonResponse(response, "Failed to update donation");
    },
  });
};

export const deleteDonation = async (donationId) => {
  const response = await fetch(`${API_BASE_URL}/api/v1/donations/${donationId}`, {
    method: "DELETE",
  });

  return handleJsonResponse(response, "Failed to delete donation");
};

export const createDonationItem = async (donationId, payload) => {
  return performOnlineOnlyMutation({
    payload,
    requiredFields: ["inventory_item_id", "quantity_received"],
    offlineMessage: DONATION_ONLINE_ONLY_MESSAGE,
    request: async () => {
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
    },
  });
};

export const updateDonationItem = async (donationItemId, payload) => {
  return performOnlineOnlyMutation({
    payload,
    requiredFields: ["inventory_item_id", "quantity_received"],
    offlineMessage: DONATION_ONLINE_ONLY_MESSAGE,
    request: async () => {
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
    },
  });
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

export const reassignLeftoverDonationStock = async (donationItemId, payload) => {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/donations/items/${donationItemId}/reassign-leftover`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );

  return handleJsonResponse(
    response,
    "Failed to reassign leftover donated stock",
  );
};
