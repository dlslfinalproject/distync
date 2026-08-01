export const DISASTER_EVENT_REPORT_EXPORT_SELECTIONS = {
  ALL: "ALL",
  ACTIVE: "ACTIVE",
  ENDED: "ENDED",
  EVENT_PREFIX: "EVENT:",
};

const EXPORT_SELECTION_LABELS = {
  [DISASTER_EVENT_REPORT_EXPORT_SELECTIONS.ALL]: "All disaster events",
  [DISASTER_EVENT_REPORT_EXPORT_SELECTIONS.ACTIVE]: "Active disaster events",
  [DISASTER_EVENT_REPORT_EXPORT_SELECTIONS.ENDED]: "Ended disaster events",
};

export const getDisasterEventReportStatusLabel = (status) => {
  const normalizedStatus = String(status || "").trim().toUpperCase();

  if (normalizedStatus === "ACTIVE") {
    return "Active";
  }

  if (normalizedStatus === "CLOSED" || normalizedStatus === "ARCHIVED") {
    return "Ended";
  }

  if (!normalizedStatus) {
    return "";
  }

  return `${normalizedStatus.slice(0, 1)}${normalizedStatus.slice(1).toLowerCase()}`;
};

export const formatDisasterEventReportSelectionValue = (eventId) =>
  `${DISASTER_EVENT_REPORT_EXPORT_SELECTIONS.EVENT_PREFIX}${String(eventId || "").trim()}`;

export const parseDisasterEventReportSelectionValue = (selectionValue) => {
  const normalizedValue = String(selectionValue || "").trim();

  if (
    normalizedValue === DISASTER_EVENT_REPORT_EXPORT_SELECTIONS.ALL ||
    normalizedValue === DISASTER_EVENT_REPORT_EXPORT_SELECTIONS.ACTIVE ||
    normalizedValue === DISASTER_EVENT_REPORT_EXPORT_SELECTIONS.ENDED
  ) {
    return {
      kind: normalizedValue,
      disasterEventId: "",
    };
  }

  if (
    normalizedValue.startsWith(
      DISASTER_EVENT_REPORT_EXPORT_SELECTIONS.EVENT_PREFIX,
    )
  ) {
    return {
      kind: "EVENT",
      disasterEventId: normalizedValue.slice(
        DISASTER_EVENT_REPORT_EXPORT_SELECTIONS.EVENT_PREFIX.length,
      ),
    };
  }

  return {
    kind: DISASTER_EVENT_REPORT_EXPORT_SELECTIONS.ALL,
    disasterEventId: "",
  };
};

export const getDisasterEventReportSelectionLabel = (
  selectionValue,
  events = [],
) => {
  const parsedSelection =
    parseDisasterEventReportSelectionValue(selectionValue);

  if (parsedSelection.kind !== "EVENT") {
    return (
      EXPORT_SELECTION_LABELS[parsedSelection.kind] ||
      EXPORT_SELECTION_LABELS[DISASTER_EVENT_REPORT_EXPORT_SELECTIONS.ALL]
    );
  }

  const matchingEvent = (Array.isArray(events) ? events : []).find(
    (event) => String(event?.id || "") === parsedSelection.disasterEventId,
  );

  return matchingEvent
    ? buildDisasterEventReportOptionLabel(matchingEvent, events)
    : "Selected disaster event";
};

export const getDisasterEventReportEmptyMessage = (selectionValue) => {
  const parsedSelection =
    parseDisasterEventReportSelectionValue(selectionValue);

  if (parsedSelection.kind === DISASTER_EVENT_REPORT_EXPORT_SELECTIONS.ACTIVE) {
    return "No active disaster events are available for this report.";
  }

  if (parsedSelection.kind === DISASTER_EVENT_REPORT_EXPORT_SELECTIONS.ENDED) {
    return "No ended disaster events are available for this report.";
  }

  if (parsedSelection.kind === "EVENT") {
    return "No data is available for the selected disaster event report.";
  }

  return "No disaster events are available for this report.";
};

export const buildDisasterEventReportOptionLabel = (event) => {
  return String(event?.title || "").trim() || "Untitled disaster event";
};

export const buildDisasterEventReportExportOptions = (events = []) => {
  const safeEvents = Array.isArray(events) ? events : [];

  return [
    {
      value: DISASTER_EVENT_REPORT_EXPORT_SELECTIONS.ALL,
      label:
        EXPORT_SELECTION_LABELS[DISASTER_EVENT_REPORT_EXPORT_SELECTIONS.ALL],
    },
    {
      value: DISASTER_EVENT_REPORT_EXPORT_SELECTIONS.ACTIVE,
      label:
        EXPORT_SELECTION_LABELS[DISASTER_EVENT_REPORT_EXPORT_SELECTIONS.ACTIVE],
    },
    {
      value: DISASTER_EVENT_REPORT_EXPORT_SELECTIONS.ENDED,
      label:
        EXPORT_SELECTION_LABELS[DISASTER_EVENT_REPORT_EXPORT_SELECTIONS.ENDED],
    },
    ...safeEvents.map((event) => ({
      value: formatDisasterEventReportSelectionValue(event?.id),
      label: buildDisasterEventReportOptionLabel(event),
    })),
  ];
};
