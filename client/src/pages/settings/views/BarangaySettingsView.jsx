import React from "react";
import RoleSettingsViewShell from "../components/RoleSettingsViewShell";

const BarangaySettingsView = (props) => {
  return (
    <RoleSettingsViewShell
      {...props}
      dashboardDescription="Choose a category below to keep the Settings workspace focused and uncluttered. Detailed forms, tables, and logs only appear after you open a section."
    />
  );
};

export default BarangaySettingsView;
