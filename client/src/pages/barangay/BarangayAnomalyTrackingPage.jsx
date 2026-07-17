import React from "react";
import AnomalyTrackingPage from "../mswdo/AnomalyTrackingPage";
import { useAuth } from "../../context/AuthContext";
import { useBarangayDashboard } from "../../features/barangay-dashboard/useBarangayDashboard";

const BarangayAnomalyTrackingPage = () => {
  const { authenticatedUser } = useAuth();
  const {
    assignedBarangay,
    assignedBarangayId,
    availableEvents,
    errorMessage: dashboardErrorMessage,
  } = useBarangayDashboard({
    userId: authenticatedUser?.id || "",
  });

  return (
    <AnomalyTrackingPage
      scope="barangay"
      assignedBarangay={assignedBarangay}
      assignedBarangayId={
        assignedBarangayId || authenticatedUser?.default_barangay_id || ""
      }
      scopedDisasterEvents={availableEvents}
      scopeErrorMessage={dashboardErrorMessage}
    />
  );
};

export default BarangayAnomalyTrackingPage;
