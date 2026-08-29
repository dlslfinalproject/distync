const formatDateTime = (value) => {
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
    masterlist_record_id: entry.id || entry.entityLocalId || `local-${entry.clientTimestamp}`,
    family_head_name: familyHeadName || "Pending household",
    address: currentAddress,
    members_count: Array.isArray(entry.payload?.members)
      ? entry.payload.members.length
      : 0,
    sectors_text: "-",
    arrival_time_text: formatDateTime(entry.clientTimestamp),
    departure_time_value: departureTimestamp,
    departure_time_text: departureTimestamp ? formatDateTime(departureTimestamp) : "-",
    registered_at: entry.clientTimestamp,
    can_record_departure: false,
    is_local_only: true,
    sync_status: entry.status,
    sync_entry_id: entry.id,
    is_active: entry.actionKey !== "HOUSEHOLD_DEPART",
    is_operationally_active: entry.actionKey !== "HOUSEHOLD_DEPART",
  };
};

const HOUSEHOLD_LIFECYCLE_ACTIONS = new Set([
  "HOUSEHOLD_REGISTER",
  "HOUSEHOLD_UPDATE",
  "HOUSEHOLD_RE_ADMISSION",
  "HOUSEHOLD_DEPART",
]);

const getEntryTimestamp = (entry) => {
  const value = entry?.clientTimestamp || entry?.updatedAt || entry?.createdAt;
  const timestamp = value ? new Date(value).getTime() : 0;
  return Number.isNaN(timestamp) ? 0 : timestamp;
};

const getEntryIdentityValues = (entry) =>
  [entry?.entityServerId, entry?.entityLocalId].filter(Boolean).map(String);

const getRowIdentityValues = (row) =>
  [row?.household_id, row?.masterlist_record_id].filter(Boolean).map(String);

const isEntryForRow = (entry, row) => {
  const rowIds = new Set(getRowIdentityValues(row));
  return getEntryIdentityValues(entry).some((id) => rowIds.has(id));
};

export const getLatestHouseholdLifecycleEntry = (syncEntries = [], row = null) =>
  syncEntries
    .filter(
      (entry) =>
        HOUSEHOLD_LIFECYCLE_ACTIONS.has(entry?.actionKey) &&
        entry?.entityType === "HOUSEHOLD" &&
        isEntryForRow(entry, row),
    )
    .sort((left, right) => getEntryTimestamp(right) - getEntryTimestamp(left))[0] || null;

const isActiveLifecycleAction = (actionKey, row) => {
  if (actionKey === "HOUSEHOLD_DEPART") {
    return false;
  }

  if (
    ["HOUSEHOLD_REGISTER", "HOUSEHOLD_RE_ADMISSION", "HOUSEHOLD_UPDATE"].includes(
      actionKey,
    )
  ) {
    return true;
  }

  return row?.is_active !== false && row?.is_operationally_active !== false;
};

const isReconciledDuplicate = (entry) =>
  entry?.resolutionStatus === "DUPLICATE_HOUSEHOLD";

const applyLifecycleOverlay = (row, lifecycleEntry) => {
  if (!lifecycleEntry) {
    return row;
  }

  const isActive = isActiveLifecycleAction(lifecycleEntry.actionKey, row);

  return {
    ...row,
    sync_status: lifecycleEntry.status || row.sync_status,
    is_active: isActive,
    is_operationally_active: isActive,
    can_record_departure: isActive && row.can_record_departure,
    ...(isActive
      ? {}
      : {
          departure_time_value: lifecycleEntry.clientTimestamp || row.departure_time_value,
          departure_time_text: formatDateTime(
            lifecycleEntry.clientTimestamp || row.departure_time_value,
          ),
        }),
  };
};

const matchesRecordStatus = (row, recordStatus) => {
  if (recordStatus === "archived") {
    return row.is_operationally_active === false;
  }

  if (recordStatus === "all") {
    return true;
  }

  return row.is_operationally_active !== false;
};

export const resolveEffectiveMasterlistRows = ({
  rows = [],
  syncQueueEntries = [],
  recordStatus = "active",
  assignedBarangayName = "",
  selectedEventId = "",
  assignedBarangayId = "",
} = {}) => {
  const scopedEntries = syncQueueEntries.filter((entry) => {
    const payload = entry?.payload || {};
    return (
      HOUSEHOLD_LIFECYCLE_ACTIONS.has(entry?.actionKey) &&
      entry?.entityType === "HOUSEHOLD" &&
      !isReconciledDuplicate(entry) &&
      (!selectedEventId || payload.disaster_event_id === selectedEventId) &&
      (!assignedBarangayId || payload.barangay_id === assignedBarangayId)
    );
  });

  const resolvedRows = rows.map((row) =>
    applyLifecycleOverlay(
      row,
      getLatestHouseholdLifecycleEntry(scopedEntries, row),
    ),
  );
  const representedIds = new Set(
    resolvedRows.flatMap((row) => getRowIdentityValues(row)),
  );

  scopedEntries
    .filter((entry) => ["HOUSEHOLD_REGISTER", "HOUSEHOLD_RE_ADMISSION", "HOUSEHOLD_DEPART"].includes(entry.actionKey) && !isReconciledDuplicate(entry))
    .sort((left, right) => getEntryTimestamp(right) - getEntryTimestamp(left))
    .forEach((entry) => {
      const localId = entry.entityLocalId || entry.entityServerId || entry.id;

      if (!localId || representedIds.has(String(localId))) {
        return;
      }

      const queuedRow = buildQueuedHouseholdRow(entry, assignedBarangayName);
      if (matchesRecordStatus(queuedRow, recordStatus)) {
        resolvedRows.push(queuedRow);
        representedIds.add(String(localId));
      }
    });

  return resolvedRows.filter((row) => matchesRecordStatus(row, recordStatus));
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
