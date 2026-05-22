import { formatDateTime } from "./masterlistService";

export const getSectorNames = (sectorsText) => {
  if (!sectorsText || sectorsText === "-") {
    return [];
  }

  return String(sectorsText)
    .split(",")
    .map((sectorName) => sectorName.trim())
    .filter(Boolean);
};

export const getFilteredRows = (rows, searchTerm) => {
  if (!searchTerm.trim()) return rows;
  const normalizedSearchTerm = searchTerm.trim().toLowerCase();

  return rows.filter((row) => {
    const searchableValues = [
      row.family_head_name,
      row.address,
      row.sectors_text,
      row.attendance_status_text,
      row.arrival_time_text,
      row.departure_time_text,
    ];
    return searchableValues.some((value) =>
      String(value).toLowerCase().includes(normalizedSearchTerm),
    );
  });
};

const buildFamilyHeadName = (familyHead = {}) => {
  return [
    familyHead.first_name,
    familyHead.middle_name,
    familyHead.last_name,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();
};

export const buildQueuedHouseholdRow = (entry, assignedBarangayName) => {
  const familyHeadName = buildFamilyHeadName(entry.payload?.family_head);
  const currentAddress =
    entry.payload?.current_address_details ||
    assignedBarangayName ||
    "Pending local address";
  const departureTimestamp =
    entry.actionKey === "HOUSEHOLD_DEPART" ? entry.clientTimestamp : null;

  return {
    household_id: entry.entityLocalId || entry.id,
    family_head_name: familyHeadName || "Pending household",
    address: currentAddress,
    members_count: Array.isArray(entry.payload?.members)
      ? entry.payload.members.length
      : 0,
    sectors_text: "-",
    arrival_time_text: formatDateTime(entry.clientTimestamp),
    departure_time_value: departureTimestamp,
    departure_time_text: departureTimestamp ? formatDateTime(departureTimestamp) : "-",
    can_record_departure: false,
    is_local_only: true,
    sync_status: entry.status,
    sync_entry_id: entry.id,
  };
};

export const isEndedDisasterEvent = (event, eventScope) => {
  const status = String(event?.status || "").toUpperCase();
  return eventScope === "ended" || status === "CLOSED" || status === "ARCHIVED";
};

export const formatEventEndedDateTime = (value) => {
  if (!value) {
    return "-";
  }

  const normalizedValue = String(value).trim();
  const isDateOnlyValue = /^\d{4}-\d{2}-\d{2}$/.test(normalizedValue);
  const parsedDate = new Date(
    isDateOnlyValue ? `${normalizedValue}T00:00:00` : normalizedValue,
  );

  if (Number.isNaN(parsedDate.getTime())) {
    return "-";
  }

  if (isDateOnlyValue) {
    return new Intl.DateTimeFormat("en-PH", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(parsedDate);
  }

  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsedDate);
};
