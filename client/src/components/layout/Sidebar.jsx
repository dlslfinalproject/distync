import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { FiMenu } from "react-icons/fi";
import { useAuth } from "../../context/AuthContext";
import { getAccessMode, getEntryRouteForMode } from "../../utils/accessMode";
import { ROLE_CODES } from "../../utils/roleSession";
import distyncLogo from "../../assets/distync-logo.png";

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
      onClick={onToggleCollapse}
      style={layoutBrandStyles.menuButton}
      title={title || (isCollapsed ? "Expand sidebar" : "Collapse sidebar")}
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
    height: isCollapsed ? "0" : "100vh",
    maxHeight: isCollapsed ? "0" : "100vh",
    padding: isCollapsed ? "0" : "20px 16px 24px",
    boxSizing: "border-box",
    backgroundColor: "transparent",
    borderRight: "none",
    display: "flex",
    flexDirection: "column",
    flexShrink: 0,
    position: "sticky",
    top: 0,
    alignSelf: "flex-start",
    overflow: "hidden",
    zIndex: 20,
    opacity: isCollapsed ? 0 : 1,
    pointerEvents: isCollapsed ? "none" : "auto",
    transform: isCollapsed ? "translateX(-18px)" : "translateX(0)",
    transition:
      "height 260ms cubic-bezier(0.22, 1, 0.36, 1), max-height 260ms cubic-bezier(0.22, 1, 0.36, 1), padding 260ms cubic-bezier(0.22, 1, 0.36, 1), opacity 180ms ease, transform 260ms cubic-bezier(0.22, 1, 0.36, 1)",
  },
  body: {
    display: "flex",
    flexDirection: "column",
    gap: "20px",
    flex: "1 1 auto",
    minHeight: 0,
    maxHeight: "100%",
    overflow: "hidden",
  },
  nav: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    flex: "1 1 auto",
    minHeight: 0,
    overflowY: "auto",
    overflowX: "hidden",
    paddingRight: "4px",
  },
  navTitle: {
    display: "block",
    fontSize: "13px",
    fontWeight: 700,
    whiteSpace: "nowrap",
    overflow: "visible",
    textOverflow: "clip",
    maxWidth: "none",
  },
  roleActions: {
    marginTop: 0,
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    flexShrink: 0,
  },
  roleCard: {
    padding: "14px 16px",
    borderRadius: "14px",
    backgroundColor: "rgba(255, 255, 255, 0.72)",
    border: "1px solid rgba(220, 231, 243, 0.9)",
    color: "#365472",
    backdropFilter: "blur(10px)",
  },
  roleButton: {
    width: "100%",
    border: "1px solid #c7d7e8",
    borderRadius: "12px",
    backgroundColor: "#ffffff",
    color: "#24496e",
    padding: "11px 14px",
    fontSize: "13px",
    fontWeight: 700,
    cursor: "pointer",
    textAlign: "left",
  },
});

const roleMeta = {
  [ROLE_CODES.BARANGAY]: {
    navItems: [
      { label: "Evacuee Masterlist Management", to: "/barangay/masterlist" },
      { label: "Relief Goods Distribution", to: "/barangay/stub-distribution" },
      { label: "Distribution History", to: "/barangay/distribution-history" },
      { label: "Anomaly Tracking Management", to: "/barangay/anomalies" },
      { label: "Sync Center", to: "/barangay/sync" },
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
      { label: "Anomaly Tracking Management", to: "/mswdo/anomalies" },
      { label: "Sync Center", to: "/mswdo/sync" },
    ],
  },
  [ROLE_CODES.MAYOR]: {
    navItems: [
      { label: "Inventory Items Management", to: "/inventory/items" },
      { label: "Relief Pack Templates", to: "/inventory/relief-pack-templates", },
      { label: "Inventory Tracking Management", to: "/inventory/transactions" },
      { label: "Inventory Distribution", to: "/inventory/distribution" },
      { label: "Inventory Forecasts", to: "/inventory/forecasts" },
      { label: "Donation Management", to: "/inventory/donations" },
    ],
  },
};

const Sidebar = ({ isCollapsed, onToggleCollapse }) => {
  const navigate = useNavigate();
  const { accessMode, clearSession, currentRole } = useAuth();
  const resolvedAccessMode = accessMode || getAccessMode();
  const entryRoute = getEntryRouteForMode(resolvedAccessMode);

  if (currentRole === ROLE_CODES.DONOR) return null;

  const sidebarStyles = getSidebarStyles(isCollapsed);
  const activeRoleMeta = roleMeta[currentRole] || {
    navItems: [],
  };

  return (
    <aside
      className="distync-sidebar"
      data-collapsed={isCollapsed ? "true" : "false"}
      style={sidebarStyles.wrapper}
    >
      <div className="distync-sidebar__body" style={sidebarStyles.body}>
        <nav className="distync-sidebar__nav" style={sidebarStyles.nav}>
          {activeRoleMeta.navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              style={{ textDecoration: "none" }}
            >
              {({ isActive }) => (
                <div
                  className="distync-sidebar__nav-item"
                  style={{
                    backgroundColor: isActive
                      ? "#e1eef9"
                      : "rgba(255, 255, 255, 0.82)",
                    color: isActive ? "#1f4f7d" : "#26435f",
                    border: `1px solid ${isActive ? "#b8d0e7" : "#dce7f3"}`,
                    borderRadius: "14px",
                    padding: "14px 12px",
                    boxShadow: isActive
                      ? "0 10px 24px rgba(66, 108, 154, 0.12)"
                      : "0 4px 12px rgba(72, 95, 122, 0.04)",
                    transition:
                      "background-color 180ms ease, border-color 180ms ease, box-shadow 180ms ease",
                    marginBottom: "10px",
                    minHeight: "46px",
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
          ))}
        </nav>

        <div
          className="distync-sidebar__role-actions"
          style={sidebarStyles.roleActions}
        >
          <div style={sidebarStyles.roleCard}>
            <p
              style={{
                margin: 0,
                fontSize: "12px",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              Current Role
            </p>
            <p style={{ margin: "8px 0 0", fontSize: "16px", fontWeight: 700 }}>
              {currentRole || "Not selected"}
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              clearSession();
              navigate(entryRoute, { replace: true });
            }}
            style={sidebarStyles.roleButton}
          >
            Switch Role
          </button>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
