import React, { useEffect, useMemo, useState } from "react";
import PageHeader, {
  pageHeaderStyles,
} from "../../components/layout/PageHeader";
import { shellStyles } from "../../components/layout/BarangayLayout";
import SearchBar from "../../components/shared/SearchBar";
import ReliefPackTemplateFormModal from "../../components/relief-pack-templates/ReliefPackTemplateFormModal";
import TableActionsMenu from "../../components/shared/TableActionsMenu";
import {
  createReliefPackTemplate,
  fetchInventoryItems,
  fetchReliefPackTemplateById,
  fetchReliefPackTemplates,
  updateReliefPackTemplate,
} from "../../features/relief-pack-templates/reliefPackTemplateService";
import {
  fetchActiveDisasterEvents,
  fetchBarangays,
  fetchEndedDisasterEvents,
} from "../../features/disaster-events/disasterEventService";
import { DISASTER_TYPE_OPTIONS } from "../../features/disaster-events/disasterTypeOptions";
import { fetchInventoryBatches } from "../../features/inventory-batches/inventoryBatchService";
import { fetchSectors } from "../../features/household-registration/householdRegistrationService";
import { fetchConsolidatedMasterlist } from "../../features/mswdo-masterlist/mswdoMasterlistService";
import { useAuth } from "../../context/AuthContext";
import { FiChevronDown, FiEdit2, FiEye, FiPlus, FiTrash2 } from "react-icons/fi";

const getTabStyle = (isActive) => ({
  padding: "12px 24px",
  border: "none",
  background: "none",
  fontSize: "14px",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  color: isActive ? "#17324d" : "#6b8298",
  borderBottom: isActive ? "3px solid #17324d" : "3px solid transparent",
  cursor: "pointer",
  transition: "all 0.2s ease",
  whiteSpace: "nowrap",
});

const scopeTabButtonStyles = (isActive) => ({
  padding: "12px 24px",
  border: "none",
  background: "none",
  fontSize: "14px",
  fontWeight: 700,
  textTransform: "uppercase",
  color: isActive ? "#17324d" : "#6b8298",
  borderBottom: isActive ? "3px solid #17324d" : "3px solid transparent",
  cursor: "pointer",
});

const filterStyles = {
  field: {
    width: "100%",
    padding: "12px 14px",
    paddingRight: "42px",
    borderRadius: "12px",
    border: "1px solid #cfddeb",
    backgroundColor: "#f8fbfe",
    color: "#1f3b57",
    fontSize: "14px",
    boxSizing: "border-box",
    outline: "none",
    appearance: "none",
    WebkitAppearance: "none",
    MozAppearance: "none",
  },
  label: {
    display: "block",
    marginBottom: "8px",
    color: "#5f7892",
    fontSize: "12px",
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  selectWrap: {
    position: "relative",
    width: "100%",
  },
  selectIcon: {
    position: "absolute",
    right: "14px",
    top: "50%",
    transform: "translateY(-50%)",
    pointerEvents: "none",
    color: "#5f7892",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  },
};

const summaryBoxStyle = {
  backgroundColor: "#b4c7be",
  borderRadius: "12px",
  padding: "20px",
  marginBottom: "15px",
  color: "#234260",
  border: "1px solid rgba(35, 66, 96, 0.08)",
};

const cardTitleStyle = {
  margin: "0 0 20px",
  fontSize: "18px",
  fontWeight: 800,
  color: "#17324d",
};

const helperTextStyle = {
  margin: 0,
  color: "#6b8298",
  fontSize: "14px",
};

const staticCardGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
  gap: "16px",
  alignItems: "stretch",
  width: "100%",
};

const staticCardStyle = {
  border: "1px solid #b7c7d8",
  borderRadius: "10px",
  backgroundColor: "#f8fbfe",
  padding: "16px",
  boxShadow: "0 2px 6px rgba(23, 50, 77, 0.10)",
  display: "flex",
  flexDirection: "column",
  minHeight: "100%",
  boxSizing: "border-box",
  width: "100%",
};

const tableStyles = {
  table: {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: "1040px",
  },
  headerCell: {
    padding: "14px 16px",
    textAlign: "left",
    fontSize: "12px",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "#66809c",
    borderBottom: "1px solid #e0eaf4",
    whiteSpace: "nowrap",
  },
  bodyCell: {
    padding: "16px",
    color: "#21405f",
    borderBottom: "1px solid #edf3f8",
    fontSize: "14px",
    verticalAlign: "top",
    lineHeight: 1.5,
    wordBreak: "break-word",
  },
  countBadge: {
    display: "inline-block",
    minWidth: "36px",
    textAlign: "center",
    padding: "6px 10px",
    borderRadius: "999px",
    backgroundColor: "#e5f1fb",
    color: "#356592",
    fontSize: "12px",
    fontWeight: 700,
  },
  helperText: {
    display: "block",
    marginTop: "4px",
    color: "#6b8298",
    fontSize: "12px",
  },
  centeredHeaderCell: {
    textAlign: "center",
  },
  centeredBodyCell: {
    textAlign: "center",
    verticalAlign: "middle",
  },
  itemList: {
    display: "grid",
    gap: "6px",
  },
  itemRow: {
    display: "flex",
    alignItems: "baseline",
    gap: "8px",
    color: "#21405f",
  },
  itemName: {
    fontWeight: 600,
  },
  itemQuantity: {
    color: "#6b8298",
    fontSize: "12px",
    fontWeight: 600,
  },
  stackedList: {
    display: "grid",
    gap: "10px",
  },
};

const staticInnerBoxStyle = {
  backgroundColor: "#eef2f6",
  borderRadius: "10px",
  padding: "14px 16px",
  marginBottom: "8px",
  minHeight: "270px",
  display: "flex",
  flexDirection: "column",
  boxSizing: "border-box",
};

const secondaryCardButtonStyle = {
  flex: 1,
  minHeight: "42px",
  borderRadius: "12px",
  border: "1px solid #c6d8ea",
  backgroundColor: "#f8fbfe",
  color: "#2a4c6f",
  fontSize: "14px",
  fontWeight: 700,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

const alertBoxStyle = {
  ...summaryBoxStyle,
  backgroundColor: "#f8d7da",
  color: "#721c24",
};

const confirmModalStyles = {
  overlay: {
    position: "fixed",
    inset: 0,
    backgroundColor: "rgba(18, 34, 51, 0.45)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px",
    zIndex: 1200,
  },
  modal: {
    width: "100%",
    maxWidth: "460px",
    backgroundColor: "#ffffff",
    borderRadius: "20px",
    padding: "28px",
    boxShadow: "0 24px 48px rgba(20, 48, 78, 0.2)",
  },
  title: {
    margin: 0,
    color: "#17324d",
    fontSize: "22px",
  },
  message: {
    margin: "12px 0 0",
    color: "#5d7188",
    fontSize: "15px",
    lineHeight: 1.6,
  },
  actions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "12px",
    marginTop: "24px",
    flexWrap: "wrap",
  },
};

const emptyDashboardState = {
  totalFamilies: 0,
  perBarangayDemand: [],
};

const isHouseholdStillNeedingReliefPack = (household) => {
  const stubStatus = String(household?.stub?.status || "").toUpperCase();
  return stubStatus !== "CLAIMED";
};

const getInventoryItemBaseQuantity = (inventoryItem) => {
  const quantityPerPackaging = Number(inventoryItem?.quantity || 1);
  const unitOfMeasureValue = Number(inventoryItem?.unit_of_measure_value || 1);

  const normalizedQuantityPerPackaging =
    Number.isFinite(quantityPerPackaging) && quantityPerPackaging > 0
      ? quantityPerPackaging
      : 1;
  const normalizedUnitOfMeasureValue =
    Number.isFinite(unitOfMeasureValue) && unitOfMeasureValue > 0
      ? unitOfMeasureValue
      : 1;

  return normalizedQuantityPerPackaging * normalizedUnitOfMeasureValue;
};

const getInventoryItemTotalStockQuantity = (inventoryItem) => {
  const packagingCount = Number(inventoryItem?.packaging_count || 0);
  const normalizedPackagingCount =
    Number.isFinite(packagingCount) && packagingCount > 0 ? packagingCount : 0;

  return normalizedPackagingCount * getInventoryItemBaseQuantity(inventoryItem);
};

const getTemplateItemRequiredBaseQuantity = (templateItem) => {
  const quantityRequired = Number(templateItem?.quantity_required || 0);
  return Number.isFinite(quantityRequired) && quantityRequired > 0
    ? quantityRequired
    : 0;
};

const buildAvailabilityByItemId = (inventoryBatches, inventoryItems) => {
  const availabilityByItemId = new Map();
  const inventoryItemById = new Map(
    (inventoryItems || []).map((inventoryItem) => [inventoryItem.id, inventoryItem]),
  );
  const itemsWithBatchStock = new Set();

  (inventoryBatches || []).forEach((batch) => {
    if (
      !batch?.inventory_item_id ||
      !["AVAILABLE", "LOW_STOCK"].includes(batch.status) ||
      Number(batch.quantity_available || 0) <= 0
    ) {
      return;
    }

    itemsWithBatchStock.add(batch.inventory_item_id);

    const inventoryItem = inventoryItemById.get(batch.inventory_item_id);
    const quantityMultiplier = getInventoryItemBaseQuantity(inventoryItem);
    const totalAvailableQuantity =
      Number(batch.quantity_available || 0) * quantityMultiplier;

    availabilityByItemId.set(
      batch.inventory_item_id,
      (availabilityByItemId.get(batch.inventory_item_id) || 0) +
        totalAvailableQuantity,
    );
  });

  (inventoryItems || []).forEach((inventoryItem) => {
    if (!inventoryItem?.id || itemsWithBatchStock.has(inventoryItem.id)) {
      return;
    }

    availabilityByItemId.set(
      inventoryItem.id,
      getInventoryItemTotalStockQuantity(inventoryItem),
    );
  });

  return availabilityByItemId;
};

const computeTemplateMetrics = ({
  template,
  availabilityByItemId,
  inventoryItemById,
  totalFamilies,
  perBarangayDemand,
}) => {
  const items = template.items || [];

  const packsWeCanCreate = items.length
    ? Math.min(
        ...items.map((item) => {
          const availableQuantity =
            availabilityByItemId.get(item.inventory_item_id) || 0;
          const requiredBaseQuantity = getTemplateItemRequiredBaseQuantity(item);

          if (!requiredBaseQuantity) {
            return 0;
          }

          return Math.floor(availableQuantity / requiredBaseQuantity);
        }),
      )
    : 0;

  const shortageItems = items
    .map((item) => {
      const availableQuantity = availabilityByItemId.get(item.inventory_item_id) || 0;
      const requiredBaseQuantity = getTemplateItemRequiredBaseQuantity(item);
      const totalRequired = totalFamilies * requiredBaseQuantity;
      const shortageQuantity = Math.max(totalRequired - availableQuantity, 0);

      return {
        inventory_item_id: item.inventory_item_id,
        item_name: item.inventory_item?.item_name || "Unknown item",
        shortage_quantity: shortageQuantity,
      };
    })
    .filter((item) => item.shortage_quantity > 0)
    .sort((leftItem, rightItem) => rightItem.shortage_quantity - leftItem.shortage_quantity);

  return {
    packsWeCanCreate: Number.isFinite(packsWeCanCreate) ? packsWeCanCreate : 0,
    neededPacks: totalFamilies,
    perBarangayDemand: perBarangayDemand.slice(0, 6),
    shortageItems,
  };
};

const formatTemplateItemQuantity = (item) => {
  const quantityRequired = Number(item?.quantity_required || 0);

  if (!Number.isFinite(quantityRequired) || quantityRequired <= 0) {
    return "--";
  }

  return `${quantityRequired} pc${quantityRequired === 1 ? "" : "s"}`;
};

const formatTemplateDisasterApplicability = (template) => {
  if (template?.applies_to_all_disasters !== false) {
    return "All disaster types";
  }

  const disasterTypes = Array.isArray(template?.disaster_types)
    ? template.disaster_types
    : [];

  return disasterTypes.length > 0 ? disasterTypes.join(", ") : "--";
};

const getTemplateSourceTypes = (template, inventoryBatches) => {
  const templateItemIds = new Set(
    (template?.items || [])
      .map((item) => item.inventory_item_id)
      .filter(Boolean),
  );

  if (templateItemIds.size === 0) {
    return [];
  }

  return Array.from(
    new Set(
      (inventoryBatches || [])
        .filter((batch) => templateItemIds.has(batch.inventory_item_id))
        .map((batch) => String(batch.source_type || "").toUpperCase())
        .filter(Boolean),
    ),
  );
};

const isDonatedReliefPackTemplate = (template, inventoryBatches) => {
  const sourceTypes = getTemplateSourceTypes(template, inventoryBatches);

  return sourceTypes.length > 0 && sourceTypes.every((sourceType) => sourceType === "DONATED");
};

const ReliefPackTemplatesPage = () => {
  const { authenticatedUser } = useAuth();
  const [activeTab, setActiveTab] = useState("relief-packs");
  const [filters, setFilters] = useState({ search: "" });
  const [templates, setTemplates] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [inventoryBatches, setInventoryBatches] = useState([]);
  const [activeDisasterEvents, setActiveDisasterEvents] = useState([]);
  const [endedDisasterEvents, setEndedDisasterEvents] = useState([]);
  const [barangayOptions, setBarangayOptions] = useState([]);
  const [selectedDisasterEventId, setSelectedDisasterEventId] = useState("");
  const [selectedBarangayId, setSelectedBarangayId] = useState("");
  const [sectorOptions, setSectorOptions] = useState([]);
  const [aggregatedDemand, setAggregatedDemand] = useState(emptyDashboardState);
  const [selectedTemplateId, setSelectedTemplateId] = useState(null);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingDemand, setIsLoadingDemand] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("create");
  const [modalErrorMessage, setModalErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingDeleteTemplate, setPendingDeleteTemplate] = useState(null);
  const [isDeletingTemplate, setIsDeletingTemplate] = useState(false);

  const loadReliefPackPage = async () => {
    setIsLoading(true);
    setErrorMessage("");

    try {
      const [
        templateResponse,
        inventoryItemResponse,
        inventoryBatchResponse,
        activeDisasterEventResponse,
        endedDisasterEventResponse,
        barangayResponse,
        sectorResponse,
      ] = await Promise.all([
        fetchReliefPackTemplates({ is_active: "true" }),
        fetchInventoryItems(),
        fetchInventoryBatches(),
        fetchActiveDisasterEvents(),
        fetchEndedDisasterEvents(),
        fetchBarangays(),
        fetchSectors(),
      ]);

      const templateDetails = await Promise.all(
        (templateResponse || []).map((template) =>
          fetchReliefPackTemplateById(template.id),
        ),
      );

      setTemplates(templateDetails || []);
      setInventoryItems(inventoryItemResponse || []);
      setInventoryBatches(inventoryBatchResponse || []);
      setActiveDisasterEvents(activeDisasterEventResponse || []);
      setEndedDisasterEvents(endedDisasterEventResponse || []);
      setBarangayOptions(barangayResponse || []);
      setSectorOptions(Array.isArray(sectorResponse?.data) ? sectorResponse.data : []);
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const loadTemplateDetail = async (templateId) => {
    const response = await fetchReliefPackTemplateById(templateId);

    setSelectedTemplate(response);
    setSelectedTemplateId(templateId);
    setTemplates((currentTemplates) =>
      currentTemplates.map((template) =>
        template.id === templateId ? response : template,
      ),
    );

    return response;
  };

  useEffect(() => {
    loadReliefPackPage();
  }, []);

  const scopedDisasterEvents = useMemo(
    () => [...activeDisasterEvents, ...endedDisasterEvents],
    [activeDisasterEvents, endedDisasterEvents],
  );

  useEffect(() => {
    if (!selectedDisasterEventId) {
      return;
    }

    if (scopedDisasterEvents.some((event) => event.id === selectedDisasterEventId)) {
      return;
    }

    setSelectedDisasterEventId("");
  }, [scopedDisasterEvents, selectedDisasterEventId]);

  useEffect(() => {
    let isMounted = true;

    const refreshInventoryDrivenMetrics = async () => {
      try {
        const [templateResponse, inventoryItemResponse, inventoryBatchResponse] =
          await Promise.all([
            fetchReliefPackTemplates({ is_active: "true" }),
            fetchInventoryItems(),
            fetchInventoryBatches(),
          ]);

        const templateDetails = await Promise.all(
          (templateResponse || []).map((template) =>
            fetchReliefPackTemplateById(template.id),
          ),
        );

        if (!isMounted) {
          return;
        }

        setTemplates(templateDetails || []);
        setInventoryItems(inventoryItemResponse || []);
        setInventoryBatches(inventoryBatchResponse || []);
      } catch (_error) {
        // Keep the current view stable during background refresh attempts.
      }
    };

    const handleVisibilityRefresh = () => {
      if (document.visibilityState === "visible") {
        void refreshInventoryDrivenMetrics();
      }
    };

    const refreshInterval = window.setInterval(refreshInventoryDrivenMetrics, 30000);

    window.addEventListener("focus", refreshInventoryDrivenMetrics);
    document.addEventListener("visibilitychange", handleVisibilityRefresh);

    return () => {
      isMounted = false;
      window.clearInterval(refreshInterval);
      window.removeEventListener("focus", refreshInventoryDrivenMetrics);
      document.removeEventListener("visibilitychange", handleVisibilityRefresh);
    };
  }, []);

  useEffect(() => {
    if (scopedDisasterEvents.length === 0 && !selectedDisasterEventId) {
      setAggregatedDemand(emptyDashboardState);
      return;
    }

    let isMounted = true;

    const loadAggregatedDemand = async () => {
      setIsLoadingDemand(true);

      try {
        const masterlists = await Promise.all(
          scopedDisasterEvents
            .filter((disasterEvent) =>
              selectedDisasterEventId ? disasterEvent.id === selectedDisasterEventId : true,
            )
            .map((disasterEvent) =>
            fetchConsolidatedMasterlist({
              disasterEventId: disasterEvent.id,
              barangayId: selectedBarangayId || null,
              recordStatus: "active",
            }).catch(() => null),
            ),
        );

        if (!isMounted) {
          return;
        }

        const barangayDemandMap = new Map();
        let totalFamilies = 0;

        masterlists.filter(Boolean).forEach((masterlist) => {
          const activeHouseholds = (Array.isArray(masterlist?.data)
            ? masterlist.data
            : []).filter(isHouseholdStillNeedingReliefPack);

          totalFamilies += activeHouseholds.length;

          activeHouseholds.forEach((household) => {
            const barangayId = household?.barangay?.id || household?.household_id;
            const barangayName = household?.barangay?.name || "Unknown barangay";
            const key = barangayId || barangayName;
            const existingBarangay = barangayDemandMap.get(key);

            if (existingBarangay) {
              existingBarangay.families_count += 1;
            } else {
              barangayDemandMap.set(key, {
                barangay_id: barangayId || key,
                barangay_name: barangayName,
                families_count: 1,
              });
            }
          });
        });

        setAggregatedDemand({
          totalFamilies,
          perBarangayDemand: Array.from(barangayDemandMap.values()).sort(
            (leftBarangay, rightBarangay) =>
              rightBarangay.families_count - leftBarangay.families_count,
          ),
        });
      } finally {
        if (isMounted) {
          setIsLoadingDemand(false);
        }
      }
    };

    loadAggregatedDemand();
    const refreshInterval = window.setInterval(loadAggregatedDemand, 30000);

    return () => {
      isMounted = false;
      window.clearInterval(refreshInterval);
    };
  }, [scopedDisasterEvents, selectedBarangayId, selectedDisasterEventId]);

  const availabilityByItemId = useMemo(
    () => buildAvailabilityByItemId(inventoryBatches, inventoryItems),
    [inventoryBatches, inventoryItems],
  );

  const inventoryItemById = useMemo(
    () => new Map((inventoryItems || []).map((inventoryItem) => [inventoryItem.id, inventoryItem])),
    [inventoryItems],
  );

  const templateCards = useMemo(() => {
    return templates.map((template) => ({
      ...template,
      metrics: computeTemplateMetrics({
        template,
        availabilityByItemId,
        inventoryItemById,
        totalFamilies: aggregatedDemand.totalFamilies,
        perBarangayDemand: aggregatedDemand.perBarangayDemand,
      }),
    }));
  }, [aggregatedDemand, availabilityByItemId, inventoryItemById, templates]);

  const filteredTemplateCards = useMemo(() => {
    const normalizedSearch = filters.search.trim().toLowerCase();

    if (!normalizedSearch) {
      return templateCards;
    }

    return templateCards.filter((template) => {
      const templateName = template.name.toLowerCase();
      const itemNames = (template.items || [])
        .map((item) => item.inventory_item?.item_name || "")
        .join(" ")
        .toLowerCase();
      const disasterTypes = (template.applies_to_all_disasters !== false
        ? ["All disaster types"]
        : template.disaster_types || []
      )
        .join(" ")
        .toLowerCase();

      return (
        templateName.includes(normalizedSearch) ||
        itemNames.includes(normalizedSearch) ||
        disasterTypes.includes(normalizedSearch)
      );
    });
  }, [filters.search, templateCards]);

  const templateAccessMap = useMemo(() => {
    return new Map(
      templates.map((template) => [
        template.id,
        {
          isDonatedTemplate: isDonatedReliefPackTemplate(template, inventoryBatches),
        },
      ]),
    );
  }, [templates, inventoryBatches]);

  const handleOpenCreateModal = () => {
    setModalMode("create");
    setSelectedTemplateId(null);
    setSelectedTemplate(null);
    setModalErrorMessage("");
    setSuccessMessage("");
    setIsModalOpen(true);
  };

  const handleOpenEditModal = async (templateId) => {
    setModalMode("edit");
    setModalErrorMessage("");
    setSuccessMessage("");

    try {
      await loadTemplateDetail(templateId);
      setIsModalOpen(true);
    } catch (error) {
      setErrorMessage(error.message);
    }
  };

  const handleCloseModal = () => {
    if (!isSubmitting) {
      setIsModalOpen(false);
    }
  };

  const handleSubmitModal = async (payload) => {
    setIsSubmitting(true);
    setModalErrorMessage("");

    try {
      if (modalMode === "edit" && selectedTemplateId) {
        await updateReliefPackTemplate(selectedTemplateId, {
          name: payload.name,
          description: payload.description,
          based_on_family_size: payload.based_on_family_size,
          based_on_sector: payload.based_on_sector,
          is_additional_pack: payload.is_additional_pack,
          sector_id: payload.sector_id,
          applies_to_all_disasters: payload.applies_to_all_disasters,
          is_active: payload.is_active,
          disaster_types: payload.disaster_types,
          items: payload.items,
        });

        setSuccessMessage("Relief pack updated successfully.");
      } else {
        await createReliefPackTemplate({
          name: payload.name,
          description: payload.description,
          based_on_family_size: payload.based_on_family_size,
          based_on_sector: payload.based_on_sector,
          is_additional_pack: payload.is_additional_pack,
          sector_id: payload.sector_id,
          applies_to_all_disasters: payload.applies_to_all_disasters,
          created_by: authenticatedUser?.id || null,
          is_active: payload.is_active,
          disaster_types: payload.disaster_types,
          items: payload.items,
        });

        setSuccessMessage("Relief pack created successfully.");
      }

      setIsModalOpen(false);
      await loadReliefPackPage();
    } catch (error) {
      setModalErrorMessage(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteTemplate = async (templateId) => {
    try {
      const targetTemplate =
        templates.find((template) => template.id === templateId) ||
        (await loadTemplateDetail(templateId));

      setPendingDeleteTemplate(targetTemplate);
    } catch (error) {
      setErrorMessage(error.message);
    }
  };

  const handleOpenViewModal = async (templateId) => {
    setModalMode("view");
    setModalErrorMessage("");
    setSuccessMessage("");

    try {
      await loadTemplateDetail(templateId);
      setIsModalOpen(true);
    } catch (error) {
      setErrorMessage(error.message);
    }
  };

  const handleCancelDeleteTemplate = () => {
    if (!isDeletingTemplate) {
      setPendingDeleteTemplate(null);
    }
  };

  const handleConfirmDeleteTemplate = async () => {
    if (!pendingDeleteTemplate) {
      return;
    }

    setIsDeletingTemplate(true);
    setErrorMessage("");

    try {
      await updateReliefPackTemplate(pendingDeleteTemplate.id, {
        name: pendingDeleteTemplate.name,
        description: pendingDeleteTemplate.description,
        based_on_family_size: pendingDeleteTemplate.based_on_family_size,
        based_on_sector: pendingDeleteTemplate.based_on_sector,
        is_additional_pack: pendingDeleteTemplate.is_additional_pack,
        sector_id: pendingDeleteTemplate.sector_id,
        applies_to_all_disasters: pendingDeleteTemplate.applies_to_all_disasters,
        is_active: false,
        disaster_types: pendingDeleteTemplate.disaster_types || [],
        items: (pendingDeleteTemplate.items || []).map((item) => ({
          inventory_item_id: item.inventory_item_id,
          quantity_required: Number(item.quantity_required || 0),
        })),
      });

      setSuccessMessage(
        `"${pendingDeleteTemplate.name}" was removed from active relief packs.`,
      );
      setPendingDeleteTemplate(null);
      await loadReliefPackPage();
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setIsDeletingTemplate(false);
    }
  };

  return (
    <div
      style={{ flex: 1, minWidth: 0, maxWidth: "100%", overflowX: "hidden" }}
    >
      <PageHeader
        eyebrow="Inventory"
        title="RELIEF PACK MANAGEMENT"
        actions={[]}
      />

      <section style={{ ...shellStyles.card, boxSizing: "border-box" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "16px",
            alignItems: "end",
          }}
        >
          <div>
            <label
              htmlFor="relief-pack-management-event"
              style={filterStyles.label}
            >
              Disaster Event
            </label>
            <div style={filterStyles.selectWrap}>
              <select
                id="relief-pack-management-event"
                value={selectedDisasterEventId}
                onChange={(event) => setSelectedDisasterEventId(event.target.value)}
                disabled={isLoading}
                style={filterStyles.field}
              >
                <option value="">All disaster events</option>
                {scopedDisasterEvents.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.title}
                  </option>
                ))}
              </select>
              <span style={filterStyles.selectIcon}>
                <FiChevronDown size={16} />
              </span>
            </div>
          </div>

          <div>
            <label
              htmlFor="relief-pack-management-barangay"
              style={filterStyles.label}
            >
              Barangay
            </label>
            <div style={filterStyles.selectWrap}>
              <select
                id="relief-pack-management-barangay"
                value={selectedBarangayId}
                onChange={(event) => setSelectedBarangayId(event.target.value)}
                disabled={isLoading}
                style={filterStyles.field}
              >
                <option value="">All barangays</option>
                {barangayOptions.map((barangay) => (
                  <option key={barangay.id} value={barangay.id}>
                    {barangay.name}
                  </option>
                ))}
              </select>
              <span style={filterStyles.selectIcon}>
                <FiChevronDown size={16} />
              </span>
            </div>
          </div>
        </div>
      </section>

      <section
        style={{
          ...shellStyles.card,
          marginTop: "16px",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            display: "flex",
            borderBottom: "1px solid #d6e2ef",
            flexWrap: "wrap",
            gap: "8px",
            overflowX: "auto",
            msOverflowStyle: "none",
            scrollbarWidth: "none",
          }}
        >
          <button
            type="button"
            style={getTabStyle(activeTab === "relief-packs")}
            onClick={() => setActiveTab("relief-packs")}
          >
            Relief Packs
          </button>
          <button
            type="button"
            style={getTabStyle(activeTab === "customization")}
            onClick={() => setActiveTab("customization")}
          >
            Pack Customization
          </button>
        </div>
      </section>

      {activeTab === "relief-packs" ? (
        <section
          style={{
            ...shellStyles.card,
            marginTop: "16px",
            padding: "24px",
            boxSizing: "border-box",
          }}
        >
          {isLoading ? (
            <p style={helperTextStyle}>Loading relief packs...</p>
          ) : templateCards.length === 0 ? (
            <p style={helperTextStyle}>No active relief packs are available yet.</p>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
                gap: "20px",
              }}
            >
              {templateCards.map((template) => (
                <div key={template.id} style={shellStyles.card}>
                  <h2 style={cardTitleStyle}>{template.name.toUpperCase()}</h2>

                  <div style={summaryBoxStyle}>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: "15px" }}>
                      Packs Available
                    </p>
                    <h1
                      style={{
                        fontSize: "36px",
                        margin: "8px 0 0",
                        fontWeight: 800,
                        lineHeight: 1.1,
                      }}
                    >
                      {template.metrics.packsWeCanCreate.toLocaleString()}
                    </h1>
                  </div>

                  <div style={summaryBoxStyle}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: "12px",
                      }}
                    >
                      <p style={{ margin: 0, fontWeight: 700, fontSize: "15px" }}>
                        Packs Needed
                      </p>
                      <h1
                        style={{
                          fontSize: "36px",
                          margin: 0,
                          fontWeight: 800,
                          lineHeight: 1.1,
                        }}
                      >
                        {template.metrics.neededPacks.toLocaleString()}
                      </h1>
                    </div>

                    {isLoadingDemand ? (
                      <p style={{ fontSize: "12px", margin: "12px 0 0" }}>
                        Loading demand...
                      </p>
                    ) : template.metrics.perBarangayDemand.length > 0 ? (
                      <div
                        style={{
                          fontSize: "12px",
                          marginTop: "12px",
                          display: "grid",
                          gap: "2px",
                          color: "#234260",
                          fontWeight: 600,
                        }}
                      >
                        {template.metrics.perBarangayDemand.map((barangay) => (
                          <span key={`${template.id}-${barangay.barangay_id}`}>
                            {barangay.barangay_name}: {barangay.families_count}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p style={{ fontSize: "12px", margin: "12px 0 0" }}>
                        No active event demand found.
                      </p>
                    )}
                  </div>

                  {template.metrics.shortageItems.length > 0 ? (
                    <div style={alertBoxStyle}>
                      <p style={{ margin: 0, fontWeight: 800, fontSize: "15px" }}>
                        Stock Shortages
                      </p>
                      {template.metrics.shortageItems.slice(0, 3).map((item) => (
                        <p
                          key={`${template.id}-${item.inventory_item_id}`}
                          style={{
                            fontSize: "12px",
                            margin: "8px 0 0",
                            fontWeight: 600,
                          }}
                        >
                          Need {item.shortage_quantity} more {item.item_name}
                        </p>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </section>
      ) : (
        <>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              marginTop: "16px",
              marginBottom: "20px",
              flexWrap: "wrap",
            }}
          >
            <div style={{ flex: 1 }}>
              <SearchBar
                value={filters.search}
                onChange={(value) =>
                  setFilters((previousFilters) => ({
                    ...previousFilters,
                    search: value,
                  }))
                }
                placeholder="Search relief pack templates"
              />
            </div>

            <button
              type="button"
              style={pageHeaderStyles.secondaryButton}
              onClick={handleOpenCreateModal}
            >
              <FiPlus size={16} />
              Create Relief Pack
            </button>
          </div>

          <section
            style={{
              ...shellStyles.card,
              marginTop: "0",
              padding: "24px",
              boxSizing: "border-box",
              overflow: "visible",
            }}
          >
            {isLoading ? (
              <p style={helperTextStyle}>Loading pack customization...</p>
            ) : filteredTemplateCards.length === 0 ? (
              <p style={helperTextStyle}>No active relief packs are available yet.</p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={tableStyles.table}>
                  <thead>
                    <tr>
                      <th style={tableStyles.headerCell}>Name</th>
                      <th style={tableStyles.headerCell}>Items</th>
                      <th style={tableStyles.headerCell}>Quantity Per Item</th>
                      <th
                        style={{
                          ...tableStyles.headerCell,
                          ...tableStyles.centeredHeaderCell,
                        }}
                      >
                        Recommended Family Size
                      </th>
                      <th style={tableStyles.headerCell}>Disaster Applicability</th>
                      <th
                        style={{
                          ...tableStyles.headerCell,
                          ...tableStyles.centeredHeaderCell,
                        }}
                      >
                        Available Packs
                      </th>
                      <th
                        style={{
                          ...tableStyles.headerCell,
                          ...tableStyles.centeredHeaderCell,
                          width: "88px",
                        }}
                      >
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTemplateCards.map((template) => {
                      const templateAccess = templateAccessMap.get(template.id) || {
                        isDonatedTemplate: false,
                      };

                      return (
                        <tr key={template.id}>
                        <td style={tableStyles.bodyCell}>
                          <div style={{ fontWeight: 700 }}>{template.name}</div>
                          {templateAccess.isDonatedTemplate ? (
                            <span style={tableStyles.helperText}>Donated relief pack</span>
                          ) : null}
                        </td>
                        <td style={tableStyles.bodyCell}>
                          {(template.items || []).length > 0 ? (
                            <div style={tableStyles.stackedList}>
                              {(template.items || []).map((item, index) => (
                                <div
                                  key={item.id || `${template.id}-${item.inventory_item_id}`}
                                  style={tableStyles.itemRow}
                                >
                                  <span style={tableStyles.itemName}>
                                    {item.inventory_item?.item_name || "--"}
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span style={tableStyles.helperText}>No items</span>
                          )}
                        </td>
                        <td style={tableStyles.bodyCell}>
                          {(template.items || []).length > 0 ? (
                            <div style={tableStyles.stackedList}>
                              {(template.items || []).map((item, index) => (
                                <div
                                  key={`qty-${item.id || `${template.id}-${item.inventory_item_id}`}`}
                                  style={tableStyles.itemRow}
                                >
                                  <span style={tableStyles.itemQuantity}>
                                    {formatTemplateItemQuantity(item)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span style={tableStyles.helperText}>--</span>
                          )}
                        </td>
                        <td
                          style={{
                            ...tableStyles.bodyCell,
                            ...tableStyles.centeredBodyCell,
                          }}
                        >
                          {template.description || "--"}
                        </td>
                        <td style={tableStyles.bodyCell}>
                          <div>{formatTemplateDisasterApplicability(template)}</div>
                          {template.applies_to_all_disasters === false ? (
                            <span style={tableStyles.helperText}>
                              {template.disaster_types?.length || 0} selected type
                              {(template.disaster_types?.length || 0) === 1 ? "" : "s"}
                            </span>
                          ) : (
                            <span style={tableStyles.helperText}>
                              Covers {DISASTER_TYPE_OPTIONS.length} defined disaster types
                            </span>
                          )}
                        </td>
                        <td
                          style={{
                            ...tableStyles.bodyCell,
                            ...tableStyles.centeredBodyCell,
                          }}
                        >
                          {template.metrics.packsWeCanCreate.toLocaleString()}
                        </td>
                        <td
                          style={{
                            ...tableStyles.bodyCell,
                            ...tableStyles.centeredBodyCell,
                            whiteSpace: "nowrap",
                          }}
                        >
                          <TableActionsMenu
                            row={template}
                            menuId={`relief-pack-template-${template.id}`}
                            buttonTitle="Actions"
                            buttonAriaLabel="Actions"
                            dataPrefix="relief-pack-template-action"
                            menuWidth={168}
                            variant="icon-grid"
                            items={[
                              {
                                key: "view",
                                label: "View Relief Pack",
                                icon: <FiEye size={18} />,
                                onClick: (selectedRow) =>
                                  handleOpenViewModal(selectedRow.id),
                              },
                              ...(!templateAccess.isDonatedTemplate
                                ? [
                                    {
                                      key: "edit",
                                      label: "Edit Relief Pack",
                                      icon: <FiEdit2 size={18} />,
                                      onClick: (selectedRow) =>
                                        handleOpenEditModal(selectedRow.id),
                                    },
                                    {
                                      key: "delete",
                                      label: "Delete Relief Pack",
                                      icon: <FiTrash2 size={18} />,
                                      tone: "destructive",
                                      onClick: (selectedRow) =>
                                        handleDeleteTemplate(selectedRow.id),
                                    },
                                  ]
                                : []),
                            ]}
                          />
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      {errorMessage ? (
        <section style={{ ...shellStyles.card, marginTop: "16px" }}>
          <p style={{ ...helperTextStyle, color: "#9d4d58" }}>{errorMessage}</p>
        </section>
      ) : null}

      {successMessage ? (
        <section style={{ ...shellStyles.card, marginTop: "16px" }}>
          <p style={{ ...helperTextStyle, color: "#17663a" }}>
            {successMessage}
          </p>
        </section>
      ) : null}

      <ReliefPackTemplateFormModal
        isOpen={isModalOpen}
        mode={modalMode}
        templateData={selectedTemplate}
        inventoryItems={inventoryItems}
        sectorOptions={sectorOptions}
        errorMessage={modalErrorMessage}
        onClose={handleCloseModal}
        onSubmit={handleSubmitModal}
        isSubmitting={isSubmitting}
      />

      {pendingDeleteTemplate ? (
        <div style={confirmModalStyles.overlay}>
          <div style={confirmModalStyles.modal}>
            <h3 style={confirmModalStyles.title}>Remove Relief Pack</h3>
            <p style={confirmModalStyles.message}>
              Are you sure you want to remove "{pendingDeleteTemplate.name}" from
              the active relief packs list?
            </p>

            <div style={confirmModalStyles.actions}>
              <button
                type="button"
                onClick={handleCancelDeleteTemplate}
                disabled={isDeletingTemplate}
                style={pageHeaderStyles.secondaryButton}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteTemplate}
                disabled={isDeletingTemplate}
                style={{
                  ...pageHeaderStyles.primaryButton,
                  opacity: isDeletingTemplate ? 0.7 : 1,
                }}
              >
                {isDeletingTemplate ? "Removing..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default ReliefPackTemplatesPage;
