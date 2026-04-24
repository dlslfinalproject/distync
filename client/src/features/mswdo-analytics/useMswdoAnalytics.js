import { useEffect, useMemo, useState } from "react";
import {
  fetchActiveDisasterEvents,
  fetchBarangays,
  fetchDisasterEvents,
  fetchMasterlistOperationalAnalytics,
} from "./mswdoAnalyticsService";

const emptyOperationalPayload = {
  disaster_event: null,
  filters: {
    disaster_event_id: null,
    barangay_id: null,
  },
  summary_metrics: {
    total_number_of_evacuees_individuals: 0,
    total_number_of_families: 0,
    average_household_size: 0,
    currently_admitted_evacuees: 0,
    total_departed_evacuees: 0,
    total_barangays_covered: 0,
  },
  charts: {
    per_barangay: [],
    sex_distribution: [],
    age_group_distribution: [],
    sector_distribution: [],
    stay_type_distribution: [],
    evacuation_center_distribution: [],
    relief_distribution_per_barangay: [],
    daily_admission_trend: [],
  },
  has_data: false,
};

const sortByValueDescending = (items) => {
  return [...items].sort((firstItem, secondItem) => secondItem.value - firstItem.value);
};

const mapPerBarangayDataset = (dashboardPayload) => {
  const items = dashboardPayload.charts?.per_barangay || [];

  return items.map((item) => ({
    barangay_id: item.barangay_id,
    barangay_name: item.barangay_name || "Unknown",
    families_count: Number(item.families_count || 0),
    evacuees_count: Number(item.evacuees_count || 0),
    admitted_evacuees_count: Number(item.admitted_evacuees_count || 0),
    departed_evacuees_count: Number(item.departed_evacuees_count || 0),
  }));
};

const mapSummaryMetrics = (summary) => ({
  totalEvacuees: Number(summary.total_number_of_evacuees_individuals || 0),
  totalHouseholds: Number(summary.total_number_of_families || 0),
  currentlyAdmitted: Number(summary.currently_admitted_evacuees || 0),
  departed: Number(summary.total_departed_evacuees || 0),
  totalBarangaysCovered: Number(summary.total_barangays_covered || 0),
  averageHouseholdSize: Number(summary.average_household_size || 0),
});

const mapSimpleDistribution = (items = []) => {
  return sortByValueDescending(
    items.map((item) => ({
      name: item.name || "Unknown",
      value: Number(item.value || 0),
    })),
  );
};

const mapPerBarangayCounts = (items, valueKey) => {
  return sortByValueDescending(
    items.map((item) => ({
      name: item.barangay_name,
      value: Number(item[valueKey] || 0),
    })),
  );
};

const mapAdmittedVsDepartedDistribution = (summary) => {
  return [
    {
      name: "Admitted",
      value: Number(summary.currently_admitted_evacuees || 0),
    },
    {
      name: "Departed",
      value: Number(summary.total_departed_evacuees || 0),
    },
  ].filter((item) => item.value > 0);
};

const mapDailyAdmissionTrend = (items = []) => {
  return items.map((item) => ({
    name: item.name || "Unknown",
    value: Number(item.value || 0),
    date: item.date || null,
  }));
};

export const useMswdoAnalytics = () => {
  const [disasterEvents, setDisasterEvents] = useState([]);
  const [barangays, setBarangays] = useState([]);
  const [selectedDisasterEventId, setSelectedDisasterEventId] = useState("");
  const [selectedBarangayId, setSelectedBarangayId] = useState("");
  const [operationalPayload, setOperationalPayload] = useState(emptyOperationalPayload);
  const [isLoadingFilters, setIsLoadingFilters] = useState(true);
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let isMounted = true;

    const loadInitialFilters = async () => {
      setIsLoadingFilters(true);
      setErrorMessage("");

      try {
        const [eventsPayload, activePayload, barangaysPayload] = await Promise.all([
          fetchDisasterEvents(),
          fetchActiveDisasterEvents(),
          fetchBarangays(),
        ]);

        if (!isMounted) {
          return;
        }

        const allEvents = Array.isArray(eventsPayload) ? eventsPayload : [];
        const activeEvents = Array.isArray(activePayload) ? activePayload : [];
        const barangayRows = Array.isArray(barangaysPayload) ? barangaysPayload : [];

        setDisasterEvents(allEvents);
        setBarangays(barangayRows);

        if (activeEvents.length > 0) {
          setSelectedDisasterEventId(activeEvents[0].id);
        } else if (allEvents.length > 0) {
          setSelectedDisasterEventId(allEvents[0].id);
        }
      } catch (error) {
        if (isMounted) {
          setErrorMessage(error.message || "Failed to load analytics filters");
        }
      } finally {
        if (isMounted) {
          setIsLoadingFilters(false);
        }
      }
    };

    loadInitialFilters();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadDashboard = async () => {
      if (!selectedDisasterEventId) {
        setOperationalPayload(emptyOperationalPayload);
        return;
      }

      setIsLoadingDashboard(true);
      setErrorMessage("");

      try {
        const payload = await fetchMasterlistOperationalAnalytics({
          disasterEventId: selectedDisasterEventId,
          barangayId: selectedBarangayId || null,
        });

        if (isMounted) {
          setOperationalPayload(payload);
        }
      } catch (error) {
        if (isMounted) {
          setOperationalPayload(emptyOperationalPayload);
          setErrorMessage(error.message || "Failed to load analytics dashboard");
        }
      } finally {
        if (isMounted) {
          setIsLoadingDashboard(false);
        }
      }
    };

    loadDashboard();

    return () => {
      isMounted = false;
    };
  }, [selectedBarangayId, selectedDisasterEventId]);

  const selectedDisasterEvent = useMemo(() => {
    return disasterEvents.find((event) => event.id === selectedDisasterEventId) || null;
  }, [disasterEvents, selectedDisasterEventId]);

  const summaryMetrics = useMemo(() => {
    return mapSummaryMetrics(operationalPayload.summary_metrics || {});
  }, [operationalPayload.summary_metrics]);

  const perBarangayDataset = useMemo(() => {
    return mapPerBarangayDataset(operationalPayload);
  }, [operationalPayload]);

  const evacueesPerBarangay = useMemo(() => {
    return mapPerBarangayCounts(perBarangayDataset, "evacuees_count");
  }, [perBarangayDataset]);

  const familiesPerBarangay = useMemo(() => {
    return mapPerBarangayCounts(perBarangayDataset, "families_count");
  }, [perBarangayDataset]);

  const sexDistribution = useMemo(() => {
    return mapSimpleDistribution(operationalPayload.charts?.sex_distribution);
  }, [operationalPayload.charts?.sex_distribution]);

  const ageGroupDistribution = useMemo(() => {
    return (operationalPayload.charts?.age_group_distribution || []).map((item) => ({
      name: item.name || "Unknown",
      value: Number(item.value || 0),
    }));
  }, [operationalPayload.charts?.age_group_distribution]);

  const sectorDistribution = useMemo(() => {
    return mapSimpleDistribution(operationalPayload.charts?.sector_distribution);
  }, [operationalPayload.charts?.sector_distribution]);

  const stayTypeDistribution = useMemo(() => {
    return mapSimpleDistribution(operationalPayload.charts?.stay_type_distribution);
  }, [operationalPayload.charts?.stay_type_distribution]);

  const admittedVsDepartedDistribution = useMemo(() => {
    return mapAdmittedVsDepartedDistribution(
      operationalPayload.summary_metrics || emptyOperationalPayload.summary_metrics,
    );
  }, [operationalPayload.summary_metrics]);

  const evacuationCenterDistribution = useMemo(() => {
    return mapSimpleDistribution(
      operationalPayload.charts?.evacuation_center_distribution,
    );
  }, [operationalPayload.charts?.evacuation_center_distribution]);

  const reliefDistributionPerBarangay = useMemo(() => {
    return mapSimpleDistribution(
      operationalPayload.charts?.relief_distribution_per_barangay,
    );
  }, [operationalPayload.charts?.relief_distribution_per_barangay]);

  const dailyAdmissionTrend = useMemo(() => {
    return mapDailyAdmissionTrend(operationalPayload.charts?.daily_admission_trend);
  }, [operationalPayload.charts?.daily_admission_trend]);

  return {
    disasterEvents,
    barangays,
    selectedDisasterEventId,
    selectedBarangayId,
    selectedDisasterEvent,
    summaryMetrics,
    evacueesPerBarangay,
    familiesPerBarangay,
    sexDistribution,
    ageGroupDistribution,
    sectorDistribution,
    stayTypeDistribution,
    admittedVsDepartedDistribution,
    evacuationCenterDistribution,
    reliefDistributionPerBarangay,
    dailyAdmissionTrend,
    isLoadingFilters,
    isLoadingDashboard,
    errorMessage,
    hasSelectedEvent: Boolean(selectedDisasterEventId),
    hasData: Boolean(operationalPayload.has_data),
    setSelectedDisasterEventId,
    setSelectedBarangayId,
  };
};
