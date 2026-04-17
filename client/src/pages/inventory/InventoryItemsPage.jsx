import React, { useEffect, useMemo, useState } from "react";
import PageHeader from "../../components/layout/PageHeader";
import { shellStyles } from "../../components/layout/BarangayLayout";
import SearchBar from "../../components/shared/SearchBar";
import InventoryItemFormModal from "../../components/inventory-items/InventoryItemFormModal";
import InventoryItemsTable from "../../components/inventory-items/InventoryItemsTable";
import {
  createInventoryItem,
  fetchInventoryItemById,
  fetchInventoryItems,
  updateInventoryItem,
} from "../../features/inventory-items/inventoryItemService";

/* ================= STYLES ================= */

const actionBtn = {
  border: "none",
  borderRadius: "12px",
  padding: "10px 16px",
  background: "#eef4fb",
  fontWeight: 600,
  color: "#334155",
  cursor: "pointer",
  transition: "all 0.2s ease",
};

const primaryModalBtn = {
  border: "none",
  borderRadius: "999px",
  padding: "12px 24px",
  background: "#3d4f78",
  color: "#fff",
  fontSize: "16px",
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
  fontSize: "16px",
  fontWeight: 500,
  cursor: "pointer",
  minWidth: "120px",
  transition: "all 0.2s ease",
};

const cardStyle = {
  background: "#f8fbff",
  border: "1px solid #dce7f3",
  borderRadius: "16px",
  padding: "16px",
};

const analyticsCard = {
  background: "#f8fbff",
  border: "1px solid #dce7f3",
  borderRadius: "16px",
  padding: "16px",
};

const chipGroupStyle = {
  display: "flex",
  background: "#cbd5e1",
  borderRadius: "8px",
  padding: "2px",
  gap: "1px",
};

const getChipStyle = (isActive) => ({
  border: "none",
  borderRadius: "6px",
  padding: "4px 12px",
  fontSize: "12px",
  fontWeight: "600",
  cursor: "pointer",
  backgroundColor: isActive ? "#334155" : "transparent",
  color: isActive ? "#fff" : "#64748b",
  transition: "all 0.2s",
});

const scanModalOverlayStyle = {
  position: "fixed",
  inset: 0,
  background: "rgba(15, 23, 42, 0.42)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "24px",
  zIndex: 1200,
};

const scanModalStyle = {
  width: "100%",
  maxWidth: "640px",
  background: "#f8fafc",
  borderRadius: "18px",
  padding: "28px 24px 18px",
  boxShadow: "0 24px 60px rgba(15, 23, 42, 0.22)",
};

const scanModalInputStyle = {
  width: "100%",
  height: "42px",
  border: "none",
  borderRadius: "10px",
  background: "#eef2f7",
  padding: "1px",
  fontSize: "15px",
  color: "#334155",
  outline: "none",
};

const scanModalLabelStyle = {
  fontSize: "14px",
  fontWeight: 700,
  color: "#334155",
  marginBottom: "8px",
};

/* ================= HELPERS ================= */

const getUniqueCategories = (rows) =>
  [...new Set(rows.map((r) => r.category).filter(Boolean))].sort();

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
  const [modalMode, setModalMode] = useState("create");
  const [selectedItemId, setSelectedItemId] = useState(null);
  const [selectedItemData, setSelectedItemData] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalErrorMessage, setModalErrorMessage] = useState("");

  const [isScanModalOpen, setIsScanModalOpen] = useState(false);
  const [scanForm, setScanForm] = useState({
    barcodeNumber: "",
    reorderLevel: "",
  });

  /* ================= DATA LOADING ================= */

  const loadInventoryItems = async (activeFilters = filters) => {
    setIsLoading(true);
    try {
      const res = await fetchInventoryItems(activeFilters);
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

  /* ================= FILTERS ================= */

  const handleFilterChange = (name, value) => {
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  /* ================= MODAL ================= */

  const handleOpenCreateModal = () => {
    setModalMode("create");
    setSelectedItemData(null);
    setSelectedItemId(null);
    setModalErrorMessage("");
    setIsModalOpen(true);
  };

  const handleOpenEditModal = async (id) => {
    setModalMode("edit");
    setIsModalOpen(true);
    setModalErrorMessage("");

    try {
      const data = await fetchInventoryItemById(id);
      setSelectedItemData(data);
      setSelectedItemId(id);
    } catch (err) {
      setModalErrorMessage(err.message);
    }
  };

  const handleSubmitModal = async (payload) => {
    setIsSubmitting(true);
    setModalErrorMessage("");

    try {
      if (modalMode === "edit") {
        await updateInventoryItem(selectedItemId, payload);
      } else {
        await createInventoryItem(payload);
      }

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
    // Placeholder submit logic for now
    console.log("Scan item submitted:", scanForm);
    setIsScanModalOpen(false);
  };

  /* ================= UI ================= */

  return (
    <>
      <PageHeader
        eyebrow="Inventory Workspace"
        title="INVENTORY ITEMS"
        description="Manage inventory items and monitor stock insights."
      />

      <section style={shellStyles.card}>
        {/* TOP ACTIONS */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "20px",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <button style={actionBtn} onClick={handleOpenScanModal}>
              Scan Item
            </button>
            <button style={actionBtn} onClick={handleOpenCreateModal}>
              Add Item
            </button>
            <button style={actionBtn}>Export Report</button>
          </div>
        </div>

        {/* SUMMARY CARDS */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "16px",
            marginBottom: "24px",
          }}
        >
          <div style={cardStyle}>
            <p style={{ margin: 0, fontSize: "13px", color: "#6b8298" }}>
              Total Items in Stock
            </p>
            <h2 style={{ margin: "8px 0" }}>{inventoryItems.length}</h2>
            <small>Across {categories.length} Categories</small>
          </div>

          <div style={cardStyle}>
            <p style={{ margin: 0, fontSize: "13px", color: "#6b8298" }}>
              Low Stock Alerts
            </p>
            <h2 style={{ margin: "8px 0" }}>5</h2>
            <small>2 critical</small>
          </div>

          <div style={cardStyle}>
            <p style={{ margin: 0, fontSize: "13px", color: "#6b8298" }}>
              Expiring Soon
            </p>
            <h2 style={{ margin: "8px 0" }}>5</h2>
            <small>Across 3 Categories</small>
          </div>
        </div>

        {/* TABS */}
        <div
          style={{
            display: "flex",
            borderBottom: "1px solid #d6e2ef",
            marginBottom: "24px",
            gap: "8px",
          }}
        >
          {["overview", "analytics"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: "12px 24px",
                border: "none",
                background: "none",
                fontSize: "14px",
                fontWeight: 700,
                textTransform: "uppercase",
                color: activeTab === tab ? "#17324d" : "#6b8298",
                borderBottom:
                  activeTab === tab
                    ? "3px solid #17324d"
                    : "3px solid transparent",
                cursor: "pointer",
              }}
            >
              {tab === "overview"
                ? "Stock Overview"
                : "Analytics & Forecasting"}
            </button>
          ))}
        </div>

        {/* TITLE */}
        <div>
          <p
            style={{
              margin: 0,
              color: "#6b8298",
              fontSize: "12px",
              fontWeight: 700,
              textTransform: "uppercase",
            }}
          ></p>

          <h3 style={{ margin: "10px 0 0", color: "#17324d", fontSize: "24px" }}>
            {activeTab === "overview"
              ? "Current Stock"
              : "Analytics & Forecasting"}
          </h3>
        </div>

        {/* FILTERS */}
        {activeTab === "overview" && (
          <div style={{ flexDirection: "column", gap: "12px", marginBottom: "8px" }}>
            <SearchBar
              value={filters.search}
              onChange={(v) => handleFilterChange("search", v)}
              placeholder="Search item..."
            />

            <div
              style={{
                display: "flex",
                gap: "20px",
                flexWrap: "wrap",
                alignItems: "center",
                marginTop: "8px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                Category:
                <div style={chipGroupStyle}>
                  {["All", "Perishable", "Non-Perishable"].map((cat) => (
                    <button
                      key={cat}
                      style={getChipStyle(filters.category === cat)}
                      onClick={() => handleFilterChange("category", cat)}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                Status:
                <div style={chipGroupStyle}>
                  {["All", "Low", "Critical", "Expiring"].map((stat) => (
                    <button
                      key={stat}
                      style={getChipStyle(filters.status === stat)}
                      onClick={() => handleFilterChange("status", stat)}
                    >
                      {stat}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* CONTENT */}
        {activeTab === "overview" ? (
          <div style={{ marginTop: "12px", overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                background: "#fff",
                borderRadius: "12px",
                overflow: "hidden",
                border: "1px solid #dce7f3",
              }}
            >
              <thead>
                <tr style={{ background: "#f1f6fb", textAlign: "left" }}>
                  {[
                    "Item Name",
                    "Category",
                    "Quantity",
                    "Expiry Date",
                    "Status",
                    "Actions",
                  ].map((header) => (
                    <th
                      key={header}
                      style={{
                        padding: "12px",
                        fontSize: "13px",
                        color: "#334155",
                        fontWeight: 700,
                        borderBottom: "1px solid #dce7f3",
                      }}
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan="6" style={{ padding: "16px" }}>
                      Loading...
                    </td>
                  </tr>
                ) : errorMessage ? (
                  <tr>
                    <td colSpan="6" style={{ padding: "16px", color: "red" }}>
                      {errorMessage}
                    </td>
                  </tr>
                ) : inventoryItems.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ padding: "16px" }}>
                      No items found
                    </td>
                  </tr>
                ) : (
                  inventoryItems.map((item, index) => (
                    <tr
                      key={item.id || index}
                      style={{ borderBottom: "1px solid #eef2f7" }}
                    >
                      <td style={{ padding: "12px" }}>{item.name}</td>
                      <td style={{ padding: "12px" }}>{item.category}</td>
                      <td style={{ padding: "12px" }}>{item.quantity}</td>
                      <td style={{ padding: "12px" }}>
                        {item.expiryDate
                          ? new Date(item.expiryDate).toLocaleDateString()
                          : "—"}
                      </td>

                      <td style={{ padding: "12px" }}>
                        <span
                          style={{
                            padding: "4px 10px",
                            borderRadius: "8px",
                            fontSize: "12px",
                            fontWeight: 600,
                            background:
                              item.status === "Critical"
                                ? "#fee2e2"
                                : item.status === "Low"
                                ? "#fef3c7"
                                : "#e0f2fe",
                            color:
                              item.status === "Critical"
                                ? "#b91c1c"
                                : item.status === "Low"
                                ? "#92400e"
                                : "#075985",
                          }}
                        >
                          {item.status || "Normal"}
                        </span>
                      </td>

                      <td style={{ padding: "12px" }}>
                        <button
                          style={{
                            border: "none",
                            background: "#e2e8f0",
                            padding: "6px 10px",
                            borderRadius: "8px",
                            cursor: "pointer",
                            fontSize: "12px",
                            fontWeight: 600,
                          }}
                          onClick={() => handleOpenEditModal(item.id)}
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))
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
              "Stock Levels by Category",
              "Stock Trend & Forecast",
              "Low Stock Alerts",
              "Expiry Monitoring",
              "Distribution by Category",
            ].map((title) => (
              <div key={title} style={analyticsCard}>
                <h4>{title}</h4>
                <p>Content goes here</p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* EXISTING ITEM FORM MODAL - KEPT INTACT */}
      <InventoryItemFormModal
        isOpen={isModalOpen}
        mode={modalMode}
        itemData={selectedItemData}
        isSubmitting={isSubmitting}
        errorMessage={modalErrorMessage}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleSubmitModal}
      />

      {/* SCAN ITEM MODAL */}
      {isScanModalOpen && (
        <div style={scanModalOverlayStyle} onClick={handleCloseScanModal}>
          <div
            style={scanModalStyle}
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              style={{
                margin: 0,
                color: "#2f3f5d",
                fontSize: "24px",
                fontWeight: 800,
                lineHeight: 1.2,
              }}
            >
              Barcode Scanner
            </h2>

            <p
              style={{
                margin: "2px 0 8px",
                color: "#2f3f5d",
                fontSize: "17px",
                fontWeight: 700,
              }}
            >
              Start Scanning
            </p>

            <div style={{ marginBottom: "14px" }}>
              <label style={scanModalLabelStyle}>Input Barcode Number</label>
              <input
                type="text"
                value={scanForm.barcodeNumber}
                onChange={(e) =>
                  handleScanInputChange("barcodeNumber", e.target.value)
                }
                style={scanModalInputStyle}
              />
            </div>

            <div style={{ marginBottom: "22px" }}>
              <label style={scanModalLabelStyle}>Reorder Level</label>
              <input
                type="text"
                value={scanForm.reorderLevel}
                onChange={(e) =>
                  handleScanInputChange("reorderLevel", e.target.value)
                }
                style={scanModalInputStyle}
              />
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "12px",
                flexWrap: "wrap",
              }}
            >
              <button
                type="button"
                style={primaryModalBtn}
                onClick={handleSubmitScanModal}
              >
                Add Item
              </button>
              <button
                type="button"
                style={secondaryModalBtn}
                onClick={handleCloseScanModal}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default InventoryItemsPage;