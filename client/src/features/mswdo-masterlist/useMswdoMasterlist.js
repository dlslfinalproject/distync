import { useEffect, useMemo, useState } from "react";
import {
  fetchActiveDisasterEvents,
  fetchBarangays,
  fetchConsolidatedMasterlist,
  fetchConsolidatedMasterlistDashboard,
  fetchDisasterEvents,
} from "./mswdoMasterlistService";
import { fetchSectors } from "../household-registration/householdRegistrationService";
import {
  isOperationallyActiveHousehold,
  mapMasterlistRow,
  sortMasterlistRows,
} from "../masterlist/masterlistService";
import {
  buildMasterlistFilterSectorOptions,
  getCanonicalMemberSectorCode,
} from "../../utils/registrationOptions";

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

const getMappedRows = (
  households,
  allHouseholds = households,
  disasterEventId = "",
) => {
  return households.map((household) => {
    const baseRow = mapMasterlistRow(household, allHouseholds, {
      disasterEventId,
    });
    const barangayName = household.barangay?.name || "";
    const addressParts = [baseRow.address];
    const sectorIds = [
      ...(household.household_sectors || []).map((sector) => sector.id),
      ...(household.members || []).flatMap((member) =>
        (member.sectors || []).map((sector) => sector.id),
      ),
    ].filter(Boolean);
    const sectorCodes = [
      ...(household.household_sectors || []).map((sector) =>
        getCanonicalMemberSectorCode(sector.code),
      ),
      ...(household.members || []).flatMap((member) =>
        (member.sectors || []).map((sector) =>
          getCanonicalMemberSectorCode(sector.code),
        ),
      ),
    ].filter(Boolean);

    if (barangayName && !String(baseRow.address).includes(barangayName)) {
      addressParts.push(`${barangayName}`);
    }

    return {
      ...baseRow,
      address: addressParts.filter(Boolean).join(" | "),
      barangay_id: household.barangay?.id || null,
      barangay_name: barangayName,
      residency_status: household.residency_status || "RESIDENT",
      sector_ids: [...new Set(sectorIds)],
      sector_codes: [...new Set(sectorCodes)],
      has_stub_issued: Boolean(household.stub),
    };
  });
};

const getStatusScopedRows = (households, recordStatus) => {
  if (recordStatus === "archived") {
    return households.filter(
      (household) => !isOperationallyActiveHousehold(household),
    );
  }

  if (recordStatus === "all") {
    return households;
  }

  return households.filter(isOperationallyActiveHousehold);
};

const getDisplayedRows = (
  rows,
  searchTerm,
  selectedSectorIds,
  selectedSortOrder = "newest",
) => {
  const normalizedSearchTerm = searchTerm.trim().toLowerCase();

  const filteredRows = rows.filter((household) => {
    const matchesSectorFilter =
      selectedSectorIds.length === 0 ||
      selectedSectorIds.some((sectorId) =>
        (household.sector_codes || []).includes(sectorId),
      );

    if (!matchesSectorFilter) {
      return false;
    }

    if (!normalizedSearchTerm) {
      return true;
    }

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

  return sortMasterlistRows(filteredRows, selectedSortOrder);
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

export const useMswdoMasterlist = () => {
  const [disasterEvents, setDisasterEvents] = useState([]);
  const [barangays, setBarangays] = useState([]);
  const [sectors, setSectors] = useState([]);
  const [selectedDisasterEventId, setSelectedDisasterEventId] = useState("");
  const [selectedBarangayId, setSelectedBarangayId] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSectorIds, setSelectedSectorIds] = useState([]);
  const [selectedSortOrder, setSelectedSortOrder] = useState("newest");
  const [recordStatus, setRecordStatus] = useState("active");
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
        const [
          eventsPayload,
          activePayload,
          barangaysPayload,
          sectorsPayload,
        ] = await Promise.all([
          fetchDisasterEvents(),
          fetchActiveDisasterEvents(),
          fetchBarangays(),
          fetchSectors(),
        ]);

        if (!isMounted) {
          return;
        }

        const allEvents = Array.isArray(eventsPayload) ? eventsPayload : [];
        const activeEvents = Array.isArray(activePayload) ? activePayload : [];
        const barangayRows = Array.isArray(barangaysPayload) ? barangaysPayload : [];
        const sectorSource = Array.isArray(sectorsPayload?.data)
          ? sectorsPayload.data
          : Array.isArray(sectorsPayload)
            ? sectorsPayload
            : [];
        const sectorRows = buildMasterlistFilterSectorOptions(sectorSource);

        setDisasterEvents(allEvents);
        setBarangays(barangayRows);
        setSectors(sectorRows);

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
          recordStatus,
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
  }, [recordStatus, reloadKey, selectedBarangayId, selectedDisasterEventId]);

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
    const allHouseholds = masterlistPayload.data || [];
    const statusScopedHouseholds = getStatusScopedRows(allHouseholds, recordStatus);

    return getMappedRows(
      statusScopedHouseholds,
      allHouseholds,
      selectedDisasterEventId,
    );
  }, [masterlistPayload.data, recordStatus, selectedDisasterEventId]);

  const displayedRows = useMemo(() => {
    return getDisplayedRows(
      mappedRows,
      searchTerm,
      selectedSectorIds,
      selectedSortOrder,
    );
  }, [mappedRows, searchTerm, selectedSectorIds, selectedSortOrder]);

  const summaryMetrics = useMemo(() => {
    return getSummaryMetrics(dashboardPayload);
  }, [dashboardPayload]);

  const selectedDisasterEvent = useMemo(() => {
    return (
      disasterEvents.find((event) => event.id === selectedDisasterEventId) || null
    );
  }, [disasterEvents, selectedDisasterEventId]);

  return {
    disasterEvents,
    barangays,
    sectors,
    selectedDisasterEventId,
    selectedBarangayId,
    selectedSectorIds,
    selectedSortOrder,
    selectedDisasterEvent,
    searchTerm,
    recordStatus,
    displayedRows,
    summaryMetrics,
    isLoadingFilters,
    isLoadingMasterlist,
    isLoadingDashboard,
    errorMessage,
    dashboardErrorMessage,
    hasDashboardData: Boolean(dashboardPayload.has_data),
    setSelectedDisasterEventId,
    setSelectedBarangayId,
    setSelectedSectorIds,
    setSelectedSortOrder,
    setSearchTerm,
    setRecordStatus,
    reloadMasterlist: () => {
      setReloadKey((currentValue) => currentValue + 1);
    },
  };
};
