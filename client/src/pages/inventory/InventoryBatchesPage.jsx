import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { FiFileText } from "react-icons/fi";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
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
  fetchInventoryBatchesPage,
  fetchInventoryItems,
} from "../../features/inventory-batches/inventoryBatchService";
import db from "../../offline/db.js";
import { buildSyncDescriptor, findSyncEntry } from "../../offline/syncStatus";
import { subscribeToSyncUpdates } from "../../offline/syncService";
import { getVisibleSyncQueueEntries } from "../../offline/syncQueue";
import {
  createInventoryRefreshGate,
  shouldRefreshInventoryOnSyncEvent,
} from "../../features/inventory/shared/inventoryRefreshGate.js";
import {
  canUseMayorInventoryCacheAfterError,
  getMayorInventoryCacheSnapshot,
} from "../../offline/mayorInventoryCache";
import { MAYOR_INVENTORY_PREPARATION_STATUS } from "../../offline/mayorInventoryPreparation";
import { useMayorInventoryOfflinePreparation } from "../../features/offline/useMayorInventoryOfflinePreparation";
import { ROLE_CODES } from "../../utils/roleSession";
import {
  DEFAULT_TABLE_PAGE_SIZE,
  TABLE_PAGE_SIZE_OPTIONS,
} from "../../features/pagination/pagination.mjs";
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

const createEmptyPagination = (page = 1, pageSize = DEFAULT_TABLE_PAGE_SIZE) => ({
  page,
  pageSize,
  totalItems: 0,
  totalPages: 0,
  hasPreviousPage: false,
  hasNextPage: false,
});

const buildPaginationFromTotal = (totalItems, pageSize) => {
  const safeTotalItems = Math.max(Number(totalItems) || 0, 0);
  const totalPages =
    safeTotalItems > 0 ? Math.ceil(safeTotalItems / pageSize) : 0;

  return {
    page: 1,
    pageSize,
    totalItems: safeTotalItems,
    totalPages,
    hasPreviousPage: false,
    hasNextPage: totalPages > 1,
  };
};

const buildQueuedBatch = (entry, inventoryItems) => {
  return {
    id: `local-inventory-batch:${entry.id || entry.entityLocalId}`,
    batch_no: entry.payload?.batch_no || entry.entityLocalId || "Pending batch",
    inventory_item_id: entry.payload?.inventory_item_id || "",
    inventory_item:
      inventoryItems.find((item) => item.id === entry.payload?.inventory_item_id) ||
      null,
    source_type: entry.payload?.source_type || "OTHER",
    quantity_received: entry.payload?.quantity_received || 0,
    quantity_available: entry.payload?.quantity_available || entry.payload?.quantity_received || 0,
    expiration_date: entry.payload?.expiration_date || null,
    received_at: entry.clientTimestamp || null,
    created_at: entry.clientTimestamp || null,
    updated_at: entry.clientUpdatedAt || entry.clientTimestamp || null,
    status: entry.payload?.status || "AVAILABLE",
    sync_status: entry.status,
    is_local_only: true,
    client_sync_id: entry.id || null,
  };
};

const filterCachedBatches = (batches, filters = {}) => {
  const search = String(filters.search || "").trim().toLowerCase();

  return (Array.isArray(batches) ? batches : []).filter((batch) => {
    const matchesSearch =
      !search ||
      [
        batch?.batch_no,
        batch?.storage_location,
        batch?.inventory_item?.item_name,
        batch?.inventory_item?.item_code,
      ].some((value) => String(value || "").toLowerCase().includes(search));
    const matchesItem =
      !filters.inventory_item_id ||
      String(batch?.inventory_item_id || "") === String(filters.inventory_item_id);
    const matchesSource =
      !filters.source_type || batch?.source_type === filters.source_type;
    const matchesStatus = !filters.status || batch?.status === filters.status;

    return (
      matchesSearch &&
      matchesItem &&
      matchesSource &&
      matchesStatus
    );
  });
};

const getInventoryBatchRefreshScopeKey = (
  filters = {},
  page = null,
  pageSize = null,
) =>
  JSON.stringify(
    [
      filters.search ? ["search", String(filters.search).trim()] : null,
      filters.inventory_item_id
        ? ["inventory_item_id", String(filters.inventory_item_id)]
        : null,
      filters.source_type
        ? ["source_type", String(filters.source_type)]
        : null,
      filters.status ? ["status", String(filters.status)] : null,
      filters.is_expiring === true || filters.is_expiring === false
        ? ["is_expiring", String(filters.is_expiring)]
        : null,
      filters.is_expired === true || filters.is_expired === false
        ? ["is_expired", String(filters.is_expired)]
        : null,
      page !== null && page !== undefined ? ["page", Number(page)] : null,
      pageSize !== null && pageSize !== undefined
        ? ["pageSize", Number(pageSize)]
        : null,
    ].filter(Boolean),
  );

const InventoryBatchesPage = () => {
  const { currentRole, authenticatedUser } = useAuth();
  const isMayorPortal = currentRole === ROLE_CODES.MAYOR;
  const [searchParams, setSearchParams] = useSearchParams();
  const [filters, setFilters] = useState({
    search: "",
    inventory_item_id: "",
    source_type: "",
    status: "",
  });
  const [inventoryBatches, setInventoryBatches] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_TABLE_PAGE_SIZE);
  const [pagination, setPagination] = useState(
    createEmptyPagination(1, DEFAULT_TABLE_PAGE_SIZE),
  );
  const [isUsingCachedBatches, setIsUsingCachedBatches] = useState(false);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine !== false,
  );
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
  const previousOnlineRef = useRef(isOnline);
  const syncQueueEntries =
    useLiveQuery(() => getVisibleSyncQueueEntries(), [], []) || [];
  const mayorOfflinePreparation = useMayorInventoryOfflinePreparation({
    enabled: isMayorPortal,
    userId: authenticatedUser?.id || "",
    roleCode: currentRole,
  });
  const refreshGateRef = useRef(null);
  const isMountedRef = useRef(true);

  if (!refreshGateRef.current) {
    refreshGateRef.current = createInventoryRefreshGate();
  }

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);
  const initialInventoryItemId = searchParams.get("inventory_item_id") || "";
  const shouldOpenCreateFromScan = searchParams.get("open_create") === "1";
  const isPaginatedLiveTable =
    isMayorPortal && isOnline && !isUsingCachedBatches;

  const downloadFile = (file) => {
    downloadExportFile(file);
  };

  const restoreMayorInventoryCache = async (
    activeFilters = filters,
    isLatestRefresh = () => true,
  ) => {
    if (!isMayorPortal) {
      return false;
    }

    const cacheRow = await getMayorInventoryCacheSnapshot();
    if (!cacheRow) {
      return false;
    }

    if (!isMountedRef.current || !isLatestRefresh()) {
      return false;
    }

    const filteredBatches = filterCachedBatches(cacheRow.batches, activeFilters);
    setInventoryBatches(filteredBatches);
    setInventoryItems(cacheRow.items || []);
    setCurrentPage(1);
    setPagination(buildPaginationFromTotal(filteredBatches.length, pageSize));
    setIsUsingCachedBatches(true);
    return true;
  };

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

  const loadPageData = async (activeFilters = filters, options = {}) => {
    const {
      showLoading = true,
      clearError = true,
      isLatestRefresh = () => true,
      activePage = currentPage,
      activePageSize = pageSize,
      includeItems = true,
    } = options;
    const isRefreshCurrent = () =>
      isMountedRef.current && isLatestRefresh();

    if (!isRefreshCurrent()) {
      return;
    }

    if (showLoading && isRefreshCurrent()) {
      setIsLoading(true);
    }

    if (clearError && isRefreshCurrent()) {
      setErrorMessage("");
    }

    if (!isOnline && isMayorPortal) {
      const restored = await restoreMayorInventoryCache(
        activeFilters,
        isRefreshCurrent,
      );

      if (!restored && isRefreshCurrent()) {
        setErrorMessage(
          "Inventory batches are not prepared on this device yet. Connect to DISTYNC before using offline stock-in.",
        );
      }

      if (isRefreshCurrent()) {
        setIsLoading(false);
      }
      return;
    }

    try {
      const batchRequest = isMayorPortal
        ? fetchInventoryBatchesPage({
            ...activeFilters,
            page: activePage,
            pageSize: activePageSize,
          })
        : fetchInventoryBatches(activeFilters);
      let batchResponse;
      let itemResponse;

      if (includeItems) {
        [batchResponse, itemResponse] = await Promise.all([
          batchRequest,
          fetchInventoryItems(),
        ]);
      } else {
        batchResponse = await batchRequest;
      }

      if (!isRefreshCurrent()) {
        return;
      }

      if (isMayorPortal) {
        if (
          !batchResponse ||
          Array.isArray(batchResponse) ||
          !Array.isArray(batchResponse.data)
        ) {
          throw new Error(
            "DISTYNC returned an incomplete paginated inventory batch response.",
          );
        }

        const responsePagination = batchResponse.pagination || {};
        const totalItems = Math.max(Number(responsePagination.totalItems) || 0, 0);
        const responsePageSize =
          Number(responsePagination.pageSize) || activePageSize;
        const totalPages =
          totalItems > 0 ? Math.ceil(totalItems / responsePageSize) : 0;
        const safePage =
          totalPages > 0 ? Math.min(Math.max(activePage, 1), totalPages) : 1;
        const nextPagination = {
          ...createEmptyPagination(activePage, responsePageSize),
          ...responsePagination,
          page: activePage,
          pageSize: responsePageSize,
          totalItems,
          totalPages,
          hasPreviousPage: activePage > 1 && totalPages > 0,
          hasNextPage: totalPages > 0 && activePage < totalPages,
        };

        setInventoryBatches(batchResponse.data);
        setPagination(nextPagination);
        setIsUsingCachedBatches(false);

        if (includeItems) {
          setInventoryItems(itemResponse || []);
        }

        if (activePage !== safePage) {
          setCurrentPage(safePage);

          if (totalPages > 0) {
            void requestPageRefresh({
              activeFilters,
              activePage: safePage,
              activePageSize: responsePageSize,
              includeItems: false,
              trigger: "pagination-clamp",
            });
          }
        }
      } else {
        setInventoryBatches(batchResponse || []);
        setPagination(createEmptyPagination(1, activePageSize));
        setIsUsingCachedBatches(false);
        if (includeItems) {
          setInventoryItems(itemResponse || []);
        }
      }
    } catch (error) {
      if (isMayorPortal && canUseMayorInventoryCacheAfterError(error)) {
        const restored = await restoreMayorInventoryCache(
          activeFilters,
          isRefreshCurrent,
        );
        if (!restored && isRefreshCurrent()) {
          setErrorMessage(error.message || "Failed to load inventory batches.");
        }
      } else if (isRefreshCurrent()) {
        setErrorMessage(error.message || "Failed to load inventory batches.");
      }
    } finally {
      if (isRefreshCurrent()) {
        setIsLoading(false);
      }
    }
  };

  const requestPageRefresh = ({
    activeFilters = filters,
    activePage = currentPage,
    activePageSize = pageSize,
    trigger = "passive",
    showLoading = true,
    clearError = true,
    includeItems = true,
  } = {}) =>
    refreshGateRef.current.requestRefresh({
      scopeKey: getInventoryBatchRefreshScopeKey(
        activeFilters,
        activePage,
        activePageSize,
      ),
      trigger,
      run: ({ isLatest }) =>
        loadPageData(activeFilters, {
          showLoading,
          clearError,
          activePage,
          activePageSize,
          includeItems,
          isLatestRefresh: isLatest,
        }),
    });

  useEffect(() => {
    const wasOffline = previousOnlineRef.current === false;
    previousOnlineRef.current = isOnline;

    if (!wasOffline || !isOnline || !isMayorPortal) {
      return;
    }

    void requestPageRefresh({
      activeFilters: filters,
      activePage: currentPage,
      activePageSize: pageSize,
      trigger: "online",
    });
  }, [isOnline, isMayorPortal]);

  useEffect(() => {
    if (!isMayorPortal) {
      return undefined;
    }

    const handlePreparationUpdate = (event) => {
      if (
        isOnline ||
        event.detail?.status !== MAYOR_INVENTORY_PREPARATION_STATUS.READY
      ) {
        return;
      }

      void restoreMayorInventoryCache(filters);
    };

    window.addEventListener(
      "distync-offline-preparation-updated",
      handlePreparationUpdate,
    );

    return () => {
      window.removeEventListener(
        "distync-offline-preparation-updated",
        handlePreparationUpdate,
      );
    };
  }, [filters, isMayorPortal, isOnline]);

  useEffect(() => {
    void requestPageRefresh({ activeFilters: filters, trigger: "initial" });
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
    const unsubscribe = subscribeToSyncUpdates((event = {}) => {
      if (!shouldRefreshInventoryOnSyncEvent(event)) {
        return;
      }

      if (typeof navigator !== "undefined" && navigator.onLine) {
        void requestPageRefresh({
          activeFilters: filters,
          trigger: "sync-finished",
        });
      }
    });

    return () => unsubscribe();
  }, [currentPage, filters, pageSize]);

  const itemOptions = useMemo(() => inventoryItems, [inventoryItems]);
  const inventoryBatchesWithSyncStatus = useMemo(() => {
    const syncedRows = inventoryBatches.map((batch) => {
      const matchingEntry = findSyncEntry(syncQueueEntries, (entry) => {
        return (
          entry.moduleName === "mayor-inventory" &&
          entry.entityType === "INVENTORY_BATCH" &&
          (entry.entityServerId === batch.id ||
            entry.entityLocalId === batch.id ||
            (entry.entityLocalId === batch.batch_no &&
              String(entry.payload?.inventory_item_id || "") ===
                String(batch.inventory_item_id || "")))
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
              batch.id === entry.entityServerId ||
              batch.id === entry.entityLocalId ||
              (batch.batch_no === entry.entityLocalId &&
                String(batch.inventory_item_id || "") ===
                  String(entry.payload?.inventory_item_id || "")),
          )
        );
      })
      .map((entry) => buildQueuedBatch(entry, inventoryItems));

    const filteredOptimisticRows = filterCachedBatches(optimisticRows, filters);

    if (isPaginatedLiveTable) {
      return currentPage === 1
        ? [...filteredOptimisticRows, ...syncedRows]
        : syncedRows;
    }

    return filterCachedBatches([...filteredOptimisticRows, ...syncedRows], filters);
  }, [
    currentPage,
    filters,
    inventoryBatches,
    inventoryItems,
    isPaginatedLiveTable,
    syncQueueEntries,
  ]);

  const handleFilterChange = (fieldName, value) => {
    setCurrentPage(1);
    setFilters((currentFilters) => ({
      ...currentFilters,
      [fieldName]: value,
    }));
  };

  const handleApplyFilters = async () => {
    setCurrentPage(1);
    await requestPageRefresh({
      activeFilters: filters,
      activePage: 1,
      activePageSize: pageSize,
      trigger: "manual",
    });
  };

  const handlePageChange = (nextPage) => {
    if (!isPaginatedLiveTable) {
      return;
    }

    const safeNextPage = Math.max(Number(nextPage) || 1, 1);
    setCurrentPage(safeNextPage);
    void requestPageRefresh({
      activeFilters: filters,
      activePage: safeNextPage,
      activePageSize: pageSize,
      includeItems: false,
      trigger: "pagination",
    });
  };

  const handlePageSizeChange = (nextPageSize) => {
    const numericPageSize = Number(nextPageSize);

    if (
      !isPaginatedLiveTable ||
      !TABLE_PAGE_SIZE_OPTIONS.includes(numericPageSize)
    ) {
      return;
    }

    setPageSize(numericPageSize);
    setCurrentPage(1);
    void requestPageRefresh({
      activeFilters: filters,
      activePage: 1,
      activePageSize: numericPageSize,
      includeItems: false,
      trigger: "pagination",
    });
  };

  const handleOpenCreateModal = () => {
    setModalErrorMessage(
      !isOnline && !mayorOfflinePreparation.isReady
        ? "Batch stock-in is unavailable offline until complete inventory reference data is saved on this device."
        : "",
    );
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

    if (!isOnline && !mayorOfflinePreparation.isReady) {
      setModalErrorMessage(
        "Batch stock-in is unavailable offline until complete inventory reference data is saved on this device.",
      );
      setIsSubmitting(false);
      return;
    }

    try {
      const response = await createInventoryBatch(payload);
      setSuccessMessage(response.message || "Inventory batch created successfully");
      setIsModalOpen(false);
      if (!response?.queued_offline) {
        await requestPageRefresh({
          activeFilters: filters,
          trigger: "mutation",
        });
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

    const localBatch = inventoryBatchesWithSyncStatus.find(
      (batch) => batch.id === inventoryBatchId && batch.is_local_only,
    );

    if (localBatch) {
      setSelectedBatchDetail({
        batch: localBatch,
        related_transactions: [],
        audit_history: [],
        alerts: [],
      });
      setIsDetailLoading(false);
      return;
    }

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

    const hasExportableData = isPaginatedLiveTable
      ? pagination.totalItems > 0
      : inventoryBatchesWithSyncStatus.length > 0;

    if (!hasExportableData) {
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
        description="Track batch-level stock intake records with item, quantity, expiration, and availability details."
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
        pagination={isPaginatedLiveTable ? pagination : null}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
      />

      <InventoryBatchFormModal
        isOpen={isModalOpen}
        inventoryItems={inventoryItems}
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
