import React from "react";
import RoleSettingsViewShell from "../components/RoleSettingsViewShell";

const MswdoSettingsView = (props) => {
  return (
    <RoleSettingsViewShell
      {...props}
      dashboardDescription="Choose a category below to keep the MSWDO Settings workspace focused and uncluttered. Detailed forms, sync details, and notification controls only appear after you open a section."
    />
  );
};

export default MswdoSettingsView;
