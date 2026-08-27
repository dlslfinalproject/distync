import {
  buildOfflineQueuedResponse,
  performSyncableMutation,
} from "../../offline/syncService.js";
import {
  assertNoLocalDuplicateHouseholdRegistration,
} from "./localDuplicatePreflight.js";
import { HOUSEHOLD_PRIVACY_OFFLINE_MESSAGE } from "./privacyNotice.mjs";
import {
  getRegistrationStorageKey,
  readStorageValue,
  removeStorageKey,
  removeStorageKeysByPrefix,
  writeStorageValue,
} from "../../utils/modeStorage.js";
import { sanitizeHouseholdUpdatePayload } from "./householdEditProtection.js";

const API_BASE_URL =
  import.meta.env?.VITE_API_BASE_URL || "http://localhost:5000";

const REGISTRATION_CACHE_KEYS = {
  activeDisasterEvents: "active-disaster-events",
  sectors: "sectors",
  barangays: "barangays",
  selectedDisasterEventId: "selected-disaster-event-id",
  selectedDisasterEvent: "selected-disaster-event",
  evacuationCentersAll: "evacuation-centers-all",
  evacuationCentersByBarangay: "evacuation-centers-by-barangay",
};

const safeReadJson = (storageKey, fallbackValue) => {
  if (typeof window === "undefined") {
    return fallbackValue;
  }

  try {
    const rawValue = readStorageValue(storageKey);

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
    writeStorageValue(storageKey, JSON.stringify(value));
  } catch (_error) {
    // Ignore caching issues so registration can continue normally.
  }
};

const getRegistrationCacheKey = (cacheSegment) =>
  getRegistrationStorageKey(cacheSegment);

const parseJsonResponse = async (response) => {
  const payload = await response.json();

  if (!response.ok) {
    const error = new Error(payload.message || "Request failed");
    error.statusCode = response.status;
    error.code = payload.code || payload.error || "";
    error.serverPayload = payload.data || null;
    throw error;
  }

  return payload;
};

const inFlightHouseholdRegistrationKeys = new Set();

const normalizeDuplicateGuardText = (value) =>
  String(value || "").trim().replace(/\s+/g, " ").toLowerCase();

const buildLocalRegistrationGuardKey = (payload = {}) =>
  [
    payload.disaster_event_id || "",
    payload.barangay_id || "",
    normalizeDuplicateGuardText(payload.family_head?.first_name),
    normalizeDuplicateGuardText(payload.family_head?.middle_name),
    normalizeDuplicateGuardText(payload.family_head?.last_name),
    normalizeDuplicateGuardText(payload.family_head?.suffix),
  ].join("|");

export const fetchActiveDisasterEvents = async () => {
  const response = await fetch(`${API_BASE_URL}/api/v1/disaster-events/active`);
  const payload = await parseJsonResponse(response);
  safeWriteJson(getRegistrationCacheKey(REGISTRATION_CACHE_KEYS.activeDisasterEvents), payload);
  return payload;
};

export const fetchSectors = async () => {
  const response = await fetch(`${API_BASE_URL}/api/v1/sectors`);
  const payload = await parseJsonResponse(response);
  safeWriteJson(getRegistrationCacheKey(REGISTRATION_CACHE_KEYS.sectors), payload);
  return payload;
};

export const fetchBarangays = async () => {
  const response = await fetch(`${API_BASE_URL}/api/v1/barangays`);
  const payload = await parseJsonResponse(response);
  safeWriteJson(getRegistrationCacheKey(REGISTRATION_CACHE_KEYS.barangays), payload);
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
    safeWriteJson(
      getRegistrationCacheKey(REGISTRATION_CACHE_KEYS.evacuationCentersAll),
      normalizedPayload,
    );
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
      getRegistrationCacheKey(REGISTRATION_CACHE_KEYS.evacuationCentersByBarangay),
      {},
    );

    safeWriteJson(
      getRegistrationCacheKey(REGISTRATION_CACHE_KEYS.evacuationCentersByBarangay),
      {
        ...cachedCentersByBarangay,
        [barangayId]: normalizedPayload,
      },
    );

    return normalizedPayload;
  } catch (error) {
    return [];
  }
};

export const cacheSelectedDisasterEventId = (disasterEventId) => {
  if (!disasterEventId) {
    return;
  }

  safeWriteJson(
    getRegistrationCacheKey(REGISTRATION_CACHE_KEYS.selectedDisasterEventId),
    disasterEventId,
  );
};

export const cacheSelectedDisasterEvent = (disasterEvent) => {
  if (!disasterEvent || typeof disasterEvent !== "object" || !disasterEvent.id) {
    return;
  }

  safeWriteJson(
    getRegistrationCacheKey(REGISTRATION_CACHE_KEYS.selectedDisasterEvent),
    {
      id: disasterEvent.id,
      event_code: disasterEvent.event_code || "",
      title: disasterEvent.title || disasterEvent.event_name || "",
      event_name: disasterEvent.event_name || disasterEvent.title || "",
      start_date: disasterEvent.start_date || null,
      end_date: disasterEvent.end_date || null,
      status: disasterEvent.status || "",
    },
  );
};

export const cacheRegistrationActiveDisasterEvents = (disasterEvents) => {
  if (!Array.isArray(disasterEvents) || disasterEvents.length === 0) {
    return;
  }

  safeWriteJson(
    getRegistrationCacheKey(REGISTRATION_CACHE_KEYS.activeDisasterEvents),
    disasterEvents,
  );
};

export const cacheRegistrationSectors = (sectors) => {
  if (!Array.isArray(sectors) || sectors.length === 0) {
    return;
  }

  safeWriteJson(getRegistrationCacheKey(REGISTRATION_CACHE_KEYS.sectors), {
    data: sectors,
  });
};

export const cacheRegistrationBarangays = (barangays) => {
  if (!Array.isArray(barangays) || barangays.length === 0) {
    return;
  }

  safeWriteJson(getRegistrationCacheKey(REGISTRATION_CACHE_KEYS.barangays), barangays);
};

export const cacheRegistrationEvacuationCentersByBarangay = (
  barangayId,
  centers,
) => {
  if (!barangayId || !Array.isArray(centers) || centers.length === 0) {
    return;
  }

  const cachedCentersByBarangay = safeReadJson(
    getRegistrationCacheKey(REGISTRATION_CACHE_KEYS.evacuationCentersByBarangay),
    {},
  );

  safeWriteJson(
    getRegistrationCacheKey(REGISTRATION_CACHE_KEYS.evacuationCentersByBarangay),
    {
      ...cachedCentersByBarangay,
      [barangayId]: centers,
    },
  );
};

export const getCachedRegistrationReferenceData = () => {
  return {
    activeDisasterEvents: safeReadJson(
      getRegistrationCacheKey(REGISTRATION_CACHE_KEYS.activeDisasterEvents),
      [],
    ),
    sectors: safeReadJson(getRegistrationCacheKey(REGISTRATION_CACHE_KEYS.sectors), null),
    barangays: safeReadJson(getRegistrationCacheKey(REGISTRATION_CACHE_KEYS.barangays), []),
    selectedDisasterEventId: safeReadJson(
      getRegistrationCacheKey(REGISTRATION_CACHE_KEYS.selectedDisasterEventId),
      "",
    ),
    selectedDisasterEvent: safeReadJson(
      getRegistrationCacheKey(REGISTRATION_CACHE_KEYS.selectedDisasterEvent),
      null,
    ),
    evacuationCentersAll: safeReadJson(
      getRegistrationCacheKey(REGISTRATION_CACHE_KEYS.evacuationCentersAll),
      [],
    ),
    evacuationCentersByBarangay: safeReadJson(
      getRegistrationCacheKey(REGISTRATION_CACHE_KEYS.evacuationCentersByBarangay),
      {},
    ),
  };
};

export const clearRegistrationReferenceCache = () => {
  removeStorageKeysByPrefix(getRegistrationStorageKey(""));
};

export const clearSelectedDisasterEventCache = () => {
  removeStorageKey(
    getRegistrationCacheKey(REGISTRATION_CACHE_KEYS.selectedDisasterEventId),
  );
  removeStorageKey(
    getRegistrationCacheKey(REGISTRATION_CACHE_KEYS.selectedDisasterEvent),
  );
};

export const registerHousehold = async (payload, options = {}) => {
  const isReAdmission =
    payload?.registration_operation === "CREATE_NEW_HOUSEHOLD_OCCURRENCE";
  const actionKey = isReAdmission
    ? "HOUSEHOLD_RE_ADMISSION"
    : "HOUSEHOLD_REGISTER";
  const guardKey = buildLocalRegistrationGuardKey(payload);

  if (guardKey && inFlightHouseholdRegistrationKeys.has(guardKey)) {
    const error = new Error(
      "This household registration is already being saved. Please wait for the current save to finish.",
    );
    error.code = "LOCAL_HOUSEHOLD_REGISTRATION_IN_PROGRESS";
    throw error;
  }

  if (guardKey) {
    inFlightHouseholdRegistrationKeys.add(guardKey);
  }

  try {
    if (!isReAdmission) {
      await assertNoLocalDuplicateHouseholdRegistration({
        payload,
        cachedHouseholds: options.cachedHouseholds,
        excludeClientSyncId: options.excludeClientSyncId,
      });
    }

    return await performSyncableMutation({
      moduleName: "barangay-households",
      actionKey,
      entityType: "HOUSEHOLD",
      entityLocalId: payload?.family_head?.first_name
        ? `${payload.family_head.first_name}-${payload.family_head.last_name}-${payload.disaster_event_id}-${payload.barangay_id}${
            isReAdmission
              ? `-${payload.re_admission_source_household_id || "source"}`
              : ""
          }`
        : null,
      payload,
      requiredFields: [
        "disaster_event_id",
        "barangay_id",
        "family_head",
        ...(isReAdmission
          ? ["registration_operation", "re_admission_source_household_id"]
          : []),
      ],
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
          message: HOUSEHOLD_PRIVACY_OFFLINE_MESSAGE,
          data: {
            household: {
              id: entityLocalId,
              updated_at: clientTimestamp,
            },
            ...(isReAdmission
              ? {
                  registration_operation: "CREATE_NEW_HOUSEHOLD_OCCURRENCE",
                  source_household_id:
                    payload.re_admission_source_household_id || null,
                }
              : {}),
          },
          clientSyncId,
          entityLocalId,
          clientTimestamp,
        }),
    });
  } finally {
    if (guardKey) {
      inFlightHouseholdRegistrationKeys.delete(guardKey);
    }
  }
};

export const fetchDuplicateRegistrationSuggestions = async (
  payload,
  options = {},
) => {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/households/duplicate-suggestions`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: options.signal,
    },
  );

  const parsedPayload = await parseJsonResponse(
    response,
    "Failed to fetch duplicate registration suggestions",
  );

  return parsedPayload.data || {
    total_matches: 0,
    has_strong_matches: false,
    groups: [],
  };
};

export const updateHousehold = async (householdId, payload) => {
  const sanitizedPayload = sanitizeHouseholdUpdatePayload(payload);

  return performSyncableMutation({
    moduleName: "barangay-households",
    actionKey: "HOUSEHOLD_UPDATE",
    entityType: "HOUSEHOLD",
    entityServerId: householdId,
    payload: sanitizedPayload,
    requiredFields: ["disaster_event_id", "barangay_id"],
    request: async () => {
      const response = await fetch(`${API_BASE_URL}/api/v1/households/${householdId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(sanitizedPayload),
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
