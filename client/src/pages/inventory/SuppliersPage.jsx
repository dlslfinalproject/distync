import React, { useEffect, useState } from "react";
import { FiFileText } from "react-icons/fi";
import PageHeader from "../../components/layout/PageHeader";
import { shellStyles } from "../../components/layout/BarangayLayout";
import SearchBar from "../../components/shared/SearchBar";
import SupplierFormModal from "../../components/suppliers/SupplierFormModal";
import SuppliersTable from "../../components/suppliers/SuppliersTable";
import {
  createSupplier,
  exportSuppliers,
  fetchSupplierById,
  fetchSuppliers,
  updateSupplier,
} from "../../features/suppliers/supplierService";

const selectStyles = {
  minHeight: "52px",
  padding: "0 14px",
  borderRadius: "16px",
  border: "1px solid #d3dfec",
  backgroundColor: "#ffffff",
  color: "#234260",
  fontSize: "14px",
};

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

const SuppliersPage = () => {
  const [filters, setFilters] = useState({
    search: "",
    has_moa: "",
  });
  const [suppliers, setSuppliers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("create");
  const [selectedSupplierId, setSelectedSupplierId] = useState(null);
  const [selectedSupplierData, setSelectedSupplierData] = useState(null);
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

  const loadSuppliers = async (activeFilters = filters) => {
    setIsLoading(true);
    setErrorMessage("");

    try {
      const response = await fetchSuppliers(activeFilters);
      setSuppliers(response || []);
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSuppliers(filters);
  }, []);

  const handleFilterChange = (fieldName, value) => {
    setFilters((currentFilters) => ({
      ...currentFilters,
      [fieldName]: value,
    }));
  };

  const handleApplyFilters = async () => {
    await loadSuppliers(filters);
  };

  const handleOpenCreateModal = () => {
    setModalMode("create");
    setSelectedSupplierId(null);
    setSelectedSupplierData(null);
    setModalErrorMessage("");
    setSuccessMessage("");
    setIsModalOpen(true);
  };

  const handleOpenEditModal = async (supplierId) => {
    setModalMode("edit");
    setSelectedSupplierId(supplierId);
    setSelectedSupplierData(null);
    setModalErrorMessage("");
    setSuccessMessage("");
    setIsModalOpen(true);

    try {
      const response = await fetchSupplierById(supplierId);
      setSelectedSupplierData(response);
    } catch (error) {
      setModalErrorMessage(error.message);
    }
  };

  const handleCloseModal = () => {
    if (isSubmitting) {
      return;
    }

    setIsModalOpen(false);
    setSelectedSupplierId(null);
    setSelectedSupplierData(null);
    setModalErrorMessage("");
  };

  const handleSubmitModal = async (payload) => {
    setIsSubmitting(true);
    setModalErrorMessage("");
    setSuccessMessage("");

    try {
      if (modalMode === "edit" && selectedSupplierId) {
        const response = await updateSupplier(selectedSupplierId, payload);
        setSuccessMessage(response.message || "Supplier updated successfully");
      } else {
        const response = await createSupplier(payload);
        setSuccessMessage(response.message || "Supplier created successfully");
      }

      setIsModalOpen(false);
      await loadSuppliers(filters);
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

    if (suppliers.length === 0) {
      setErrorMessage(NO_EXPORT_DATA_MESSAGE);
      return;
    }

    setIsExporting(format);

    try {
      const file = await exportSuppliers(format, filters);
      downloadFile(file);
    } catch (error) {
      setErrorMessage(
        error.message?.includes("No ")
          ? NO_EXPORT_DATA_MESSAGE
          : error.message || "Failed to export suppliers.",
      );
    } finally {
      setIsExporting("");
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Inventory Workspace"
        title="SUPPLIERS"
        description="Manage supplier reference data used by inventory batches, procurement tracking, and reporting."
        actions={[
          {
            label: "Create Supplier",
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
              flex: "1 1 760px",
            }}
          >
            <SearchBar
              value={filters.search}
              onChange={(value) => handleFilterChange("search", value)}
              placeholder="Search supplier name, contact person, or contact number"
            />

            <select
              value={filters.has_moa}
              onChange={(event) =>
                handleFilterChange("has_moa", event.target.value)
              }
              style={selectStyles}
            >
              <option value="">All MOA States</option>
              <option value="true">With MOA</option>
              <option value="false">Without MOA</option>
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

      <SuppliersTable
        rows={suppliers}
        isLoading={isLoading}
        errorMessage={errorMessage}
        onEditSupplier={handleOpenEditModal}
      />

      <SupplierFormModal
        isOpen={isModalOpen}
        mode={modalMode}
        supplierData={selectedSupplierData}
        isSubmitting={isSubmitting}
        errorMessage={modalErrorMessage}
        onClose={handleCloseModal}
        onSubmit={handleSubmitModal}
      />
    </>
  );
};

export default SuppliersPage;
