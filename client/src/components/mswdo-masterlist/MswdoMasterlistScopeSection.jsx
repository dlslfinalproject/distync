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

const scopeCardStyles = {
  ...shellStyles.card,
  padding: 0,
  boxSizing: "border-box",
};

const scopeTabListStyles = {
  alignItems: "stretch",
  borderBottom: "1px solid #d6e2ef",
  backgroundColor: "#fbfdff",
  borderTopLeftRadius: "17px",
  borderTopRightRadius: "17px",
  display: "flex",
  flexWrap: "nowrap",
  gap: "4px",
  overflowX: "auto",
  padding: "8px clamp(14px, 2vw, 24px) 0",
  minHeight: "56px",
  WebkitOverflowScrolling: "touch",
};

const scopeFilterContentStyles = {
  boxSizing: "border-box",
  padding: "clamp(18px, 2vw, 24px)",
};

const tabButtonStyles = (isActive) => ({
  alignItems: "center",
  boxSizing: "border-box",
  border: "none",
  borderBottom: isActive ? "3px solid #17324d" : "3px solid transparent",
  background: "none",
  color: isActive ? "#17324d" : "#6b8298",
  cursor: "pointer",
  display: "inline-flex",
  fontSize: "14px",
  fontFamily: "inherit",
  fontWeight: 700,
  justifyContent: "center",
  letterSpacing: "0.01em",
  lineHeight: 1.3,
  minHeight: "48px",
  padding: "11px 16px",
  transition: "color 160ms ease, border-color 160ms ease",
  whiteSpace: "nowrap",
});

const formatDisasterEventTitle = (event) =>
  String(event?.title || "").trim() || "Untitled disaster event";

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
    <section className="mswdo-masterlist-scope-card" style={scopeCardStyles}>
      <div
        className="mswdo-masterlist-tabs"
        role="tablist"
        aria-label="MSWDO dashboard event scope"
        style={scopeTabListStyles}
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "active"}
          onClick={() => onEventScopeChange("active")}
          style={tabButtonStyles(activeTab === "active")}
        >
          Active Events
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "ended"}
          onClick={() => onEventScopeChange("ended")}
          style={tabButtonStyles(activeTab === "ended")}
        >
          Ended Events
        </button>
      </div>

      <div style={scopeFilterContentStyles}>
        <div
          className="mswdo-masterlist-filter-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "16px",
            alignItems: "end",
          }}
        >
          <div className="mswdo-masterlist-filter-field">
            <label htmlFor="mswdo-masterlist-event" style={filterStyles.label}>
              Disaster Event
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
                  {formatDisasterEventTitle(event)}
                </option>
              ))}
            </select>
          </div>

          <div className="mswdo-masterlist-filter-field">
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
      </div>
    </section>
  );
};

export default MswdoMasterlistScopeSection;
