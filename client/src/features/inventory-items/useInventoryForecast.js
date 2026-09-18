import { useEffect, useRef, useState } from "react";
import { fetchAllDisasterEvents } from "../disaster-events/disasterEventService";
import {
  fetchInventoryForecastContext,
  fetchForecastHistory,
  fetchForecastRunDetails,
  fetchLatestInventoryForecast,
  runInventoryForecast,
} from "./inventoryItemService";
import {
  getForecastModelLabel,
  getForecastModelRecommendation,
} from "./inventoryItemExportOptions";
import { useDashboardRevalidation } from "../../utils/dashboardRevalidation";

const getEventTimestamp = (event, fieldName) => {
  const timestamp = new Date(event?.[fieldName] || 0).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
};

const compareMostRecentForecastEvent = (left, right) => {
  const startDateDifference =
    getEventTimestamp(right, "start_date") - getEventTimestamp(left, "start_date");

  if (startDateDifference !== 0) {
    return startDateDifference;
  }

  return getEventTimestamp(right, "created_at") - getEventTimestamp(left, "created_at");
};

export const useInventoryForecast = () => {
  const [forecastEvents, setForecastEvents] = useState([]);
  const [selectedForecastEventId, setSelectedForecastEventId] = useState("");
  const [selectedForecastModel, setSelectedForecastModel] =
    useState("MOVING_AVERAGE");
  const [hasForecastModelOverride, setHasForecastModelOverride] =
    useState(false);
  const [forecastContext, setForecastContext] = useState(null);
  const [forecastRunData, setForecastRunData] = useState(null);
  const [forecastHistory, setForecastHistory] = useState([]);
  const [forecastHistoryDetails, setForecastHistoryDetails] = useState(null);
  const [isForecastEventsLoading, setIsForecastEventsLoading] =
    useState(true);
  const [isForecastContextLoading, setIsForecastContextLoading] = useState(false);
  const [isForecastLoading, setIsForecastLoading] = useState(false);
  const [isForecastHistoryLoading, setIsForecastHistoryLoading] =
    useState(false);
  const [isForecastHistoryDetailLoading, setIsForecastHistoryDetailLoading] =
    useState(false);
  const [isRunningForecast, setIsRunningForecast] = useState(false);
  const [forecastErrorMessage, setForecastErrorMessage] = useState("");
  const [forecastSuccessMessage, setForecastSuccessMessage] = useState("");
  const [reloadToken, setReloadToken] = useState(0);
  const [isRefreshingForecastContext, setIsRefreshingForecastContext] = useState(false);
  const [isRefreshingForecastEvents, setIsRefreshingForecastEvents] =
    useState(false);
  const [isRefreshingForecast, setIsRefreshingForecast] = useState(false);
  const [isRefreshingForecastHistory, setIsRefreshingForecastHistory] = useState(false);
  const backgroundEventsReloadRef = useRef(false);
  const backgroundContextReloadRef = useRef(false);
  const backgroundForecastReloadRef = useRef(false);
  const backgroundHistoryReloadRef = useRef(false);
  const hasLoadedEventsRef = useRef(false);
  const hasLoadedContextRef = useRef(false);
  const hasLoadedForecastRef = useRef(false);
  const hasLoadedHistoryRef = useRef(false);

  useDashboardRevalidation(() => {
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      return;
    }

    backgroundEventsReloadRef.current = true;
    backgroundContextReloadRef.current = true;
    backgroundForecastReloadRef.current = true;
    backgroundHistoryReloadRef.current = true;
    setReloadToken((value) => value + 1);
  });

  useEffect(() => {
    let isMounted = true;

    const loadForecastEvents = async () => {
      const preserveExistingEvents =
        backgroundEventsReloadRef.current && hasLoadedEventsRef.current;
      backgroundEventsReloadRef.current = false;
      if (!preserveExistingEvents) {
        setIsForecastEventsLoading(true);
      }
      setIsRefreshingForecastEvents(preserveExistingEvents);
      try {
        const eventRows = await fetchAllDisasterEvents();

        if (!isMounted) {
          return;
        }

        const activeEvents = (Array.isArray(eventRows) ? eventRows : [])
          .filter((event) => event.status === "ACTIVE")
          .sort(compareMostRecentForecastEvent);
        setForecastEvents(activeEvents);

        hasLoadedEventsRef.current = true;
        setSelectedForecastEventId((currentEventId) =>
          activeEvents.some((event) => event.id === currentEventId)
            ? currentEventId
            : activeEvents[0]?.id || "",
        );
      } catch (error) {
        if (isMounted) {
          if (!preserveExistingEvents) {
            setForecastErrorMessage(
              error.message || "Failed to load disaster events for forecasting.",
            );
          }
        }
      } finally {
        if (isMounted) {
          setIsForecastEventsLoading(false);
          setIsRefreshingForecastEvents(false);
        }
      }
    };

    loadForecastEvents();

    return () => {
      isMounted = false;
    };
  }, [reloadToken]);

  useEffect(() => {
    let isMounted = true;

    const loadForecastContext = async () => {
      if (!selectedForecastEventId) {
        setForecastContext(null);
        setIsRefreshingForecastContext(false);
        hasLoadedContextRef.current = false;
        return;
      }

      const preserveExistingContext =
        backgroundContextReloadRef.current && hasLoadedContextRef.current;
      backgroundContextReloadRef.current = false;
      if (!preserveExistingContext) {
        setIsForecastContextLoading(true);
      }
      setIsRefreshingForecastContext(preserveExistingContext);

      try {
        const response = await fetchInventoryForecastContext(
          selectedForecastEventId,
        );

        if (isMounted) {
          setForecastContext(response?.data || null);
          hasLoadedContextRef.current = true;
        }
      } catch (error) {
        if (isMounted) {
          if (!preserveExistingContext) {
            setForecastContext(null);
            setForecastErrorMessage(
              error.message || "Failed to load forecast event context.",
            );
          }
        }
      } finally {
        if (isMounted) {
          setIsForecastContextLoading(false);
          setIsRefreshingForecastContext(false);
        }
      }
    };

    loadForecastContext();

    return () => {
      isMounted = false;
    };
  }, [reloadToken, selectedForecastEventId]);

  useEffect(() => {
    if (
      !selectedForecastEventId ||
      !forecastContext ||
      hasForecastModelOverride ||
      forecastContext.disaster_event?.id !== selectedForecastEventId
    ) {
      return;
    }

    const recommendation = getForecastModelRecommendation({
      event: forecastContext.disaster_event,
      forecastContext,
    });

    setSelectedForecastModel(recommendation.modelName);
  }, [
    forecastContext,
    hasForecastModelOverride,
    selectedForecastEventId,
  ]);

  useEffect(() => {
    let isMounted = true;

    const loadLatestForecast = async () => {
      if (!selectedForecastEventId) {
        setForecastRunData(null);
        setIsRefreshingForecast(false);
        hasLoadedForecastRef.current = false;
        return;
      }

      const preserveExistingForecast =
        backgroundForecastReloadRef.current && hasLoadedForecastRef.current;
      backgroundForecastReloadRef.current = false;
      if (!preserveExistingForecast) {
        setIsForecastLoading(true);
      }
      setIsRefreshingForecast(preserveExistingForecast);
      setForecastErrorMessage("");

      try {
        const response = await fetchLatestInventoryForecast(selectedForecastEventId);

        if (isMounted) {
          setForecastRunData(response?.data || null);
          hasLoadedForecastRef.current = true;
        }
      } catch (error) {
        if (isMounted) {
          if (!preserveExistingForecast) {
            setForecastRunData(null);
            setForecastErrorMessage(
              error.message || "Failed to load the latest forecast.",
            );
          }
        }
      } finally {
        if (isMounted) {
          setIsForecastLoading(false);
          setIsRefreshingForecast(false);
        }
      }
    };

    loadLatestForecast();

    return () => {
      isMounted = false;
    };
  }, [reloadToken, selectedForecastEventId]);

  useEffect(() => {
    let isMounted = true;

    const loadForecastHistory = async () => {
      if (!selectedForecastEventId) {
        setForecastHistory([]);
        setForecastHistoryDetails(null);
        setIsRefreshingForecastHistory(false);
        hasLoadedHistoryRef.current = false;
        return;
      }

      const preserveExistingHistory =
        backgroundHistoryReloadRef.current && hasLoadedHistoryRef.current;
      backgroundHistoryReloadRef.current = false;
      if (!preserveExistingHistory) {
        setIsForecastHistoryLoading(true);
      }
      setIsRefreshingForecastHistory(preserveExistingHistory);

      try {
        const response = await fetchForecastHistory({
          disasterEventId: selectedForecastEventId,
          limit: 10,
        });

        if (isMounted) {
          const historyRows = response?.data || [];
          setForecastHistory(historyRows);
          setForecastHistoryDetails(null);
          hasLoadedHistoryRef.current = true;
        }
      } catch (_error) {
        if (isMounted) {
          if (!preserveExistingHistory) {
            setForecastHistory([]);
            setForecastHistoryDetails(null);
          }
        }
      } finally {
        if (isMounted) {
          setIsForecastHistoryLoading(false);
          setIsRefreshingForecastHistory(false);
        }
      }
    };

    loadForecastHistory();

    return () => {
      isMounted = false;
    };
  }, [reloadToken, selectedForecastEventId]);

  const handleRunForecast = async () => {
    if (!selectedForecastEventId) {
      setForecastErrorMessage("Select a disaster event before running a forecast.");
      return;
    }

    setIsRunningForecast(true);
    setForecastErrorMessage("");
    setForecastSuccessMessage("");

    try {
      const response = await runInventoryForecast({
        disaster_event_id: selectedForecastEventId,
        model_name: selectedForecastModel,
      });

      setForecastRunData(response.data || null);
      setForecastHistoryDetails(response.data || null);
      setForecastSuccessMessage(
        `${getForecastModelLabel(selectedForecastModel)} forecast completed successfully.`,
      );
      const historyResponse = await fetchForecastHistory({
        disasterEventId: selectedForecastEventId,
        limit: 10,
      });
      setForecastHistory(historyResponse?.data || []);
    } catch (error) {
      setForecastErrorMessage(
        error.message || "Failed to run the selected forecast model.",
      );
    } finally {
      setIsRunningForecast(false);
    }
  };

  const handleForecastEventChange = (eventId) => {
    setSelectedForecastEventId(eventId);
    setSelectedForecastModel("MOVING_AVERAGE");
    setHasForecastModelOverride(false);
    setForecastContext(null);
  };

  const handleForecastModelChange = (modelName) => {
    setSelectedForecastModel(modelName);
    setHasForecastModelOverride(true);
  };

  const handleSelectForecastHistoryRun = async (runId) => {
    setIsForecastHistoryDetailLoading(true);

    try {
      const response = await fetchForecastRunDetails(runId);
      setForecastHistoryDetails(response?.data || null);
    } catch (error) {
      setForecastErrorMessage(
        error.message || "Failed to load forecast run details.",
      );
    } finally {
      setIsForecastHistoryDetailLoading(false);
    }
  };

  return {
    forecastEvents,
    selectedForecastEventId,
    selectedForecastModel,
    forecastContext,
    forecastRunData,
    forecastHistory,
    forecastHistoryDetails,
    isForecastEventsLoading,
    isInitialForecastEventsLoading:
      isForecastEventsLoading && !isRefreshingForecastEvents,
    isForecastContextLoading,
    isInitialForecastContextLoading:
      isForecastContextLoading && !isRefreshingForecastContext,
    isForecastLoading,
    isInitialForecastLoading: isForecastLoading && !isRefreshingForecast,
    isForecastHistoryLoading,
    isInitialForecastHistoryLoading:
      isForecastHistoryLoading && !isRefreshingForecastHistory,
    isForecastHistoryDetailLoading,
    isRunningForecast,
    forecastErrorMessage,
    forecastSuccessMessage,
    handleForecastEventChange,
    handleForecastModelChange,
    handleRunForecast,
    handleSelectForecastHistoryRun,
  };
};
