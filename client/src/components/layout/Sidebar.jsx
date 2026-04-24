import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { FiMenu } from "react-icons/fi";
import { useAuth } from "../../context/AuthContext";
import { getAccessMode, getEntryRouteForMode } from "../../utils/accessMode";
import { ROLE_CODES } from "../../utils/roleSession";
import distyncLogo from "../../assets/distync-logo.png";

const getSidebarStyles = (isCollapsed) => ({
  wrapper: {
    height: "100vh",
    maxHeight: "100vh",
    padding: isCollapsed ? "0 12px 18px" : "0 18px 24px",
    boxSizing: "border-box",
    backgroundColor: "#f7fbff",
    borderRight: "1px solid #d6e2ef",
    display: "flex",
    flexDirection: "column",
    gap: isCollapsed ? "18px" : "24px",
    flexShrink: 0,
    position: "sticky",
    top: 0,
    alignSelf: "flex-start",
    overflowX: "hidden",
    overflowY: "hidden",
    transition:
      "padding 260ms cubic-bezier(0.22, 1, 0.36, 1), gap 260ms cubic-bezier(0.22, 1, 0.36, 1)",
  },
  topBar: {
    display: "flex",
    alignItems: "center",
    justifyContent: isCollapsed ? "center" : "flex-start",
    gap: isCollapsed ? "8px" : "10px",
    paddingTop: "20px",
    minWidth: 0,
    flexShrink: 0,
    transition:
      "gap 260ms cubic-bezier(0.22, 1, 0.36, 1), justify-content 260ms cubic-bezier(0.22, 1, 0.36, 1)",
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
  },
  brand: {
    margin: 0,
    padding: 0,
    background: "transparent",
    boxShadow: "none",
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-start",
    flex: isCollapsed ? "0 0 auto" : 1,
    minWidth: 0,
    maxWidth: isCollapsed ? "38px" : "180px",
    opacity: 1,
    overflow: "hidden",
    pointerEvents: "auto",
    transition:
      "flex-basis 260ms cubic-bezier(0.22, 1, 0.36, 1), max-width 260ms cubic-bezier(0.22, 1, 0.36, 1)",
  },
  brandHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: "6px",
    width: isCollapsed ? "auto" : "100%",
    minWidth: 0,
  },
  brandLogo: {
    height: isCollapsed ? "36px" : "56px",
    width: isCollapsed ? "36px" : "56px",
    objectFit: "contain",
    display: "block",
    flexShrink: 0,
    transition:
      "height 260ms cubic-bezier(0.22, 1, 0.36, 1), width 260ms cubic-bezier(0.22, 1, 0.36, 1)",
  },
  brandTitle: {
    margin: 0,
    fontSize: "18px",
    fontWeight: 700,
    letterSpacing: "-0.02em",
    color: "#2F3B55",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    maxWidth: isCollapsed ? 0 : "120px",
    opacity: isCollapsed ? 0 : 1,
    transition:
      "max-width 220ms cubic-bezier(0.22, 1, 0.36, 1), opacity 160ms ease",
  },
  nav: {
    display: "flex",
    flexDirection: "column",
    gap: isCollapsed ? "8px" : "10px",
    marginTop: "10px",
    flex: "1 1 auto",
    minHeight: 0,
    overflowY: "auto",
    overflowX: "hidden",
    paddingRight: isCollapsed ? "0" : "4px",
    transition: "gap 260ms cubic-bezier(0.22, 1, 0.36, 1)",
  },
  navTitle: {
    display: "block",
    fontSize: "15px",
    fontWeight: 700,
    whiteSpace: "nowrap",
    overflow: "hidden",
    maxWidth: isCollapsed ? 0 : "190px",
    opacity: isCollapsed ? 0 : 1,
    transition:
      "max-width 220ms cubic-bezier(0.22, 1, 0.36, 1), opacity 160ms ease",
  },
  compactNavTitle: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "30px",
    height: "30px",
    borderRadius: "10px",
    backgroundColor: "#eef5fc",
    color: "#24496e",
    fontSize: "12px",
    fontWeight: 800,
    letterSpacing: "0.03em",
    opacity: isCollapsed ? 1 : 0,
    maxWidth: isCollapsed ? "30px" : 0,
    overflow: "hidden",
    transition:
      "max-width 220ms cubic-bezier(0.22, 1, 0.36, 1), opacity 180ms ease",
  },
  roleActions: {
    marginTop: 0,
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    maxHeight: isCollapsed ? 0 : "220px",
    opacity: isCollapsed ? 0 : 1,
    overflow: "hidden",
    pointerEvents: isCollapsed ? "none" : "auto",
    flexShrink: 0,
    transition:
      "max-height 260ms cubic-bezier(0.22, 1, 0.36, 1), opacity 180ms ease",
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

const Sidebar = ({ isCollapsed, onToggleCollapse }) => {
  const navigate = useNavigate();
  const { accessMode, clearSession, currentRole } = useAuth();
  const resolvedAccessMode = accessMode || getAccessMode();
  const entryRoute = getEntryRouteForMode(resolvedAccessMode);

  if (currentRole === ROLE_CODES.DONOR) return null;

  const sidebarStyles = getSidebarStyles(isCollapsed);

  const getCompactLabel = (label) => {
    return label
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0])
      .join("")
      .toUpperCase();
  };

  const roleMeta = {
    [ROLE_CODES.BARANGAY]: {
      navItems: [
        { label: "Evacuee Masterlist", to: "/barangay/masterlist" },
        { label: "Relief Goods Distribution", to: "/barangay/stub-distribution" },
      ],
    },
    [ROLE_CODES.MSWDO]: {
      navItems: [
        { label: "Disaster Events", to: "/mswdo/disaster-events" },
        { label: "Evacuee Masterlist", to: "/mswdo/consolidated-masterlist" },
        { label: "Relief Goods Distribution", to: "/mswdo/stub-distribution" },
        { label: "Analytics Dashboard", to: "/mswdo/analytics" },
      ],
    },
    [ROLE_CODES.MAYOR]: {
      navItems: [
        { label: "Inventory Items", to: "/inventory/items" },
        { label: "Inventory Tracking", to: "/inventory/transactions" },
        { label: "Relief Pack Templates", to: "/inventory/relief-pack-templates" },
      ],
    },
  };

  const activeRoleMeta = roleMeta[currentRole] || {
    navItems: [],
  };

  return (
    <aside
      className="distync-sidebar"
      data-collapsed={isCollapsed ? "true" : "false"}
      style={sidebarStyles.wrapper}
    >
      <div className="distync-sidebar__topbar" style={sidebarStyles.topBar}>
        <button
          type="button"
          onClick={onToggleCollapse}
          style={sidebarStyles.menuButton}
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <FiMenu size={20} />
        </button>

        <div style={sidebarStyles.brand}>
          <div style={sidebarStyles.brandHeader}>
            <img src={distyncLogo} alt="Logo" style={sidebarStyles.brandLogo} />
            <h1 style={sidebarStyles.brandTitle}>DISTYNC</h1>
          </div>
        </div>
      </div>

      <nav className="distync-sidebar__nav" style={sidebarStyles.nav}>
        {activeRoleMeta.navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            title={isCollapsed ? item.label : undefined}
            style={{ textDecoration: "none" }}
          >
            {({ isActive }) => (
              <div
                className="distync-sidebar__nav-item"
                style={{
                  backgroundColor: isActive ? "#e1eef9" : "#ffffff",
                  color: isActive ? "#1f4f7d" : "#26435f",
                  border: `1px solid ${isActive ? "#b8d0e7" : "#dce7f3"}`,
                  borderRadius: "14px",
                  padding: isCollapsed ? "11px" : "14px 16px",
                  boxShadow: isActive
                    ? "0 10px 24px rgba(66, 108, 154, 0.12)"
                    : "0 4px 12px rgba(72, 95, 122, 0.04)",
                  transition:
                    "background-color 180ms ease, border-color 180ms ease, box-shadow 180ms ease, padding 260ms cubic-bezier(0.22, 1, 0.36, 1)",
                  marginBottom: "10px",
                  minHeight: "46px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: isCollapsed ? "center" : "flex-start",
                  gap: isCollapsed ? 0 : "10px",
                  overflow: "hidden",
                }}
              >
                <span style={sidebarStyles.compactNavTitle}>
                  {getCompactLabel(item.label)}
                </span>
                <span style={sidebarStyles.navTitle}>{item.label}</span>
              </div>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="distync-sidebar__role-actions" style={sidebarStyles.roleActions}>
        <div
          style={{
            padding: "14px 16px",
            borderRadius: "14px",
            backgroundColor: "#ffffff",
            border: "1px solid #dce7f3",
            color: "#365472",
          }}
        >
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
    </aside>
  );
};

export default Sidebar;
