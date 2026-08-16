import React from "react";
import { shellStyles } from "../layout/BarangayLayout";
import StatusPill from "../shared/StatusPill";

const MswdoMasterlistEventSummary = ({
  activeEventLabel,
  selectedDisasterEvent,
  isLoadingFilters,
  reliefPeriodText,
}) => {
  return (
    <section className="mswdo-masterlist-event-summary-card" style={shellStyles.card}>
      <div
        className="mswdo-masterlist-event-summary"
        style={{
          border: "1px solid #d6e2ef",
          borderRadius: "16px",
          padding: "18px 20px",
          backgroundColor: "#f8fbfe",
        }}
      >
        <p
          className="mswdo-masterlist-event-title"
          style={{
            margin: 0,
            color: "#17324d",
            fontSize: "18px",
            fontWeight: 800,
          }}
        >
          {activeEventLabel}
        </p>

        <div
          className="mswdo-masterlist-event-meta"
          style={{
            display: "flex",
            gap: "24px",
            marginTop: "14px",
            flexWrap: "wrap",
            color: "#334155",
          }}
        >
          <span>Period: {reliefPeriodText}</span>
          <StatusPill status={selectedDisasterEvent?.status} />
        </div>
      </div>

      {isLoadingFilters ? (
        <p style={{ ...shellStyles.mutedText, marginTop: "16px" }}>
          Loading MSWDO masterlist filters...
        </p>
      ) : !selectedDisasterEvent ? (
        <p style={{ ...shellStyles.mutedText, marginTop: "16px" }}>
          Select a disaster event to load the consolidated masterlist.
        </p>
      ) : null}
    </section>
  );
};

export default MswdoMasterlistEventSummary;
