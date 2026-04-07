import { useEffect, useMemo, useState } from "react";
import {
  fetchActiveDisasterEvents,
  fetchBarangays,
  fetchConsolidatedMasterlist,
  fetchDisasterEvents,
} from "./mswdoMasterlistService";

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

const getDisplayedRows = (households, searchTerm) => {
  if (!searchTerm.trim()) {
    return households;
  }

  const normalizedSearchTerm = searchTerm.trim().toLowerCase();

  return households.filter((household) => {
    const searchableValues = [
      household.family_head_name,
      household.barangay?.name,
      household.current_stay_type,
      household.contact_number,
      household.stub?.stub_no,
      household.latest_attendance?.status,
      household.current_address_details,
    ];

    return searchableValues.some((value) =>
      formatSearchValue(value).includes(normalizedSearchTerm),
    );
  });
};

const getSummary = (households) => {
  const totalEvacuees = households.reduce((total, household) => {
    return total + (household.household_size || household.members?.length || 0);
  }, 0);

  const barangayIds = new Set(
    households.map((household) => household.barangay?.id).filter(Boolean),
  );

  const withStubIssued = households.filter((household) => household.stub).length;

  return {
    totalHouseholds: households.length,
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
  const [selectedHousehold, setSelectedHousehold] = useState(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
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

  const displayedRows = useMemo(() => {
    return getDisplayedRows(masterlistPayload.data || [], searchTerm);
  }, [masterlistPayload.data, searchTerm]);

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
    selectedHousehold,
    isDetailOpen,
    isLoadingFilters,
    isLoadingMasterlist,
    errorMessage,
    setSelectedDisasterEventId,
    setSelectedBarangayId,
    setSearchTerm,
    openHouseholdDetail: (household) => {
      setSelectedHousehold(household);
      setIsDetailOpen(true);
    },
    closeHouseholdDetail: () => {
      setSelectedHousehold(null);
      setIsDetailOpen(false);
    },
    reloadMasterlist: () => {
      setReloadKey((currentValue) => currentValue + 1);
    },
  };
};
