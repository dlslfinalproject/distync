import React, { useEffect, useMemo, useRef, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { ROLE_CODES } from "../../utils/roleSession";
import Sidebar from "./Sidebar";
import ShellHeader from "./ShellHeader";
import SyncStatusBanner from "./SyncStatusBanner";
import { SettingsUnsavedChangesProvider } from "../../pages/settings/SettingsUnsavedChangesContext";

const SIDEBAR_EXPANDED_WIDTH = "280px";
const SIDEBAR_COLLAPSED_WIDTH = "0px";
const HEADER_BRAND_WIDTH = "280px";
const MOBILE_NAV_QUERY = "(max-width: 768px)";
const COMPACT_NAV_QUERY = "(max-width: 1024px)";

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
    overflowX: "hidden",
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
  const lastNonSettingsCollapseStateRef = useRef(false);
  const location = useLocation();
  const { currentRole } = useAuth();
  const isDonorPortal = currentRole === ROLE_CODES.DONOR;
  const isSettingsRoute = location.pathname.endsWith("/settings");
  const sidebarWidth = isDonorPortal
    ? "0px"
    : isSidebarCollapsed
      ? SIDEBAR_COLLAPSED_WIDTH
      : SIDEBAR_EXPANDED_WIDTH;

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

  const pageStyle = useMemo(
    () => ({
      ...shellStyles.page,
      "--sidebar-width": sidebarWidth,
      "--header-brand-width": HEADER_BRAND_WIDTH,
      gridTemplateColumns: isDonorPortal
        ? "minmax(0, 1fr)"
        : `var(--sidebar-width) minmax(0, 1fr)`,
      gridTemplateRows: isDonorPortal ? "1fr" : "auto 1fr",
    }),
    [isDonorPortal, sidebarWidth],
  );

  const contentStyle = useMemo(
    () => ({
      ...shellStyles.content,
      maxWidth: isSidebarCollapsed ? "100%" : shellStyles.content.maxWidth,
      margin: isSidebarCollapsed ? "0" : shellStyles.content.margin,
    }),
    [isSidebarCollapsed],
  );

  return (
    <SettingsUnsavedChangesProvider>
      <div className="distync-shell" style={pageStyle}>
        {!isDonorPortal ? (
          <ShellHeader
            isSidebarCollapsed={isSidebarCollapsed}
            onToggleSidebarCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
          />
        ) : null}

        {!isDonorPortal ? (
          <>
            <Sidebar
              isCollapsed={isSidebarCollapsed}
              onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
              onClose={() => setIsSidebarCollapsed(true)}
              onNavigate={() => {
                if (isMobileNavigation) {
                  setIsSidebarCollapsed(true);
                }
              }}
            />
            {isMobileNavigation && !isSidebarCollapsed ? (
              <button
                type="button"
                className="distync-sidebar__scrim"
                aria-label="Close navigation menu"
                onClick={() => setIsSidebarCollapsed(true)}
              />
            ) : null}
          </>
        ) : null}

        <main className="distync-shell__main" style={shellStyles.main}>
          <div className="distync-shell__content" style={contentStyle}>
            <SyncStatusBanner />
            <Outlet />
          </div>
        </main>
      </div>
    </SettingsUnsavedChangesProvider>
  );
};

export default BarangayLayout;
