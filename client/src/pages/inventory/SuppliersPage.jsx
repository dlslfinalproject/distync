import React, { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { FiFileText } from "react-icons/fi";
import PageHeader from "../../components/layout/PageHeader";
import { shellStyles } from "../../components/layout/BarangayLayout";
import ExportModal from "../../components/shared/ExportModal";
import FeedbackToast from "../../components/shared/FeedbackToast";
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
import db from "../../offline/db";
import { buildSyncDescriptor, findSyncEntry } from "../../offline/syncStatus";
import { subscribeToSyncUpdates } from "../../offline/syncService";
import {
  buildExportSuccessMessage,
  COMMON_EXPORT_FORMAT_OPTIONS,
  downloadExportFile,
  NO_EXPORT_DATA_MESSAGE,
  resolveExportErrorMessage,
} from "../../utils/exportHelpers";

const selectStyles = {
  minHeight: "52px",
  padding: "0 14px",
  borderRadius: "16px",
  border: "1px solid #d3dfec",
  backgroundColor: "#ffffff",
  color: "#234260",
  fontSize: "14px",
};

const buildQueuedSupplier = (entry) => {
  return {
    id: entry.entityLocalId || entry.id,
    name: entry.payload?.name || "Pending supplier",
    contact_person: entry.payload?.contact_person || "",
    contact_number: entry.payload?.contact_number || "",
    address: entry.payload?.address || "",
    has_moa: Boolean(entry.payload?.has_moa),
    notes: entry.payload?.notes || "",
    sync_status: entry.status,
    is_local_only: true,
  };
};

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
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [selectedExportFormat, setSelectedExportFormat] = useState("csv");
  const [exportFeedback, setExportFeedback] = useState({
    type: "",
    message: "",
  });
  const syncQueueEntries =
    useLiveQuery(() => db.syncQueue.toArray(), [], []) || [];

  const downloadFile = (file) => {
    downloadExportFile(file);
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

  useEffect(() => {
    const unsubscribe = subscribeToSyncUpdates(() => {
      if (typeof navigator !== "undefined" && navigator.onLine) {
        loadSuppliers(filters);
      }
    });

    return () => unsubscribe();
  }, [filters]);

  const suppliersWithSyncStatus = useMemo(() => {
    const syncedRows = suppliers.map((supplier) => {
      const matchingEntry = findSyncEntry(syncQueueEntries, (entry) => {
        const isSupplierModule =
          entry.moduleName === "mayor-suppliers" || entry.moduleName === "mayor-inventory";

        return (
          isSupplierModule &&
          entry.entityType === "SUPPLIER" &&
          (entry.entityServerId === supplier.id || entry.entityLocalId === supplier.id)
        );
      });

      return {
        ...supplier,
        sync_status: buildSyncDescriptor(matchingEntry).status,
        is_local_only: false,
      };
    });

    const optimisticRows = syncQueueEntries
      .filter((entry) => {
        return (
          (entry.moduleName === "mayor-suppliers" || entry.moduleName === "mayor-inventory") &&
          entry.actionKey === "SUPPLIER_CREATE" &&
          !syncedRows.some(
            (supplier) =>
              supplier.id === entry.entityServerId ||
              supplier.id === entry.entityLocalId,
          )
        );
      })
      .map(buildQueuedSupplier);

    return [...optimisticRows, ...syncedRows];
  }, [suppliers, syncQueueEntries]);

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
        if (!response?.queued_offline) {
          await loadSuppliers(filters);
        }
      } else {
        const response = await createSupplier(payload);
        setSuccessMessage(response.message || "Supplier created successfully");
        if (!response?.queued_offline) {
          await loadSuppliers(filters);
        }
      }

      setIsModalOpen(false);
    } catch (error) {
      setModalErrorMessage(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExport = async (format) => {
    setErrorMessage("");
    setSuccessMessage("");
    setIsExportModalOpen(false);

    if (suppliersWithSyncStatus.length === 0) {
      setExportFeedback({
        type: "error",
        message: NO_EXPORT_DATA_MESSAGE,
      });
      return;
    }

    setIsExporting(format);

    try {
      const file = await exportSuppliers(format, filters);
      downloadFile(file);
      setExportFeedback({
        type: "success",
        message: buildExportSuccessMessage("Suppliers report"),
      });
    } catch (error) {
      setExportFeedback({
        type: "error",
        message: resolveExportErrorMessage(error, "Failed to export suppliers."),
      });
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
                onClick={() => {
                  setSelectedExportFormat("csv");
                  setExportFeedback({ type: "", message: "" });
                  setIsExportModalOpen(true);
                }}
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
        rows={suppliersWithSyncStatus}
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

      <ExportModal
        isOpen={isExportModalOpen}
        title="Export Inventory Report"
        description="Choose the suppliers report format to generate."
        reportOptions={[
          { value: "SUPPLIERS", label: "Suppliers Report" },
        ]}
        formatOptions={COMMON_EXPORT_FORMAT_OPTIONS}
        selectedReportType="SUPPLIERS"
        selectedFormat={selectedExportFormat}
        isSubmitting={Boolean(isExporting)}
        onReportTypeChange={() => {}}
        onFormatChange={setSelectedExportFormat}
        onClose={() => {
          if (!isExporting) {
            setIsExportModalOpen(false);
          }
        }}
        onSubmit={() => handleExport(selectedExportFormat)}
      />

      <FeedbackToast
        type={exportFeedback.type}
        message={exportFeedback.message}
        onClose={() => setExportFeedback({ type: "", message: "" })}
      />
    </>
  );
};

export default SuppliersPage;
