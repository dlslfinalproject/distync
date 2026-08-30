import React, { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import PageHeader from "../../components/layout/PageHeader";
import { shellStyles } from "../../components/layout/BarangayLayout";
import OfflineDataReadiness from "../../components/layout/OfflineDataReadiness";
import SyncStatusBanner from "../../components/layout/SyncStatusBanner";
import InventoryItemFormModal from "../../components/inventory-items/InventoryItemFormModal";
import InventoryItemDetailModal from "../../components/inventory-items/InventoryItemDetailModal";
import InventoryItemStatusLogModal from "../../components/inventory-items/InventoryItemStatusLogModal";
import InventoryBatchExpiryModal from "../../components/inventory-items/InventoryBatchExpiryModal";
import InventoryExportModal from "../../components/inventory-items/InventoryExportModal";
import BarcodeScanModal from "../../components/inventory-items/BarcodeScanModal";
import InventoryPageActions from "../../components/inventory-items/InventoryPageActions";
import InventoryItemsTable from "../../components/inventory-items/InventoryItemsTable";
import InventoryOverviewCards from "../../components/inventory-items/InventoryOverviewCards";
import InventoryFilters from "../../components/inventory-items/InventoryFilters";
import FeedbackToast from "../../components/shared/FeedbackToast";
import {
  createInventoryItem,
  fetchInventoryItemById,
  fetchInventoryItemDetail,
  exportInventoryItems,
  fetchInventoryItems,
  updateInventoryItem,
} from "../../features/inventory-items/inventoryItemService";
import {
  createInventoryBatch,
  fetchInventoryBatches,
  fetchSuppliers,
  updateInventoryBatchExpiry,
} from "../../features/inventory-batches/inventoryBatchService";
import {
  createInventoryTransaction,
  fetchInventoryTransactions,
} from "../../features/inventory-transactions/inventoryTransactionService";
import db from "../../offline/db.js";
import { subscribeToSyncUpdates } from "../../offline/syncService";
import { getVisibleSyncQueueEntries } from "../../offline/syncQueue";
import {
  getTotalItemQuantityValue,
} from "../../features/inventory-items/inventoryItemFormatting";
import { normalizeInventoryBarcode } from "../../features/inventory-items/inventoryBarcode";
import { useAuth } from "../../context/AuthContext";
import { ROLE_CODES } from "../../utils/roleSession";
import { useMayorInventoryOfflinePreparation } from "../../features/offline/useMayorInventoryOfflinePreparation";
import {
  canUseMayorInventoryCacheAfterError,
  getMayorInventoryCacheSnapshot,
  persistMayorInventoryCacheSnapshot,
} from "../../offline/mayorInventoryCache";
import {
  buildNextInventoryBatchNumber as buildScannedInventoryBatchNumber,
  buildReservedBatchRows,
  buildMayorInventoryItemDetailFromLocalGraph,
  findMayorInventoryItemByBarcode,
  mergeInventoryBatchesWithSyncStatus,
} from "../../offline/mayorInventoryOfflineModel";
import {
  buildInventoryItemFilters,
  getInventorySectionTitle,
  inventoryPageStyles,
} from "../../features/inventory-items/inventoryItemsPageUi";
import {
  matchesInventoryItemCategory,
  matchesInventoryItemSearch,
} from "../../features/inventory-items/inventoryItemFilters";
import {
  buildInventoryTrackingMap,
  createEmptyTrackingStats,
  getTrackedExpirationDate,
} from "../../features/inventory-items/inventoryItemStockStatus";
import { mergeInventoryItemsWithSyncStatus } from "../../features/inventory-items/inventoryItemSync";
import {
  buildExportSuccessMessage,
  downloadExportFile,
  resolveExportErrorMessage,
} from "../../utils/exportHelpers";

const isLowStockItem = (item, trackingStats) => {
  const reorderLevel = Number(item.reorder_level || 0);
  const onHand = getMonitorQuantity(item, trackingStats);

  return reorderLevel > 0 && onHand > 0 && onHand <= reorderLevel;
};

const normalizeCalendarDate = (value) => {
  if (!value) {
    return null;
  }

  const normalizedValue =
    typeof value === "string" ? value.slice(0, 10) : value;
  const parsedDate = new Date(`${normalizedValue}T00:00:00`);

  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return parsedDate;
};

const getTodayDate = () => {
  const today = new Date();
  return new Date(today.getFullYear(), today.getMonth(), today.getDate());
};

const isExpiredItem = (item, trackingStats) => {
  const trackedExpirationDate = getTrackedExpirationDate(item, trackingStats);
  const normalizedExpirationDate = normalizeCalendarDate(trackedExpirationDate);
  const onHand = getMonitorQuantity(item, trackingStats);

  if (Number(trackingStats?.expiredOnHand || 0) > 0) {
    return true;
  }

  if (!normalizedExpirationDate || onHand <= 0) {
    return false;
  }

  return normalizedExpirationDate.getTime() <= getTodayDate().getTime();
};

const isNearExpiryItem = (item, trackingStats) => {
  const trackedExpirationDate = getTrackedExpirationDate(item, trackingStats);
  const normalizedExpirationDate = normalizeCalendarDate(trackedExpirationDate);
  const onHand = getMonitorQuantity(item, trackingStats);

  if (!normalizedExpirationDate || onHand <= 0 || isExpiredItem(item, trackingStats)) {
    return false;
  }

  const millisecondsUntilExpiration =
    normalizedExpirationDate.getTime() - getTodayDate().getTime();
  const daysUntilExpiration = millisecondsUntilExpiration / (1000 * 60 * 60 * 24);

  return daysUntilExpiration > 0 && daysUntilExpiration <= 30;
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

const INITIAL_SCAN_FORM = {
  barcodeNumber: "",
  quantityOnHand: "",
  reorderLevel: "",
  expirationDate: "",
};

const INVENTORY_SORT_OPTIONS = {
  NEWEST: "newest",
  OLDEST: "oldest",
  AZ: "az",
  ZA: "za",
};

const INVENTORY_BATCH_SOURCE_TYPES = [
  "PURCHASED",
  "DONATED",
  "DSWD",
  "LGU",
  "OTHER",
];

const DONATION_PENDING_REORDER_LABEL = "Not Yet Required";

const getPositiveIntegerValue = (value) => {
  const parsedValue = Number(value);

  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    return null;
  }

  return parsedValue;
};

const getNormalizedInventoryText = (value) =>
  String(value || "").trim().toLowerCase();

const getFirstPositiveNumber = (values) => {
  for (const value of values) {
    const parsedValue = Number(value);

    if (Number.isFinite(parsedValue) && parsedValue > 0) {
      return parsedValue;
    }
  }

  return null;
};

const getUnitsPerPackageValue = (item) => {
  if (getNormalizedInventoryText(item?.packaging) === "piece") {
    return 1;
  }

  const isMeasurementBased = getNormalizedInventoryText(
    item?.tracking_method,
  ).includes("measurement");
  const candidateValues = isMeasurementBased
    ? [
        item?.unit_of_measure_value,
        item?.units_per_package,
        item?.quantity_per_package,
        item?.units_per_packaging,
        item?.quantity_per_packaging,
        item?.quantity,
      ]
    : [
        item?.units_per_package,
        item?.quantity_per_package,
        item?.units_per_packaging,
        item?.quantity_per_packaging,
        item?.quantity,
        item?.unit_of_measure_value,
      ];

  return getFirstPositiveNumber(candidateValues) || 1;
};

const getItemStockForms = (item) =>
  Array.isArray(item?.stock_forms) ? item.stock_forms : [];

const getSortableTimestamp = (value) => {
  if (!value) {
    return Number.NEGATIVE_INFINITY;
  }

  const parsedValue = new Date(value).getTime();
  return Number.isNaN(parsedValue) ? Number.NEGATIVE_INFINITY : parsedValue;
};

const isPerishableItem = (item) =>
  String(item?.category || "").trim().toUpperCase() === "PERISHABLE" ||
  Boolean(item?.is_perishable);

const getInventoryBatchSourceType = (item) => {
  const sourceLabel = String(item?.source_type || item?.source || "")
    .trim()
    .toUpperCase();

  if (sourceLabel.includes("DONOR")) {
    return "DONATED";
  }

  if (sourceLabel.includes("LGU") || sourceLabel.includes("MALVAR")) {
    return "LGU";
  }

  const normalizedSourceType = sourceLabel.replace(/[^A-Z]/g, "_");

  return INVENTORY_BATCH_SOURCE_TYPES.includes(normalizedSourceType)
    ? normalizedSourceType
    : "LGU";
};

const isDonationOnlyOriginItem = (item, relatedBatches = []) => {
  if (!item || relatedBatches.length === 0) {
    return false;
  }

  return relatedBatches.every((batch) => {
    return getInventoryBatchSourceType(batch) === "DONATED";
  });
};

const requiresReorderLevelBeforeLguHandling = (item, relatedBatches = []) => {
  return (
    (item?.reorder_level === null || item?.reorder_level === undefined) &&
    isDonationOnlyOriginItem(item, relatedBatches)
  );
};

const getReorderLevelDisplayValue = (item, relatedBatches = []) => {
  if (item?.reorder_level !== null && item?.reorder_level !== undefined) {
    return item.reorder_level;
  }

  return requiresReorderLevelBeforeLguHandling(item, relatedBatches)
    ? DONATION_PENDING_REORDER_LABEL
    : "--";
};

const getDisplayStockStatus = (item, trackingStats) => {
  const onHand = getMonitorQuantity(item, trackingStats);

  if (onHand <= 0) {
    return "Depleted";
  }

  if (isExpiredItem(item, trackingStats)) {
    return "Expired";
  }

  if (isNearExpiryItem(item, trackingStats)) {
    return "Near Expiry";
  }

  if (isLowStockItem(item, trackingStats)) {
    return "Low Stock";
  }

  return "Available";
};

const getDisplayStockStatuses = (item, trackingStats) => {
  const statuses = [];
  const onHand = getMonitorQuantity(item, trackingStats);
  const unitLabel = item?.unit_of_measure || "pc";

  if (onHand <= 0) {
    return [{ key: "Depleted", label: "Depleted" }];
  }

  if (isExpiredItem(item, trackingStats)) {
    statuses.push({
      key: "Expired",
      label:
        Number(trackingStats?.expiredOnHand || 0) > 0
          ? `Expired: ${formatNumericValue(
              Number(trackingStats.expiredOnHand || 0),
            )} ${unitLabel}`
          : "Expired",
    });
  } else if (isNearExpiryItem(item, trackingStats)) {
    statuses.push({
      key: "Near Expiry",
      label:
        Number(trackingStats?.nearExpiryOnHand || 0) > 0
          ? `Near Expiry: ${formatNumericValue(
              Number(trackingStats.nearExpiryOnHand || 0),
            )} ${unitLabel}`
          : "Near Expiry",
    });
  }

  if (isLowStockItem(item, trackingStats)) {
    statuses.push({ key: "Low Stock", label: "Low Stock" });
  }

  if (statuses.length === 0) {
    statuses.push({ key: "Available", label: "Available" });
  }

  return statuses;
};

const getStockFormLabels = (item) => {
  const stockForms = Array.isArray(item?.stock_forms) ? item.stock_forms : [];
  const uniqueLabels = [];

  stockForms.forEach((stockForm) => {
    const packaging = String(stockForm?.packaging || "").trim();
    if (!packaging) {
      return;
    }

    const formattedPackaging =
      packaging.charAt(0).toUpperCase() + packaging.slice(1).toLowerCase();

    if (!uniqueLabels.includes(formattedPackaging)) {
      uniqueLabels.push(formattedPackaging);
    }
  });

  return uniqueLabels;
};

const InventoryItemsPage = () => {
  const { authenticatedUser, currentRole } = useAuth();
  const isMayorPortal = currentRole === ROLE_CODES.MAYOR;
  const [filters, setFilters] = useState({
    search: "",
    category: "All",
    status: [],
    sortOrder: INVENTORY_SORT_OPTIONS.NEWEST,
  });
  const [inventoryItems, setInventoryItems] = useState([]);
  const [inventoryBatches, setInventoryBatches] = useState([]);
  const [inventoryTransactions, setInventoryTransactions] = useState([]);
  const [inventorySuppliers, setInventorySuppliers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [inventoryActionNotice, setInventoryActionNotice] = useState("");
  const [reservedBatchNumbers, setReservedBatchNumbers] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("create");
  const [createModalSource, setCreateModalSource] = useState("manual");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalErrorMessage, setModalErrorMessage] = useState("");
  const [isScanModalOpen, setIsScanModalOpen] = useState(false);
  const [createModalItemData, setCreateModalItemData] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [detailErrorMessage, setDetailErrorMessage] = useState("");
  const [selectedItemDetail, setSelectedItemDetail] = useState(null);
  const [isBatchExpiryModalOpen, setIsBatchExpiryModalOpen] = useState(false);
  const [selectedBatchForExpiryEdit, setSelectedBatchForExpiryEdit] = useState(null);
  const [batchExpiryErrorMessage, setBatchExpiryErrorMessage] = useState("");
  const [isSubmittingBatchExpiry, setIsSubmittingBatchExpiry] = useState(false);
  const [isStatusLogModalOpen, setIsStatusLogModalOpen] = useState(false);
  const [statusLogItem, setStatusLogItem] = useState(null);
  const [statusLogErrorMessage, setStatusLogErrorMessage] = useState("");
  const [scanForm, setScanForm] = useState(INITIAL_SCAN_FORM);
  const [scanErrorMessage, setScanErrorMessage] = useState("");
  const [isSubmittingScanRestock, setIsSubmittingScanRestock] =
    useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [selectedExportFormat, setSelectedExportFormat] = useState("csv");
  const [selectedExportCategory, setSelectedExportCategory] = useState("All");
  const [selectedExportStatus, setSelectedExportStatus] = useState("All");
  const [exportingFormat, setExportingFormat] = useState("");
  const [exportFeedback, setExportFeedback] = useState({
    type: "",
    message: "",
  });
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine !== false,
  );
  const syncQueueEntries =
    useLiveQuery(() => getVisibleSyncQueueEntries(), [], []) || [];
  const mayorOfflinePreparation = useMayorInventoryOfflinePreparation({
    enabled: isMayorPortal,
    userId: authenticatedUser?.id || "",
    roleCode: currentRole,
  });

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const applyCachedInventoryData = (cacheRow) => {
    if (!cacheRow) {
      return false;
    }

    setInventoryItems(cacheRow.items || []);
    setInventoryBatches(cacheRow.batches || []);
    setInventoryTransactions(cacheRow.transactions || []);
    setInventorySuppliers(cacheRow.suppliers || []);
    return true;
  };

  const restoreMayorInventoryCache = async () => {
    if (!isMayorPortal) {
      return false;
    }

    const cacheRow = await getMayorInventoryCacheSnapshot();
    if (!cacheRow) {
      return false;
    }

    applyCachedInventoryData(cacheRow);
    return true;
  };

  const loadInventoryData = async (options = {}) => {
    const { showLoading = true, clearError = true } = options;

    if (showLoading) {
      setIsLoading(true);
    }

    if (clearError) {
      setErrorMessage("");
    }

    if (
      typeof navigator !== "undefined" &&
      navigator.onLine === false &&
      isMayorPortal
    ) {
      const restored = await restoreMayorInventoryCache();

      if (!restored) {
        setErrorMessage(
          "Inventory data is not prepared on this device yet. Connect to DISTYNC before using offline stock-in.",
        );
      }

      setIsLoading(false);
      return;
    }

    try {
      const [itemResponse, batchResponse, transactionResponse, supplierResponse] =
        await Promise.all([
          fetchInventoryItems({ search: "" }),
          fetchInventoryBatches(),
          fetchInventoryTransactions(),
          fetchSuppliers(),
        ]);

      const liveInventoryDatasets = {
        items: itemResponse,
        batches: batchResponse,
        transactions: transactionResponse,
        suppliers: supplierResponse,
      };

      if (
        isMayorPortal &&
        Object.values(liveInventoryDatasets).some(
          (dataset) => !Array.isArray(dataset),
        )
      ) {
        const error = new Error(
          "DISTYNC returned incomplete inventory information. The offline copy was not refreshed.",
        );
        error.code = "MAYOR_INVENTORY_LIVE_DATA_INCOMPLETE";
        throw error;
      }

      setInventoryItems(itemResponse || []);
      setInventoryBatches(batchResponse || []);
      setInventoryTransactions(transactionResponse || []);
      setInventorySuppliers(supplierResponse || []);

      if (isMayorPortal) {
        try {
          await persistMayorInventoryCacheSnapshot({
            ...liveInventoryDatasets,
          });
        } catch (_cacheError) {
          // The live response remains usable. Offline-cache readiness owns
          // the user-facing preparation state for this page.
        }
      }
    } catch (error) {
      const restored =
        isMayorPortal && canUseMayorInventoryCacheAfterError(error)
          ? await restoreMayorInventoryCache()
          : false;

      if (!restored && clearError) {
        setErrorMessage(error.message || "Failed to load inventory data.");
      }
    } finally {
      if (showLoading) {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    void loadInventoryData();
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToSyncUpdates(() => {
      if (typeof navigator !== "undefined" && navigator.onLine) {
        loadInventoryData();
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const refreshInventoryMonitor = () => {
      void loadInventoryData({
        showLoading: false,
        clearError: false,
      });
    };

    const handleVisibilityRefresh = () => {
      if (document.visibilityState === "visible") {
        refreshInventoryMonitor();
      }
    };

    const refreshInterval = window.setInterval(refreshInventoryMonitor, 30000);

    window.addEventListener("focus", refreshInventoryMonitor);
    document.addEventListener("visibilitychange", handleVisibilityRefresh);

    return () => {
      window.clearInterval(refreshInterval);
      window.removeEventListener("focus", refreshInventoryMonitor);
      document.removeEventListener("visibilitychange", handleVisibilityRefresh);
    };
  }, []);

  const inventoryItemsWithSyncStatus = useMemo(
    () => mergeInventoryItemsWithSyncStatus(inventoryItems, syncQueueEntries),
    [inventoryItems, syncQueueEntries],
  );

  const inventoryBatchesWithSyncStatus = useMemo(
    () =>
      mergeInventoryBatchesWithSyncStatus({
        inventoryBatches,
        inventoryItems: inventoryItemsWithSyncStatus,
        suppliers: inventorySuppliers,
        syncQueueEntries,
      }),
    [
      inventoryBatches,
      inventoryItemsWithSyncStatus,
      inventorySuppliers,
      syncQueueEntries,
    ],
  );

  const inventoryBatchesForInventoryManagement = useMemo(
    () => {
      const projectedRows = [...inventoryBatchesWithSyncStatus];
      const projectedIdentities = new Set(
        projectedRows.map(
          (batch) =>
            `${String(batch?.inventory_item_id || "")}|${String(
              batch?.batch_no || "",
            ).toUpperCase()}`,
        ),
      );

      return [
        ...projectedRows,
        ...buildReservedBatchRows(
          reservedBatchNumbers,
          inventoryItemsWithSyncStatus,
        ).filter(
          (batch) =>
            !projectedIdentities.has(
              `${String(batch?.inventory_item_id || "")}|${String(
                batch?.batch_no || "",
              ).toUpperCase()}`,
            ),
        ),
      ];
    },
    [
      inventoryBatchesWithSyncStatus,
      inventoryItemsWithSyncStatus,
      reservedBatchNumbers,
    ],
  );

  const inventoryTrackingMap = useMemo(
    () =>
      buildInventoryTrackingMap(
        inventoryItemsWithSyncStatus,
        inventoryBatchesForInventoryManagement,
        inventoryTransactions,
      ),
    [
      inventoryItemsWithSyncStatus,
      inventoryBatchesForInventoryManagement,
      inventoryTransactions,
    ],
  );

  const inventoryItemsForInventoryManagement = useMemo(() => {
    return inventoryItemsWithSyncStatus.map((item) => {
      const relatedBatches = inventoryBatchesForInventoryManagement.filter((batch) => {
        return String(batch?.inventory_item_id || "") === String(item?.id || "");
      });

      return {
        ...item,
        reorder_level_display: getReorderLevelDisplayValue(item, relatedBatches),
        requires_reorder_level_before_restock:
          requiresReorderLevelBeforeLguHandling(item, relatedBatches),
      };
    });
  }, [inventoryBatchesForInventoryManagement, inventoryItemsWithSyncStatus]);

  const inventoryAnalytics = useMemo(() => {
    const totalItems = inventoryItemsWithSyncStatus.length;
    const lowStockItems = inventoryItemsWithSyncStatus.filter((item) => {
      const trackingStats =
        inventoryTrackingMap.get(item.id) || createEmptyTrackingStats();

      return getDisplayStockStatuses(item, trackingStats).some(
        (status) => status.key === "Low Stock",
      );
    }).length;
    const expiringSoonItems = inventoryItemsWithSyncStatus.filter((item) => {
      const trackingStats =
        inventoryTrackingMap.get(item.id) || createEmptyTrackingStats();

      return getDisplayStockStatuses(item, trackingStats).some(
        (status) => status.key === "Near Expiry",
      );
    }).length;
    const expiredItems = inventoryItemsWithSyncStatus.filter((item) => {
      const trackingStats =
        inventoryTrackingMap.get(item.id) || createEmptyTrackingStats();

      return getDisplayStockStatuses(item, trackingStats).some(
        (status) => status.key === "Expired",
      );
    }).length;
    const depletedItems = inventoryItemsWithSyncStatus.filter((item) => {
      const trackingStats =
        inventoryTrackingMap.get(item.id) || createEmptyTrackingStats();

      return getDisplayStockStatuses(item, trackingStats).some(
        (status) => status.key === "Depleted",
      );
    }).length;

    return {
      totalItems,
      expiredItems,
      depletedItems,
      lowStockItems,
      expiringSoonItems,
    };
  }, [inventoryItemsWithSyncStatus, inventoryTrackingMap]);

  const summaryCards = useMemo(
    () => [
      {
        label: "Total Items",
        value: inventoryAnalytics.totalItems,
      },
      {
        label: "Low Stock Items",
        value: inventoryAnalytics.lowStockItems,
      },
      {
        label: "Near Expiry",
        value: inventoryAnalytics.expiringSoonItems,
      },
      {
        label: "Expired",
        value: inventoryAnalytics.expiredItems,
      },
      {
        label: "Depleted",
        value: inventoryAnalytics.depletedItems,
      },
    ],
    [inventoryAnalytics],
  );
  const matchedScannedBarcodeMatch = useMemo(() => {
    const scannedBarcode = normalizeInventoryBarcode(scanForm.barcodeNumber);

    if (!scannedBarcode) {
      return null;
    }

    return findMayorInventoryItemByBarcode(
      inventoryItemsForInventoryManagement,
      scannedBarcode,
    );
  }, [inventoryItemsForInventoryManagement, scanForm.barcodeNumber]);

  const matchedScannedStockForm = matchedScannedBarcodeMatch?.stockForm || null;
  const matchedScannedItem = matchedScannedBarcodeMatch?.item || null;

  const matchedScannedItemTrackingStats = useMemo(() => {
    if (!matchedScannedItem?.id) {
      return createEmptyTrackingStats();
    }

    return (
      inventoryTrackingMap.get(matchedScannedItem.id) ||
      createEmptyTrackingStats()
    );
  }, [inventoryTrackingMap, matchedScannedItem?.id]);

  const matchedScannedItemCurrentStock = matchedScannedItem
    ? getMonitorQuantity(matchedScannedItem, matchedScannedItemTrackingStats)
    : 0;

  const matchedScannedItemBatches = useMemo(() => {
    if (!matchedScannedItem?.id) {
      return [];
    }

    return inventoryBatchesForInventoryManagement.filter((batch) => {
      return (
        String(batch.inventory_item_id || batch.item_id || "") ===
        String(matchedScannedItem.id)
      );
    });
  }, [inventoryBatchesForInventoryManagement, matchedScannedItem?.id]);

  const matchedScannedItemBatchNumber = useMemo(() => {
    if (!matchedScannedItem?.id) {
      return "";
    }

    return buildScannedInventoryBatchNumber(
      matchedScannedItem,
      matchedScannedItemBatches,
    );
  }, [matchedScannedItem, matchedScannedItemBatches]);

  const visibleInventoryItems = useMemo(() => {
    const selectedStockStatuses = Array.isArray(filters.status)
      ? filters.status
      : filters.status && filters.status !== "All"
        ? [filters.status]
        : [];

    const filteredItems = inventoryItemsForInventoryManagement.filter((item) => {
      const trackingStats =
        inventoryTrackingMap.get(item.id) || createEmptyTrackingStats();
      const matchesSearch = matchesInventoryItemSearch(item, filters.search);
      const matchesCategory = matchesInventoryItemCategory(item, filters.category);
      const matchesStatus =
        selectedStockStatuses.length === 0
          ? true
          : selectedStockStatuses.some((status) => {
              if (status === "Available") {
                return getDisplayStockStatuses(item, trackingStats).some(
                  (entry) => entry.key === "Available",
                );
              }

              if (status === "Low Stock") {
                return isLowStockItem(item, trackingStats);
              }

              if (status === "Near Expiry") {
                return isNearExpiryItem(item, trackingStats);
              }

              if (status === "Expired") {
                return isExpiredItem(item, trackingStats);
              }

              if (status === "Depleted") {
                return getMonitorQuantity(item, trackingStats) <= 0;
              }

              return false;
            });

      return matchesSearch && matchesCategory && matchesStatus;
    });

    const filteredRows = filteredItems.map((item) => {
      const trackingStats =
        inventoryTrackingMap.get(item.id) || createEmptyTrackingStats();
      const relatedBatches = inventoryBatchesForInventoryManagement.filter(
        (batch) => String(batch?.inventory_item_id) === String(item.id),
      );
      const latestBatchTimestamp = relatedBatches.reduce((latestTimestamp, batch) => {
        return Math.max(
          latestTimestamp,
          getSortableTimestamp(batch?.received_at || batch?.created_at),
        );
      }, Number.NEGATIVE_INFINITY);
      const earliestBatchTimestamp = relatedBatches.reduce((earliestTimestamp, batch) => {
        const batchTimestamp = getSortableTimestamp(
          batch?.received_at || batch?.created_at,
        );

        if (batchTimestamp === Number.NEGATIVE_INFINITY) {
          return earliestTimestamp;
        }

        return Math.min(earliestTimestamp, batchTimestamp);
      }, Number.POSITIVE_INFINITY);
      const fallbackTimestamp = getSortableTimestamp(item?.updated_at || item?.created_at);

      return {
        ...item,
        total_stock_on_hand: getMonitorQuantity(item, trackingStats),
        stock_form_labels: getStockFormLabels(item),
        stock_status_label: getDisplayStockStatus(item, trackingStats),
        stock_statuses: getDisplayStockStatuses(item, trackingStats),
        reorder_level_display: getReorderLevelDisplayValue(item, relatedBatches),
        requires_reorder_level_before_restock:
          requiresReorderLevelBeforeLguHandling(item, relatedBatches),
        latest_activity_at:
          latestBatchTimestamp !== Number.NEGATIVE_INFINITY
            ? latestBatchTimestamp
            : fallbackTimestamp,
        earliest_activity_at:
          earliestBatchTimestamp !== Number.POSITIVE_INFINITY
            ? earliestBatchTimestamp
            : fallbackTimestamp,
      };
    });

    const normalizedSortOrder = filters.sortOrder || INVENTORY_SORT_OPTIONS.NEWEST;

    return [...filteredRows].sort((leftItem, rightItem) => {
      if (normalizedSortOrder === INVENTORY_SORT_OPTIONS.OLDEST) {
        return (
          Number(leftItem.earliest_activity_at || 0) -
          Number(rightItem.earliest_activity_at || 0)
        );
      }

      if (normalizedSortOrder === INVENTORY_SORT_OPTIONS.AZ) {
        return String(leftItem.item_name || "").localeCompare(
          String(rightItem.item_name || ""),
          undefined,
          { sensitivity: "base" },
        );
      }

      if (normalizedSortOrder === INVENTORY_SORT_OPTIONS.ZA) {
        return String(rightItem.item_name || "").localeCompare(
          String(leftItem.item_name || ""),
          undefined,
          { sensitivity: "base" },
        );
      }

      return (
        Number(rightItem.latest_activity_at || 0) -
        Number(leftItem.latest_activity_at || 0)
      );
    });
  }, [
    inventoryItemsForInventoryManagement,
    inventoryTrackingMap,
    inventoryBatchesForInventoryManagement,
    filters.category,
    filters.search,
    filters.sortOrder,
    filters.status,
  ]);

  const handleFilterChange = (name, value) => {
    setFilters((previousFilters) => ({
      ...previousFilters,
      [name]: value,
    }));
  };

  const reserveBatchNumber = (item, batchNo) => {
    const itemId = String(item?.id || "");
    const normalizedBatchNo = String(batchNo || "").trim();

    if (!itemId || !normalizedBatchNo) {
      return "";
    }

    const key = `${itemId}|${normalizedBatchNo.toUpperCase()}`;
    setReservedBatchNumbers((currentReservations) =>
      currentReservations.some((reservation) => reservation.key === key)
        ? currentReservations
        : [
            ...currentReservations,
            { key, itemId, batchNo: normalizedBatchNo },
          ],
    );
    return key;
  };

  const releaseBatchNumberReservation = (key) => {
    if (!key) {
      return;
    }

    setReservedBatchNumbers((currentReservations) =>
      currentReservations.filter((reservation) => reservation.key !== key),
    );
  };

  const handleOpenCreateModal = () => {
    setModalErrorMessage("");
    setModalMode("create");
    setCreateModalSource("manual");
    setCreateModalItemData(null);
    setIsModalOpen(true);
  };

  const handleSubmitModal = async (payload) => {
    setIsSubmitting(true);
    setModalErrorMessage("");

    try {
      let response = null;
      const matchedExistingItem =
        payload?.existing_item_id
          ? inventoryItemsForInventoryManagement.find((item) => {
              return (
                item?.is_active !== false &&
                String(item?.id) === String(payload.existing_item_id)
              );
            }) || null
          : null;

      if (matchedExistingItem?.is_local_only) {
        setModalErrorMessage(
          "This item is still waiting to sync. Wait for it to be accepted by DISTYNC before adding stock to it.",
        );
        return;
      }

      if (
        matchedExistingItem &&
        !isOnline &&
        !mayorOfflinePreparation.isReady
      ) {
        setModalErrorMessage(
          "Stock-in is not ready offline because the complete inventory data is not saved on this device. Connect and prepare offline data first.",
        );
        return;
      }

      if (modalMode === "edit" && createModalItemData?.id) {
        response = await updateInventoryItem(createModalItemData.id, payload);
      } else if (matchedExistingItem) {
        const relatedBatches = inventoryBatchesForInventoryManagement.filter(
          (batch) =>
            String(batch?.inventory_item_id) === String(matchedExistingItem.id),
        );
        const packageCount = getPositiveIntegerValue(payload?.packaging_count);
        const unitsPerPackage = getUnitsPerPackageValue(payload);
        const quantityReceived = packageCount * unitsPerPackage;
        const activeStockForms = getItemStockForms(matchedExistingItem).filter(
          (stockForm) => stockForm?.is_active !== false,
        );
        const matchingStockForm =
          activeStockForms.find((stockForm) => {
            return (
              payload?.inventory_item_stock_form_id &&
              String(stockForm?.id) ===
                String(payload.inventory_item_stock_form_id)
            );
          }) ||
          activeStockForms.find((stockForm) => {
            return (
              getNormalizedInventoryText(stockForm?.barcode) ===
                getNormalizedInventoryText(payload?.barcode) &&
              getNormalizedInventoryText(stockForm?.packaging) ===
                getNormalizedInventoryText(payload?.packaging) &&
              Number(stockForm?.units_per_packaging || 0) === unitsPerPackage &&
              getNormalizedInventoryText(stockForm?.unit_of_measure) ===
                getNormalizedInventoryText(payload?.unit_of_measure || "pc") &&
              Number(stockForm?.unit_of_measure_value || 0) ===
                Number(payload?.unit_of_measure_value || 0)
            );
          });

        const batchNo = buildScannedInventoryBatchNumber(
          matchedExistingItem,
          relatedBatches,
        );
        const batchReservationKey = reserveBatchNumber(
          matchedExistingItem,
          batchNo,
        );

        try {
          response = await createInventoryBatch({
            inventory_item_id: matchedExistingItem.id,
            inventory_item_stock_form_id: matchingStockForm?.id || null,
            stock_form_barcode: payload?.barcode || null,
            stock_form_packaging: payload?.packaging || "piece",
            stock_form_units_per_packaging: unitsPerPackage,
            stock_form_unit_of_measure: payload?.unit_of_measure || "pc",
            stock_form_unit_of_measure_value:
              payload?.unit_of_measure_value || null,
            batch_no: batchNo,
            source_type: getInventoryBatchSourceType(matchedExistingItem),
            quantity_received: quantityReceived,
            inventory_item_reorder_level:
              matchedExistingItem.requires_reorder_level_before_restock
                ? Number(payload.reorder_level)
                : undefined,
            expiration_date: isPerishableItem(matchedExistingItem)
              ? payload?.expiration_date || null
              : null,
          });
        } catch (error) {
          releaseBatchNumberReservation(batchReservationKey);
          throw error;
        }
      } else {
        response = await createInventoryItem(payload);
      }

      if (!response?.queued_offline) {
        await loadInventoryData();
      }
      setIsModalOpen(false);
      setCreateModalSource("manual");
      setCreateModalItemData(null);
    } catch (error) {
      if (error.message === "item_name already exists") {
        setModalErrorMessage(
          "This item already exists. Select its packaging to restock it.",
        );
      } else {
        setModalErrorMessage(error.message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenEditModal = async (itemRow) => {
    if (!itemRow?.id) {
      return;
    }

    if (itemRow.is_local_only) {
      setModalErrorMessage(
        "This item is still waiting to sync. Wait for it to be accepted by DISTYNC before editing it.",
      );
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
    setScanForm(INITIAL_SCAN_FORM);
    setScanErrorMessage(
      !isOnline && !mayorOfflinePreparation.isReady
        ? "Barcode matching is unavailable because complete inventory data is not saved on this device. You may continue to add an item manually, but do not use an unverified barcode as an existing item."
        : "",
    );
    setIsScanModalOpen(true);
  };

  const getLocalMayorItemDetail = async (inventoryItemId) => {
    const cacheRow = await getMayorInventoryCacheSnapshot();
    const localItems =
      inventoryItemsForInventoryManagement.length > 0
        ? inventoryItemsForInventoryManagement
        : cacheRow?.items || [];
    const localBatches =
      inventoryBatchesForInventoryManagement.length > 0
        ? inventoryBatchesForInventoryManagement
        : cacheRow?.batches || [];
    const localTransactions =
      inventoryTransactions.length > 0
        ? inventoryTransactions
        : cacheRow?.transactions || [];

    return buildMayorInventoryItemDetailFromLocalGraph({
      inventoryItemId,
      inventoryItems: localItems,
      inventoryBatches: localBatches,
      inventoryTransactions: localTransactions,
    });
  };

  const handleOpenItemDetail = async (inventoryItemId) => {
    setIsDetailModalOpen(true);
    setIsDetailLoading(true);
    setDetailErrorMessage("");
    setSelectedItemDetail(null);

    const browserIsOffline =
      typeof navigator !== "undefined" && navigator.onLine === false;

    if (isMayorPortal && (!isOnline || browserIsOffline)) {
      const localDetail = await getLocalMayorItemDetail(inventoryItemId);

      if (localDetail) {
        setSelectedItemDetail(localDetail);
      } else {
        setDetailErrorMessage(
          "This item is not saved on this device for offline details. Reconnect to view the current item information.",
        );
      }

      setIsDetailLoading(false);
      return;
    }

    try {
      const response = await fetchInventoryItemDetail(inventoryItemId);
      setSelectedItemDetail(response?.data || null);
    } catch (error) {
      const localDetail =
        isMayorPortal && canUseMayorInventoryCacheAfterError(error)
          ? await getLocalMayorItemDetail(inventoryItemId)
          : null;

      if (localDetail) {
        setSelectedItemDetail(localDetail);
      } else {
        setDetailErrorMessage(
          "Item details could not be loaded. Reconnect to DISTYNC and try again.",
        );
      }
    } finally {
      setIsDetailLoading(false);
    }
  };

  const handleCloseScanModal = () => {
    if (isSubmittingScanRestock) {
      return;
    }

    setIsScanModalOpen(false);
    setScanErrorMessage("");
  };

  const handleOpenStatusLogModal = (itemRow) => {
    if (!isOnline) {
      setInventoryActionNotice(
        "Status changes require a connection. Reconnect before recording a status log.",
      );
      return;
    }

    setStatusLogItem(itemRow);
    setStatusLogErrorMessage("");
    setIsStatusLogModalOpen(true);
  };

  const handleCloseStatusLogModal = (forceClose = false) => {
    if (isSubmitting && !forceClose) {
      return;
    }

    setIsStatusLogModalOpen(false);
    setStatusLogItem(null);
    setStatusLogErrorMessage("");
  };

  const handleScanInputChange = (field, value) => {
    setScanErrorMessage("");
    setScanForm((previousForm) => {
      if (field === "barcodeNumber") {
        return {
          ...INITIAL_SCAN_FORM,
          barcodeNumber: value,
        };
      }

      return {
        ...previousForm,
        [field]: value,
      };
    });
  };

  const handleSubmitScanModal = async () => {
    const trimmedBarcode = normalizeInventoryBarcode(scanForm.barcodeNumber);

    if (!trimmedBarcode || isSubmittingScanRestock) {
      return;
    }

    if (matchedScannedItem?.id) {
      if (matchedScannedItem.is_local_only) {
        setScanErrorMessage(
          "This item is still waiting to sync. Wait for it to be accepted by DISTYNC before adding stock to it.",
        );
        return;
      }

      if (!isOnline && !mayorOfflinePreparation.isReady) {
        setScanErrorMessage(
          "Stock-in is not ready offline because the complete inventory data is not saved on this device. Connect and prepare offline data first.",
        );
        return;
      }

      const packageCount = getPositiveIntegerValue(scanForm.quantityOnHand);
      const reorderLevel = getPositiveIntegerValue(scanForm.reorderLevel);

      if (!packageCount) {
        setScanErrorMessage(
          "Quantity on hand must be a whole number greater than 0.",
        );
        return;
      }

      if (
        matchedScannedItem.requires_reorder_level_before_restock &&
        !reorderLevel
      ) {
        setScanErrorMessage("Reorder level is required.");
        return;
      }

      if (isPerishableItem(matchedScannedItem) && !scanForm.expirationDate) {
        setScanErrorMessage("Expiration date is required for perishable items.");
        return;
      }

      const quantityReceived =
        packageCount *
        getUnitsPerPackageValue(matchedScannedStockForm || matchedScannedItem);

      setIsSubmittingScanRestock(true);
      setScanErrorMessage("");

      const batchNo =
        matchedScannedItemBatchNumber ||
        buildScannedInventoryBatchNumber(
          matchedScannedItem,
          matchedScannedItemBatches,
        );
      const batchReservationKey = reserveBatchNumber(
        matchedScannedItem,
        batchNo,
      );

      try {
        const response = await createInventoryBatch({
          inventory_item_id: matchedScannedItem.id,
          inventory_item_stock_form_id: matchedScannedStockForm?.id || null,
          batch_no: batchNo,
          source_type: getInventoryBatchSourceType(matchedScannedItem),
          quantity_received: quantityReceived,
          inventory_item_reorder_level:
            matchedScannedItem.requires_reorder_level_before_restock
              ? reorderLevel
              : undefined,
          expiration_date: scanForm.expirationDate || null,
        });

        if (!response?.queued_offline && !response?.queuedOffline) {
          await loadInventoryData();
        }

        setScanForm(INITIAL_SCAN_FORM);
        setIsScanModalOpen(false);
      } catch (error) {
        releaseBatchNumberReservation(batchReservationKey);
        setScanErrorMessage(error.message || "Failed to add stock to this item.");
      } finally {
        setIsSubmittingScanRestock(false);
      }
      return;
    }

    setIsScanModalOpen(false);
    setScanErrorMessage("");
    setModalErrorMessage("");
    setModalMode("create");
    setCreateModalSource("scan");
    setCreateModalItemData({
      barcode: trimmedBarcode,
    });
    setIsModalOpen(true);
  };

  const handleExport = async (format, extraFilters = {}) => {
    const normalizedCategory = extraFilters.category || "All";
    const normalizedStatus = extraFilters.status || "All";

    setExportingFormat(format);
    setIsExportModalOpen(false);

    try {
      const file = await exportInventoryItems({
        format,
        filters: {
          search: filters.search,
          ...buildInventoryItemFilters({ ...filters, category: normalizedCategory }),
          status: normalizedStatus,
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
    setSelectedExportFormat("csv");
    setSelectedExportCategory(filters.category || "All");
    setSelectedExportStatus(
      Array.isArray(filters.status) && filters.status.length === 1
        ? filters.status[0]
        : "All",
    );
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
    handleExport(selectedExportFormat, {
      category: selectedExportCategory,
      status: selectedExportStatus,
    });
  };

  const handleOpenBatchExpiryModal = (batch) => {
    setSelectedBatchForExpiryEdit(batch);
    setBatchExpiryErrorMessage("");
    setIsBatchExpiryModalOpen(true);
  };

  const handleCloseBatchExpiryModal = () => {
    if (isSubmittingBatchExpiry) {
      return;
    }

    setIsBatchExpiryModalOpen(false);
    setSelectedBatchForExpiryEdit(null);
    setBatchExpiryErrorMessage("");
  };

  const handleSubmitBatchExpiry = async (payload) => {
    if (!selectedBatchForExpiryEdit?.id) {
      return;
    }

    setIsSubmittingBatchExpiry(true);
    setBatchExpiryErrorMessage("");

    try {
      await updateInventoryBatchExpiry(selectedBatchForExpiryEdit.id, payload);
      await loadInventoryData();

      if (selectedItemDetail?.item?.id) {
        const detailResponse = await fetchInventoryItemDetail(
          selectedItemDetail.item.id,
        );
        setSelectedItemDetail(detailResponse?.data || null);
      }

      handleCloseBatchExpiryModal();
    } catch (error) {
      setBatchExpiryErrorMessage(
        error.message || "Failed to update batch expiry date.",
      );
    } finally {
      setIsSubmittingBatchExpiry(false);
    }
  };

  const selectedStatusLogBatches = useMemo(() => {
    if (!statusLogItem?.id) {
      return [];
    }

    return inventoryBatchesForInventoryManagement.filter((batch) => {
      return (
        !batch.is_local_only &&
        String(batch.inventory_item_id) === String(statusLogItem.id) &&
        Number(batch.quantity_available || 0) > 0
      );
    });
  }, [inventoryBatchesForInventoryManagement, statusLogItem]);

  const selectedStatusLogTrackingStats = useMemo(() => {
    if (!statusLogItem?.id) {
      return createEmptyTrackingStats();
    }

    return (
      inventoryTrackingMap.get(statusLogItem.id) ||
      createEmptyTrackingStats()
    );
  }, [inventoryTrackingMap, statusLogItem]);

  const selectedStatusLogCurrentStock = statusLogItem
    ? getMonitorQuantity(statusLogItem, selectedStatusLogTrackingStats)
    : 0;

  const handleSubmitStatusLog = async (payload) => {
    setIsSubmitting(true);
    setStatusLogErrorMessage("");

    try {
      const response = await createInventoryTransaction(payload);

      if (!response?.queued_offline) {
        await loadInventoryData();
      }

      handleCloseStatusLogModal(true);
    } catch (error) {
      setStatusLogErrorMessage(
        error.message || "Failed to save inventory status log.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="inventory-items-page"
      style={{ flex: 1, minWidth: 0, maxWidth: "100%" }}
    >
      <PageHeader
        title="INVENTORY ITEMS MANAGEMENT"
      />

      {isMayorPortal ? <SyncStatusBanner scope="mayor-inventory" /> : null}

      <OfflineDataReadiness
        {...mayorOfflinePreparation}
        variant="mayor-inventory"
      />

      <div className="inventory-items-page-top-actions" style={inventoryPageStyles.pageTopActions}>
        <InventoryPageActions
          exportingFormat={exportingFormat}
          onOpenScanModal={handleOpenScanModal}
          onOpenCreateModal={handleOpenCreateModal}
          onOpenExportModal={handleOpenExportModal}
          showExport={false}
        />
      </div>

      <div className="inventory-items-overview-section" style={inventoryPageStyles.overviewSection}>
        <InventoryOverviewCards summaryCards={summaryCards} />
      </div>

      <div className="inventory-items-management-toolbar" style={inventoryPageStyles.managementToolbar}>
        <InventoryFilters
          filters={filters}
          onFilterChange={handleFilterChange}
        />

        <InventoryPageActions
          exportingFormat={exportingFormat}
          onOpenScanModal={handleOpenScanModal}
          onOpenCreateModal={handleOpenCreateModal}
          onOpenExportModal={handleOpenExportModal}
          showScanAndAdd={false}
        />
      </div>

      <section className="inventory-items-records-card" style={shellStyles.card}>
        <h3 className="table-card-title">
          {getInventorySectionTitle()}
        </h3>

        <InventoryItemsTable
          rows={visibleInventoryItems}
          isLoading={isLoading}
          errorMessage={errorMessage}
          onEditItem={handleOpenEditModal}
          onViewDetails={handleOpenItemDetail}
          onLogStatus={handleOpenStatusLogModal}
        />
      </section>

      <InventoryItemFormModal
        key={[
          modalMode,
          createModalSource,
          createModalItemData?.id || "new",
          createModalItemData?.barcode || "no-barcode",
          createModalItemData?.item_name || "no-name",
          isModalOpen ? "open" : "closed",
        ].join(":")}
        isOpen={isModalOpen}
        mode={modalMode}
        source={createModalSource}
        itemData={createModalItemData}
        inventoryItems={inventoryItemsForInventoryManagement}
        getCurrentStockForItem={(item) => {
          const trackingStats =
            inventoryTrackingMap.get(item?.id) || createEmptyTrackingStats();

          return getMonitorQuantity(item, trackingStats);
        }}
        isSubmitting={isSubmitting}
        errorMessage={modalErrorMessage}
        onClose={() => {
          setIsModalOpen(false);
          setModalMode("create");
          setCreateModalSource("manual");
          setCreateModalItemData(null);
        }}
        onSubmit={handleSubmitModal}
      />

      <BarcodeScanModal
        isOpen={isScanModalOpen}
        scanForm={scanForm}
        matchedItem={matchedScannedItem}
        matchedStockForm={matchedScannedStockForm}
        currentStock={matchedScannedItemCurrentStock}
        generatedBatchNumber={matchedScannedItemBatchNumber}
        errorMessage={scanErrorMessage}
        isSubmitting={isSubmittingScanRestock}
        onClose={handleCloseScanModal}
        onSubmit={handleSubmitScanModal}
        onInputChange={handleScanInputChange}
      />

      <InventoryItemStatusLogModal
        isOpen={isStatusLogModalOpen}
        item={statusLogItem}
        inventoryBatches={selectedStatusLogBatches}
        authenticatedUser={authenticatedUser}
        currentStock={selectedStatusLogCurrentStock}
        isSubmitting={isSubmitting}
        errorMessage={statusLogErrorMessage}
        onClose={handleCloseStatusLogModal}
        onSubmit={handleSubmitStatusLog}
      />

      <InventoryBatchExpiryModal
        isOpen={isBatchExpiryModalOpen}
        batch={selectedBatchForExpiryEdit}
        itemUnit={selectedItemDetail?.item?.unit_of_measure || "pc"}
        isPerishable={Boolean(selectedItemDetail?.item?.is_perishable)}
        isSubmitting={isSubmittingBatchExpiry}
        errorMessage={batchExpiryErrorMessage}
        onClose={handleCloseBatchExpiryModal}
        onSubmit={handleSubmitBatchExpiry}
      />

      <InventoryExportModal
        isOpen={isExportModalOpen}
        isSubmitting={Boolean(exportingFormat)}
        selectedCategory={selectedExportCategory}
        selectedStatus={selectedExportStatus}
        selectedFormat={selectedExportFormat}
        errorMessage=""
        onCategoryChange={setSelectedExportCategory}
        onStatusChange={setSelectedExportStatus}
        onFormatChange={setSelectedExportFormat}
        onClose={handleCloseExportModal}
        onSubmit={(event) => {
          event.preventDefault();
          handleSubmitExportModal();
        }}
      />

      <FeedbackToast
        type={exportFeedback.type}
        message={exportFeedback.message}
        onClose={() => setExportFeedback({ type: "", message: "" })}
      />

      <FeedbackToast
        type="info"
        message={inventoryActionNotice}
        onClose={() => setInventoryActionNotice("")}
      />

      <InventoryItemDetailModal
        isOpen={isDetailModalOpen}
        isLoading={isDetailLoading}
        errorMessage={detailErrorMessage}
        detail={selectedItemDetail}
        onEditBatch={handleOpenBatchExpiryModal}
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
