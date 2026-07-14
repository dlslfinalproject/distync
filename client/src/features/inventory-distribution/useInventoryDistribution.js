import { useEffect, useMemo, useState } from "react";
import {
  fetchBarangays,
  fetchConsolidatedMasterlist,
} from "../mswdo-masterlist/mswdoMasterlistService";
import { fetchAllDisasterEvents } from "../disaster-events/disasterEventService";
import {
  fetchReliefPackTemplateById,
  fetchReliefPackTemplates,
} from "../relief-pack-templates/reliefPackTemplateService";
import { buildSectorsText, mapMasterlistRow } from "../masterlist/masterlistService";

const emptyMasterlistPayload = {
  disaster_event: null,
  filters: {
    disaster_event_id: null,
    barangay_id: null,
  },
  count: 0,
  data: [],
};

const getHouseholdSectorIds = (household) => {
  return [
    ...(household.household_sectors || []).map((sector) => sector.id),
    ...(household.members || []).flatMap((member) =>
      (member.sectors || []).map((sector) => sector.id),
    ),
  ].filter(Boolean);
};

const getHouseholdSectorNames = (household) => {
  return [
    ...(household.household_sectors || []).map((sector) => sector.name),
    ...(household.members || []).flatMap((member) =>
      (member.sectors || []).map((sector) => sector.name),
    ),
  ]
    .filter(Boolean)
    .filter((value, index, values) => values.indexOf(value) === index);
};

const getDistributionStatus = (stubStatus) => {
  if (stubStatus === "CLAIMED") {
    return "CLAIMED";
  }

  if (stubStatus === "ISSUED") {
    return "PENDING";
  }

  return "NOT_DISTRIBUTED";
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

const getAssignedReliefPackTemplates = (householdSectorIds, templateDetails) => {
  if (!Array.isArray(templateDetails) || templateDetails.length === 0) {
    return [];
  }

  const sectorIdSet = new Set((householdSectorIds || []).filter(Boolean));
  const assignedTemplates = getStandardTemplates(templateDetails);

  templateDetails.forEach((template) => {
    if (
      !template?.is_active ||
      !template?.is_additional_pack ||
      !template?.sector_id ||
      !sectorIdSet.has(template.sector_id)
    ) {
      return;
    }

    assignedTemplates.push(template);
  });

  return assignedTemplates;
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
  const statusByTab = activeTab === "active" ? "ACTIVE" : "CLOSED";

  return (events || []).filter(
    (event) =>
      event?.status === statusByTab && eventIncludesBarangay(event, barangayId),
  );
};

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
  }, [selectedBarangayId, selectedDisasterEventId]);

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

    if (selectedDisasterEvent?.status === "CLOSED" && activeTab !== "ended") {
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

  const sectorOptions = useMemo(() => {
    const sectorMap = new Map();

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

    return [...sectorMap.values()].sort((left, right) =>
      left.name.localeCompare(right.name),
    );
  }, [masterlistPayload.data]);

  const selectedTemplate = useMemo(() => {
    return getStandardTemplate(templateDetails);
  }, [templateDetails]);

  const selectedStandardTemplates = useMemo(() => {
    return getStandardTemplates(templateDetails);
  }, [templateDetails]);

  const allRows = useMemo(() => {
    return (masterlistPayload.data || []).map((household) => {
      const mappedRow = mapMasterlistRow(household);
      const sectorNames = getHouseholdSectorNames(household);
      const sectorIds = [...new Set(getHouseholdSectorIds(household))];
      const stubStatus = household.stub?.status || "";
      const distributionStatus = getDistributionStatus(stubStatus);
      const barangayName = household.barangay?.name || "";
      const addressParts = [mappedRow.address];

      if (
        barangayName &&
        !String(mappedRow.address || "").toLowerCase().includes(barangayName.toLowerCase())
      ) {
        addressParts.push(barangayName);
      }

      const assignedTemplates = getAssignedReliefPackTemplates(
        sectorIds,
        templateDetails,
      );
      const flattenedReliefPackItems = assignedTemplates.flatMap(
        (template) => template.items || [],
      );

      return {
        household_id: household.household_id,
        family_head_name: mappedRow.family_head_name,
        address: addressParts.filter(Boolean).join(" | "),
        family_members_count: household.household_size || mappedRow.members_count || 0,
        sector_ids: sectorIds,
        sector_names: sectorNames,
        sectors_text: buildSectorsText(household),
        barangay_id: household.barangay?.id || null,
        barangay_name: barangayName,
        relief_pack_templates: assignedTemplates,
        relief_pack_items: flattenedReliefPackItems,
        relief_pack_name: assignedTemplates[0]?.name || "",
        distribution_status: distributionStatus,
        distribution_status_label:
          distributionStatus === "CLAIMED"
            ? "Claimed"
            : distributionStatus === "PENDING"
              ? "Pending / For Claim"
              : "Not Distributed",
        raw_stub_status: stubStatus,
      };
    });
  }, [masterlistPayload.data, templateDetails]);

  const displayedRows = useMemo(() => {
    return allRows.filter(
      (row) =>
        matchesSearch(row, searchTerm) &&
        matchesFilters(row, selectedStatus, selectedSectorIds),
    );
  }, [allRows, searchTerm, selectedStatus, selectedSectorIds]);

  const analytics = useMemo(() => {
    const claimedCount = displayedRows.filter(
      (row) => row.distribution_status === "CLAIMED",
    ).length;
    const pendingCount = displayedRows.filter(
      (row) => row.distribution_status === "PENDING",
    ).length;
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
      totalFamiliesServed: totalDistributed,
      totalReliefPacksDistributed: totalDistributed,
      claimedCount,
      pendingCount,
      notDistributedCount: displayedRows.length - totalDistributed,
      sectorBreakdown: sortedSectorCounts,
      topSector: sortedSectorCounts[0] || null,
    };
  }, [displayedRows]);

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
