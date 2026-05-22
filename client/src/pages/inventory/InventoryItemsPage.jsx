import React, { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import PageHeader from "../../components/layout/PageHeader";
import { shellStyles } from "../../components/layout/BarangayLayout";
import InventoryAnalyticsPanel from "../../components/inventory-items/InventoryAnalyticsPanel";
import InventoryItemFormModal from "../../components/inventory-items/InventoryItemFormModal";
import InventoryItemDetailModal from "../../components/inventory-items/InventoryItemDetailModal";
import BarcodeScanModal from "../../components/inventory-items/BarcodeScanModal";
import InventoryPageActions from "../../components/inventory-items/InventoryPageActions";
import InventoryPageTabs from "../../components/inventory-items/InventoryPageTabs";
import InventoryItemsTable from "../../components/inventory-items/InventoryItemsTable";
import InventoryOverviewCards from "../../components/inventory-items/InventoryOverviewCards";
import ForecastingPanel from "../../components/inventory-items/ForecastingPanel";
import InventoryFilters from "../../components/inventory-items/InventoryFilters";
import ExportModal from "../../components/shared/ExportModal";
import FeedbackToast from "../../components/shared/FeedbackToast";
import {
  createInventoryItem,
  fetchInventoryItemDetail,
  fetchForecastHealth,
  fetchForecastHistory,
  fetchForecastRunDetails,
  exportInventoryItems,
  fetchLatestInventoryForecast,
  fetchInventoryItems,
  runInventoryForecast,
} from "../../features/inventory-items/inventoryItemService";
import { fetchInventoryBatches } from "../../features/inventory-batches/inventoryBatchService";
import { fetchInventoryTransactions } from "../../features/inventory-transactions/inventoryTransactionService";
import { fetchAllDisasterEvents } from "../../features/disaster-events/disasterEventService";
import db from "../../offline/db";
import { subscribeToSyncUpdates } from "../../offline/syncService";
import {
  buildInventoryExportFilters,
  forecastModelOptions,
  getForecastModelLabel,
  hasInventoryExportRows,
  inventoryExportReportOptions,
} from "../../features/inventory-items/inventoryItemExportOptions";
import { formatPercentage } from "../../features/inventory-items/inventoryItemFormatting";
import {
  buildInventoryItemFilters,
  getInventoryAnalyticsCards,
  getInventoryPageTabs,
  getInventorySectionTitle,
  inventoryPageStyles,
} from "../../features/inventory-items/inventoryItemsPageUi";
import {
  buildInventoryTrackingMap,
  createEmptyTrackingStats,
  getItemStatus,
  getTrackedExpirationDate,
  isDateExpired,
} from "../../features/inventory-items/inventoryItemStockStatus";
import { mergeInventoryItemsWithSyncStatus } from "../../features/inventory-items/inventoryItemSync";
import {
  buildExportSuccessMessage,
  COMMON_EXPORT_FORMAT_OPTIONS,
  downloadExportFile,
  NO_EXPORT_DATA_MESSAGE,
  resolveExportErrorMessage,
} from "../../utils/exportHelpers";

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
  const [forecastHistory, setForecastHistory] = useState([]);
  const [forecastHistoryDetails, setForecastHistoryDetails] = useState(null);
  const [forecastHealth, setForecastHealth] = useState(null);
  const [isForecastLoading, setIsForecastLoading] = useState(false);
  const [isForecastHistoryLoading, setIsForecastHistoryLoading] = useState(false);
  const [isForecastHistoryDetailLoading, setIsForecastHistoryDetailLoading] =
    useState(false);
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
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [detailErrorMessage, setDetailErrorMessage] = useState("");
  const [selectedItemDetail, setSelectedItemDetail] = useState(null);
  const [scanForm, setScanForm] = useState({
    barcodeNumber: "",
  });
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [selectedExportReportType, setSelectedExportReportType] =
    useState("INVENTORY_ITEMS");
  const [selectedExportFormat, setSelectedExportFormat] = useState("csv");
  const [exportingFormat, setExportingFormat] = useState("");
  const [exportFeedback, setExportFeedback] = useState({
    type: "",
    message: "",
  });
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

    const loadForecastHealth = async () => {
      try {
        const response = await fetchForecastHealth();

        if (isMounted) {
          setForecastHealth(response?.data || null);
        }
      } catch (_error) {
        if (isMounted) {
          setForecastHealth({
            status: "UNAVAILABLE",
            is_available: false,
          });
        }
      }
    };

    loadForecastHealth();

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

  useEffect(() => {
    let isMounted = true;

    const loadForecastHistory = async () => {
      if (!selectedForecastEventId) {
        setForecastHistory([]);
        setForecastHistoryDetails(null);
        return;
      }

      setIsForecastHistoryLoading(true);

      try {
        const response = await fetchForecastHistory({
          disasterEventId: selectedForecastEventId,
          limit: 10,
        });

        if (isMounted) {
          const historyRows = response?.data || [];
          setForecastHistory(historyRows);
          setForecastHistoryDetails(null);
        }
      } catch (_error) {
        if (isMounted) {
          setForecastHistory([]);
          setForecastHistoryDetails(null);
        }
      } finally {
        if (isMounted) {
          setIsForecastHistoryLoading(false);
        }
      }
    };

    loadForecastHistory();

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
  const inventoryPageTabs = useMemo(() => getInventoryPageTabs(), []);
  const inventoryAnalyticsCards = useMemo(
    () => getInventoryAnalyticsCards(inventoryAnalytics),
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

  const handleOpenItemDetail = async (inventoryItemId) => {
    setIsDetailModalOpen(true);
    setIsDetailLoading(true);
    setDetailErrorMessage("");
    setSelectedItemDetail(null);

    try {
      const response = await fetchInventoryItemDetail(inventoryItemId);
      setSelectedItemDetail(response?.data || null);
    } catch (error) {
      setDetailErrorMessage(error.message || "Failed to load inventory item detail.");
    } finally {
      setIsDetailLoading(false);
    }
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
      setExportFeedback({
        type: "error",
        message: NO_EXPORT_DATA_MESSAGE,
      });
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

      downloadExportFile(file);
      setExportFeedback({
        type: "success",
        message: buildExportSuccessMessage("Inventory report"),
      });
    } catch (error) {
      setExportFeedback({
        type: "error",
        message: resolveExportErrorMessage(
          error,
          "Unable to export inventory items. Please try again.",
        ),
      });
    } finally {
      setExportingFormat("");
    }
  };

  const handleOpenExportModal = () => {
    setSelectedExportReportType("INVENTORY_ITEMS");
    setSelectedExportFormat("csv");
    setExportFeedback({ type: "", message: "" });
    setIsExportModalOpen(true);
  };

  const handleCloseExportModal = () => {
    if (exportingFormat) {
      return;
    }

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
      setForecastHistoryDetails(response.data || null);
      setForecastSuccessMessage(
        `${getForecastModelLabel(selectedForecastModel)} forecast completed successfully.`,
      );
      const historyResponse = await fetchForecastHistory({
        disasterEventId: selectedForecastEventId,
        limit: 10,
      });
      setForecastHistory(historyResponse?.data || []);
    } catch (error) {
      setForecastErrorMessage(
        error.message || "Failed to run the selected forecast model.",
      );
    } finally {
      setIsRunningForecast(false);
    }
  };

  const handleSelectForecastHistoryRun = async (runId) => {
    setIsForecastHistoryDetailLoading(true);

    try {
      const response = await fetchForecastRunDetails(runId);
      setForecastHistoryDetails(response?.data || null);
    } catch (error) {
      setForecastErrorMessage(
        error.message || "Failed to load forecast run details.",
      );
    } finally {
      setIsForecastHistoryDetailLoading(false);
    }
  };

  return (
    <div
      style={{ flex: 1, minWidth: 0, maxWidth: "100%", overflowX: "hidden" }}
    >
      <PageHeader title="INVENTORY MANAGEMENT" />

      <InventoryPageActions
        exportingFormat={exportingFormat}
        onOpenScanModal={handleOpenScanModal}
        onOpenCreateModal={handleOpenCreateModal}
        onOpenExportModal={handleOpenExportModal}
      />

      <InventoryOverviewCards summaryCards={summaryCards} />

      <section style={shellStyles.card}>
        <InventoryPageTabs
          tabs={inventoryPageTabs}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />

        <h3 style={inventoryPageStyles.sectionTitle}>
          {getInventorySectionTitle(activeTab)}
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
              onViewDetails={handleOpenItemDetail}
            />
          </>
        ) : activeTab === "analytics" ? (
          <InventoryAnalyticsPanel cards={inventoryAnalyticsCards} />
        ) : (
          <ForecastingPanel
            forecastEvents={forecastEvents}
            selectedForecastEventId={selectedForecastEventId}
            selectedForecastModel={selectedForecastModel}
            forecastModelOptions={forecastModelOptions}
            forecastRunData={forecastRunData}
            forecastHistory={forecastHistory}
            forecastHistoryDetails={forecastHistoryDetails}
            forecastHealth={forecastHealth}
            forecastSuccessMessage={forecastSuccessMessage}
            forecastErrorMessage={forecastErrorMessage}
            isForecastLoading={isForecastLoading}
            isForecastHistoryLoading={isForecastHistoryLoading}
            isForecastHistoryDetailLoading={isForecastHistoryDetailLoading}
            isRunningForecast={isRunningForecast}
            getForecastModelLabel={getForecastModelLabel}
            onForecastEventChange={setSelectedForecastEventId}
            onForecastModelChange={setSelectedForecastModel}
            onRunForecast={handleRunForecast}
            onSelectForecastHistoryRun={handleSelectForecastHistoryRun}
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

      <ExportModal
        isOpen={isExportModalOpen}
        title="Export Inventory Report"
        description="Choose which inventory report to export and the file format to generate."
        reportOptions={inventoryExportReportOptions}
        formatOptions={COMMON_EXPORT_FORMAT_OPTIONS}
        selectedReportType={selectedExportReportType}
        selectedFormat={selectedExportFormat}
        isSubmitting={Boolean(exportingFormat)}
        onReportTypeChange={setSelectedExportReportType}
        onFormatChange={setSelectedExportFormat}
        onClose={handleCloseExportModal}
        onSubmit={handleSubmitExportModal}
      />

      <FeedbackToast
        type={exportFeedback.type}
        message={exportFeedback.message}
        onClose={() => setExportFeedback({ type: "", message: "" })}
      />

      <InventoryItemDetailModal
        isOpen={isDetailModalOpen}
        isLoading={isDetailLoading}
        errorMessage={detailErrorMessage}
        detail={selectedItemDetail}
        onClose={() => {
          setIsDetailModalOpen(false);
          setSelectedItemDetail(null);
          setDetailErrorMessage("");
        }}
      />
    </div>
  );
};

export default InventoryItemsPage;
