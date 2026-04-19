import React, { useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";

export const shellStyles = {
  page: {
    minHeight: "100vh",
    display: "flex",
    background:
      "linear-gradient(180deg, #edf4fb 0%, #e5eef7 50%, #dde7f2 100%)",
    color: "#1b2b40",
    fontFamily: '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif',
  },
  main: {
    flex: 1,
    padding: "28px 32px",
    boxSizing: "border-box",
    width: "100%",
  },
  content: {
    maxWidth: "1180px",
    margin: "0 auto",
    display: "flex",
    flexDirection: "column",
    gap: "20px",
  },
  card: {
    backgroundColor: "#ffffff",
    border: "1px solid #d7e2ef",
    borderRadius: "18px",
    padding: "22px",
    boxShadow: "0 10px 24px rgba(76, 101, 132, 0.08)",
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

  return (
    <div
      style={{
        ...shellStyles.page,
        flexDirection: isSidebarCollapsed ? "column" : "row",
      }}
    >
      <Sidebar
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
      />

      <main style={shellStyles.main}>
        <div style={shellStyles.content}>
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default BarangayLayout;