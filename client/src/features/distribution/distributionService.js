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

export const fetchReliefPackTemplates = async (filters = {}) => {
  const searchParams = new URLSearchParams();

  searchParams.set("is_active", "true");

  if (filters.disaster_event_id) {
    searchParams.set("disaster_event_id", filters.disaster_event_id);
  }

  if (filters.disaster_type) {
    searchParams.set("disaster_type", filters.disaster_type);
  }

  const response = await fetch(
    `${API_BASE_URL}/api/v1/relief-pack-templates?${searchParams.toString()}`,
  );

  return handleJsonResponse(response, "Failed to fetch relief pack templates");
};

export const fetchReliefPackTemplateById = async (templateId) => {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/relief-pack-templates/${templateId}`,
  );

  return handleJsonResponse(response, "Failed to fetch relief pack template");
};

export const fetchInventoryItems = async () => {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/inventory-items?is_active=true`,
  );

  return handleJsonResponse(response, "Failed to fetch inventory items");
};

export const fetchInventoryBatches = async () => {
  const response = await fetch(`${API_BASE_URL}/api/v1/inventory-batches`);

  return handleJsonResponse(response, "Failed to fetch inventory batches");
};

export const fetchDistributionHistory = async (filters = {}) => {
  const searchParams = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") {
      return;
    }

    searchParams.set(key, value);
  });

  const response = await fetch(
    `${API_BASE_URL}/api/v1/distribution-transactions/history${
      searchParams.toString() ? `?${searchParams.toString()}` : ""
    }`,
  );

  return handleJsonResponse(response, "Failed to fetch distribution history");
};

export const fetchInventoryDistributionDetail = async (stubId) => {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/distribution-transactions/inventory-distribution/${stubId}`,
  );

  return handleJsonResponse(
    response,
    "Failed to fetch inventory distribution detail",
  );
};

export const exportDistributionHistory = async (filters = {}) => {
  const searchParams = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") {
      return;
    }

    searchParams.set(key, value);
  });

  const response = await fetch(
    `${API_BASE_URL}/api/v1/distribution-transactions/history/export?${
      searchParams.toString()
    }`,
  );

  if (!response.ok) {
    let message = "Failed to export distribution history";

    try {
      const payload = await response.json();
      message = payload.message || message;
    } catch (_error) {
      message = "Failed to export distribution history";
    }

    throw new Error(message);
  }

  const blob = await response.blob();
  const contentDisposition = response.headers.get("Content-Disposition") || "";
  const fileNameMatch = contentDisposition.match(/filename="([^"]+)"/i);

  return {
    blob,
    filename: fileNameMatch?.[1] || "mswdo-distribution-history.csv",
  };
};

export const exportInventoryDistribution = async (filters = {}) => {
  const searchParams = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") {
      return;
    }

    if (Array.isArray(value)) {
      if (value.length > 0) {
        searchParams.set(key, value.join(","));
      }
      return;
    }

    searchParams.set(key, value);
  });

  const response = await fetch(
    `${API_BASE_URL}/api/v1/distribution-transactions/inventory-distribution/export?${searchParams.toString()}`,
  );

  if (!response.ok) {
    let message = "Failed to export inventory distribution";

    try {
      const payload = await response.json();
      message = payload.message || message;
    } catch (_error) {
      message = "Failed to export inventory distribution";
    }

    throw new Error(message);
  }

  const blob = await response.blob();
  const contentDisposition = response.headers.get("Content-Disposition") || "";
  const fileNameMatch = contentDisposition.match(/filename="([^"]+)"/i);

  return {
    blob,
    filename: fileNameMatch?.[1] || "mswdo-inventory-distribution.csv",
  };
};

export const fetchInventoryDistributionExportOptions = async (filters = {}) => {
  const searchParams = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") {
      return;
    }

    if (Array.isArray(value)) {
      if (value.length > 0) {
        searchParams.set(key, value.join(","));
      }
      return;
    }

    searchParams.set(key, value);
  });

  const response = await fetch(
    `${API_BASE_URL}/api/v1/distribution-transactions/inventory-distribution/export-options?${searchParams.toString()}`,
  );

  return handleJsonResponse(
    response,
    "Failed to fetch inventory distribution export options",
  );
};

export const updateDistributionLifecycle = async ({
  transactionId,
  action,
  remarks,
}) => {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/distribution-transactions/${transactionId}/lifecycle`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action,
        remarks,
      }),
    },
  );

  return handleJsonResponse(
    response,
    "Failed to update distribution transaction status",
  );
};

export const recordDistributionTransaction = async (payload) => {
  return performSyncableMutation({
    moduleName: "distribution",
    actionKey: "DISTRIBUTION_CREATE",
    entityType: "DISTRIBUTION_TRANSACTION",
    entityLocalId: payload?.stub_id || null,
    payload,
    requiredFields: [
      "disaster_event_id",
      "household_id",
      "stub_id",
      "claimed_by_name",
      "items",
    ],
    request: async () => {
      const response = await fetch(
        `${API_BASE_URL}/api/v1/distribution-transactions`,
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
        "Failed to record distribution transaction",
      );
    },
    buildQueuedResponse: ({ clientSyncId, entityLocalId, clientTimestamp }) =>
      buildOfflineQueuedResponse({
        message:
          "Distribution record saved offline. Pending sync once connection is restored.",
        data: {
          distribution_transaction_id: entityLocalId,
          distribution_date: clientTimestamp,
          receipt_no: null,
        },
        clientSyncId,
        entityLocalId,
        clientTimestamp,
      }),
  });
};
