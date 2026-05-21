import React, { useMemo, useState } from "react";
import { Outlet } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { ROLE_CODES } from "../../utils/roleSession";
import Sidebar from "./Sidebar";
import SyncStatusBanner from "./SyncStatusBanner";

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

const BarangayLayout = () => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const { currentRole } = useAuth();
  const isDonorPortal = currentRole === ROLE_CODES.DONOR;
  const sidebarWidth = isDonorPortal
    ? "0px"
    : isSidebarCollapsed
      ? "116px"
      : "280px";

  const pageStyle = useMemo(
    () => ({
      ...shellStyles.page,
      "--sidebar-width": sidebarWidth,
      gridTemplateColumns: isDonorPortal
        ? "minmax(0, 1fr)"
        : `var(--sidebar-width) minmax(0, 1fr)`,
    }),
    [isDonorPortal, sidebarWidth],
  );

  return (
    <div className="distync-shell" style={pageStyle}>
      {!isDonorPortal ? (
        <Sidebar
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
        />
      ) : null}

      <main className="distync-shell__main" style={shellStyles.main}>
        <div className="distync-shell__content" style={shellStyles.content}>
          <SyncStatusBanner />
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default BarangayLayout;
