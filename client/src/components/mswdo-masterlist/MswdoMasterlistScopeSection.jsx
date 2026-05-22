import React from "react";
import { shellStyles } from "../layout/BarangayLayout";

const filterStyles = {
  field: {
    width: "100%",
    padding: "12px 14px",
    borderRadius: "12px",
    border: "1px solid #cfddeb",
    backgroundColor: "#f8fbfe",
    color: "#1f3b57",
    fontSize: "14px",
    boxSizing: "border-box",
  },
  label: {
    display: "block",
    marginBottom: "8px",
    color: "#5f7892",
    fontSize: "12px",
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
};

const tabButtonStyles = (isActive) => ({
  padding: "12px 24px",
  border: "none",
  background: "none",
  fontSize: "14px",
  fontWeight: 700,
  textTransform: "uppercase",
  color: isActive ? "#17324d" : "#6b8298",
  borderBottom: isActive ? "3px solid #17324d" : "3px solid transparent",
  cursor: "pointer",
});

const MswdoMasterlistScopeSection = ({
  activeTab,
  isLoadingFilters,
  scopedDisasterEvents,
  selectedDisasterEventId,
  selectedBarangayId,
  barangays,
  onEventScopeChange,
  onDisasterEventChange,
  onBarangayChange,
}) => {
  return (
    <section style={shellStyles.card}>
      <div
        style={{
          display: "flex",
          borderBottom: "1px solid #d6e2ef",
          marginBottom: "24px",
          gap: "8px",
          flexWrap: "wrap",
        }}
      >
        <button
          type="button"
          onClick={() => onEventScopeChange("active")}
          style={tabButtonStyles(activeTab === "active")}
        >
          Active Events
        </button>
        <button
          type="button"
          onClick={() => onEventScopeChange("ended")}
          style={tabButtonStyles(activeTab === "ended")}
        >
          Ended Events
        </button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "16px",
          alignItems: "end",
        }}
      >
        <div>
          <label htmlFor="mswdo-masterlist-event" style={filterStyles.label}>
            {activeTab === "active" ? "Active" : "Ended"} Disaster Event
          </label>
          <select
            id="mswdo-masterlist-event"
            value={selectedDisasterEventId || ""}
            onChange={(event) => onDisasterEventChange(event.target.value)}
            disabled={isLoadingFilters || scopedDisasterEvents.length === 0}
            style={filterStyles.field}
          >
            <option value="">
              {selectedBarangayId && scopedDisasterEvents.length === 0
                ? `No ${activeTab === "active" ? "active" : "ended"} events for this barangay`
                : `Select ${activeTab === "active" ? "active" : "ended"} disaster event`}
            </option>
            {scopedDisasterEvents.map((event) => (
              <option key={event.id} value={event.id}>
                {event.event_code} - {event.title}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="mswdo-masterlist-barangay" style={filterStyles.label}>
            Barangay
          </label>
          <select
            id="mswdo-masterlist-barangay"
            value={selectedBarangayId || ""}
            onChange={(event) => onBarangayChange(event.target.value)}
            disabled={isLoadingFilters}
            style={filterStyles.field}
          >
            <option value="">All Barangays</option>
            {barangays.map((barangay) => (
              <option key={barangay.id} value={barangay.id}>
                {barangay.name}
              </option>
            ))}
          </select>
        </div>
      </div>
    </section>
  );
};

export default MswdoMasterlistScopeSection;
