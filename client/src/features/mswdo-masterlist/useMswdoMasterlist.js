import { useEffect, useMemo, useState } from "react";
import {
  fetchActiveDisasterEvents,
  fetchBarangays,
  fetchConsolidatedMasterlist,
  fetchConsolidatedMasterlistDashboard,
  fetchDisasterEvents,
} from "./mswdoMasterlistService";
import { mapMasterlistRow } from "../masterlist/masterlistService";

const emptyMasterlistPayload = {
  disaster_event: null,
  filters: {
    disaster_event_id: null,
    barangay_id: null,
  },
  count: 0,
  data: [],
};

const emptyDashboardPayload = {
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
  },
  has_data: false,
};

const formatSearchValue = (value) => {
  return value ? String(value).toLowerCase() : "";
};

const getMappedRows = (households) => {
  return households.map((household) => ({
    ...mapMasterlistRow(household),
    barangay_id: household.barangay?.id || null,
    barangay_name: household.barangay?.name || "",
    has_stub_issued: Boolean(household.stub),
  }));
};

const getDisplayedRows = (rows, searchTerm) => {
  if (!searchTerm.trim()) {
    return rows;
  }

  const normalizedSearchTerm = searchTerm.trim().toLowerCase();

  return rows.filter((household) => {
    const searchableValues = [
      household.family_head_name,
      household.address,
      household.sectors_text,
      household.arrival_time_text,
      household.departure_time_text,
      household.barangay_name,
    ];

    return searchableValues.some((value) =>
      formatSearchValue(value).includes(normalizedSearchTerm),
    );
  });
};

const sortByValueDescending = (items) => {
  return [...items].sort((firstItem, secondItem) => secondItem.value - firstItem.value);
};

const getSummaryMetrics = (dashboardPayload) => {
  const summary = dashboardPayload.summary_metrics || emptyDashboardPayload.summary_metrics;

  return {
    totalNumberOfEvacueesIndividuals: Number(
      summary.total_number_of_evacuees_individuals || 0,
    ),
    totalNumberOfFamilies: Number(summary.total_number_of_families || 0),
    averageHouseholdSize: Number(summary.average_household_size || 0).toFixed(1),
    currentlyAdmittedEvacuees: Number(summary.currently_admitted_evacuees || 0),
    totalDepartedEvacuees: Number(summary.total_departed_evacuees || 0),
    totalBarangaysCovered: Number(summary.total_barangays_covered || 0),
  };
};

const getPerBarangayDataset = (dashboardPayload) => {
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

const getEvacueesPerBarangayChart = (perBarangayDataset) => {
  return sortByValueDescending(
    perBarangayDataset.map((item) => ({
      name: item.barangay_name,
      value: item.evacuees_count,
    })),
  );
};

const getFamiliesPerBarangayChart = (perBarangayDataset) => {
  return sortByValueDescending(
    perBarangayDataset.map((item) => ({
      name: item.barangay_name,
      value: item.families_count,
    })),
  );
};

const getAdmittedVsDepartedDistribution = (dashboardPayload) => {
  const summary = dashboardPayload.summary_metrics || emptyDashboardPayload.summary_metrics;

  return [
    {
      name: "Currently Admitted",
      value: Number(summary.currently_admitted_evacuees || 0),
    },
    {
      name: "Departed",
      value: Number(summary.total_departed_evacuees || 0),
    },
  ].filter((item) => item.value > 0);
};

const getBarangayBreakdownChart = (perBarangayDataset) => {
  return perBarangayDataset.map((item) => ({
    name: item.barangay_name,
    admitted: item.admitted_evacuees_count,
    departed: item.departed_evacuees_count,
  }));
};

export const useMswdoMasterlist = () => {
  const [disasterEvents, setDisasterEvents] = useState([]);
  const [barangays, setBarangays] = useState([]);
  const [selectedDisasterEventId, setSelectedDisasterEventId] = useState("");
  const [selectedBarangayId, setSelectedBarangayId] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [masterlistPayload, setMasterlistPayload] = useState(emptyMasterlistPayload);
  const [dashboardPayload, setDashboardPayload] = useState(emptyDashboardPayload);
  const [isLoadingFilters, setIsLoadingFilters] = useState(true);
  const [isLoadingMasterlist, setIsLoadingMasterlist] = useState(false);
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [dashboardErrorMessage, setDashboardErrorMessage] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

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
          setErrorMessage(error.message || "Failed to load monitoring filters");
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

    const loadMasterlist = async () => {
      if (!selectedDisasterEventId) {
        setMasterlistPayload(emptyMasterlistPayload);
        return;
      }

      setIsLoadingMasterlist(true);
      setErrorMessage("");

      try {
        const payload = await fetchConsolidatedMasterlist({
          disasterEventId: selectedDisasterEventId,
          barangayId: selectedBarangayId || null,
        });

        if (isMounted) {
          setMasterlistPayload(payload);
        }
      } catch (error) {
        if (isMounted) {
          setMasterlistPayload(emptyMasterlistPayload);
          setErrorMessage(error.message || "Failed to load consolidated masterlist");
        }
      } finally {
        if (isMounted) {
          setIsLoadingMasterlist(false);
        }
      }
    };

    loadMasterlist();

    return () => {
      isMounted = false;
    };
  }, [reloadKey, selectedBarangayId, selectedDisasterEventId]);

  useEffect(() => {
    let isMounted = true;

    const loadDashboard = async () => {
      if (!selectedDisasterEventId) {
        setDashboardPayload(emptyDashboardPayload);
        return;
      }

      setIsLoadingDashboard(true);
      setDashboardErrorMessage("");

      try {
        const payload = await fetchConsolidatedMasterlistDashboard({
          disasterEventId: selectedDisasterEventId,
          barangayId: selectedBarangayId || null,
        });

        if (isMounted) {
          setDashboardPayload(payload);
        }
      } catch (error) {
        if (isMounted) {
          setDashboardPayload(emptyDashboardPayload);
          setDashboardErrorMessage("Unable to load descriptive analytics.");
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
  }, [reloadKey, selectedBarangayId, selectedDisasterEventId]);

  const mappedRows = useMemo(() => {
    return getMappedRows(masterlistPayload.data || []);
  }, [masterlistPayload.data]);

  const displayedRows = useMemo(() => {
    return getDisplayedRows(mappedRows, searchTerm);
  }, [mappedRows, searchTerm]);

  const summaryMetrics = useMemo(() => {
    return getSummaryMetrics(dashboardPayload);
  }, [dashboardPayload]);

  const perBarangayDataset = useMemo(() => {
    return getPerBarangayDataset(dashboardPayload);
  }, [dashboardPayload]);

  const evacueesPerBarangay = useMemo(() => {
    return getEvacueesPerBarangayChart(perBarangayDataset);
  }, [perBarangayDataset]);

  const familiesPerBarangay = useMemo(() => {
    return getFamiliesPerBarangayChart(perBarangayDataset);
  }, [perBarangayDataset]);

  const admittedVsDepartedDistribution = useMemo(() => {
    return getAdmittedVsDepartedDistribution(dashboardPayload);
  }, [dashboardPayload]);

  const barangayBreakdown = useMemo(() => {
    return getBarangayBreakdownChart(perBarangayDataset);
  }, [perBarangayDataset]);

  const selectedDisasterEvent = useMemo(() => {
    return (
      disasterEvents.find((event) => event.id === selectedDisasterEventId) || null
    );
  }, [disasterEvents, selectedDisasterEventId]);

  return {
    disasterEvents,
    barangays,
    selectedDisasterEventId,
    selectedBarangayId,
    selectedDisasterEvent,
    searchTerm,
    displayedRows,
    summaryMetrics,
    evacueesPerBarangay,
    familiesPerBarangay,
    admittedVsDepartedDistribution,
    barangayBreakdown,
    isLoadingFilters,
    isLoadingMasterlist,
    isLoadingDashboard,
    errorMessage,
    dashboardErrorMessage,
    hasDashboardData: Boolean(dashboardPayload.has_data),
    setSelectedDisasterEventId,
    setSelectedBarangayId,
    setSearchTerm,
    reloadMasterlist: () => {
      setReloadKey((currentValue) => currentValue + 1);
    },
  };
};
