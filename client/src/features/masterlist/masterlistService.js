import {
  buildOfflineQueuedResponse,
  performSyncableMutation,
} from "../../offline/syncService";
import {
  MASTERLIST_FILTER_SECTOR_CODES,
  formatMasterlistFilterSectorLabel,
  getCanonicalMemberSectorCode,
} from "../../utils/registrationOptions";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

const parseJsonResponse = async (response, fallbackMessage) => {
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.message || fallbackMessage);
  }

  return payload;
};

export const formatDateTime = (value) => {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
};

export const buildSectorsText = (household) => {
  const orderIndexByCode = new Map(
    MASTERLIST_FILTER_SECTOR_CODES.map((sectorCode, index) => [sectorCode, index]),
  );
  const sectors = [
    ...(household.household_sectors || []),
    ...(household.members || []).flatMap((member) => member.sectors || []),
  ];
  const uniqueSectorsByCode = new Map();

  sectors.forEach((sector) => {
    const canonicalCode = getCanonicalMemberSectorCode(sector?.code);

    if (!canonicalCode || uniqueSectorsByCode.has(canonicalCode)) {
      return;
    }

    uniqueSectorsByCode.set(canonicalCode, sector);
  });

  const orderedSectorLabels = [...uniqueSectorsByCode.entries()]
    .sort(([leftCode], [rightCode]) => {
      const leftIndex = orderIndexByCode.get(leftCode);
      const rightIndex = orderIndexByCode.get(rightCode);

      if (leftIndex !== undefined && rightIndex !== undefined) {
        return leftIndex - rightIndex;
      }

      if (leftIndex !== undefined) {
        return -1;
      }

      if (rightIndex !== undefined) {
        return 1;
      }

      return String(leftCode).localeCompare(String(rightCode));
    })
    .map(([, sector]) => formatMasterlistFilterSectorLabel(sector))
    .filter(Boolean);

  return orderedSectorLabels.length > 0 ? orderedSectorLabels.join(", ") : "-";
};

export const mapMasterlistRow = (household) => {
  const departureTimeValue = household.latest_attendance?.time_out || null;
  const locationLabel =
    household.residency_status === "NON_RESIDENT"
      ? "Non-Resident (Outside Malvar)"
      : household.barangay?.name;
  const isOperationallyActive = isOperationallyActiveHousehold(household);
  const sectorIds = [
    ...(household.household_sectors || []).map((sector) => sector.id),
    ...(household.members || []).flatMap((member) =>
      (member.sectors || []).map((sector) => sector.id),
    ),
  ].filter(Boolean);
  const sectorCodes = [
    ...(household.household_sectors || []).map((sector) =>
      getCanonicalMemberSectorCode(sector.code),
    ),
    ...(household.members || []).flatMap((member) =>
      (member.sectors || []).map((sector) =>
        getCanonicalMemberSectorCode(sector.code),
      ),
    ),
  ].filter(Boolean);

  return {
    household_id: household.household_id,
    family_head_name: household.family_head_name || "-",
    address:
      household.current_address_details ||
      locationLabel ||
      "-",
    members_count: household.members?.length || 0,
    sectors_text: buildSectorsText(household),
    arrival_time_text: formatDateTime(household.latest_attendance?.time_in),
    departure_time_value: departureTimeValue,
    departure_time_text: formatDateTime(departureTimeValue),
    can_record_departure:
      household.is_active !== false &&
      household.latest_attendance?.status === "PRESENT",
    is_active: household.is_active !== false,
    is_operationally_active: isOperationallyActive,
    sector_ids: [...new Set(sectorIds)],
    sector_codes: [...new Set(sectorCodes)],
  };
};

export const isOperationallyActiveHousehold = (household) => {
  if (!household || household.is_active === false) {
    return false;
  }

  const latestStatus = String(household.latest_attendance?.status || "").toUpperCase();

  if (household.latest_attendance?.time_out) {
    return false;
  }

  if (latestStatus === "LEFT" || latestStatus === "TRANSFERRED") {
    return false;
  }

  return true;
};

export const fetchActiveDisasterEvents = async () => {
  const response = await fetch(`${API_BASE_URL}/api/v1/disaster-events/active`);
  return parseJsonResponse(response, "Failed to fetch active disaster events");
};

export const fetchEndedDisasterEvents = async () => {
  const response = await fetch(`${API_BASE_URL}/api/v1/disaster-events/ended`);
  return parseJsonResponse(response, "Failed to fetch ended disaster events");
};

export const fetchBarangays = async () => {
  const response = await fetch(`${API_BASE_URL}/api/v1/barangays`);
  return parseJsonResponse(response, "Failed to fetch barangays");
};

export const fetchBarangayVisibleSectors = async () => {
  const response = await fetch(`${API_BASE_URL}/api/v1/sectors/barangay`);
  const payload = await parseJsonResponse(
    response,
    "Failed to fetch barangay-visible sectors",
  );

  return Array.isArray(payload.data) ? payload.data : payload;
};

export const fetchMasterlist = async ({
  disasterEventId,
  barangayId,
  recordStatus = "active",
}) => {
  if (!disasterEventId) {
    return {
      disasterEvent: null,
      summary: {
        registeredFamilies: 0,
        totalMembers: 0,
        withAttendance: 0,
      },
      rows: [],
    };
  }

  const searchParams = new URLSearchParams({
    disaster_event_id: disasterEventId,
  });

  if (barangayId) {
    searchParams.set("barangay_id", barangayId);
  }

  const requestedRecordStatus =
    recordStatus === "archived" ? "all" : recordStatus;

  if (requestedRecordStatus) {
    searchParams.set("record_status", requestedRecordStatus);
  }

  const response = await fetch(
    `${API_BASE_URL}/api/v1/masterlist?${searchParams.toString()}`,
  );
  const payload = await parseJsonResponse(response, "Failed to fetch masterlist");

  const households =
    recordStatus === "active"
      ? (payload.data || []).filter(isOperationallyActiveHousehold)
      : recordStatus === "archived"
        ? (payload.data || []).filter(
            (household) => !isOperationallyActiveHousehold(household),
          )
      : payload.data || [];

  const rows = households.map(mapMasterlistRow);
  const totalMembers = households.reduce((total, household) => {
    return total + (household.members?.length || 0);
  }, 0);
  const withAttendance = households.filter(
    (household) => household.latest_attendance,
  ).length;

  return {
    disasterEvent: payload.disaster_event || null,
    summary: {
      registeredFamilies: households.length,
      totalMembers,
      withAttendance,
    },
    rows,
  };
};

export const departHousehold = async ({ householdId, remarks = null }) => {
  const payload = {
    remarks,
    recorded_by: null,
  };

  return performSyncableMutation({
    moduleName: "barangay-masterlist",
    actionKey: "HOUSEHOLD_DEPART",
    entityType: "HOUSEHOLD",
    entityServerId: householdId,
    payload,
    request: async () => {
      const response = await fetch(
        `${API_BASE_URL}/api/v1/households/${householdId}/depart`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
      );

      return parseJsonResponse(
        response,
        "Failed to record household departure",
      );
    },
    buildQueuedResponse: ({ clientSyncId, clientTimestamp }) =>
      buildOfflineQueuedResponse({
        message:
          "Household departure saved offline. Pending sync once connection is restored.",
        data: {
          household_id: householdId,
          latest_departure_time: null,
          status: "PENDING_SYNC",
          client_timestamp: clientTimestamp,
        },
        clientSyncId,
        entityLocalId: householdId,
        clientTimestamp,
      }),
  });
};

export const fetchHouseholdDetails = async (householdId) => {
  const response = await fetch(`${API_BASE_URL}/api/v1/households/${householdId}`);
  const payload = await parseJsonResponse(
    response,
    "Failed to fetch household details",
  );

  return payload.data || null;
};

export const archiveHousehold = async ({ householdId, archiveRemarks = null }) => {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/households/${householdId}/archive`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        archive_remarks: archiveRemarks,
      }),
    },
  );

  return parseJsonResponse(response, "Failed to archive household");
};

export const restoreHousehold = async ({
  householdId,
}) => {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/households/${householdId}/restore`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        restore_mode: "RETURN_TO_EVAC_CENTER",
      }),
    },
  );

  return parseJsonResponse(response, "Failed to record household return");
};

export const correctEvacuationLog = async ({
  householdId,
  evacuationLogId,
  evacuationCenterId,
  status,
  correctionRemarks,
}) => {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/households/${householdId}/evacuation-logs/${evacuationLogId}/correct`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        evacuation_center_id: evacuationCenterId,
        status,
        correction_remarks: correctionRemarks,
      }),
    },
  );

  return parseJsonResponse(response, "Failed to correct evacuation log");
};
