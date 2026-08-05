import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { FiBell, FiSettings } from "react-icons/fi";
import { useAuth } from "../../context/AuthContext";
import { ROLE_CODES } from "../../utils/roleSession";
import {
  fetchNotifications,
  fetchUnreadNotificationCount,
} from "../../features/notifications/notificationService";
import { getNotificationDeepLink } from "../../features/notifications/notificationRouting";
import { DEFAULT_SETTINGS_SECTION } from "../../pages/settings/settingsSectionRouting";

const headerNotificationStyles = {
  wrapper: {
    display: "flex",
    justifyContent: "flex-end",
    position: "relative",
    width: "100%",
    zIndex: 30,
  },
  actions: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: "12px",
  },
  menu: {
    position: "relative",
  },
  button: {
    position: "relative",
    border: "1px solid #c7d7e8",
    borderRadius: "14px",
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    color: "#24496e",
    width: "44px",
    height: "44px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    flexShrink: 0,
    padding: 0,
    lineHeight: 0,
    overflow: "visible",
    boxShadow: "0 10px 24px rgba(61, 93, 125, 0.08)",
    backdropFilter: "blur(10px)",
  },
  icon: {
    width: "18px",
    height: "18px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    lineHeight: 0,
  },
  badge: {
    position: "absolute",
    top: "4px",
    right: "4px",
    minWidth: "18px",
    height: "18px",
    padding: "0 4px",
    borderRadius: "999px",
    backgroundColor: "#d14343",
    color: "#ffffff",
    fontSize: "10px",
    fontWeight: 800,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    transform: "translate(35%, -35%)",
    boxShadow: "0 6px 14px rgba(209, 67, 67, 0.25)",
  },
  dropdown: {
    position: "absolute",
    top: "56px",
    right: 0,
    width: "min(360px, calc(100vw - 40px))",
    maxWidth: "calc(100vw - 40px)",
    maxHeight: "min(70vh, 520px)",
    borderRadius: "16px",
    backgroundColor: "#ffffff",
    border: "1px solid #d6e2ef",
    boxShadow: "0 18px 32px rgba(39, 70, 104, 0.14)",
    padding: "14px",
    overflowY: "auto",
  },
};

const supportedRoles = new Set([
  ROLE_CODES.MAYOR,
  ROLE_CODES.MSWDO,
  ROLE_CODES.BARANGAY,
]);

const HeaderNotifications = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentRole } = useAuth();
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [recentNotifications, setRecentNotifications] = useState([]);
  const [isNotificationDropdownOpen, setIsNotificationDropdownOpen] =
    useState(false);
  const notificationMenuRef = useRef(null);

  const notificationRouteByRole = useMemo(
    () => ({
      [ROLE_CODES.MAYOR]: "/inventory/notifications",
      [ROLE_CODES.MSWDO]: "/mswdo/notifications",
      [ROLE_CODES.BARANGAY]: "/barangay/notifications",
    }),
    [],
  );

  const notificationRoute =
    notificationRouteByRole[currentRole] || "/inventory/notifications";
  const settingsRouteByRole = useMemo(
    () => ({
      [ROLE_CODES.MAYOR]: "/inventory/settings",
      [ROLE_CODES.MSWDO]: "/mswdo/settings",
      [ROLE_CODES.BARANGAY]: "/barangay/settings",
    }),
    [],
  );
  const settingsRoute =
    `${settingsRouteByRole[currentRole] || "/inventory/settings"}?section=${DEFAULT_SETTINGS_SECTION}`;

  useEffect(() => {
    if (!supportedRoles.has(currentRole)) {
      setUnreadNotificationCount(0);
      setRecentNotifications([]);
      return undefined;
    }

    let isMounted = true;

    const loadNotificationState = async () => {
      try {
        const [countResponse, recentResponse] = await Promise.all([
          fetchUnreadNotificationCount(),
          fetchNotifications({
            status: "UNREAD",
            limit: 5,
          }),
        ]);

        if (isMounted) {
          setUnreadNotificationCount(Number(countResponse?.unread_count || 0));
          setRecentNotifications(
            Array.isArray(recentResponse) ? recentResponse : [],
          );
        }
      } catch (_error) {
        if (isMounted) {
          setUnreadNotificationCount(0);
          setRecentNotifications([]);
        }
      }
    };

    loadNotificationState();

    const intervalId = window.setInterval(loadNotificationState, 30000);
    const handleNotificationRefresh = () => loadNotificationState();

    window.addEventListener(
      "distync-notifications-updated",
      handleNotificationRefresh,
    );

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
      window.removeEventListener(
        "distync-notifications-updated",
        handleNotificationRefresh,
      );
    };
  }, [currentRole, location.pathname]);

  useEffect(() => {
    if (!isNotificationDropdownOpen) {
      return undefined;
    }

    const handleOutsideClick = (event) => {
      if (!notificationMenuRef.current?.contains(event.target)) {
        setIsNotificationDropdownOpen(false);
      }
    };

    window.addEventListener("mousedown", handleOutsideClick);
    return () => window.removeEventListener("mousedown", handleOutsideClick);
  }, [isNotificationDropdownOpen]);

  if (!supportedRoles.has(currentRole)) {
    return null;
  }

  return (
    <div style={headerNotificationStyles.wrapper}>
      <div style={headerNotificationStyles.actions}>
        <div style={headerNotificationStyles.menu} ref={notificationMenuRef}>
          <button
            type="button"
            onClick={() => {
              setIsNotificationDropdownOpen((currentValue) => !currentValue);
            }}
            style={headerNotificationStyles.button}
            title="Notifications"
          >
            <span style={headerNotificationStyles.icon}>
              <FiBell size={18} />
            </span>
            {unreadNotificationCount > 0 ? (
              <span style={headerNotificationStyles.badge}>
                {unreadNotificationCount > 99 ? "99+" : unreadNotificationCount}
              </span>
            ) : null}
          </button>

          {isNotificationDropdownOpen ? (
            <div style={headerNotificationStyles.dropdown}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "12px",
                  marginBottom: "12px",
                }}
              >
                <div>
                  <p
                    style={{
                      margin: 0,
                      fontSize: "12px",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      color: "#6a8096",
                    }}
                  >
                    Notifications
                  </p>
                  <p
                    style={{
                      margin: "4px 0 0",
                      fontSize: "14px",
                      fontWeight: 700,
                      color: "#224565",
                    }}
                  >
                    Unread: {unreadNotificationCount}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setIsNotificationDropdownOpen(false);
                    navigate(notificationRoute);
                  }}
                  style={{
                    border: "none",
                    background: "transparent",
                    color: "#1f4f7d",
                    fontSize: "13px",
                    fontWeight: 700,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                  }}
                >
                  View all
                </button>
              </div>

              {recentNotifications.length === 0 ? (
                <p
                  style={{
                    margin: 0,
                    color: "#6b8298",
                    fontSize: "13px",
                    lineHeight: 1.5,
                  }}
                >
                  No unread notifications right now.
                </p>
              ) : (
                <div style={{ display: "grid", gap: "10px" }}>
                  {recentNotifications.map((notification) => {
                    const deepLink = getNotificationDeepLink(
                      notification,
                      currentRole,
                    );

                    return (
                      <button
                        key={notification.id}
                        type="button"
                        onClick={() => {
                          setIsNotificationDropdownOpen(false);
                          navigate(deepLink?.to || notificationRoute);
                        }}
                        style={{
                          border: "1px solid #dce7f3",
                          borderRadius: "12px",
                          backgroundColor: "#f8fbff",
                          padding: "12px",
                          textAlign: "left",
                          cursor: "pointer",
                          width: "100%",
                          display: "grid",
                          gap: "6px",
                          boxSizing: "border-box",
                        }}
                      >
                        <div
                          style={{
                            fontSize: "12px",
                            fontWeight: 800,
                            color: "#1f4f7d",
                            lineHeight: 1.4,
                            overflowWrap: "anywhere",
                          }}
                        >
                          {notification.title}
                        </div>
                        <div
                          style={{
                            fontSize: "12px",
                            color: "#5d7489",
                            lineHeight: 1.45,
                            overflowWrap: "anywhere",
                          }}
                        >
                          {notification.message}
                        </div>
                        {deepLink?.label ? (
                          <div
                            style={{
                              fontSize: "11px",
                              fontWeight: 700,
                              color: "#365472",
                              overflowWrap: "anywhere",
                            }}
                          >
                            {deepLink.label}
                          </div>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ) : null}
        </div>

        <button
          type="button"
          onClick={() => navigate(settingsRoute)}
          style={headerNotificationStyles.button}
          title="Settings"
        >
          <span style={headerNotificationStyles.icon}>
            <FiSettings size={18} />
          </span>
        </button>
      </div>
    </div>
  );
};

export default HeaderNotifications;
