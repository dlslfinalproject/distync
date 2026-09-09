import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { FiAlertCircle, FiFilter, FiRefreshCw, FiSearch } from "react-icons/fi";
import { useAuth } from "../context/AuthContext";
import { ROLE_CODES } from "../utils/roleSession";
import PageHeader, { pageHeaderStyles } from "../components/layout/PageHeader";
import { shellStyles } from "../components/layout/BarangayLayout";
import SyncStatusBadge from "../components/shared/SyncStatusBadge";
import SyncHealthStatus from "../components/shared/SyncHealthStatus";
import FeedbackToast from "../components/shared/FeedbackToast";
import SyncConflictDetailModal from "../components/shared/SyncConflictDetailModal";
import InventoryItemFormModal from "../components/inventory-items/InventoryItemFormModal";
import ResponsiveFilterPopover from "../components/shared/ResponsiveFilterPopover";
import TablePagination from "../components/shared/TablePagination";
import db, { LOCAL_SYNC_STATUS } from "../offline/db.js";
import {
  retryFailedSyncEntries,
  subscribeToSyncUpdates,
} from "../offline/syncService";
import {
  clearSyncedEntries,
  getVisibleSyncQueueEntriesByUpdatedAt,
  reconcileResolvedSyncEntries,
  updateSyncEntryStatus,
} from "../offline/syncQueue";
import {
  auditSyncRetryRequest,
  fetchSyncBarangays,
  fetchSyncConflictDetail,
  fetchSyncHistory,
  fetchSyncStatusSummary,
  resolveSyncConflict,
} from "../features/sync/syncHistoryService";
import {
  buildSyncSearchText,
  formatSyncDateTime,
  formatSyncHistoryDateTime,
  getConflictReasonLabel,
  getResolutionStatusLabel,
  getSyncHistoryNotes,
  getSyncHistoryStatus,
  getSyncRecordDetails,
  getSyncRecordBarangayId,
  isMayorOwnedSyncRecord,
  isSafeRetryableQueueEntry,
  matchesRecordTypeFilter,
  matchesSyncFilter,
} from "../features/sync/syncManagementHelpers";
import {
  getSafeSyncErrorMessage,
  getSyncHealthPresentation,
  isSyncIdempotencyMismatch,
  SYNC_PRESENTATION_MESSAGES,
} from "../offline/syncStatus.js";
import {
  DEFAULT_TABLE_PAGE_SIZE,
  getTablePaginationState,
  paginateRows,
} from "../features/pagination/pagination.mjs";

const RECORD_TYPE_OPTIONS = [
  { value: "ALL", label: "All Records" },
  { value: "EVACUEE_MASTERLIST", label: "Evacuee Masterlist" },
  { value: "RELIEF_GOODS_DISTRIBUTION", label: "Relief Goods Distribution" },
  { value: "DISASTER_EVENT", label: "Disaster Event Management" },
  { value: "INVENTORY", label: "Inventory" },
];

const MAYOR_RECORD_TYPE_OPTIONS = [
  { value: "ALL", label: "All Records" },
  { value: "INVENTORY_ITEM", label: "Inventory Items" },
  { value: "INVENTORY_BATCH", label: "Inventory Batches" },
  { value: "INVENTORY_TRANSACTION", label: "Inventory Movements" },
];

const QUEUE_STATUS_OPTIONS = [
  { value: "ALL", label: "All" },
  { value: LOCAL_SYNC_STATUS.PENDING, label: "Pending" },
  { value: LOCAL_SYNC_STATUS.SYNCED, label: "Synced" },
  { value: LOCAL_SYNC_STATUS.FAILED, label: "Failed" },
  { value: LOCAL_SYNC_STATUS.CONFLICT, label: "Conflict" },
];

const TRANSACTION_STATUS_OPTIONS = [
  { value: "ALL", label: "All" },
  { value: LOCAL_SYNC_STATUS.PENDING, label: "Pending" },
  { value: LOCAL_SYNC_STATUS.SYNCED, label: "Synced" },
  { value: LOCAL_SYNC_STATUS.FAILED, label: "Failed" },
  { value: LOCAL_SYNC_STATUS.CONFLICT, label: "Conflict" },
  { value: "RESOLVED", label: "Resolved" },
];

const CONFLICT_STATUS_OPTIONS = [
  { value: "ALL", label: "All" },
  { value: LOCAL_SYNC_STATUS.CONFLICT, label: "Open" },
  { value: "RESOLVED", label: "Resolved" },
];

const ORDER_OPTIONS = [
  { value: "newest", label: "Newest-Oldest" },
  { value: "oldest", label: "Oldest-Newest" },
  { value: "az", label: "Sort A-Z" },
  { value: "za", label: "Sort Z-A" },
];

const SYNC_SECTION_TABS = [
  { value: "QUEUE", label: "Offline Queue" },
  { value: "CONFLICTS", label: "Conflict Review" },
  { value: "AUDIT", label: "Sync History" },
];
const SYNC_TAB_OFFLINE_MESSAGE = "Connect online to access this tab.";
const isSyncTabUnavailableOffline = (isOnline, tabValue) =>
  !isOnline && tabValue !== "QUEUE";

const BARANGAY_COLUMN_LABEL = "Barangay";
const EMPTY_MESSAGE = "No matching records found. Try adjusting your search or filters.";
const EMPTY_QUEUE_MESSAGE = "No offline actions are waiting to sync on this device.";
const EMPTY_HISTORY_MESSAGE = "No synchronization history is available yet.";
const EMPTY_CONFLICT_MESSAGE = "No synchronization conflicts require review.";
const SYNC_TABPANEL_IDS = {
  QUEUE: "sync-center-offline-queue-panel",
  AUDIT: "sync-center-history-panel",
  CONFLICTS: "sync-center-conflict-review-panel",
};
const SYNC_TAB_IDS = {
  QUEUE: "sync-center-offline-queue-tab",
  AUDIT: "sync-center-history-tab",
  CONFLICTS: "sync-center-conflict-review-tab",
};
const SYNC_PAGINATION_TABS = ["QUEUE", "CONFLICTS", "AUDIT"];
const createSyncPaginationState = () =>
  Object.fromEntries(
    SYNC_PAGINATION_TABS.map((tab) => [
      tab,
      { page: 1, pageSize: DEFAULT_TABLE_PAGE_SIZE },
    ]),
  );

const getConflictLocalPayload = (conflict = {}) => {
  const localPayload = conflict.local_payload_json || {};

  if (localPayload?.payload && typeof localPayload.payload === "object") {
    return localPayload.payload;
  }

  return localPayload && typeof localPayload === "object" ? localPayload : {};
};

const getConflictCorrectionItemData = (conflict = {}) => {
  const payload = getConflictLocalPayload(conflict);
  const unitOfMeasure =
    payload.unit_of_measure || payload.stock_form_unit_of_measure || "pc";
  const normalizedUnit = String(unitOfMeasure).trim().toLowerCase();
  const trackingMethod =
    payload.tracking_method ||
    (["kg", "g", "l", "ml"].includes(normalizedUnit)
      ? "Weight/Volume-Based"
      : "Count-Based");

  return {
    item_name: payload.item_name || payload.inventory_item_name || "",
    // The old barcode is intentionally cleared. The reviewer may enter a
    // replacement or keep the corrected item as a manual item.
    barcode: "",
    quantity:
      payload.quantity ??
      payload.units_per_packaging ??
      payload.stock_form_units_per_packaging ??
      "",
    unit_of_measure: unitOfMeasure,
    unit_of_measure_value:
      payload.unit_of_measure_value ??
      payload.stock_form_unit_of_measure_value ??
      (trackingMethod === "Count-Based" ? "1" : ""),
    packaging: payload.packaging || payload.stock_form_packaging || "",
    packaging_count:
      payload.packaging_count ?? payload.stock_form_packaging_count ?? "",
    category:
      payload.category ||
      (payload.is_perishable === false ? "non-perishable" : "perishable"),
    expiration_date: payload.expiration_date ?? payload.expiryDate ?? "",
    reorder_level: payload.reorder_level ?? "",
    tracking_method: trackingMethod,
  };
};

const getFirstNumericConflictValue = (...values) => {
  const candidate = values.find(
    (value) => value !== undefined && value !== null && value !== "",
  );

  if (candidate === undefined) {
    return null;
  }

  const numericValue = Number(candidate);
  return Number.isFinite(numericValue) ? numericValue : null;
};

const getConflictCorrectionBatchData = (conflict = {}) => {
  const localPayload = getConflictLocalPayload(conflict);
  const serverPayload =
    conflict.server_payload_json &&
    typeof conflict.server_payload_json === "object"
      ? conflict.server_payload_json
      : {};
  const savedStockForm =
    serverPayload.inventory_item_stock_form ||
    (Array.isArray(serverPayload.inventory_item_stock_forms)
      ? serverPayload.inventory_item_stock_forms[0]
      : null) ||
    {};
  const stockForms =
    Array.isArray(serverPayload.inventory_item_stock_forms) &&
    serverPayload.inventory_item_stock_forms.length > 0
      ? serverPayload.inventory_item_stock_forms
      : serverPayload.inventory_item_stock_form
        ? [serverPayload.inventory_item_stock_form]
        : [];
  const inventoryItemId =
    serverPayload.id ||
    conflict.entity_server_id ||
    localPayload.inventory_item_id ||
    "";
  const category =
    serverPayload.category ||
    localPayload.category ||
    (serverPayload.is_perishable === false ||
    localPayload.is_perishable === false
      ? "non-perishable"
      : "perishable");
  const trackingMethod =
    serverPayload.tracking_method ||
    localPayload.tracking_method ||
    "Count-Based";
  const unitOfMeasure =
    localPayload.stock_form_unit_of_measure ||
    localPayload.unit_of_measure ||
    serverPayload.unit_of_measure ||
    "pc";
  const unitOfMeasureValue =
    localPayload.stock_form_unit_of_measure_value ??
    localPayload.unit_of_measure_value ??
    serverPayload.unit_of_measure_value ??
    (trackingMethod === "Count-Based" ? "1" : "");
  const packaging =
    localPayload.stock_form_packaging ||
    localPayload.packaging ||
    "piece";
  const unitsPerPackaging = getFirstNumericConflictValue(
    localPayload.stock_form_units_per_packaging,
    localPayload.units_per_packaging,
    localPayload.quantity,
    packaging === "piece" ? 1 : null,
  );
  const quantityReceived = getFirstNumericConflictValue(
    localPayload.quantity_received,
    localPayload.quantity_on_hand,
  );
  const explicitPackagingCount = getFirstNumericConflictValue(
    localPayload.stock_form_packaging_count,
    localPayload.packaging_count,
  );
  const packagingCount =
    explicitPackagingCount ??
    (quantityReceived !== null &&
    unitsPerPackaging !== null &&
    unitsPerPackaging > 0 &&
    quantityReceived % unitsPerPackaging === 0
      ? quantityReceived / unitsPerPackaging
      : quantityReceived);
  const existingItem = {
    ...serverPayload,
    id: inventoryItemId,
    item_name:
      serverPayload.item_name ||
      localPayload.item_name ||
      localPayload.inventory_item_name ||
      "",
    item_code: serverPayload.item_code || localPayload.item_code || "",
    category,
    is_perishable:
      serverPayload.is_perishable ??
      localPayload.is_perishable ??
      category === "perishable",
    tracking_method: trackingMethod,
    unit_of_measure:
      serverPayload.unit_of_measure || unitOfMeasure || "pc",
    unit_of_measure_value:
      serverPayload.unit_of_measure_value ?? unitOfMeasureValue,
    reorder_level:
      serverPayload.reorder_level ??
      localPayload.inventory_item_reorder_level ??
      localPayload.reorder_level ??
      "",
    barcode:
      serverPayload.barcode ||
      savedStockForm.barcode ||
      "",
    stock_forms: stockForms,
  };

  return {
    inventoryItems: inventoryItemId ? [existingItem] : [],
    itemData: {
      ...existingItem,
      barcode: "",
      quantity:
        unitsPerPackaging === null ? "" : String(unitsPerPackaging),
      unit_of_measure: unitOfMeasure,
      unit_of_measure_value:
        unitOfMeasureValue === null ? "" : String(unitOfMeasureValue),
      packaging,
      packaging_count:
        packagingCount === null ? "" : String(packagingCount),
      expiration_date:
        localPayload.expiration_date ||
        localPayload.expiryDate ||
        "",
    },
  };
};

const fieldStyles = {
  label: {
    display: "block",
    marginBottom: "8px",
    color: "#5f7892",
    fontSize: "12px",
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  input: {
    width: "100%",
    minHeight: "48px",
    border: "1px solid #cfddeb",
    borderRadius: "12px",
    backgroundColor: "#f8fbff",
    color: "#17324d",
    fontSize: "14px",
    padding: "12px 14px",
    boxSizing: "border-box",
  },
};

const toolbarButtonStyles = {
  ...pageHeaderStyles.secondaryButton,
  boxShadow: "0 16px 30px rgba(31, 64, 96, 0.08)",
  minHeight: "48px",
};

const syncTabButtonStyles = (isActive) => ({
  alignItems: "center",
  boxSizing: "border-box",
  border: "none",
  borderBottom: isActive ? "3px solid #17324d" : "3px solid transparent",
  background: "none",
  color: isActive ? "#17324d" : "#6b8298",
  cursor: "pointer",
  display: "inline-flex",
  fontSize: "14px",
  fontFamily: "inherit",
  fontWeight: 700,
  justifyContent: "center",
  letterSpacing: "0.01em",
  lineHeight: 1.3,
  minHeight: "48px",
  padding: "11px 16px",
  transition: "color 160ms ease, border-color 160ms ease",
  whiteSpace: "nowrap",
});

const syncTabDisabledStyles = {
  color: "#9aaaba",
  cursor: "not-allowed",
  opacity: 0.62,
};

const syncCenterPageStyles = {
  display: "flex",
  flexDirection: "column",
  gap: "16px",
  minWidth: 0,
  width: "100%",
};

const syncCenterFilterCardStyles = {
  ...shellStyles.card,
  padding: "clamp(16px, 1.8vw, 22px)",
};

const syncCenterTabsModuleStyles = {
  ...shellStyles.card,
  padding: 0,
};

const syncCenterTabListStyles = {
  alignItems: "stretch",
  borderBottom: "1px solid #d6e2ef",
  backgroundColor: "#fbfdff",
  borderTopLeftRadius: "17px",
  borderTopRightRadius: "17px",
  display: "flex",
  flexWrap: "nowrap",
  gap: "4px",
  overflowX: "auto",
  padding: "8px clamp(14px, 2vw, 24px) 0",
  minHeight: "56px",
  WebkitOverflowScrolling: "touch",
};

const syncCenterTabPanelStyles = {
  boxSizing: "border-box",
  minHeight: "112px",
  minWidth: 0,
  padding: "clamp(16px, 1.8vw, 24px)",
};

const tableStyles = {
  table: {
    backgroundColor: "#ffffff",
    tableLayout: "auto",
    width: "100%",
    borderCollapse: "collapse",
  },
  th: {
    backgroundColor: "#f8fbff",
    borderBottom: "1px solid #cfdde9",
    color: "#71879a",
    fontSize: "11px",
    fontWeight: 700,
    letterSpacing: "0.1em",
    lineHeight: 1.35,
    padding: "10px 14px",
    textAlign: "left",
    textTransform: "uppercase",
    verticalAlign: "middle",
    whiteSpace: "nowrap",
  },
  td: {
    padding: "14px",
    borderBottom: "1px solid #edf3f8",
    color: "#21405f",
    fontSize: "14px",
    lineHeight: 1.5,
    verticalAlign: "middle",
  },
};

const detailTextStyles = {
  color: "#60738a",
  fontSize: "12px",
  lineHeight: 1.5,
  marginTop: "4px",
};

const srOnlyStyles = {
  border: 0,
  clip: "rect(0, 0, 0, 0)",
  height: "1px",
  margin: "-1px",
  overflow: "hidden",
  padding: 0,
  position: "absolute",
  whiteSpace: "nowrap",
  width: "1px",
};

const syncHistoryTableStyles = {
  ...tableStyles.table,
  minWidth: "1080px",
};

const conflictReviewTableStyles = {
  ...tableStyles.table,
  minWidth: "820px",
};

const offlineQueueTableStyles = {
  ...tableStyles.table,
  minWidth: "760px",
};

const getRecordDateValue = (record = {}) =>
  record.clientTimestamp ||
  record.client_timestamp ||
  record.createdAt ||
  record.created_at ||
  record.updatedAt ||
  record.updated_at ||
  record.server_timestamp ||
  record.resolved_at;

const isWithinDateRange = (record, dateFrom, dateTo) => {
  if (!dateFrom && !dateTo) {
    return true;
  }

  const recordDate = new Date(getRecordDateValue(record));

  if (Number.isNaN(recordDate.getTime())) {
    return false;
  }

  if (dateFrom) {
    const fromDate = new Date(`${dateFrom}T00:00:00`);

    if (recordDate < fromDate) {
      return false;
    }
  }

  if (dateTo) {
    const toDate = new Date(`${dateTo}T23:59:59`);

    if (recordDate > toDate) {
      return false;
    }
  }

  return true;
};

const getConflictFilterStatus = (conflict) =>
  conflict?.status === "RESOLVED" ? "RESOLVED" : LOCAL_SYNC_STATUS.CONFLICT;

const getSortableText = (record) => {
  const details = getSyncRecordDetails(record);
  return `${details.recordType} ${details.subject} ${details.actionLabel}`.toLowerCase();
};

const sortSyncRecords = (records, order) =>
  [...records].sort((firstRecord, secondRecord) => {
    if (order === "az" || order === "za") {
      const comparison = getSortableText(firstRecord).localeCompare(
        getSortableText(secondRecord),
      );
      return order === "az" ? comparison : -comparison;
    }

    const firstTime = new Date(getRecordDateValue(firstRecord)).getTime() || 0;
    const secondTime = new Date(getRecordDateValue(secondRecord)).getTime() || 0;

    return order === "oldest" ? firstTime - secondTime : secondTime - firstTime;
  });

const applySyncFilters = (
  records,
  filters,
  statusAccessor,
  { includeBarangay = false } = {},
) => {
  const searchText = filters.search.trim().toLowerCase();

  return sortSyncRecords(
    records.filter((record) => {
      const status = statusAccessor(record);

      return (
        matchesSyncFilter(status, filters.status) &&
        matchesRecordTypeFilter(record, filters.recordType) &&
        isWithinDateRange(record, filters.dateFrom, filters.dateTo) &&
        (!filters.barangayId ||
          getSyncRecordBarangayId(record) === filters.barangayId) &&
        (!searchText ||
          buildSyncSearchText(record, { includeBarangay }).includes(searchText))
      );
    }),
    filters.order,
  );
};

const SyncManagementPage = () => {
  const { currentRole } = useAuth();
  const isMswdoPortal = currentRole === ROLE_CODES.MSWDO;
  const isMayorPortal = currentRole === ROLE_CODES.MAYOR;
  const recordTypeOptions = isMayorPortal
    ? MAYOR_RECORD_TYPE_OPTIONS
    : RECORD_TYPE_OPTIONS;
  const [syncHistory, setSyncHistory] = useState({
    transactions: [],
    conflicts: [],
  });
  const [syncStatusSummary, setSyncStatusSummary] = useState({
    conflictCount: null,
    lastSuccessfulSyncAt: null,
    backendReachable: true,
  });
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [isRetrying, setIsRetrying] = useState(false);
  const [isLoadingConflictDetail, setIsLoadingConflictDetail] = useState(false);
  const [isResolvingConflict, setIsResolvingConflict] = useState(false);
  const [selectedConflictDetail, setSelectedConflictDetail] = useState(null);
  const [resolutionReason, setResolutionReason] = useState("");
  const [resolutionReasonError, setResolutionReasonError] = useState("");
  const [replacementBarcode, setReplacementBarcode] = useState("");
  const [pendingResolutionAction, setPendingResolutionAction] = useState("");
  const [pendingResolutionPayload, setPendingResolutionPayload] =
    useState(null);
  const [isInventoryCorrectionFormOpen, setIsInventoryCorrectionFormOpen] =
    useState(false);
  const [inventoryCorrectionTarget, setInventoryCorrectionTarget] =
    useState("ITEM");
  const [inventoryCorrectionItemData, setInventoryCorrectionItemData] =
    useState(null);
  const [inventoryCorrectionItems, setInventoryCorrectionItems] = useState([]);
  const [inventoryCorrectionErrorMessage, setInventoryCorrectionErrorMessage] =
    useState("");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [activeSyncTab, setActiveSyncTab] = useState("QUEUE");
  const [paginationByTab, setPaginationByTab] = useState(
    createSyncPaginationState,
  );
  const [barangayOptions, setBarangayOptions] = useState([]);
  const [isLoadingBarangayOptions, setIsLoadingBarangayOptions] = useState(false);
  const [barangayOptionsError, setBarangayOptionsError] = useState("");
  const [filters, setFilters] = useState({
    barangayId: "",
    dateFrom: "",
    dateTo: "",
    order: "newest",
    recordType: "ALL",
    search: "",
    status: "ALL",
  });
  const [feedback, setFeedback] = useState({
    type: "",
    title: "",
    message: "",
  });

  const syncQueueEntries =
    useLiveQuery(() => getVisibleSyncQueueEntriesByUpdatedAt(), [], []) ||
    [];
  const scopedSyncQueueEntries = useMemo(
    () =>
      isMayorPortal
        ? syncQueueEntries.filter((entry) => isMayorOwnedSyncRecord(entry))
        : syncQueueEntries,
    [isMayorPortal, syncQueueEntries],
  );

  const barangayNameById = useMemo(
    () =>
      new Map(
        barangayOptions
          .filter((barangay) => barangay?.id && barangay?.name)
          .map((barangay) => [barangay.id, String(barangay.name).trim()]),
      ),
    [barangayOptions],
  );

  const addBarangayDisplayName = useCallback(
    (record) => {
      if (!isMswdoPortal || record?.barangay_name || record?.barangayName) {
        return record;
      }

      const barangayId = getSyncRecordBarangayId(record);
      const barangayName = barangayNameById.get(barangayId);

      return barangayName ? { ...record, barangay_name: barangayName } : record;
    },
    [barangayNameById, isMswdoPortal],
  );

  const displayQueueEntries = useMemo(
    () => scopedSyncQueueEntries.map(addBarangayDisplayName),
    [addBarangayDisplayName, scopedSyncQueueEntries],
  );

  const displayTransactions = useMemo(() => {
    const conflictsByTransactionId = new Map(
      syncHistory.conflicts
        .filter((conflict) => conflict?.sync_transaction_id)
        .map((conflict) => [conflict.sync_transaction_id, conflict]),
    );

    return syncHistory.transactions.map((transaction) => {
      const conflict = conflictsByTransactionId.get(
        transaction.id || transaction.sync_transaction_id,
      );

      if (!conflict) {
        return addBarangayDisplayName(transaction);
      }

      return addBarangayDisplayName({
        ...transaction,
        sync_conflict_status: conflict.status,
        sync_conflict_type: conflict.conflict_type,
        sync_conflict_resolution_action: conflict.resolution_action,
        sync_conflict_resolution_reason: conflict.resolution_reason,
        sync_conflict_resolution_strategy: conflict.resolution_strategy,
        sync_conflict_resolved_payload_json: conflict.resolved_payload_json,
        sync_conflict_resolved_at: conflict.resolved_at,
        ...(conflict.status === "RESOLVED" ? { status: "RESOLVED" } : {}),
      });
    });
  }, [addBarangayDisplayName, syncHistory.conflicts, syncHistory.transactions]);

  const displayConflicts = useMemo(
    () => syncHistory.conflicts.map(addBarangayDisplayName),
    [addBarangayDisplayName, syncHistory.conflicts],
  );

  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine !== false,
  );
  const statusOptions = useMemo(() => {
    if (activeSyncTab === "CONFLICTS") {
      return CONFLICT_STATUS_OPTIONS;
    }

    if (activeSyncTab === "AUDIT") {
      return TRANSACTION_STATUS_OPTIONS;
    }

    return QUEUE_STATUS_OPTIONS;
  }, [activeSyncTab]);

  const failedQueueEntries = useMemo(
    () =>
      scopedSyncQueueEntries.filter(
        (entry) => isSafeRetryableQueueEntry(entry),
      ),
    [scopedSyncQueueEntries],
  );
  const failedQueueCount = useMemo(
    () =>
      scopedSyncQueueEntries.filter(
        (entry) => entry.status === LOCAL_SYNC_STATUS.FAILED,
      ).length,
    [scopedSyncQueueEntries],
  );

  const summary = useMemo(() => {
    const localConflictCount = scopedSyncQueueEntries.filter(
      (entry) => entry.status === LOCAL_SYNC_STATUS.CONFLICT,
    ).length;
    const serverConflictCount = Number.isFinite(syncStatusSummary.conflictCount)
      ? syncStatusSummary.conflictCount
      : 0;

    return {
      conflicts: Math.max(localConflictCount, serverConflictCount),
      failed: failedQueueCount,
      pending: scopedSyncQueueEntries.filter(
        (entry) => entry.status === LOCAL_SYNC_STATUS.PENDING,
      ).length,
      lastSuccessfulSyncAt: syncStatusSummary.lastSuccessfulSyncAt,
    };
  }, [
    failedQueueCount,
    scopedSyncQueueEntries,
    syncStatusSummary.conflictCount,
    syncStatusSummary.lastSuccessfulSyncAt,
  ]);

  const syncHealth = useMemo(
    () => ({
      ...getSyncHealthPresentation({
        ...summary,
        isLoading: isLoadingHistory,
        hasError:
          Boolean(errorMessage) &&
          summary.pending === 0 &&
          summary.failed === 0 &&
          summary.conflicts === 0,
      }),
      isOnline,
      lastSuccessfulSyncAt: summary.lastSuccessfulSyncAt,
    }),
    [errorMessage, isLoadingHistory, isOnline, summary],
  );

  const filteredQueueEntries = useMemo(
    () =>
      applySyncFilters(displayQueueEntries, filters, (entry) => entry.status, {
        includeBarangay: isMswdoPortal,
      }),
    [displayQueueEntries, filters, isMswdoPortal],
  );

  const filteredTransactions = useMemo(
    () =>
      applySyncFilters(
        displayTransactions,
        filters,
        (transaction) => getSyncHistoryStatus(transaction),
        { includeBarangay: isMswdoPortal },
      ),
    [displayTransactions, filters, isMswdoPortal],
  );

  const filteredConflicts = useMemo(
    () =>
      applySyncFilters(displayConflicts, filters, getConflictFilterStatus, {
        includeBarangay: isMswdoPortal,
      }),
    [displayConflicts, filters, isMswdoPortal],
  );

  useEffect(() => {
    setPaginationByTab((currentPagination) => {
      let hasChanges = false;
      const nextPagination = { ...currentPagination };

      SYNC_PAGINATION_TABS.forEach((tab) => {
        if (currentPagination[tab]?.page !== 1) {
          nextPagination[tab] = {
            ...(currentPagination[tab] || {
              pageSize: DEFAULT_TABLE_PAGE_SIZE,
            }),
            page: 1,
          };
          hasChanges = true;
        }
      });

      return hasChanges ? nextPagination : currentPagination;
    });
  }, [filters]);

  useEffect(() => {
    const rowsByTab = {
      QUEUE: filteredQueueEntries,
      CONFLICTS: filteredConflicts,
      AUDIT: filteredTransactions,
    };

    setPaginationByTab((currentPagination) => {
      let hasChanges = false;
      const nextPagination = { ...currentPagination };

      SYNC_PAGINATION_TABS.forEach((tab) => {
        const currentTabPagination = currentPagination[tab] || {
          page: 1,
          pageSize: DEFAULT_TABLE_PAGE_SIZE,
        };
        const safePagination = getTablePaginationState({
          totalItems: rowsByTab[tab].length,
          currentPage: currentTabPagination.page,
          pageSize: currentTabPagination.pageSize,
        });

        if (
          currentTabPagination.page !== safePagination.currentPage ||
          currentTabPagination.pageSize !== safePagination.pageSize
        ) {
          nextPagination[tab] = {
            page: safePagination.currentPage,
            pageSize: safePagination.pageSize,
          };
          hasChanges = true;
        }
      });

      return hasChanges ? nextPagination : currentPagination;
    });
  }, [filteredConflicts, filteredQueueEntries, filteredTransactions]);

  const queuePagination = paginationByTab.QUEUE || {
    page: 1,
    pageSize: DEFAULT_TABLE_PAGE_SIZE,
  };
  const conflictPagination = paginationByTab.CONFLICTS || {
    page: 1,
    pageSize: DEFAULT_TABLE_PAGE_SIZE,
  };
  const auditPagination = paginationByTab.AUDIT || {
    page: 1,
    pageSize: DEFAULT_TABLE_PAGE_SIZE,
  };
  const paginatedQueueEntries = useMemo(
    () =>
      paginateRows(
        filteredQueueEntries,
        queuePagination.page,
        queuePagination.pageSize,
      ),
    [filteredQueueEntries, queuePagination.page, queuePagination.pageSize],
  );
  const paginatedConflicts = useMemo(
    () =>
      paginateRows(
        filteredConflicts,
        conflictPagination.page,
        conflictPagination.pageSize,
      ),
    [filteredConflicts, conflictPagination.page, conflictPagination.pageSize],
  );
  const paginatedTransactions = useMemo(
    () =>
      paginateRows(
        filteredTransactions,
        auditPagination.page,
        auditPagination.pageSize,
      ),
    [filteredTransactions, auditPagination.page, auditPagination.pageSize],
  );

  const updatePaginationPage = (tab, page) => {
    setPaginationByTab((currentPagination) => ({
      ...currentPagination,
      [tab]: {
        ...(currentPagination[tab] || {
          pageSize: DEFAULT_TABLE_PAGE_SIZE,
        }),
        page,
      },
    }));
  };

  const updatePaginationPageSize = (tab, pageSize) => {
    setPaginationByTab((currentPagination) => ({
      ...currentPagination,
      [tab]: {
        ...(currentPagination[tab] || { page: 1 }),
        page: 1,
        pageSize,
      },
    }));
  };

  const loadSyncHistory = useCallback(async () => {
    setIsLoadingHistory(true);
    setErrorMessage("");

    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      setSyncHistory({ transactions: [], conflicts: [] });
      setSyncStatusSummary({
        conflictCount: null,
        lastSuccessfulSyncAt: null,
        backendReachable: false,
      });
      setIsLoadingHistory(false);
      return;
    }

    try {
      const historyFilters = { limit: 100 };

      if (isMswdoPortal && filters.barangayId) {
        historyFilters.barangay_id = filters.barangayId;
      }

      const response = await fetchSyncHistory(historyFilters);
      const summaryResponse = await fetchSyncStatusSummary();
      try {
        await reconcileResolvedSyncEntries(response.conflicts);
      } catch (_cleanupError) {
        // Keep server history visible even if this device's local cleanup
        // needs to be retried later.
      }
      setSyncHistory({
        transactions: Array.isArray(response.transactions)
          ? response.transactions
          : [],
        conflicts: Array.isArray(response.conflicts) ? response.conflicts : [],
      });
      setSyncStatusSummary({
        conflictCount: Number.isFinite(summaryResponse.conflictCount)
          ? summaryResponse.conflictCount
          : 0,
        lastSuccessfulSyncAt: summaryResponse.lastSuccessfulSyncAt || null,
        backendReachable: summaryResponse.backendReachable !== false,
      });
    } catch (error) {
      setErrorMessage(
        getSafeSyncErrorMessage(error, "Failed to load sync history."),
      );
    } finally {
      setIsLoadingHistory(false);
    }
  }, [filters.barangayId, isMswdoPortal]);

  useEffect(() => {
    void loadSyncHistory();
  }, [loadSyncHistory]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const refreshSyncHistory = () => {
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        return;
      }

      void loadSyncHistory();
    };

    const handleVisibilityRefresh = () => {
      if (document.visibilityState === "visible") {
        refreshSyncHistory();
      }
    };

    const refreshInterval = window.setInterval(refreshSyncHistory, 30000);

    window.addEventListener("focus", refreshSyncHistory);
    document.addEventListener("visibilitychange", handleVisibilityRefresh);

    return () => {
      window.clearInterval(refreshInterval);
      window.removeEventListener("focus", refreshSyncHistory);
      document.removeEventListener("visibilitychange", handleVisibilityRefresh);
    };
  }, [loadSyncHistory]);

  useEffect(() => {
    void clearSyncedEntries().catch(() => {
      // Cleanup is best effort; the queue remains available if local storage
      // is temporarily busy and will be checked again on the next transition.
    });
  }, [isOnline]);

  useEffect(() => {
    if (!isMswdoPortal) {
      setBarangayOptions([]);
      setBarangayOptionsError("");
      return undefined;
    }

    let isMounted = true;
    setIsLoadingBarangayOptions(true);
    setBarangayOptionsError("");

    fetchSyncBarangays()
      .then((rows) => {
        if (!isMounted) {
          return;
        }

        setBarangayOptions(
          rows.filter((barangay) => barangay?.id && barangay?.name),
        );
      })
      .catch(() => {
        if (isMounted) {
          setBarangayOptionsError("Barangay filtering is unavailable right now.");
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoadingBarangayOptions(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isMswdoPortal]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const updateConnectivity = () => {
      const nextIsOnline = navigator.onLine !== false;
      setIsOnline(nextIsOnline);

      if (!nextIsOnline) {
        setActiveSyncTab("QUEUE");
        setErrorMessage("");
        setBarangayOptionsError("");
        setSelectedConflictDetail(null);
        setResolutionReason("");
        setReplacementBarcode("");
      } else {
        void loadSyncHistory();
      }
    };

    window.addEventListener("online", updateConnectivity);
    window.addEventListener("offline", updateConnectivity);

    return () => {
      window.removeEventListener("online", updateConnectivity);
      window.removeEventListener("offline", updateConnectivity);
    };
  }, [loadSyncHistory]);

  useEffect(() => {
    const validStatuses = statusOptions.map((option) => option.value);

    if (!validStatuses.includes(filters.status)) {
      updateFilter("status", "ALL");
    }
  }, [activeSyncTab, filters.status, statusOptions]);

  useEffect(() => {
    const unsubscribe = subscribeToSyncUpdates(() => {
      if (typeof navigator !== "undefined" && navigator.onLine) {
        void loadSyncHistory();
      }
    });

    return () => unsubscribe();
  }, [loadSyncHistory]);

  const updateFilter = (key, value) => {
    setFilters((currentFilters) => ({
      ...currentFilters,
      [key]: value,
    }));
  };

  const handleRetrySync = async (entryIds = null) => {
    if (!isOnline) {
      return;
    }

    const retryTargets = entryIds
      ? failedQueueEntries.filter((entry) => entryIds.includes(entry.id))
      : failedQueueEntries;

    if (!retryTargets.length) {
      return;
    }

    setIsRetrying(true);

    try {
      try {
        await auditSyncRetryRequest(
          retryTargets.map((entry) => ({
            id: entry.id,
            sync_transaction_id: entry.syncTransactionId || null,
            module_name: entry.moduleName || null,
            entity_type: entry.entityType || null,
            action_key: entry.actionKey || null,
            status: entry.status || null,
          })),
        );
      } catch (_auditError) {
        // Retry should still proceed even if review logging is temporarily unavailable.
      }

      const result = await retryFailedSyncEntries(
        retryTargets.map((entry) => entry.id),
      );
      await loadSyncHistory();

      const syncedCount = result?.syncedIds?.length || 0;
      const failedCount = result?.failedIds?.length || 0;
      const conflictCount = result?.conflictIds?.length || 0;
      const pendingCount = result?.pendingIds?.length || 0;

      if (result?.outcome === "SUCCESS") {
        setFeedback({
          type: "success",
          title: "Synchronization complete",
          message:
            syncedCount === 1
              ? "The queued action synchronized successfully."
              : `${syncedCount} queued actions synchronized successfully.`,
        });
      } else if (result?.outcome === "PARTIAL") {
        setFeedback({
          type: "warning",
          title: "Some actions still need attention",
          message: `${syncedCount} synchronized, ${failedCount} failed, and ${conflictCount} sent to Conflict Review${pendingCount ? `; ${pendingCount} still processing` : ""}. Failed actions remain in the queue.`,
        });
      } else if (result?.outcome === "CONFLICT") {
        setFeedback({
          type: "warning",
          title: "Conflict review needed",
          message: SYNC_PRESENTATION_MESSAGES.CONFLICT,
        });
      } else if (result?.outcome === "OFFLINE") {
        setFeedback({
          type: "warning",
          title: "Still offline",
          message: SYNC_PRESENTATION_MESSAGES.OFFLINE,
        });
      } else if (result?.outcome === "IN_FLIGHT") {
        setFeedback({
          type: "info",
          title: "Synchronization already in progress",
          message: "Wait for the current synchronization to finish before trying again.",
        });
      } else if (result?.outcome === "PENDING") {
        setFeedback({
          type: "info",
          title: "Synchronization still processing",
          message: "DISTYNC is still processing this action. Check the queue again shortly.",
        });
      } else if (result?.outcome === "NON_RETRYABLE") {
        setFeedback({
          type: "warning",
          title: "Synchronization cannot be retried",
          message: SYNC_PRESENTATION_MESSAGES.IDEMPOTENCY_MISMATCH,
        });
      } else {
        setFeedback({
          type: "error",
          title: "Synchronization did not complete",
          message:
            result?.outcome === "NETWORK_FAILURE"
              ? SYNC_PRESENTATION_MESSAGES.NETWORK
              : "Synchronization could not be completed. The action remains in the queue.",
        });
      }
    } catch (error) {
      const isIdempotencyMismatch = isSyncIdempotencyMismatch(error);
      setFeedback({
        type: isIdempotencyMismatch ? "warning" : "error",
        title: isIdempotencyMismatch
          ? "Synchronization cannot be retried"
          : "Synchronization did not complete",
        message:
          getSafeSyncErrorMessage(
            error,
            "Synchronization could not be completed. The action remains in the queue.",
          ),
      });
    } finally {
      setIsRetrying(false);
    }
  };

  const handleOpenConflictDetail = async (conflictId) => {
    setIsLoadingConflictDetail(true);

    try {
      const response = await fetchSyncConflictDetail(conflictId);
      const conflict = response?.data || null;

      setSelectedConflictDetail(
        conflict
          ? {
              ...conflict,
              conflict_reason: getConflictReasonLabel(conflict),
              resolution_status_label: getResolutionStatusLabel(conflict),
            }
          : null,
      );
      setResolutionReason("");
      setResolutionReasonError("");
      setReplacementBarcode("");
      setPendingResolutionAction("");
      setPendingResolutionPayload(null);
      setIsInventoryCorrectionFormOpen(false);
      setInventoryCorrectionTarget("ITEM");
      setInventoryCorrectionItemData(null);
      setInventoryCorrectionItems([]);
      setInventoryCorrectionErrorMessage("");
    } catch (error) {
      setFeedback({
        type: "error",
        title: "Conflict Detail Error",
        message: getSafeSyncErrorMessage(
          error,
          "Failed to load sync conflict detail.",
        ),
      });
    } finally {
      setIsLoadingConflictDetail(false);
    }
  };

  const handleCloseConflictDetail = useCallback(() => {
    setSelectedConflictDetail(null);
    setResolutionReason("");
    setResolutionReasonError("");
    setReplacementBarcode("");
    setPendingResolutionAction("");
    setPendingResolutionPayload(null);
    setIsInventoryCorrectionFormOpen(false);
    setInventoryCorrectionTarget("ITEM");
    setInventoryCorrectionItemData(null);
    setInventoryCorrectionItems([]);
    setInventoryCorrectionErrorMessage("");
  }, []);

  const handleCloseInventoryCorrectionForm = useCallback(() => {
    setIsInventoryCorrectionFormOpen(false);
    setPendingResolutionAction("");
    setPendingResolutionPayload(null);
    setInventoryCorrectionTarget("ITEM");
    setInventoryCorrectionItemData(null);
    setInventoryCorrectionItems([]);
    setInventoryCorrectionErrorMessage("");
  }, []);

  const handleResolutionReasonChange = useCallback((value) => {
    setResolutionReason(value);
    if (value.trim()) {
      setResolutionReasonError("");
    }
  }, []);

  const submitResolveConflict = async (action, resolutionPayload = null) => {
    if (!selectedConflictDetail?.id || isResolvingConflict) {
      return;
    }

    setIsResolvingConflict(true);

    try {
      const response = await resolveSyncConflict(selectedConflictDetail.id, {
        action,
        reason: resolutionReason.trim(),
        replacementBarcode: replacementBarcode.trim(),
        resolutionPayload,
      });
      const resolvedConflict = response?.data || null;

      const localEntry = syncQueueEntries.find(
        (entry) =>
          entry.syncTransactionId ===
          (resolvedConflict?.sync_transaction_id ||
            selectedConflictDetail.sync_transaction_id),
      );
      if (localEntry) {
        await updateSyncEntryStatus(localEntry.id, {
          status: resolvedConflict?.sync_status || LOCAL_SYNC_STATUS.CONFLICT,
          resolutionStatus: resolvedConflict?.resolution_status_label || "RESOLVED",
          entityServerId: resolvedConflict?.entity_server_id || localEntry.entityServerId || null,
          serverMessage: resolvedConflict?.resolution_reason || "Sync conflict resolved.",
        });
      }

      try {
        await clearSyncedEntries();
      } catch (_cleanupError) {
        // The server decision is already recorded. A later sync refresh can
        // clean up a stale local row if browser storage is temporarily busy.
      }

      try {
        await reconcileResolvedSyncEntries(
          resolvedConflict ? [resolvedConflict] : [],
        );
      } catch (_cleanupError) {
        // The server decision is already recorded. A later history refresh
        // can retry cleanup if browser storage is temporarily busy.
      }

      setSelectedConflictDetail(
        resolvedConflict
          ? {
              ...selectedConflictDetail,
              ...resolvedConflict,
              conflict_reason: getConflictReasonLabel(resolvedConflict),
              resolution_status_label: getResolutionStatusLabel(resolvedConflict),
            }
          : null,
      );
      setResolutionReason("");
      setResolutionReasonError("");
      setReplacementBarcode("");
      setPendingResolutionAction("");
      setPendingResolutionPayload(null);
      setIsInventoryCorrectionFormOpen(false);
      setInventoryCorrectionTarget("ITEM");
      setInventoryCorrectionItemData(null);
      setInventoryCorrectionItems([]);
      setInventoryCorrectionErrorMessage("");
      await loadSyncHistory();
      setFeedback({
        type: "success",
        title: "Conflict Resolved",
        message: "The conflict review decision was recorded.",
      });
    } catch (error) {
      const safeMessage = getSafeSyncErrorMessage(
        error,
        "The conflict could not be resolved. Refresh and review the latest state.",
      );
      setFeedback({
        type: "error",
        title: "Resolution Error",
        message: safeMessage,
      });
      if (resolutionPayload) {
        setInventoryCorrectionErrorMessage(safeMessage);
        setPendingResolutionAction("");
        setPendingResolutionPayload(null);
      }
      await loadSyncHistory();
    } finally {
      setIsResolvingConflict(false);
    }
  };

  const handleResolveConflict = (action) => {
    if (!selectedConflictDetail?.id || isResolvingConflict) {
      return;
    }

    const trimmedReason = resolutionReason.trim();

    if (
      ["KEEP_SERVER", "APPLY_LOCAL", "ACCEPT_BOTH"].includes(action) &&
      !trimmedReason
    ) {
      setResolutionReasonError("Review note is required.");
      return;
    }

    setResolutionReasonError("");

    const opensInventoryCorrectionForm =
      action === "APPLY_LOCAL" &&
      ["DUPLICATE_INVENTORY_BARCODE", "DUPLICATE_INVENTORY_ITEM"].includes(
        selectedConflictDetail.conflict_type,
      ) &&
      ["INVENTORY_ITEM", "INVENTORY_BATCH"].includes(
        selectedConflictDetail.entity_type,
      );

    if (opensInventoryCorrectionForm) {
      setInventoryCorrectionErrorMessage("");
      if (
        selectedConflictDetail.entity_type === "INVENTORY_BATCH" ||
        selectedConflictDetail.conflict_type === "DUPLICATE_INVENTORY_ITEM"
      ) {
        const correctionData = getConflictCorrectionBatchData(
          selectedConflictDetail,
        );
        setInventoryCorrectionTarget("BATCH");
        setInventoryCorrectionItemData(correctionData.itemData);
        setInventoryCorrectionItems(correctionData.inventoryItems);
      } else {
        setInventoryCorrectionTarget("ITEM");
        setInventoryCorrectionItemData(
          getConflictCorrectionItemData(selectedConflictDetail),
        );
        setInventoryCorrectionItems([]);
      }
      setIsInventoryCorrectionFormOpen(true);
      return;
    }

    setPendingResolutionAction(action);
  };

  const handleConfirmResolve = (action) => {
    if (!action || action !== pendingResolutionAction) {
      return;
    }

    void submitResolveConflict(action, pendingResolutionPayload);
  };

  const handleCancelPendingResolve = useCallback(() => {
    setPendingResolutionAction("");
    setPendingResolutionPayload(null);
  }, []);

  const handleInventoryCorrectionSubmit = (formValues) => {
    if (!selectedConflictDetail?.id || isResolvingConflict) {
      return;
    }

    const localPayload = getConflictLocalPayload(selectedConflictDetail);
    if (inventoryCorrectionTarget === "BATCH") {
      const packaging = String(formValues.packaging || "").trim().toLowerCase();
      const unitsPerPackaging =
        packaging === "piece" ? 1 : Number(formValues.quantity);
      const packagingCount = Number(formValues.packaging_count);
      const quantityReceived = packagingCount * unitsPerPackaging;
      const existingItemId =
        inventoryCorrectionItems[0]?.id ||
        inventoryCorrectionItemData?.id ||
        selectedConflictDetail.entity_server_id ||
        localPayload.inventory_item_id ||
        null;
      const resolutionPayload = {
        ...localPayload,
        inventory_item_id: existingItemId,
        // The corrected packaging is created as a new stock form. The local
        // device id must not be sent back as the server stock-form id.
        inventory_item_stock_form_id: null,
        stock_form_barcode: formValues.barcode || null,
        stock_form_packaging: packaging,
        stock_form_units_per_packaging: unitsPerPackaging,
        stock_form_unit_of_measure: formValues.unit_of_measure || "pc",
        stock_form_unit_of_measure_value:
          formValues.unit_of_measure_value || null,
        quantity_received: quantityReceived,
        inventory_item_reorder_level: formValues.reorder_level
          ? Number(formValues.reorder_level)
          : undefined,
        expiration_date: formValues.expiration_date || null,
      };

      setInventoryCorrectionErrorMessage("");
      setPendingResolutionPayload(resolutionPayload);
      setPendingResolutionAction("APPLY_LOCAL");
      return;
    }

    const normalizedCategory = String(formValues.category || "")
      .trim()
      .toLowerCase();
    const resolutionPayload = {
      ...localPayload,
      ...formValues,
      // Keep the saved category and perishability flag in sync when the
      // reviewer changes the category in the correction form.
      is_perishable: normalizedCategory === "perishable",
      // A blank barcode is an explicit choice to save this as a manual item.
      barcode: formValues.barcode || null,
    };

    setInventoryCorrectionErrorMessage("");
    setPendingResolutionPayload(resolutionPayload);
    setPendingResolutionAction("APPLY_LOCAL");
  };

  const renderRecordCells = (
    record,
    {
      includeBarangay = true,
      includeOperation = false,
      includeDisasterEvent = true,
    } = {},
  ) => {
    const details = getSyncRecordDetails(record);
    const shouldIncludeBarangay = includeBarangay || isMswdoPortal;

    return (
      <>
        <td style={tableStyles.td}>{details.recordType}</td>
        {shouldIncludeBarangay ? (
          <td style={tableStyles.td}>{details.barangay}</td>
        ) : null}
        <td style={tableStyles.td}>
          {includeOperation ? details.operation : details.actionLabel}
        </td>
        <td style={tableStyles.td}>
          <div>{details.subject}</div>
          {details.secondaryLabel ? (
            <div style={detailTextStyles}>{details.secondaryLabel}</div>
          ) : null}
        </td>
        {includeDisasterEvent ? (
          <td style={tableStyles.td}>{details.disasterEvent}</td>
        ) : null}
      </>
    );
  };

  return (
    <div className="sync-center-page" style={syncCenterPageStyles}>
      <PageHeader title="SYNC CENTER" />

      <SyncHealthStatus health={syncHealth} />

      <section
        className="sync-center-filter-card"
        data-filter-count={isMswdoPortal ? "5" : "4"}
        style={syncCenterFilterCardStyles}
      >
        <div
          className="sync-center-filter-grid"
          data-filter-count={isMswdoPortal ? "5" : "4"}
        >
          <label className="sync-center-filter-field">
            <span style={fieldStyles.label}>Record Type</span>
            <select
              value={filters.recordType}
              onChange={(event) => updateFilter("recordType", event.target.value)}
              style={fieldStyles.input}
            >
              {recordTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          {isMswdoPortal ? (
            <label className="sync-center-filter-field">
              <span style={fieldStyles.label}>{BARANGAY_COLUMN_LABEL}</span>
              <select
                value={filters.barangayId}
                onChange={(event) => updateFilter("barangayId", event.target.value)}
                style={fieldStyles.input}
                disabled={isLoadingBarangayOptions}
              >
                <option value="">All Barangays</option>
                {barangayOptions.map((barangay) => (
                  <option key={barangay.id} value={barangay.id}>
                    {barangay.name}
                  </option>
                ))}
              </select>
              {barangayOptionsError ? (
                <span style={{ ...detailTextStyles, color: "#a14d58" }} role="status">
                  {barangayOptionsError}
                </span>
              ) : null}
            </label>
          ) : null}

          <label className="sync-center-filter-field">
            <span style={fieldStyles.label}>
              {activeSyncTab === "CONFLICTS" ? "Conflict Status" : "Sync Status"}
            </span>
            <select
              value={filters.status}
              onChange={(event) => updateFilter("status", event.target.value)}
              style={fieldStyles.input}
            >
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="sync-center-filter-field">
            <span style={fieldStyles.label}>Date From</span>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(event) => updateFilter("dateFrom", event.target.value)}
              style={fieldStyles.input}
            />
          </label>

          <label className="sync-center-filter-field">
            <span style={fieldStyles.label}>Date To</span>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(event) => updateFilter("dateTo", event.target.value)}
              style={fieldStyles.input}
            />
          </label>
        </div>
      </section>

      <div
        className="sync-center-toolbar"
      >
        <div className="sync-center-toolbar__search" style={{ position: "relative" }}>
          <FiSearch
            size={18}
            style={{
              position: "absolute",
              left: "16px",
              top: "50%",
              transform: "translateY(-50%)",
              color: "#7892aa",
              pointerEvents: "none",
            }}
          />
          <input
            type="search"
            aria-label="Search synchronization records"
            value={filters.search}
            onChange={(event) => updateFilter("search", event.target.value)}
            placeholder="Search record type, affected record, stub number, action, status, event, sector, relief pack, or notes"
            style={{
              ...fieldStyles.input,
              paddingLeft: "44px",
              backgroundColor: "#ffffff",
              boxShadow: "0 16px 30px rgba(31, 64, 96, 0.08)",
            }}
          />
        </div>

        <div className="sync-center-toolbar__filter">
          <ResponsiveFilterPopover
            isOpen={isFilterOpen}
            onOpenChange={setIsFilterOpen}
            title="Filter Records"
            scopeKey={activeSyncTab}
            trigger={({ ref, ...triggerProps }) => (
              <button
                ref={ref}
                type="button"
                style={toolbarButtonStyles}
                {...triggerProps}
              >
                <FiFilter size={18} />
                Filter
              </button>
            )}
          >
              <h3 style={{ margin: "0 0 16px", color: "#17324d" }}>
                Filter Records
              </h3>
              <label>
                <span style={fieldStyles.label}>Order List</span>
                <select
                  value={filters.order}
                  onChange={(event) => updateFilter("order", event.target.value)}
                  style={fieldStyles.input}
                >
                  {ORDER_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
          </ResponsiveFilterPopover>
        </div>

        <button
          className="sync-center-toolbar__retry"
          type="button"
          onClick={() => handleRetrySync()}
          disabled={!isOnline || failedQueueEntries.length === 0 || isRetrying}
          style={{
            ...pageHeaderStyles.primaryButton,
            minHeight: "48px",
            opacity: !isOnline || failedQueueEntries.length === 0 || isRetrying ? 0.7 : 1,
            cursor:
              !isOnline || failedQueueEntries.length === 0 || isRetrying
                ? "not-allowed"
                : "pointer",
          }}
        >
          <FiRefreshCw size={18} />
          {isRetrying ? "Retrying..." : "Retry Failed Syncs"}
        </button>
      </div>

      <section
        className="sync-center-tabs-module"
        style={syncCenterTabsModuleStyles}
      >
        <div
          className="sync-center-tablist"
          role="tablist"
          aria-label="Sync Center sections"
          style={syncCenterTabListStyles}
        >
          {SYNC_SECTION_TABS.map((tab) => (
            <button
              key={tab.value}
              id={SYNC_TAB_IDS[tab.value]}
              role="tab"
              aria-selected={activeSyncTab === tab.value}
              aria-controls={SYNC_TABPANEL_IDS[tab.value]}
              type="button"
              onClick={() => {
                if (!isSyncTabUnavailableOffline(isOnline, tab.value)) {
                  setActiveSyncTab(tab.value);
                }
              }}
              disabled={isSyncTabUnavailableOffline(isOnline, tab.value)}
              title={
                isSyncTabUnavailableOffline(isOnline, tab.value)
                  ? SYNC_TAB_OFFLINE_MESSAGE
                  : undefined
              }
              style={{
                ...syncTabButtonStyles(activeSyncTab === tab.value),
                ...(isSyncTabUnavailableOffline(isOnline, tab.value)
                  ? syncTabDisabledStyles
                  : {}),
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

      {activeSyncTab === "QUEUE" ? (
      <section
        id={SYNC_TABPANEL_IDS.QUEUE}
        role="tabpanel"
        aria-labelledby={SYNC_TAB_IDS.QUEUE}
        className="sync-center-tabpanel"
        style={syncCenterTabPanelStyles}
      >
        <h2 style={srOnlyStyles}>Offline Queue</h2>

        <TablePagination
          totalItems={filteredQueueEntries.length}
          currentPage={queuePagination.page}
          pageSize={queuePagination.pageSize}
          onPageChange={(page) => updatePaginationPage("QUEUE", page)}
          onPageSizeChange={(pageSize) =>
            updatePaginationPageSize("QUEUE", pageSize)
          }
          ariaLabel="Offline queue pagination"
          previousAriaLabel="Go to previous offline queue page"
          nextAriaLabel="Go to next offline queue page"
        />

        {filteredQueueEntries.length === 0 ? (
          <p style={shellStyles.mutedText}>
            {scopedSyncQueueEntries.length === 0 ? EMPTY_QUEUE_MESSAGE : EMPTY_MESSAGE}
          </p>
        ) : (
          <div className="sync-center-table-scroll" style={{ overflowX: "auto" }}>
            <table style={offlineQueueTableStyles}>
              <thead>
                <tr>
                  <th style={tableStyles.th}>Record Type</th>
                  {isMswdoPortal ? (
                    <th style={tableStyles.th}>{BARANGAY_COLUMN_LABEL}</th>
                  ) : null}
                  <th style={tableStyles.th}>Operation</th>
                  <th style={tableStyles.th}>Affected Record</th>
                  <th style={tableStyles.th}>Status</th>
                  <th style={tableStyles.th}>Queued At</th>
                </tr>
              </thead>
              <tbody>
                {paginatedQueueEntries.map((entry) => {
                  return (
                    <tr key={entry.id}>
                      {renderRecordCells(entry, {
                        includeBarangay: false,
                        includeOperation: true,
                        includeDisasterEvent: false,
                      })}
                      <td style={tableStyles.td}>
                        <SyncStatusBadge status={entry.status} />
                      </td>
                      <td style={tableStyles.td}>
                        {formatSyncDateTime(entry.clientTimestamp || entry.createdAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      ) : null}

      {activeSyncTab === "AUDIT" ? (
      <section
        id={SYNC_TABPANEL_IDS.AUDIT}
        role="tabpanel"
        aria-labelledby={SYNC_TAB_IDS.AUDIT}
        className="sync-center-tabpanel"
        style={syncCenterTabPanelStyles}
      >
        <h2 style={srOnlyStyles}>Sync History</h2>

        <TablePagination
          totalItems={filteredTransactions.length}
          currentPage={auditPagination.page}
          pageSize={auditPagination.pageSize}
          onPageChange={(page) => updatePaginationPage("AUDIT", page)}
          onPageSizeChange={(pageSize) =>
            updatePaginationPageSize("AUDIT", pageSize)
          }
          isVisible={!isLoadingHistory && !errorMessage}
          disabled={isLoadingHistory}
          disablePageSize={isLoadingHistory}
          ariaLabel="Sync history pagination"
          previousAriaLabel="Go to previous sync history page"
          nextAriaLabel="Go to next sync history page"
        />

        {isLoadingHistory ? (
          <p style={shellStyles.mutedText}>Loading sync history...</p>
        ) : errorMessage ? (
          <p style={{ ...shellStyles.mutedText, color: "#a14d58" }}>
            {errorMessage}
          </p>
        ) : filteredTransactions.length === 0 ? (
          <p style={shellStyles.mutedText}>
            {syncHistory.transactions.length === 0 ? EMPTY_HISTORY_MESSAGE : EMPTY_MESSAGE}
          </p>
        ) : (
          <div className="sync-center-table-scroll" style={{ overflowX: "auto" }}>
            <table style={syncHistoryTableStyles}>
              <thead>
                <tr>
                  <th style={tableStyles.th}>Record Type</th>
                  {isMswdoPortal ? (
                    <th style={tableStyles.th}>{BARANGAY_COLUMN_LABEL}</th>
                  ) : null}
                  <th style={tableStyles.th}>Action</th>
                  <th style={tableStyles.th}>Affected Record</th>
                  <th style={tableStyles.th}>Status</th>
                  <th style={tableStyles.th}>Queued At</th>
                  <th style={tableStyles.th}>Processed At</th>
                  <th style={tableStyles.th}>Notes</th>
                </tr>
              </thead>
              <tbody>
                {paginatedTransactions.map((transaction) => {
                  const notes = getSyncHistoryNotes(transaction);

                  return (
                    <tr key={transaction.id}>
                      {renderRecordCells(transaction, {
                        includeBarangay: false,
                        includeDisasterEvent: false,
                      })}
                      <td style={tableStyles.td}>
                        <SyncStatusBadge status={getSyncHistoryStatus(transaction)} />
                      </td>
                      <td style={tableStyles.td}>
                        {formatSyncDateTime(
                          transaction.client_timestamp || transaction.created_at,
                        )}
                      </td>
                      <td style={tableStyles.td}>
                        {formatSyncHistoryDateTime(transaction.server_timestamp)}
                      </td>
                      <td style={tableStyles.td}>
                        {notes.map((note, index) =>
                          index === 0 ? (
                            <div key={note}>{note}</div>
                          ) : (
                            <div key={note} style={detailTextStyles}>
                              {note}
                            </div>
                          ),
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      ) : null}

      {activeSyncTab === "CONFLICTS" ? (
      <section
        id={SYNC_TABPANEL_IDS.CONFLICTS}
        role="tabpanel"
        aria-labelledby={SYNC_TAB_IDS.CONFLICTS}
        className="sync-center-tabpanel"
        style={syncCenterTabPanelStyles}
      >
        <h2 style={srOnlyStyles}>Conflict Review</h2>

        <TablePagination
          totalItems={filteredConflicts.length}
          currentPage={conflictPagination.page}
          pageSize={conflictPagination.pageSize}
          onPageChange={(page) => updatePaginationPage("CONFLICTS", page)}
          onPageSizeChange={(pageSize) =>
            updatePaginationPageSize("CONFLICTS", pageSize)
          }
          isVisible={!isLoadingHistory && !errorMessage}
          disabled={isLoadingHistory}
          disablePageSize={isLoadingHistory}
          ariaLabel="Conflict review pagination"
          previousAriaLabel="Go to previous conflict review page"
          nextAriaLabel="Go to next conflict review page"
        />

        {isLoadingHistory ? (
          <p style={shellStyles.mutedText}>Loading conflicts...</p>
        ) : filteredConflicts.length === 0 ? (
          <p style={shellStyles.mutedText}>
            {syncHistory.conflicts.length === 0 ? EMPTY_CONFLICT_MESSAGE : EMPTY_MESSAGE}
          </p>
        ) : (
          <div className="sync-center-table-scroll" style={{ overflowX: "auto" }}>
            <table style={conflictReviewTableStyles}>
              <thead>
                <tr>
                  <th style={tableStyles.th}>Record Type</th>
                  {isMswdoPortal ? (
                    <th style={tableStyles.th}>{BARANGAY_COLUMN_LABEL}</th>
                  ) : null}
                  <th style={tableStyles.th}>Affected Record</th>
                  <th style={tableStyles.th}>Conflict Reason</th>
                  <th style={tableStyles.th}>Status</th>
                  <th style={tableStyles.th}>Resolved At</th>
                  <th style={tableStyles.th}>Action</th>
                </tr>
              </thead>
              <tbody>
                {paginatedConflicts.map((conflict) => {
                  const details = getSyncRecordDetails(conflict);

                  return (
                    <tr key={conflict.id}>
                      <td style={tableStyles.td}>{details.recordType}</td>
                      {isMswdoPortal ? (
                        <td style={tableStyles.td}>{details.barangay}</td>
                      ) : null}
                      <td style={tableStyles.td}>{details.subject}</td>
                      <td style={tableStyles.td}>{getConflictReasonLabel(conflict)}</td>
                      <td style={tableStyles.td}>
                        <SyncStatusBadge
                          status={conflict.status === "RESOLVED" ? "RESOLVED" : "OPEN"}
                          label={getResolutionStatusLabel(conflict)}
                        />
                      </td>
                      <td style={tableStyles.td}>
                        {formatSyncHistoryDateTime(conflict.resolved_at)}
                      </td>
                      <td style={tableStyles.td}>
                        <button
                          type="button"
                          onClick={() => handleOpenConflictDetail(conflict.id)}
                          disabled={isLoadingConflictDetail}
                          aria-label="View synchronization details"
                          title="View synchronization details"
                          style={{
                            ...pageHeaderStyles.secondaryButton,
                            minWidth: "44px",
                            minHeight: "44px",
                            justifyContent: "center",
                            padding: "10px 12px",
                          }}
                        >
                          <FiAlertCircle
                            size={18}
                            aria-hidden="true"
                            focusable="false"
                          />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      ) : null}

      </section>

      <SyncConflictDetailModal
        isOpen={
          Boolean(selectedConflictDetail) &&
          (!isInventoryCorrectionFormOpen || Boolean(pendingResolutionAction))
        }
        conflict={selectedConflictDetail}
        onClose={handleCloseConflictDetail}
        onResolve={handleResolveConflict}
        resolutionReason={resolutionReason}
        onResolutionReasonChange={handleResolutionReasonChange}
        resolutionReasonError={resolutionReasonError}
        replacementBarcode={replacementBarcode}
        onReplacementBarcodeChange={setReplacementBarcode}
        isResolving={isResolvingConflict}
        includeBarangay={isMswdoPortal}
        pendingResolutionAction={pendingResolutionAction}
        onConfirmResolve={handleConfirmResolve}
        onCancelPendingResolve={handleCancelPendingResolve}
      />

      <InventoryItemFormModal
        isOpen={isInventoryCorrectionFormOpen}
        mode="create"
        source="manual"
        conflictResolution
        conflictResolutionTarget={inventoryCorrectionTarget}
        itemData={inventoryCorrectionItemData}
        inventoryItems={inventoryCorrectionItems}
        getCurrentStockForItem={null}
        isSubmitting={isResolvingConflict}
        errorMessage={inventoryCorrectionErrorMessage}
        onClose={handleCloseInventoryCorrectionForm}
        onSubmit={handleInventoryCorrectionSubmit}
      />

      <FeedbackToast
        type={feedback.type}
        title={feedback.title}
        message={feedback.message}
        onClose={() => setFeedback({ type: "", title: "", message: "" })}
      />
    </div>
  );
};

export default SyncManagementPage;
