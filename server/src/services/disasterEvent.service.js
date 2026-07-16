const pool = require("../config/db");
const disasterEventRepository = require("../repositories/disasterEvent.repository");
const householdRegistrationRepository = require("../repositories/householdRegistration.repository");
const settingsRepository = require("../repositories/settings.repository");
const disasterEventExport = require("../utils/disasterEventExport");
const notificationService = require("../modules/notifications/notification.service");
const mswdoReportExport = require("../utils/mswdoReportExport");

const allowedStatuses = ["PLANNED", "ACTIVE", "CLOSED", "ARCHIVED"];
const nonResidentBarangayCode = "NON_RESIDENT_OUTSIDE_MALVAR";
const PH_TIME_ZONE = "Asia/Manila";
const DISASTER_EVENT_TYPE_OPTIONS = [
  "Typhoon",
  "Flood",
  "Earthquake",
  "Landslide",
  "Volcanic Eruption",
  "Storm Surge",
  "Drought / El Niño",
  "Tsunami",
  "Fire",
];
const requiresCompletedEndDate = (status) =>
  status === "CLOSED" || status === "ARCHIVED";

const getManilaDateParts = (value = new Date()) => {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: PH_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(value);

  return {
    year: Number(parts.find((part) => part.type === "year")?.value || 0),
    month: Number(parts.find((part) => part.type === "month")?.value || 0),
    day: Number(parts.find((part) => part.type === "day")?.value || 0),
  };
};

const getCurrentManilaDateString = () => {
  const { year, month, day } = getManilaDateParts();
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
};

const normalizeDateOnlyString = (value) => {
  if (!value) {
    return "";
  }

  if (typeof value === "string") {
    const trimmedValue = value.trim();
    const isoDateMatch = trimmedValue.match(/^(\d{4}-\d{2}-\d{2})/);

    if (isoDateMatch) {
      return isoDateMatch[1];
    }

    const parsedValue = new Date(trimmedValue);

    if (!Number.isNaN(parsedValue.getTime())) {
      return `${parsedValue.getUTCFullYear()}-${String(
        parsedValue.getUTCMonth() + 1,
      ).padStart(2, "0")}-${String(parsedValue.getUTCDate()).padStart(2, "0")}`;
    }

    return "";
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const { year, month, day } = getManilaDateParts(value);
    return `${String(year).padStart(4, "0")}-${String(month).padStart(
      2,
      "0",
    )}-${String(day).padStart(2, "0")}`;
  }

  return "";
};

const buildScheduledClosureTimestamp = (endDate) => {
  const normalizedEndDate = normalizeDateOnlyString(endDate);
  const [year, month, day] = String(normalizedEndDate || "")
    .split("-")
    .map((value) => Number(value));

  if (!year || !month || !day) {
    return null;
  }

  return new Date(
    Date.UTC(year, month - 1, day, 23, 59, 59, 999) - 8 * 60 * 60 * 1000,
  ).toISOString();
};

const formatIsoDateOnly = (value) => normalizeDateOnlyString(value);

const closeDisasterEventWithTimestamp = async ({
  disasterEvent,
  closureDate,
  closureTimestamp,
  eventAction = "ended",
}) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await disasterEventRepository.updateDisasterEventById(
      disasterEvent.id,
      {
        end_date: closureDate,
        ended_at: closureTimestamp,
        status: "CLOSED",
      },
      client,
    );

    const updatedLogs =
      await householdRegistrationRepository.markDisasterEventHouseholdDepartures(
        disasterEvent.id,
        closureTimestamp,
        "Automatic departure recorded during disaster event closure",
        client,
      );

    const affectedHouseholdIds = [...new Set(
      updatedLogs.map((log) => log.household_id).filter(Boolean),
    )];

    if (affectedHouseholdIds.length > 0) {
      await householdRegistrationRepository.archiveHouseholdsByIds(
        affectedHouseholdIds,
        client,
      );
      await householdRegistrationRepository.deactivateEvacueesByHouseholdIds(
        affectedHouseholdIds,
        client,
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  const updatedDisasterEventRow =
    await disasterEventRepository.getDisasterEventById(disasterEvent.id);
  const affectedBarangays =
    await disasterEventRepository.getAffectedBarangaysByDisasterEventId(
      disasterEvent.id,
    );
  const updatedDisasterEvent = updatedDisasterEventRow
    ? {
        ...updatedDisasterEventRow,
        affected_barangays: affectedBarangays,
      }
    : null;

  await notificationService.emitSafely(() =>
    notificationService.emitDisasterEventUpdate({
      disasterEvent: updatedDisasterEvent,
      action: eventAction,
      affectedBarangays: updatedDisasterEvent?.affected_barangays || [],
    }),
  );

  return updatedDisasterEvent;
};

const syncOverdueActiveDisasterEvents = async () => {
  const currentManilaDate = getCurrentManilaDateString();
  const activeDisasterEvents = await disasterEventRepository.getActiveDisasterEvents();
  const overdueEvents = activeDisasterEvents.filter(
    (event) =>
      event?.status === "ACTIVE" &&
      normalizeDateOnlyString(event?.end_date) &&
      normalizeDateOnlyString(event.end_date) < currentManilaDate,
  );

  for (const disasterEvent of overdueEvents) {
    const scheduledClosureTimestamp = buildScheduledClosureTimestamp(
      disasterEvent.end_date,
    );

    if (!scheduledClosureTimestamp) {
      continue;
    }

    try {
      await closeDisasterEventWithTimestamp({
        disasterEvent,
        closureDate: normalizeDateOnlyString(disasterEvent.end_date),
        closureTimestamp: scheduledClosureTimestamp,
        eventAction: "ended",
      });
    } catch (error) {
      throw error;
    }
  }
};

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
  await syncOverdueActiveDisasterEvents();
  const disasterEvents = await disasterEventRepository.getAllDisasterEvents();
  return attachAffectedBarangays(disasterEvents);
};

const getActiveDisasterEvents = async () => {
  await syncOverdueActiveDisasterEvents();
  const disasterEvents = await disasterEventRepository.getActiveDisasterEvents();
  return attachAffectedBarangays(disasterEvents);
};

const getClosedDisasterEvents = async () => {
  await syncOverdueActiveDisasterEvents();
  const disasterEvents = await disasterEventRepository.getClosedDisasterEvents();
  return attachAffectedBarangays(disasterEvents);
};

const getDisasterEventsByBarangayId = async (barangayId) => {
  if (!barangayId) {
    const error = new Error("Assigned barangay is required");
    error.statusCode = 403;
    throw error;
  }

  await syncOverdueActiveDisasterEvents();
  const disasterEvents =
    await disasterEventRepository.getDisasterEventsByBarangayId(barangayId);
  return attachAffectedBarangays(disasterEvents);
};

const getDisasterEventsForBarangayRequester = async (requester) => {
  let barangayId = requester?.defaultBarangayId || null;

  if (!barangayId && requester?.userId) {
    const user = await settingsRepository.getUserById(requester.userId);
    barangayId = user?.default_barangay_id || null;
  }

  return getDisasterEventsByBarangayId(barangayId);
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
  await syncOverdueActiveDisasterEvents();
  const disasterEvent = await disasterEventRepository.getDisasterEventById(id);

  if (!disasterEvent) {
    return null;
  }

  const affectedBarangays =
    await disasterEventRepository.getAffectedBarangaysByDisasterEventId(id);
  const latestHouseholdActivityAt =
    await disasterEventRepository.getLatestHouseholdActivityByDisasterEventId(id);
  const householdCounts =
    await disasterEventRepository.getHouseholdCountsByDisasterEventBarangayIds(
      id,
      affectedBarangays.map((barangay) => barangay.id),
    );
  const householdCountByBarangayId = householdCounts.reduce((lookup, row) => {
    lookup[row.barangay_id] = Number(row.household_count || 0);
    return lookup;
  }, {});

  return {
    ...disasterEvent,
    affected_barangays: affectedBarangays.map((barangay) => ({
      ...barangay,
      registered_households_count: householdCountByBarangayId[barangay.id] || 0,
      has_registered_records:
        Number(householdCountByBarangayId[barangay.id] || 0) > 0,
    })),
    latest_household_activity_at: latestHouseholdActivityAt,
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

    const disasterEvent = await getDisasterEventById(createdDisasterEvent.id);

    await notificationService.emitSafely(() =>
      notificationService.emitDisasterEventUpdate({
        disasterEvent,
        action: "created",
        affectedBarangays: disasterEvent.affected_barangays,
      }),
    );

    return disasterEvent;
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

const updateDisasterEvent = async (id, disasterEventData) => {
  await syncOverdueActiveDisasterEvents();
  const existingDisasterEvent = await disasterEventRepository.getDisasterEventById(
    id,
  );

  if (!existingDisasterEvent) {
    const error = new Error("Disaster event not found");
    error.statusCode = 404;
    throw error;
  }

  if (existingDisasterEvent.status !== "ACTIVE") {
    const error = new Error("Only active disaster events can be edited");
    error.statusCode = 400;
    throw error;
  }

  const startDate = new Date(disasterEventData.start_date);
  const endDate = new Date(disasterEventData.end_date);

  if (endDate < startDate) {
    const error = new Error("end_date must not be earlier than start_date");
    error.statusCode = 400;
    throw error;
  }

  const latestHouseholdActivityAt =
    await disasterEventRepository.getLatestHouseholdActivityByDisasterEventId(id);
  const latestHouseholdActivityDate = formatIsoDateOnly(latestHouseholdActivityAt);
  const requestedEndDate = formatIsoDateOnly(disasterEventData.end_date);

  if (
    latestHouseholdActivityDate &&
    requestedEndDate &&
    requestedEndDate < latestHouseholdActivityDate
  ) {
    const error = new Error(
      `end_date cannot be earlier than the latest recorded household activity (${latestHouseholdActivityDate})`,
    );
    error.statusCode = 400;
    throw error;
  }

  const currentAffectedBarangays =
    await disasterEventRepository.getAffectedBarangaysByDisasterEventId(id);
  const requestedBarangayIdSet = new Set(disasterEventData.barangay_ids || []);
  const removedBarangayIds = currentAffectedBarangays
    .map((barangay) => barangay.id)
    .filter((barangayId) => !requestedBarangayIdSet.has(barangayId));

  if (removedBarangayIds.length > 0) {
    const householdCounts =
      await disasterEventRepository.getHouseholdCountsByDisasterEventBarangayIds(
        id,
        removedBarangayIds,
      );
    const lockedBarangayIds = new Set(
      householdCounts
        .filter((row) => Number(row.household_count || 0) > 0)
        .map((row) => row.barangay_id),
    );

    if (lockedBarangayIds.size > 0) {
      const lockedBarangayNames = currentAffectedBarangays
        .filter((barangay) => lockedBarangayIds.has(barangay.id))
        .map((barangay) => barangay.name)
        .join(", ");
      const error = new Error(
        lockedBarangayNames
          ? `Affected barangays with registered records cannot be removed: ${lockedBarangayNames}`
          : "Affected barangays with registered records cannot be removed.",
      );
      error.statusCode = 400;
      throw error;
    }
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await disasterEventRepository.updateDisasterEventById(
      id,
      {
        title: disasterEventData.title,
        disaster_type: disasterEventData.disaster_type,
        description: disasterEventData.description ?? null,
        start_date: disasterEventData.start_date,
        end_date: disasterEventData.end_date,
      },
      client,
    );

    await disasterEventRepository.deleteDisasterEventBarangaysByDisasterEventId(
      id,
      client,
    );

    if (disasterEventData.barangay_ids.length > 0) {
      await disasterEventRepository.insertDisasterEventBarangays(
        id,
        disasterEventData.barangay_ids,
        client,
      );
    }

    await client.query("COMMIT");
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

  const updatedDisasterEvent = await getDisasterEventById(id);

  await notificationService.emitSafely(() =>
    notificationService.emitDisasterEventUpdate({
      disasterEvent: updatedDisasterEvent,
      action: "updated",
      affectedBarangays: updatedDisasterEvent.affected_barangays,
    }),
  );

  return updatedDisasterEvent;
};

const extendDisasterEvent = async (id, endDate) => {
  await syncOverdueActiveDisasterEvents();
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

  const updatedDisasterEvent = await getDisasterEventById(id);

  await notificationService.emitSafely(() =>
    notificationService.emitDisasterEventUpdate({
      disasterEvent: updatedDisasterEvent,
      action: "extended",
      affectedBarangays: updatedDisasterEvent.affected_barangays,
    }),
  );

  return updatedDisasterEvent;
};

const endDisasterEvent = async (id) => {
  await syncOverdueActiveDisasterEvents();
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

  const today = getCurrentManilaDateString();
  const endedAt = new Date().toISOString();
  const startDate = String(disasterEvent.start_date || "");

  if (today < startDate) {
    const error = new Error(
      "Disaster event cannot be completed before its start date",
    );
    error.statusCode = 400;
    throw error;
  }

  return closeDisasterEventWithTimestamp({
    disasterEvent,
    closureDate: today,
    closureTimestamp: endedAt,
    eventAction: "ended",
  });
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

const formatAffectedBarangays = (affectedBarangays) => {
  const validAffectedBarangays = (affectedBarangays || []).filter(
    isValidAffectedBarangay,
  );

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
  disasterTypes,
  affectedBarangayIds,
}) => {
  const normalizedDisasterType = String(event?.disaster_type || "").trim();
  const isCustomDisasterType =
    normalizedDisasterType &&
    !DISASTER_EVENT_TYPE_OPTIONS.includes(normalizedDisasterType);
  const matchesDisasterType =
    !Array.isArray(disasterTypes) ||
    disasterTypes.length === 0 ||
    disasterTypes.some((disasterType) => {
      if (disasterType === "Other") {
        return isCustomDisasterType;
      }

      return normalizedDisasterType === disasterType;
    });
  const matchesAffectedBarangay =
    !Array.isArray(affectedBarangayIds) ||
    affectedBarangayIds.length === 0 ||
    (event.affected_barangays || []).some(
      (barangay) => affectedBarangayIds.includes(barangay.id),
    );

  return matchesDisasterType && matchesAffectedBarangay;
};

const sortDisasterEventsForExport = (events, sortOrder = "newest") => {
  const safeEvents = Array.isArray(events) ? [...events] : [];

  return safeEvents.sort((leftEvent, rightEvent) => {
    if (sortOrder === "oldest" || sortOrder === "newest") {
      const leftTime = new Date(
        leftEvent?.start_date || leftEvent?.created_at || leftEvent?.updated_at || 0,
      ).getTime();
      const rightTime = new Date(
        rightEvent?.start_date || rightEvent?.created_at || rightEvent?.updated_at || 0,
      ).getTime();

      if (leftTime !== rightTime) {
        return sortOrder === "oldest" ? leftTime - rightTime : rightTime - leftTime;
      }
    }

    const leftTitle = String(leftEvent?.title || "").trim().toUpperCase();
    const rightTitle = String(rightEvent?.title || "").trim().toUpperCase();

    if (leftTitle !== rightTitle) {
      if (sortOrder === "za") {
        return rightTitle.localeCompare(leftTitle);
      }

      return leftTitle.localeCompare(rightTitle);
    }

    const leftTime = new Date(
      leftEvent?.start_date || leftEvent?.created_at || leftEvent?.updated_at || 0,
    ).getTime();
    const rightTime = new Date(
      rightEvent?.start_date || rightEvent?.created_at || rightEvent?.updated_at || 0,
    ).getTime();
    return rightTime - leftTime;
  });
};

const exportDisasterEvents = async ({
  scope,
  format,
  search,
  disaster_event_id,
  sort_order,
  disaster_types,
  affected_barangay_ids,
}) => {
  const events = disaster_event_id
    ? [await getDisasterEventById(disaster_event_id)].filter(Boolean)
    : await getDisasterEventsByScope(scope);
  const disasterTypes = Array.isArray(disaster_types) ? disaster_types : [];
  const affectedBarangayIds = Array.isArray(affected_barangay_ids)
    ? affected_barangay_ids
    : [];
  const exportRows = sortDisasterEventsForExport(
    events
      .filter((event) => matchesDisasterEventSearch(event, search))
      .filter((event) =>
        matchesDisasterEventFilters({
          event,
          disasterTypes,
          affectedBarangayIds,
        }),
      )
    ,
    sort_order,
  ).map((event) => ({
    name: event.title || "--",
    disaster_type: event.disaster_type || "--",
    affected_barangays: formatAffectedBarangays(event.affected_barangays),
    start_date: disasterEventExport.formatDate(event.start_date),
    end_date: disasterEventExport.formatDate(event.end_date),
    status: formatDisasterEventStatusLabel(event.status),
  }));

  return disasterEventExport.buildExportFile({
    rows: exportRows,
    scope,
    search,
    eventLabel: disaster_event_id
      ? String(events[0]?.title || "").trim()
      : "",
    format,
  });
};

const getDisasterEventReportSummary = async (filters) => {
  await syncOverdueActiveDisasterEvents();

  if (filters.disaster_event_id) {
    return disasterEventRepository.getDisasterEventReportBarangayBreakdown({
      disasterEventId: filters.disaster_event_id,
      barangayId: filters.barangay_id || null,
      status: filters.status || null,
      dateFrom: filters.date_from || null,
      dateTo: filters.date_to || null,
      sortOrder: filters.sort_order || "newest",
      limit: filters.limit || 100,
    });
  }

  return disasterEventRepository.getDisasterEventReportSummary({
    disasterEventId: filters.disaster_event_id || null,
    barangayId: filters.barangay_id || null,
    status: filters.status || null,
    dateFrom: filters.date_from || null,
    dateTo: filters.date_to || null,
    sortOrder: filters.sort_order || "newest",
    limit: filters.limit || 100,
  });
};

const exportDisasterEventReportSummary = async (filters) => {
  await syncOverdueActiveDisasterEvents();
  const rows = await disasterEventRepository.getDisasterEventReportBarangayBreakdown({
    disasterEventId: filters.disaster_event_id || null,
    status: filters.status || null,
    dateFrom: filters.date_from || null,
    dateTo: filters.date_to || null,
    sortOrder: filters.sort_order || "newest",
    limit: 5000,
  });
  const selectedDisasterEventLabel =
    filters.disaster_event_id && rows[0]?.title
      ? rows[0].title
      : "All disaster events";

  return mswdoReportExport.buildExportFile({
    filePrefix: "mswdo-disaster-event-barangay-distribution",
    worksheetName: "Disaster Summary",
    reportTitle: "MSWDO Disaster Events Barangay Distribution",
    metadata: [
      {
        label: "Disaster Event",
        value: selectedDisasterEventLabel,
      },
      {
        label: "Order List",
        value: filters.sort_order || "newest",
      },
    ],
    columns: [
      { key: "event_label", label: "Disaster Event", width: 30, pdfWidth: 90 },
      { key: "barangay_name", label: "Barangay", width: 22, pdfWidth: 65 },
      { key: "status", label: "Status", width: 14, pdfWidth: 42 },
      { key: "disaster_type", label: "Type", width: 20, pdfWidth: 55 },
      { key: "registered_households_count", label: "Registered Households", width: 18, pdfWidth: 55 },
      { key: "distributed_aid_count", label: "Distributed Aid Count", width: 18, pdfWidth: 55 },
      { key: "claim_summary", label: "Claim Status Summary", width: 24, pdfWidth: 80 },
      { key: "quantity_released_total", label: "Quantity Released", width: 18, pdfWidth: 55 },
    ],
    rows: rows.map((row) => ({
      event_label: row.title || "--",
      barangay_name: row.barangay_name || "--",
      status: formatDisasterEventStatusLabel(row.status),
      disaster_type: row.disaster_type || "--",
      registered_households_count: row.registered_households_count || 0,
      distributed_aid_count: row.distributed_aid_count || 0,
      claim_summary: `Claimed: ${row.claimed_stubs_count || 0} | Unclaimed: ${row.unclaimed_stubs_count || 0}`,
      quantity_released_total: row.quantity_released_total || 0,
    })),
    format: filters.format,
  });
};

module.exports = {
  getAllDisasterEvents,
  getActiveDisasterEvents,
  getClosedDisasterEvents,
  getDisasterEventsByBarangayId,
  getDisasterEventsForBarangayRequester,
  getDisasterEventById,
  createDisasterEvent,
  updateDisasterEvent,
  extendDisasterEvent,
  endDisasterEvent,
  exportDisasterEvents,
  getDisasterEventReportSummary,
  exportDisasterEventReportSummary,
  syncOverdueActiveDisasterEvents,
};
