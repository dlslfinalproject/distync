import { useEffect, useMemo, useState } from "react";
import {
  fetchBarangays,
  fetchConsolidatedMasterlist,
} from "../mswdo-masterlist/mswdoMasterlistService";
import { fetchAllDisasterEvents } from "../disaster-events/disasterEventService";
import { fetchBarangayStubDashboard } from "../stubs/stubService";
import {
  fetchReliefPackTemplateById,
  fetchReliefPackTemplates,
} from "../relief-pack-templates/reliefPackTemplateService";

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

const combineStubDashboardPayloads = (payloads) => {
  return (payloads || []).reduce(
    (combinedPayload, payload) => ({
      metrics: {
        total_issued_stubs:
          combinedPayload.metrics.total_issued_stubs +
          Number(payload?.metrics?.total_issued_stubs || 0),
        claimed_stubs:
          combinedPayload.metrics.claimed_stubs +
          Number(payload?.metrics?.claimed_stubs || 0),
        unclaimed_stubs:
          combinedPayload.metrics.unclaimed_stubs +
          Number(payload?.metrics?.unclaimed_stubs || 0),
        beneficiary_families:
          combinedPayload.metrics.beneficiary_families +
          Number(payload?.metrics?.beneficiary_families || 0),
      },
      data: [
        ...combinedPayload.data,
        ...(Array.isArray(payload?.data) ? payload.data : []),
      ],
    }),
    emptyStubDashboardPayload,
  );
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

const matchesSearch = (row, searchTerm) => {
  const normalizedSearchTerm = searchTerm.trim().toLowerCase();

  if (!normalizedSearchTerm) {
    return true;
  }

  const searchableValues = [
    row.family_head_name,
    row.address,
    row.barangay_name,
    row.sectors_text,
    row.distribution_status_label,
  ];

  return searchableValues.some((value) =>
    String(value || "")
      .toLowerCase()
      .includes(normalizedSearchTerm),
  );
};

const matchesFilters = (row, selectedStatus, selectedSectorIds) => {
  if (selectedStatus && row.distribution_status !== selectedStatus) {
    return false;
  }

  if (!selectedSectorIds.length) {
    return true;
  }

  return selectedSectorIds.some((sectorId) => row.sector_ids.includes(sectorId));
};

const eventIncludesBarangay = (event, barangayId) => {
  if (!barangayId) {
    return true;
  }

  return (event?.affected_barangays || []).some(
    (barangay) => barangay?.id === barangayId,
  );
};

const getScopedDisasterEvents = ({ events, activeTab, barangayId }) => {
  return (events || []).filter(
    (event) =>
      (activeTab === "active"
        ? event?.status === "ACTIVE"
        : ["CLOSED", "ARCHIVED"].includes(event?.status)) &&
      eventIncludesBarangay(event, barangayId),
  );
};

const mapStubDashboardRow = (row, fallbackBarangay = null) => ({
  household_id: row.household?.id || row.household_id || row.id,
  family_head_name: row.household?.family_head_name || "-",
  address: row.barangay_name || fallbackBarangay?.name || "-",
  family_members_count: row.household?.members_count || 0,
  sector_ids: Array.isArray(row.sector_ids) ? row.sector_ids : [],
  sector_names: String(row.sectors_text || "-")
    .split(",")
    .map((sectorName) => sectorName.trim())
    .filter(Boolean)
    .filter((sectorName) => sectorName !== "-"),
  sectors_text: row.sectors_text || "-",
  barangay_id: row.barangay_id || fallbackBarangay?.id || null,
  barangay_name: row.barangay_name || fallbackBarangay?.name || "",
  relief_pack_templates: Array.isArray(row.assigned_relief_packs)
    ? row.assigned_relief_packs
    : [],
  relief_pack_items: [],
  relief_pack_name: row.relief_pack_name || "--",
  distribution_status: row.status === "CLAIMED" ? "CLAIMED" : "PENDING",
  distribution_status_label:
    row.status === "CLAIMED" ? "Claimed" : "For Claim",
  raw_stub_status: row.status || "",
  display_stub_no: row.display_stub_no || "",
  qr_code_value: row.qr_code_value || "",
  stub_id: row.id,
});

export const useInventoryDistribution = () => {
  const [activeTab, setActiveTab] = useState("active");
  const [disasterEvents, setDisasterEvents] = useState([]);
  const [barangays, setBarangays] = useState([]);
  const [reliefPackTemplates, setReliefPackTemplates] = useState([]);
  const [selectedDisasterEventId, setSelectedDisasterEventId] = useState("");
  const [selectedBarangayId, setSelectedBarangayId] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [selectedSectorIds, setSelectedSectorIds] = useState([]);
  const [masterlistPayload, setMasterlistPayload] = useState(emptyMasterlistPayload);
  const [stubDashboardPayload, setStubDashboardPayload] = useState(
    emptyStubDashboardPayload,
  );
  const [allBarangaysStubDashboardPayload, setAllBarangaysStubDashboardPayload] =
    useState(emptyStubDashboardPayload);
  const [templateDetails, setTemplateDetails] = useState([]);
  const [isLoadingFilters, setIsLoadingFilters] = useState(true);
  const [isLoadingMasterlist, setIsLoadingMasterlist] = useState(false);
  const [isLoadingTemplate, setIsLoadingTemplate] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [templateNotice, setTemplateNotice] = useState("");

  useEffect(() => {
    let isMounted = true;

    const loadInitialFilters = async () => {
      setIsLoadingFilters(true);
      setErrorMessage("");
      setTemplateNotice("");

      try {
        const [eventsPayload, barangaysPayload, templatePayload] = await Promise.all([
          fetchAllDisasterEvents(),
          fetchBarangays(),
          fetchReliefPackTemplates({ is_active: "true" }),
        ]);

        if (!isMounted) {
          return;
        }

        const eventRows = Array.isArray(eventsPayload) ? eventsPayload : [];
        const barangayRows = Array.isArray(barangaysPayload) ? barangaysPayload : [];
        const templateRows = Array.isArray(templatePayload) ? templatePayload : [];

        setDisasterEvents(eventRows);
        setBarangays(barangayRows);
        setReliefPackTemplates(templateRows);

        if (templateRows.length === 0) {
          setTemplateNotice(
            "No active relief pack template is currently available. The table is ready for template integration once a pack is assigned.",
          );
        }
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

  useEffect(() => {
    let isMounted = true;

    const loadTemplateDetail = async () => {
      if (!reliefPackTemplates.length) {
        setTemplateDetails([]);
        setIsLoadingTemplate(false);
        return;
      }

      setIsLoadingTemplate(true);

      try {
        const loadedTemplateDetails = await Promise.all(
          reliefPackTemplates.map((template) =>
            fetchReliefPackTemplateById(template.id),
          ),
        );

        if (!isMounted) {
          return;
        }

        setTemplateDetails(loadedTemplateDetails);

        const standardTemplates = getStandardTemplates(loadedTemplateDetails);
        const preferredTemplate = standardTemplates[0] || null;
        const additionalTemplateCount = loadedTemplateDetails.filter(
          (template) => template.is_active && template.is_additional_pack,
        ).length;

        if (standardTemplates.length > 1 && additionalTemplateCount > 0) {
          setTemplateNotice(
            `Relief distribution automatically assigns ${standardTemplates.length} active standard packs to each family and adds sector-based packs for matching households.`,
          );
        } else if (standardTemplates.length > 1) {
          setTemplateNotice(
            `Relief distribution automatically assigns ${standardTemplates.length} active standard packs to each family.`,
          );
        } else if (preferredTemplate && additionalTemplateCount > 0) {
          setTemplateNotice(
            `Relief distribution uses the active base template "${preferredTemplate.name}" and automatically adds sector-based packs for matching households.`,
          );
        } else if (preferredTemplate) {
          setTemplateNotice(
            `Relief pack items are showing the active template: ${preferredTemplate.name}.`,
          );
        } else {
          setTemplateNotice(
            "No standard relief pack template is currently active. Additional sector packs will appear once a matching base template is available.",
          );
        }
      } catch (error) {
        if (isMounted) {
          setTemplateDetails([]);
          setTemplateNotice(
            error.message ||
              "Relief pack template details are unavailable right now. The page is ready for integration.",
          );
        }
      } finally {
        if (isMounted) {
          setIsLoadingTemplate(false);
        }
      }
    };

    loadTemplateDetail();

    return () => {
      isMounted = false;
    };
  }, [reliefPackTemplates]);

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

    const loadStubDashboard = async () => {
      if (!selectedDisasterEventId) {
        setStubDashboardPayload(emptyStubDashboardPayload);
        setAllBarangaysStubDashboardPayload(emptyStubDashboardPayload);
        return;
      }

      if (selectedBarangayId) {
        try {
          const payload = await fetchBarangayStubDashboard({
            userId: null,
            disasterEventId: selectedDisasterEventId,
            overrideBarangayId: selectedBarangayId,
          });

          if (isMounted) {
            setStubDashboardPayload({
              metrics: payload?.metrics || emptyStubDashboardPayload.metrics,
              data: Array.isArray(payload?.data) ? payload.data : [],
            });
            setAllBarangaysStubDashboardPayload(emptyStubDashboardPayload);
          }
        } catch (_error) {
          if (isMounted) {
            setStubDashboardPayload(emptyStubDashboardPayload);
          }
        }

        return;
      }

      if (selectableBarangays.length === 0) {
        setStubDashboardPayload(emptyStubDashboardPayload);
        setAllBarangaysStubDashboardPayload(emptyStubDashboardPayload);
        return;
      }

      try {
        const payloads = await Promise.all(
          selectableBarangays.map((barangay) =>
            fetchBarangayStubDashboard({
              userId: null,
              disasterEventId: selectedDisasterEventId,
              overrideBarangayId: barangay.id,
            }).catch(() => emptyStubDashboardPayload),
          ),
        );

        if (isMounted) {
          setStubDashboardPayload(emptyStubDashboardPayload);
          setAllBarangaysStubDashboardPayload(
            combineStubDashboardPayloads(payloads),
          );
        }
      } catch (_error) {
        if (isMounted) {
          setAllBarangaysStubDashboardPayload(emptyStubDashboardPayload);
        }
      }
    };

    loadStubDashboard();

    return () => {
      isMounted = false;
    };
  }, [selectableBarangays, selectedBarangayId, selectedDisasterEventId]);

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
      ["CLOSED", "ARCHIVED"].includes(selectedDisasterEvent?.status) &&
      activeTab !== "ended"
    ) {
      setActiveTab("ended");
    }
  }, [activeTab, selectedDisasterEvent?.status]);

  const handleEventScopeChange = (nextTab) => {
    setActiveTab(nextTab);

    const nextEvents = getScopedDisasterEvents({
      events: disasterEvents,
      activeTab: nextTab,
      barangayId: selectedBarangayId,
    });

    if (nextEvents.length === 0) {
      setSelectedDisasterEventId("");
      return;
    }

    if (!nextEvents.some((event) => event.id === selectedDisasterEventId)) {
      setSelectedDisasterEventId(nextEvents[0].id);
    }
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

  const allRows = useMemo(() => {
    if (selectedBarangayId) {
      return stubBasedRows;
    }

    return allBarangayStubRows;
  }, [allBarangayStubRows, selectedBarangayId, stubBasedRows]);

  const sectorOptions = useMemo(() => {
    const sectorMap = new Map();

    if (selectedBarangayId) {
      (masterlistPayload.data || []).forEach((household) => {
        [
          ...(household.household_sectors || []),
          ...(household.members || []).flatMap((member) => member.sectors || []),
        ].forEach((sector) => {
          if (sector?.id && sector?.name && !sectorMap.has(sector.id)) {
            sectorMap.set(sector.id, {
              id: sector.id,
              name: sector.name,
            });
          }
        });
      });
    } else {
      allRows.forEach((row) => {
        row.sector_ids.forEach((sectorId, index) => {
          const sectorName = row.sector_names[index];

          if (sectorId && sectorName && !sectorMap.has(sectorId)) {
            sectorMap.set(sectorId, {
              id: sectorId,
              name: sectorName,
            });
          }
        });
      });
    }

    return [...sectorMap.values()].sort((left, right) =>
      left.name.localeCompare(right.name),
    );
  }, [allRows, masterlistPayload.data, selectedBarangayId]);

  const displayedRows = useMemo(() => {
    return allRows.filter(
      (row) =>
        matchesSearch(row, searchTerm) &&
        matchesFilters(row, selectedStatus, selectedSectorIds),
    );
  }, [allRows, searchTerm, selectedStatus, selectedSectorIds]);

  const analytics = useMemo(() => {
    if (selectedBarangayId) {
      const claimedCount = Number(stubDashboardPayload.metrics.claimed_stubs || 0);
      const pendingCount = Number(stubDashboardPayload.metrics.unclaimed_stubs || 0);
      const totalDistributed = claimedCount + pendingCount;
      const sectorCounts = displayedRows.reduce((counts, row) => {
        row.sector_names.forEach((sectorName) => {
          counts[sectorName] = (counts[sectorName] || 0) + 1;
        });

        return counts;
      }, {});

      const sortedSectorCounts = Object.entries(sectorCounts)
        .map(([name, count]) => ({
          name,
          count,
        }))
        .sort((left, right) => right.count - left.count);

      return {
        totalFamiliesServed: Number(
          stubDashboardPayload.metrics.beneficiary_families || totalDistributed,
        ),
        totalReliefPacksDistributed: totalDistributed,
        claimedCount,
        pendingCount,
        notDistributedCount: 0,
        sectorBreakdown: sortedSectorCounts,
        topSector: sortedSectorCounts[0] || null,
      };
    }

    const claimedCount = Number(
      allBarangaysStubDashboardPayload.metrics.claimed_stubs || 0,
    );
    const pendingCount = Number(
      allBarangaysStubDashboardPayload.metrics.unclaimed_stubs || 0,
    );
    const totalDistributed = Number(
      allBarangaysStubDashboardPayload.metrics.beneficiary_families ||
        claimedCount + pendingCount,
    );

    const sectorCounts = displayedRows.reduce((counts, row) => {
      row.sector_names.forEach((sectorName) => {
        counts[sectorName] = (counts[sectorName] || 0) + 1;
      });

      return counts;
    }, {});

    const sortedSectorCounts = Object.entries(sectorCounts)
      .map(([name, count]) => ({
        name,
        count,
      }))
      .sort((left, right) => right.count - left.count);

    return {
      totalFamiliesServed: totalDistributed,
      totalReliefPacksDistributed: totalDistributed,
      claimedCount,
      pendingCount,
      notDistributedCount: 0,
      sectorBreakdown: sortedSectorCounts,
      topSector: sortedSectorCounts[0] || null,
    };
  }, [
    allBarangaysStubDashboardPayload.metrics,
    displayedRows,
    selectedBarangayId,
    stubDashboardPayload.metrics,
  ]);

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
    searchTerm,
    selectedTemplate,
    selectedStandardTemplates,
    templateNotice,
    displayedRows,
    analytics,
    isLoadingFilters,
    isLoadingMasterlist,
    isLoadingTemplate,
    errorMessage,
    hasActiveEvents: disasterEvents.length > 0,
    handleEventScopeChange,
    setSearchTerm,
    setSelectedDisasterEventId,
    setSelectedBarangayId,
    setSelectedStatus,
    setSelectedSectorIds,
  };
};
