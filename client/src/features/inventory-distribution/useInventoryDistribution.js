import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  fetchBarangays,
  fetchConsolidatedMasterlist,
  fetchMswdoSectors,
} from "../mswdo-masterlist/mswdoMasterlistService";
import { buildSectorsText } from "../masterlist/masterlistService";
import { fetchAllDisasterEvents } from "../disaster-events/disasterEventService";
import {
  fetchBarangayStubDashboard,
  fetchMunicipalStubDashboard,
} from "../stubs/stubService";
import { fetchReliefPackTemplates } from "../relief-pack-templates/reliefPackTemplateService";
import {
  getAssignedReliefPackTemplatesForHousehold,
  getHouseholdSectorIds,
} from "../relief-pack-templates/reliefPackAssignment.js";
import { buildMasterlistFilterSectorOptions } from "../../utils/registrationOptions";
import {
  matchesInventoryDistributionFilters,
  matchesInventoryDistributionSearch,
} from "./inventoryDistributionFilters";
import {
  getInventoryDistributionStubDashboardBarangayIds,
  shouldLoadInventoryDistributionStubDashboard,
} from "./inventoryDistributionDataSource.js";

const emptyMasterlistPayload = {
  disaster_event: null,
  filters: {
    disaster_event_id: null,
    barangay_id: null,
  },
  count: 0,
  data: [],
};

const emptyStubDashboardPayload = {
  metrics: {
    total_issued_stubs: 0,
    claimed_stubs: 0,
    unclaimed_stubs: 0,
    beneficiary_families: 0,
  },
  data: [],
};

const getStandardTemplates = (templates) => {
  if (!Array.isArray(templates) || templates.length === 0) {
    return [];
  }

  const standardTemplates = templates.filter(
    (template) => template.is_active && !template.is_additional_pack,
  );

  if (standardTemplates.length === 0) {
    return [];
  }

  return [...standardTemplates].sort((left, right) => {
    if (left.based_on_family_size && !right.based_on_family_size) {
      return -1;
    }

    if (!left.based_on_family_size && right.based_on_family_size) {
      return 1;
    }

    return String(left.name || "").localeCompare(String(right.name || ""));
  });
};

const getStandardTemplate = (templates) => {
  const standardTemplates = getStandardTemplates(templates);
  return standardTemplates[0] || null;
};

const getTemplateNotice = (templates) => {
  const standardTemplates = getStandardTemplates(templates);
  const preferredTemplate = standardTemplates[0] || null;
  const additionalTemplateCount = templates.filter(
    (template) => template.is_active && template.is_additional_pack,
  ).length;

  if (standardTemplates.length > 1 && additionalTemplateCount > 0) {
    return `Relief distribution automatically assigns ${standardTemplates.length} active standard packs to each family and adds sector-based packs for matching households.`;
  }

  if (standardTemplates.length > 1) {
    return `Relief distribution automatically assigns ${standardTemplates.length} active standard packs to each family.`;
  }

  if (preferredTemplate && additionalTemplateCount > 0) {
    return `Relief distribution uses the active base template "${preferredTemplate.name}" and automatically adds sector-based packs for matching households.`;
  }

  if (preferredTemplate) {
    return `Relief pack items are showing the active template: ${preferredTemplate.name}.`;
  }

  return "No standard relief pack template is currently active. Additional sector packs will appear once a matching base template is available.";
};

const eventIncludesBarangay = (event, barangayId) => {
  if (!barangayId) {
    return true;
  }

  return (event?.affected_barangays || []).some(
    (barangay) => barangay?.id === barangayId,
  );
};

const getDisasterEventRecency = (event) => {
  const rawValue =
    event?.start_date || event?.created_at || event?.updated_at || 0;
  const timestamp = new Date(rawValue).getTime();

  return Number.isFinite(timestamp) ? timestamp : 0;
};

const getScopedDisasterEvents = ({ events, activeTab, barangayId }) => {
  return [...(events || [])]
    .filter(
      (event) =>
        (activeTab === "active"
          ? event?.status === "ACTIVE"
          : event?.status === "CLOSED") &&
        eventIncludesBarangay(event, barangayId),
    )
    .sort(
      (leftEvent, rightEvent) =>
        getDisasterEventRecency(rightEvent) -
        getDisasterEventRecency(leftEvent),
    );
};

const mapStubDashboardRow = (row, fallbackBarangay = null) => {
  const sectors = Array.isArray(row.sectors) ? row.sectors : [];
  const formattedSectorsText = buildSectorsText({
    household_sectors: [],
    members: [{ sectors }],
  });

  return {
    household_id: row.household?.id || row.household_id || row.id,
    family_head_name: row.household?.family_head_name || "-",
    address: row.barangay_name || fallbackBarangay?.name || "-",
    family_members_count:
      row.household?.household_size || row.household?.members_count || 0,
    sector_ids: Array.isArray(row.sector_ids) ? row.sector_ids : [],
    sector_names: sectors
      .map((sector) => sector.name)
      .filter(Boolean),
    sectors_text:
      formattedSectorsText && formattedSectorsText !== "-"
        ? formattedSectorsText
        : row.sectors_text || "-",
    barangay_id: row.barangay_id || fallbackBarangay?.id || null,
    barangay_name: row.barangay_name || fallbackBarangay?.name || "",
    relief_pack_templates: Array.isArray(row.assigned_relief_packs)
      ? row.assigned_relief_packs
      : [],
    donated_relief_packs: Array.isArray(row.available_donated_relief_packs)
      ? row.available_donated_relief_packs
      : [],
    donated_loose_items: Array.isArray(row.available_donated_loose_items)
      ? row.available_donated_loose_items
      : [],
    relief_pack_items: [],
    relief_pack_name: row.relief_pack_name || "--",
    distribution_status: row.status === "CLAIMED" ? "CLAIMED" : "ISSUED",
    distribution_status_label:
      row.status === "CLAIMED" ? "Claimed" : "For Claim",
    claimed_at:
      row.distribution_date ||
      row.received_at ||
      row.claimed_at ||
      "",
    receipt_no: row.receipt_no || row.distribution_transaction?.receipt_no || "",
    authorized_by_name:
      row.verified_by_name ||
      row.distribution_transaction?.verified_by_name ||
      "",
    raw_stub_status: row.status || "",
    display_stub_no: row.display_stub_no || "",
    qr_code_value: row.qr_code_value || "",
    latest_arrival_time: row.queue_time_in || row.issued_at || "",
    stub_id: row.id,
  };
};

const buildMasterlistRowsByHouseholdId = (masterlistPayload) => {
  const rowsByHouseholdId = new Map();

  (masterlistPayload?.data || []).forEach((household) => {
    if (household?.household_id) {
      rowsByHouseholdId.set(household.household_id, household);
    }
  });

  return rowsByHouseholdId;
};

const mergeMasterlistDataIntoRows = (rows, masterlistPayload) => {
  const masterlistRowsByHouseholdId =
    buildMasterlistRowsByHouseholdId(masterlistPayload);

  return rows.map((row) => {
    const household = masterlistRowsByHouseholdId.get(row.household_id);

    if (!household) {
      return row;
    }

    const sectorIds = [
      ...(household.household_sectors || []).map((sector) => sector.id),
      ...(household.members || []).flatMap((member) =>
        (member.sectors || []).map((sector) => sector.id),
      ),
      ...(row.sector_ids || []),
    ].filter(Boolean);
    const sectorsText = buildSectorsText(household);

    return {
      ...row,
      masterlist_record_id:
        household.masterlist_record_id ||
        row.masterlist_record_id ||
        household.attendance_log_id ||
        row.household_id,
      family_head_name: household.family_head_name || row.family_head_name,
      address:
        household.current_address_details ||
        household.barangay?.name ||
        row.address,
      family_members_count:
        household.household_size ||
        household.members?.length ||
        row.family_members_count,
      sector_ids: [...new Set(sectorIds)],
      sector_names: [
        ...new Set([
          ...(row.sector_names || []),
          ...(household.household_sectors || []).map((sector) => sector.name),
          ...(household.members || []).flatMap((member) =>
            (member.sectors || []).map((sector) => sector.name),
          ),
        ].filter(Boolean)),
      ],
      sectors_text: sectorsText && sectorsText !== "-" ? sectorsText : row.sectors_text,
      barangay_id: household.barangay?.id || row.barangay_id,
      barangay_name: household.barangay?.name || row.barangay_name,
      stub_id: row.stub_id || household.stub?.id || null,
      display_stub_no: row.display_stub_no || household.stub?.stub_no || "",
      raw_stub_status: row.raw_stub_status || household.stub?.status || "",
      receipt_no:
        row.receipt_no ||
        household.stub?.distribution_transaction?.receipt_no ||
        "",
      authorized_by_name:
        row.authorized_by_name ||
        row.verified_by_name ||
        household.stub?.distribution_transaction?.verified_by_name ||
        "",
      latest_arrival_time:
        row.latest_arrival_time || household.latest_attendance?.time_in || "",
      masterlist_household: household,
      household_members: Array.isArray(household.members)
        ? household.members
        : [],
      household_sectors: Array.isArray(household.household_sectors)
        ? household.household_sectors
        : [],
      latest_attendance: household.latest_attendance || null,
      masterlist_disaster_event: masterlistPayload?.disaster_event || null,
    };
  });
};

const mapMasterlistDistributionRow = (
  household,
  templateDetails,
  disasterEvent = null,
  fallbackBarangay = null,
  activeTab = "active",
) => {
  const sectorIds = getHouseholdSectorIds(household);
  const sectorsText = buildSectorsText(household);
  const stub = household?.stub || null;
  const status = stub?.status || "";
  const assignedTemplates = Array.isArray(stub?.assigned_relief_packs)
    ? stub.assigned_relief_packs
    : getAssignedReliefPackTemplatesForHousehold(
        household,
        templateDetails,
        disasterEvent,
      );

  return {
    household_id: household.household_id,
    masterlist_record_id:
      household.masterlist_record_id ||
      household.attendance_log_id ||
      household.household_id,
    family_head_name: household.family_head_name || "-",
    address:
      household.current_address_details ||
      household.barangay?.name ||
      fallbackBarangay?.name ||
      "-",
    family_members_count:
      household.household_size || household.members?.length || 0,
    sector_ids: [...new Set(sectorIds)],
    sector_names: [
      ...new Set([
        ...(household.household_sectors || []).map((sector) => sector.name),
        ...(household.members || []).flatMap((member) =>
          (member.sectors || []).map((sector) => sector.name),
        ),
      ].filter(Boolean)),
    ],
    sectors_text: sectorsText && sectorsText !== "-" ? sectorsText : "-",
    barangay_id: household.barangay?.id || fallbackBarangay?.id || null,
    barangay_name: household.barangay?.name || fallbackBarangay?.name || "",
    relief_pack_templates: assignedTemplates,
    donated_relief_packs: [],
    donated_loose_items: [],
    relief_pack_items: [],
    relief_pack_name:
      assignedTemplates.map((template) => template.name).filter(Boolean).join(", ") ||
      "--",
    distribution_status:
      status === "CLAIMED" ? "CLAIMED" : status === "ISSUED" ? "ISSUED" : "",
    distribution_status_label:
      status === "CLAIMED"
        ? "Claimed"
        : status === "ISSUED"
          ? activeTab === "ended"
            ? "Not Claimed"
            : "For Claim"
          : "--",
    claimed_at: stub?.claimed_at || "",
    receipt_no: stub?.distribution_transaction?.receipt_no || "",
    authorized_by_name: stub?.distribution_transaction?.verified_by_name || "",
    raw_stub_status: status,
    display_stub_no: stub?.stub_no || "",
    qr_code_value: "",
    latest_arrival_time:
      household.latest_attendance?.time_in || household.registered_at || "",
    stub_id: stub?.id || null,
    masterlist_household: household,
    household_members: Array.isArray(household.members) ? household.members : [],
    household_sectors: Array.isArray(household.household_sectors)
      ? household.household_sectors
      : [],
    latest_attendance: household.latest_attendance || null,
    masterlist_disaster_event: disasterEvent,
  };
};

const getSortableDateValue = (value) => {
  if (!value) {
    return null;
  }

  const parsedValue = new Date(value).getTime();
  return Number.isNaN(parsedValue) ? null : parsedValue;
};

const sortRows = (rows, sortOrder = "newest") => {
  return [...rows].sort((left, right) => {
    if (sortOrder === "oldest" || sortOrder === "newest") {
      const leftDate = getSortableDateValue(left.latest_arrival_time);
      const rightDate = getSortableDateValue(right.latest_arrival_time);

      if (leftDate === null && rightDate !== null) {
        return 1;
      }

      if (leftDate !== null && rightDate === null) {
        return -1;
      }

      if (leftDate !== rightDate) {
        return sortOrder === "oldest" ? leftDate - rightDate : rightDate - leftDate;
      }
    }

    const nameComparison = String(left.family_head_name || "").localeCompare(
      String(right.family_head_name || ""),
      undefined,
      { sensitivity: "base" },
    );

    return sortOrder === "za" ? -nameComparison : nameComparison;
  });
};

export const useInventoryDistribution = () => {
  const [activeTab, setActiveTab] = useState("active");
  const [disasterEvents, setDisasterEvents] = useState([]);
  const [barangays, setBarangays] = useState([]);
  const [sectors, setSectors] = useState([]);
  const [selectedDisasterEventIdsByTab, setSelectedDisasterEventIdsByTab] =
    useState({
      active: "",
      ended: "",
    });
  const [selectedBarangayId, setSelectedBarangayId] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [selectedSectorIds, setSelectedSectorIds] = useState([]);
  const [selectedSortOrder, setSelectedSortOrder] = useState("oldest");
  const [masterlistPayload, setMasterlistPayload] = useState(emptyMasterlistPayload);
  const [stubDashboardPayload, setStubDashboardPayload] = useState(
    emptyStubDashboardPayload,
  );
  const [allBarangaysStubDashboardPayload, setAllBarangaysStubDashboardPayload] =
    useState(emptyStubDashboardPayload);
  const [templateDetails, setTemplateDetails] = useState([]);
  const [isLoadingFilters, setIsLoadingFilters] = useState(true);
  const [isLoadingMasterlist, setIsLoadingMasterlist] = useState(false);
  const [isLoadingTemplateList, setIsLoadingTemplateList] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [templateNotice, setTemplateNotice] = useState("");
  const stubRequestGenerationRef = useRef(0);

  const selectedDisasterEventId =
    selectedDisasterEventIdsByTab[activeTab] || "";
  const setSelectedDisasterEventId = useCallback(
    (nextEventId) => {
      setSelectedDisasterEventIdsByTab((currentSelections) => ({
        ...currentSelections,
        [activeTab]: nextEventId || "",
      }));
    },
    [activeTab],
  );

  const resetDistributionFilters = () => {
    setSearchTerm("");
    setSelectedStatus("");
    setSelectedSectorIds([]);
    setSelectedSortOrder("oldest");
  };

  const resetAllDistributionFilters = () => {
    resetDistributionFilters();
    setSelectedBarangayId("");
    setSelectedDisasterEventIdsByTab({
      active: "",
      ended: "",
    });
  };

  const isLoadingTemplate = isLoadingTemplateList;

  useEffect(() => {
    let isMounted = true;

    const loadInitialFilters = async () => {
      setIsLoadingFilters(true);
      setErrorMessage("");
      setTemplateNotice("");

      try {
        const [eventsPayload, barangaysPayload, sectorsPayload] =
          await Promise.all([
            fetchAllDisasterEvents(),
            fetchBarangays(),
            fetchMswdoSectors(),
          ]);

        if (!isMounted) {
          return;
        }

        const eventRows = Array.isArray(eventsPayload) ? eventsPayload : [];
        const barangayRows = Array.isArray(barangaysPayload) ? barangaysPayload : [];
        const sectorRows = Array.isArray(sectorsPayload) ? sectorsPayload : [];

        setDisasterEvents(eventRows);
        setBarangays(barangayRows);
        setSectors(sectorRows);
      } catch (error) {
        if (isMounted) {
          setErrorMessage(
            error.message || "Failed to load inventory distribution filters.",
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

    const loadEventTemplates = async () => {
      if (!selectedDisasterEventId) {
        setTemplateDetails([]);
        setIsLoadingTemplateList(false);
        return;
      }

      setIsLoadingTemplateList(true);
      setTemplateDetails([]);
      setTemplateNotice("");

      try {
        const templatePayload = await fetchReliefPackTemplates({
          is_active: "true",
          disaster_event_id: selectedDisasterEventId,
          include_items: true,
        });

        if (isMounted) {
          const loadedTemplateDetails = Array.isArray(templatePayload)
            ? templatePayload
            : [];

          setTemplateDetails(loadedTemplateDetails);
          setTemplateNotice(
            loadedTemplateDetails.length > 0
              ? getTemplateNotice(loadedTemplateDetails)
              : "",
          );
        }
      } catch (error) {
        if (isMounted) {
          setTemplateDetails([]);
          setTemplateNotice(
            error.message ||
              "Failed to load relief pack templates for the selected disaster event.",
          );
        }
      } finally {
        if (isMounted) {
          setIsLoadingTemplateList(false);
        }
      }
    };

    loadEventTemplates();

    return () => {
      isMounted = false;
    };
  }, [selectedDisasterEventId]);

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
          eventScope: activeTab,
          recordStatus: activeTab === "ended" ? "all" : "active",
        });

        if (isMounted) {
          setMasterlistPayload(payload || emptyMasterlistPayload);
        }
      } catch (error) {
        if (isMounted) {
          setMasterlistPayload(emptyMasterlistPayload);
          setErrorMessage(
            error.message || "Failed to load inventory distribution records.",
          );
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
  }, [activeTab, selectedBarangayId, selectedDisasterEventId]);

  const selectedDisasterEvent = useMemo(() => {
    return (
      disasterEvents.find((event) => event.id === selectedDisasterEventId) || null
    );
  }, [disasterEvents, selectedDisasterEventId]);

  const scopedDisasterEvents = useMemo(() => {
    return getScopedDisasterEvents({
      events: disasterEvents,
      activeTab,
      barangayId: selectedBarangayId,
    });
  }, [activeTab, disasterEvents, selectedBarangayId]);

  const selectableBarangays = useMemo(() => {
    if (!selectedDisasterEvent) {
      return barangays;
    }

    const affectedBarangayIds = Array.isArray(
      selectedDisasterEvent.affected_barangays,
    )
      ? selectedDisasterEvent.affected_barangays
          .map((barangay) => barangay?.id)
          .filter(Boolean)
      : [];

    if (affectedBarangayIds.length === 0) {
      return barangays;
    }

    return barangays.filter((barangay) => affectedBarangayIds.includes(barangay.id));
  }, [barangays, selectedDisasterEvent]);

  const selectedBarangay = useMemo(() => {
    return barangays.find((barangay) => barangay.id === selectedBarangayId) || null;
  }, [barangays, selectedBarangayId]);

  useEffect(() => {
    let isMounted = true;
    const requestGeneration = ++stubRequestGenerationRef.current;
    const isCurrentRequest = () =>
      isMounted && stubRequestGenerationRef.current === requestGeneration;

    const loadStubDashboard = async () => {
      const requestedBarangayIds =
        getInventoryDistributionStubDashboardBarangayIds({
          activeTab,
          disasterEventStatus: selectedDisasterEvent?.status,
          selectedBarangayId,
          selectableBarangays,
        });
      const shouldLoadStubDashboard =
        shouldLoadInventoryDistributionStubDashboard({
          activeTab,
          disasterEventStatus: selectedDisasterEvent?.status,
        });
      setErrorMessage("");

      if (
        !selectedDisasterEventId ||
        !shouldLoadStubDashboard ||
        (selectedBarangayId && requestedBarangayIds.length === 0)
      ) {
        setStubDashboardPayload(emptyStubDashboardPayload);
        setAllBarangaysStubDashboardPayload(emptyStubDashboardPayload);
        return;
      }

      setStubDashboardPayload(emptyStubDashboardPayload);
      setAllBarangaysStubDashboardPayload(emptyStubDashboardPayload);

      if (selectedBarangayId) {
        try {
          const payload = await fetchBarangayStubDashboard({
            userId: null,
            disasterEventId: selectedDisasterEventId,
            barangayId: selectedBarangayId,
          });

          if (isCurrentRequest()) {
            setStubDashboardPayload({
              metrics: payload?.metrics || emptyStubDashboardPayload.metrics,
              data: Array.isArray(payload?.data) ? payload.data : [],
            });
            setAllBarangaysStubDashboardPayload(emptyStubDashboardPayload);
          }
        } catch (_error) {
          if (isCurrentRequest()) {
            setStubDashboardPayload(emptyStubDashboardPayload);
          }
        }

        return;
      }

      try {
        const payload = await fetchMunicipalStubDashboard({
          disasterEventId: selectedDisasterEventId,
        });

        if (isCurrentRequest()) {
          setStubDashboardPayload(emptyStubDashboardPayload);
          setAllBarangaysStubDashboardPayload({
            metrics: emptyStubDashboardPayload.metrics,
            data: Array.isArray(payload?.data) ? payload.data : [],
          });
        }
      } catch (error) {
        if (isCurrentRequest()) {
          setErrorMessage(
            error.message || "Failed to fetch municipal stub dashboard.",
          );
          setStubDashboardPayload(emptyStubDashboardPayload);
          setAllBarangaysStubDashboardPayload(emptyStubDashboardPayload);
        }
      }
    };

    loadStubDashboard();

    return () => {
      isMounted = false;
    };
  }, [
    activeTab,
    selectableBarangays,
    selectedBarangayId,
    selectedDisasterEvent?.status,
    selectedDisasterEventId,
  ]);

  useEffect(() => {
    if (isLoadingFilters) {
      return;
    }

    if (scopedDisasterEvents.length === 0) {
      if (selectedDisasterEventId) {
        setSelectedDisasterEventId("");
      }

      return;
    }

    if (
      !scopedDisasterEvents.some((event) => event.id === selectedDisasterEventId)
    ) {
      setSelectedDisasterEventId(scopedDisasterEvents[0].id);
    }
  }, [
    isLoadingFilters,
    scopedDisasterEvents,
    selectedDisasterEventId,
    setSelectedDisasterEventId,
  ]);

  useEffect(() => {
    if (!selectedBarangayId) {
      return;
    }

    const isSelectedBarangayVisible = selectableBarangays.some(
      (barangay) => barangay.id === selectedBarangayId,
    );

    if (!isSelectedBarangayVisible) {
      setSelectedBarangayId("");
    }
  }, [selectableBarangays, selectedBarangayId]);

  useEffect(() => {
    if (selectedDisasterEvent?.status === "ACTIVE" && activeTab !== "active") {
      setActiveTab("active");
    }

    if (
      selectedDisasterEvent?.status === "CLOSED" &&
      activeTab !== "ended"
    ) {
      setActiveTab("ended");
    }
  }, [activeTab, selectedDisasterEvent?.status]);

  const handleEventScopeChange = (nextTab) => {
    const isScopeChange = nextTab !== activeTab;

    if (isScopeChange) {
      resetDistributionFilters();
    }

    setActiveTab(nextTab);
  };

  const selectedTemplate = useMemo(() => {
    return getStandardTemplate(templateDetails);
  }, [templateDetails]);

  const selectedStandardTemplates = useMemo(() => {
    return getStandardTemplates(templateDetails);
  }, [templateDetails]);

  const stubBasedRows = useMemo(() => {
    return (stubDashboardPayload.data || []).map((row) =>
      mapStubDashboardRow(row, selectedBarangay),
    );
  }, [selectedBarangay?.id, selectedBarangay?.name, stubDashboardPayload.data]);

  const allBarangayStubRows = useMemo(() => {
    return (allBarangaysStubDashboardPayload.data || []).map((row) =>
      mapStubDashboardRow(row),
    );
  }, [allBarangaysStubDashboardPayload.data]);

  const masterlistDistributionRows = useMemo(() => {
    return (masterlistPayload.data || []).map((household) =>
      mapMasterlistDistributionRow(
        household,
        templateDetails,
        masterlistPayload.disaster_event,
        selectedBarangay,
        activeTab,
      ),
    );
  }, [
    activeTab,
    masterlistPayload.data,
    masterlistPayload.disaster_event,
    selectedBarangay?.id,
    selectedBarangay?.name,
    templateDetails,
  ]);

  const allRows = useMemo(() => {
    const sourceRows =
      activeTab === "ended"
        ? masterlistDistributionRows
        : selectedBarangayId
          ? stubBasedRows
          : allBarangayStubRows;
    const rowsWithMasterlistData = mergeMasterlistDataIntoRows(
      sourceRows,
      masterlistPayload,
    );

    if (selectedBarangayId) {
      return sortRows(rowsWithMasterlistData, selectedSortOrder);
    }

    return sortRows(rowsWithMasterlistData, selectedSortOrder);
  }, [
    activeTab,
    allBarangayStubRows,
    masterlistDistributionRows,
    masterlistPayload,
    selectedBarangayId,
    selectedSortOrder,
    stubBasedRows,
  ]);

  const sectorOptions = useMemo(() => {
    return buildMasterlistFilterSectorOptions(sectors);
  }, [sectors]);

  const displayedRows = useMemo(() => {
    return allRows.filter(
      (row) =>
        matchesInventoryDistributionSearch(row, searchTerm) &&
        matchesInventoryDistributionFilters(
          row,
          selectedStatus,
          selectedSectorIds,
        ),
    );
  }, [allRows, searchTerm, selectedStatus, selectedSectorIds]);

  const analytics = useMemo(() => {
    const claimedCount = allRows.filter(
      (row) => row.distribution_status === "CLAIMED",
    ).length;
    const pendingCount = allRows.filter(
      (row) => row.distribution_status === "ISSUED",
    ).length;
    const notDistributedCount = allRows.filter(
      (row) => !["CLAIMED", "ISSUED"].includes(row.distribution_status),
    ).length;
    const affectedBarangayCount = selectedBarangayId
      ? 1
      : Array.isArray(selectedDisasterEvent?.affected_barangays)
        ? selectedDisasterEvent.affected_barangays.filter(
            (barangay) => barangay?.id,
          ).length
        : 0;

    return {
      barangaysCovered: affectedBarangayCount,
      totalFamiliesServed: allRows.length,
      totalReliefPacksDistributed: claimedCount + pendingCount,
      claimedCount,
      pendingCount,
      notDistributedCount,
    };
  }, [allRows, selectedBarangayId, selectedDisasterEvent?.affected_barangays]);

  return {
    activeTab,
    disasterEvents,
    barangays,
    scopedDisasterEvents,
    selectableBarangays,
    sectorOptions,
    selectedDisasterEvent,
    selectedBarangay,
    selectedDisasterEventId,
    selectedBarangayId,
    selectedStatus,
    selectedSectorIds,
    selectedSortOrder,
    searchTerm,
    selectedTemplate,
    selectedStandardTemplates,
    templateDetails,
    templateNotice,
    displayedRows,
    analytics,
    isLoadingFilters,
    isLoadingMasterlist,
    isLoadingTemplate,
    errorMessage,
    hasActiveEvents: disasterEvents.length > 0,
    handleEventScopeChange,
    resetAllDistributionFilters,
    setSearchTerm,
    setSelectedDisasterEventId,
    setSelectedBarangayId,
    setSelectedStatus,
    setSelectedSectorIds,
    setSelectedSortOrder,
  };
};
