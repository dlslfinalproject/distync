import React, { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import PageHeader from "../../components/layout/PageHeader";
import { shellStyles } from "../../components/layout/BarangayLayout";
import InventoryItemFormModal from "../../components/inventory-items/InventoryItemFormModal";
import InventoryItemDetailModal from "../../components/inventory-items/InventoryItemDetailModal";
import InventoryItemStatusLogModal from "../../components/inventory-items/InventoryItemStatusLogModal";
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
  lookupInventoryItemByBarcode,
  updateInventoryItem,
} from "../../features/inventory-items/inventoryItemService";
import {
  createInventoryBatch,
  fetchInventoryBatches,
} from "../../features/inventory-batches/inventoryBatchService";
import {
  createInventoryTransaction,
  fetchInventoryTransactions,
} from "../../features/inventory-transactions/inventoryTransactionService";
import db from "../../offline/db";
import { subscribeToSyncUpdates } from "../../offline/syncService";
import {
  hasInventoryExportRows,
} from "../../features/inventory-items/inventoryItemExportOptions";
import {
  getTotalItemQuantityValue,
} from "../../features/inventory-items/inventoryItemFormatting";
import { useAuth } from "../../context/AuthContext";
import {
  buildInventoryItemFilters,
  getInventorySectionTitle,
  inventoryPageStyles,
} from "../../features/inventory-items/inventoryItemsPageUi";
import {
  buildInventoryTrackingMap,
  createEmptyTrackingStats,
  getTrackedExpirationDate,
} from "../../features/inventory-items/inventoryItemStockStatus";
import { mergeInventoryItemsWithSyncStatus } from "../../features/inventory-items/inventoryItemSync";
import {
  buildExportSuccessMessage,
  downloadExportFile,
  NO_EXPORT_DATA_MESSAGE,
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
  expirationDate: "",
};

const INVENTORY_BATCH_SOURCE_TYPES = [
  "PURCHASED",
  "DONATED",
  "DSWD",
  "LGU",
  "OTHER",
];

const getPositiveIntegerValue = (value) => {
  const parsedValue = Number(value);

  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    return null;
  }

  return parsedValue;
};

const normalizeBarcodeInput = (value) =>
  String(value || "").replace(/\s+/g, "").trim().toLowerCase();

const getNormalizedInventoryText = (value) =>
  String(value || "").trim().toLowerCase();

const matchesInventorySearch = (item, searchTerm) => {
  const normalizedSearch = getNormalizedInventoryText(searchTerm);

  if (!normalizedSearch) {
    return true;
  }

  const stockForms = getItemStockForms(item);
  const searchableValues = [
    item?.item_name,
    item?.item_code,
    item?.category,
    item?.unit_of_measure,
    item?.tracking_method,
    item?.packaging,
    ...stockForms.flatMap((stockForm) => [
      stockForm?.barcode,
      stockForm?.packaging,
      stockForm?.unit_of_measure,
    ]),
  ];

  return searchableValues.some((value) =>
    getNormalizedInventoryText(value).includes(normalizedSearch),
  );
};

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
    : "OTHER";
};

const buildScannedInventoryBatchNumber = (item, relatedBatches = []) => {
  const identifier =
    String(item?.item_code || item?.barcode || item?.id || "ITEM")
      .replace(/[^a-z0-9]/gi, "")
      .slice(-8)
      .toUpperCase() || "ITEM";
  const batchPrefix = `${identifier}-BATCH-`;
  const existingSequences = relatedBatches
    .map((batch) => {
      const batchNumber = String(batch?.batch_no || "").toUpperCase();

      if (!batchNumber.startsWith(batchPrefix)) {
        return null;
      }

      const parsedValue = Number(batchNumber.replace(batchPrefix, ""));
      return Number.isInteger(parsedValue) && parsedValue > 0
        ? parsedValue
        : null;
    })
    .filter(Boolean);
  const nextSequence =
    Math.max(relatedBatches.length, 0, ...existingSequences) + 1;

  return `${batchPrefix}${String(nextSequence).padStart(3, "0")}`;
};

const getDisplayStockStatus = (item, trackingStats) => {
  const onHand = getMonitorQuantity(item, trackingStats);

  if (isExpiredItem(item, trackingStats)) {
    return "Expired";
  }

  if (isNearExpiryItem(item, trackingStats)) {
    return "Near Expiry";
  }

  if (onHand <= 0 || isLowStockItem(item, trackingStats)) {
    return "Low Stock";
  }

  return "In Stock";
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
  const { authenticatedUser } = useAuth();
  const [filters, setFilters] = useState({
    search: "",
    category: "All",
    status: [],
  });
  const [inventoryItems, setInventoryItems] = useState([]);
  const [inventoryBatches, setInventoryBatches] = useState([]);
  const [inventoryTransactions, setInventoryTransactions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
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
  const syncQueueEntries =
    useLiveQuery(() => db.syncQueue.toArray(), [], []) || [];
  const loadInventoryData = async (activeFilters = filters) => {
    setIsLoading(true);
    setErrorMessage("");

    try {
      const [itemResponse, batchResponse, transactionResponse] =
        await Promise.all([
          fetchInventoryItems(
            buildInventoryItemFilters({
              ...activeFilters,
              search: "",
            }),
          ),
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
  const matchedScannedStockForm = useMemo(() => {
    const scannedBarcode = normalizeBarcodeInput(scanForm.barcodeNumber);

    if (!scannedBarcode) {
      return null;
    }

    for (const item of inventoryItemsWithSyncStatus) {
      const matchedStockForm = getItemStockForms(item).find((stockForm) => {
        return normalizeBarcodeInput(stockForm?.barcode) === scannedBarcode;
      });

      if (matchedStockForm) {
        return matchedStockForm;
      }
    }

    return null;
  }, [inventoryItemsWithSyncStatus, scanForm.barcodeNumber]);

  const matchedScannedItem = useMemo(() => {
    if (!matchedScannedStockForm?.inventory_item_id) {
      return null;
    }

    return (
      inventoryItemsWithSyncStatus.find((item) => {
        return String(item?.id) === String(matchedScannedStockForm.inventory_item_id);
      }) || null
    );
  }, [inventoryItemsWithSyncStatus, matchedScannedStockForm]);

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

    return inventoryBatches.filter((batch) => {
      return (
        String(batch.inventory_item_id || batch.item_id || "") ===
        String(matchedScannedItem.id)
      );
    });
  }, [inventoryBatches, matchedScannedItem?.id]);

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
    const normalizedCategoryFilter =
      getNormalizedInventoryText(filters.category) || "all";
    const selectedStockStatuses = Array.isArray(filters.status)
      ? filters.status
      : filters.status && filters.status !== "All"
        ? [filters.status]
        : [];

    const filteredItems = inventoryItemsWithSyncStatus.filter((item) => {
      const trackingStats =
        inventoryTrackingMap.get(item.id) || createEmptyTrackingStats();
      const itemCategory = getNormalizedInventoryText(item.category);
      const matchesSearch = matchesInventorySearch(item, filters.search);
      const matchesCategory =
        normalizedCategoryFilter === "all" ||
        itemCategory === normalizedCategoryFilter;
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

              if (status === "Near Expiry" || status === "Expiring") {
                return isNearExpiryItem(item, trackingStats);
              }

              if (status === "Expired") {
                return isExpiredItem(item, trackingStats);
              }

              if (status === "Depleted" || status === "Out of Stock") {
                return getMonitorQuantity(item, trackingStats) <= 0;
              }

              return false;
            });

      return matchesSearch && matchesCategory && matchesStatus;
    });

    return filteredItems.map((item) => {
      const trackingStats =
        inventoryTrackingMap.get(item.id) || createEmptyTrackingStats();

      return {
        ...item,
        total_stock_on_hand: getMonitorQuantity(item, trackingStats),
        stock_form_labels: getStockFormLabels(item),
        stock_status_label: getDisplayStockStatus(item, trackingStats),
        stock_statuses: getDisplayStockStatuses(item, trackingStats),
      };
    });
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
          ? inventoryItems.find((item) => {
              return String(item?.id) === String(payload.existing_item_id);
            }) || null
          : null;

      if (modalMode === "edit" && createModalItemData?.id) {
        response = await updateInventoryItem(createModalItemData.id, payload);
      } else if (matchedExistingItem) {
        const relatedBatches = inventoryBatches.filter(
          (batch) =>
            String(batch?.inventory_item_id) === String(matchedExistingItem.id),
        );
        const packageCount = getPositiveIntegerValue(payload?.packaging_count);
        const unitsPerPackage = getUnitsPerPackageValue(payload);
        const quantityReceived = packageCount * unitsPerPackage;
        const matchingStockForm = getItemStockForms(matchedExistingItem).find(
          (stockForm) => {
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
          },
        );

        response = await createInventoryBatch({
          inventory_item_id: matchedExistingItem.id,
          inventory_item_stock_form_id: matchingStockForm?.id || null,
          stock_form_barcode: payload?.barcode || null,
          stock_form_packaging: payload?.packaging || "piece",
          stock_form_units_per_packaging: unitsPerPackage,
          stock_form_unit_of_measure: payload?.unit_of_measure || "pc",
          stock_form_unit_of_measure_value:
            payload?.unit_of_measure_value || null,
          batch_no: buildScannedInventoryBatchNumber(
            matchedExistingItem,
            relatedBatches,
          ),
          source_type: getInventoryBatchSourceType(matchedExistingItem),
          quantity_received: quantityReceived,
          expiration_date: isPerishableItem(matchedExistingItem)
            ? payload?.expiration_date || null
            : null,
        });
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
          `Existing item found: ${payload?.item_name || "This inventory item"}. Please continue as a restock entry.`,
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
    setScanErrorMessage("");
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
    if (isSubmittingScanRestock) {
      return;
    }

    setIsScanModalOpen(false);
    setScanErrorMessage("");
  };

  const handleOpenStatusLogModal = (itemRow) => {
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
    const trimmedBarcode = normalizeBarcodeInput(scanForm.barcodeNumber);

    if (!trimmedBarcode || isSubmittingScanRestock) {
      return;
    }

    if (matchedScannedItem?.id) {
      const packageCount = getPositiveIntegerValue(scanForm.quantityOnHand);

      if (!packageCount) {
        setScanErrorMessage(
          "Quantity on hand must be a whole number greater than 0.",
        );
        return;
      }

      if (isPerishableItem(matchedScannedItem) && !scanForm.expirationDate) {
        setScanErrorMessage("Expiration date is required for perishable items.");
        return;
      }

      const quantityReceived =
        packageCount * getUnitsPerPackageValue(matchedScannedItem);

      setIsSubmittingScanRestock(true);
      setScanErrorMessage("");

      try {
        const response = await createInventoryBatch({
          inventory_item_id: matchedScannedItem.id,
          inventory_item_stock_form_id: matchedScannedStockForm?.id || null,
          batch_no:
            matchedScannedItemBatchNumber ||
            buildScannedInventoryBatchNumber(
              matchedScannedItem,
              matchedScannedItemBatches,
            ),
          source_type: getInventoryBatchSourceType(matchedScannedItem),
          quantity_received: quantityReceived,
          expiration_date: scanForm.expirationDate || null,
        });

        if (!response?.queued_offline && !response?.queuedOffline) {
          await loadInventoryData();
        }

        setScanForm(INITIAL_SCAN_FORM);
        setIsScanModalOpen(false);
      } catch (error) {
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
    setCreateModalItemData(null);

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
    const normalizedCategory = extraFilters.category || "All";
    const normalizedStatus = extraFilters.status || "All";
    const hasRowsToExport = hasInventoryExportRows({
      category: normalizedCategory,
      status: normalizedStatus,
      visibleInventoryItems,
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

  const selectedStatusLogBatches = useMemo(() => {
    if (!statusLogItem?.id) {
      return [];
    }

    return inventoryBatches.filter((batch) => {
      return (
        String(batch.inventory_item_id) === String(statusLogItem.id) &&
        Number(batch.quantity_available || 0) > 0
      );
    });
  }, [inventoryBatches, statusLogItem]);

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
      style={{ flex: 1, minWidth: 0, maxWidth: "100%", overflowX: "hidden" }}
    >
      <PageHeader
        title="INVENTORY ITEMS MANAGEMENT"
      />

      <div style={inventoryPageStyles.pageTopActions}>
        <InventoryPageActions
          exportingFormat={exportingFormat}
          onOpenScanModal={handleOpenScanModal}
          onOpenCreateModal={handleOpenCreateModal}
          onOpenExportModal={handleOpenExportModal}
          showExport={false}
        />
      </div>

      <div style={inventoryPageStyles.overviewSection}>
        <InventoryOverviewCards summaryCards={summaryCards} />
      </div>

      <div style={inventoryPageStyles.managementToolbar}>
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

      <section style={shellStyles.card}>
        <h3 style={inventoryPageStyles.sectionTitle}>
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
        inventoryItems={inventoryItemsWithSyncStatus}
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
        matchedItemName={matchedScannedItem?.item_name || ""}
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
