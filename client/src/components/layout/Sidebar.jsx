import React, { useCallback, useEffect, useRef } from "react";
import { NavLink } from "react-router-dom";
import { FiMenu, FiX } from "react-icons/fi";
import { useAuth } from "../../context/AuthContext";
import { ROLE_CODES } from "../../utils/roleSession";
import distyncLogo from "../../assets/distync-logo.png";
import SidebarAccountMenu from "./SidebarAccountMenu";

const layoutBrandStyles = {
  topBar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: "12px",
    minWidth: 0,
    width: "max-content",
    flexShrink: 0,
  },
  menuButton: {
    border: "1px solid #c7d7e8",
    borderRadius: "12px",
    backgroundColor: "#ffffff",
    color: "#24496e",
    width: "40px",
    height: "40px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    flexShrink: 0,
    padding: 0,
    lineHeight: 0,
  },
  brand: {
    margin: 0,
    padding: 0,
    background: "transparent",
    boxShadow: "none",
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-start",
    flex: "0 0 auto",
    minWidth: 0,
    maxWidth: "100%",
    overflow: "visible",
  },
  brandHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: "12px",
    width: "max-content",
    minWidth: "max-content",
    flexShrink: 0,
  },
  brandLogo: {
    height: "48px",
    width: "48px",
    objectFit: "contain",
    display: "block",
    flexShrink: 0,
  },
  brandTitle: {
    margin: 0,
    fontSize: "18px",
    fontWeight: 700,
    letterSpacing: "-0.02em",
    color: "#2f3b55",
    whiteSpace: "nowrap",
    overflow: "visible",
    textOverflow: "clip",
    maxWidth: "none",
    opacity: 1,
    flexShrink: 0,
  },
};

export const SidebarBrandStrip = ({
  onToggleCollapse,
  isCollapsed,
  style,
  title,
  navigationId,
  buttonRef,
}) => (
  <div
    className="distync-layout__brand-strip"
    style={{
      ...layoutBrandStyles.topBar,
      ...(style || {}),
    }}
  >
    <button
      type="button"
      ref={buttonRef}
      onClick={onToggleCollapse}
      style={layoutBrandStyles.menuButton}
      title={title || (isCollapsed ? "Expand sidebar" : "Collapse sidebar")}
      aria-label={title || (isCollapsed ? "Open navigation menu" : "Close navigation menu")}
      aria-expanded={!isCollapsed}
      aria-controls={navigationId}
    >
      <FiMenu size={20} />
    </button>

    <div style={layoutBrandStyles.brand}>
      <div style={layoutBrandStyles.brandHeader}>
        <img src={distyncLogo} alt="Logo" style={layoutBrandStyles.brandLogo} />
        <h1 style={layoutBrandStyles.brandTitle}>DISTYNC</h1>
      </div>
    </div>
  </div>
);

const getSidebarStyles = (isCollapsed) => ({
  wrapper: {
    height: "calc(100dvh - var(--shell-header-height, 68px))",
    maxHeight: "calc(100dvh - var(--shell-header-height, 68px))",
    padding: isCollapsed ? "0" : "14px 14px 18px",
    boxSizing: "border-box",
    backgroundColor: isCollapsed ? "transparent" : "#f4f8fc",
    borderRight: isCollapsed ? "0 solid transparent" : "1px solid #ccdceb",
    display: "flex",
    flexDirection: "column",
    flexShrink: 0,
    alignSelf: "stretch",
    position: "sticky",
    top: "var(--shell-header-height, 68px)",
    overflow: "hidden",
    zIndex: 20,
    opacity: isCollapsed ? 0 : 1,
    pointerEvents: isCollapsed ? "none" : "auto",
    boxShadow: isCollapsed ? "none" : "8px 0 24px rgba(72, 95, 122, 0.08)",
    transition:
      "padding 220ms cubic-bezier(0.22, 1, 0.36, 1), opacity 160ms ease, box-shadow 220ms ease",
  },
  body: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    flex: "1 1 auto",
    minHeight: 0,
    maxHeight: "100%",
    overflow: "hidden",
  },
  nav: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    flex: "1 1 auto",
    minHeight: 0,
    overflowY: "auto",
    overflowX: "hidden",
    overscrollBehavior: "contain",
    padding: "2px 2px 8px",
  },
  navTitle: {
    display: "block",
    fontSize: "13px",
    fontWeight: 700,
    lineHeight: 1.35,
    whiteSpace: "normal",
    overflowWrap: "anywhere",
    minWidth: 0,
  },
  navSectionLabel: {
    display: "block",
    margin: "4px 12px -2px",
    color: "#7f90a3",
    fontSize: "11px",
    fontWeight: 700,
    lineHeight: 1.2,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
  },
  accountArea: {
    marginTop: "auto",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    flexShrink: 0,
  },
});

const roleMeta = {
  [ROLE_CODES.BARANGAY]: {
    navItems: [
      { label: "Evacuee Masterlist Management", to: "/barangay/masterlist" },
      { label: "Relief Goods Distribution", to: "/barangay/stub-distribution" },
      { label: "Distribution History", to: "/barangay/distribution-history" },
      { type: "section", label: "Monitoring" },
      { label: "Sync Center", to: "/barangay/sync", isSectionChild: true },
      { label: "Anomaly Tracking", to: "/barangay/anomalies", isSectionChild: true },
    ],
  },
  [ROLE_CODES.MSWDO]: {
    navItems: [
      { label: "Disaster Event Management", to: "/mswdo/disaster-events" },
      { label: "Disaster Events Summary", to: "/mswdo/disaster-reports" },
      { label: "Evacuee Masterlist Management", to: "/mswdo/consolidated-masterlist" },
      { label: "Relief Goods Distribution", to: "/mswdo/stub-distribution" },
      { label: "Distribution History", to: "/mswdo/distribution-history" },
      { label: "Evacuee Analytics Dashboard", to: "/mswdo/analytics" },
      { label: "Anomaly Tracking", to: "/mswdo/anomalies" },
      { label: "Sync Center", to: "/mswdo/sync" },
    ],
  },
  [ROLE_CODES.MAYOR]: {
    navItems: [
      { label: "Inventory Items Management", to: "/inventory/items" },
      { label: "Relief Pack Templates Management", to: "/inventory/relief-pack-templates", },
      { label: "Inventory Distribution Management", to: "/inventory/distribution" },
      { label: "Inventory Tracking Management", to: "/inventory/transactions" },
      { label: "Inventory Forecasting Management", to: "/inventory/forecasts" },
      { label: "Donation Management", to: "/inventory/donations" },
      { label: "Audit Trail", to: "/inventory/system-logs" },
    ],
  },
};

const Sidebar = ({
  isCollapsed,
  isMobileNavigation,
  navigationId,
  onNavigate,
  onClose,
}) => {
  const { currentRole } = useAuth();
  const sidebarRef = useRef(null);
  const navRef = useRef(null);

  const containDesktopSidebarWheel = useCallback((event) => {
    if (isMobileNavigation || isCollapsed || event.deltaY === 0) {
      return;
    }

    const scrollRegion = navRef.current;
    if (!scrollRegion) {
      return;
    }

    const canScroll = scrollRegion.scrollHeight > scrollRegion.clientHeight + 1;

    if (!canScroll) {
      event.preventDefault();
      return;
    }

    const isScrollingDown = event.deltaY > 0;
    const isAtTop = scrollRegion.scrollTop <= 0;
    const isAtBottom =
      scrollRegion.scrollTop + scrollRegion.clientHeight >=
      scrollRegion.scrollHeight - 1;

    if ((isScrollingDown && isAtBottom) || (!isScrollingDown && isAtTop)) {
      event.preventDefault();
      return;
    }

    if (!scrollRegion.contains(event.target)) {
      scrollRegion.scrollTop += event.deltaY;
      event.preventDefault();
    }
  }, [isCollapsed, isMobileNavigation]);

  useEffect(() => {
    const sidebarElement = sidebarRef.current;
    if (!sidebarElement) {
      return undefined;
    }

    sidebarElement.addEventListener("wheel", containDesktopSidebarWheel, {
      passive: false,
    });

    return () => {
      sidebarElement.removeEventListener("wheel", containDesktopSidebarWheel);
    };
  }, [containDesktopSidebarWheel]);

  if (currentRole === ROLE_CODES.DONOR) return null;

  const sidebarStyles = getSidebarStyles(isCollapsed);
  const activeRoleMeta = roleMeta[currentRole] || {
    navItems: [],
  };

  return (
    <aside
      id={navigationId}
      ref={sidebarRef}
      className="distync-sidebar"
      data-collapsed={isCollapsed ? "true" : "false"}
      style={sidebarStyles.wrapper}
      aria-label="Primary navigation"
    >
      <div className="distync-sidebar__body" style={sidebarStyles.body}>
        <div className="distync-sidebar__mobile-header">
          <div className="distync-sidebar__mobile-brand" aria-label="DISTYNC">
            <img
              src={distyncLogo}
              alt="DISTYNC logo"
              className="distync-sidebar__mobile-logo"
            />
            <span className="distync-sidebar__mobile-wordmark">DISTYNC</span>
          </div>

          <button
            type="button"
            className="distync-sidebar__mobile-close"
            aria-label="Close navigation menu"
            onClick={onClose}
          >
            <FiX size={20} />
          </button>
        </div>

        <nav className="distync-sidebar__nav" style={sidebarStyles.nav} ref={navRef}>
          {activeRoleMeta.navItems.map((item) => {
            if (item.type === "section") {
              return (
                <div
                  key={`section-${item.label}`}
                  className="distync-sidebar__nav-section-label"
                  style={{
                    ...sidebarStyles.navSectionLabel,
                    display: isCollapsed ? "none" : sidebarStyles.navSectionLabel.display,
                  }}
                  aria-hidden={isCollapsed ? "true" : undefined}
                >
                  {item.label}
                </div>
              );
            }

            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={onNavigate}
                style={{
                  textDecoration: "none",
                  display: "block",
                  marginLeft: item.isSectionChild && !isCollapsed ? "8px" : 0,
                }}
              >
                {({ isActive }) => (
                  <div
                    className="distync-sidebar__nav-item"
                    style={{
                      backgroundColor: isActive
                        ? "#e1eef9"
                        : "transparent",
                      color: isActive ? "#1f4f7d" : "#26435f",
                      border: `1px solid ${isActive ? "#b8d0e7" : "transparent"}`,
                      borderRadius: "10px",
                      padding: "10px 12px",
                      boxShadow: isActive
                        ? "0 8px 18px rgba(66, 108, 154, 0.10)"
                        : "none",
                      transition:
                        "background-color 180ms ease, border-color 180ms ease, box-shadow 180ms ease",
                      marginBottom: 0,
                      minHeight: "44px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "flex-start",
                      overflow: "visible",
                      backdropFilter: "blur(8px)",
                    }}
                  >
                    <span style={sidebarStyles.navTitle}>{item.label}</span>
                  </div>
                )}
              </NavLink>
            );
          })}
        </nav>

        <div className="distync-sidebar__account-area" style={sidebarStyles.accountArea}>
          <SidebarAccountMenu />
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
