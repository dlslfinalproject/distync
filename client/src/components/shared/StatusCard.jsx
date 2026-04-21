import React from "react";
import { shellStyles } from "../layout/BarangayLayout";

const cardStyles = {
  label: {
    margin: 0,
    color: "#688199",
    fontSize: "12px",
    fontWeight: 700,
    lineHeight: 1.35,
    minHeight: "3.3em",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  value: {
    margin: "10px 0 0",
    fontSize: "36px",
    fontWeight: 800,
    lineHeight: 1.05,
    color: "#17324d",
    letterSpacing: "-0.03em",
  },
};

const StatusCard = ({ label, value }) => {
  return (
    <div style={shellStyles.card}>
      <p style={cardStyles.label}>{label}</p>
      <p style={cardStyles.value}>{value}</p>
    </div>
  );
};

export default StatusCard;
