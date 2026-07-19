import { useEffect, useMemo, useState } from "react";
import {
  fetchActiveDisasterEvents,
  fetchBarangays,
  fetchDisasterEvents,
  fetchMasterlistOperationalAnalytics,
} from "./mswdoAnalyticsService";
import {
  AGE_BASED_MEMBER_SECTOR_CODES,
  DISPLAY_MEMBER_SECTOR_CODES,
  HOUSEHOLD_CONDITION_CODES,
  formatMasterlistFilterSectorLabel,
  getCanonicalMemberSectorCode,
} from "../../utils/registrationOptions";

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

const getSectorChartCode = (item) => {
  return getCanonicalMemberSectorCode(item?.code || item?.name || "");
};

const mapSectorDistribution = (items = []) => {
  return items
    .map((item) => {
      const code = getSectorChartCode(item);

      return {
        code,
        name: formatMasterlistFilterSectorLabel(code) || item.name || "Unknown",
        sectorGroup: item.sector_group || item.sectorGroup || "",
        value: Number(item.value || 0),
      };
    })
    .filter((item) => item.value > 0);
};

const orderSectorDistribution = (items, orderedCodes) => {
  const orderIndexByCode = new Map(
    orderedCodes.map((sectorCode, index) => [sectorCode, index]),
  );

  return [...items].sort((left, right) => {
    const leftIndex = orderIndexByCode.get(left.code) ?? Number.MAX_SAFE_INTEGER;
    const rightIndex = orderIndexByCode.get(right.code) ?? Number.MAX_SAFE_INTEGER;

    if (leftIndex !== rightIndex) {
      return leftIndex - rightIndex;
    }

    return left.name.localeCompare(right.name);
  });
};

const mapPerBarangayCounts = (items, valueKey) => {
  return items
    .map((item) => ({
      name: item.barangay_name,
      value: Number(item[valueKey] || 0),
    }))
    .sort((firstItem, secondItem) =>
      firstItem.name.localeCompare(secondItem.name),
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

const mapBarangayCoverageDistribution = ({
  barangayCount,
  coveredCount,
  selectedBarangayId,
}) => {
  const safeCoveredCount = Number(coveredCount || 0);

  if (selectedBarangayId) {
    return safeCoveredCount > 0
      ? [
          {
            name: "Covered",
            value: safeCoveredCount,
          },
        ]
      : [];
  }

  const safeBarangayCount = Number(barangayCount || 0);

  if (safeBarangayCount === 0 && safeCoveredCount === 0) {
    return [];
  }

  const totalBarangays = Math.max(safeBarangayCount, safeCoveredCount);
  const notCoveredCount = Math.max(totalBarangays - safeCoveredCount, 0);

  return [
    {
      name: "Covered",
      value: safeCoveredCount,
    },
    {
      name: "Not Covered",
      value: notCoveredCount,
    },
  ].filter((item) => item.value > 0);
};

const getAffectedBarangayIds = (event) => {
  const barangayRows = event?.affected_barangays || event?.barangays || [];
  const barangayIds = event?.affected_barangay_ids || event?.barangay_ids || [];

  if (Array.isArray(barangayIds) && barangayIds.length > 0) {
    return barangayIds.filter(Boolean);
  }

  if (!Array.isArray(barangayRows)) {
    return [];
  }

  return barangayRows
    .map((barangay) => {
      if (typeof barangay === "string") {
        return barangay;
      }

      return barangay?.id || barangay?.barangay_id || barangay?.barangay?.id || "";
    })
    .filter(Boolean);
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

  const selectableBarangays = useMemo(() => {
    const affectedBarangayIds = getAffectedBarangayIds(selectedDisasterEvent);

    if (affectedBarangayIds.length === 0) {
      return barangays;
    }

    const affectedBarangayIdSet = new Set(affectedBarangayIds);

    return barangays.filter((barangay) => affectedBarangayIdSet.has(barangay.id));
  }, [barangays, selectedDisasterEvent]);

  useEffect(() => {
    if (!selectedBarangayId) {
      return;
    }

    const isSelectedBarangayAvailable = selectableBarangays.some(
      (barangay) => barangay.id === selectedBarangayId,
    );

    if (!isSelectedBarangayAvailable) {
      setSelectedBarangayId("");
    }
  }, [selectableBarangays, selectedBarangayId]);

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
    return mapSectorDistribution(operationalPayload.charts?.sector_distribution);
  }, [operationalPayload.charts?.sector_distribution]);

  const ageBasedSectorDistribution = useMemo(() => {
    return orderSectorDistribution(
      sectorDistribution.filter((item) =>
        AGE_BASED_MEMBER_SECTOR_CODES.includes(item.code),
      ),
      AGE_BASED_MEMBER_SECTOR_CODES,
    );
  }, [sectorDistribution]);

  const nonAgeBasedSectorDistribution = useMemo(() => {
    const nonAgeBasedCodes = DISPLAY_MEMBER_SECTOR_CODES.filter(
      (sectorCode) => !AGE_BASED_MEMBER_SECTOR_CODES.includes(sectorCode),
    );

    return orderSectorDistribution(
      sectorDistribution.filter((item) => nonAgeBasedCodes.includes(item.code)),
      nonAgeBasedCodes,
    );
  }, [sectorDistribution]);

  const householdConditionDistribution = useMemo(() => {
    return orderSectorDistribution(
      sectorDistribution.filter((item) =>
        HOUSEHOLD_CONDITION_CODES.includes(item.code),
      ),
      HOUSEHOLD_CONDITION_CODES,
    );
  }, [sectorDistribution]);

  const stayTypeDistribution = useMemo(() => {
    return mapSimpleDistribution(operationalPayload.charts?.stay_type_distribution);
  }, [operationalPayload.charts?.stay_type_distribution]);

  const admittedVsDepartedDistribution = useMemo(() => {
    return mapAdmittedVsDepartedDistribution(
      operationalPayload.summary_metrics || emptyOperationalPayload.summary_metrics,
    );
  }, [operationalPayload.summary_metrics]);

  const barangayCoverageDistribution = useMemo(() => {
    return mapBarangayCoverageDistribution({
      barangayCount: barangays.length,
      coveredCount: summaryMetrics.totalBarangaysCovered,
      selectedBarangayId,
    });
  }, [barangays.length, selectedBarangayId, summaryMetrics.totalBarangaysCovered]);

  const evacuationCenterDistribution = useMemo(() => {
    return mapSimpleDistribution(
      operationalPayload.charts?.evacuation_center_distribution,
    );
  }, [operationalPayload.charts?.evacuation_center_distribution]);

  return {
    disasterEvents,
    barangays: selectableBarangays,
    allBarangays: barangays,
    selectedDisasterEventId,
    selectedBarangayId,
    selectedDisasterEvent,
    summaryMetrics,
    evacueesPerBarangay,
    familiesPerBarangay,
    sexDistribution,
    ageGroupDistribution,
    ageBasedSectorDistribution,
    nonAgeBasedSectorDistribution,
    householdConditionDistribution,
    stayTypeDistribution,
    admittedVsDepartedDistribution,
    barangayCoverageDistribution,
    evacuationCenterDistribution,
    isLoadingFilters,
    isLoadingDashboard,
    errorMessage,
    hasSelectedEvent: Boolean(selectedDisasterEventId),
    hasData: Boolean(operationalPayload.has_data),
    setSelectedDisasterEventId,
    setSelectedBarangayId,
  };
};
