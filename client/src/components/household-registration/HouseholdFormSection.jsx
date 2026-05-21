import React from "react";
import { shellStyles } from "../layout/BarangayLayout";
import { STAY_TYPE_OPTIONS } from "../../utils/stayType";

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
  readOnlyBox: {
    minHeight: "44px",
    border: "1px solid #d0ddeb",
    borderRadius: "14px",
    padding: "10px 12px",
    fontSize: "14px",
    color: "#1f405f",
    backgroundColor: "#f8fbfe",
    boxSizing: "border-box",
    display: "flex",
    alignItems: "center",
    fontWeight: 700,
  },
};

const HouseholdFormSection = ({ form }) => {
  const selectedEvent = form.activeDisasterEvents.find(
    (eventItem) => eventItem.id === form.selectedDisasterEventId,
  );
  const isNonResident = form.residencyStatus === "NON_RESIDENT";
  const selectedBarangay = form.barangays.find(
    (barangay) => barangay.id === form.selectedBarangayId,
  );
  const barangayLabel =
    form.assignedBarangayName || selectedBarangay?.name || "Assigned barangay";
  const stayTypeOptions =
    isNonResident && form.restrictNonResidentToEvacCenter
      ? STAY_TYPE_OPTIONS.filter((option) => option.value === "EVAC_CENTER")
      : STAY_TYPE_OPTIONS;

  return (
    <section style={shellStyles.card}>
      <div style={{ marginBottom: "18px" }}>
        <h3 style={{ margin: 0, color: "#17324d" }}>Household Information</h3>
      </div>

      <div
        style={{
          marginBottom: "16px",
          padding: "14px 16px",
          borderRadius: "14px",
          border: "1px solid #d7e2ef",
          backgroundColor: "#f8fbfe",
        }}
      >
        <p style={{ margin: 0, color: "#60738a", fontSize: "12px", fontWeight: 700 }}>
          ACTIVE DISASTER EVENT
        </p>
        <p style={{ margin: "8px 0 0", color: "#17324d", fontSize: "14px", fontWeight: 700 }}>
          {selectedEvent
            ? `${selectedEvent.event_code} - ${selectedEvent.title}`
            : form.isOffline
              ? "Offline mode: please select an active disaster event while online first."
              : "Select an active disaster event from the masterlist page first."}
        </p>
        {form.isUsingCachedReferenceData && selectedEvent ? (
          <p style={{ margin: "8px 0 0", color: "#60738a", fontSize: "12px" }}>
            Offline mode is using the last cached registration reference data.
          </p>
        ) : null}
      </div>

      <div style={fieldStyles.grid}>
        <label style={fieldStyles.field}>
          <span style={fieldStyles.label}>Residency Status</span>
          <select
            value={form.residencyStatus}
            onChange={(event) => form.setResidencyStatus(event.target.value)}
            style={fieldStyles.input}
          >
            <option value="RESIDENT">Resident</option>
            <option value="NON_RESIDENT">Non-Resident (Outside Malvar)</option>
          </select>
        </label>

        {form.hideBarangaySelection ? (
          <div style={fieldStyles.field}>
            <span style={fieldStyles.label}>Assigned Barangay</span>
            <div style={fieldStyles.readOnlyBox}>{barangayLabel}</div>
            <span style={{ color: "#60738a", fontSize: "12px" }}>
              This registration will be assigned automatically to your
              barangay account.
            </span>
          </div>
        ) : (
          <label style={fieldStyles.field}>
            <span style={fieldStyles.label}>Barangay</span>
            <select
              value={form.selectedBarangayId}
              onChange={(event) => form.setSelectedBarangayId(event.target.value)}
              disabled={form.isBarangayLocked}
              style={fieldStyles.input}
            >
              <option value="">
                {isNonResident
                  ? "Select handling barangay"
                  : "Select barangay"}
              </option>
              {form.barangays.map((barangay) => (
                <option key={barangay.id} value={barangay.id}>
                  {barangay.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <label style={fieldStyles.field}>
          <span style={fieldStyles.label}>Current Stay Type</span>
          <select
            value={form.household.current_stay_type}
            onChange={(event) =>
              form.updateHouseholdField("current_stay_type", event.target.value)
            }
            disabled={isNonResident && form.restrictNonResidentToEvacCenter}
            style={fieldStyles.input}
          >
            {stayTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label style={fieldStyles.field}>
          <span style={fieldStyles.label}>
            Evacuation Center
            {isNonResident && form.restrictNonResidentToEvacCenter
              ? ""
              : " (Optional)"}
          </span>
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

        <label style={fieldStyles.field}>
          <span style={fieldStyles.label}>Contact Number</span>
          <input
            type="text"
            value={form.household.contact_number}
            onChange={(event) =>
              form.updateHouseholdField("contact_number", event.target.value)
            }
            style={fieldStyles.input}
          />
        </label>

        <label
          style={{
            ...fieldStyles.field,
            gridColumn: "1 / -1",
          }}
        >
          <span style={fieldStyles.label}>Current Address Details</span>
          <textarea
            value={form.household.current_address_details}
            onChange={(event) =>
              form.updateHouseholdField("current_address_details", event.target.value)
            }
            style={{
              ...fieldStyles.input,
              minHeight: "92px",
              resize: "vertical",
            }}
          />
        </label>
      </div>
    </section>
  );
};

export default HouseholdFormSection;
