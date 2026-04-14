import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { getAccessMode, getEntryRouteForMode } from "../../utils/accessMode";
import {
  clearCurrentRole,
  getCurrentRole,
  ROLE_CODES,
} from "../../utils/roleSession";

const sidebarStyles = {
  wrapper: {
    width: "280px",
    minHeight: "100vh",
    padding: "24px 18px",
    boxSizing: "border-box",
    backgroundColor: "#f7fbff",
    borderRight: "1px solid #d6e2ef",
    display: "flex",
    flexDirection: "column",
    gap: "24px",
  },
  brand: {
    padding: "18px",
    borderRadius: "18px",
    background: "linear-gradient(135deg, #2c5f93 0%, #4f85bc 100%)",
    color: "#ffffff",
    boxShadow: "0 14px 26px rgba(41, 84, 132, 0.18)",
  },
  brandTag: {
    display: "inline-block",
    marginBottom: "10px",
    padding: "6px 10px",
    borderRadius: "999px",
    backgroundColor: "rgba(255, 255, 255, 0.16)",
    fontSize: "12px",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  brandTitle: {
    margin: 0,
    fontSize: "26px",
    fontWeight: 700,
  },
  brandText: {
    margin: "8px 0 0",
    color: "rgba(255, 255, 255, 0.84)",
    fontSize: "14px",
    lineHeight: 1.5,
  },
  nav: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  navLabel: {
    margin: "0 10px 6px",
    color: "#688097",
    fontSize: "12px",
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
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
  const currentRole = getCurrentRole();
  const accessMode = getAccessMode();
  const entryRoute = getEntryRouteForMode(accessMode);

  const roleMeta = {
    [ROLE_CODES.BARANGAY]: {
      tag: "Barangay Panel",
      text: "Frontline registration, verification, and distribution workflow.",
      navItems: [
        {
          label: "Masterlist",
          description: "Household summaries, encoded evacuees, and barangay records.",
          to: "/barangay/masterlist",
        },
        {
          label: "Stub Verification",
          description: "Search and validate issued stubs before claiming.",
          to: "/barangay/stub-verification",
        },
        {
          label: "Distribution",
          description: "Record released relief items after stub verification.",
          to: "/barangay/distribution-transaction",
        },
      ],
    },
    [ROLE_CODES.MSWDO]: {
      tag: "MSWDO Panel",
      text: "Planning and monitoring workspace for disaster events and dashboards.",
      navItems: [
        {
          label: "Analytics Dashboard",
          description: "Review summary metrics and visual trends for active incidents.",
          to: "/mswdo/analytics-dashboard",
        },
        {
          label: "Consolidated Masterlist",
          description: "Monitor household and evacuee records across barangays.",
          to: "/mswdo/consolidated-masterlist",
        },
        {
          label: "Disaster Events",
          description: "Create events, review active incidents, and inspect affected barangays.",
          to: "/mswdo/disaster-events",
        },
      ],
    },
    [ROLE_CODES.MAYOR]: {
      tag: "Mayor Panel",
      text: "Inventory oversight, templates, and supply-related monitoring pages.",
      navItems: [
        {
          label: "Inventory Items",
          description: "Review and manage item definitions used across inventory modules.",
          to: "/inventory/items",
        },
        {
          label: "Inventory Batches",
          description: "Monitor stock intake and available quantities per batch.",
          to: "/inventory/batches",
        },
        {
          label: "Inventory Transactions",
          description: "Track stock movement history and adjustments.",
          to: "/inventory/transactions",
        },
        {
          label: "Suppliers",
          description: "Maintain supplier records linked to stock intake.",
          to: "/inventory/suppliers",
        },
        {
          label: "Relief Pack Templates",
          description: "Manage reusable relief pack compositions for planning.",
          to: "/inventory/relief-pack-templates",
        },
      ],
    },
    [ROLE_CODES.DONOR]: {
      tag: "Donor Panel",
      text: "Temporary donor-facing navigation for development and demos.",
      navItems: [
        {
          label: "Donation Information",
          description: "Review the temporary donor-facing landing page.",
          to: "/donations",
        },
      ],
    },
  };

  const activeRoleMeta = roleMeta[currentRole] || {
    tag: "Role Not Set",
    text: "Choose a role to begin exploring the app.",
    navItems: [],
  };

  return (
    <aside style={sidebarStyles.wrapper}>
      <div style={sidebarStyles.brand}>
        <span style={sidebarStyles.brandTag}>{activeRoleMeta.tag}</span>
        <h1 style={sidebarStyles.brandTitle}>DISTYNC</h1>
        <p style={sidebarStyles.brandText}>{activeRoleMeta.text}</p>
      </div>

      <nav style={sidebarStyles.nav}>
        <p style={sidebarStyles.navLabel}>Navigation</p>
        {activeRoleMeta.navItems.map((item) => (
          <NavLink key={item.to} to={item.to} style={sidebarStyles.navLink}>
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
                }}
              >
                <span style={sidebarStyles.navTitle}>{item.label}</span>
                <span
                  style={{
                    ...sidebarStyles.navText,
                    color: isActive ? "#476b90" : "#6f8091",
                  }}
                >
                  {item.description}
                </span>
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
          <p style={{ margin: 0, fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Current Role
          </p>
          <p style={{ margin: "8px 0 0", fontSize: "16px", fontWeight: 700 }}>
            {currentRole || "Not selected"}
          </p>
        </div>
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
            Current Mode
          </p>
          <p style={{ margin: "8px 0 0", fontSize: "16px", fontWeight: 700 }}>
            {accessMode}
          </p>
        </div>

        <button
          type="button"
          onClick={() => navigate(entryRoute)}
          style={sidebarStyles.roleButton}
        >
          Switch Role
        </button>
        <button
          type="button"
          onClick={() => {
            clearCurrentRole();
            navigate(entryRoute, { replace: true });
          }}
          style={sidebarStyles.roleButton}
        >
          Clear Role
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
