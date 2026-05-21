import {
  buildOfflineQueuedResponse,
  performSyncableMutation,
} from "../../offline/syncService";

const API_BASE_URL =
import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

const REGISTRATION_CACHE_KEYS = {
  activeDisasterEvents: "distync-registration-active-disaster-events",
  sectors: "distync-registration-sectors",
  barangays: "distync-registration-barangays",
  selectedDisasterEventId: "distync-registration-selected-disaster-event-id",
  selectedDisasterEvent: "distync-registration-selected-disaster-event",
  evacuationCentersAll: "distync-registration-evacuation-centers-all",
  evacuationCentersByBarangay: "distync-registration-evacuation-centers-by-barangay",
};

const safeReadJson = (storageKey, fallbackValue) => {
  if (typeof window === "undefined") {
    return fallbackValue;
  }

  try {
    const rawValue = window.localStorage.getItem(storageKey);

    if (!rawValue) {
      return fallbackValue;
    }

    return JSON.parse(rawValue);
  } catch (_error) {
    return fallbackValue;
  }
};

const safeWriteJson = (storageKey, value) => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(storageKey, JSON.stringify(value));
  } catch (_error) {
    // Ignore caching issues so registration can continue normally.
  }
};

const parseJsonResponse = async (response) => {
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.message || "Request failed");
  }

  return payload;
};

export const fetchActiveDisasterEvents = async () => {
  const response = await fetch(`${API_BASE_URL}/api/v1/disaster-events/active`);
  const payload = await parseJsonResponse(response);
  safeWriteJson(REGISTRATION_CACHE_KEYS.activeDisasterEvents, payload);
  return payload;
};

export const fetchSectors = async () => {
  const response = await fetch(`${API_BASE_URL}/api/v1/sectors`);
  const payload = await parseJsonResponse(response);
  safeWriteJson(REGISTRATION_CACHE_KEYS.sectors, payload);
  return payload;
};

export const fetchBarangays = async () => {
  const response = await fetch(`${API_BASE_URL}/api/v1/barangays`);
  const payload = await parseJsonResponse(response);
  safeWriteJson(REGISTRATION_CACHE_KEYS.barangays, payload);
  return payload;
};

export const fetchEvacuationCenters = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/evacuation-centers`);

    if (!response.ok) {
      return [];
    }

    const payload = await response.json();
    const normalizedPayload = Array.isArray(payload.data) ? payload.data : payload;
    safeWriteJson(REGISTRATION_CACHE_KEYS.evacuationCentersAll, normalizedPayload);
    return normalizedPayload;
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
    const normalizedPayload = Array.isArray(payload.data) ? payload.data : payload;
    const cachedCentersByBarangay = safeReadJson(
      REGISTRATION_CACHE_KEYS.evacuationCentersByBarangay,
      {},
    );

    safeWriteJson(REGISTRATION_CACHE_KEYS.evacuationCentersByBarangay, {
      ...cachedCentersByBarangay,
      [barangayId]: normalizedPayload,
    });

    return normalizedPayload;
  } catch (error) {
    return [];
  }
};

export const cacheSelectedDisasterEventId = (disasterEventId) => {
  if (!disasterEventId) {
    return;
  }

  safeWriteJson(REGISTRATION_CACHE_KEYS.selectedDisasterEventId, disasterEventId);
};

export const cacheSelectedDisasterEvent = (disasterEvent) => {
  if (!disasterEvent || typeof disasterEvent !== "object" || !disasterEvent.id) {
    return;
  }

  safeWriteJson(REGISTRATION_CACHE_KEYS.selectedDisasterEvent, {
    id: disasterEvent.id,
    event_code: disasterEvent.event_code || "",
    title: disasterEvent.title || disasterEvent.event_name || "",
    event_name: disasterEvent.event_name || disasterEvent.title || "",
    start_date: disasterEvent.start_date || null,
    end_date: disasterEvent.end_date || null,
    status: disasterEvent.status || "",
  });
};

export const cacheRegistrationActiveDisasterEvents = (disasterEvents) => {
  if (!Array.isArray(disasterEvents) || disasterEvents.length === 0) {
    return;
  }

  safeWriteJson(REGISTRATION_CACHE_KEYS.activeDisasterEvents, disasterEvents);
};

export const cacheRegistrationSectors = (sectors) => {
  if (!Array.isArray(sectors) || sectors.length === 0) {
    return;
  }

  safeWriteJson(REGISTRATION_CACHE_KEYS.sectors, {
    data: sectors,
  });
};

export const cacheRegistrationBarangays = (barangays) => {
  if (!Array.isArray(barangays) || barangays.length === 0) {
    return;
  }

  safeWriteJson(REGISTRATION_CACHE_KEYS.barangays, barangays);
};

export const cacheRegistrationEvacuationCentersByBarangay = (
  barangayId,
  centers,
) => {
  if (!barangayId || !Array.isArray(centers) || centers.length === 0) {
    return;
  }

  const cachedCentersByBarangay = safeReadJson(
    REGISTRATION_CACHE_KEYS.evacuationCentersByBarangay,
    {},
  );

  safeWriteJson(REGISTRATION_CACHE_KEYS.evacuationCentersByBarangay, {
    ...cachedCentersByBarangay,
    [barangayId]: centers,
  });
};

export const getCachedRegistrationReferenceData = () => {
  return {
    activeDisasterEvents: safeReadJson(
      REGISTRATION_CACHE_KEYS.activeDisasterEvents,
      [],
    ),
    sectors: safeReadJson(REGISTRATION_CACHE_KEYS.sectors, null),
    barangays: safeReadJson(REGISTRATION_CACHE_KEYS.barangays, []),
    selectedDisasterEventId: safeReadJson(
      REGISTRATION_CACHE_KEYS.selectedDisasterEventId,
      "",
    ),
    selectedDisasterEvent: safeReadJson(
      REGISTRATION_CACHE_KEYS.selectedDisasterEvent,
      null,
    ),
    evacuationCentersAll: safeReadJson(
      REGISTRATION_CACHE_KEYS.evacuationCentersAll,
      [],
    ),
    evacuationCentersByBarangay: safeReadJson(
      REGISTRATION_CACHE_KEYS.evacuationCentersByBarangay,
      {},
    ),
  };
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
    requiredFields: ["disaster_event_id", "barangay_id", "family_head"],
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
    requiredFields: ["disaster_event_id", "barangay_id", "family_head"],
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
