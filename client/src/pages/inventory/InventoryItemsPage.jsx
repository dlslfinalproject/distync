import React, { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import PageHeader, { pageHeaderStyles } from "../../components/layout/PageHeader";
import { shellStyles } from "../../components/layout/BarangayLayout";
import InventoryItemFormModal from "../../components/inventory-items/InventoryItemFormModal";
import BarcodeScanModal from "../../components/inventory-items/BarcodeScanModal";
import InventoryItemsTable from "../../components/inventory-items/InventoryItemsTable";
import InventoryOverviewCards from "../../components/inventory-items/InventoryOverviewCards";
import InventoryExportModal from "../../components/inventory-items/InventoryExportModal";
import ForecastingPanel from "../../components/inventory-items/ForecastingPanel";
import InventoryFilters from "../../components/inventory-items/InventoryFilters";
import {
  createInventoryItem,
  exportInventoryItems,
  fetchLatestInventoryForecast,
  fetchInventoryItems,
  runInventoryForecast,
} from "../../features/inventory-items/inventoryItemService";
import { fetchInventoryBatches } from "../../features/inventory-batches/inventoryBatchService";
import { fetchInventoryTransactions } from "../../features/inventory-transactions/inventoryTransactionService";
import { fetchAllDisasterEvents } from "../../features/disaster-events/disasterEventService";
import {
  FiFileText,
  FiPackage,
  FiPlus,
} from "react-icons/fi";
import { MdQrCodeScanner } from "react-icons/md";
import db from "../../offline/db";
import { subscribeToSyncUpdates } from "../../offline/syncService";
import {
  buildInventoryExportFilters,
  forecastModelOptions,
  getForecastModelLabel,
  hasInventoryExportRows,
  inventoryExportFormatOptions,
  inventoryExportReportOptions,
  NO_EXPORT_DATA_MESSAGE,
} from "../../features/inventory-items/inventoryItemExportOptions";
import { formatPercentage } from "../../features/inventory-items/inventoryItemFormatting";
import {
  buildInventoryTrackingMap,
  createEmptyTrackingStats,
  getItemStatus,
  getTrackedExpirationDate,
  isDateExpired,
} from "../../features/inventory-items/inventoryItemStockStatus";
import { mergeInventoryItemsWithSyncStatus } from "../../features/inventory-items/inventoryItemSync";

const primaryTopBtn = {
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
  border: "none",
  borderRadius: "14px",
  padding: "12px 18px",
  background: "linear-gradient(135deg, #2f6499 0%, #4c86be 100%)",
  color: "#ffffff",
  fontSize: "14px",
  fontWeight: 700,
  cursor: "pointer",
  boxShadow: "0 12px 24px rgba(58, 97, 141, 0.18)",
};

const secondaryTopBtn = {
  border: "1px solid #c6d8ea",
  borderRadius: "14px",
  padding: "12px 18px",
  backgroundColor: "#f8fbfe",
  color: "#2a4c6f",
  fontSize: "14px",
  fontWeight: 700,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
};

const analyticsCard = {
  background: "#f8fbff",
  border: "1px solid #d6e2ef",
  borderRadius: "14px",
  padding: "16px",
};

const styles = {
  topActionsRow: {
    display: "flex",
    justifyContent: "flex-end",
    alignItems: "center",
    margin: "16px 0 24px",
    flexWrap: "wrap",
    gap: "12px",
  },
  tabContainer: {
    display: "flex",
    borderBottom: "1px solid #d6e2ef",
    marginBottom: "24px",
    gap: "8px",
    flexWrap: "wrap",
  },
  sectionTitle: {
    margin: "0 0 12px 0",
    fontWeight: 800,
    fontSize: "24px",
    color: "#2f3f5d",
    lineHeight: 1.1,
  },
  addItemIconWrap: {
    position: "relative",
    width: "18px",
    height: "18px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  },
  addItemPlus: {
    position: "absolute",
    right: "-5px",
    bottom: "-4px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#ffffff",
    background: "transparent",
    padding: 0,
    borderRadius: 0,
    boxShadow: "none",
    lineHeight: 1,
  },
};

const tabButtonStyles = (isActive) => ({
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

const buildInventoryItemFilters = (filters) => {
  const apiFilters = {
    search: filters.search,
  };

  if (filters.category === "Perishable") {
    apiFilters.is_perishable = "true";
  } else if (filters.category === "Non-Perishable") {
    apiFilters.is_perishable = "false";
  }

  return apiFilters;
};

const InventoryItemsPage = () => {
  const [filters, setFilters] = useState({
    search: "",
    category: "All",
    status: "All",
  });
  const [activeTab, setActiveTab] = useState("overview");
  const [inventoryItems, setInventoryItems] = useState([]);
  const [inventoryBatches, setInventoryBatches] = useState([]);
  const [inventoryTransactions, setInventoryTransactions] = useState([]);
  const [forecastEvents, setForecastEvents] = useState([]);
  const [selectedForecastEventId, setSelectedForecastEventId] = useState("");
  const [selectedForecastModel, setSelectedForecastModel] =
    useState("MOVING_AVERAGE");
  const [forecastRunData, setForecastRunData] = useState(null);
  const [isForecastLoading, setIsForecastLoading] = useState(false);
  const [isRunningForecast, setIsRunningForecast] = useState(false);
  const [forecastErrorMessage, setForecastErrorMessage] = useState("");
  const [forecastSuccessMessage, setForecastSuccessMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalErrorMessage, setModalErrorMessage] = useState("");
  const [isScanModalOpen, setIsScanModalOpen] = useState(false);
  const [createModalItemData, setCreateModalItemData] = useState(null);
  const [scanForm, setScanForm] = useState({
    barcodeNumber: "",
  });
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [selectedExportReportType, setSelectedExportReportType] =
    useState("INVENTORY_ITEMS");
  const [selectedExportFormat, setSelectedExportFormat] = useState("csv");
  const [exportingFormat, setExportingFormat] = useState("");
  const [exportNoticeMessage, setExportNoticeMessage] = useState("");
  const syncQueueEntries =
    useLiveQuery(() => db.syncQueue.toArray(), [], []) || [];

  const loadInventoryData = async (activeFilters = filters) => {
    setIsLoading(true);
    setErrorMessage("");

    try {
      const [itemResponse, batchResponse, transactionResponse] =
        await Promise.all([
          fetchInventoryItems(buildInventoryItemFilters(activeFilters)),
          fetchInventoryBatches(),
          fetchInventoryTransactions(),
        ]);

      setInventoryItems(itemResponse || []);
      setInventoryBatches(batchResponse || []);
      setInventoryTransactions(transactionResponse || []);
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadInventoryData(filters);
  }, [filters]);

  useEffect(() => {
    const unsubscribe = subscribeToSyncUpdates(() => {
      if (typeof navigator !== "undefined" && navigator.onLine) {
        loadInventoryData(filters);
      }
    });

    return () => unsubscribe();
  }, [filters]);

  useEffect(() => {
    let isMounted = true;

    const loadForecastEvents = async () => {
      try {
        const eventRows = await fetchAllDisasterEvents();

        if (!isMounted) {
          return;
        }

        const normalizedEvents = Array.isArray(eventRows) ? eventRows : [];
        setForecastEvents(normalizedEvents);

        if (normalizedEvents.length > 0) {
          const preferredEvent =
            normalizedEvents.find((event) => event.status === "ACTIVE") ||
            normalizedEvents[0];
          setSelectedForecastEventId(preferredEvent.id);
        }
      } catch (error) {
        if (isMounted) {
          setForecastErrorMessage(
            error.message || "Failed to load disaster events for forecasting.",
          );
        }
      }
    };

    loadForecastEvents();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadLatestForecast = async () => {
      if (!selectedForecastEventId) {
        setForecastRunData(null);
        return;
      }

      setIsForecastLoading(true);
      setForecastErrorMessage("");

      try {
        const response = await fetchLatestInventoryForecast(selectedForecastEventId);

        if (isMounted) {
          setForecastRunData(response?.data || null);
        }
      } catch (error) {
        if (isMounted) {
          setForecastRunData(null);
          setForecastErrorMessage(
            error.message || "Failed to load the latest forecast.",
          );
        }
      } finally {
        if (isMounted) {
          setIsForecastLoading(false);
        }
      }
    };

    loadLatestForecast();

    return () => {
      isMounted = false;
    };
  }, [selectedForecastEventId]);

  const inventoryItemsWithSyncStatus = useMemo(
    () => mergeInventoryItemsWithSyncStatus(inventoryItems, syncQueueEntries),
    [inventoryItems, syncQueueEntries],
  );

  const inventoryTrackingMap = useMemo(
    () =>
      buildInventoryTrackingMap(
        inventoryItemsWithSyncStatus,
        inventoryBatches,
        inventoryTransactions,
      ),
    [inventoryItemsWithSyncStatus, inventoryBatches, inventoryTransactions],
  );

  const inventoryAnalytics = useMemo(() => {
    const totalItems = inventoryItemsWithSyncStatus.length;
    const perishableItems = inventoryItemsWithSyncStatus.filter(
      (item) => item.is_perishable,
    ).length;
    const nonPerishableItems = totalItems - perishableItems;
    const availableItems = inventoryItemsWithSyncStatus.filter((item) => {
      const trackingStats =
        inventoryTrackingMap.get(item.id) || createEmptyTrackingStats();

      return trackingStats.onHand > 0;
    }).length;
    const distributedItems = inventoryItemsWithSyncStatus.filter((item) => {
      const trackingStats =
        inventoryTrackingMap.get(item.id) || createEmptyTrackingStats();

      return trackingStats.distributed > 0;
    }).length;
    const expiredItems = inventoryItemsWithSyncStatus.filter((item) => {
      const trackingStats =
        inventoryTrackingMap.get(item.id) || createEmptyTrackingStats();

      return (
        trackingStats.expired > 0 ||
        trackingStats.expiredOnHand > 0 ||
        isDateExpired(getTrackedExpirationDate(item, trackingStats))
      );
    }).length;
    const totalOnHand = inventoryItemsWithSyncStatus.reduce((sum, item) => {
      const trackingStats =
        inventoryTrackingMap.get(item.id) || createEmptyTrackingStats();

      return sum + trackingStats.onHand;
    }, 0);
    const totalDistributed = inventoryItemsWithSyncStatus.reduce((sum, item) => {
      const trackingStats =
        inventoryTrackingMap.get(item.id) || createEmptyTrackingStats();

      return sum + trackingStats.distributed;
    }, 0);
    const totalExpired = inventoryItemsWithSyncStatus.reduce((sum, item) => {
      const trackingStats =
        inventoryTrackingMap.get(item.id) || createEmptyTrackingStats();

      return sum + trackingStats.expired + trackingStats.expiredOnHand;
    }, 0);

    return {
      totalItems,
      availableItems,
      distributedItems,
      expiredItems,
      perishableItems,
      nonPerishableItems,
      totalOnHand,
      totalDistributed,
      totalExpired,
      perishableShare: formatPercentage(perishableItems, totalItems),
      nonPerishableShare: formatPercentage(nonPerishableItems, totalItems),
    };
  }, [inventoryItemsWithSyncStatus, inventoryTrackingMap]);

  const summaryCards = useMemo(
    () => [
      {
        label: "Total Registered Items",
        value: inventoryAnalytics.totalItems,
        description:
          "All inventory item records currently listed for the Mayor's Office.",
        accentColor: "#2f6499",
      },
      {
        label: "Units On Hand",
        value: inventoryAnalytics.totalOnHand,
        description:
          "Remaining stock that is still currently on hand across tracked items.",
        accentColor: "#c9792b",
      },
      {
        label: "Units Distributed",
        value: inventoryAnalytics.totalDistributed,
        description: "Stock already released through recorded distributions.",
        accentColor: "#2d7a4f",
      },
      {
        label: "Units Expired",
        value: inventoryAnalytics.totalExpired,
        description:
          "Stock already marked expired or still sitting in expired batches.",
        accentColor: "#b91c1c",
      },
    ],
    [inventoryAnalytics],
  );

  const visibleInventoryItems = useMemo(() => {
    if (filters.status === "All") {
      return inventoryItemsWithSyncStatus;
    }

    return inventoryItemsWithSyncStatus.filter((item) => {
      const trackingStats =
        inventoryTrackingMap.get(item.id) || createEmptyTrackingStats();

      return getItemStatus(item, trackingStats) === filters.status;
    });
  }, [inventoryItemsWithSyncStatus, inventoryTrackingMap, filters.status]);

  const handleFilterChange = (name, value) => {
    setFilters((previousFilters) => ({
      ...previousFilters,
      [name]: value,
    }));
  };

  const handleOpenCreateModal = () => {
    setModalErrorMessage("");
    setCreateModalItemData(null);
    setIsModalOpen(true);
  };

  const handleSubmitModal = async (payload) => {
    setIsSubmitting(true);
    setModalErrorMessage("");

    try {
      const response = await createInventoryItem(payload);
      if (!response?.queued_offline) {
        await loadInventoryData();
      }
      setIsModalOpen(false);
      setCreateModalItemData(null);
    } catch (error) {
      setModalErrorMessage(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenScanModal = () => {
    setScanForm({
      barcodeNumber: "",
    });
    setIsScanModalOpen(true);
  };

  const handleCloseScanModal = () => {
    setIsScanModalOpen(false);
  };

  const handleScanInputChange = (field, value) => {
    setScanForm((previousForm) => ({
      ...previousForm,
      [field]: value,
    }));
  };

  const handleSubmitScanModal = () => {
    const trimmedBarcode = scanForm.barcodeNumber.trim();

    if (!trimmedBarcode) {
      return;
    }

    setCreateModalItemData({
      barcode: trimmedBarcode,
    });
    setIsScanModalOpen(false);
    setModalErrorMessage("");
    setIsModalOpen(true);
  };

  const handleExport = async (format, extraFilters = {}) => {
    const selectedReportType = extraFilters.report_type || "INVENTORY_ITEMS";
    const hasRowsToExport = hasInventoryExportRows({
      reportType: selectedReportType,
      visibleInventoryItems,
      inventoryBatches,
      inventoryTrackingMap,
    });

    if (!hasRowsToExport) {
      setExportNoticeMessage(NO_EXPORT_DATA_MESSAGE);
      return;
    }

    setExportingFormat(format);
    setIsExportModalOpen(false);

    try {
      const file = await exportInventoryItems({
        format,
        filters: {
          ...buildInventoryItemFilters(filters),
          status: filters.status,
          ...extraFilters,
        },
      });

      const downloadUrl = window.URL.createObjectURL(file.blob);
      const anchor = document.createElement("a");
      anchor.href = downloadUrl;
      anchor.download = file.filename;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      setExportNoticeMessage(
        error.message?.includes("No ")
          ? NO_EXPORT_DATA_MESSAGE
          : error.message || "Unable to export inventory items. Please try again.",
      );
    } finally {
      setExportingFormat("");
    }
  };

  const handleOpenExportModal = () => {
    setSelectedExportReportType("INVENTORY_ITEMS");
    setSelectedExportFormat("csv");
    setExportNoticeMessage("");
    setIsExportModalOpen(true);
  };

  const handleCloseExportModal = () => {
    if (exportingFormat) {
      return;
    }

    setExportNoticeMessage("");
    setIsExportModalOpen(false);
  };

  const handleSubmitExportModal = () => {
    handleExport(
      selectedExportFormat,
      buildInventoryExportFilters(selectedExportReportType),
    );
  };

  const handleRunForecast = async () => {
    if (!selectedForecastEventId) {
      setForecastErrorMessage("Select a disaster event before running a forecast.");
      return;
    }

    setIsRunningForecast(true);
    setForecastErrorMessage("");
    setForecastSuccessMessage("");

    try {
      const response = await runInventoryForecast({
        disaster_event_id: selectedForecastEventId,
        model_name: selectedForecastModel,
      });

      setForecastRunData(response.data || null);
      setForecastSuccessMessage(
        `${getForecastModelLabel(selectedForecastModel)} forecast completed successfully.`,
      );
    } catch (error) {
      setForecastErrorMessage(
        error.message || "Failed to run the selected forecast model.",
      );
    } finally {
      setIsRunningForecast(false);
    }
  };

  return (
    <div
      style={{ flex: 1, minWidth: 0, maxWidth: "100%", overflowX: "hidden" }}
    >
      <PageHeader title="INVENTORY MANAGEMENT" />

      <div style={styles.topActionsRow}>
        <button type="button" style={primaryTopBtn} onClick={handleOpenScanModal}>
          <MdQrCodeScanner size={16} />
          Scan Item
        </button>

        <button type="button" style={primaryTopBtn} onClick={handleOpenCreateModal}>
          <span style={styles.addItemIconWrap}>
            <FiPackage size={16} />
            <span style={styles.addItemPlus}>
              <FiPlus size={10} strokeWidth={3} />
            </span>
          </span>
          Add Item
        </button>

        <button
          type="button"
          onClick={handleOpenExportModal}
          disabled={Boolean(exportingFormat)}
          style={{
            ...secondaryTopBtn,
            opacity: exportingFormat ? 0.7 : 1,
            cursor: exportingFormat ? "not-allowed" : "pointer",
          }}
        >
          <FiFileText size={16} />
          {exportingFormat
            ? `Exporting ${exportingFormat.toUpperCase()}...`
            : "Export"}
        </button>
      </div>

      <InventoryOverviewCards summaryCards={summaryCards} />

      <section style={shellStyles.card}>
        <div style={styles.tabContainer}>
          {["overview", "analytics", "forecasting"].map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              style={tabButtonStyles(activeTab === tab)}
            >
              {tab === "overview"
                ? "Inventory List"
                : tab === "analytics"
                  ? "Tracking Summary"
                  : "Forecasting"}
            </button>
          ))}
        </div>

        <h3 style={styles.sectionTitle}>
          {activeTab === "overview"
            ? "ITEM STOCK TRACKING"
            : activeTab === "analytics"
              ? "TRACKING SUMMARY"
              : "FORECASTING SUMMARY"}
        </h3>

        {activeTab === "overview" ? (
          <>
            <InventoryFilters
              filters={filters}
              onFilterChange={handleFilterChange}
            />

            <InventoryItemsTable
              rows={visibleInventoryItems}
              isLoading={isLoading}
              errorMessage={errorMessage}
              inventoryTrackingMap={inventoryTrackingMap}
            />
          </>
        ) : activeTab === "analytics" ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: "16px",
            }}
          >
            {[
              {
                title: "Items With Stock On Hand",
                value: inventoryAnalytics.availableItems,
                detail: "Registered items that still have remaining available stock.",
              },
              {
                title: "Items Already Distributed",
                value: inventoryAnalytics.distributedItems,
                detail: "Inventory items that already have recorded distribution activity.",
              },
              {
                title: "Items With Expired Stock",
                value: inventoryAnalytics.expiredItems,
                detail: "Inventory items with expired stock records that still need attention.",
              },
              {
                title: "Perishable Goods",
                value: inventoryAnalytics.perishableItems,
                detail: `${inventoryAnalytics.perishableShare} of all registered items are marked as perishable.`,
              },
              {
                title: "Non-Perishable Goods",
                value: inventoryAnalytics.nonPerishableItems,
                detail: `${inventoryAnalytics.nonPerishableShare} of all registered items are marked as non-perishable.`,
              },
            ].map((card) => (
              <div key={card.title} style={analyticsCard}>
                <h4
                  style={{
                    margin: "0 0 8px",
                    color: "#17324d",
                    fontSize: "16px",
                    fontWeight: 700,
                  }}
                >
                  {card.title}
                </h4>
                <p
                  style={{
                    margin: "0 0 12px",
                    color: "#17324d",
                    fontSize: "32px",
                    fontWeight: 800,
                    lineHeight: 1,
                  }}
                >
                  {card.value}
                </p>
                <p
                  style={{
                    margin: 0,
                    color: "#6b8298",
                    fontSize: "14px",
                  }}
                >
                  {card.detail}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <ForecastingPanel
            forecastEvents={forecastEvents}
            selectedForecastEventId={selectedForecastEventId}
            selectedForecastModel={selectedForecastModel}
            forecastModelOptions={forecastModelOptions}
            forecastRunData={forecastRunData}
            forecastSuccessMessage={forecastSuccessMessage}
            forecastErrorMessage={forecastErrorMessage}
            isForecastLoading={isForecastLoading}
            isRunningForecast={isRunningForecast}
            getForecastModelLabel={getForecastModelLabel}
            onForecastEventChange={setSelectedForecastEventId}
            onForecastModelChange={setSelectedForecastModel}
            onRunForecast={handleRunForecast}
          />
        )}
      </section>

      <InventoryItemFormModal
        isOpen={isModalOpen}
        mode="create"
        itemData={createModalItemData}
        isSubmitting={isSubmitting}
        errorMessage={modalErrorMessage}
        onClose={() => {
          setIsModalOpen(false);
          setCreateModalItemData(null);
        }}
        onSubmit={handleSubmitModal}
      />

      <BarcodeScanModal
        isOpen={isScanModalOpen}
        scanForm={scanForm}
        onClose={handleCloseScanModal}
        onSubmit={handleSubmitScanModal}
        onInputChange={handleScanInputChange}
      />

      <InventoryExportModal
        isOpen={isExportModalOpen}
        selectedExportReportType={selectedExportReportType}
        selectedExportFormat={selectedExportFormat}
        exportNoticeMessage={exportNoticeMessage}
        reportOptions={inventoryExportReportOptions}
        formatOptions={inventoryExportFormatOptions}
        onReportTypeChange={setSelectedExportReportType}
        onFormatChange={setSelectedExportFormat}
        onClose={handleCloseExportModal}
        onSubmit={handleSubmitExportModal}
        onCloseNotice={() => setExportNoticeMessage("")}
      />
    </div>
  );
};

export default InventoryItemsPage;
