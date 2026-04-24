import React, { useEffect, useMemo, useState } from "react";
import PageHeader from "../../components/layout/PageHeader";
import { shellStyles } from "../../components/layout/BarangayLayout";
import SearchBar from "../../components/shared/SearchBar";
import InventoryItemFormModal from "../../components/inventory-items/InventoryItemFormModal";
import InventoryItemScanModal from "../../components/inventory-items/InventoryItemScanModal";
import StatusCard from "../../components/shared/StatusCard";
import {
  createInventoryItem,
  exportInventoryItems,
  fetchInventoryItems,
} from "../../features/inventory-items/inventoryItemService";
import { fetchInventoryBatches } from "../../features/inventory-batches/inventoryBatchService";
import { fetchInventoryTransactions } from "../../features/inventory-transactions/inventoryTransactionService";
import {
  FiFileText,
  FiPackage,
  FiPlus,
} from "react-icons/fi";
import { MdQrCodeScanner } from "react-icons/md";

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

const formatItemQuantity = (item) => {
  const packagingPart =
    item.packaging_count && item.packaging
      ? `${item.packaging_count} ${item.packaging}${
          item.packaging_count > 1 ? "s" : ""
        }`
      : item.packaging || "--";

  const unitPart =
    item.unit_of_measure_value && item.unit_of_measure
      ? `${item.unit_of_measure_value} ${item.unit_of_measure}`
      : item.unit_of_measure || "--";

  if (item.quantity) {
    return `${packagingPart} | ${item.quantity} per packaging | ${unitPart}`;
  }

  return `${packagingPart} | ${unitPart}`;
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
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalErrorMessage, setModalErrorMessage] = useState("");
  const [isScanModalOpen, setIsScanModalOpen] = useState(false);
  const [scanForm, setScanForm] = useState({
    barcodeNumber: "",
    reorderLevel: "",
  });
  const [exportOpen, setExportOpen] = useState(false);
  const [exportingFormat, setExportingFormat] = useState("");
  const [exportNoticeMessage, setExportNoticeMessage] = useState("");

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

  const inventoryTrackingMap = useMemo(
    () =>
      buildInventoryTrackingMap(
        inventoryItems,
        inventoryBatches,
        inventoryTransactions,
      ),
    [inventoryItems, inventoryBatches, inventoryTransactions],
  );

  const inventoryAnalytics = useMemo(() => {
    const totalItems = inventoryItems.length;
    const perishableItems = inventoryItems.filter((item) => item.is_perishable).length;
    const nonPerishableItems = totalItems - perishableItems;
    const availableItems = inventoryItems.filter((item) => {
      const trackingStats =
        inventoryTrackingMap.get(item.id) || createEmptyTrackingStats();

      return trackingStats.onHand > 0;
    }).length;
    const distributedItems = inventoryItems.filter((item) => {
      const trackingStats =
        inventoryTrackingMap.get(item.id) || createEmptyTrackingStats();

      return trackingStats.distributed > 0;
    }).length;
    const expiredItems = inventoryItems.filter((item) => {
      const trackingStats =
        inventoryTrackingMap.get(item.id) || createEmptyTrackingStats();

      return (
        trackingStats.expired > 0 ||
        trackingStats.expiredOnHand > 0 ||
        isDateExpired(getTrackedExpirationDate(item, trackingStats))
      );
    }).length;
    const totalOnHand = inventoryItems.reduce((sum, item) => {
      const trackingStats =
        inventoryTrackingMap.get(item.id) || createEmptyTrackingStats();

      return sum + trackingStats.onHand;
    }, 0);
    const totalDistributed = inventoryItems.reduce((sum, item) => {
      const trackingStats =
        inventoryTrackingMap.get(item.id) || createEmptyTrackingStats();

      return sum + trackingStats.distributed;
    }, 0);
    const totalExpired = inventoryItems.reduce((sum, item) => {
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
  }, [inventoryItems, inventoryTrackingMap]);

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
      return inventoryItems;
    }

    return inventoryItems.filter((item) => {
      const trackingStats =
        inventoryTrackingMap.get(item.id) || createEmptyTrackingStats();

      return getItemStatus(item, trackingStats) === filters.status;
    });
  }, [inventoryItems, inventoryTrackingMap, filters.status]);

  const handleFilterChange = (name, value) => {
    setFilters((previousFilters) => ({
      ...previousFilters,
      [name]: value,
    }));
  };

  const handleOpenCreateModal = () => {
    setModalErrorMessage("");
    setIsModalOpen(true);
  };

  const handleSubmitModal = async (payload) => {
    setIsSubmitting(true);
    setModalErrorMessage("");

    try {
      await createInventoryItem(payload);
      await loadInventoryData();
      setIsModalOpen(false);
    } catch (error) {
      setModalErrorMessage(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenScanModal = () => {
    setScanForm({
      barcodeNumber: "",
      reorderLevel: "",
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
    console.log("Scan item submitted:", scanForm);
    setIsScanModalOpen(false);
  };

  const handleExport = async (format) => {
    if (visibleInventoryItems.length === 0) {
      setExportOpen(false);
      setExportNoticeMessage(
        "No inventory items are available to export for the current filters.",
      );
      return;
    }

    setExportingFormat(format);
    setExportOpen(false);

    try {
      const file = await exportInventoryItems({
        format,
        filters: {
          ...buildInventoryItemFilters(filters),
          status: filters.status,
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
        error.message || "Unable to export inventory items. Please try again.",
      );
    } finally {
      setExportingFormat("");
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

        <div style={{ position: "relative" }}>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setExportOpen(!exportOpen);
            }}
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

          {exportOpen && (
            <div style={styles.exportMenu}>
              {[
                { key: "csv", label: "Export as CSV" },
                { key: "pdf", label: "Export as PDF" },
                { key: "excel", label: "Export as Excel" },
              ].map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => handleExport(option.key)}
                  style={styles.exportMenuButton}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <section style={{ ...shellStyles.statGrid, marginBottom: "16px" }}>
        {summaryCards.map((card) => (
          <StatusCard key={card.label} {...card} />
        ))}
      </section>

      <section style={shellStyles.card}>
        <div style={styles.tabContainer}>
          {["overview", "analytics"].map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              style={tabButtonStyles(activeTab === tab)}
            >
              {tab === "overview" ? "Inventory List" : "Tracking Summary"}
            </button>
          ))}
        </div>

        <h3 style={styles.sectionTitle}>
          {activeTab === "overview" ? "ITEM STOCK TRACKING" : "TRACKING SUMMARY"}
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
                    "Item Details",
                    "On Hand",
                    "Distributed",
                    "Expired",
                    "Expiry Date",
                    "Status",
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
                    <td colSpan="8" style={styles.emptyStateCell}>
                      Loading...
                    </td>
                  </tr>
                ) : errorMessage ? (
                  <tr>
                    <td
                      colSpan="8"
                      style={{ ...styles.emptyStateCell, color: "#b91c1c" }}
                    >
                      {errorMessage}
                    </td>
                  </tr>
                ) : visibleInventoryItems.length === 0 ? (
                  <tr>
                    <td colSpan="8" style={styles.emptyStateCell}>
                      No items found
                    </td>
                  </tr>
                ) : (
                  visibleInventoryItems.map((item) => {
                    const trackingStats =
                      inventoryTrackingMap.get(item.id) ||
                      createEmptyTrackingStats();
                    const itemStatus = getItemStatus(item, trackingStats);
                    const itemStatusStyle = getItemStatusStyle(itemStatus);
                    const trackedExpirationDate = getTrackedExpirationDate(
                      item,
                      trackingStats,
                    );
                    const expiredQuantity =
                      trackingStats.expired + trackingStats.expiredOnHand;

                    return (
                      <tr key={item.id} style={styles.tr}>
                        <td style={styles.td}>
                          <div style={{ fontWeight: 700, color: COLORS.primary }}>
                            {item.item_name || item.name}
                          </div>
                          <div
                            style={{
                              marginTop: "4px",
                              fontSize: "12px",
                              color: COLORS.muted,
                            }}
                          >
                            {item.item_code || "No item code"}
                          </div>
                        </td>
                        <td style={styles.td}>{item.category}</td>
                        <td style={styles.td}>{formatItemQuantity(item)}</td>
                        <td style={styles.td}>{trackingStats.onHand}</td>
                        <td style={styles.td}>{trackingStats.distributed}</td>
                        <td style={styles.td}>{expiredQuantity}</td>
                        <td style={styles.td}>
                          {formatDisplayDate(trackedExpirationDate)}
                        </td>
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
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        ) : (
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
        )}
      </section>

      <InventoryItemFormModal
        isOpen={isModalOpen}
        mode="create"
        itemData={null}
        isSubmitting={isSubmitting}
        errorMessage={modalErrorMessage}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleSubmitModal}
      />

      <InventoryItemScanModal
        isOpen={isScanModalOpen}
        scanForm={scanForm}
        onClose={handleCloseScanModal}
        onSubmit={handleSubmitScanModal}
        onInputChange={handleScanInputChange}
      />

      <ExportNoticeModal
        isOpen={Boolean(exportNoticeMessage)}
        message={exportNoticeMessage}
        onClose={() => setExportNoticeMessage("")}
      />
    </div>
  );
};

export default InventoryItemsPage;
