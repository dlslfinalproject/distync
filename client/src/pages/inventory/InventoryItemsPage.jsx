import React, { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import PageHeader, { pageHeaderStyles } from "../../components/layout/PageHeader";
import { shellStyles } from "../../components/layout/BarangayLayout";
import SearchBar from "../../components/shared/SearchBar";
import InventoryItemFormModal from "../../components/inventory-items/InventoryItemFormModal";
import InventoryItemScanModal from "../../components/inventory-items/InventoryItemScanModal";
import StatusCard from "../../components/shared/StatusCard";
import SyncStatusBadge from "../../components/shared/SyncStatusBadge";
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
import { buildSyncDescriptor, findSyncEntry } from "../../offline/syncStatus";
import { subscribeToSyncUpdates } from "../../offline/syncService";

const COLORS = {
  primary: "#17324d",
  secondary: "#334155",
  muted: "#6b8298",
  border: "#d6e2ef",
  borderSoft: "#e7edf5",
  bgSoft: "#f8fbff",
  chipBg: "#d7dee9",
};

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
  background: COLORS.bgSoft,
  border: `1px solid ${COLORS.border}`,
  borderRadius: "14px",
  padding: "16px",
};

const chipGroupStyle = {
  display: "flex",
  background: COLORS.chipBg,
  borderRadius: "7px",
  padding: "2px",
  gap: "1px",
  flexWrap: "wrap",
};

const noticeModalStyles = {
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
    maxWidth: "440px",
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
  },
};

const exportModalStyles = {
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
    maxWidth: "480px",
    backgroundColor: "#ffffff",
    borderRadius: "20px",
    padding: "28px",
    boxShadow: "0 24px 48px rgba(20, 48, 78, 0.2)",
  },
  title: {
    margin: 0,
    color: "#17324d",
    fontSize: "24px",
  },
  description: {
    margin: "12px 0 0",
    color: "#5d7188",
    fontSize: "14px",
    lineHeight: 1.6,
  },
  fieldGroup: {
    display: "grid",
    gap: "18px",
    marginTop: "22px",
  },
  label: {
    display: "block",
    marginBottom: "8px",
    color: "#4f677f",
    fontSize: "13px",
    fontWeight: 700,
  },
  select: {
    width: "100%",
    minHeight: "48px",
    padding: "12px 14px",
    borderRadius: "14px",
    border: "1px solid #d2deea",
    boxSizing: "border-box",
    fontSize: "14px",
    color: "#21405f",
    backgroundColor: "#ffffff",
    outline: "none",
  },
  actions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "12px",
    marginTop: "24px",
    flexWrap: "wrap",
  },
};

const activeChipPalette = {
  All: {
    backgroundColor: COLORS.primary,
    color: "#ffffff",
  },
  Perishable: {
    backgroundColor: "#fef3c7",
    color: "#92400e",
  },
  "Non-Perishable": {
    backgroundColor: "#e6f5ec",
    color: "#2d7a4f",
  },
  Available: {
    backgroundColor: "#e0f2fe",
    color: "#075985",
  },
  Distributed: {
    backgroundColor: "#dbeafe",
    color: "#1d4ed8",
  },
  Expired: {
    backgroundColor: "#fee2e2",
    color: "#b91c1c",
  },
  Expiring: {
    backgroundColor: "#ede9fe",
    color: "#6d28d9",
  },
  Inactive: {
    backgroundColor: "#f1f5f9",
    color: "#475569",
  },
};

const getChipStyle = (label, isActive) => {
  const activePalette = activeChipPalette[label] || activeChipPalette.All;

  return {
    border: "none",
    borderRadius: "6px",
    padding: "3px 10px",
    fontSize: "11px",
    fontWeight: 600,
    cursor: "pointer",
    backgroundColor: isActive
      ? activePalette.backgroundColor
      : "transparent",
    color: isActive ? activePalette.color : COLORS.muted,
    transition: "all 0.2s",
    lineHeight: 1.2,
  };
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
  filterRow: {
    display: "flex",
    gap: "12px",
    alignItems: "center",
    marginBottom: "8px",
    flexWrap: "wrap",
  },
  inlineFilters: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    marginTop: "2px",
    flexWrap: "wrap",
    color: COLORS.primary,
    fontSize: "13px",
    fontWeight: 600,
    marginBottom: "16px",
  },
  tableWrap: {
    marginTop: "10px",
    overflowX: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    background: "transparent",
  },
  th: {
    textAlign: "left",
    padding: "10px 8px",
    fontSize: "13px",
    color: COLORS.primary,
    fontWeight: 700,
    borderBottom: "none",
    whiteSpace: "nowrap",
  },
  tr: {
    borderBottom: `1px solid ${COLORS.borderSoft}`,
  },
  td: {
    padding: "10px 8px",
    fontSize: "13px",
    color: COLORS.secondary,
    verticalAlign: "middle",
  },
  emptyStateCell: {
    padding: "16px 8px",
    fontSize: "14px",
    color: COLORS.secondary,
  },
  exportMenu: {
    position: "absolute",
    right: 0,
    top: "52px",
    background: "#fff",
    borderRadius: "10px",
    boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
    padding: "8px",
    minWidth: "170px",
    zIndex: 20,
  },
  exportMenuButton: {
    width: "100%",
    border: "none",
    background: "transparent",
    textAlign: "left",
    padding: "8px",
    cursor: "pointer",
    color: "#1f3b57",
    fontSize: "14px",
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

const inventoryExportReportOptions = [
  { value: "INVENTORY_ITEMS", label: "Inventory Items" },
  { value: "LOW_STOCK", label: "Low Stock" },
  { value: "NEAR_EXPIRY", label: "Near Expiry" },
  { value: "EXPIRED", label: "Expired Items" },
  { value: "INCIDENT_LOSS", label: "Inventory Loss" },
];

const inventoryExportFormatOptions = [
  { value: "csv", label: "CSV" },
  { value: "excel", label: "Excel" },
  { value: "pdf", label: "PDF" },
];

const forecastModelOptions = [
  {
    value: "MOVING_AVERAGE",
    label: "Moving Average",
    description: "Recommended default model for regular stock planning.",
  },
  {
    value: "EXPONENTIAL_SMOOTHING",
    label: "Exponential Smoothing",
    description: "Gives more weight to recent distribution activity.",
  },
  {
    value: "TREND_PROJECTION",
    label: "Trend Projection",
    description: "Uses historical trend direction to project demand.",
  },
];

const NO_EXPORT_DATA_MESSAGE = "No available data to export.";

const getForecastModelLabel = (modelName) => {
  return (
    forecastModelOptions.find((option) => option.value === modelName)?.label ||
    "Moving Average"
  );
};

const buildInventoryExportFilters = (selectedReportType) => {
  if (selectedReportType === "LOW_STOCK") {
    return { report_type: "LOW_STOCK" };
  }

  if (selectedReportType === "NEAR_EXPIRY") {
    return { report_type: "NEAR_EXPIRY", near_expiry_days: 14 };
  }

  if (selectedReportType === "EXPIRED") {
    return { report_type: "EXPIRED" };
  }

  if (selectedReportType === "INCIDENT_LOSS") {
    return { report_type: "INCIDENT_LOSS" };
  }

  return {};
};

const hasInventoryExportRows = ({
  reportType,
  visibleInventoryItems,
  inventoryBatches,
  inventoryTrackingMap,
}) => {
  if (reportType === "INVENTORY_ITEMS") {
    return visibleInventoryItems.length > 0;
  }

  if (reportType === "LOW_STOCK") {
    return inventoryBatches.some((batch) => batch.status === "LOW_STOCK");
  }

  if (reportType === "NEAR_EXPIRY") {
    return inventoryBatches.some((batch) => isItemExpiring(batch));
  }

  if (reportType === "EXPIRED") {
    return inventoryBatches.some((batch) => batch.status === "EXPIRED");
  }

  if (reportType === "INCIDENT_LOSS") {
    return visibleInventoryItems.some((item) => {
      const trackingStats =
        inventoryTrackingMap.get(item.id) || createEmptyTrackingStats();

      return (
        trackingStats.damaged > 0 ||
        trackingStats.missing > 0 ||
        trackingStats.spoiled > 0 ||
        trackingStats.stolen > 0
      );
    });
  }

  return false;
};

const buildQueuedInventoryItem = (entry) => {
  return {
    id: entry.entityLocalId || entry.id,
    item_name: entry.payload?.item_name || "Pending inventory item",
    category: entry.payload?.category || "--",
    quantity: entry.payload?.quantity || 0,
    packaging_count: entry.payload?.packaging_count || 0,
    unit_of_measure: entry.payload?.unit_of_measure || "--",
    unit_of_measure_value: entry.payload?.unit_of_measure_value || 1,
    expiration_date: entry.payload?.expiration_date || null,
    is_active: true,
    is_perishable: Boolean(entry.payload?.is_perishable),
    is_local_only: true,
    sync_status: entry.status,
  };
};

/* ================= HELPERS ================= */

const getUniqueCategories = (rows) =>
  [...new Set(rows.map((r) => r.category).filter(Boolean))].sort();

const formatNumericValue = (value) => {
  if (!Number.isFinite(value)) {
    return "--";
  }

  if (Number.isInteger(value)) {
    return value.toLocaleString();
  }

  return value.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
};

const formatUnitOfMeasurement = (item) => {
  const unitOfMeasureValue = Number(item.unit_of_measure_value || 0);

  if (
    Number.isFinite(unitOfMeasureValue) &&
    unitOfMeasureValue > 0 &&
    item.unit_of_measure
  ) {
    return `${formatNumericValue(unitOfMeasureValue)} ${item.unit_of_measure}`;
  }

  return item.unit_of_measure || "--";
};

const formatPercentage = (value, total) => {
  if (!total) {
    return "0%";
  }

  return `${Math.round((value / total) * 100)}%`;
};

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

const getTotalItemQuantity = (item) => {
  const packagingCount = Number(item.packaging_count || 0);
  const quantityPerPackaging = Number(item.quantity || 0);
  const unitOfMeasureValue = Number(item.unit_of_measure_value || 1);
  const normalizedPackagingCount =
    Number.isFinite(packagingCount) && packagingCount > 0 ? packagingCount : 0;
  const normalizedQuantityPerPackaging =
    Number.isFinite(quantityPerPackaging) && quantityPerPackaging > 0
      ? quantityPerPackaging
      : 0;
  const normalizedUnitOfMeasureValue =
    Number.isFinite(unitOfMeasureValue) && unitOfMeasureValue > 0
      ? unitOfMeasureValue
      : 1;
  const totalQuantity =
    normalizedPackagingCount *
    normalizedQuantityPerPackaging *
    normalizedUnitOfMeasureValue;

  return formatNumericValue(totalQuantity);
};

const isItemExpiring = (item) => {
  if (!item.expiration_date) {
    return false;
  }

  const today = new Date();
  const comparisonDate = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  const expirationDate = new Date(`${item.expiration_date}T00:00:00`);

  if (Number.isNaN(expirationDate.getTime())) {
    return false;
  }

  const millisecondsUntilExpiration =
    expirationDate.getTime() - comparisonDate.getTime();
  const daysUntilExpiration = millisecondsUntilExpiration / (1000 * 60 * 60 * 24);

  return daysUntilExpiration >= 0 && daysUntilExpiration <= 30;
};

const isDateExpired = (dateValue) => {
  if (!dateValue) {
    return false;
  }

  const today = new Date();
  const comparisonDate = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  const targetDate = new Date(`${dateValue}T00:00:00`);

  if (Number.isNaN(targetDate.getTime())) {
    return false;
  }

  return targetDate < comparisonDate;
};

const formatDisplayDate = (value) => {
  if (!value) {
    return "--";
  }

  const parsedDate = new Date(`${value}T00:00:00`);

  if (Number.isNaN(parsedDate.getTime())) {
    return "--";
  }

  return parsedDate.toLocaleDateString();
};

const normalizeQuantity = (value) => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
};

const getEarlierDate = (currentDate, nextDate) => {
  if (!currentDate) {
    return nextDate;
  }

  if (!nextDate) {
    return currentDate;
  }

  return new Date(`${nextDate}T00:00:00`) < new Date(`${currentDate}T00:00:00`)
    ? nextDate
    : currentDate;
};

const createEmptyTrackingStats = () => ({
  totalReceived: 0,
  onHand: 0,
  distributed: 0,
  expired: 0,
  expiredOnHand: 0,
  damaged: 0,
  missing: 0,
  spoiled: 0,
  stolen: 0,
  nearestExpirationDate: null,
  hasExpiringStock: false,
});

const buildInventoryTrackingMap = (
  inventoryItems,
  inventoryBatches,
  inventoryTransactions,
) => {
  const trackingMap = new Map(
    inventoryItems.map((item) => [item.id, createEmptyTrackingStats()]),
  );

  const ensureTrackingEntry = (itemId) => {
    if (!itemId) {
      return createEmptyTrackingStats();
    }

    if (!trackingMap.has(itemId)) {
      trackingMap.set(itemId, createEmptyTrackingStats());
    }

    return trackingMap.get(itemId);
  };

  inventoryBatches.forEach((batch) => {
    const itemId = batch.inventory_item?.id || batch.inventory_item_id;
    const tracking = ensureTrackingEntry(itemId);

    tracking.totalReceived += normalizeQuantity(batch.quantity_received);
    tracking.onHand += normalizeQuantity(batch.quantity_available);

    if (batch.expiration_date) {
      tracking.nearestExpirationDate = getEarlierDate(
        tracking.nearestExpirationDate,
        batch.expiration_date,
      );

      if (isItemExpiring({ expiration_date: batch.expiration_date })) {
        tracking.hasExpiringStock = true;
      }

      if (isDateExpired(batch.expiration_date)) {
        tracking.expiredOnHand += normalizeQuantity(batch.quantity_available);
      }
    }
  });

  inventoryTransactions.forEach((transaction) => {
    const itemId = transaction.inventory_item?.id || transaction.inventory_item_id;
    const tracking = ensureTrackingEntry(itemId);

    if (
      transaction.transaction_type === "OUTFLOW" &&
      transaction.reference_type === "DISTRIBUTION"
    ) {
      tracking.distributed += normalizeQuantity(transaction.quantity);
    }

    if (transaction.transaction_type === "EXPIRED") {
      tracking.expired += normalizeQuantity(transaction.quantity);
    }

    if (transaction.transaction_type === "DAMAGED") {
      tracking.damaged += normalizeQuantity(transaction.quantity);
    }

    if (transaction.transaction_type === "MISSING") {
      tracking.missing += normalizeQuantity(transaction.quantity);
    }

    if (transaction.transaction_type === "SPOILED") {
      tracking.spoiled += normalizeQuantity(transaction.quantity);
    }

    if (transaction.transaction_type === "STOLEN") {
      tracking.stolen += normalizeQuantity(transaction.quantity);
    }
  });

  return trackingMap;
};

const getTrackedExpirationDate = (item, trackingStats) => {
  return getEarlierDate(
    item.expiration_date || null,
    trackingStats.nearestExpirationDate,
  );
};

const getItemStatus = (item, trackingStats) => {
  const trackedExpirationDate = getTrackedExpirationDate(item, trackingStats);

  if (!item.is_active) {
    return "Inactive";
  }

  if (trackingStats.expiredOnHand > 0 || isDateExpired(trackedExpirationDate)) {
    return "Expired";
  }

  if (
    trackingStats.distributed > 0 &&
    trackingStats.onHand === 0 &&
    trackingStats.totalReceived > 0
  ) {
    return "Distributed";
  }

  if (trackingStats.hasExpiringStock || isItemExpiring(item)) {
    return "Expiring";
  }

  return "Available";
};

const getItemStatusStyle = (status) => {
  if (status === "Distributed") {
    return {
      background: "#dbeafe",
      color: "#1d4ed8",
    };
  }

  if (status === "Expired") {
    return {
      background: "#fee2e2",
      color: "#b91c1c",
    };
  }

  if (status === "Inactive") {
    return {
      background: "#f1f5f9",
      color: "#475569",
    };
  }

  if (status === "Expiring") {
    return {
      background: "#ede9fe",
      color: "#6d28d9",
    };
  }

  return {
    background: "#e0f2fe",
    color: "#075985",
  };
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

  const inventoryItemsWithSyncStatus = useMemo(() => {
    const syncedItems = inventoryItems.map((item) => {
      const matchingEntry = findSyncEntry(syncQueueEntries, (entry) => {
        if (entry.moduleName !== "mayor-inventory") {
          return false;
        }

        return (
          entry.entityType === "INVENTORY_ITEM" &&
          (entry.entityServerId === item.id || entry.entityLocalId === item.id)
        );
      });

      return {
        ...item,
        sync_status: buildSyncDescriptor(matchingEntry).status,
        is_local_only: false,
      };
    });

    const optimisticItems = syncQueueEntries
      .filter((entry) => {
        return (
          entry.moduleName === "mayor-inventory" &&
          entry.actionKey === "INVENTORY_ITEM_CREATE" &&
          !syncedItems.some(
            (item) =>
              item.id === entry.entityServerId || item.id === entry.entityLocalId,
          )
        );
      })
      .map(buildQueuedInventoryItem);

    return [...optimisticItems, ...syncedItems];
  }, [inventoryItems, syncQueueEntries]);

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
    const perishableItems = inventoryItemsWithSyncStatus.filter((item) => item.is_perishable).length;
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
        <button style={primaryTopBtn} onClick={handleOpenScanModal}>
          <MdQrCodeScanner size={16} />
          Scan Item
        </button>

        <button style={primaryTopBtn} onClick={handleOpenCreateModal}>
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

      <section style={{ ...shellStyles.statGrid, marginBottom: "16px" }}>
        {summaryCards.map((card) => (
          <StatusCard key={card.label} {...card} />
        ))}
      </section>

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

        {activeTab === "overview" && (
          <>
            <div style={styles.filterRow}>
              <div style={{ flex: 1 }}>
                <SearchBar
                  value={filters.search}
                  onChange={(value) => handleFilterChange("search", value)}
                  placeholder="Search item name or code"
                />
              </div>
            </div>

            <div style={styles.inlineFilters}>
              <span>Category:</span>
              <div style={chipGroupStyle}>
                {["All", "Perishable", "Non-Perishable"].map((category) => (
                  <button
                    key={category}
                    style={getChipStyle(category, filters.category === category)}
                    onClick={() => handleFilterChange("category", category)}
                  >
                    {category}
                  </button>
                ))}
              </div>

              <span>Status:</span>
              <div style={chipGroupStyle}>
                {[
                  "All",
                  "Available",
                  "Distributed",
                  "Expired",
                  "Expiring",
                  "Inactive",
                ].map((status) => (
                  <button
                    key={status}
                    style={getChipStyle(status, filters.status === status)}
                    onClick={() => handleFilterChange("status", status)}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {activeTab === "overview" ? (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  {[
                    "Item Name",
                    "Category",
                    "Quantity",
                    "Unit of Measurement",
                    "Expiry Date",
                    "Status",
                    "Sync",
                  ].map((header) => (
                    <th key={header} style={styles.th}>
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan="7" style={styles.emptyStateCell}>
                      Loading...
                    </td>
                  </tr>
                ) : errorMessage ? (
                  <tr>
                    <td
                      colSpan="7"
                      style={{ ...styles.emptyStateCell, color: "#b91c1c" }}
                    >
                      {errorMessage}
                    </td>
                  </tr>
                ) : visibleInventoryItems.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={styles.emptyStateCell}>
                      No items found
                    </td>
                  </tr>
                ) : (
                  visibleInventoryItems.map((item, index) => {
                    const trackingStats =
                      inventoryTrackingMap.get(item.id) || createEmptyTrackingStats();

                    const itemStatus = getItemStatus(item, trackingStats);
                    const itemStatusStyle = getItemStatusStyle(itemStatus);

                    // ✅ SAFE FIELD NORMALIZATION (FIX FOR BLANK CELLS)
                    const itemName =
                      item.item_name ??
                      item.name ??
                      item.product_name ??
                      "Unnamed Item";

                    const category = item.category ?? "--";

                    const quantity = getTotalItemQuantity(item) ?? "0";

                    const unit = formatUnitOfMeasurement(item) ?? "--";

                    const expiry = item.expiration_date
                      ? new Date(item.expiration_date).toLocaleDateString()
                      : "--";

                    return (
                      <tr key={item.id || index} style={styles.tr}>
                        <td style={styles.td}>{itemName}</td>

                        <td style={styles.td}>{category}</td>

                        <td style={styles.td}>{quantity}</td>

                        <td style={styles.td}>{unit}</td>

                        <td style={styles.td}>{expiry}</td>

                        <td style={styles.td}>
                          <span
                            style={{
                              padding: "4px 10px",
                              borderRadius: "8px",
                              fontSize: "12px",
                              fontWeight: 600,
                              background: itemStatusStyle.background,
                              color: itemStatusStyle.color,
                            }}
                          >
                            {itemStatus}
                          </span>
                        </td>
                        <td style={styles.td}>
                          <SyncStatusBadge status={item.sync_status} compact />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
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
                    color: COLORS.primary,
                    fontSize: "16px",
                    fontWeight: 700,
                  }}
                >
                  {card.title}
                </h4>
                <p
                  style={{
                    margin: "0 0 12px",
                    color: COLORS.primary,
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
                    color: COLORS.muted,
                    fontSize: "14px",
                  }}
                >
                  {card.detail}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: "grid", gap: "18px" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: "16px",
              }}
            >
              <div>
                <label style={exportModalStyles.label}>Disaster Event</label>
                <select
                  value={selectedForecastEventId}
                  onChange={(event) => setSelectedForecastEventId(event.target.value)}
                  style={exportModalStyles.select}
                >
                  {forecastEvents.length === 0 ? (
                    <option value="">No disaster events available</option>
                  ) : (
                    forecastEvents.map((event) => (
                      <option key={event.id} value={event.id}>
                        {event.event_code} - {event.title}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div>
                <label style={exportModalStyles.label}>Forecast Model</label>
                <select
                  value={selectedForecastModel}
                  onChange={(event) => setSelectedForecastModel(event.target.value)}
                  style={exportModalStyles.select}
                >
                  {forecastModelOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <p
                  style={{
                    margin: "8px 0 0",
                    color: "#5d7188",
                    fontSize: "13px",
                    lineHeight: 1.5,
                  }}
                >
                  {
                    forecastModelOptions.find(
                      (option) => option.value === selectedForecastModel,
                    )?.description
                  }
                </p>
              </div>

              <div style={{ display: "flex", alignItems: "flex-end" }}>
                <button
                  type="button"
                  onClick={handleRunForecast}
                  disabled={isRunningForecast || !selectedForecastEventId}
                  style={{
                    ...pageHeaderStyles.primaryButton,
                    opacity: isRunningForecast || !selectedForecastEventId ? 0.7 : 1,
                    width: "100%",
                  }}
                >
                  {isRunningForecast ? "Running Forecast..." : "Run Forecast"}
                </button>
              </div>
            </div>

            <div
              style={{
                borderRadius: "16px",
                border: "1px solid #d6e2ef",
                backgroundColor: "#f8fbff",
                padding: "16px 18px",
              }}
            >
              <p
                style={{
                  margin: 0,
                  color: "#17324d",
                  fontSize: "14px",
                  fontWeight: 700,
                }}
              >
                Recommended Default Model: Moving Average
              </p>
              <p
                style={{
                  margin: "8px 0 0",
                  color: "#5d7188",
                  fontSize: "13px",
                  lineHeight: 1.6,
                }}
              >
                Moving Average is selected by default to give the Mayor&apos;s Office a
                stable baseline forecast using recent distribution demand.
              </p>
            </div>

            {forecastSuccessMessage ? (
              <div
                style={{
                  padding: "14px 16px",
                  borderRadius: "14px",
                  backgroundColor: "#edf8f1",
                  color: "#1f6b46",
                  fontSize: "14px",
                  fontWeight: 600,
                }}
              >
                {forecastSuccessMessage}
              </div>
            ) : null}

            {forecastErrorMessage ? (
              <div
                style={{
                  padding: "14px 16px",
                  borderRadius: "14px",
                  backgroundColor: "#fff3f1",
                  color: "#a14538",
                  fontSize: "14px",
                  fontWeight: 600,
                }}
              >
                {forecastErrorMessage}
              </div>
            ) : null}

            <div style={{ ...styles.tableWrap, marginTop: 0 }}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    {[
                      "Item Name",
                      "Current Stock",
                      "Selected Model",
                      "Average Daily Usage",
                      "Forecasted Usage",
                      "Projected Depletion Date",
                      "Recommended Reorder Quantity",
                      "Risk Level",
                    ].map((header) => (
                      <th key={header} style={styles.th}>
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {isForecastLoading ? (
                    <tr>
                      <td colSpan="8" style={styles.emptyStateCell}>
                        Loading latest forecast...
                      </td>
                    </tr>
                  ) : !forecastRunData || forecastRunData.results.length === 0 ? (
                    <tr>
                      <td colSpan="8" style={styles.emptyStateCell}>
                        No saved forecast results are available yet for the selected
                        disaster event.
                      </td>
                    </tr>
                  ) : (
                    forecastRunData.results.map((result) => (
                      <tr key={result.inventory_item_id} style={styles.tr}>
                        <td style={styles.td}>{result.item_name}</td>
                        <td style={styles.td}>{result.current_available_stock}</td>
                        <td style={styles.td}>
                          {getForecastModelLabel(result.selected_model)}
                        </td>
                        <td style={styles.td}>{result.average_daily_usage}</td>
                        <td style={styles.td}>{result.forecasted_usage}</td>
                        <td style={styles.td}>
                          {result.projected_depletion_date
                            ? new Date(
                                `${result.projected_depletion_date}T00:00:00`,
                              ).toLocaleDateString()
                            : "--"}
                        </td>
                        <td style={styles.td}>
                          {result.recommended_reorder_quantity}
                        </td>
                        <td style={styles.td}>
                          <span
                            style={{
                              padding: "4px 10px",
                              borderRadius: "8px",
                              fontSize: "12px",
                              fontWeight: 600,
                              backgroundColor:
                                result.risk_level === "CRITICAL"
                                  ? "#fee2e2"
                                  : result.risk_level === "HIGH"
                                    ? "#fef3c7"
                                    : result.risk_level === "MEDIUM"
                                      ? "#ede9fe"
                                      : "#e0f2fe",
                              color:
                                result.risk_level === "CRITICAL"
                                  ? "#b91c1c"
                                  : result.risk_level === "HIGH"
                                    ? "#92400e"
                                    : result.risk_level === "MEDIUM"
                                      ? "#6d28d9"
                                      : "#075985",
                            }}
                          >
                            {result.risk_level}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
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

      <InventoryItemScanModal
        isOpen={isScanModalOpen}
        scanForm={scanForm}
        onClose={handleCloseScanModal}
        onSubmit={handleSubmitScanModal}
        onInputChange={handleScanInputChange}
      />

      {isExportModalOpen ? (
        <div style={exportModalStyles.overlay}>
          <div style={exportModalStyles.modal}>
            <h3 style={exportModalStyles.title}>Export Inventory Report</h3>
            <p style={exportModalStyles.description}>
              Choose which inventory report to export and the file format to generate.
            </p>

            {exportNoticeMessage ? (
              <div
                style={{
                  marginTop: "18px",
                  padding: "12px 14px",
                  borderRadius: "14px",
                  backgroundColor: "#fff3f1",
                  border: "1px solid #f4c9c2",
                  color: "#a14538",
                  fontSize: "0.95rem",
                  fontWeight: 600,
                }}
              >
                {exportNoticeMessage}
              </div>
            ) : null}

            <div style={exportModalStyles.fieldGroup}>
              <div>
                <label style={exportModalStyles.label}>Report Type</label>
                <select
                  value={selectedExportReportType}
                  onChange={(event) =>
                    setSelectedExportReportType(event.target.value)
                  }
                  style={exportModalStyles.select}
                >
                  {inventoryExportReportOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={exportModalStyles.label}>Format</label>
                <select
                  value={selectedExportFormat}
                  onChange={(event) => setSelectedExportFormat(event.target.value)}
                  style={exportModalStyles.select}
                >
                  {inventoryExportFormatOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div style={exportModalStyles.actions}>
              <button
                type="button"
                onClick={handleCloseExportModal}
                style={pageHeaderStyles.secondaryButton}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmitExportModal}
                style={pageHeaderStyles.primaryButton}
              >
                Export
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {!isExportModalOpen && exportNoticeMessage ? (
        <div style={noticeModalStyles.overlay}>
          <div style={noticeModalStyles.modal}>
            <h3 style={noticeModalStyles.title}>Export Unavailable</h3>
            <p style={noticeModalStyles.message}>{exportNoticeMessage}</p>
            <div style={noticeModalStyles.actions}>
              <button
                type="button"
                onClick={() => setExportNoticeMessage("")}
                style={pageHeaderStyles.primaryButton}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default InventoryItemsPage;
