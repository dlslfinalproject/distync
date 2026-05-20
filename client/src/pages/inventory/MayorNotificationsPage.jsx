import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import PageHeader, { pageHeaderStyles } from "../../components/layout/PageHeader";
import { shellStyles } from "../../components/layout/BarangayLayout";
import { useAuth } from "../../context/AuthContext";
import {
  fetchNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from "../../features/notifications/notificationService";
import { getNotificationDeepLink } from "../../features/notifications/notificationRouting";
import { ROLE_CODES } from "../../utils/roleSession";

const severityStyles = {
  INFO: {
    backgroundColor: "#e0f2fe",
    color: "#075985",
  },
  WARNING: {
    backgroundColor: "#fef3c7",
    color: "#92400e",
  },
  CRITICAL: {
    backgroundColor: "#fee2e2",
    color: "#b91c1c",
  },
};

const filterButtonStyles = (isActive) => ({
  border: "1px solid #c6d8ea",
  borderRadius: "12px",
  padding: "10px 14px",
  backgroundColor: isActive ? "#e1eef9" : "#f8fbfe",
  color: isActive ? "#1f4f7d" : "#2a4c6f",
  fontSize: "13px",
  fontWeight: 700,
  cursor: "pointer",
});

const formatDateTime = (value) => {
  if (!value) {
    return "--";
  }

  return new Date(value).toLocaleString();
};

const pageStyles = {
  wrapper: {
    width: "100%",
    maxWidth: "1080px",
    margin: "0 auto",
    display: "grid",
    gap: "20px",
    padding: "0 0 28px",
  },
  summaryCard: {
    ...shellStyles.card,
    marginTop: "24px",
    padding: "22px",
  },
  listCard: {
    ...shellStyles.card,
    padding: "22px",
  },
};

const MayorNotificationsPage = () => {
  const navigate = useNavigate();
  const { currentRole } = useAuth();
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [notifications, setNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMarkingAllRead, setIsMarkingAllRead] = useState(false);
  const [activeNotificationId, setActiveNotificationId] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const roleMeta = {
    [ROLE_CODES.MAYOR]: {
      eyebrow: "Mayor Workspace",
      description: "Review inventory, donation, and anomaly alerts that need Mayor attention.",
    },
    [ROLE_CODES.MSWDO]: {
      eyebrow: "MSWDO Workspace",
      description: "Review disaster updates and distribution-related alerts for operations monitoring.",
    },
    [ROLE_CODES.BARANGAY]: {
      eyebrow: "Barangay Workspace",
      description: "Review disaster updates and sync-related alerts for your field operations.",
    },
  };
  const activeRoleMeta = roleMeta[currentRole] || {
    eyebrow: "Workspace",
    description: "Review the latest system notifications.",
  };

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.read_at).length,
    [notifications],
  );

  const loadNotifications = async (activeStatus = statusFilter) => {
    setIsLoading(true);
    setErrorMessage("");

    try {
      const response = await fetchNotifications({
        status: activeStatus,
        limit: 50,
      });
      setNotifications(Array.isArray(response) ? response : []);
      window.dispatchEvent(new Event("distync-notifications-updated"));
    } catch (error) {
      setErrorMessage(error.message || "Failed to load notifications.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications(statusFilter);
  }, [statusFilter]);

  const handleMarkAsRead = async (notificationId) => {
    setActiveNotificationId(notificationId);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      await markNotificationAsRead(notificationId);
      setNotifications((currentNotifications) =>
        currentNotifications.map((notification) =>
          notification.id === notificationId
            ? {
                ...notification,
                read_at: new Date().toISOString(),
              }
            : notification,
        ),
      );
      setSuccessMessage("Notification marked as read.");
      window.dispatchEvent(new Event("distync-notifications-updated"));
    } catch (error) {
      setErrorMessage(error.message || "Failed to mark notification as read.");
    } finally {
      setActiveNotificationId("");
    }
  };

  const handleMarkAllAsRead = async () => {
    setIsMarkingAllRead(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      await markAllNotificationsAsRead();
      setNotifications((currentNotifications) =>
        currentNotifications.map((notification) => ({
          ...notification,
          read_at: notification.read_at || new Date().toISOString(),
        })),
      );
      setSuccessMessage("All notifications marked as read.");
      window.dispatchEvent(new Event("distync-notifications-updated"));
    } catch (error) {
      setErrorMessage(error.message || "Failed to mark all notifications as read.");
    } finally {
      setIsMarkingAllRead(false);
    }
  };

  return (
    <div style={pageStyles.wrapper}>
      <PageHeader
        eyebrow={activeRoleMeta.eyebrow}
        title="NOTIFICATIONS"
        description={activeRoleMeta.description}
        actions={[
          {
            label: "Refresh",
            onClick: () => loadNotifications(statusFilter),
            variant: "secondary",
          },
          {
            label: isMarkingAllRead ? "Marking..." : "Mark All as Read",
            onClick: handleMarkAllAsRead,
          },
        ]}
      />

      <section style={pageStyles.summaryCard}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => setStatusFilter("ALL")}
              style={filterButtonStyles(statusFilter === "ALL")}
            >
              All Notifications
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("UNREAD")}
              style={filterButtonStyles(statusFilter === "UNREAD")}
            >
              Unread Only
            </button>
          </div>

          <div
            style={{
              borderRadius: "999px",
              backgroundColor: "#edf4fb",
              color: "#24496e",
              padding: "10px 14px",
              fontSize: "13px",
              fontWeight: 700,
            }}
          >
            Unread: {unreadCount}
          </div>
        </div>

        {successMessage ? (
          <div
            style={{
              marginTop: "18px",
              padding: "14px 16px",
              borderRadius: "14px",
              backgroundColor: "#edf8f1",
              color: "#1f6b46",
              fontSize: "14px",
              fontWeight: 600,
            }}
          >
            {successMessage}
          </div>
        ) : null}

        {errorMessage ? (
          <div
            style={{
              marginTop: "18px",
              padding: "14px 16px",
              borderRadius: "14px",
              backgroundColor: "#fff3f1",
              color: "#a14538",
              fontSize: "14px",
              fontWeight: 600,
            }}
          >
            {errorMessage}
          </div>
        ) : null}
      </section>

      <section style={pageStyles.listCard}>
        {isLoading ? (
          <p style={shellStyles.mutedText}>Loading notifications...</p>
        ) : notifications.length === 0 ? (
          <p style={shellStyles.mutedText}>
            No notifications are available right now.
          </p>
        ) : (
          <div style={{ display: "grid", gap: "14px" }}>
            {notifications.map((notification) => {
              const palette =
                severityStyles[notification.severity] || severityStyles.INFO;
              const deepLink = getNotificationDeepLink(notification, currentRole);
              const canOpenRelatedPage = Boolean(deepLink?.to);

              return (
                <article
                  key={notification.id}
                  style={{
                    border: "1px solid #dbe5ef",
                    borderRadius: "18px",
                    padding: "18px",
                    backgroundColor: notification.read_at ? "#ffffff" : "#f8fbff",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: "16px",
                      flexWrap: "wrap",
                    }}
                  >
                    <div style={{ flex: "1 1 420px", minWidth: 0 }}>
                      <div
                        style={{
                          display: "flex",
                          gap: "10px",
                          alignItems: "center",
                          flexWrap: "wrap",
                        }}
                      >
                        <span
                          style={{
                            borderRadius: "999px",
                            padding: "6px 10px",
                            fontSize: "11px",
                            fontWeight: 800,
                            letterSpacing: "0.04em",
                            textTransform: "uppercase",
                            ...palette,
                          }}
                        >
                          {notification.severity}
                        </span>
                        <span
                          style={{
                            borderRadius: "999px",
                            padding: "6px 10px",
                            fontSize: "11px",
                            fontWeight: 700,
                            backgroundColor: notification.read_at ? "#eef3f8" : "#e1eef9",
                            color: notification.read_at ? "#607588" : "#1f4f7d",
                          }}
                        >
                          {notification.read_at ? "Read" : "Unread"}
                        </span>
                        {notification.type ? (
                          <span
                            style={{
                              borderRadius: "999px",
                              padding: "6px 10px",
                              fontSize: "11px",
                              fontWeight: 700,
                              backgroundColor: "#eef5fc",
                              color: "#365472",
                            }}
                          >
                            {notification.type}
                          </span>
                        ) : null}
                      </div>

                      <h3
                        style={{
                          margin: "12px 0 6px",
                          color: "#17324d",
                          fontSize: "20px",
                        }}
                      >
                        {notification.title}
                      </h3>

                      <p
                        style={{
                          margin: 0,
                          color: "#56708a",
                          lineHeight: 1.6,
                          fontSize: "14px",
                        }}
                      >
                        {notification.message}
                      </p>

                      <div
                        style={{
                          marginTop: "12px",
                          display: "grid",
                          gap: "6px",
                          color: "#6b8298",
                          fontSize: "13px",
                        }}
                      >
                        <div>Generated: {formatDateTime(notification.generated_at)}</div>
                        <div>
                          Disaster Event:{" "}
                          {notification.disaster_event_title
                            ? `${notification.event_code || ""} ${notification.disaster_event_title}`.trim()
                            : "General inventory alert"}
                        </div>
                        {deepLink?.note ? (
                          <div>{deepLink.note}</div>
                        ) : null}
                      </div>
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gap: "10px",
                        width: "100%",
                        maxWidth: "200px",
                      }}
                    >
                      {canOpenRelatedPage ? (
                        <button
                          type="button"
                          onClick={() => navigate(deepLink.to)}
                          style={{
                            ...pageHeaderStyles.secondaryButton,
                            textAlign: "center",
                          }}
                        >
                          {deepLink.label}
                        </button>
                      ) : null}

                      {!notification.read_at ? (
                        <button
                          type="button"
                          onClick={() => handleMarkAsRead(notification.id)}
                          disabled={activeNotificationId === notification.id}
                          style={{
                            ...pageHeaderStyles.secondaryButton,
                            minWidth: "160px",
                            opacity:
                              activeNotificationId === notification.id ? 0.7 : 1,
                          }}
                        >
                          {activeNotificationId === notification.id
                            ? "Updating..."
                            : "Mark as Read"}
                        </button>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};

export default MayorNotificationsPage;
