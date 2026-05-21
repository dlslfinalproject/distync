import {
  buildOfflineQueuedResponse,
  performSyncableMutation,
} from "../../offline/syncService";

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
  const householdSectorNames = (household.household_sectors || []).map(
    (sector) => sector.name,
  );
  const memberSectorNames = (household.members || []).flatMap((member) =>
    (member.sectors || []).map((sector) => sector.name),
  );

  const uniqueSectorNames = [
    ...new Set([...householdSectorNames, ...memberSectorNames]),
  ];

  return uniqueSectorNames.length > 0 ? uniqueSectorNames.join(", ") : "-";
};

export const mapMasterlistRow = (household) => {
  const departureTimeValue = household.latest_attendance?.time_out || null;
  const locationLabel =
    household.residency_status === "NON_RESIDENT"
      ? "Non-Resident (Outside Malvar)"
      : household.barangay?.name;

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
    can_record_departure: household.latest_attendance?.status === "PRESENT",
  };
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

export const fetchMasterlist = async ({ disasterEventId, barangayId }) => {
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

  const response = await fetch(
    `${API_BASE_URL}/api/v1/masterlist?${searchParams.toString()}`,
  );
  const payload = await parseJsonResponse(response, "Failed to fetch masterlist");

  const rows = (payload.data || []).map(mapMasterlistRow);
  const totalMembers = (payload.data || []).reduce((total, household) => {
    return total + (household.members?.length || 0);
  }, 0);
  const withAttendance = (payload.data || []).filter(
    (household) => household.latest_attendance,
  ).length;

  return {
    disasterEvent: payload.disaster_event || null,
    summary: {
      registeredFamilies: payload.count || 0,
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
