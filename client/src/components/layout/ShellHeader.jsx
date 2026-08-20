import React from "react";
import HeaderNotifications from "./HeaderNotifications";
import { SidebarBrandStrip } from "./Sidebar";

const shellHeaderStyles = {
  wrapper: {
    gridColumn: "1 / -1",
    display: "grid",
    gridTemplateColumns: "var(--header-brand-width, 280px) minmax(0, 1fr)",
    alignItems: "start",
    minWidth: 0,
  },
  brandArea: {
    padding: "20px 16px 0",
    minWidth: 0,
  },
  actionsArea: {
    padding: "20px clamp(18px, 3vw, 32px) 0 0",
    minWidth: 0,
    display: "flex",
    justifyContent: "flex-end",
    alignItems: "center",
  },
};

const ShellHeader = ({ isSidebarCollapsed, onToggleSidebarCollapse }) => {
  return (
    <div className="distync-shell__topbar" style={shellHeaderStyles.wrapper}>
      <div className="distync-shell__brand-area" style={shellHeaderStyles.brandArea}>
        <SidebarBrandStrip
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={onToggleSidebarCollapse}
        />
      </div>

      <div className="distync-shell__actions-area" style={shellHeaderStyles.actionsArea}>
        <HeaderNotifications />
      </div>
    </div>
  );
};

export default ShellHeader;
