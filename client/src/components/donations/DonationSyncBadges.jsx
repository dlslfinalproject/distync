import React from "react";
import SyncStatusBadge from "../shared/SyncStatusBadge";

const DonationSyncBadge = ({ status, compact = true }) => {
  return <SyncStatusBadge status={status} compact={compact} />;
};

export default DonationSyncBadge;
