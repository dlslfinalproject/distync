import { useEffect, useMemo, useState } from "react";
import {
  fetchActiveDisasterEvents,
  fetchBarangays,
  fetchConsolidatedMasterlist,
} from "../mswdo-masterlist/mswdoMasterlistService";
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

const getPreferredTemplate = (templates) => {
  if (!Array.isArray(templates) || templates.length === 0) {
    return null;
  }

  return (
    templates.find(
      (template) => template.is_active && template.based_on_family_size,
    ) ||
    templates.find((template) => template.is_active) ||
    templates[0]
  );
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

export const useInventoryDistribution = () => {
  const [disasterEvents, setDisasterEvents] = useState([]);
  const [barangays, setBarangays] = useState([]);
  const [reliefPackTemplates, setReliefPackTemplates] = useState([]);
  const [selectedDisasterEventId, setSelectedDisasterEventId] = useState("");
  const [selectedBarangayId, setSelectedBarangayId] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [selectedSectorIds, setSelectedSectorIds] = useState([]);
  const [masterlistPayload, setMasterlistPayload] = useState(emptyMasterlistPayload);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
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
          fetchActiveDisasterEvents(),
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

        if (eventRows.length > 0) {
          setSelectedDisasterEventId(eventRows[0].id);
        }

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
      const preferredTemplate = getPreferredTemplate(reliefPackTemplates);

      if (!preferredTemplate) {
        setSelectedTemplate(null);
        setIsLoadingTemplate(false);
        return;
      }

      setIsLoadingTemplate(true);

      try {
        const templateDetail = await fetchReliefPackTemplateById(preferredTemplate.id);

        if (!isMounted) {
          return;
        }

        setSelectedTemplate(templateDetail);

        if (reliefPackTemplates.length > 1) {
          setTemplateNotice(
            `Relief pack items are showing the active template preview: ${templateDetail.name}. Household-to-template assignment can be linked once that data is exposed.`,
          );
        } else {
          setTemplateNotice(
            `Relief pack items are showing the active template: ${templateDetail.name}.`,
          );
        }
      } catch (error) {
        if (isMounted) {
          setSelectedTemplate(null);
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

  const selectedBarangay = useMemo(() => {
    return barangays.find((barangay) => barangay.id === selectedBarangayId) || null;
  }, [barangays, selectedBarangayId]);

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

  const allRows = useMemo(() => {
    return (masterlistPayload.data || []).map((household) => {
      const mappedRow = mapMasterlistRow(household);
      const sectorNames = getHouseholdSectorNames(household);
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

      return {
        household_id: household.household_id,
        family_head_name: mappedRow.family_head_name,
        address: addressParts.filter(Boolean).join(" | "),
        family_members_count: household.household_size || mappedRow.members_count || 0,
        sector_ids: [...new Set(getHouseholdSectorIds(household))],
        sector_names: sectorNames,
        sectors_text: buildSectorsText(household),
        barangay_id: household.barangay?.id || null,
        barangay_name: barangayName,
        relief_pack_items: selectedTemplate?.items || [],
        relief_pack_name: selectedTemplate?.name || "",
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
  }, [masterlistPayload.data, selectedTemplate]);

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
    disasterEvents,
    barangays,
    sectorOptions,
    selectedDisasterEvent,
    selectedBarangay,
    selectedDisasterEventId,
    selectedBarangayId,
    selectedStatus,
    selectedSectorIds,
    searchTerm,
    selectedTemplate,
    templateNotice,
    displayedRows,
    analytics,
    isLoadingFilters,
    isLoadingMasterlist,
    isLoadingTemplate,
    errorMessage,
    hasActiveEvents: disasterEvents.length > 0,
    setSearchTerm,
    setSelectedDisasterEventId,
    setSelectedBarangayId,
    setSelectedStatus,
    setSelectedSectorIds,
  };
};
