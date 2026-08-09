import React, { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { FiFilter, FiRefreshCw, FiSearch } from "react-icons/fi";
import PageHeader, { pageHeaderStyles } from "../components/layout/PageHeader";
import { shellStyles } from "../components/layout/BarangayLayout";
import SyncStatusBadge from "../components/shared/SyncStatusBadge";
import FeedbackToast from "../components/shared/FeedbackToast";
import SyncConflictDetailModal from "../components/shared/SyncConflictDetailModal";
import StatusCard from "../components/shared/StatusCard";
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
  resolveSyncConflict,
} from "../features/sync/syncHistoryService";
import {
  buildConflictPayloadSummary,
  buildPayloadSummary,
  buildSyncSearchText,
  formatSyncDateTime,
  getConflictReasonLabel,
  getResolutionStatusLabel,
  getSyncRecordDetails,
  getWinningSide,
  isSafeRetryableQueueEntry,
  matchesRecordTypeFilter,
  matchesSyncFilter,
} from "../features/sync/syncManagementHelpers";

const RECORD_TYPE_OPTIONS = [
  { value: "ALL", label: "All Records" },
  { value: "EVACUEE_MASTERLIST", label: "Evacuee Masterlist" },
  { value: "RELIEF_GOODS_DISTRIBUTION", label: "Relief Goods Distribution" },
  { value: "DISASTER_EVENT", label: "Disaster Event Management" },
  { value: "INVENTORY", label: "Inventory" },
];

const STATUS_OPTIONS = [
  { value: "ALL", label: "All" },
  { value: LOCAL_SYNC_STATUS.PENDING, label: "Pending" },
  { value: LOCAL_SYNC_STATUS.SYNCED, label: "Synced" },
  { value: LOCAL_SYNC_STATUS.FAILED, label: "Failed" },
  { value: LOCAL_SYNC_STATUS.CONFLICT, label: "Conflict" },
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
  { value: "AUDIT", label: "Sync Audit Trail" },
  { value: "CONFLICTS", label: "Conflict Review" },
];

const EMPTY_MESSAGE = "No matching records found. Try adjusting your search or filters.";

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

const filterPopoverStyles = {
  position: "absolute",
  right: 0,
  top: "calc(100% + 12px)",
  width: "min(340px, calc(100vw - 48px))",
  padding: "20px",
  border: "1px solid #d6e3f1",
  borderRadius: "20px",
  backgroundColor: "#ffffff",
  boxShadow: "0 22px 44px rgba(31, 64, 95, 0.18)",
  zIndex: 20,
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

  const isOnline = typeof navigator === "undefined" ? true : navigator.onLine;

  const failedQueueEntries = useMemo(
    () =>
      syncQueueEntries.filter(
        (entry) => isSafeRetryableQueueEntry(entry),
      ),
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
      failed: failedQueueEntries.length + failedTransactions.length,
      pending: syncQueueEntries.filter(
        (entry) => entry.status === LOCAL_SYNC_STATUS.PENDING,
      ).length,
      synced: syncedTransactions.length,
    };
  }, [failedQueueEntries.length, syncHistory.conflicts, syncHistory.transactions, syncQueueEntries]);

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
      setSyncHistory({
        transactions: Array.isArray(response.transactions)
          ? response.transactions
          : [],
        conflicts: Array.isArray(response.conflicts) ? response.conflicts : [],
      });
    } catch (error) {
      setErrorMessage(error.message || "Failed to load sync history.");
    } finally {
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    loadSyncHistory();
  }, []);

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

      await retryFailedSyncEntries(retryTargets.map((entry) => entry.id));
      await loadSyncHistory();
      setFeedback({
        type: "success",
        title: "Retry Requested",
        message: "Failed sync entries were retried safely.",
      });
    } catch (error) {
      setFeedback({
        type: "error",
        title: "Retry Error",
        message: error.message || "Failed to retry the selected sync entries.",
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
        message: error.message || "Failed to load sync conflict detail.",
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
        message:
          error.message ||
          "The conflict could not be resolved. Refresh and review the latest state.",
      });
      await loadSyncHistory();
    } finally {
      setIsResolvingConflict(false);
    }
  };

  const renderRecordCells = (record) => {
    const details = getSyncRecordDetails(record);

    return (
      <>
        <td style={tableStyles.td}>{details.recordType}</td>
        <td style={tableStyles.td}>{details.actionLabel}</td>
        <td style={tableStyles.td}>
          <div>{details.subject}</div>
          <div style={detailTextStyles}>
            {details.stubNumber !== "--" ? details.stubNumber : details.familyHeadName}
          </div>
        </td>
        <td style={tableStyles.td}>{details.barangay}</td>
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
            <span style={fieldStyles.label}>Sync Status</span>
            <select
              value={filters.status}
              onChange={(event) => updateFilter("status", event.target.value)}
              style={fieldStyles.input}
            >
              {STATUS_OPTIONS.map((option) => (
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
        <StatusCard label="Pending Queue" value={summary.pending} />
        <StatusCard label="Synced Records" value={summary.synced} />
        <StatusCard label="Failed Sync" value={summary.failed} />
        <StatusCard label="Needs Review" value={summary.conflicts} />
      </section>

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
            placeholder="Search family head, stub number, barangay, action, or event"
            style={{
              ...fieldStyles.input,
              paddingLeft: "44px",
              backgroundColor: "#ffffff",
              boxShadow: "0 16px 30px rgba(31, 64, 96, 0.08)",
            }}
          />
        </div>

        <div style={{ position: "relative" }}>
          <button
            type="button"
            onClick={() => setIsFilterOpen((isOpen) => !isOpen)}
            style={toolbarButtonStyles}
          >
            <FiFilter size={18} />
            Filter
          </button>

          {isFilterOpen ? (
            <div style={filterPopoverStyles}>
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
            </div>
          ) : null}
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
      <section style={shellStyles.card}>
        <h3 style={{ margin: "0 0 16px", color: "#17324d" }}>Offline Queue</h3>

        {filteredQueueEntries.length === 0 ? (
          <p style={shellStyles.mutedText}>{EMPTY_MESSAGE}</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={tableStyles.table}>
              <thead>
                <tr>
                  <th style={tableStyles.th}>Record Type</th>
                  <th style={tableStyles.th}>Action</th>
                  <th style={tableStyles.th}>Family / Stub</th>
                  <th style={tableStyles.th}>Barangay</th>
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

                  return (
                    <tr key={entry.id}>
                      {renderRecordCells(entry)}
                      <td style={tableStyles.td}>
                        <SyncStatusBadge status={entry.status} />
                      </td>
                      <td style={tableStyles.td}>
                        {formatSyncDateTime(entry.clientTimestamp || entry.createdAt)}
                      </td>
                      <td style={tableStyles.td}>{details.notes}</td>
                      <td style={tableStyles.td}>
                        <button
                          type="button"
                          onClick={() => handleRetrySync([entry.id])}
                          disabled={
                            !isOnline ||
                            !isSafeRetryableQueueEntry(entry) ||
                            isRetrying
                          }
                          style={{
                            ...pageHeaderStyles.secondaryButton,
                            opacity:
                              !isOnline ||
                              !isSafeRetryableQueueEntry(entry) ||
                              isRetrying
                                ? 0.7
                                : 1,
                          }}
                        >
                          Retry
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

      {activeSyncTab === "AUDIT" ? (
      <section style={shellStyles.card}>
        <h3 style={{ margin: "0 0 16px", color: "#17324d" }}>Sync Audit Trail</h3>

        {isLoadingHistory ? (
          <p style={shellStyles.mutedText}>Loading sync history...</p>
        ) : errorMessage ? (
          <p style={{ ...shellStyles.mutedText, color: "#a14d58" }}>
            {errorMessage}
          </p>
        ) : filteredTransactions.length === 0 ? (
          <p style={shellStyles.mutedText}>{EMPTY_MESSAGE}</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={tableStyles.table}>
              <thead>
                <tr>
                  <th style={tableStyles.th}>Record Type</th>
                  <th style={tableStyles.th}>Action</th>
                  <th style={tableStyles.th}>Family / Stub</th>
                  <th style={tableStyles.th}>Barangay</th>
                  <th style={tableStyles.th}>Disaster Event</th>
                  <th style={tableStyles.th}>Status</th>
                  <th style={tableStyles.th}>Queued At</th>
                  <th style={tableStyles.th}>Synced At</th>
                  <th style={tableStyles.th}>Notes</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.map((transaction) => (
                  <tr key={transaction.id}>
                    {renderRecordCells(transaction)}
                    <td style={tableStyles.td}>
                      <SyncStatusBadge status={transaction.sync_status} />
                    </td>
                    <td style={tableStyles.td}>
                      {formatSyncDateTime(
                        transaction.client_timestamp || transaction.created_at,
                      )}
                    </td>
                    <td style={tableStyles.td}>
                      {formatSyncDateTime(transaction.server_timestamp)}
                    </td>
                    <td style={tableStyles.td}>
                      <div>{buildPayloadSummary(transaction.payload_json?.payload)}</div>
                      <div style={detailTextStyles}>
                        {transaction.error_message || "--"}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      ) : null}

      {activeSyncTab === "CONFLICTS" ? (
      <section style={shellStyles.card}>
        <h3 style={{ margin: "0 0 16px", color: "#17324d" }}>Conflict Review</h3>

        {isLoadingHistory ? (
          <p style={shellStyles.mutedText}>Loading conflicts...</p>
        ) : filteredConflicts.length === 0 ? (
          <p style={shellStyles.mutedText}>{EMPTY_MESSAGE}</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={tableStyles.table}>
              <thead>
                <tr>
                  <th style={tableStyles.th}>Record Type</th>
                  <th style={tableStyles.th}>Family / Stub</th>
                  <th style={tableStyles.th}>Reason</th>
                  <th style={tableStyles.th}>Local Record</th>
                  <th style={tableStyles.th}>Server Record</th>
                  <th style={tableStyles.th}>Decision</th>
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
                      <td style={tableStyles.td}>
                        {getConflictReasonLabel(conflict)}
                        <div style={detailTextStyles}>
                          {conflict.error_message || conflict.resolution_strategy || "--"}
                        </div>
                      </td>
                      <td style={tableStyles.td}>
                        {buildConflictPayloadSummary(conflict.local_payload_json)}
                      </td>
                      <td style={tableStyles.td}>
                        {buildConflictPayloadSummary(conflict.server_payload_json)}
                      </td>
                      <td style={tableStyles.td}>{getWinningSide(conflict)}</td>
                      <td style={tableStyles.td}>
                        <SyncStatusBadge status={getConflictFilterStatus(conflict)} />
                        <div style={detailTextStyles}>
                          {getResolutionStatusLabel(conflict)}
                        </div>
                      </td>
                      <td style={tableStyles.td}>
                        {formatSyncDateTime(conflict.resolved_at)}
                      </td>
                      <td style={tableStyles.td}>
                        <button
                          type="button"
                          onClick={() => handleOpenConflictDetail(conflict.id)}
                          disabled={isLoadingConflictDetail}
                          style={pageHeaderStyles.secondaryButton}
                        >
                          View Details
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
