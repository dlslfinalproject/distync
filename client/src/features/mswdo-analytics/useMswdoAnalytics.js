import { useEffect, useMemo, useState } from "react";
import {
  fetchActiveDisasterEvents,
  fetchBarangays,
  fetchDisasterEvents,
  fetchMasterlistAnalyticsSource,
} from "./mswdoAnalyticsService";

const emptyPayload = {
  disaster_event: null,
  filters: {
    disaster_event_id: null,
    barangay_id: null,
  },
  count: 0,
  data: [],
};

const sortByValueDescending = (items) => {
  return [...items].sort((firstItem, secondItem) => secondItem.value - firstItem.value);
};

const getSummaryMetrics = (households) => {
  const totalHouseholds = households.length;
  const totalEvacuees = households.reduce((total, household) => {
    return total + (household.household_size || household.members?.length || 0);
  }, 0);

  const barangayIds = new Set(
    households.map((household) => household.barangay?.id).filter(Boolean),
  );

  const averageHouseholdSize =
    totalHouseholds > 0 ? (totalEvacuees / totalHouseholds).toFixed(1) : "0.0";

  return {
    totalHouseholds,
    totalEvacuees,
    totalBarangaysCovered: barangayIds.size,
    averageHouseholdSize,
  };
};

const getEvacueesPerBarangay = (households) => {
  const countsByBarangay = households.reduce((groups, household) => {
    const barangayName = household.barangay?.name || "Unknown";
    const householdSize = household.household_size || household.members?.length || 0;

    groups[barangayName] = (groups[barangayName] || 0) + householdSize;
    return groups;
  }, {});

  return sortByValueDescending(
    Object.entries(countsByBarangay).map(([name, value]) => ({
      name,
      value,
    })),
  );
};

const getHouseholdsPerBarangay = (households) => {
  const countsByBarangay = households.reduce((groups, household) => {
    const barangayName = household.barangay?.name || "Unknown";
    groups[barangayName] = (groups[barangayName] || 0) + 1;
    return groups;
  }, {});

  return sortByValueDescending(
    Object.entries(countsByBarangay).map(([name, value]) => ({
      name,
      value,
    })),
  );
};

const getSectorDistribution = (households) => {
  const sectorCounts = households.reduce((groups, household) => {
    const householdSectors = household.household_sectors || [];
    const memberSectors = (household.members || []).flatMap(
      (member) => member.sectors || [],
    );

    [...householdSectors, ...memberSectors].forEach((sector) => {
      const sectorName = sector.name || sector.code || "Unknown";
      groups[sectorName] = (groups[sectorName] || 0) + 1;
    });

    return groups;
  }, {});

  return sortByValueDescending(
    Object.entries(sectorCounts).map(([name, value]) => ({
      name,
      value,
    })),
  );
};

const getStayTypeDistribution = (households) => {
  const countsByStayType = households.reduce((groups, household) => {
    const stayType = household.current_stay_type || "UNSPECIFIED";
    groups[stayType] = (groups[stayType] || 0) + 1;
    return groups;
  }, {});

  return sortByValueDescending(
    Object.entries(countsByStayType).map(([name, value]) => ({
      name,
      value,
    })),
  );
};

export const useMswdoAnalytics = () => {
  const [disasterEvents, setDisasterEvents] = useState([]);
  const [barangays, setBarangays] = useState([]);
  const [selectedDisasterEventId, setSelectedDisasterEventId] = useState("");
  const [selectedBarangayId, setSelectedBarangayId] = useState("");
  const [masterlistPayload, setMasterlistPayload] = useState(emptyPayload);
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

    const loadDashboardSource = async () => {
      if (!selectedDisasterEventId) {
        setMasterlistPayload(emptyPayload);
        return;
      }

      setIsLoadingDashboard(true);
      setErrorMessage("");

      try {
        const payload = await fetchMasterlistAnalyticsSource({
          disasterEventId: selectedDisasterEventId,
          barangayId: selectedBarangayId || null,
        });

        if (isMounted) {
          setMasterlistPayload(payload);
        }
      } catch (error) {
        if (isMounted) {
          setMasterlistPayload(emptyPayload);
          setErrorMessage(error.message || "Failed to load analytics dashboard");
        }
      } finally {
        if (isMounted) {
          setIsLoadingDashboard(false);
        }
      }
    };

    loadDashboardSource();

    return () => {
      isMounted = false;
    };
  }, [selectedBarangayId, selectedDisasterEventId]);

  const selectedDisasterEvent = useMemo(() => {
    return (
      disasterEvents.find((event) => event.id === selectedDisasterEventId) || null
    );
  }, [disasterEvents, selectedDisasterEventId]);

  const households = masterlistPayload.data || [];

  const summaryMetrics = useMemo(() => {
    return getSummaryMetrics(households);
  }, [households]);

  const evacueesPerBarangay = useMemo(() => {
    return getEvacueesPerBarangay(households);
  }, [households]);

  const householdsPerBarangay = useMemo(() => {
    return getHouseholdsPerBarangay(households);
  }, [households]);

  const sectorDistribution = useMemo(() => {
    return getSectorDistribution(households);
  }, [households]);

  const stayTypeDistribution = useMemo(() => {
    return getStayTypeDistribution(households);
  }, [households]);

  return {
    disasterEvents,
    barangays,
    selectedDisasterEventId,
    selectedBarangayId,
    selectedDisasterEvent,
    summaryMetrics,
    evacueesPerBarangay,
    householdsPerBarangay,
    sectorDistribution,
    stayTypeDistribution,
    isLoadingFilters,
    isLoadingDashboard,
    errorMessage,
    hasSelectedEvent: Boolean(selectedDisasterEventId),
    hasData: households.length > 0,
    setSelectedDisasterEventId,
    setSelectedBarangayId,
  };
};
