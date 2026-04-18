import { useEffect, useMemo, useState } from "react";
import {
  fetchActiveDisasterEvents,
  fetchBarangays,
  fetchConsolidatedMasterlist,
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

const getSummary = (rows) => {
  const totalEvacuees = rows.reduce((total, household) => {
    return total + (household.members_count || 0);
  }, 0);

  const barangayIds = new Set(
    rows.map((household) => household.barangay_id).filter(Boolean),
  );

  const withStubIssued = rows.filter((household) => household.has_stub_issued).length;

  return {
    totalHouseholds: rows.length,
    totalEvacuees,
    barangaysCovered: barangayIds.size,
    withStubIssued,
  };
};

export const useMswdoMasterlist = () => {
  const [disasterEvents, setDisasterEvents] = useState([]);
  const [barangays, setBarangays] = useState([]);
  const [selectedDisasterEventId, setSelectedDisasterEventId] = useState("");
  const [selectedBarangayId, setSelectedBarangayId] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [masterlistPayload, setMasterlistPayload] = useState(emptyMasterlistPayload);
  const [isLoadingFilters, setIsLoadingFilters] = useState(true);
  const [isLoadingMasterlist, setIsLoadingMasterlist] = useState(false);
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

  const mappedRows = useMemo(() => {
    return getMappedRows(masterlistPayload.data || []);
  }, [masterlistPayload.data]);

  const displayedRows = useMemo(() => {
    return getDisplayedRows(mappedRows, searchTerm);
  }, [mappedRows, searchTerm]);

  const summary = useMemo(() => {
    return getSummary(displayedRows);
  }, [displayedRows]);

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
    summary,
    isLoadingFilters,
    isLoadingMasterlist,
    errorMessage,
    setSelectedDisasterEventId,
    setSelectedBarangayId,
    setSearchTerm,
    reloadMasterlist: () => {
      setReloadKey((currentValue) => currentValue + 1);
    },
  };
};
