import React, { useEffect, useMemo, useState } from "react";
import { FiFileText } from "react-icons/fi";
import PageHeader from "../../components/layout/PageHeader";
import { shellStyles } from "../../components/layout/BarangayLayout";
import SearchBar from "../../components/shared/SearchBar";
import InventoryBatchFormModal from "../../components/inventory-batches/InventoryBatchFormModal";
import InventoryBatchesTable from "../../components/inventory-batches/InventoryBatchesTable";
import {
  createInventoryBatch,
  exportInventoryBatches,
  fetchInventoryBatches,
  fetchInventoryItems,
  fetchSuppliers,
} from "../../features/inventory-batches/inventoryBatchService";

const selectStyles = {
  minHeight: "52px",
  padding: "0 14px",
  borderRadius: "16px",
  border: "1px solid #d3dfec",
  backgroundColor: "#ffffff",
  color: "#234260",
  fontSize: "14px",
};

const sourceTypes = ["PURCHASED", "DONATED", "DSWD", "LGU", "OTHER"];
const statusOptions = [
  "AVAILABLE",
  "LOW_STOCK",
  "EXPIRED",
  "DEPLETED",
  "MISSING",
  "DAMAGED",
];

const exportMenuStyles = {
  position: "absolute",
  top: "calc(100% + 10px)",
  right: 0,
  minWidth: "220px",
  padding: "8px",
  borderRadius: "14px",
  backgroundColor: "#ffffff",
  border: "1px solid #d7e2ef",
  boxShadow: "0 18px 36px rgba(23, 50, 77, 0.16)",
  display: "grid",
  gap: "6px",
  zIndex: 20,
};

const exportMenuButtonStyles = {
  border: "none",
  borderRadius: "10px",
  backgroundColor: "#f8fbfe",
  color: "#264564",
  textAlign: "left",
  padding: "10px 12px",
  fontSize: "13px",
  fontWeight: 700,
  cursor: "pointer",
};

const NO_EXPORT_DATA_MESSAGE = "No available data to export.";

const InventoryBatchesPage = () => {
  const [filters, setFilters] = useState({
    search: "",
    inventory_item_id: "",
    supplier_id: "",
    source_type: "",
    status: "",
  });
  const [inventoryBatches, setInventoryBatches] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalErrorMessage, setModalErrorMessage] = useState("");
  const [isExporting, setIsExporting] = useState("");
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);

  const downloadFile = (file) => {
    const downloadUrl = window.URL.createObjectURL(file.blob);
    const anchor = document.createElement("a");
    anchor.href = downloadUrl;
    anchor.download = file.filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    window.URL.revokeObjectURL(downloadUrl);
  };

  const loadPageData = async (activeFilters = filters) => {
    setIsLoading(true);
    setErrorMessage("");

    try {
      const [batchResponse, itemResponse, supplierResponse] = await Promise.all([
        fetchInventoryBatches(activeFilters),
        fetchInventoryItems(),
        fetchSuppliers(),
      ]);

      setInventoryBatches(batchResponse || []);
      setInventoryItems(itemResponse || []);
      setSuppliers(supplierResponse || []);
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPageData(filters);
  }, []);

  const itemOptions = useMemo(() => inventoryItems, [inventoryItems]);
  const supplierOptions = useMemo(() => suppliers, [suppliers]);

  const handleFilterChange = (fieldName, value) => {
    setFilters((currentFilters) => ({
      ...currentFilters,
      [fieldName]: value,
    }));
  };

  const handleApplyFilters = async () => {
    await loadPageData(filters);
  };

  const handleOpenCreateModal = () => {
    setModalErrorMessage("");
    setSuccessMessage("");
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    if (isSubmitting) {
      return;
    }

    setIsModalOpen(false);
    setModalErrorMessage("");
  };

  const handleSubmitModal = async (payload) => {
    setIsSubmitting(true);
    setModalErrorMessage("");
    setSuccessMessage("");

    try {
      const response = await createInventoryBatch(payload);
      setSuccessMessage(response.message || "Inventory batch created successfully");
      setIsModalOpen(false);
      await loadPageData(filters);
    } catch (error) {
      setModalErrorMessage(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExport = async (format) => {
    setErrorMessage("");
    setSuccessMessage("");
    setIsExportMenuOpen(false);

    if (inventoryBatches.length === 0) {
      setErrorMessage(NO_EXPORT_DATA_MESSAGE);
      return;
    }

    setIsExporting(format);

    try {
      const file = await exportInventoryBatches(format, filters);
      downloadFile(file);
    } catch (error) {
      setErrorMessage(
        error.message?.includes("No ")
          ? NO_EXPORT_DATA_MESSAGE
          : error.message || "Failed to export inventory batches.",
      );
    } finally {
      setIsExporting("");
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Inventory Workspace"
        title="INVENTORY BATCHES"
        description="Track batch-level stock intake records with item, supplier, quantity, expiration, and availability details."
        actions={[
          {
            label: "Create Batch",
            onClick: handleOpenCreateModal,
          },
        ]}
      />

      <section style={shellStyles.card}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "16px",
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              display: "flex",
              gap: "12px",
              flexWrap: "wrap",
              flex: "1 1 900px",
            }}
          >
            <SearchBar
              value={filters.search}
              onChange={(value) => handleFilterChange("search", value)}
              placeholder="Search batch no, storage location, item name, or item code"
            />

            <select
              value={filters.inventory_item_id}
              onChange={(event) =>
                handleFilterChange("inventory_item_id", event.target.value)
              }
              style={selectStyles}
            >
              <option value="">All Items</option>
              {itemOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.item_name}
                </option>
              ))}
            </select>

            <select
              value={filters.supplier_id}
              onChange={(event) =>
                handleFilterChange("supplier_id", event.target.value)
              }
              style={selectStyles}
            >
              <option value="">All Suppliers</option>
              {supplierOptions.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </select>

            <select
              value={filters.source_type}
              onChange={(event) =>
                handleFilterChange("source_type", event.target.value)
              }
              style={selectStyles}
            >
              <option value="">All Source Types</option>
              {sourceTypes.map((sourceType) => (
                <option key={sourceType} value={sourceType}>
                  {sourceType}
                </option>
              ))}
            </select>

            <select
              value={filters.status}
              onChange={(event) => handleFilterChange("status", event.target.value)}
              style={selectStyles}
            >
              <option value="">All Statuses</option>
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: "flex", gap: "12px", position: "relative" }}>
            <button
              type="button"
              onClick={handleApplyFilters}
              style={{
                border: "none",
                borderRadius: "14px",
                padding: "12px 18px",
                background: "linear-gradient(135deg, #2f6499 0%, #4c86be 100%)",
                color: "#ffffff",
                fontSize: "14px",
                fontWeight: 700,
                cursor: "pointer",
                boxShadow: "0 12px 24px rgba(58, 97, 141, 0.18)",
              }}
            >
              Apply Filters
            </button>

            <div style={{ position: "relative" }}>
              <button
                type="button"
                onClick={() => setIsExportMenuOpen((currentValue) => !currentValue)}
                disabled={Boolean(isExporting)}
                style={{
                  border: "1px solid #c6d8ea",
                  borderRadius: "14px",
                  padding: "12px 18px",
                  backgroundColor: "#f8fbfe",
                  color: "#2a4c6f",
                  fontSize: "14px",
                  fontWeight: 700,
                  cursor: isExporting ? "not-allowed" : "pointer",
                  minHeight: "46px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  opacity: isExporting ? 0.7 : 1,
                }}
              >
                <FiFileText size={16} />
                {isExporting ? `Exporting ${isExporting.toUpperCase()}...` : "Export"}
              </button>

              {isExportMenuOpen ? (
                <div style={exportMenuStyles}>
                  {[
                    { key: "csv", label: "Export as CSV" },
                    { key: "excel", label: "Export as Excel" },
                    { key: "pdf", label: "Export as PDF" },
                  ].map((option) => (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => handleExport(option.key)}
                      style={exportMenuButtonStyles}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {successMessage ? (
          <div
            style={{
              marginTop: "18px",
              padding: "14px 16px",
              borderRadius: "14px",
              backgroundColor: "#edf8f1",
              border: "1px solid #cfe8d7",
              color: "#2f6c47",
              fontSize: "14px",
              fontWeight: 600,
            }}
          >
            {successMessage}
          </div>
        ) : null}
      </section>

      <InventoryBatchesTable
        rows={inventoryBatches}
        isLoading={isLoading}
        errorMessage={errorMessage}
      />

      <InventoryBatchFormModal
        isOpen={isModalOpen}
        inventoryItems={inventoryItems}
        suppliers={suppliers}
        isSubmitting={isSubmitting}
        errorMessage={modalErrorMessage}
        onClose={handleCloseModal}
        onSubmit={handleSubmitModal}
      />
    </>
  );
};

export default InventoryBatchesPage;
