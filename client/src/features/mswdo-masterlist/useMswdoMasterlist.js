import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ROLE_CODES } from "../../utils/roleSession";
import {
  fetchActiveDisasterEvents,
  fetchBarangays,
  fetchConsolidatedMasterlist,
  fetchConsolidatedMasterlistDashboard,
  fetchDisasterEvents,
} from "./mswdoMasterlistService";
import { fetchSectors } from "../household-registration/householdRegistrationService";
import {
  mapMasterlistRow,
} from "../masterlist/masterlistService";
import {
  DEFAULT_TABLE_PAGE_SIZE,
  TABLE_PAGE_SIZE_OPTIONS,
} from "../pagination/pagination.mjs";
import {
  buildMasterlistFilterSectorOptions,
  getCanonicalMemberSectorCode,
} from "../../utils/registrationOptions";
import {
  persistOperationalDisasterEventSelection,
  readOperationalDisasterEventId,
  readOperationalDisasterEventContext,
  resolveOperationalDisasterEventId,
} from "../disaster-events/operationalDisasterEventSelection";
import { readMswdoOfflineSnapshot } from "../offline/mswdoOfflinePreparation.js";
import { buildMswdoOfflineMasterlistPayload } from "./mswdoMasterlistOffline.js";
import { getVisibleSyncQueueEntries } from "../../offline/syncQueue.js";
import { deriveBarangayDashboardMetrics } from "../barangay-dashboard/barangayDashboardOfflineMetrics.js";
import { subscribeToSyncUpdates } from "../../offline/syncService.js";

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

const buildOfflineMswdoDashboardPayload = ({ cached, selectedEventId, selectedBarangayId, syncQueueEntries }) => {
  const projectedRows = buildMswdoOfflineMasterlistPayload({
    households: cached.datasets.masterlist.rows || [],
    mapRow: (household, allHouseholds) =>
      getMappedRows(allHouseholds, allHouseholds, selectedEventId).find(
        (row) => row.household_id === household.household_id,
      ),
    selectedBarangayId,
    recordStatus: "all",
    pageSize: Number.MAX_SAFE_INTEGER,
    basePayload: cached.datasets.masterlist.payload || emptyMasterlistPayload,
    syncQueueEntries,
    selectedEventTitle: cached.datasets.masterlist.payload?.disaster_event?.title || "",
    sectorOptions: cached.datasets.filters.sectors || [],
  });
  const baseDashboard = cached.datasets.dashboard.payload || emptyDashboardPayload;
  const rows = projectedRows.offline_all_projected_rows || [];
  const metricRows = selectedBarangayId
    ? rows.filter((row) => String(row?.barangay_id || "") === String(selectedBarangayId))
    : rows;
  const barangayIds = new Set(rows.map((row) => row?.barangay_id).filter(Boolean));
  const derived = deriveBarangayDashboardMetrics({
    rows: metricRows,
    syncQueueEntries,
    selectedEventId,
    assignedBarangayId: selectedBarangayId,
  });
  return {
    ...baseDashboard,
    has_data: rows.length > 0,
    summary_metrics: {
      ...baseDashboard.summary_metrics,
      total_number_of_evacuees_individuals: derived.total_evacuees_individuals,
      total_number_of_families: derived.total_families,
      currently_admitted_evacuees: derived.currently_admitted_evacuees,
      total_departed_evacuees: derived.total_departed_evacuees,
      total_barangays_covered: selectedBarangayId
        ? (rows.some((row) => String(row.barangay_id) === String(selectedBarangayId)) ? 1 : 0)
        : barangayIds.size,
    },
  };
};

export const useMswdoMasterlist = ({ userId = "" } = {}) => {
  const syncQueueEntries = useLiveQuery(
    () => getVisibleSyncQueueEntries(),
    [userId],
    [],
  ) || [];
  const [disasterEvents, setDisasterEvents] = useState([]);
  const [barangays, setBarangays] = useState([]);
  const [sectors, setSectors] = useState([]);
  const [selectedDisasterEventId, setSelectedDisasterEventIdState] = useState(
    () =>
      readOperationalDisasterEventId({
        roleCode: ROLE_CODES.MSWDO,
        userId,
      }) || "",
  );
  const [selectedBarangayId, setSelectedBarangayIdState] = useState("");
  const [searchTerm, setSearchTermState] = useState("");
  const [selectedSectorIds, setSelectedSectorIdsState] = useState([]);
  const [selectedSortOrder, setSelectedSortOrderState] = useState("newest");
  const [recordStatus, setRecordStatusState] = useState("active");
  const [masterlistPayload, setMasterlistPayload] = useState(emptyMasterlistPayload);
  const [dashboardPayload, setDashboardPayload] = useState(emptyDashboardPayload);
  const [isLoadingFilters, setIsLoadingFilters] = useState(true);
  const [isLoadingMasterlist, setIsLoadingMasterlist] = useState(false);
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [dashboardErrorMessage, setDashboardErrorMessage] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [currentPage, setCurrentPageState] = useState(1);
  const [pageSize, setPageSizeState] = useState(DEFAULT_TABLE_PAGE_SIZE);
  const masterlistRequestSequenceRef = useRef(0);
  const resetPage = useCallback(() => {
    setCurrentPageState(1);
  }, []);

  const setPageSize = useCallback((nextPageSize) => {
    const numericPageSize = Number(nextPageSize);

    if (!TABLE_PAGE_SIZE_OPTIONS.includes(numericPageSize)) {
      return;
    }

    setPageSizeState(numericPageSize);
    setCurrentPageState(1);
  }, []);

  const setSelectedDisasterEventId = useCallback(
    (nextEventId) => {
      const nextEvent = disasterEvents.find((event) => event.id === nextEventId);

      setSelectedDisasterEventIdState(nextEventId);
      resetPage();
      persistOperationalDisasterEventSelection({
        roleCode: ROLE_CODES.MSWDO,
        userId,
        eventId: nextEventId,
        eventScope: nextEvent?.status === "ACTIVE" ? "active" : "ended",
        event: nextEvent,
      });
    },
    [disasterEvents, resetPage, userId],
  );

  const setSelectedBarangayId = useCallback(
    (nextBarangayId) => {
      setSelectedBarangayIdState(nextBarangayId);
      resetPage();
    },
    [resetPage],
  );

  const setSelectedSectorIds = useCallback(
    (nextSectorIds) => {
      setSelectedSectorIdsState(nextSectorIds);
      resetPage();
    },
    [resetPage],
  );

  const setSelectedSortOrder = useCallback(
    (nextSortOrder) => {
      setSelectedSortOrderState(nextSortOrder);
      resetPage();
    },
    [resetPage],
  );

  const setSearchTerm = useCallback(
    (nextSearchTerm) => {
      setSearchTermState(nextSearchTerm);
      resetPage();
    },
    [resetPage],
  );

  const setRecordStatus = useCallback(
    (nextRecordStatus) => {
      setRecordStatusState(nextRecordStatus);
      resetPage();
    },
    [resetPage],
  );

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

        const restoredEvent = readOperationalDisasterEventContext({ roleCode: ROLE_CODES.MSWDO, userId });
        const allEvents = Array.isArray(eventsPayload) ? eventsPayload : restoredEvent ? [restoredEvent] : [];
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

        const storedEventId = readOperationalDisasterEventId({
          roleCode: ROLE_CODES.MSWDO,
          userId,
        });
        const fallbackEventId = activeEvents[0]?.id || allEvents[0]?.id || "";
        const nextSelectedEventId = resolveOperationalDisasterEventId({
          availableEvents: allEvents,
          preferredEventId: storedEventId,
          fallbackEventId,
        });

        setSelectedDisasterEventIdState(nextSelectedEventId);
        persistOperationalDisasterEventSelection({
          roleCode: ROLE_CODES.MSWDO,
          userId,
          eventId: nextSelectedEventId,
          eventScope:
            allEvents.find((event) => event.id === nextSelectedEventId)?.status ===
            "ACTIVE"
              ? "active"
              : "ended",
          event: allEvents.find((event) => event.id === nextSelectedEventId) || null,
        });
      } catch (error) {
        if (isMounted) {
          const restoredEvent = readOperationalDisasterEventContext({ roleCode: ROLE_CODES.MSWDO, userId });
          const cached = restoredEvent ? await readMswdoOfflineSnapshot({ userId, eventId: restoredEvent.id }) : null;
          if (cached) {
            setDisasterEvents(cached.datasets.filters.events || [restoredEvent]);
            setBarangays(cached.datasets.filters.barangays || []);
            setSectors(buildMasterlistFilterSectorOptions(cached.datasets.filters.sectors || []));
            setSelectedDisasterEventIdState(restoredEvent.id);
            setErrorMessage("");
          } else {
            setErrorMessage(error.message || "Failed to load monitoring filters");
          }
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
  }, [userId]);

  useEffect(() => {
    let isMounted = true;
    const requestSequence = masterlistRequestSequenceRef.current + 1;
    masterlistRequestSequenceRef.current = requestSequence;

    const loadMasterlist = async () => {
      if (!selectedDisasterEventId) {
        if (
          isMounted &&
          masterlistRequestSequenceRef.current === requestSequence
        ) {
          setMasterlistPayload(emptyMasterlistPayload);
        }
        return;
      }

      setIsLoadingMasterlist(true);
      setErrorMessage("");

      try {
        if (typeof navigator !== "undefined" && navigator.onLine === false) {
          const cached = await readMswdoOfflineSnapshot({
            userId,
            eventId: selectedDisasterEventId,
          });

          if (!cached) {
            throw new Error("Offline masterlist snapshot is not ready");
          }

          const completeHouseholds = cached.datasets.masterlist.rows || [];
          const offlinePayload = buildMswdoOfflineMasterlistPayload({
            households: completeHouseholds,
            mapRow: (household, allHouseholds) =>
              getMappedRows(allHouseholds, allHouseholds, selectedDisasterEventId).find(
                (row) => row.household_id === household.household_id,
              ),
            selectedBarangayId,
            recordStatus,
            searchTerm,
            selectedSectorIds,
            selectedSortOrder,
            currentPage,
            pageSize,
            basePayload: cached.datasets.masterlist.payload || {
              ...emptyMasterlistPayload,
              data: completeHouseholds,
            },
            syncQueueEntries,
            selectedEventTitle: cached.datasets.masterlist.payload?.disaster_event?.title || "",
            sectorOptions: cached.datasets.filters.sectors || [],
          });
          setMasterlistPayload(offlinePayload);
          return;
        }

        const payload = await fetchConsolidatedMasterlist({
          disasterEventId: selectedDisasterEventId,
          barangayId: selectedBarangayId || null,
          recordStatus,
          page: currentPage,
          pageSize,
          search: searchTerm,
          sectorCodes: selectedSectorIds,
          sortOrder: selectedSortOrder,
        });

        if (
          isMounted &&
          masterlistRequestSequenceRef.current === requestSequence
        ) {
          setMasterlistPayload(payload);
        }
      } catch (error) {
        if (
          isMounted &&
          masterlistRequestSequenceRef.current === requestSequence
        ) {
          const cached = await readMswdoOfflineSnapshot({ userId, eventId: selectedDisasterEventId });
          if (cached) {
            const completeHouseholds = cached.datasets.masterlist.rows || [];
            setMasterlistPayload(buildMswdoOfflineMasterlistPayload({
              households: completeHouseholds,
              mapRow: (household, allHouseholds) =>
                getMappedRows(allHouseholds, allHouseholds, selectedDisasterEventId).find(
                  (row) => row.household_id === household.household_id,
                ),
              selectedBarangayId,
              recordStatus,
              searchTerm,
              selectedSectorIds,
              selectedSortOrder,
              currentPage,
              pageSize,
              basePayload: cached.datasets.masterlist.payload || emptyMasterlistPayload,
              syncQueueEntries,
              selectedEventTitle: cached.datasets.masterlist.payload?.disaster_event?.title || "",
              sectorOptions: cached.datasets.filters.sectors || [],
            }));
            setErrorMessage("");
          } else {
            setMasterlistPayload(emptyMasterlistPayload);
            setErrorMessage(error.message || "Failed to load consolidated masterlist");
          }
        }
      } finally {
        if (
          isMounted &&
          masterlistRequestSequenceRef.current === requestSequence
        ) {
          setIsLoadingMasterlist(false);
        }
      }
    };

    loadMasterlist();

    return () => {
      isMounted = false;
    };
  }, [
    currentPage,
    pageSize,
    recordStatus,
    reloadKey,
    searchTerm,
    selectedBarangayId,
    selectedDisasterEventId,
    selectedSectorIds,
    selectedSortOrder,
    syncQueueEntries,
  ]);

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
          const cached = await readMswdoOfflineSnapshot({ userId, eventId: selectedDisasterEventId });
          if (cached) {
            setDashboardPayload(buildOfflineMswdoDashboardPayload({
              cached,
              selectedEventId: selectedDisasterEventId,
              selectedBarangayId,
              syncQueueEntries,
            }));
            setDashboardErrorMessage("");
          } else {
            setDashboardPayload(emptyDashboardPayload);
            setDashboardErrorMessage("Unable to load descriptive analytics.");
          }
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

  useEffect(() => {
    const refresh = () => setReloadKey((value) => value + 1);
    window?.addEventListener?.("online", refresh);
    return () => window?.removeEventListener?.("online", refresh);
  }, []);

  useEffect(() => subscribeToSyncUpdates(() => setReloadKey((value) => value + 1)), []);

  const mappedRows = useMemo(() => {
    const pageHouseholds = masterlistPayload.data || [];

    if (Array.isArray(masterlistPayload.offline_projected_rows)) {
      return masterlistPayload.offline_projected_rows;
    }

    return getMappedRows(
      pageHouseholds,
      pageHouseholds,
      selectedDisasterEventId,
    );
  }, [masterlistPayload.data, selectedDisasterEventId]);

  const displayedRows = mappedRows;

  const pagination = useMemo(
    () =>
      masterlistPayload.pagination || {
        page: currentPage,
        pageSize,
        totalItems: 0,
        totalPages: 0,
        hasPreviousPage: false,
        hasNextPage: false,
      },
    [currentPage, masterlistPayload.pagination, pageSize],
  );

  useEffect(() => {
    const totalPages = Number(pagination.totalPages || 0);
    const safePage =
      totalPages > 0 ? Math.min(Math.max(currentPage, 1), totalPages) : 1;

    if (currentPage !== safePage) {
      setCurrentPageState(safePage);
    }
  }, [currentPage, pagination.totalPages]);

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
    pagination,
    currentPage,
    pageSize,
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
    setCurrentPage: setCurrentPageState,
    setPageSize,
    reloadMasterlist: () => {
      setReloadKey((currentValue) => currentValue + 1);
    },
  };
};
