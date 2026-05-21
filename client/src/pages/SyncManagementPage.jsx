import React, { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import PageHeader, { pageHeaderStyles } from "../components/layout/PageHeader";
import { shellStyles } from "../components/layout/BarangayLayout";
import SyncStatusBadge from "../components/shared/SyncStatusBadge";
import db, { LOCAL_SYNC_STATUS } from "../offline/db";
import {
  flushPendingSyncEntries,
  subscribeToSyncUpdates,
} from "../offline/syncService";
import { fetchSyncHistory } from "../features/sync/syncHistoryService";

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

const formatDateTime = (value) => {
  if (!value) {
    return "--";
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return "--";
  }

  return parsedDate.toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const SyncManagementPage = () => {
  const [syncHistory, setSyncHistory] = useState({
    transactions: [],
    conflicts: [],
  });
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [isRetrying, setIsRetrying] = useState(false);

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

  const loadSyncHistory = async () => {
    setIsLoadingHistory(true);
    setErrorMessage("");

    try {
      const response = await fetchSyncHistory({ limit: 50 });
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
    setIsRetrying(true);

    try {
      await flushPendingSyncEntries();
      await loadSyncHistory();
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <>
      <PageHeader
        title="SYNC CENTER"
        description="Review queued offline actions, failed sync attempts, and conflict results across your current module."
        actions={[
          {
            label: isRetrying ? "Retrying..." : "Retry Pending Sync",
            variant: "secondary",
            onClick: handleRetrySync,
            disabled: !isOnline || summary.total === 0 || isRetrying,
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
            <p style={shellStyles.statValue}>{summary.failed}</p>
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
        <div style={{ marginBottom: "16px" }}>
          <h3 style={{ margin: 0, color: "#17324d" }}>Local Sync Queue</h3>
          <p style={{ ...shellStyles.mutedText, marginTop: "8px" }}>
            Queued offline actions are stored in IndexedDB and retried when the
            device goes back online.
          </p>
        </div>

        {syncQueueEntries.length === 0 ? (
          <p style={shellStyles.mutedText}>No local sync queue entries right now.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={tableStyles.table}>
              <thead>
                <tr>
                  <th style={tableStyles.th}>Module</th>
                  <th style={tableStyles.th}>Action</th>
                  <th style={tableStyles.th}>Status</th>
                  <th style={tableStyles.th}>Queued At</th>
                  <th style={tableStyles.th}>Details</th>
                  <th style={tableStyles.th}>Action</th>
                </tr>
              </thead>
              <tbody>
                {syncQueueEntries.map((entry) => (
                  <tr key={entry.id}>
                    <td style={tableStyles.td}>{entry.moduleName || "--"}</td>
                    <td style={tableStyles.td}>{entry.actionKey || "--"}</td>
                    <td style={tableStyles.td}>
                      <SyncStatusBadge status={entry.status} />
                    </td>
                    <td style={tableStyles.td}>
                      {formatDateTime(entry.clientTimestamp)}
                    </td>
                    <td style={tableStyles.td}>
                      {entry.lastError ||
                        entry.serverMessage ||
                        entry.entityServerId ||
                        entry.entityLocalId ||
                        "--"}
                    </td>
                    <td style={tableStyles.td}>
                      <button
                        type="button"
                        onClick={handleRetrySync}
                        disabled={
                          !isOnline ||
                          ![
                            LOCAL_SYNC_STATUS.PENDING,
                            LOCAL_SYNC_STATUS.FAILED,
                          ].includes(entry.status) ||
                          isRetrying
                        }
                        style={{
                          ...pageHeaderStyles.secondaryButton,
                          opacity:
                            !isOnline ||
                            ![
                              LOCAL_SYNC_STATUS.PENDING,
                              LOCAL_SYNC_STATUS.FAILED,
                            ].includes(entry.status) ||
                            isRetrying
                              ? 0.7
                              : 1,
                        }}
                      >
                        Retry
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
        ) : syncHistory.transactions.length === 0 ? (
          <p style={shellStyles.mutedText}>No sync history is available yet.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={tableStyles.table}>
              <thead>
                <tr>
                  <th style={tableStyles.th}>Entity</th>
                  <th style={tableStyles.th}>Operation</th>
                  <th style={tableStyles.th}>Status</th>
                  <th style={tableStyles.th}>Client Timestamp</th>
                  <th style={tableStyles.th}>Server Timestamp</th>
                  <th style={tableStyles.th}>Message</th>
                </tr>
              </thead>
              <tbody>
                {syncHistory.transactions.map((transaction) => (
                  <tr key={transaction.id}>
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
                      {formatDateTime(transaction.client_timestamp)}
                    </td>
                    <td style={tableStyles.td}>
                      {formatDateTime(transaction.server_timestamp)}
                    </td>
                    <td style={tableStyles.td}>
                      {transaction.error_message || "--"}
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
        ) : syncHistory.conflicts.length === 0 ? (
          <p style={shellStyles.mutedText}>No conflicts are logged right now.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={tableStyles.table}>
              <thead>
                <tr>
                  <th style={tableStyles.th}>Entity</th>
                  <th style={tableStyles.th}>Conflict Type</th>
                  <th style={tableStyles.th}>Status</th>
                  <th style={tableStyles.th}>Resolution</th>
                  <th style={tableStyles.th}>Resolved At</th>
                </tr>
              </thead>
              <tbody>
                {syncHistory.conflicts.map((conflict) => (
                  <tr key={conflict.id}>
                    <td style={tableStyles.td}>
                      {conflict.entity_type}
                      <div style={{ color: "#60738a", fontSize: "12px" }}>
                        {conflict.entity_server_id || "--"}
                      </div>
                    </td>
                    <td style={tableStyles.td}>{conflict.conflict_type}</td>
                    <td style={tableStyles.td}>
                      <SyncStatusBadge
                        status={
                          conflict.status === "OPEN"
                            ? LOCAL_SYNC_STATUS.CONFLICT
                            : LOCAL_SYNC_STATUS.SYNCED
                        }
                      />
                    </td>
                    <td style={tableStyles.td}>
                      {conflict.resolution_strategy || "--"}
                    </td>
                    <td style={tableStyles.td}>
                      {formatDateTime(conflict.resolved_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
};

export default SyncManagementPage;
