import React from "react";
import { shellStyles } from "../layout/BarangayLayout";

const StatusCard = ({ label, value, helperText }) => {
  return (
    <div style={shellStyles.card}>
      <p style={shellStyles.mutedText}>{label}</p>
      <p style={shellStyles.statValue}>{value}</p>
      <p style={{ ...shellStyles.mutedText, marginTop: "8px" }}>{helperText}</p>
    </div>
  );
};

export default StatusCard;
