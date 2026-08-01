const DISASTER_EVENT_REPORT_SELECTIONS = {
  ALL: "ALL",
  ACTIVE: "ACTIVE",
  ENDED: "ENDED",
  EVENT_PREFIX: "EVENT:",
};

const ACTIVE_DISASTER_EVENT_STATUSES = ["ACTIVE"];
const ENDED_DISASTER_EVENT_STATUSES = ["CLOSED", "ARCHIVED"];
const disasterEventUuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const normalizeDisasterEventReportSelection = ({
  eventSelection,
  disasterEventId,
} = {}) => {
  const normalizedEventSelection = String(eventSelection || "").trim();
  const normalizedDisasterEventId = String(disasterEventId || "").trim();

  if (normalizedEventSelection) {
    return normalizedEventSelection.toUpperCase().startsWith(
      DISASTER_EVENT_REPORT_SELECTIONS.EVENT_PREFIX,
    )
      ? `${DISASTER_EVENT_REPORT_SELECTIONS.EVENT_PREFIX}${normalizedEventSelection.slice(
          DISASTER_EVENT_REPORT_SELECTIONS.EVENT_PREFIX.length,
        )}`
      : normalizedEventSelection.toUpperCase();
  }

  if (normalizedDisasterEventId) {
    return `${DISASTER_EVENT_REPORT_SELECTIONS.EVENT_PREFIX}${normalizedDisasterEventId}`;
  }

  return DISASTER_EVENT_REPORT_SELECTIONS.ALL;
};

const isValidDisasterEventReportSelection = (selectionValue) => {
  const normalizedSelection = normalizeDisasterEventReportSelection({
    eventSelection: selectionValue,
  });

  if (
    normalizedSelection === DISASTER_EVENT_REPORT_SELECTIONS.ALL ||
    normalizedSelection === DISASTER_EVENT_REPORT_SELECTIONS.ACTIVE ||
    normalizedSelection === DISASTER_EVENT_REPORT_SELECTIONS.ENDED
  ) {
    return true;
  }

  if (
    normalizedSelection.startsWith(DISASTER_EVENT_REPORT_SELECTIONS.EVENT_PREFIX)
  ) {
    return disasterEventUuidPattern.test(
      normalizedSelection.slice(
        DISASTER_EVENT_REPORT_SELECTIONS.EVENT_PREFIX.length,
      ),
    );
  }

  return false;
};

const resolveDisasterEventReportSelection = ({
  eventSelection,
  disasterEventId,
} = {}) => {
  const selection = normalizeDisasterEventReportSelection({
    eventSelection,
    disasterEventId,
  });

  if (selection === DISASTER_EVENT_REPORT_SELECTIONS.ACTIVE) {
    return {
      selection,
      disasterEventId: null,
      statuses: ACTIVE_DISASTER_EVENT_STATUSES,
      selectionLabel: "Active disaster events",
      emptyMessage: "No active disaster events are available for this report.",
    };
  }

  if (selection === DISASTER_EVENT_REPORT_SELECTIONS.ENDED) {
    return {
      selection,
      disasterEventId: null,
      statuses: ENDED_DISASTER_EVENT_STATUSES,
      selectionLabel: "Ended disaster events",
      emptyMessage: "No ended disaster events are available for this report.",
    };
  }

  if (selection.startsWith(DISASTER_EVENT_REPORT_SELECTIONS.EVENT_PREFIX)) {
    return {
      selection,
      disasterEventId: selection.slice(
        DISASTER_EVENT_REPORT_SELECTIONS.EVENT_PREFIX.length,
      ),
      statuses: null,
      selectionLabel: "Selected disaster event",
      emptyMessage: "No data is available for the selected disaster event report.",
    };
  }

  return {
    selection: DISASTER_EVENT_REPORT_SELECTIONS.ALL,
    disasterEventId: null,
    statuses: null,
    selectionLabel: "All disaster events",
    emptyMessage: "No disaster events are available for this report.",
  };
};

module.exports = {
  DISASTER_EVENT_REPORT_SELECTIONS,
  ACTIVE_DISASTER_EVENT_STATUSES,
  ENDED_DISASTER_EVENT_STATUSES,
  normalizeDisasterEventReportSelection,
  isValidDisasterEventReportSelection,
  resolveDisasterEventReportSelection,
};
