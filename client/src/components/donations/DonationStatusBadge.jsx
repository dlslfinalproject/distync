import React from "react";
import { getDonationBadgeStyle } from "../../features/donations/donationStatus";

const DonationStatusBadge = ({ label }) => (
  <span
    style={{
      display: "inline-flex",
      alignItems: "center",
      borderRadius: "999px",
      padding: "4px 10px",
      fontSize: "12px",
      fontWeight: 700,
      ...getDonationBadgeStyle(label),
    }}
  >
    {label}
  </span>
);

export default DonationStatusBadge;
