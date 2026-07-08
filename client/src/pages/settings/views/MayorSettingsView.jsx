import React from "react";
import RoleSettingsViewShell from "../components/RoleSettingsViewShell";

const MayorSettingsView = (props) => {
  return (
    <RoleSettingsViewShell
      {...props}
      dashboardDescription="Choose a category below to keep the Mayor Settings workspace focused and uncluttered. Detailed forms and system summaries only appear after you open a section."
    />
  );
};

export default MayorSettingsView;
