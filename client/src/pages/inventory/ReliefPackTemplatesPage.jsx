import React, { useEffect, useMemo, useState } from "react";
import PageHeader, {
  pageHeaderStyles,
} from "../../components/layout/PageHeader";
import { shellStyles } from "../../components/layout/BarangayLayout";
import SearchBar from "../../components/shared/SearchBar";
import ReliefPackTemplateFormModal from "../../components/relief-pack-templates/ReliefPackTemplateFormModal";
import {
  createReliefPackTemplate,
  fetchInventoryItems,
  fetchReliefPackTemplateById,
  fetchReliefPackTemplates,
  updateReliefPackTemplate,
} from "../../features/relief-pack-templates/reliefPackTemplateService";
import { fetchActiveDisasterEvents } from "../../features/disaster-events/disasterEventService";
import { fetchInventoryBatches } from "../../features/inventory-batches/inventoryBatchService";
import { fetchConsolidatedMasterlistDashboard } from "../../features/mswdo-masterlist/mswdoMasterlistService";
import { useAuth } from "../../context/AuthContext";
import { FiFilter } from "react-icons/fi";

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

const emptyDashboardState = {
  totalFamilies: 0,
  perBarangayDemand: [],
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

const ReliefPackTemplatesPage = () => {
  const { authenticatedUser } = useAuth();
  const [activeTab, setActiveTab] = useState("relief-packs");
  const [filters, setFilters] = useState({ search: "" });
  const [templates, setTemplates] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [inventoryBatches, setInventoryBatches] = useState([]);
  const [activeDisasterEvents, setActiveDisasterEvents] = useState([]);
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

  const loadReliefPackPage = async () => {
    setIsLoading(true);
    setErrorMessage("");

    try {
      const [
        templateResponse,
        inventoryItemResponse,
        inventoryBatchResponse,
        activeDisasterEventResponse,
      ] = await Promise.all([
        fetchReliefPackTemplates({ is_active: "true" }),
        fetchInventoryItems(),
        fetchInventoryBatches(),
        fetchActiveDisasterEvents(),
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

  useEffect(() => {
    if (activeDisasterEvents.length === 0) {
      setAggregatedDemand(emptyDashboardState);
      return;
    }

    let isMounted = true;

    const loadAggregatedDemand = async () => {
      setIsLoadingDemand(true);

      try {
        const dashboards = await Promise.all(
          activeDisasterEvents.map((disasterEvent) =>
            fetchConsolidatedMasterlistDashboard({
              disasterEventId: disasterEvent.id,
              barangayId: null,
            }).catch(() => null),
          ),
        );

        if (!isMounted) {
          return;
        }

        const barangayDemandMap = new Map();
        let totalFamilies = 0;

        dashboards.filter(Boolean).forEach((dashboard) => {
          totalFamilies += Number(
            dashboard?.summary_metrics?.total_number_of_families || 0,
          );

          (dashboard?.charts?.per_barangay || []).forEach((barangay) => {
            const key = barangay.barangay_id || barangay.barangay_name;
            const existingBarangay = barangayDemandMap.get(key);

            if (existingBarangay) {
              existingBarangay.families_count += Number(barangay.families_count || 0);
            } else {
              barangayDemandMap.set(key, {
                barangay_id: barangay.barangay_id || key,
                barangay_name: barangay.barangay_name || "Unknown barangay",
                families_count: Number(barangay.families_count || 0),
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

    return () => {
      isMounted = false;
    };
  }, [activeDisasterEvents]);

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

      return (
        templateName.includes(normalizedSearch) ||
        itemNames.includes(normalizedSearch)
      );
    });
  }, [filters.search, templateCards]);

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
          is_active: payload.is_active,
          items: payload.items,
        });

        setSuccessMessage("Relief pack updated successfully.");
      } else {
        await createReliefPackTemplate({
          name: payload.name,
          description: payload.description,
          based_on_family_size: payload.based_on_family_size,
          based_on_sector: payload.based_on_sector,
          created_by: authenticatedUser?.id || null,
          is_active: payload.is_active,
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

      const shouldDelete = window.confirm(
        `Remove "${targetTemplate.name}" from the active relief packs list?`,
      );

      if (!shouldDelete) {
        return;
      }

      await updateReliefPackTemplate(templateId, {
        name: targetTemplate.name,
        description: targetTemplate.description,
        based_on_family_size: targetTemplate.based_on_family_size,
        based_on_sector: targetTemplate.based_on_sector,
        is_active: false,
        items: (targetTemplate.items || []).map((item) => ({
          inventory_item_id: item.inventory_item_id,
          quantity_required: Number(item.quantity_required || 0),
        })),
      });

      setSuccessMessage(`"${targetTemplate.name}" was removed from active relief packs.`);
      await loadReliefPackPage();
    } catch (error) {
      setErrorMessage(error.message);
    }
  };

  return (
    <div
      style={{ flex: 1, minWidth: 0, maxWidth: "100%", overflowX: "hidden" }}
    >
      <PageHeader
        eyebrow="Inventory"
        title="RELIEF PACK MANAGEMENT"
        actions={[
          { label: "Create Relief Pack", onClick: handleOpenCreateModal },
        ]}
      />

      <section style={{ ...shellStyles.card, boxSizing: "border-box" }}>
        <div
          style={{
            display: "flex",
            borderBottom: "1px solid #d6e2ef",
            marginBottom: "24px",
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
                      Packs We Can Create
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
                        No active disaster event demand found.
                      </p>
                    )}
                  </div>

                  {template.metrics.shortageItems.length > 0 ? (
                    <div style={alertBoxStyle}>
                      <p style={{ margin: 0, fontWeight: 800, fontSize: "15px" }}>
                        Low Stocks
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
                          {item.item_name} is low by {item.shortage_quantity} than demand
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
              onClick={loadReliefPackPage}
            >
              <FiFilter size={16} />
              Filter
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
              <div style={staticCardGridStyle}>
                {filteredTemplateCards.map((template) => (
                  <div key={template.id} style={staticCardStyle}>
                    <h3
                      style={{
                        margin: "0 0 12px",
                        color: "#2f3f5d",
                        fontSize: "22px",
                        fontWeight: 800,
                      }}
                    >
                      {template.name}
                    </h3>

                    <div style={staticInnerBoxStyle}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: "10px",
                        }}
                      >
                        <span
                          style={{
                            color: "#2f3f5d",
                            fontWeight: 800,
                            fontSize: "16px",
                          }}
                        >
                          Items
                        </span>
                        <span
                          style={{
                            color: "#2f3f5d",
                            fontWeight: 800,
                            fontSize: "16px",
                          }}
                        >
                          {(template.items || []).length}
                        </span>
                      </div>

                      <div
                        style={{
                          display: "grid",
                          gap: "6px",
                          marginBottom: "12px",
                        }}
                      >
                        {(template.items || []).map((item) => (
                          <div
                            key={item.id}
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "baseline",
                              gap: "12px",
                              color: "#3a4a66",
                              fontSize: "14px",
                            }}
                          >
                            <span>{item.inventory_item?.item_name || "--"}</span>
                            <span style={{ fontWeight: 600 }}>
                              {formatTemplateItemQuantity(item)}
                            </span>
                          </div>
                        ))}
                      </div>

                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginTop: "auto",
                          color: "#2f3f5d",
                          fontWeight: 800,
                          fontSize: "15px",
                        }}
                      >
                        <span>FAMILY PER PACK</span>
                        <span>1 Family</span>
                      </div>
                    </div>

                    <div style={{ marginTop: "auto" }}>
                      <div
                        style={{
                          display: "flex",
                          gap: "10px",
                          marginBottom: "10px",
                        }}
                      >
                        <button
                          type="button"
                          style={secondaryCardButtonStyle}
                          onClick={() => handleOpenEditModal(template.id)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          style={secondaryCardButtonStyle}
                          onClick={() => handleDeleteTemplate(template.id)}
                        >
                          Delete
                        </button>
                      </div>

                    </div>
                  </div>
                ))}
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
        errorMessage={modalErrorMessage}
        onClose={handleCloseModal}
        onSubmit={handleSubmitModal}
        isSubmitting={isSubmitting}
      />
    </div>
  );
};

export default ReliefPackTemplatesPage;
