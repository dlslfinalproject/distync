import React, { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import PageHeader from "../../components/layout/PageHeader";
import { shellStyles } from "../../components/layout/BarangayLayout";
import InventoryItemFormModal from "../../components/inventory-items/InventoryItemFormModal";
import InventoryItemDetailModal from "../../components/inventory-items/InventoryItemDetailModal";
import BarcodeScanModal from "../../components/inventory-items/BarcodeScanModal";
import InventoryPageActions from "../../components/inventory-items/InventoryPageActions";
import InventoryItemsTable from "../../components/inventory-items/InventoryItemsTable";
import InventoryOverviewCards from "../../components/inventory-items/InventoryOverviewCards";
import InventoryFilters from "../../components/inventory-items/InventoryFilters";
import ExportModal from "../../components/shared/ExportModal";
import FeedbackToast from "../../components/shared/FeedbackToast";
import {
  createInventoryItem,
  fetchInventoryItemById,
  fetchInventoryItemDetail,
  exportInventoryItems,
  fetchInventoryItems,
  lookupInventoryItemByBarcode,
  updateInventoryItem,
} from "../../features/inventory-items/inventoryItemService";
import { fetchInventoryBatches } from "../../features/inventory-batches/inventoryBatchService";
import { fetchInventoryTransactions } from "../../features/inventory-transactions/inventoryTransactionService";
import db from "../../offline/db";
import { subscribeToSyncUpdates } from "../../offline/syncService";
import {
  buildInventoryExportFilters,
  hasInventoryExportRows,
  inventoryExportReportOptions,
} from "../../features/inventory-items/inventoryItemExportOptions";
import {
  formatPercentage,
  getTotalItemQuantityValue,
} from "../../features/inventory-items/inventoryItemFormatting";
import {
  buildInventoryItemFilters,
  getInventorySectionTitle,
  inventoryPageStyles,
} from "../../features/inventory-items/inventoryItemsPageUi";
import {
  buildInventoryTrackingMap,
  createEmptyTrackingStats,
  getItemStatus,
  getTrackedExpirationDate,
  isItemExpiring,
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

const isLowStockItem = (item, trackingStats) => {
  const reorderLevel = Number(item.reorder_level || 0);
  const onHand = getMonitorQuantity(item, trackingStats);

  return reorderLevel > 0 && onHand > 0 && onHand <= reorderLevel;
};

const getMonitorQuantity = (item, trackingStats) => {
  const trackedOnHand = Number(trackingStats?.onHand || 0);
  const trackedReceived = Number(trackingStats?.totalReceived || 0);
  const itemTotalQuantity = getTotalItemQuantityValue(item);

  if (trackedReceived > 0 || trackedOnHand > 0) {
    return trackedOnHand;
  }

  return itemTotalQuantity;
};

const getInventorySourceLabel = (itemId, inventoryBatches) => {
  const relatedBatches = inventoryBatches.filter(
    (batch) => String(batch.inventory_item_id) === String(itemId),
  );

  if (relatedBatches.length === 0) {
    return "--";
  }

  const sourceTypes = new Set(
    relatedBatches
      .map((batch) => String(batch.source_type || "").toUpperCase())
      .filter(Boolean),
  );

  if (sourceTypes.size === 0) {
    return "--";
  }

  if (sourceTypes.size > 1) {
    return "Mixed";
  }

  return sourceTypes.has("DONATED") ? "Donor" : "Malvar LGU";
};

const InventoryItemsPage = () => {
  const [filters, setFilters] = useState({
    search: "",
    category: "All",
    status: "All",
  });
  const [inventoryItems, setInventoryItems] = useState([]);
  const [inventoryBatches, setInventoryBatches] = useState([]);
  const [inventoryTransactions, setInventoryTransactions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("create");
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

      return sum + getMonitorQuantity(item, trackingStats);
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
    const lowStockItems = inventoryItemsWithSyncStatus.filter((item) => {
      const trackingStats =
        inventoryTrackingMap.get(item.id) || createEmptyTrackingStats();

      return isLowStockItem(item, trackingStats);
    }).length;
    const expiringSoonItems = inventoryItemsWithSyncStatus.filter((item) => {
      const trackingStats =
        inventoryTrackingMap.get(item.id) || createEmptyTrackingStats();

      return trackingStats.hasExpiringStock || isItemExpiring(item);
    }).length;
    const outOfStockItems = inventoryItemsWithSyncStatus.filter((item) => {
      const trackingStats =
        inventoryTrackingMap.get(item.id) || createEmptyTrackingStats();

      return getMonitorQuantity(item, trackingStats) <= 0;
    }).length;

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
      lowStockItems,
      expiringSoonItems,
      outOfStockItems,
      perishableShare: formatPercentage(perishableItems, totalItems),
      nonPerishableShare: formatPercentage(nonPerishableItems, totalItems),
    };
  }, [inventoryItemsWithSyncStatus, inventoryTrackingMap]);

  const summaryCards = useMemo(
    () => [
      {
        label: "Total Items",
        value: inventoryAnalytics.totalItems,
        accentColor: "#2f6499",
      },
      {
        label: "Low Stock Items",
        value: inventoryAnalytics.lowStockItems,
        accentColor: "#c9792b",
      },
      {
        label: "Expiring Soon",
        value: inventoryAnalytics.expiringSoonItems,
        accentColor: "#2d7a4f",
      },
      {
        label: "Out of Stock",
        value: inventoryAnalytics.outOfStockItems,
        accentColor: "#b91c1c",
      },
    ],
    [inventoryAnalytics],
  );
  const matchedScannedItem = useMemo(() => {
    const scannedBarcode = scanForm.barcodeNumber.trim().toLowerCase();

    if (!scannedBarcode) {
      return null;
    }

    return (
      inventoryItemsWithSyncStatus.find((item) => {
        return (item.barcode || "").trim().toLowerCase() === scannedBarcode;
      }) || null
    );
  }, [inventoryItemsWithSyncStatus, scanForm.barcodeNumber]);

  const visibleInventoryItems = useMemo(() => {
    const filteredItems =
      filters.status === "All"
        ? inventoryItemsWithSyncStatus
        : inventoryItemsWithSyncStatus.filter((item) => {
      const trackingStats =
        inventoryTrackingMap.get(item.id) || createEmptyTrackingStats();

          if (filters.status === "Low Stock") {
            return isLowStockItem(item, trackingStats);
          }

          if (filters.status === "Expiring") {
            return trackingStats.hasExpiringStock || isItemExpiring(item);
          }

          if (filters.status === "Out of Stock") {
            return getMonitorQuantity(item, trackingStats) <= 0;
          }

          return getItemStatus(item, trackingStats) === filters.status;
        });

    return filteredItems.map((item) => ({
      ...item,
      source_label: getInventorySourceLabel(item.id, inventoryBatches),
    }));
  }, [
    inventoryItemsWithSyncStatus,
    inventoryTrackingMap,
    inventoryBatches,
    filters.status,
  ]);

  const handleFilterChange = (name, value) => {
    setFilters((previousFilters) => ({
      ...previousFilters,
      [name]: value,
    }));
  };

  const handleOpenCreateModal = () => {
    setModalErrorMessage("");
    setModalMode("create");
    setCreateModalItemData(null);
    setIsModalOpen(true);
  };

  const handleSubmitModal = async (payload) => {
    setIsSubmitting(true);
    setModalErrorMessage("");

    try {
      const response =
        modalMode === "edit" && createModalItemData?.id
          ? await updateInventoryItem(createModalItemData.id, payload)
          : await createInventoryItem(payload);
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

  const handleOpenEditModal = async (itemRow) => {
    if (!itemRow?.id) {
      return;
    }

    setModalErrorMessage("");
    setModalMode("edit");
    setIsSubmitting(true);

    try {
      const itemDetails = await fetchInventoryItemById(itemRow.id);
      setCreateModalItemData(itemDetails || itemRow);
      setIsModalOpen(true);
    } catch (_error) {
      setCreateModalItemData(itemRow);
      setIsModalOpen(true);
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

    if (matchedScannedItem?.id) {
      setIsScanModalOpen(false);
      void handleOpenItemDetail(matchedScannedItem.id);
      return;
    }

    setIsScanModalOpen(false);
    setModalErrorMessage("");
    setModalMode("create");

    void (async () => {
      try {
        const lookupResponse = await lookupInventoryItemByBarcode(trimmedBarcode);
        const suggestedItem = lookupResponse?.data?.item || null;

        setCreateModalItemData({
          barcode: trimmedBarcode,
          item_name: suggestedItem?.item_name || "",
          category:
            String(suggestedItem?.category || "").toLowerCase() === "perishable"
              ? "perishable"
              : "non-perishable",
        });
      } catch (_error) {
        setCreateModalItemData({
          barcode: trimmedBarcode,
        });
      } finally {
        setIsModalOpen(true);
      }
    })();
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
          status: filters.status === "Expiring" ? "Expiring" : "All",
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

  return (
    <div
      style={{ flex: 1, minWidth: 0, maxWidth: "100%", overflowX: "hidden" }}
    >
      <PageHeader
        title="INVENTORY MANAGEMENT"
      />

      <InventoryPageActions
        exportingFormat={exportingFormat}
        onOpenScanModal={handleOpenScanModal}
        onOpenCreateModal={handleOpenCreateModal}
        onOpenExportModal={handleOpenExportModal}
      />

      <InventoryOverviewCards summaryCards={summaryCards} />

      <section style={shellStyles.card}>
        <h3 style={inventoryPageStyles.sectionTitle}>
          {getInventorySectionTitle()}
        </h3>

        <InventoryFilters
          filters={filters}
          onFilterChange={handleFilterChange}
        />

        <InventoryItemsTable
          rows={visibleInventoryItems}
          isLoading={isLoading}
          errorMessage={errorMessage}
          onEditItem={handleOpenEditModal}
          onViewDetails={handleOpenItemDetail}
        />
      </section>

      <InventoryItemFormModal
        isOpen={isModalOpen}
        mode={modalMode}
        itemData={createModalItemData}
        isSubmitting={isSubmitting}
        errorMessage={modalErrorMessage}
        onClose={() => {
          setIsModalOpen(false);
          setModalMode("create");
          setCreateModalItemData(null);
        }}
        onSubmit={handleSubmitModal}
      />

      <BarcodeScanModal
        isOpen={isScanModalOpen}
        scanForm={scanForm}
        matchedItemName={matchedScannedItem?.item_name || ""}
        onClose={handleCloseScanModal}
        onSubmit={handleSubmitScanModal}
        onInputChange={handleScanInputChange}
      />

      <ExportModal
        isOpen={isExportModalOpen}
        title="Export Inventory Report"
        description="Select a report and file format."
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
