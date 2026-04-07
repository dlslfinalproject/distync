import React from "react";
import { pageHeaderStyles } from "../layout/PageHeader";
import { shellStyles } from "../layout/BarangayLayout";

const inputStyles = {
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

const MswdoMasterlistToolbar = ({
  disasterEvents,
  barangays,
  selectedDisasterEventId,
  selectedBarangayId,
  searchTerm,
  isLoadingFilters,
  onDisasterEventChange,
  onBarangayChange,
  onSearchChange,
}) => {
  return (
    <section style={shellStyles.card}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "16px",
          alignItems: "end",
        }}
      >
        <div>
          <label htmlFor="mswdo-disaster-event" style={inputStyles.label}>
            Disaster Event
          </label>
          <select
            id="mswdo-disaster-event"
            value={selectedDisasterEventId}
            onChange={(event) => onDisasterEventChange(event.target.value)}
            disabled={isLoadingFilters}
            style={inputStyles.field}
          >
            <option value="">Select disaster event</option>
            {disasterEvents.map((event) => (
              <option key={event.id} value={event.id}>
                {event.event_code} - {event.title}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="mswdo-barangay-filter" style={inputStyles.label}>
            Barangay
          </label>
          <select
            id="mswdo-barangay-filter"
            value={selectedBarangayId}
            onChange={(event) => onBarangayChange(event.target.value)}
            disabled={isLoadingFilters}
            style={inputStyles.field}
          >
            <option value="">All barangays</option>
            {barangays.map((barangay) => (
              <option key={barangay.id} value={barangay.id}>
                {barangay.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="mswdo-masterlist-search" style={inputStyles.label}>
            Search
          </label>
          <input
            id="mswdo-masterlist-search"
            type="text"
            value={searchTerm}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search family head, barangay, stay type, stub..."
            style={inputStyles.field}
          />
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <button type="button" style={pageHeaderStyles.secondaryButton}>
            Export Soon
          </button>
        </div>
      </div>
    </section>
  );
};

export default MswdoMasterlistToolbar;
