import { useEffect, useMemo, useState } from "react";
import { mapMasterlistRow } from "../masterlist/masterlistService";
import {
  fetchActiveDisasterEvents,
  fetchBarangays,
  fetchConsolidatedMasterlist,
  fetchDisasterEvents,
} from "../mswdo-masterlist/mswdoMasterlistService";
import { fetchBarangayStubDashboard } from "./stubService";

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

const emptyMasterlistPayload = {
  data: [],
};

const getFriendlyErrorMessage = (error) => {
  if (error?.code === "NO_STUB_EVENT_DATA") {
    return "No stub data is available for the selected disaster event and barangay.";
  }

  return error?.message || "Unable to load the relief goods distribution page.";
};

const getMappedRows = (households, stubRows) => {
  const stubRowsByHouseholdId = Object.fromEntries(
    stubRows.map((row) => [row.household?.id || row.household_id, row]),
  );

  return households.reduce((rows, household) => {
    const stubRow = stubRowsByHouseholdId[household.household_id];

    if (!stubRow) {
      return rows;
    }

    const mappedHousehold = mapMasterlistRow(household);

    rows.push({
      id: stubRow.id,
      household_id: household.household_id,
      family_head_name: mappedHousehold.family_head_name,
      address: mappedHousehold.address,
      stub_number: stubRow.stub_sequence_no || stubRow.stub_no || "-",
      stub_no: stubRow.stub_no || household.stub?.stub_no || "-",
      sectors_text: mappedHousehold.sectors_text,
      status: stubRow.status,
    });

    return rows;
  }, []);
};

const getDisplayedRows = (rows, searchTerm) => {
  if (!searchTerm.trim()) {
    return rows;
  }

  const normalizedSearchTerm = searchTerm.trim().toLowerCase();

  return rows.filter((row) => {
    const searchableValues = [
      row.family_head_name,
      row.address,
      row.stub_number,
      row.stub_no,
      row.sectors_text,
      row.status,
    ];

    return searchableValues.some((value) =>
      String(value || "")
        .toLowerCase()
        .includes(normalizedSearchTerm),
    );
  });
};

export const useMswdoStubDistribution = () => {
  const [disasterEvents, setDisasterEvents] = useState([]);
  const [barangays, setBarangays] = useState([]);
  const [selectedDisasterEventId, setSelectedDisasterEventId] = useState("");
  const [selectedBarangayId, setSelectedBarangayId] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [dashboard, setDashboard] = useState(emptyDashboard);
  const [masterlistPayload, setMasterlistPayload] = useState(emptyMasterlistPayload);
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
        setMasterlistPayload(emptyMasterlistPayload);
        setErrorMessage("");
        setIsLoadingData(false);
        return;
      }

      setIsLoadingData(true);
      setErrorMessage("");

      try {
        const [dashboardPayload, masterlistData] = await Promise.all([
          fetchBarangayStubDashboard({
            userId: null,
            disasterEventId: selectedDisasterEventId,
            overrideBarangayId: selectedBarangayId,
          }),
          fetchConsolidatedMasterlist({
            disasterEventId: selectedDisasterEventId,
            barangayId: selectedBarangayId,
          }),
        ]);

        if (!isMounted) {
          return;
        }

        setDashboard({
          metrics: dashboardPayload.metrics || emptyMetrics,
          data: Array.isArray(dashboardPayload.data) ? dashboardPayload.data : [],
        });
        setMasterlistPayload(masterlistData || emptyMasterlistPayload);
      } catch (error) {
        if (isMounted) {
          setDashboard(emptyDashboard);
          setMasterlistPayload(emptyMasterlistPayload);
          setErrorMessage(getFriendlyErrorMessage(error));
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
  }, [reloadKey, selectedBarangayId, selectedDisasterEventId]);

  const rows = useMemo(() => {
    return getMappedRows(masterlistPayload.data || [], dashboard.data || []);
  }, [dashboard.data, masterlistPayload.data]);

  const displayedRows = useMemo(() => {
    return getDisplayedRows(rows, searchTerm);
  }, [rows, searchTerm]);

  const summaryCards = useMemo(() => {
    return [
      {
        label: "Total Number of Issued Stubs",
        value: dashboard.metrics.total_issued_stubs || 0,
        helperText: "All issued stubs for the selected disaster event and barangay.",
      },
      {
        label: "Total Number of Claimed Stubs",
        value: dashboard.metrics.claimed_stubs || 0,
        helperText: "Stubs with a status of CLAIMED.",
      },
      {
        label: "Total Number of Unclaimed Stubs",
        value: dashboard.metrics.unclaimed_stubs || 0,
        helperText: "Stubs with a status of ISSUED.",
      },
      {
        label: "Total Number of Beneficiaries Family",
        value: dashboard.metrics.beneficiary_families || 0,
        helperText:
          "Distinct stubbed households currently staying in evacuation centers.",
      },
    ];
  }, [dashboard.metrics]);

  const selectedDisasterEvent = useMemo(() => {
    return (
      disasterEvents.find((event) => event.id === selectedDisasterEventId) || null
    );
  }, [disasterEvents, selectedDisasterEventId]);

  const selectedBarangay = useMemo(() => {
    return barangays.find((barangay) => barangay.id === selectedBarangayId) || null;
  }, [barangays, selectedBarangayId]);

  return {
    disasterEvents,
    barangays,
    selectedDisasterEventId,
    selectedBarangayId,
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
    setSearchTerm,
    reloadDashboard: () => {
      setReloadKey((currentValue) => currentValue + 1);
    },
  };
};
