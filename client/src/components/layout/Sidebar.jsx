import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { getAccessMode, getEntryRouteForMode } from "../../utils/accessMode";
import { ROLE_CODES } from "../../utils/roleSession";
import distyncLogo from "../../assets/distync-logo.png";

const sidebarStyles = {
  wrapper: {
    width: "280px",
    height: "100vh",
    padding: "0 18px 24px",
    boxSizing: "border-box",
    backgroundColor: "#f7fbff",
    borderRight: "1px solid #d6e2ef",
    display: "flex",
    flexDirection: "column",
    gap: "24px",
    minWidth: "280px",
    flexShrink: 0,
    position: "sticky",
    top: 0,
    alignSelf: "flex-start",
    overflowY: "auto",
  },
  brand: {
    margin: "0 -18px",
    background: "#f7fbff",
    color: "#ffffff",
    boxShadow: "0 4px 20px rgba(115, 146, 214, 0.15)",
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    justifyContent: "center",
  },
  brandHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-start",
  },
  brandLogo: {
    height: "90px",
    width: "auto",
    display: "block",
  },
  brandTitle: {
    margin: 0,
    fontSize: "28px",
    fontWeight: 700,
    letterSpacing: "-0.02em",
    color: "#2F3B55",
  },
  nav: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    marginTop: "10px",
  },
  navLink: {
    textDecoration: "none",
    borderRadius: "14px",
    padding: "14px 16px",
    display: "block",
    transition: "all 0.2s ease",
  },
  navTitle: {
    display: "block",
    fontSize: "15px",
    fontWeight: 700,
  },
  navText: {
    display: "block",
    marginTop: "4px",
    fontSize: "13px",
    lineHeight: 1.5,
  },
  roleActions: {
    marginTop: "auto",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
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
};

const Sidebar = () => {
  const navigate = useNavigate();
  const { accessMode, clearSession, currentRole, isAuthenticated } = useAuth();
  const resolvedAccessMode = accessMode || getAccessMode();
  const entryRoute = getEntryRouteForMode(resolvedAccessMode);

  if (currentRole === ROLE_CODES.DONOR) return null;

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
        {
          label: "Evacuee Masterlist", to: "/mswdo/consolidated-masterlist",
        },
        { label: "Analytics Dashboard", to: "/mswdo/analytics" },
      ],
    },
    [ROLE_CODES.MAYOR]: {
      navItems: [
        { label: "Inventory Items", to: "/inventory/items" },
        { label: "Inventory Batches", to: "/inventory/batches" },
        { label: "Inventory Transactions", to: "/inventory/transactions" },
        { label: "Suppliers", to: "/inventory/suppliers" },
        {
          label: "Relief Pack Templates",
          to: "/inventory/relief-pack-templates",
        },
      ],
    },
  };

  const activeRoleMeta = roleMeta[currentRole] || {
    tag: "Guest",
    navItems: [],
  };

  return (
    <aside style={sidebarStyles.wrapper}>
      <div style={sidebarStyles.brand}>
        <span style={sidebarStyles.brandTag}>{activeRoleMeta.tag}</span>
        <div style={sidebarStyles.brandHeader}>
          <img src={distyncLogo} alt="Logo" style={sidebarStyles.brandLogo} />
          <h1 style={sidebarStyles.brandTitle}>DISTYNC</h1>
        </div>
      </div>

      <nav style={sidebarStyles.nav}>
        {activeRoleMeta.navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            style={{ textDecoration: "none" }}
          >
            {({ isActive }) => (
              <div
                style={{
                  backgroundColor: isActive ? "#e1eef9" : "#ffffff",
                  color: isActive ? "#1f4f7d" : "#26435f",
                  border: `1px solid ${isActive ? "#b8d0e7" : "#dce7f3"}`,
                  borderRadius: "14px",
                  padding: "14px 16px",
                  boxShadow: isActive
                    ? "0 10px 24px rgba(66, 108, 154, 0.12)"
                    : "0 4px 12px rgba(72, 95, 122, 0.04)",
                  transition: "all 0.2s ease",
                  marginBottom: "10px",
                }}
              >
                <span style={sidebarStyles.navTitle}>{item.label}</span>
              </div>
            )}
          </NavLink>
        ))}
      </nav>

      <div style={sidebarStyles.roleActions}>
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