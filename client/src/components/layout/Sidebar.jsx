import React from "react";
import { NavLink, useLocation } from "react-router-dom";

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
};

const Sidebar = () => {
  const location = useLocation();
  const isMswdoView = location.pathname.startsWith("/mswdo");

  const brandTag = isMswdoView ? "MSWDO Panel" : "Barangay Panel";
  const brandText = isMswdoView
    ? "Planning and monitoring workspace for disaster events and later MSWDO dashboards."
    : "Shared shell for barangay workflows, verification, and frontline encoding.";

  const navItems = isMswdoView
    ? [
        {
          label: "Disaster Events",
          description: "Create events, review active incidents, and inspect affected barangays.",
          to: "/mswdo/disaster-events",
        },
      ]
    : [
        {
          label: "Evacuee Registration",
          description: "Household summaries, encoded evacuees, and barangay records.",
          to: "/barangay/masterlist",
        },
        {
          label: "Stub Verification",
          description: "Search and validate issued stubs before claiming.",
          to: "/barangay/stub-verification",
        },
      ];

  return (
    <aside style={sidebarStyles.wrapper}>
      <div style={sidebarStyles.brand}>
        <span style={sidebarStyles.brandTag}>{brandTag}</span>
        <h1 style={sidebarStyles.brandTitle}>DISTYNC</h1>
        <p style={sidebarStyles.brandText}>{brandText}</p>
      </div>

      <nav style={sidebarStyles.nav}>
        <p style={sidebarStyles.navLabel}>Navigation</p>
        {navItems.map((item) => (
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
    </aside>
  );
};

export default Sidebar;
