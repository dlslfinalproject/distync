import React, { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import PageHeader, { pageHeaderStyles } from "../components/layout/PageHeader";
import { shellStyles } from "../components/layout/BarangayLayout";
import SyncStatusBadge from "../components/shared/SyncStatusBadge";
import FeedbackToast from "../components/shared/FeedbackToast";
import SyncConflictDetailModal from "../components/shared/SyncConflictDetailModal";
import db, { LOCAL_SYNC_STATUS } from "../offline/db";
import {
  retryFailedSyncEntries,
  subscribeToSyncUpdates,
} from "../offline/syncService";
import {
  auditSyncRetryRequest,
  fetchSyncConflictDetail,
  fetchSyncHistory,
} from "../features/sync/syncHistoryService";
import {
  buildConflictPayloadSummary,
  buildPayloadSummary,
  formatSyncDateTime,
  getConflictReasonLabel,
  getResolutionStatusLabel,
  getWinningSide,
  isSafeRetryableStatus,
  matchesSyncFilter,
  SYNC_FILTERS,
} from "../features/sync/syncManagementHelpers";

const noteStyles = {
  padding: "16px 18px",
  borderRadius: "16px",
  backgroundColor: "#f8fbff",
  border: "1px solid #d7e2ef",
  color: "#365472",
  fontSize: "14px",
  lineHeight: 1.6,
};

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
    verticalAlign: "top",
    lineHeight: 1.5,
  },
};

const filterButtonStyles = (isActive) => ({
  border: "none",
  borderRadius: "999px",
  padding: "10px 16px",
  backgroundColor: isActive ? "#dbe8f6" : "#eef5fc",
  color: isActive ? "#17324d" : "#40617f",
  fontWeight: 700,
  cursor: "pointer",
});

const detailTextStyles = {
  color: "#60738a",
  fontSize: "12px",
  lineHeight: 1.5,
  marginTop: "4px",
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
  const [activeFilter, setActiveFilter] = useState("ALL");
  const [selectedConflictDetail, setSelectedConflictDetail] = useState(null);
  const [feedback, setFeedback] = useState({
    type: "",
    title: "",
    message: "",
  });

  const syncQueueEntries =
    useLiveQuery(() => db.syncQueue.orderBy("updatedAt").reverse().toArray(), [], []) ||
    [];

  const isOnline =
    typeof navigator === "undefined" ? true : navigator.onLine;

  const summary = useMemo(() => {
    return syncQueueEntries.reduce(
      (currentSummary, entry) => {
        currentSummary.total += 1;

        if (entry.status === LOCAL_SYNC_STATUS.PENDING) {
          currentSummary.pending += 1;
        }

        if (entry.status === LOCAL_SYNC_STATUS.FAILED) {
          currentSummary.failed += 1;
        }

        if (entry.status === LOCAL_SYNC_STATUS.CONFLICT) {
          currentSummary.conflicts += 1;
        }

        return currentSummary;
      },
      {
        total: 0,
        pending: 0,
        failed: 0,
        conflicts: 0,
      },
    );
  }, [syncQueueEntries]);

  const failedQueueEntries = useMemo(
    () =>
      syncQueueEntries.filter(
        (entry) => entry.status === LOCAL_SYNC_STATUS.FAILED,
      ),
    [syncQueueEntries],
  );

  const filteredQueueEntries = useMemo(() => {
    return syncQueueEntries.filter((entry) =>
      matchesSyncFilter(entry.status, activeFilter),
    );
  }, [activeFilter, syncQueueEntries]);

  const filteredTransactions = useMemo(() => {
    return syncHistory.transactions.filter((transaction) =>
      matchesSyncFilter(transaction.sync_status, activeFilter),
    );
  }, [activeFilter, syncHistory.transactions]);

  const filteredConflicts = useMemo(() => {
    return syncHistory.conflicts.filter((conflict) =>
      matchesSyncFilter(
        conflict.status === "RESOLVED" ? "RESOLVED" : LOCAL_SYNC_STATUS.CONFLICT,
        activeFilter,
      ),
    );
  }, [activeFilter, syncHistory.conflicts]);

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

  const handleRetrySync = async () => {
    if (!failedQueueEntries.length) {
      return;
    }

    setIsRetrying(true);

    try {
      try {
        await auditSyncRetryRequest(
          failedQueueEntries.map((entry) => ({
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

      await retryFailedSyncEntries(failedQueueEntries.map((entry) => entry.id));
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

  return (
    <>
      <PageHeader
        title="SYNC CENTER"
        description="Review queued offline actions, failed sync attempts, and conflict results across your current module."
        actions={[
          {
            label: isRetrying ? "Retrying..." : "Retry failed syncs",
            variant: "secondary",
            onClick: handleRetrySync,
            disabled: !isOnline || failedQueueEntries.length === 0 || isRetrying,
          },
        ]}
      />

      <section style={shellStyles.card}>
        <div style={shellStyles.statGrid}>
          <div>
            <p style={shellStyles.mutedText}>Pending Queue</p>
            <p style={shellStyles.statValue}>{summary.pending}</p>
          </div>
          <div>
            <p style={shellStyles.mutedText}>Failed Sync</p>
            <p style={shellStyles.statValue}>{failedQueueEntries.length}</p>
          </div>
          <div>
            <p style={shellStyles.mutedText}>Conflicts</p>
            <p style={shellStyles.statValue}>{summary.conflicts}</p>
          </div>
          <div>
            <p style={shellStyles.mutedText}>Connection</p>
            <p style={shellStyles.statValue}>{isOnline ? "Online" : "Offline"}</p>
          </div>
        </div>
      </section>

      <section style={shellStyles.card}>
        <div style={noteStyles}>
          Delete/deactivate operations require online connection to avoid unsafe
          rollback conflicts. Offline sync is currently limited to safe create
          and update actions only.
        </div>
      </section>

      <section style={shellStyles.card}>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          {SYNC_FILTERS.map((filter) => (
            <button
              key={filter.key}
              type="button"
              onClick={() => setActiveFilter(filter.key)}
              style={filterButtonStyles(activeFilter === filter.key)}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </section>

      <section style={shellStyles.card}>
        <div style={{ marginBottom: "16px" }}>
          <h3 style={{ margin: 0, color: "#17324d" }}>Local Sync Queue</h3>
          <p style={{ ...shellStyles.mutedText, marginTop: "8px" }}>
            Queued offline actions are stored in IndexedDB and retried when the
            device goes back online.
          </p>
        </div>

        {filteredQueueEntries.length === 0 ? (
          <p style={shellStyles.mutedText}>
            No local sync queue entries match the current filter.
          </p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={tableStyles.table}>
              <thead>
                <tr>
                  <th style={tableStyles.th}>Module</th>
                  <th style={tableStyles.th}>Table</th>
                  <th style={tableStyles.th}>Action</th>
                  <th style={tableStyles.th}>Status</th>
                  <th style={tableStyles.th}>Created</th>
                  <th style={tableStyles.th}>Synced</th>
                  <th style={tableStyles.th}>Details</th>
                  <th style={tableStyles.th}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredQueueEntries.map((entry) => (
                  <tr key={entry.id}>
                    <td style={tableStyles.td}>{entry.moduleName || "--"}</td>
                    <td style={tableStyles.td}>{entry.entityType || "--"}</td>
                    <td style={tableStyles.td}>{entry.actionKey || "--"}</td>
                    <td style={tableStyles.td}>
                      <SyncStatusBadge status={entry.status} />
                    </td>
                    <td style={tableStyles.td}>
                      {formatSyncDateTime(entry.clientTimestamp || entry.createdAt)}
                    </td>
                    <td style={tableStyles.td}>
                      {formatSyncDateTime(entry.syncedAt)}
                    </td>
                    <td style={tableStyles.td}>
                      <div>{buildPayloadSummary(entry.payload)}</div>
                      <div style={detailTextStyles}>
                        {entry.lastError ||
                          entry.serverMessage ||
                          entry.entityServerId ||
                          entry.entityLocalId ||
                          "--"}
                      </div>
                    </td>
                    <td style={tableStyles.td}>
                      <button
                        type="button"
                        onClick={handleRetrySync}
                        disabled={
                          !isOnline ||
                          !isSafeRetryableStatus(entry.status) ||
                          isRetrying
                        }
                        style={{
                          ...pageHeaderStyles.secondaryButton,
                          opacity:
                            !isOnline ||
                            !isSafeRetryableStatus(entry.status) ||
                            isRetrying
                              ? 0.7
                              : 1,
                        }}
                      >
                        Retry failed syncs
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section style={shellStyles.card}>
        <div style={{ marginBottom: "16px" }}>
          <h3 style={{ margin: 0, color: "#17324d" }}>Sync History</h3>
          <p style={{ ...shellStyles.mutedText, marginTop: "8px" }}>
            Server-side `sync_transactions` records for the current user.
          </p>
        </div>

        {isLoadingHistory ? (
          <p style={shellStyles.mutedText}>Loading sync history...</p>
        ) : errorMessage ? (
          <p style={{ ...shellStyles.mutedText, color: "#a14d58" }}>
            {errorMessage}
          </p>
        ) : filteredTransactions.length === 0 ? (
          <p style={shellStyles.mutedText}>
            No sync history matches the current filter.
          </p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={tableStyles.table}>
              <thead>
                <tr>
                  <th style={tableStyles.th}>Module / Table</th>
                  <th style={tableStyles.th}>Entity</th>
                  <th style={tableStyles.th}>Operation</th>
                  <th style={tableStyles.th}>Status</th>
                  <th style={tableStyles.th}>Created</th>
                  <th style={tableStyles.th}>Synced</th>
                  <th style={tableStyles.th}>Details</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.map((transaction) => (
                  <tr key={transaction.id}>
                    <td style={tableStyles.td}>
                      <div>sync_transactions</div>
                      <div style={detailTextStyles}>{transaction.entity_type || "--"}</div>
                    </td>
                    <td style={tableStyles.td}>
                      {transaction.entity_type}
                      <div style={{ color: "#60738a", fontSize: "12px" }}>
                        {transaction.entity_server_id ||
                          transaction.entity_local_id ||
                          "--"}
                      </div>
                    </td>
                    <td style={tableStyles.td}>{transaction.operation_type}</td>
                    <td style={tableStyles.td}>
                      <SyncStatusBadge status={transaction.sync_status} />
                    </td>
                    <td style={tableStyles.td}>
                      {formatSyncDateTime(
                        transaction.created_at || transaction.client_timestamp,
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

      <section style={shellStyles.card}>
        <div style={{ marginBottom: "16px" }}>
          <h3 style={{ margin: 0, color: "#17324d" }}>Conflict Log</h3>
          <p style={{ ...shellStyles.mutedText, marginTop: "8px" }}>
            Latest timestamp conflict resolution results stored in
            `sync_conflicts`.
          </p>
        </div>

        {isLoadingHistory ? (
          <p style={shellStyles.mutedText}>Loading conflicts...</p>
        ) : filteredConflicts.length === 0 ? (
          <p style={shellStyles.mutedText}>
            No conflicts match the current filter.
          </p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={tableStyles.table}>
              <thead>
                <tr>
                  <th style={tableStyles.th}>Table</th>
                  <th style={tableStyles.th}>Entity</th>
                  <th style={tableStyles.th}>Conflict Type</th>
                  <th style={tableStyles.th}>Status</th>
                  <th style={tableStyles.th}>Conflict Reason</th>
                  <th style={tableStyles.th}>Local Summary</th>
                  <th style={tableStyles.th}>Server Summary</th>
                  <th style={tableStyles.th}>Winning Side</th>
                  <th style={tableStyles.th}>Resolution Status</th>
                  <th style={tableStyles.th}>Resolved At</th>
                  <th style={tableStyles.th}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredConflicts.map((conflict) => (
                  <tr key={conflict.id}>
                    <td style={tableStyles.td}>sync_conflicts</td>
                    <td style={tableStyles.td}>
                      {conflict.entity_type}
                      <div style={{ color: "#60738a", fontSize: "12px" }}>
                        {conflict.entity_server_id || "--"}
                      </div>
                    </td>
                    <td style={tableStyles.td}>{conflict.conflict_type}</td>
                    <td style={tableStyles.td}>
                      <SyncStatusBadge
                        status={conflict.status === "RESOLVED" ? "RESOLVED" : "CONFLICT"}
                      />
                    </td>
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
                    <td style={tableStyles.td}>
                      {getWinningSide(conflict)}
                    </td>
                    <td style={tableStyles.td}>
                      {getResolutionStatusLabel(conflict)}
                      <div style={detailTextStyles}>
                        {conflict.resolution_strategy || "--"}
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
                        View Detail
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <SyncConflictDetailModal
        isOpen={Boolean(selectedConflictDetail)}
        conflict={selectedConflictDetail}
        onClose={() => setSelectedConflictDetail(null)}
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
