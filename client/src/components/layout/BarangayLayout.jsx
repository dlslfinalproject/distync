import React, { useEffect, useMemo, useRef, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { ROLE_CODES } from "../../utils/roleSession";
import Sidebar from "./Sidebar";
import ShellHeader from "./ShellHeader";
import SyncStatusBanner from "./SyncStatusBanner";
import { initializeSyncService } from "../../offline/syncService";
import { SettingsUnsavedChangesProvider } from "../../pages/settings/SettingsUnsavedChangesContext";
import { useBarangayDashboard } from "../../features/barangay-dashboard/useBarangayDashboard";
import { useBarangayOfflinePreparation } from "../../features/offline/useBarangayOfflinePreparation";
import { useMswdoOfflinePreparation } from "../../features/offline/useMswdoOfflinePreparation";
import { isMswdoOfflineBlockedRoute, MSWDO_OFFLINE_ACCESS_MESSAGE } from "../../features/offline/mswdoOfflineAccess";
import { readOperationalDisasterEventId } from "../../features/disaster-events/operationalDisasterEventSelection";
import OfflineDataReadiness, {
  MayorOfflineReadyDismissalContext,
} from "./OfflineDataReadiness";
import BarangayOfflineModeNotice from "./BarangayOfflineModeNotice";
import MswdoOfflineModeNotice from "./MswdoOfflineModeNotice";
import MayorOfflineAccessNotice from "./MayorOfflineAccessNotice";
import { isMayorOfflineBlockedRoute } from "../../features/offline/mayorOfflineAccess";
import {
  BARANGAY_OFFLINE_ACCESS_MESSAGE,
  isBarangayOfflineBlockedRoute,
} from "../../features/offline/barangayOfflineAccess";

const SIDEBAR_EXPANDED_WIDTH = "280px";
const SIDEBAR_COLLAPSED_WIDTH = "0px";
const HEADER_BRAND_COLLAPSED_WIDTH = "280px";
const SHELL_HEADER_HEIGHT = "68px";
const MOBILE_NAV_QUERY = "(max-width: 1024px)";
const COMPACT_NAV_QUERY = "(max-width: 1024px)";
const SIDEBAR_NAVIGATION_ID = "distync-sidebar-navigation";

const getInitialMediaQueryMatch = (query) => {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }

  return window.matchMedia(query).matches;
};

export const shellStyles = {
  page: {
    minHeight: "100vh",
    display: "grid",
    alignItems: "start",
    background:
      "linear-gradient(180deg, #edf4fb 0%, #e5eef7 50%, #dde7f2 100%)",
    color: "#1b2b40",
    fontFamily: '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif',
  },
  main: {
    padding: "clamp(18px, 3vw, 32px)",
    boxSizing: "border-box",
    width: "100%",
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
  },
  content: {
    width: "100%",
    maxWidth: "1440px",
    margin: "0 auto",
    display: "flex",
    flexDirection: "column",
    gap: "24px",
    minWidth: 0,
    overflowX: "hidden",
  },
  card: {
    backgroundColor: "#ffffff",
    border: "1px solid #d7e2ef",
    borderRadius: "18px",
    padding: "clamp(18px, 2vw, 24px)",
    boxShadow: "0 10px 24px rgba(76, 101, 132, 0.08)",
    width: "100%",
    minWidth: 0,
    boxSizing: "border-box",
  },
  mutedText: {
    margin: 0,
    color: "#60738a",
    fontSize: "14px",
    lineHeight: 1.6,
  },
  statGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "16px",
  },
  statValue: {
    margin: "8px 0 0",
    fontSize: "28px",
    fontWeight: 700,
    color: "#17324d",
  },
};

export const pageSpacingStyles = {
  pageStack: {
    flex: 1,
    minWidth: 0,
    maxWidth: "100%",
    overflowX: "hidden",
    display: "flex",
    flexDirection: "column",
    gap: "24px",
  },
  filterGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "16px",
    alignItems: "end",
  },
  toolbar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "16px",
    flexWrap: "wrap",
  },
  actionGroup: {
    display: "flex",
    alignItems: "center",
    gap: "16px",
    flexWrap: "wrap",
  },
  tableHeader: {
    marginBottom: "16px",
  },
};

const BarangayLayout = () => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() =>
    getInitialMediaQueryMatch(COMPACT_NAV_QUERY),
  );
  const [isMobileNavigation, setIsMobileNavigation] = useState(() =>
    getInitialMediaQueryMatch(MOBILE_NAV_QUERY),
  );
  const [isCompactNavigation, setIsCompactNavigation] = useState(() =>
    getInitialMediaQueryMatch(COMPACT_NAV_QUERY),
  );
  const [isMayorInventoryReadyAcknowledged, setIsMayorInventoryReadyAcknowledged] =
    useState(false);
  const lastNonSettingsCollapseStateRef = useRef(false);
  const location = useLocation();
  const { currentRole, authenticatedUser } = useAuth();
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine !== false,
  );
  const isDonorPortal = currentRole === ROLE_CODES.DONOR;
  const isBarangayPortal = currentRole === ROLE_CODES.BARANGAY;
  const isMswdoPortal = currentRole === ROLE_CODES.MSWDO;
  const [mswdoEventId, setMswdoEventId] = useState(() =>
    readOperationalDisasterEventId({ roleCode: ROLE_CODES.MSWDO, userId: authenticatedUser?.id || "" }),
  );
  const { selectedEvent, assignedBarangay } = useBarangayDashboard({
    userId: isBarangayPortal ? authenticatedUser?.id || "" : "",
  });
  const offlineContext = useMemo(() => ({
    barangaySource: assignedBarangay?.id ? "resolved context" : "user/default Barangay",
    eventSource: selectedEvent?.id ? "selected event" : "restored operational event",
    eventStatus: selectedEvent?.status || "",
  }), [assignedBarangay?.id, selectedEvent?.id, selectedEvent?.status]);
  const offlinePreparation = useBarangayOfflinePreparation({
    enabled: isBarangayPortal,
    userId: authenticatedUser?.id || "",
    eventId: selectedEvent?.id || "",
    barangayId: assignedBarangay?.id || authenticatedUser?.default_barangay_id || "",
    context: offlineContext,
  });
  const mswdoOfflinePreparation = useMswdoOfflinePreparation({
    enabled: isMswdoPortal,
    userId: authenticatedUser?.id || "",
    eventId: mswdoEventId,
  });
  const isSettingsRoute = location.pathname.endsWith("/settings");
  const isSyncRoute = location.pathname.endsWith("/sync");
  const isMayorPortal = currentRole === ROLE_CODES.MAYOR;
  const isMayorOffline = isMayorPortal && !isOnline;
  const shouldBlockMayorOfflineRoute =
    isMayorOffline && isMayorOfflineBlockedRoute(location.pathname);
  const isBarangayOffline = isBarangayPortal && !isOnline;
  const isMswdoOffline = isMswdoPortal && !isOnline;
  const shouldBlockMswdoOfflineRoute = isMswdoOffline && isMswdoOfflineBlockedRoute(location.pathname, { isPrepared: mswdoOfflinePreparation.isReady });
  const shouldBlockBarangayOfflineRoute =
    isBarangayOffline && isBarangayOfflineBlockedRoute(location.pathname);
  const isBarangayAnomalyRoute = location.pathname.startsWith("/barangay/anomalies");
  const isMayorAnomalyRoute = location.pathname.startsWith("/inventory/anomalies");
  const shouldShowSyncStatusBanner =
    !isBarangayPortal &&
    !isMayorPortal &&
    !isBarangayAnomalyRoute &&
    !isMayorAnomalyRoute &&
    !(currentRole === ROLE_CODES.MSWDO && isSyncRoute);
  const isSidebarOpen = !isSidebarCollapsed;
  const sidebarToggleRef = useRef(null);
  const sidebarWidth = isDonorPortal
    ? "0px"
    : isSidebarCollapsed
      ? SIDEBAR_COLLAPSED_WIDTH
      : SIDEBAR_EXPANDED_WIDTH;
  const headerBrandWidth = isDonorPortal
    ? "0px"
    : isMobileNavigation
      ? "1fr"
      : isSidebarCollapsed
        ? HEADER_BRAND_COLLAPSED_WIDTH
        : SIDEBAR_EXPANDED_WIDTH;

  useEffect(() => {
    initializeSyncService();
  }, []);

  useEffect(() => {
    if (!isMswdoPortal || typeof window === "undefined") return undefined;
    const update = () => setMswdoEventId(readOperationalDisasterEventId({ roleCode: ROLE_CODES.MSWDO, userId: authenticatedUser?.id || "" }));
    update();
    window.addEventListener("distync-operational-event-selection-updated", update);
    return () => window.removeEventListener("distync-operational-event-selection-updated", update);
  }, [authenticatedUser?.id, isMswdoPortal]);

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

  useEffect(() => {
    if (isDonorPortal || isSettingsRoute) {
      return;
    }

    lastNonSettingsCollapseStateRef.current = isSidebarCollapsed;
  }, [isDonorPortal, isSettingsRoute, isSidebarCollapsed]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const mobileMediaQuery = window.matchMedia(MOBILE_NAV_QUERY);
    const compactMediaQuery = window.matchMedia(COMPACT_NAV_QUERY);
    const syncNavigationState = () => {
      setIsMobileNavigation(mobileMediaQuery.matches);
      setIsCompactNavigation(compactMediaQuery.matches);
    };

    syncNavigationState();
    mobileMediaQuery.addEventListener("change", syncNavigationState);
    compactMediaQuery.addEventListener("change", syncNavigationState);

    return () => {
      mobileMediaQuery.removeEventListener("change", syncNavigationState);
      compactMediaQuery.removeEventListener("change", syncNavigationState);
    };
  }, []);

  useEffect(() => {
    if (isDonorPortal) {
      return;
    }

    if (isSettingsRoute) {
      setIsSidebarCollapsed(true);
      return;
    }

    setIsSidebarCollapsed(lastNonSettingsCollapseStateRef.current);
  }, [isDonorPortal, isSettingsRoute]);

  useEffect(() => {
    if (!isCompactNavigation || isDonorPortal) {
      return;
    }

    setIsSidebarCollapsed(true);
  }, [isCompactNavigation, isDonorPortal, location.pathname]);

  useEffect(() => {
    if (!isMobileNavigation || isDonorPortal) {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsSidebarCollapsed(true);
        sidebarToggleRef.current?.focus();
      }
    };

    if (isSidebarOpen) {
      const previousOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);

      return () => {
        document.body.style.overflow = previousOverflow;
        window.removeEventListener("keydown", handleKeyDown);
      };
    }

    return undefined;
  }, [isDonorPortal, isMobileNavigation, isSidebarOpen]);

  const pageStyle = useMemo(
    () => ({
      ...shellStyles.page,
      "--sidebar-width": sidebarWidth,
      "--header-brand-width": headerBrandWidth,
      "--shell-header-height": SHELL_HEADER_HEIGHT,
      gridTemplateColumns: isDonorPortal || isMobileNavigation
        ? "minmax(0, 1fr)"
        : `var(--sidebar-width) minmax(0, 1fr)`,
      gridTemplateRows: isDonorPortal ? "1fr" : "auto minmax(0, 1fr)",
    }),
    [headerBrandWidth, isDonorPortal, isMobileNavigation, sidebarWidth],
  );

  return (
    <SettingsUnsavedChangesProvider>
      <div className="distync-shell" style={pageStyle}>
        {!isDonorPortal ? (
          <ShellHeader
            isSidebarCollapsed={isSidebarCollapsed}
            isMobileNavigation={isMobileNavigation}
            navigationId={SIDEBAR_NAVIGATION_ID}
            toggleRef={sidebarToggleRef}
            onToggleSidebarCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
          />
        ) : null}

        {!isDonorPortal ? (
          <>
            <Sidebar
              isCollapsed={isSidebarCollapsed}
              isMobileNavigation={isMobileNavigation}
              navigationId={SIDEBAR_NAVIGATION_ID}
              isOffline={!isOnline}
              mswdoOfflineReady={mswdoOfflinePreparation.isReady}
              onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
              onClose={() => {
                setIsSidebarCollapsed(true);
                if (isMobileNavigation) {
                  sidebarToggleRef.current?.focus();
                }
              }}
              onNavigate={() => {
                if (isMobileNavigation) {
                  setIsSidebarCollapsed(true);
                  sidebarToggleRef.current?.focus();
                }
              }}
            />
            {isMobileNavigation && !isSidebarCollapsed ? (
              <button
                type="button"
                className="distync-sidebar__scrim"
                aria-label="Close navigation menu"
                onClick={() => {
                  setIsSidebarCollapsed(true);
                  sidebarToggleRef.current?.focus();
                }}
              />
            ) : null}
          </>
        ) : null}

        <main className="distync-shell__main" style={shellStyles.main}>
          <div className="distync-shell__content" style={shellStyles.content}>
            {shouldShowSyncStatusBanner ? (
              isMswdoPortal ? <MswdoOfflineModeNotice /> : <SyncStatusBanner />
            ) : null}
            {isBarangayPortal ? <BarangayOfflineModeNotice /> : null}
            <MayorOfflineReadyDismissalContext.Provider
              value={{
                isAcknowledged: isMayorInventoryReadyAcknowledged,
                acknowledge: () => setIsMayorInventoryReadyAcknowledged(true),
              }}
            >
              {isBarangayPortal ? <OfflineDataReadiness {...offlinePreparation} /> : null}
              {isMswdoPortal ? <OfflineDataReadiness {...mswdoOfflinePreparation} variant="mswdo" /> : null}
              {shouldBlockMayorOfflineRoute ? (
                <MayorOfflineAccessNotice />
              ) : shouldBlockBarangayOfflineRoute ? (
                <MayorOfflineAccessNotice message={BARANGAY_OFFLINE_ACCESS_MESSAGE} />
              ) : shouldBlockMswdoOfflineRoute ? (
                <MayorOfflineAccessNotice message={MSWDO_OFFLINE_ACCESS_MESSAGE} />
              ) : (
                <Outlet />
              )}
            </MayorOfflineReadyDismissalContext.Provider>
          </div>
        </main>
      </div>
    </SettingsUnsavedChangesProvider>
  );
};

export default BarangayLayout;
