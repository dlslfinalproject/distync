import React from "react";
import { shellStyles } from "../layout/BarangayLayout";

const fieldStyles = {
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "16px",
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  label: {
    color: "#55718b",
    fontSize: "13px",
    fontWeight: 700,
  },
  input: {
    minHeight: "44px",
    border: "1px solid #d0ddeb",
    borderRadius: "14px",
    padding: "10px 12px",
    fontSize: "14px",
    color: "#1f405f",
    backgroundColor: "#ffffff",
    boxSizing: "border-box",
  },
};

const HouseholdFormSection = ({ form }) => {
  return (
    <section style={shellStyles.card}>
      <div style={{ marginBottom: "18px" }}>
        <h3 style={{ margin: 0, color: "#17324d" }}>Household Info</h3>
        <p style={{ ...shellStyles.mutedText, marginTop: "8px" }}>
          Set the active event, stay type, address details, and optional
          evacuation center.
        </p>
      </div>

      <div style={fieldStyles.grid}>
        <label style={fieldStyles.field}>
          <span style={fieldStyles.label}>Active Disaster Event</span>
          <select
            value={form.selectedDisasterEventId}
            onChange={(event) => form.setSelectedDisasterEventId(event.target.value)}
            style={fieldStyles.input}
          >
            <option value="">Select active disaster event</option>
            {form.activeDisasterEvents.map((eventItem) => (
              <option key={eventItem.id} value={eventItem.id}>
                {eventItem.event_code} - {eventItem.title}
              </option>
            ))}
          </select>
        </label>

        <label style={fieldStyles.field}>
          <span style={fieldStyles.label}>Barangay</span>
          <select
            value={form.selectedBarangayId}
            onChange={(event) => form.setSelectedBarangayId(event.target.value)}
            style={fieldStyles.input}
          >
            <option value="">Select barangay</option>
            {form.barangays.map((barangay) => (
              <option key={barangay.id} value={barangay.id}>
                {barangay.name}
              </option>
            ))}
          </select>
        </label>

        <label style={fieldStyles.field}>
          <span style={fieldStyles.label}>Current Stay Type</span>
          <select
            value={form.household.current_stay_type}
            onChange={(event) =>
              form.updateHouseholdField("current_stay_type", event.target.value)
            }
            style={fieldStyles.input}
          >
            <option value="EVAC_CENTER">EVAC_CENTER</option>
            <option value="RELATIVES">RELATIVES</option>
            <option value="OTHER_SAFE_PLACE">OTHER_SAFE_PLACE</option>
          </select>
        </label>

        <label style={fieldStyles.field}>
          <span style={fieldStyles.label}>Contact Number</span>
          <input
            type="text"
            value={form.familyHead.contact_number}
            onChange={(event) =>
              form.updateFamilyHeadField("contact_number", event.target.value)
            }
            style={fieldStyles.input}
          />
        </label>

        <label style={fieldStyles.field}>
          <span style={fieldStyles.label}>Evacuation Center (Optional)</span>
          <select
            value={form.household.evacuation_center_id}
            onChange={(event) =>
              form.updateHouseholdField("evacuation_center_id", event.target.value)
            }
            disabled={form.household.current_stay_type !== "EVAC_CENTER"}
            style={fieldStyles.input}
          >
            <option value="">No evacuation center selected</option>
            {form.evacuationCenters.map((center) => (
              <option key={center.id} value={center.id}>
                {center.name || center.center_name || center.code || center.id}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label style={{ ...fieldStyles.field, marginTop: "16px" }}>
        <span style={fieldStyles.label}>Current Address Details</span>
        <textarea
          value={form.household.current_address_details}
          onChange={(event) =>
            form.updateHouseholdField("current_address_details", event.target.value)
          }
          rows={3}
          style={{ ...fieldStyles.input, minHeight: "96px", resize: "vertical" }}
        />
      </label>
    </section>
  );
};

export default HouseholdFormSection;
