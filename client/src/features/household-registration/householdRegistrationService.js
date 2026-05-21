import {
  buildOfflineQueuedResponse,
  performSyncableMutation,
} from "../../offline/syncService";

const API_BASE_URL =
import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

const parseJsonResponse = async (response) => {
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.message || "Request failed");
  }

  return payload;
};

export const fetchActiveDisasterEvents = async () => {
  const response = await fetch(`${API_BASE_URL}/api/v1/disaster-events/active`);
  return parseJsonResponse(response);
};

export const fetchSectors = async () => {
  const response = await fetch(`${API_BASE_URL}/api/v1/sectors`);
  return parseJsonResponse(response);
};

export const fetchBarangays = async () => {
  const response = await fetch(`${API_BASE_URL}/api/v1/barangays`);
  return parseJsonResponse(response);
};

export const fetchEvacuationCenters = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/evacuation-centers`);

    if (!response.ok) {
      return [];
    }

    const payload = await response.json();
    return Array.isArray(payload.data) ? payload.data : payload;
  } catch (error) {
    return [];
  }
};

export const fetchEvacuationCentersByBarangay = async (barangayId) => {
  if (!barangayId) {
    return [];
  }

  try {
    const response = await fetch(
      `${API_BASE_URL}/api/v1/evacuation-centers/barangay/${barangayId}`,
    );

    if (!response.ok) {
      return [];
    }

    const payload = await response.json();
    return Array.isArray(payload.data) ? payload.data : payload;
  } catch (error) {
    return [];
  }
};

export const registerHousehold = async (payload) => {
  return performSyncableMutation({
    moduleName: "barangay-households",
    actionKey: "HOUSEHOLD_REGISTER",
    entityType: "HOUSEHOLD",
    entityLocalId: payload?.family_head?.first_name
      ? `${payload.family_head.first_name}-${payload.family_head.last_name}-${payload.disaster_event_id}-${payload.barangay_id}`
      : null,
    payload,
    requiredFields: ["disaster_event_id", "barangay_id", "family_head", "members"],
    request: async () => {
      const response = await fetch(`${API_BASE_URL}/api/v1/households/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      return parseJsonResponse(response);
    },
    buildQueuedResponse: ({ clientSyncId, entityLocalId, clientTimestamp }) =>
      buildOfflineQueuedResponse({
        message:
          "Household registration saved offline. Pending sync once connection is restored.",
        data: {
          household: {
            id: entityLocalId,
            updated_at: clientTimestamp,
          },
        },
        clientSyncId,
        entityLocalId,
        clientTimestamp,
      }),
  });
};

export const updateHousehold = async (householdId, payload) => {
  return performSyncableMutation({
    moduleName: "barangay-households",
    actionKey: "HOUSEHOLD_UPDATE",
    entityType: "HOUSEHOLD",
    entityServerId: householdId,
    payload,
    requiredFields: ["disaster_event_id", "barangay_id", "family_head", "members"],
    request: async () => {
      const response = await fetch(`${API_BASE_URL}/api/v1/households/${householdId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      return parseJsonResponse(response);
    },
    buildQueuedResponse: ({ clientSyncId, clientTimestamp }) =>
      buildOfflineQueuedResponse({
        message:
          "Household update saved offline. Pending sync once connection is restored.",
        data: {
          household: {
            id: householdId,
            updated_at: clientTimestamp,
          },
        },
        clientSyncId,
        entityLocalId: householdId,
        clientTimestamp,
      }),
  });
};
