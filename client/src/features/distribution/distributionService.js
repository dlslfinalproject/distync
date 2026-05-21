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

export const fetchReliefPackTemplates = async () => {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/relief-pack-templates?is_active=true`,
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
