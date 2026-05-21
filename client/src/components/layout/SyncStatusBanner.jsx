import React, { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import db, { LOCAL_SYNC_STATUS } from "../../offline/db";
import {
  flushPendingSyncEntries,
  initializeSyncService,
  subscribeToSyncUpdates,
} from "../../offline/syncService";

const badgeStylesByStatus = {
  [LOCAL_SYNC_STATUS.SYNCED]: {
    backgroundColor: "#e6f5ec",
    color: "#2d7a4f",
  },
  [LOCAL_SYNC_STATUS.PENDING]: {
    backgroundColor: "#e0f2fe",
    color: "#075985",
  },
  [LOCAL_SYNC_STATUS.FAILED]: {
    backgroundColor: "#fff3f1",
    color: "#a14538",
  },
  [LOCAL_SYNC_STATUS.CONFLICT]: {
    backgroundColor: "#fef3c7",
    color: "#92400e",
  },
};

const buildCountLabel = (count, singularLabel) => {
  return `${count} ${singularLabel}${count === 1 ? "" : "s"}`;
};

const bannerCardStyles = {
  backgroundColor: "#ffffff",
  border: "1px solid #d7e2ef",
  borderRadius: "18px",
  padding: "clamp(18px, 2vw, 24px)",
  boxShadow: "0 10px 24px rgba(76, 101, 132, 0.08)",
  width: "100%",
  minWidth: 0,
  boxSizing: "border-box",
};

const mutedTextStyle = {
  margin: 0,
  color: "#60738a",
  fontSize: "14px",
  lineHeight: 1.6,
};

const SyncStatusBanner = () => {
  const [isOnline, setIsOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  const [feedbackMessage, setFeedbackMessage] = useState("");

  const syncEntries = useLiveQuery(() => db.syncQueue.toArray(), [], []) || [];

  const counts = useMemo(() => {
    return syncEntries.reduce(
      (summary, entry) => {
        summary[entry.status] = (summary[entry.status] || 0) + 1;
        return summary;
      },
      {
        [LOCAL_SYNC_STATUS.PENDING]: 0,
        [LOCAL_SYNC_STATUS.FAILED]: 0,
        [LOCAL_SYNC_STATUS.CONFLICT]: 0,
      },
    );
  }, [syncEntries]);

  useEffect(() => {
    initializeSyncService();

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    const unsubscribe = subscribeToSyncUpdates(() => {});
    const handleFeedback = (event) => {
      setFeedbackMessage(event.detail?.message || "");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("distync-sync-feedback", handleFeedback);

    return () => {
      unsubscribe();
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("distync-sync-feedback", handleFeedback);
    };
  }, []);

  if (
    isOnline &&
    counts[LOCAL_SYNC_STATUS.PENDING] === 0 &&
    counts[LOCAL_SYNC_STATUS.FAILED] === 0 &&
    counts[LOCAL_SYNC_STATUS.CONFLICT] === 0 &&
    !feedbackMessage
  ) {
    return null;
  }

  return (
    <section style={bannerCardStyles}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "16px",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "grid", gap: "8px" }}>
          <p style={{ margin: 0, color: "#17324d", fontWeight: 800 }}>
            {isOnline ? "Sync Status" : "Offline Mode Active"}
          </p>
          <p style={mutedTextStyle}>
            {!isOnline
              ? "You can keep encoding create and update actions. DISTYNC will queue them locally and sync them once the connection returns."
              : feedbackMessage ||
                "Queued changes are monitored here. Conflicts use latest updated_at timestamp resolution by default."}
          </p>
        </div>

        {isOnline && counts[LOCAL_SYNC_STATUS.PENDING] > 0 ? (
          <button
            type="button"
            onClick={() => void flushPendingSyncEntries()}
            style={{
              border: "1px solid #c6d8ea",
              borderRadius: "12px",
              backgroundColor: "#f7fbfe",
              color: "#24496e",
              padding: "10px 14px",
              fontSize: "13px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Retry Sync
          </button>
        ) : null}
      </div>

      <div
        style={{
          display: "flex",
          gap: "10px",
          flexWrap: "wrap",
          marginTop: "14px",
        }}
      >
        <span
          style={{
            padding: "6px 12px",
            borderRadius: "999px",
            fontSize: "12px",
            fontWeight: 700,
            ...badgeStylesByStatus[LOCAL_SYNC_STATUS.SYNCED],
          }}
        >
          Synced
        </span>
        <span
          style={{
            padding: "6px 12px",
            borderRadius: "999px",
            fontSize: "12px",
            fontWeight: 700,
            ...badgeStylesByStatus[LOCAL_SYNC_STATUS.PENDING],
          }}
        >
          Pending Sync: {buildCountLabel(counts[LOCAL_SYNC_STATUS.PENDING], "entry")}
        </span>
        <span
          style={{
            padding: "6px 12px",
            borderRadius: "999px",
            fontSize: "12px",
            fontWeight: 700,
            ...badgeStylesByStatus[LOCAL_SYNC_STATUS.FAILED],
          }}
        >
          Failed Sync: {buildCountLabel(counts[LOCAL_SYNC_STATUS.FAILED], "entry")}
        </span>
        <span
          style={{
            padding: "6px 12px",
            borderRadius: "999px",
            fontSize: "12px",
            fontWeight: 700,
            ...badgeStylesByStatus[LOCAL_SYNC_STATUS.CONFLICT],
          }}
        >
          Conflict: {buildCountLabel(counts[LOCAL_SYNC_STATUS.CONFLICT], "entry")}
        </span>
      </div>
    </section>
  );
};

export default SyncStatusBanner;
