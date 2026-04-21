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
  description: {
    margin: "12px 0 0",
    color: "#4f677f",
    fontSize: "14px",
    lineHeight: 1.5,
  },
};

const StatusCard = ({ label, value, description, accentColor }) => {
  const cardStyle = accentColor
    ? {
        ...shellStyles.card,
        borderTop: `4px solid ${accentColor}`,
        boxShadow: `0 10px 24px ${accentColor}1a`,
      }
    : shellStyles.card;

  return (
    <div style={cardStyle}>
      <p style={cardStyles.label}>{label}</p>
      <p style={cardStyles.value}>{value}</p>
      {description ? <p style={cardStyles.description}>{description}</p> : null}
    </div>
  );
};

export default StatusCard;
