import React from "react";
import { shellStyles } from "../layout/BarangayLayout";

const labelStyles = {
  margin: 0,
  color: "#6b8197",
  fontSize: "12px",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  fontWeight: 700,
};

const valueStyles = {
  margin: "8px 0 0",
  color: "#17324d",
  fontSize: "18px",
  fontWeight: 700,
};

const StubSummaryCard = ({ stubContext }) => {
  if (!stubContext) {
    return (
      <section style={shellStyles.card}>
        <h3 style={{ marginTop: 0, color: "#17324d" }}>Selected Stub</h3>
        <p style={{ ...shellStyles.mutedText, marginTop: "10px" }}>
          Open this page from Stub Verification after selecting a valid and
          claimable stub.
        </p>
      </section>
    );
  }

  return (
    <section style={shellStyles.card}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "18px",
        }}
      >
        <div>
          <p style={labelStyles}>Family Head</p>
          <p style={valueStyles}>{stubContext.family_head_name}</p>
          <p style={{ ...shellStyles.mutedText, marginTop: "8px" }}>
            Barangay: {stubContext.barangay_name || "--"}
          </p>
        </div>

        <div>
          <p style={labelStyles}>Stub Number</p>
          <p style={valueStyles}>{stubContext.stub_no}</p>
          <p style={{ ...shellStyles.mutedText, marginTop: "8px" }}>
            Serial: {stubContext.serial_no || "--"}
          </p>
        </div>

        <div>
          <p style={labelStyles}>Stub Status</p>
          <p style={valueStyles}>{stubContext.status}</p>
          <p style={{ ...shellStyles.mutedText, marginTop: "8px" }}>
            Members: {stubContext.household_size || "--"}
          </p>
        </div>
      </div>
    </section>
  );
};

export default StubSummaryCard;
