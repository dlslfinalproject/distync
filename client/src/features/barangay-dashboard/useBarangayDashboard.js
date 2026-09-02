import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getAccessMode, ACCESS_MODES } from "../../utils/accessMode";
import { ROLE_CODES } from "../../utils/roleSession";
import { fetchBarangays } from "../masterlist/masterlistService";
import { fetchBarangayDashboard } from "./barangayDashboardService";
import {
  getPreparedBarangayOfflineContexts,
} from "../../offline/offlinePreparation.js";
import { getCachedRegistrationReferenceData } from "../household-registration/householdRegistrationService.js";
import {
  persistOperationalDisasterEventSelection,
  readOperationalDisasterEventId,
  readOperationalDisasterEventContext,
  readOperationalDisasterEventScope,
} from "../disaster-events/operationalDisasterEventSelection";

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

const canRestoreOfflineContext = (error) => {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return true;
  }

  if (error?.statusCode) {
    return false;
  }

  return /Failed to fetch|NetworkError|Load failed/i.test(
    String(error?.message || ""),
  );
};

export const useBarangayDashboard = ({ userId, fallbackBarangayId = "" }) => {
  const accessMode = getAccessMode();
  const allowFallback = accessMode === ACCESS_MODES.DEVELOPMENT;
  const [eventScope, setEventScopeState] = useState(
    () =>
      readOperationalDisasterEventScope({
        roleCode: ROLE_CODES.BARANGAY,
        userId,
      }) || "active",
  );
  const [selectedDisasterEventId, setSelectedDisasterEventIdState] = useState(
    () =>
      readOperationalDisasterEventId({
        roleCode: ROLE_CODES.BARANGAY,
        userId,
      }) || "",
  );
  const [overrideBarangayId, setOverrideBarangayId] = useState("");
  const [payload, setPayload] = useState(emptyPayload);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [errorCode, setErrorCode] = useState("");
  const [devBarangayOptions, setDevBarangayOptions] = useState([]);
  const [isContextResolved, setIsContextResolved] = useState(false);
  const requestSeqRef = useRef(0);
  const skipSelectedEventReloadRef = useRef("");
  const lastResolvedContextRef = useRef({
    assignedBarangay: null,
    assignedBarangayId: null,
    isDevOverride: false,
  });
  const hasScopedBarangayContext = Boolean(userId || overrideBarangayId);

  const persistSelection = useCallback(
    (eventId, scope = eventScope) => {
      persistOperationalDisasterEventSelection({
        roleCode: ROLE_CODES.BARANGAY,
        userId,
        eventId,
        eventScope: scope,
      });
    },
    [eventScope, userId],
  );

  const setEventScope = useCallback(
    (nextScope) => {
      setEventScopeState(nextScope);
      persistSelection(selectedDisasterEventId, nextScope);
    },
    [persistSelection, selectedDisasterEventId],
  );

  const setSelectedDisasterEventId = useCallback(
    (nextEventId) => {
      setSelectedDisasterEventIdState(nextEventId);
      persistSelection(nextEventId);
    },
    [persistSelection],
  );

  useEffect(() => {
    const storedScope =
      readOperationalDisasterEventScope({
        roleCode: ROLE_CODES.BARANGAY,
        userId,
      }) || "active";
    const storedEventId = readOperationalDisasterEventId({
      roleCode: ROLE_CODES.BARANGAY,
      userId,
    });

    setEventScopeState(storedScope);
    setSelectedDisasterEventIdState(storedEventId);
  }, [userId]);

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
      requestSeqRef.current += 1;
      skipSelectedEventReloadRef.current = "";
      setPayload(emptyPayload);
      setSelectedDisasterEventIdState("");
      setIsLoading(false);

      if (allowFallback) {
        setIsContextResolved(true);
        setErrorMessage("Select a fallback barangay to continue.");
        setErrorCode("NO_ASSIGNED_BARANGAY");
        return;
      }

      setIsContextResolved(false);
      setErrorMessage("");
      setErrorCode("");
      return;
    }

    let isMounted = true;
    const requestSeq = requestSeqRef.current + 1;
    requestSeqRef.current = requestSeq;

    if (
      skipSelectedEventReloadRef.current &&
      skipSelectedEventReloadRef.current === selectedDisasterEventId
    ) {
      skipSelectedEventReloadRef.current = "";
      return () => {
        isMounted = false;
      };
    }

    const loadDashboard = async () => {
      setIsLoading(true);
      setIsContextResolved(false);
      setPayload({
        ...emptyPayload,
        event_scope: eventScope,
      });
      setErrorMessage("");

      try {
        const response = await fetchBarangayDashboard({
          userId: userId || null,
          disasterEventId: selectedDisasterEventId || null,
          eventScope,
          overrideBarangayId: allowFallback ? overrideBarangayId || null : null,
        });

        if (!isMounted || requestSeqRef.current !== requestSeq) {
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
        setIsContextResolved(true);
        if (
          nextSelectedEvent?.id &&
          nextSelectedEvent.id !== selectedDisasterEventId
        ) {
          skipSelectedEventReloadRef.current = nextSelectedEvent.id;
        }
        setSelectedDisasterEventIdState(nextSelectedEvent?.id || "");
        lastResolvedContextRef.current = {
          assignedBarangay: response.assigned_barangay || null,
          assignedBarangayId:
            response.assigned_barangay_id ||
            response.assigned_barangay?.id ||
            null,
          isDevOverride: Boolean(response.is_dev_override),
        };
        persistOperationalDisasterEventSelection({
          roleCode: ROLE_CODES.BARANGAY,
          userId,
          eventId: nextSelectedEvent?.id || "",
          eventScope,
          event: nextSelectedEvent,
        });
      } catch (error) {
        if (isMounted && requestSeqRef.current === requestSeq) {
          if (canRestoreOfflineContext(error)) {
            const storedEvent = readOperationalDisasterEventContext({
              roleCode: ROLE_CODES.BARANGAY,
              userId,
              eventScope,
            });
            let retainedEventId =
              selectedDisasterEventId || storedEvent?.id || "";
            const preparedContexts = await getPreparedBarangayOfflineContexts({ userId });
            const selectedPreparedContext = retainedEventId
              ? preparedContexts.find(
                  (preparation) =>
                    String(preparation.disaster_event_id) === String(retainedEventId),
                )
              : preparedContexts.length === 1
                ? preparedContexts[0]
                : null;
            if (!retainedEventId && selectedPreparedContext?.disaster_event_id) {
              retainedEventId = selectedPreparedContext.disaster_event_id;
            }
            const cachedReferenceData = getCachedRegistrationReferenceData();
            const cachedEvent = Array.isArray(cachedReferenceData.activeDisasterEvents)
              ? cachedReferenceData.activeDisasterEvents.find(
                  (event) => String(event?.id) === String(retainedEventId),
                )
              : null;
            const retainedEvent = storedEvent || cachedEvent ||
              (retainedEventId ? { id: retainedEventId } : null);
            const previousContext = lastResolvedContextRef.current;
            const retainedBarangayId =
              previousContext.assignedBarangayId ||
              previousContext.assignedBarangay?.id ||
              selectedPreparedContext?.barangay_id ||
              overrideBarangayId ||
              fallbackBarangayId ||
              null;
            const cachedBarangay = Array.isArray(cachedReferenceData.barangays)
              ? cachedReferenceData.barangays.find(
                  (barangay) => String(barangay?.id) === String(retainedBarangayId),
                )
              : null;

            setPayload({
              ...emptyPayload,
              assigned_barangay:
                previousContext.assignedBarangay ||
                cachedBarangay ||
                (retainedBarangayId ? { id: retainedBarangayId } : null),
              assigned_barangay_id: retainedBarangayId,
              event_scope: eventScope,
              available_events: retainedEvent ? [retainedEvent] : [],
              selected_event: retainedEvent,
              is_dev_override:
                previousContext.isDevOverride ||
                Boolean(overrideBarangayId),
            });
            setSelectedDisasterEventIdState(retainedEvent?.id || "");
          } else {
            setPayload(emptyPayload);
            setSelectedDisasterEventIdState("");
            persistOperationalDisasterEventSelection({
              roleCode: ROLE_CODES.BARANGAY,
              userId,
              eventId: "",
              eventScope,
            });
          }
          setErrorMessage(getFriendlyDashboardErrorMessage(error));
          setErrorCode(error.code || "");
          setIsContextResolved(true);
        }
      } finally {
        if (isMounted && requestSeqRef.current === requestSeq) {
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
    fallbackBarangayId,
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
    isContextResolved,
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
