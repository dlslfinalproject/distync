import React, { useEffect, useMemo, useState } from "react";
import PageHeader, {
  pageHeaderStyles,
} from "../../components/layout/PageHeader";
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
import {
  FiFileText,
  FiFilter,
  FiPackage,
  FiPlus,
} from "react-icons/fi";
import { MdQrCodeScanner } from "react-icons/md";

/* ================= STYLES ================= */

const COLORS = {
  primary: "#17324d",
  secondary: "#334155",
  muted: "#6b8298",
  border: "#d6e2ef",
  borderSoft: "#e7edf5",
  bgSoft: "#f8fbff",
  bgHeader: "#f1f6fb",
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

const primaryModalBtn = {
  border: "none",
  borderRadius: "999px",
  padding: "12px 24px",
  background: "#3d4f78",
  color: "#fff",
  fontSize: "15px",
  fontWeight: 600,
  cursor: "pointer",
  minWidth: "120px",
  transition: "all 0.2s ease",
};

const secondaryModalBtn = {
  border: "none",
  borderRadius: "999px",
  padding: "12px 24px",
  background: "#d9d9d9",
  color: "#3f4d63",
  fontSize: "15px",
  fontWeight: 500,
  cursor: "pointer",
  minWidth: "120px",
  transition: "all 0.2s ease",
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
  Active: {
    backgroundColor: "#e0f2fe",
    color: "#075985",
  },
  Inactive: {
    backgroundColor: "#fee2e2",
    color: "#b91c1c",
  },
  Expiring: {
    backgroundColor: "#ede9fe",
    color: "#6d28d9",
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

  filterBtn: {
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

  actionIconBtn: {
    border: "none",
    background: "transparent",
    color: COLORS.primary,
    fontSize: "17px",
    cursor: "pointer",
    padding: 0,
    lineHeight: 1,
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

/* ================= HELPERS ================= */

const getUniqueCategories = (rows) =>
  [...new Set(rows.map((r) => r.category).filter(Boolean))].sort();

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

const getItemStatus = (item) => {
  if (!item.is_active) {
    return "Inactive";
  }

  if (isItemExpiring(item)) {
    return "Expiring";
  }

  return "Active";
};

const getItemStatusStyle = (status) => {
  if (status === "Inactive") {
    return {
      background: "#fee2e2",
      color: "#b91c1c",
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

const filterInventoryItemsByStatus = (items, selectedStatus) => {
  if (selectedStatus === "All") {
    return items;
  }

  if (selectedStatus === "Active") {
    return items.filter((item) => item.is_active && !isItemExpiring(item));
  }

  if (selectedStatus === "Inactive") {
    return items.filter((item) => !item.is_active);
  }

  if (selectedStatus === "Expiring") {
    return items.filter((item) => item.is_active && isItemExpiring(item));
  }

  return items;
};

const ExportNoticeModal = ({ isOpen, message, onClose }) => {
  if (!isOpen) {
    return null;
  }

  return (
    <div style={noticeModalStyles.overlay}>
      <div style={noticeModalStyles.modal}>
        <h3 style={noticeModalStyles.title}>Export Unavailable</h3>
        <p style={noticeModalStyles.message}>{message}</p>

        <div style={noticeModalStyles.actions}>
          <button
            type="button"
            onClick={onClose}
            style={pageHeaderStyles.primaryButton}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
};

/* ================= COMPONENT ================= */

const InventoryItemsPage = () => {
  const [filters, setFilters] = useState({
    search: "",
    category: "All",
    status: "All",
    warehouse: "",
  });

  const [activeTab, setActiveTab] = useState("overview");

  const [inventoryItems, setInventoryItems] = useState([]);
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

  /* ================= DATA LOADING ================= */

  const loadInventoryItems = async (activeFilters = filters) => {
    setIsLoading(true);
    setErrorMessage("");
    try {
      const res = await fetchInventoryItems(
        buildInventoryItemFilters(activeFilters),
      );
      setInventoryItems(res || []);
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadInventoryItems(filters);
  }, [filters]);

  const categories = useMemo(
    () => getUniqueCategories(inventoryItems),
    [inventoryItems]
  );

  const inventoryAnalytics = useMemo(() => {
    const totalItems = inventoryItems.length;
    const activeItems = inventoryItems.filter((item) => item.is_active).length;
    const inactiveItems = totalItems - activeItems;
    const perishableItems = inventoryItems.filter(
      (item) => item.is_perishable
    ).length;
    const nonPerishableItems = totalItems - perishableItems;
    const trackedCategories = [
      perishableItems > 0 ? "Perishable" : null,
      nonPerishableItems > 0 ? "Non-Perishable" : null,
    ].filter(Boolean).length;

    return {
      totalItems,
      activeItems,
      inactiveItems,
      perishableItems,
      nonPerishableItems,
      trackedCategories,
      perishableShare: formatPercentage(perishableItems, totalItems),
      nonPerishableShare: formatPercentage(nonPerishableItems, totalItems),
    };
  }, [inventoryItems]);

  const summaryCards = useMemo(
    () => [
      {
        label: "Total Registered Items",
        value: inventoryAnalytics.totalItems,
        description:
          "All inventory item records currently registered in the system.",
        accentColor: "#2f6499",
      },
      {
        label: "Perishable Goods",
        value: inventoryAnalytics.perishableItems,
        description:
          "Items that need closer monitoring because they are time-sensitive or spoilable.",
        accentColor: "#c9792b",
      },
      {
        label: "Non-Perishable Goods",
        value: inventoryAnalytics.nonPerishableItems,
        description:
          "Items intended for longer storage and more stable stock availability.",
        accentColor: "#2d7a4f",
      },
    ],
    [inventoryAnalytics]
  );

  const visibleInventoryItems = useMemo(
    () => filterInventoryItemsByStatus(inventoryItems, filters.status),
    [inventoryItems, filters.status],
  );

  /* ================= FILTERS ================= */

  const handleFilterChange = (name, value) => {
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  /* ================= MODAL ================= */

  const handleOpenCreateModal = () => {
    setModalErrorMessage("");
    setIsModalOpen(true);
  };

  const handleOpenEditModal = () => {};

  const handleSubmitModal = async (payload) => {
    setIsSubmitting(true);
    setModalErrorMessage("");

    try {
      await createInventoryItem(payload);
      await loadInventoryItems();
      setIsModalOpen(false);
    } catch (err) {
      setModalErrorMessage(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ================= SCAN ITEM MODAL ================= */

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
    setScanForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmitScanModal = () => {
    console.log("Scan item submitted:", scanForm);
    setIsScanModalOpen(false);
  };

  /* ================= EXPORT ================= */

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

  /* ================= UI ================= */

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
            onClick={(e) => {
              e.stopPropagation();
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

        {/* TABS */}
        <div style={styles.tabContainer}>
          {["overview", "analytics"].map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              style={tabButtonStyles(activeTab === tab)}
            >
              {tab === "overview"
                ? "Stock Overview"
                : "Inventory Analytics"}
            </button>
          ))}
        </div>

        {/* TITLE */}
        <h3 style={styles.sectionTitle}>
          {activeTab === "overview" ? "CURRENT STOCK" : "INVENTORY ANALYTICS"}
        </h3>

        {/* FILTERS */}
        {activeTab === "overview" && (
          <>
            <div style={styles.filterRow}>
              <div style={{ flex: 1 }}>
                <SearchBar
                  value={filters.search}
                  onChange={(v) => handleFilterChange("search", v)}
                  placeholder="Search item..."
                />
              </div>
              <button type="button" style={styles.filterBtn}>
                <FiFilter size={16} />
                Filter
              </button>
            </div>

            <div style={styles.inlineFilters}>
              <span>Category:</span>
              <div style={chipGroupStyle}>
                {["All", "Perishable", "Non-Perishable"].map((cat) => (
                  <button
                    key={cat}
                    style={getChipStyle(cat, filters.category === cat)}
                    onClick={() => handleFilterChange("category", cat)}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <span>Status:</span>
              <div style={chipGroupStyle}>
                {["All", "Active", "Expiring"].map((stat) => (
                  <button
                    key={stat}
                    style={getChipStyle(stat, filters.status === stat)}
                    onClick={() => handleFilterChange("status", stat)}
                  >
                    {stat}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* CONTENT */}
        {activeTab === "overview" ? (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  {[
                    "Item Name",
                    "Category",
                    "Quantity",
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
                    <td colSpan="5" style={styles.emptyStateCell}>
                      Loading...
                    </td>
                  </tr>
                ) : errorMessage ? (
                  <tr>
                    <td
                      colSpan="5"
                      style={{ ...styles.emptyStateCell, color: "#b91c1c" }}
                    >
                      {errorMessage}
                    </td>
                  </tr>
                ) : visibleInventoryItems.length === 0 ? (
                  <tr>
                    <td colSpan="5" style={styles.emptyStateCell}>
                      No items found
                    </td>
                  </tr>
                ) : (
                  visibleInventoryItems.map((item, index) => {
                    const itemStatus = getItemStatus(item);
                    const itemStatusStyle = getItemStatusStyle(itemStatus);

                    return (
                      <tr key={item.id || index} style={styles.tr}>
                      <td style={styles.td}>{item.item_name || item.name}</td>
                      <td style={styles.td}>{item.category}</td>
                      <td style={styles.td}>{formatItemQuantity(item)}</td>
                      <td style={styles.td}>
                        {item.expiration_date
                          ? new Date(item.expiration_date).toLocaleDateString()
                          : "--"}
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

                      <td style={{ display: "none" }}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "10px",
                          }}
                        >
                          <button
                            style={styles.actionIconBtn}
                            onClick={() => handleOpenEditModal(item.id)}
                            title="Edit"
                          >
                            ✎
                          </button>
                          <button
                            style={styles.actionIconBtn}
                            title="Delete"
                          >
                            🗑
                          </button>
                        </div>
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
                title: "Perishable Goods",
                value: inventoryAnalytics.perishableItems,
                detail: `${inventoryAnalytics.perishableShare} of all registered items are marked as perishable.`,
              },
              {
                title: "Non-Perishable Goods",
                value: inventoryAnalytics.nonPerishableItems,
                detail: `${inventoryAnalytics.nonPerishableShare} of all registered items are marked as non-perishable.`,
              },
              {
                title: "Active Item Records",
                value: inventoryAnalytics.activeItems,
                detail: "Items currently available for use in the inventory masterlist.",
              },
              {
                title: "Inactive Item Records",
                value: inventoryAnalytics.inactiveItems,
                detail: "Items kept in the masterlist but currently marked inactive.",
              },
              {
                title: "Goods Categories Tracked",
                value: inventoryAnalytics.trackedCategories,
                detail: "The system currently tracks perishable and non-perishable goods only.",
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

      {/* EXISTING ITEM FORM MODAL - KEPT INTACT */}
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
