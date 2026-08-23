import React, { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { FiEye, FiFilter, FiRefreshCw, FiSearch } from "react-icons/fi";
import PageHeader, { pageHeaderStyles } from "../components/layout/PageHeader";
import { shellStyles } from "../components/layout/BarangayLayout";
import SyncStatusBadge from "../components/shared/SyncStatusBadge";
import FeedbackToast from "../components/shared/FeedbackToast";
import SyncConflictDetailModal from "../components/shared/SyncConflictDetailModal";
import StatusCard from "../components/shared/StatusCard";
import ResponsiveFilterPopover from "../components/shared/ResponsiveFilterPopover";
import db, { LOCAL_SYNC_STATUS } from "../offline/db.js";
import {
  retryFailedSyncEntries,
  subscribeToSyncUpdates,
} from "../offline/syncService";
import { getVisibleSyncQueueEntriesByUpdatedAt } from "../offline/syncQueue";
import {
  auditSyncRetryRequest,
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
  getSyncQueueNotes,
  getSyncRecordDetails,
  isSafeRetryableQueueEntry,
  matchesRecordTypeFilter,
  matchesSyncFilter,
} from "../features/sync/syncManagementHelpers";
import {
  getSafeSyncErrorMessage,
  getSyncStatusSummaryMessage,
  isSyncIdempotencyMismatch,
  SYNC_PRESENTATION_MESSAGES,
} from "../offline/syncStatus.js";

const RECORD_TYPE_OPTIONS = [
  { value: "ALL", label: "All Records" },
  { value: "EVACUEE_MASTERLIST", label: "Evacuee Masterlist" },
  { value: "RELIEF_GOODS_DISTRIBUTION", label: "Relief Goods Distribution" },
  { value: "DISASTER_EVENT", label: "Disaster Event Management" },
  { value: "INVENTORY", label: "Inventory" },
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
  { value: "AUDIT", label: "Sync History" },
  { value: "CONFLICTS", label: "Conflict Review" },
];

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
};

const syncTabButtonStyles = (isActive) => ({
  padding: "12px 24px",
  border: "none",
  borderBottom: isActive ? "3px solid #17324d" : "3px solid transparent",
  background: "none",
  color: isActive ? "#17324d" : "#6b8298",
  cursor: "pointer",
  fontSize: "14px",
  fontWeight: 700,
  whiteSpace: "nowrap",
});

const tableStyles = {
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  th: {
    padding: "12px 14px",
    textAlign: "left",
    fontSize: "12px",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "#66809c",
    borderBottom: "1px solid #e0eaf4",
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
  minWidth: "980px",
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

const applySyncFilters = (records, filters, statusAccessor) => {
  const searchText = filters.search.trim().toLowerCase();

  return sortSyncRecords(
    records.filter((record) => {
      const status = statusAccessor(record);

      return (
        matchesSyncFilter(status, filters.status) &&
        matchesRecordTypeFilter(record, filters.recordType) &&
        isWithinDateRange(record, filters.dateFrom, filters.dateTo) &&
        (!searchText || buildSyncSearchText(record).includes(searchText))
      );
    }),
    filters.order,
  );
};

const SyncManagementPage = () => {
  const [syncHistory, setSyncHistory] = useState({
    transactions: [],
    conflicts: [],
  });
  const [syncStatusSummary, setSyncStatusSummary] = useState({
    conflictCount: 0,
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
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [activeSyncTab, setActiveSyncTab] = useState("QUEUE");
  const [filters, setFilters] = useState({
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

  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine,
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
      syncQueueEntries.filter(
        (entry) => isSafeRetryableQueueEntry(entry),
      ),
    [syncQueueEntries],
  );
  const failedQueueCount = useMemo(
    () =>
      syncQueueEntries.filter(
        (entry) => entry.status === LOCAL_SYNC_STATUS.FAILED,
      ).length,
    [syncQueueEntries],
  );

  const summary = useMemo(() => {
    const unresolvedConflicts = syncHistory.conflicts.filter(
      (conflict) => conflict.status !== "RESOLVED",
    );
    const failedTransactions = syncHistory.transactions.filter(
      (transaction) => transaction.sync_status === LOCAL_SYNC_STATUS.FAILED,
    );
    const syncedTransactions = syncHistory.transactions.filter(
      (transaction) => transaction.sync_status === LOCAL_SYNC_STATUS.SYNCED,
    );

    return {
      conflicts:
        syncQueueEntries.filter(
          (entry) => entry.status === LOCAL_SYNC_STATUS.CONFLICT,
        ).length + unresolvedConflicts.length,
      failed: failedQueueCount + failedTransactions.length,
      pending: syncQueueEntries.filter(
        (entry) => entry.status === LOCAL_SYNC_STATUS.PENDING,
      ).length,
      synced: syncedTransactions.length,
      lastSuccessfulSyncAt: syncStatusSummary.lastSuccessfulSyncAt,
    };
  }, [
    failedQueueEntries.length,
    failedQueueCount,
    syncHistory.conflicts,
    syncHistory.transactions,
    syncQueueEntries,
    syncStatusSummary.lastSuccessfulSyncAt,
  ]);

  const filteredQueueEntries = useMemo(
    () => applySyncFilters(syncQueueEntries, filters, (entry) => entry.status),
    [filters, syncQueueEntries],
  );

  const filteredTransactions = useMemo(
    () =>
      applySyncFilters(
        syncHistory.transactions,
        filters,
        (transaction) => transaction.sync_status,
      ),
    [filters, syncHistory.transactions],
  );

  const filteredConflicts = useMemo(
    () =>
      applySyncFilters(syncHistory.conflicts, filters, getConflictFilterStatus),
    [filters, syncHistory.conflicts],
  );

  const loadSyncHistory = async () => {
    setIsLoadingHistory(true);
    setErrorMessage("");

    try {
      const response = await fetchSyncHistory({ limit: 100 });
      const summaryResponse = await fetchSyncStatusSummary();
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
  };

  useEffect(() => {
    loadSyncHistory();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const updateConnectivity = () => {
      setIsOnline(navigator.onLine);
    };

    window.addEventListener("online", updateConnectivity);
    window.addEventListener("offline", updateConnectivity);

    return () => {
      window.removeEventListener("online", updateConnectivity);
      window.removeEventListener("offline", updateConnectivity);
    };
  }, []);

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
  }, []);

  const updateFilter = (key, value) => {
    setFilters((currentFilters) => ({
      ...currentFilters,
      [key]: value,
    }));
  };

  const handleRetrySync = async (entryIds = null) => {
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

  const handleResolveConflict = async (action) => {
    if (!selectedConflictDetail?.id || isResolvingConflict) {
      return;
    }

    const trimmedReason = resolutionReason.trim();

    if (["KEEP_SERVER", "APPLY_LOCAL"].includes(action) && !trimmedReason) {
      setFeedback({
        type: "error",
        title: "Resolution Reason Required",
        message: "Add a reason before submitting this resolution.",
      });
      return;
    }

    setIsResolvingConflict(true);

    try {
      const response = await resolveSyncConflict(selectedConflictDetail.id, {
        action,
        reason: trimmedReason,
      });
      const resolvedConflict = response?.data || null;

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
      await loadSyncHistory();
      setFeedback({
        type: "success",
        title: "Conflict Resolved",
        message: "The conflict review decision was recorded.",
      });
    } catch (error) {
      setFeedback({
        type: "error",
        title: "Resolution Error",
        message: getSafeSyncErrorMessage(
          error,
          "The conflict could not be resolved. Refresh and review the latest state.",
        ),
      });
      await loadSyncHistory();
    } finally {
      setIsResolvingConflict(false);
    }
  };

  const renderRecordCells = (
    record,
    { includeBarangay = true, includeOperation = false } = {},
  ) => {
    const details = getSyncRecordDetails(record);

    return (
      <>
        <td style={tableStyles.td}>{details.recordType}</td>
        <td style={tableStyles.td}>
          {includeOperation ? details.operation : details.actionLabel}
        </td>
        <td style={tableStyles.td}>
          <div>{details.subject}</div>
          {details.secondaryLabel ? (
            <div style={detailTextStyles}>{details.secondaryLabel}</div>
          ) : null}
        </td>
        {includeBarangay ? <td style={tableStyles.td}>{details.barangay}</td> : null}
        <td style={tableStyles.td}>{details.disasterEvent}</td>
      </>
    );
  };

  return (
    <>
      <PageHeader title="SYNC CENTER" />

      <section style={shellStyles.card}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "18px",
          }}
        >
          <label>
            <span style={fieldStyles.label}>Record Type</span>
            <select
              value={filters.recordType}
              onChange={(event) => updateFilter("recordType", event.target.value)}
              style={fieldStyles.input}
            >
              {RECORD_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label>
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

          <label>
            <span style={fieldStyles.label}>Date From</span>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(event) => updateFilter("dateFrom", event.target.value)}
              style={fieldStyles.input}
            />
          </label>

          <label>
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

      <section style={shellStyles.statGrid}>
        <StatusCard label="Connection" value={isOnline ? "Online" : "Offline"} />
        <StatusCard label="Pending Queue" value={summary.pending} />
        <StatusCard label="Failed Sync" value={summary.failed} />
        <StatusCard label="Needs Review" value={summary.conflicts} />
        <StatusCard
          label="Last Successful Sync"
          value={formatSyncDateTime(summary.lastSuccessfulSyncAt)}
        />
      </section>

      <p
        role="status"
        aria-live="polite"
        style={{
          color: summary.failed || summary.pending ? "#8a3d33" : "#2d7a4f",
          fontSize: "14px",
          fontWeight: 700,
          margin: "-10px 0 18px",
        }}
      >
        {getSyncStatusSummaryMessage(summary)}
      </p>

      <div
        style={{
          alignItems: "center",
          display: "grid",
          gap: "16px",
          gridTemplateColumns: "minmax(260px, 1fr) auto auto",
        }}
      >
        <div style={{ position: "relative" }}>
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

        <div>
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
          type="button"
          onClick={() => handleRetrySync()}
          disabled={!isOnline || failedQueueEntries.length === 0 || isRetrying}
          style={{
            ...pageHeaderStyles.primaryButton,
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

      <section style={{ ...shellStyles.card, padding: "22px 36px 0" }}>
        <div
          role="tablist"
          aria-label="Sync Center sections"
          style={{
            borderBottom: "1px solid #d6e2ef",
            display: "flex",
            flexWrap: "wrap",
            gap: "8px",
            overflowX: "auto",
          }}
        >
          {SYNC_SECTION_TABS.map((tab) => (
            <button
              key={tab.value}
              id={SYNC_TAB_IDS[tab.value]}
              role="tab"
              aria-selected={activeSyncTab === tab.value}
              aria-controls={SYNC_TABPANEL_IDS[tab.value]}
              type="button"
              onClick={() => setActiveSyncTab(tab.value)}
              style={syncTabButtonStyles(activeSyncTab === tab.value)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      {activeSyncTab === "QUEUE" ? (
      <section
        id={SYNC_TABPANEL_IDS.QUEUE}
        role="tabpanel"
        aria-labelledby={SYNC_TAB_IDS.QUEUE}
        style={shellStyles.card}
      >
        <h2 style={srOnlyStyles}>Offline Queue</h2>

        {filteredQueueEntries.length === 0 ? (
          <p style={shellStyles.mutedText}>
            {syncQueueEntries.length === 0 ? EMPTY_QUEUE_MESSAGE : EMPTY_MESSAGE}
          </p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={offlineQueueTableStyles}>
              <thead>
                <tr>
                  <th style={tableStyles.th}>Record Type</th>
                  <th style={tableStyles.th}>Operation</th>
                  <th style={tableStyles.th}>Affected Record</th>
                  <th style={tableStyles.th}>Disaster Event</th>
                  <th style={tableStyles.th}>Status</th>
                  <th style={tableStyles.th}>Queued At</th>
                  <th style={tableStyles.th}>Notes</th>
                  <th style={tableStyles.th}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredQueueEntries.map((entry) => {
                  const details = getSyncRecordDetails(entry);
                  const canRetry = isSafeRetryableQueueEntry(entry);

                  return (
                    <tr key={entry.id}>
                      {renderRecordCells(entry, {
                        includeBarangay: false,
                        includeOperation: true,
                      })}
                      <td style={tableStyles.td}>
                        <SyncStatusBadge status={entry.status} />
                      </td>
                      <td style={tableStyles.td}>
                        {formatSyncDateTime(entry.clientTimestamp || entry.createdAt)}
                      </td>
                      <td
                        style={{
                          ...tableStyles.td,
                          minWidth: "260px",
                          maxWidth: "420px",
                          overflowWrap: "break-word",
                        }}
                      >
                        {getSyncQueueNotes(entry)}
                      </td>
                      <td style={tableStyles.td}>
                        {canRetry ? (
                          <button
                            type="button"
                            onClick={() => handleRetrySync([entry.id])}
                            disabled={!isOnline || isRetrying}
                            aria-label={`Retry synchronization for ${details.subject}`}
                            aria-busy={isRetrying}
                            title="Retry synchronization"
                            style={{
                              ...pageHeaderStyles.secondaryButton,
                              minWidth: "44px",
                              minHeight: "44px",
                              justifyContent: "center",
                              padding: "10px 12px",
                              opacity: !isOnline || isRetrying ? 0.7 : 1,
                            }}
                          >
                            <FiRefreshCw
                              size={18}
                              aria-hidden="true"
                              focusable="false"
                            />
                          </button>
                        ) : (
                          <span aria-label="No action available">—</span>
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

      {activeSyncTab === "AUDIT" ? (
      <section
        id={SYNC_TABPANEL_IDS.AUDIT}
        role="tabpanel"
        aria-labelledby={SYNC_TAB_IDS.AUDIT}
        style={shellStyles.card}
      >
        <h2 style={srOnlyStyles}>Sync History</h2>

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
          <div style={{ overflowX: "auto" }}>
            <table style={syncHistoryTableStyles}>
              <thead>
                <tr>
                  <th style={tableStyles.th}>Record Type</th>
                  <th style={tableStyles.th}>Action</th>
                  <th style={tableStyles.th}>Affected Record</th>
                  <th style={tableStyles.th}>Disaster Event</th>
                  <th style={tableStyles.th}>Status</th>
                  <th style={tableStyles.th}>Queued At</th>
                  <th style={tableStyles.th}>Processed At</th>
                  <th style={tableStyles.th}>Notes</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.map((transaction) => {
                  const notes = getSyncHistoryNotes(transaction);

                  return (
                    <tr key={transaction.id}>
                      {renderRecordCells(transaction, { includeBarangay: false })}
                      <td style={tableStyles.td}>
                        <SyncStatusBadge status={transaction.sync_status} />
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
        style={shellStyles.card}
      >
        <h2 style={srOnlyStyles}>Conflict Review</h2>

        {isLoadingHistory ? (
          <p style={shellStyles.mutedText}>Loading conflicts...</p>
        ) : filteredConflicts.length === 0 ? (
          <p style={shellStyles.mutedText}>
            {syncHistory.conflicts.length === 0 ? EMPTY_CONFLICT_MESSAGE : EMPTY_MESSAGE}
          </p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={conflictReviewTableStyles}>
              <thead>
                <tr>
                  <th style={tableStyles.th}>Record Type</th>
                  <th style={tableStyles.th}>Affected Record</th>
                  <th style={tableStyles.th}>Conflict Reason</th>
                  <th style={tableStyles.th}>Status</th>
                  <th style={tableStyles.th}>Resolved At</th>
                  <th style={tableStyles.th}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredConflicts.map((conflict) => {
                  const details = getSyncRecordDetails(conflict);

                  return (
                    <tr key={conflict.id}>
                      <td style={tableStyles.td}>{details.recordType}</td>
                      <td style={tableStyles.td}>{details.subject}</td>
                      <td style={tableStyles.td}>{getConflictReasonLabel(conflict)}</td>
                      <td style={tableStyles.td}>
                        <SyncStatusBadge
                          status={conflict.status === "RESOLVED" ? "RESOLVED" : "OPEN"}
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
                          <FiEye size={18} aria-hidden="true" focusable="false" />
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

      <SyncConflictDetailModal
        isOpen={Boolean(selectedConflictDetail)}
        conflict={selectedConflictDetail}
        onClose={() => {
          setSelectedConflictDetail(null);
          setResolutionReason("");
        }}
        onResolve={handleResolveConflict}
        resolutionReason={resolutionReason}
        onResolutionReasonChange={setResolutionReason}
        isResolving={isResolvingConflict}
      />

      <FeedbackToast
        type={feedback.type}
        title={feedback.title}
        message={feedback.message}
        onClose={() => setFeedback({ type: "", title: "", message: "" })}
      />
    </>
  );
};

export default SyncManagementPage;
