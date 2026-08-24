import React, { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useLocation } from "react-router-dom";
import db, { LOCAL_SYNC_STATUS } from "../../offline/db.js";
import { getSyncHealthPresentation } from "../../offline/syncStatus";
import {
  flushPendingSyncEntries,
  initializeSyncService,
  subscribeToSyncUpdates,
} from "../../offline/syncService";
import {
  getVisibleSyncQueueEntries,
  isNonRetryableSyncEntry,
  isUnsupportedOfflineActionKey,
} from "../../offline/syncQueue";

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

const chipBaseStyles = {
  padding: "6px 12px",
  borderRadius: "999px",
  fontSize: "12px",
  fontWeight: 700,
  whiteSpace: "nowrap",
};

const SyncStatusBanner = () => {
  const location = useLocation();
  const [isOnline, setIsOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const isSettingsRoute = location.pathname.endsWith("/settings");

  const syncEntries = useLiveQuery(() => getVisibleSyncQueueEntries(), [], []) || [];

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

  const retryableQueueCount = useMemo(
    () =>
      syncEntries.filter(
        (entry) =>
          [LOCAL_SYNC_STATUS.PENDING, LOCAL_SYNC_STATUS.FAILED].includes(
            entry.status,
          ) &&
          !isUnsupportedOfflineActionKey(entry.actionKey) &&
          !isNonRetryableSyncEntry(entry),
      ).length,
    [syncEntries],
  );

  const healthPresentation = useMemo(
    () =>
      getSyncHealthPresentation({
        pending: counts[LOCAL_SYNC_STATUS.PENDING],
        failed: counts[LOCAL_SYNC_STATUS.FAILED],
        conflicts: counts[LOCAL_SYNC_STATUS.CONFLICT],
      }),
    [counts],
  );

  const statusChips = useMemo(() => {
    return healthPresentation.badges.map((badge) => ({
      ...badge,
      key: badge.type,
      palette: badgeStylesByStatus[
        badge.type === "healthy" ? LOCAL_SYNC_STATUS.SYNCED : badge.type.toUpperCase()
      ],
    }));
  }, [healthPresentation.badges]);

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
    isSettingsRoute ||
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
              ? "You can continue supported actions. DISTYNC will save them on this device and sync them when the connection returns."
              : feedbackMessage ||
                healthPresentation.message}
          </p>
        </div>

        {isOnline && retryableQueueCount > 0 ? (
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
          gap: "8px",
          flexWrap: "wrap",
          marginTop: "14px",
        }}
      >
        {statusChips.map((chip) => (
          <span
            key={chip.key}
            style={{
              ...chipBaseStyles,
              ...chip.palette,
            }}
          >
            {chip.label}
          </span>
        ))}
      </div>
    </section>
  );
};

export default SyncStatusBanner;
