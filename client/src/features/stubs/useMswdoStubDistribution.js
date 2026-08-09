import { useEffect, useMemo, useState } from "react";
import {
  fetchActiveDisasterEvents,
  fetchBarangays,
  fetchDisasterEvents,
  fetchMswdoSectors,
} from "../mswdo-masterlist/mswdoMasterlistService";
import { fetchBarangayStubDashboard } from "./stubService";
import { getPendingLocalStubRows } from "./stubOfflineRows";
import { getCanonicalSectorCodeFromText } from "../../utils/sectorDisplay";
import {
  matchesStubStatusFilter,
  normalizeStubStatusFilter,
  STATUS_FILTERS,
} from "./stubStatusFilters";

const emptyMetrics = {
  total_issued_stubs: 0,
  claimed_stubs: 0,
  unclaimed_stubs: 0,
  beneficiary_families: 0,
};

const emptyDashboard = {
  metrics: emptyMetrics,
  data: [],
};

const getFriendlyErrorMessage = (error) => {
  if (error?.code === "NO_STUB_EVENT_DATA") {
    return "No stub data is available for the selected disaster event and barangay.";
  }

  return error?.message || "Unable to load the relief goods distribution page.";
};

const getMappedRows = (stubRows) =>
  stubRows.map((stubRow) => ({
    id: stubRow.id,
    household_id: stubRow.household?.id || stubRow.household_id,
    family_head_name: stubRow.household?.family_head_name || "-",
    members_count: stubRow.household?.members_count || 0,
    display_stub_no:
      stubRow.display_stub_no ||
      (stubRow.stub_sequence_no ? `STUB#${stubRow.stub_sequence_no}` : ""),
    stub_sequence_no: stubRow.stub_sequence_no || null,
    stub_number: stubRow.stub_sequence_no || "-",
    stub_no: stubRow.stub_no || "-",
    serial_no: stubRow.serial_no || "-",
    qr_code_value: stubRow.qr_code_value || "",
    qr_generated_at: stubRow.qr_generated_at || "",
    qr_generated_by: stubRow.qr_generated_by || "",
    qr_status: stubRow.qr_status || "",
    qr_notes: stubRow.qr_notes || "",
    queue_time_in: stubRow.queue_time_in || "",
    latest_attendance_status: stubRow.latest_attendance_status || "",
    unclaimed_queue_position: stubRow.unclaimed_queue_position || null,
    relief_pack_name: stubRow.relief_pack_name || "--",
    assigned_relief_packs: Array.isArray(stubRow.assigned_relief_packs)
      ? stubRow.assigned_relief_packs
      : [],
    available_donated_relief_packs: Array.isArray(
      stubRow.available_donated_relief_packs,
    )
      ? stubRow.available_donated_relief_packs
      : [],
    available_donated_loose_items: Array.isArray(
      stubRow.available_donated_loose_items,
    )
      ? stubRow.available_donated_loose_items
      : [],
    sectors_text: stubRow.sectors_text || "-",
    sector_ids: Array.isArray(stubRow.sector_ids) ? stubRow.sector_ids : [],
    status: stubRow.status,
  }));

const getDisplayedRows = (rows, searchTerm, selectedSectorIds, selectedStubStatus) => {
  const normalizedSearchTerm = searchTerm.trim().toLowerCase();
  const selectedSectorIdSet = new Set(selectedSectorIds);
  const normalizedStubStatus = normalizeStubStatusFilter(selectedStubStatus);

  return rows.filter((row) => {
    const rowSectorCodes = String(row.sectors_text || "")
      .split(",")
      .map((sectorName) => getCanonicalSectorCodeFromText(sectorName))
      .filter(Boolean);
    const matchesSectorFilter =
      selectedSectorIds.length === 0 ||
      (row.sector_ids || []).some((sectorId) => selectedSectorIdSet.has(sectorId)) ||
      rowSectorCodes.some((sectorCode) => selectedSectorIdSet.has(sectorCode));

    if (!matchesSectorFilter) {
      return false;
    }

    if (!matchesStubStatusFilter(row.status, normalizedStubStatus)) {
      return false;
    }

    if (!normalizedSearchTerm) {
      return true;
    }

    const searchableValues = [
      row.family_head_name,
      row.sectors_text,
      row.display_stub_no,
      row.stub_number,
    ];

    return searchableValues.some((value) =>
      String(value || "")
        .toLowerCase()
        .includes(normalizedSearchTerm),
    );
  });
};

const getAffectedBarangayIds = (event) => {
  if (!Array.isArray(event?.affected_barangays)) {
    return [];
  }

  return event.affected_barangays
    .map((barangay) => {
      if (typeof barangay === "string") {
        return barangay;
      }

      return barangay?.id || barangay?.barangay_id || "";
    })
    .filter(Boolean);
};

export const useMswdoStubDistribution = () => {
  const [disasterEvents, setDisasterEvents] = useState([]);
  const [barangays, setBarangays] = useState([]);
  const [sectors, setSectors] = useState([]);
  const [selectedDisasterEventId, setSelectedDisasterEventId] = useState("");
  const [selectedBarangayId, setSelectedBarangayId] = useState("");
  const [selectedSectorIds, setSelectedSectorIds] = useState([]);
  const [selectedStubStatus, setSelectedStubStatus] = useState(
    STATUS_FILTERS.ALL,
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [dashboard, setDashboard] = useState(emptyDashboard);
  const [pendingLocalRows, setPendingLocalRows] = useState([]);
  const [isLoadingFilters, setIsLoadingFilters] = useState(true);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
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
          fetchMswdoSectors(),
        ]);

        if (!isMounted) {
          return;
        }

        const allEvents = Array.isArray(eventsPayload) ? eventsPayload : [];
        const activeEvents = Array.isArray(activePayload) ? activePayload : [];
        const barangayRows = Array.isArray(barangaysPayload) ? barangaysPayload : [];
        const sectorRows = Array.isArray(sectorsPayload) ? sectorsPayload : [];

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
          setErrorMessage(
            error.message || "Failed to load relief distribution filters.",
          );
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

    const loadDistributionData = async () => {
      if (!selectedDisasterEventId || !selectedBarangayId) {
        setDashboard(emptyDashboard);
        setErrorMessage("");
        setIsLoadingData(false);
        return;
      }

      setIsLoadingData(true);
      setErrorMessage("");

      try {
        const dashboardPayload = await fetchBarangayStubDashboard({
          userId: null,
          disasterEventId: selectedDisasterEventId,
          overrideBarangayId: selectedBarangayId,
        });

        if (!isMounted) {
          return;
        }

        const serverRows = Array.isArray(dashboardPayload.data)
          ? dashboardPayload.data
          : [];
        const localRows = await getPendingLocalStubRows({
          disasterEventId: selectedDisasterEventId,
          barangayId: selectedBarangayId,
          sectorOptions: sectors,
          existingHouseholdIds: serverRows.map(
            (row) => row.household?.id || row.household_id,
          ),
        });

        setDashboard({
          metrics: dashboardPayload.metrics || emptyMetrics,
          data: serverRows,
        });
        setPendingLocalRows(localRows);
      } catch (error) {
        if (isMounted) {
          const localRows = await getPendingLocalStubRows({
            disasterEventId: selectedDisasterEventId,
            barangayId: selectedBarangayId,
            sectorOptions: sectors,
          });

          setDashboard(emptyDashboard);
          setPendingLocalRows(localRows);
          setErrorMessage(
            localRows.length > 0 ? "" : getFriendlyErrorMessage(error),
          );
        }
      } finally {
        if (isMounted) {
          setIsLoadingData(false);
        }
      }
    };

    loadDistributionData();

    return () => {
      isMounted = false;
    };
  }, [reloadKey, sectors, selectedBarangayId, selectedDisasterEventId]);

  const rows = useMemo(() => {
    return [...pendingLocalRows, ...getMappedRows(dashboard.data || [])];
  }, [dashboard.data, pendingLocalRows]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const handleSyncQueueUpdated = () => {
      setReloadKey((currentValue) => currentValue + 1);
    };

    window.addEventListener("distync-sync-queue-updated", handleSyncQueueUpdated);

    return () => {
      window.removeEventListener(
        "distync-sync-queue-updated",
        handleSyncQueueUpdated,
      );
    };
  }, []);

  const displayedRows = useMemo(() => {
    return getDisplayedRows(
      rows,
      searchTerm,
      selectedSectorIds,
      selectedStubStatus,
    );
  }, [rows, searchTerm, selectedSectorIds, selectedStubStatus]);

  const summaryCards = useMemo(() => {
    return [
      {
        label: "Total Issued Stubs",
        value: dashboard.metrics.total_issued_stubs || 0,
      },
      {
        label: "Beneficiary Families",
        value: dashboard.metrics.beneficiary_families || 0,
      },
      {
        label: "Claimed Stubs",
        value: dashboard.metrics.claimed_stubs || 0,
      },
      {
        label: "For Claim Stubs",
        value: dashboard.metrics.unclaimed_stubs || 0,
      },
    ];
  }, [dashboard.metrics]);

  const selectedDisasterEvent = useMemo(() => {
    return (
      disasterEvents.find((event) => event.id === selectedDisasterEventId) || null
    );
  }, [disasterEvents, selectedDisasterEventId]);

  const selectableBarangays = useMemo(() => {
    const affectedBarangayIds = getAffectedBarangayIds(selectedDisasterEvent);

    if (affectedBarangayIds.length === 0) {
      return [];
    }

    return barangays.filter((barangay) => affectedBarangayIds.includes(barangay.id));
  }, [barangays, selectedDisasterEvent]);

  const selectedBarangay = useMemo(() => {
    return barangays.find((barangay) => barangay.id === selectedBarangayId) || null;
  }, [barangays, selectedBarangayId]);

  useEffect(() => {
    if (!selectedDisasterEventId || selectableBarangays.length === 0) {
      if (selectedBarangayId) {
        setSelectedBarangayId("");
      }
      return;
    }

    const isSelectedBarangayAvailable = selectableBarangays.some(
      (barangay) => barangay.id === selectedBarangayId,
    );

    if (!isSelectedBarangayAvailable) {
      setSelectedBarangayId(selectableBarangays[0].id);
    }
  }, [selectableBarangays, selectedBarangayId, selectedDisasterEventId]);

  return {
    disasterEvents,
    barangays: selectableBarangays,
    allBarangays: barangays,
    sectors,
    selectedDisasterEventId,
    selectedBarangayId,
    selectedSectorIds,
    selectedStubStatus,
    selectedDisasterEvent,
    selectedBarangay,
    searchTerm,
    displayedRows,
    summaryCards,
    isLoadingFilters,
    isLoadingData,
    errorMessage,
    hasSelectedEvent: Boolean(selectedDisasterEventId),
    hasSelectedBarangay: Boolean(selectedBarangayId),
    setSelectedDisasterEventId,
    setSelectedBarangayId,
    setSelectedSectorIds,
    setSelectedStubStatus,
    setSearchTerm,
    reloadDashboard: () => {
      setReloadKey((currentValue) => currentValue + 1);
    },
  };
};
