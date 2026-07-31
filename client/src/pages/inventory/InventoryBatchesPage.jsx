import React, { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { FiFileText } from "react-icons/fi";
import { useSearchParams } from "react-router-dom";
import PageHeader from "../../components/layout/PageHeader";
import { shellStyles } from "../../components/layout/BarangayLayout";
import ExportModal from "../../components/shared/ExportModal";
import FeedbackToast from "../../components/shared/FeedbackToast";
import SearchBar from "../../components/shared/SearchBar";
import InventoryBatchFormModal from "../../components/inventory-batches/InventoryBatchFormModal";
import InventoryBatchDetailModal from "../../components/inventory-batches/InventoryBatchDetailModal";
import InventoryBatchesTable from "../../components/inventory-batches/InventoryBatchesTable";
import {
  createInventoryBatch,
  exportInventoryBatches,
  fetchInventoryBatchDetail,
  fetchInventoryBatches,
  fetchInventoryItems,
  fetchSuppliers,
} from "../../features/inventory-batches/inventoryBatchService";
import db from "../../offline/db";
import { buildSyncDescriptor, findSyncEntry } from "../../offline/syncStatus";
import { subscribeToSyncUpdates } from "../../offline/syncService";
import { getVisibleSyncQueueEntries } from "../../offline/syncQueue";
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

const sourceTypes = ["PURCHASED", "DONATED", "DSWD", "LGU", "OTHER"];
const statusOptions = [
  "AVAILABLE",
  "LOW_STOCK",
  "EXPIRED",
  "DEPLETED",
  "MISSING",
  "DAMAGED",
];

const buildQueuedBatch = (entry, inventoryItems, suppliers) => {
  return {
    id: entry.entityLocalId || entry.id,
    batch_no: entry.payload?.batch_no || entry.entityLocalId || "Pending batch",
    inventory_item_id: entry.payload?.inventory_item_id || "",
    supplier_id: entry.payload?.supplier_id || "",
    inventory_item:
      inventoryItems.find((item) => item.id === entry.payload?.inventory_item_id) ||
      null,
    supplier:
      suppliers.find((supplier) => supplier.id === entry.payload?.supplier_id) || null,
    source_type: entry.payload?.source_type || "OTHER",
    quantity_received: entry.payload?.quantity_received || 0,
    quantity_available: entry.payload?.quantity_available || entry.payload?.quantity_received || 0,
    expiration_date: entry.payload?.expiration_date || null,
    status: entry.payload?.status || "AVAILABLE",
    sync_status: entry.status,
    is_local_only: true,
  };
};

const InventoryBatchesPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
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
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [detailErrorMessage, setDetailErrorMessage] = useState("");
  const [selectedBatchDetail, setSelectedBatchDetail] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalErrorMessage, setModalErrorMessage] = useState("");
  const [isExporting, setIsExporting] = useState("");
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [selectedExportFormat, setSelectedExportFormat] = useState("csv");
  const [exportFeedback, setExportFeedback] = useState({
    type: "",
    message: "",
  });
  const [hasHandledScanRedirect, setHasHandledScanRedirect] = useState(false);
  const syncQueueEntries =
    useLiveQuery(() => getVisibleSyncQueueEntries(), [], []) || [];
  const initialInventoryItemId = searchParams.get("inventory_item_id") || "";
  const shouldOpenCreateFromScan = searchParams.get("open_create") === "1";

  const downloadFile = (file) => {
    downloadExportFile(file);
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

  useEffect(() => {
    if (
      !shouldOpenCreateFromScan ||
      !initialInventoryItemId ||
      hasHandledScanRedirect ||
      inventoryItems.length === 0
    ) {
      return;
    }

    const matchedItem = inventoryItems.find(
      (item) => item.id === initialInventoryItemId,
    );

    if (!matchedItem) {
      return;
    }

    setFilters((currentFilters) => ({
      ...currentFilters,
      inventory_item_id: initialInventoryItemId,
    }));
    setModalErrorMessage("");
    setSuccessMessage("");
    setIsModalOpen(true);
    setHasHandledScanRedirect(true);

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("open_create");
    nextParams.delete("source");
    setSearchParams(nextParams, { replace: true });
  }, [
    hasHandledScanRedirect,
    initialInventoryItemId,
    inventoryItems,
    searchParams,
    setSearchParams,
    shouldOpenCreateFromScan,
  ]);

  useEffect(() => {
    const unsubscribe = subscribeToSyncUpdates(() => {
      if (typeof navigator !== "undefined" && navigator.onLine) {
        loadPageData(filters);
      }
    });

    return () => unsubscribe();
  }, [filters]);

  const itemOptions = useMemo(() => inventoryItems, [inventoryItems]);
  const supplierOptions = useMemo(() => suppliers, [suppliers]);
  const inventoryBatchesWithSyncStatus = useMemo(() => {
    const syncedRows = inventoryBatches.map((batch) => {
      const matchingEntry = findSyncEntry(syncQueueEntries, (entry) => {
        return (
          entry.moduleName === "mayor-inventory" &&
          entry.entityType === "INVENTORY_BATCH" &&
          (entry.entityServerId === batch.id || entry.entityLocalId === batch.id)
        );
      });

      return {
        ...batch,
        sync_status: buildSyncDescriptor(matchingEntry).status,
        is_local_only: false,
      };
    });

    const optimisticRows = syncQueueEntries
      .filter((entry) => {
        return (
          entry.moduleName === "mayor-inventory" &&
          entry.actionKey === "INVENTORY_BATCH_CREATE" &&
          !syncedRows.some(
            (batch) =>
              batch.id === entry.entityServerId || batch.id === entry.entityLocalId,
          )
        );
      })
      .map((entry) => buildQueuedBatch(entry, inventoryItems, suppliers));

    return [...optimisticRows, ...syncedRows];
  }, [inventoryBatches, inventoryItems, suppliers, syncQueueEntries]);

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
      if (!response?.queued_offline) {
        await loadPageData(filters);
      }
    } catch (error) {
      setModalErrorMessage(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenBatchDetail = async (inventoryBatchId) => {
    setIsDetailModalOpen(true);
    setIsDetailLoading(true);
    setDetailErrorMessage("");
    setSelectedBatchDetail(null);

    try {
      const response = await fetchInventoryBatchDetail(inventoryBatchId);
      setSelectedBatchDetail(response?.data || null);
    } catch (error) {
      setDetailErrorMessage(error.message || "Failed to load inventory batch detail.");
    } finally {
      setIsDetailLoading(false);
    }
  };

  const handleExport = async (format) => {
    setErrorMessage("");
    setSuccessMessage("");
    setIsExportModalOpen(false);

    if (inventoryBatchesWithSyncStatus.length === 0) {
      setExportFeedback({
        type: "error",
        message: NO_EXPORT_DATA_MESSAGE,
      });
      return;
    }

    setIsExporting(format);

    try {
      const file = await exportInventoryBatches(format, filters);
      downloadFile(file);
      setExportFeedback({
        type: "success",
        message: buildExportSuccessMessage("Inventory batches report"),
      });
    } catch (error) {
      setExportFeedback({
        type: "error",
        message: resolveExportErrorMessage(
          error,
          "Failed to export inventory batches.",
        ),
      });
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

      <InventoryBatchesTable
        rows={inventoryBatchesWithSyncStatus}
        isLoading={isLoading}
        errorMessage={errorMessage}
        onViewDetails={handleOpenBatchDetail}
      />

      <InventoryBatchFormModal
        isOpen={isModalOpen}
        inventoryItems={inventoryItems}
        suppliers={suppliers}
        initialInventoryItemId={initialInventoryItemId}
        isSubmitting={isSubmitting}
        errorMessage={modalErrorMessage}
        onClose={handleCloseModal}
        onSubmit={handleSubmitModal}
      />

      <ExportModal
        isOpen={isExportModalOpen}
        title="Export Inventory Report"
        description="Choose the inventory batch report format to generate."
        reportOptions={[
          { value: "INVENTORY_BATCHES", label: "Inventory Batches Report" },
        ]}
        formatOptions={COMMON_EXPORT_FORMAT_OPTIONS}
        selectedReportType="INVENTORY_BATCHES"
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

      <InventoryBatchDetailModal
        isOpen={isDetailModalOpen}
        isLoading={isDetailLoading}
        errorMessage={detailErrorMessage}
        detail={selectedBatchDetail}
        onClose={() => {
          setIsDetailModalOpen(false);
          setSelectedBatchDetail(null);
          setDetailErrorMessage("");
        }}
      />
    </>
  );
};

export default InventoryBatchesPage;
