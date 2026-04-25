const pool = require("../config/db");
const disasterEventRepository = require("../repositories/disasterEvent.repository");
const disasterEventExport = require("../utils/disasterEventExport");

const allowedStatuses = ["PLANNED", "ACTIVE", "CLOSED", "ARCHIVED"];
const nonResidentBarangayCode = "NON_RESIDENT_OUTSIDE_MALVAR";
const requiresCompletedEndDate = (status) =>
  status === "CLOSED" || status === "ARCHIVED";

const groupAffectedBarangaysByEventId = (affectedBarangays) => {
  return affectedBarangays.reduce((lookup, row) => {
    if (!lookup[row.disaster_event_id]) {
      lookup[row.disaster_event_id] = [];
    }

    lookup[row.disaster_event_id].push({
      id: row.id,
      code: row.code,
      name: row.name,
    });

    return lookup;
  }, {});
};

const attachAffectedBarangays = async (events) => {
  if (!Array.isArray(events) || events.length === 0) {
    return events;
  }

  const affectedBarangays =
    await disasterEventRepository.getAffectedBarangaysByDisasterEventIds(
      events.map((event) => event.id),
    );
  const affectedBarangaysByEventId =
    groupAffectedBarangaysByEventId(affectedBarangays);

  return events.map((event) => ({
    ...event,
    affected_barangays: affectedBarangaysByEventId[event.id] || [],
  }));
};

const getAllDisasterEvents = async () => {
  const disasterEvents = await disasterEventRepository.getAllDisasterEvents();
  return attachAffectedBarangays(disasterEvents);
};

const getActiveDisasterEvents = async () => {
  const disasterEvents = await disasterEventRepository.getActiveDisasterEvents();
  return attachAffectedBarangays(disasterEvents);
};

const getClosedDisasterEvents = async () => {
  const disasterEvents = await disasterEventRepository.getClosedDisasterEvents();
  return attachAffectedBarangays(disasterEvents);
};

const getDisasterEventsByScope = async (scope) => {
  if (scope === "active") {
    return getActiveDisasterEvents();
  }

  if (scope === "closed") {
    return getClosedDisasterEvents();
  }

  return getAllDisasterEvents();
};

const getDisasterEventById = async (id) => {
  const disasterEvent = await disasterEventRepository.getDisasterEventById(id);

  if (!disasterEvent) {
    return null;
  }

  const affectedBarangays =
    await disasterEventRepository.getAffectedBarangaysByDisasterEventId(id);

  return {
    ...disasterEvent,
    affected_barangays: affectedBarangays,
  };
};

const createDisasterEvent = async (disasterEventData) => {
  if (!allowedStatuses.includes(disasterEventData.status)) {
    const error = new Error("Status must be PLANNED, ACTIVE, CLOSED, or ARCHIVED");
    error.statusCode = 400;
    throw error;
  }

  if (
    disasterEventData.end_date &&
    new Date(disasterEventData.end_date) < new Date(disasterEventData.start_date)
  ) {
    const error = new Error("end_date must not be earlier than start_date");
    error.statusCode = 400;
    throw error;
  }

  if (
    requiresCompletedEndDate(disasterEventData.status) &&
    !disasterEventData.end_date
  ) {
    const error = new Error(
      "end_date is required when status is CLOSED or ARCHIVED",
    );
    error.statusCode = 400;
    throw error;
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const createdDisasterEvent = await disasterEventRepository.insertDisasterEvent(
      disasterEventData,
      client,
    );

    if (disasterEventData.barangay_ids.length > 0) {
      await disasterEventRepository.insertDisasterEventBarangays(
        createdDisasterEvent.id,
        disasterEventData.barangay_ids,
        client,
      );
    }

    await client.query("COMMIT");

    return getDisasterEventById(createdDisasterEvent.id);
  } catch (error) {
    await client.query("ROLLBACK");

    if (error.code === "23505") {
      const duplicateError = new Error("event_code already exists");
      duplicateError.statusCode = 409;
      throw duplicateError;
    }

    throw error;
  } finally {
    client.release();
  }
};

const extendDisasterEvent = async (id, endDate) => {
  const disasterEvent = await disasterEventRepository.getDisasterEventById(id);

  if (!disasterEvent) {
    const error = new Error("Disaster event not found");
    error.statusCode = 404;
    throw error;
  }

  if (disasterEvent.status !== "ACTIVE") {
    const error = new Error("Only active disaster events can be extended");
    error.statusCode = 400;
    throw error;
  }

  const nextEndDate = new Date(endDate);
  const startDate = new Date(disasterEvent.start_date);

  if (nextEndDate < startDate) {
    const error = new Error("end_date must not be earlier than start_date");
    error.statusCode = 400;
    throw error;
  }

  if (disasterEvent.end_date) {
    const currentEndDate = new Date(disasterEvent.end_date);

    if (nextEndDate < currentEndDate) {
      const error = new Error(
        "end_date must not be earlier than the current end_date",
      );
      error.statusCode = 400;
      throw error;
    }
  }

  await disasterEventRepository.updateDisasterEventById(id, {
    end_date: endDate,
  });

  return getDisasterEventById(id);
};

const endDisasterEvent = async (id) => {
  const disasterEvent = await disasterEventRepository.getDisasterEventById(id);

  if (!disasterEvent) {
    const error = new Error("Disaster event not found");
    error.statusCode = 404;
    throw error;
  }

  if (disasterEvent.status !== "ACTIVE") {
    const error = new Error("Only active disaster events can be ended");
    error.statusCode = 400;
    throw error;
  }

  const today = new Date().toISOString().slice(0, 10);
  const endedAt = new Date().toISOString();
  const startDate = new Date(disasterEvent.start_date).toISOString().slice(0, 10);

  if (today < startDate) {
    const error = new Error(
      "Disaster event cannot be completed before its start date",
    );
    error.statusCode = 400;
    throw error;
  }

  await disasterEventRepository.updateDisasterEventById(id, {
    end_date: today,
    ended_at: endedAt,
    status: "CLOSED",
  });

  return getDisasterEventById(id);
};

const isValidAffectedBarangay = (barangay) => {
  return barangay && barangay.code !== nonResidentBarangayCode;
};

const formatDisasterEventStatusLabel = (status) => {
  const normalizedStatus = String(status || "").toUpperCase();

  if (normalizedStatus === "CLOSED" || normalizedStatus === "ARCHIVED") {
    return "COMPLETED";
  }

  return normalizedStatus || "UNKNOWN";
};

const formatAffectedBarangays = (affectedBarangays, validBarangayCount) => {
  const validAffectedBarangays = (affectedBarangays || []).filter(
    isValidAffectedBarangay,
  );
  const uniqueAffectedBarangayIds = new Set(
    validAffectedBarangays.map(
      (barangay) => barangay.id || barangay.name || barangay,
    ),
  );

  if (
    validBarangayCount > 0 &&
    uniqueAffectedBarangayIds.size === validBarangayCount
  ) {
    return "All Barangays";
  }

  if (validAffectedBarangays.length === 0) {
    return "--";
  }

  return validAffectedBarangays
    .map((barangay) => barangay.name || barangay)
    .join(", ");
};

const matchesDisasterEventSearch = (event, search) => {
  if (!search || !search.trim()) {
    return true;
  }

  const normalizedSearch = search.trim().toLowerCase();
  const searchableValues = [
    event.title,
    event.disaster_type,
    ...(event.affected_barangays || []).map((barangay) => barangay.name),
  ];

  return searchableValues.some((value) =>
    String(value || "").toLowerCase().includes(normalizedSearch),
  );
};

const matchesDisasterEventFilters = ({
  event,
  disasterType,
  affectedBarangayId,
}) => {
  const matchesDisasterType =
    !disasterType || event.disaster_type === disasterType;
  const matchesAffectedBarangay =
    !affectedBarangayId ||
    (event.affected_barangays || []).some(
      (barangay) => barangay.id === affectedBarangayId,
    );

  return matchesDisasterType && matchesAffectedBarangay;
};

const exportDisasterEvents = async ({
  scope,
  format,
  search,
  disaster_type,
  affected_barangay_id,
}) => {
  const events = await getDisasterEventsByScope(scope);
  const validBarangayCount = await disasterEventRepository.getValidBarangayCount();
  const disasterType = String(disaster_type || "").trim();
  const affectedBarangayId = String(affected_barangay_id || "").trim();
  const exportRows = events
    .filter((event) => matchesDisasterEventSearch(event, search))
    .filter((event) =>
      matchesDisasterEventFilters({
        event,
        disasterType,
        affectedBarangayId,
      }),
    )
    .map((event) => ({
      name: event.title || "--",
      disaster_type: event.disaster_type || "--",
      affected_barangays: formatAffectedBarangays(
        event.affected_barangays,
        validBarangayCount,
      ),
      start_date: disasterEventExport.formatDate(event.start_date),
      end_date: disasterEventExport.formatDate(event.end_date),
      status: formatDisasterEventStatusLabel(event.status),
    }));

  return disasterEventExport.buildExportFile({
    rows: exportRows,
    scope,
    search,
    format,
  });
};

module.exports = {
  getAllDisasterEvents,
  getActiveDisasterEvents,
  getClosedDisasterEvents,
  getDisasterEventById,
  createDisasterEvent,
  extendDisasterEvent,
  endDisasterEvent,
  exportDisasterEvents,
};
