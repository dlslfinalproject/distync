import { useEffect, useState } from "react";
import { fetchAllDisasterEvents } from "../disaster-events/disasterEventService";
import {
  fetchInventoryForecastContext,
  fetchForecastHistory,
  fetchForecastRunDetails,
  fetchLatestInventoryForecast,
  runInventoryForecast,
} from "./inventoryItemService";
import { getForecastModelLabel } from "./inventoryItemExportOptions";

export const useInventoryForecast = () => {
  const [forecastEvents, setForecastEvents] = useState([]);
  const [selectedForecastEventId, setSelectedForecastEventId] = useState("");
  const [selectedForecastModel, setSelectedForecastModel] =
    useState("MOVING_AVERAGE");
  const [forecastContext, setForecastContext] = useState(null);
  const [forecastRunData, setForecastRunData] = useState(null);
  const [forecastHistory, setForecastHistory] = useState([]);
  const [forecastHistoryDetails, setForecastHistoryDetails] = useState(null);
  const [isForecastContextLoading, setIsForecastContextLoading] = useState(false);
  const [isForecastLoading, setIsForecastLoading] = useState(false);
  const [isForecastHistoryLoading, setIsForecastHistoryLoading] =
    useState(false);
  const [isForecastHistoryDetailLoading, setIsForecastHistoryDetailLoading] =
    useState(false);
  const [isRunningForecast, setIsRunningForecast] = useState(false);
  const [forecastErrorMessage, setForecastErrorMessage] = useState("");
  const [forecastSuccessMessage, setForecastSuccessMessage] = useState("");

  useEffect(() => {
    let isMounted = true;

    const loadForecastEvents = async () => {
      try {
        const eventRows = await fetchAllDisasterEvents();

        if (!isMounted) {
          return;
        }

        const normalizedEvents = Array.isArray(eventRows) ? eventRows : [];
        setForecastEvents(normalizedEvents);

        if (normalizedEvents.length > 0) {
          const preferredEvent =
            normalizedEvents.find((event) => event.status === "ACTIVE") ||
            normalizedEvents[0];
          setSelectedForecastEventId(preferredEvent.id);
        }
      } catch (error) {
        if (isMounted) {
          setForecastErrorMessage(
            error.message || "Failed to load disaster events for forecasting.",
          );
        }
      }
    };

    loadForecastEvents();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadForecastContext = async () => {
      if (!selectedForecastEventId) {
        setForecastContext(null);
        return;
      }

      setIsForecastContextLoading(true);

      try {
        const response = await fetchInventoryForecastContext(
          selectedForecastEventId,
        );

        if (isMounted) {
          setForecastContext(response?.data || null);
        }
      } catch (error) {
        if (isMounted) {
          setForecastContext(null);
          setForecastErrorMessage(
            error.message || "Failed to load forecast event context.",
          );
        }
      } finally {
        if (isMounted) {
          setIsForecastContextLoading(false);
        }
      }
    };

    loadForecastContext();

    return () => {
      isMounted = false;
    };
  }, [selectedForecastEventId]);

  useEffect(() => {
    let isMounted = true;

    const loadLatestForecast = async () => {
      if (!selectedForecastEventId) {
        setForecastRunData(null);
        return;
      }

      setIsForecastLoading(true);
      setForecastErrorMessage("");

      try {
        const response = await fetchLatestInventoryForecast(selectedForecastEventId);

        if (isMounted) {
          setForecastRunData(response?.data || null);
        }
      } catch (error) {
        if (isMounted) {
          setForecastRunData(null);
          setForecastErrorMessage(
            error.message || "Failed to load the latest forecast.",
          );
        }
      } finally {
        if (isMounted) {
          setIsForecastLoading(false);
        }
      }
    };

    loadLatestForecast();

    return () => {
      isMounted = false;
    };
  }, [selectedForecastEventId]);

  useEffect(() => {
    let isMounted = true;

    const loadForecastHistory = async () => {
      if (!selectedForecastEventId) {
        setForecastHistory([]);
        setForecastHistoryDetails(null);
        return;
      }

      setIsForecastHistoryLoading(true);

      try {
        const response = await fetchForecastHistory({
          disasterEventId: selectedForecastEventId,
          limit: 10,
        });

        if (isMounted) {
          const historyRows = response?.data || [];
          setForecastHistory(historyRows);
          setForecastHistoryDetails(null);
        }
      } catch (_error) {
        if (isMounted) {
          setForecastHistory([]);
          setForecastHistoryDetails(null);
        }
      } finally {
        if (isMounted) {
          setIsForecastHistoryLoading(false);
        }
      }
    };

    loadForecastHistory();

    return () => {
      isMounted = false;
    };
  }, [selectedForecastEventId]);

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
    isForecastContextLoading,
    isForecastLoading,
    isForecastHistoryLoading,
    isForecastHistoryDetailLoading,
    isRunningForecast,
    forecastErrorMessage,
    forecastSuccessMessage,
    setSelectedForecastEventId,
    setSelectedForecastModel,
    handleRunForecast,
    handleSelectForecastHistoryRun,
  };
};
