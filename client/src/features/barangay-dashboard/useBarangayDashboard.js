import { useEffect, useMemo, useState } from "react";
import { getAccessMode, ACCESS_MODES } from "../../utils/accessMode";
import { fetchBarangays } from "../masterlist/masterlistService";
import { fetchBarangayDashboard } from "./barangayDashboardService";

const emptyMetrics = {
  total_evacuees_individuals: 0,
  total_families: 0,
  currently_admitted_evacuees: 0,
  total_departed_evacuees: 0,
};

const emptyPayload = {
  assigned_barangay: null,
  assigned_barangay_id: null,
  event_scope: "active",
  available_events: [],
  selected_event: null,
  metrics: emptyMetrics,
  has_data: false,
  is_dev_override: false,
};

const getFriendlyDashboardErrorMessage = (error) => {
  if (error?.code === "NO_ASSIGNED_BARANGAY") {
    return "No assigned barangay. Please contact administrator.";
  }

  if (error?.code === "INVALID_OVERRIDE_BARANGAY") {
    return "The selected fallback barangay is not available.";
  }

  if (error?.code === "BARANGAY_OVERRIDE_NOT_ALLOWED") {
    return "Fallback barangay selection is not available in this mode.";
  }

  return "Unable to load analytics.";
};

const getEventSortValue = (event) => {
  const sortableDate =
    event?.ended_at ||
    event?.end_date ||
    event?.start_date ||
    event?.created_at ||
    null;

  if (!sortableDate) {
    return 0;
  }

  const parsedValue = new Date(sortableDate).getTime();
  return Number.isNaN(parsedValue) ? 0 : parsedValue;
};

const getEventCodeSortValue = (event) => {
  const code = String(event?.event_code || "");
  const match = code.match(/^DE-(\d{4})-(\d{4})$/i);

  if (!match) {
    return 0;
  }

  return Number(`${match[1]}${match[2]}`);
};

const sortDashboardEvents = (events) => {
  return [...(events || [])].sort((left, right) => {
    const codeDifference =
      getEventCodeSortValue(right) - getEventCodeSortValue(left);

    if (codeDifference !== 0) {
      return codeDifference;
    }

    const dateDifference = getEventSortValue(right) - getEventSortValue(left);

    if (dateDifference !== 0) {
      return dateDifference;
    }

    return String(right?.event_code || "").localeCompare(
      String(left?.event_code || ""),
      undefined,
      { numeric: true, sensitivity: "base" },
    );
  });
};

export const useBarangayDashboard = ({ userId }) => {
  const accessMode = getAccessMode();
  const allowFallback = accessMode === ACCESS_MODES.DEVELOPMENT;
  const [eventScope, setEventScope] = useState("active");
  const [selectedDisasterEventId, setSelectedDisasterEventId] = useState("");
  const [overrideBarangayId, setOverrideBarangayId] = useState("");
  const [payload, setPayload] = useState(emptyPayload);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [errorCode, setErrorCode] = useState("");
  const [devBarangayOptions, setDevBarangayOptions] = useState([]);
  const hasScopedBarangayContext = Boolean(userId || overrideBarangayId);

  useEffect(() => {
    if (!allowFallback) {
      return;
    }

    let isMounted = true;

    const loadBarangays = async () => {
      try {
        const response = await fetchBarangays();

        if (isMounted) {
          setDevBarangayOptions(Array.isArray(response) ? response : []);
        }
      } catch (error) {
        if (isMounted) {
          setDevBarangayOptions([]);
        }
      }
    };

    loadBarangays();

    return () => {
      isMounted = false;
    };
  }, [allowFallback]);

  useEffect(() => {
    if (!hasScopedBarangayContext) {
      setPayload(emptyPayload);
      setSelectedDisasterEventId("");
      setErrorMessage(
        allowFallback
          ? "Select a fallback barangay to continue."
          : "No assigned barangay. Please contact administrator.",
      );
      setErrorCode("NO_ASSIGNED_BARANGAY");
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    const loadDashboard = async () => {
      setIsLoading(true);
      setErrorMessage("");

      try {
        const response = await fetchBarangayDashboard({
          userId: userId || null,
          disasterEventId: selectedDisasterEventId || null,
          eventScope,
          overrideBarangayId: allowFallback ? overrideBarangayId || null : null,
        });

        if (!isMounted) {
          return;
        }

        const sortedAvailableEvents = sortDashboardEvents(
          Array.isArray(response.available_events) ? response.available_events : [],
        );
        const nextSelectedEvent =
          response.selected_event &&
          sortedAvailableEvents.some((event) => event.id === response.selected_event.id)
            ? response.selected_event
            : sortedAvailableEvents[0] || null;

        setPayload({
          assigned_barangay: response.assigned_barangay || null,
          assigned_barangay_id: response.assigned_barangay_id || null,
          event_scope: response.event_scope || eventScope,
          available_events: sortedAvailableEvents,
          selected_event: nextSelectedEvent,
          metrics: response.metrics || emptyMetrics,
          has_data: Boolean(response.has_data),
          is_dev_override: Boolean(response.is_dev_override),
        });
        setErrorCode("");
        setErrorMessage("");
        setSelectedDisasterEventId(nextSelectedEvent?.id || "");
      } catch (error) {
        if (isMounted) {
          setPayload(emptyPayload);
          setSelectedDisasterEventId("");
          setErrorMessage(getFriendlyDashboardErrorMessage(error));
          setErrorCode(error.code || "");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadDashboard();

    return () => {
      isMounted = false;
    };
  }, [
    allowFallback,
    eventScope,
    hasScopedBarangayContext,
    overrideBarangayId,
    selectedDisasterEventId,
    userId,
  ]);

  const summaryCards = useMemo(() => {
    return [
      {
        label: "Total Affected Individuals",
        value: payload.metrics.total_evacuees_individuals || 0,
        helperText:
          "All registered individuals under the selected disaster event and scoped barangay, regardless of stay type.",
      },
      {
        label: "Total Affected Families",
        value: payload.metrics.total_families || 0,
        helperText:
          "All household records under the selected disaster event and scoped barangay, regardless of stay type.",
      },
      {
        label: "Currently Admitted Evacuees",
        value: payload.metrics.currently_admitted_evacuees || 0,
        helperText:
          "Individuals whose latest evacuation record still shows PRESENT in an evacuation center.",
      },
      {
        label: "Departed Evacuees",
        value: payload.metrics.total_departed_evacuees || 0,
        helperText:
          "Individuals whose latest evacuation record shows LEFT from an evacuation center.",
      },
    ];
  }, [payload.metrics]);

  return {
    accessMode,
    allowFallback,
    eventScope,
    selectedDisasterEventId,
    overrideBarangayId,
    assignedBarangay: payload.assigned_barangay,
    assignedBarangayId: payload.assigned_barangay_id,
    availableEvents: payload.available_events,
    selectedEvent: payload.selected_event,
    summaryCards,
    isLoading,
    errorMessage,
    errorCode,
    devBarangayOptions,
    hasData: Boolean(payload.has_data),
    hasAssignedBarangay: Boolean(payload.assigned_barangay_id),
    hasSelectedEvent: Boolean(payload.selected_event),
    hasEvents: payload.available_events.length > 0,
    isDevOverride: Boolean(payload.is_dev_override),
    setEventScope,
    setSelectedDisasterEventId,
    setOverrideBarangayId,
  };
};
