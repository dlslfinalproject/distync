import {
  buildOfflineQueuedResponse,
  performSyncableMutation,
} from "../../offline/syncService";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

const handleJsonResponse = async (response, fallbackMessage) => {
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.message || fallbackMessage);
  }

  return payload;
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
  return performSyncableMutation({
    moduleName: "mayor-donations",
    actionKey: "DONATION_NEED_CREATE",
    entityType: "DONATION_NEED",
    entityLocalId: `${payload?.disaster_event_id || "event"}:${payload?.inventory_item_id || "item"}`,
    payload,
    requiredFields: ["disaster_event_id", "inventory_item_id", "quantity_needed"],
    request: async () => {
      const response = await fetch(`${API_BASE_URL}/api/v1/donations/needs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      return handleJsonResponse(response, "Failed to create donation need");
    },
    buildQueuedResponse: ({ clientSyncId, entityLocalId, clientTimestamp }) =>
      buildOfflineQueuedResponse({
        message:
          "Donation need saved offline. Pending sync once connection is restored.",
        data: {
          id: entityLocalId,
          updated_at: clientTimestamp,
        },
        clientSyncId,
        entityLocalId,
        clientTimestamp,
      }),
  });
};

export const updateDonationNeed = async (donationNeedId, payload) => {
  return performSyncableMutation({
    moduleName: "mayor-donations",
    actionKey: "DONATION_NEED_UPDATE",
    entityType: "DONATION_NEED",
    entityServerId: donationNeedId,
    payload,
    requiredFields: ["disaster_event_id", "inventory_item_id", "quantity_needed"],
    request: async () => {
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
    },
    buildQueuedResponse: ({ clientSyncId, clientTimestamp }) =>
      buildOfflineQueuedResponse({
        message:
          "Donation need update saved offline. Pending sync once connection is restored.",
        data: {
          id: donationNeedId,
          updated_at: clientTimestamp,
        },
        clientSyncId,
        entityLocalId: donationNeedId,
        clientTimestamp,
      }),
  });
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
  return performSyncableMutation({
    moduleName: "mayor-donations",
    actionKey: "DONATION_CREATE",
    entityType: "DONATION",
    entityLocalId: payload?.donor_name || null,
    payload,
    requiredFields: ["disaster_event_id", "donor_name", "status"],
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
    buildQueuedResponse: ({ clientSyncId, entityLocalId, clientTimestamp }) =>
      buildOfflineQueuedResponse({
        message:
          "Donation record saved offline. Pending sync once connection is restored.",
        data: {
          id: entityLocalId,
          updated_at: clientTimestamp,
        },
        clientSyncId,
        entityLocalId,
        clientTimestamp,
      }),
  });
};

export const updateDonation = async (donationId, payload) => {
  return performSyncableMutation({
    moduleName: "mayor-donations",
    actionKey: "DONATION_UPDATE",
    entityType: "DONATION",
    entityServerId: donationId,
    payload,
    requiredFields: ["disaster_event_id", "donor_name", "status"],
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
    buildQueuedResponse: ({ clientSyncId, clientTimestamp }) =>
      buildOfflineQueuedResponse({
        message:
          "Donation update saved offline. Pending sync once connection is restored.",
        data: {
          id: donationId,
          updated_at: clientTimestamp,
        },
        clientSyncId,
        entityLocalId: donationId,
        clientTimestamp,
      }),
  });
};

export const deleteDonation = async (donationId) => {
  const response = await fetch(`${API_BASE_URL}/api/v1/donations/${donationId}`, {
    method: "DELETE",
  });

  return handleJsonResponse(response, "Failed to delete donation");
};

export const createDonationItem = async (donationId, payload) => {
  return performSyncableMutation({
    moduleName: "mayor-donations",
    actionKey: "DONATION_ITEM_CREATE",
    entityType: "DONATION_ITEM",
    entityServerId: donationId,
    entityLocalId: `${donationId}:${payload?.inventory_item_id || "item"}`,
    payload,
    requiredFields: ["inventory_item_id", "quantity_received"],
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
    buildQueuedResponse: ({ clientSyncId, entityLocalId, clientTimestamp }) =>
      buildOfflineQueuedResponse({
        message:
          "Donation item saved offline. Pending sync once connection is restored.",
        data: {
          id: entityLocalId,
          updated_at: clientTimestamp,
        },
        clientSyncId,
        entityLocalId,
        clientTimestamp,
      }),
  });
};

export const updateDonationItem = async (donationItemId, payload) => {
  return performSyncableMutation({
    moduleName: "mayor-donations",
    actionKey: "DONATION_ITEM_UPDATE",
    entityType: "DONATION_ITEM",
    entityServerId: donationItemId,
    payload,
    requiredFields: ["inventory_item_id", "quantity_received"],
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
    buildQueuedResponse: ({ clientSyncId, clientTimestamp }) =>
      buildOfflineQueuedResponse({
        message:
          "Donation item update saved offline. Pending sync once connection is restored.",
        data: {
          id: donationItemId,
          updated_at: clientTimestamp,
        },
        clientSyncId,
        entityLocalId: donationItemId,
        clientTimestamp,
      }),
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
