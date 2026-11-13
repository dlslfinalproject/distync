import React from "react";
import HeaderNotifications from "./HeaderNotifications";
import { SidebarBrandStrip } from "./Sidebar";

const shellHeaderStyles = {
  wrapper: {
    gridColumn: "1 / -1",
    display: "grid",
    gridTemplateColumns: "var(--header-brand-width, 280px) minmax(0, 1fr)",
    alignItems: "stretch",
    minWidth: 0,
    minHeight: "var(--shell-header-height, 68px)",
    position: "sticky",
    top: 0,
    zIndex: 90,
    backgroundColor: "#f4f8fc",
  },
  brandArea: {
    padding: "10px 14px",
    minWidth: 0,
    display: "flex",
    alignItems: "center",
    backgroundColor: "#f4f8fc",
    borderBottom: "1px solid #ccdceb",
    overflow: "hidden",
    transition:
      "padding 260ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 220ms ease",
  },
  actionsArea: {
    padding: "10px clamp(18px, 3vw, 32px) 10px 0",
    minWidth: 0,
    display: "flex",
    justifyContent: "flex-end",
    alignItems: "center",
    backgroundColor: "#f4f8fc",
    borderBottom: "1px solid rgba(204, 220, 235, 0.72)",
  },
};

const ShellHeader = ({
  isSidebarCollapsed,
  isMobileNavigation,
  navigationId,
  onToggleSidebarCollapse,
  toggleRef,
}) => {
  const toggleTitle = isMobileNavigation
    ? isSidebarCollapsed
      ? "Open navigation"
      : "Close navigation"
    : isSidebarCollapsed
      ? "Show navigation"
      : "Hide navigation";

  return (
    <div
      className="distync-shell__topbar"
      data-sidebar-collapsed={isSidebarCollapsed ? "true" : "false"}
      style={shellHeaderStyles.wrapper}
    >
      <div className="distync-shell__brand-area" style={shellHeaderStyles.brandArea}>
        <SidebarBrandStrip
          isCollapsed={isSidebarCollapsed}
          navigationId={navigationId}
          buttonRef={toggleRef}
          onToggleCollapse={onToggleSidebarCollapse}
          title={toggleTitle}
        />
      </div>

      <div className="distync-shell__actions-area" style={shellHeaderStyles.actionsArea}>
        <HeaderNotifications />
      </div>
    </div>
  );
};

export default ShellHeader;
