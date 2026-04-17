import React, { useEffect, useState } from "react";
import { pageHeaderStyles } from "../layout/PageHeader";
import { shellStyles } from "../layout/BarangayLayout";

const overlayStyles = {
  position: "fixed",
  inset: 0,
  backgroundColor: "rgba(21, 40, 63, 0.48)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "24px",
  zIndex: 1000,
};

const modalStyles = {
  width: "min(860px, 100%)",
  maxHeight: "90vh",
  overflowY: "auto",
  backgroundColor: "#ffffff",
  borderRadius: "22px",
  border: "1px solid #d7e2ef",
  boxShadow: "0 24px 60px rgba(23, 50, 77, 0.18)",
  padding: "24px",
  boxSizing: "border-box",
};

const inputStyles = {
  width: "100%",
  minHeight: "48px",
  padding: "12px 14px",
  borderRadius: "14px",
  border: "1px solid #d2deea",
  boxSizing: "border-box",
  fontSize: "14px",
  color: "#21405f",
  backgroundColor: "#ffffff",
};

const labelStyles = {
  display: "block",
  marginBottom: "8px",
  color: "#4f677f",
  fontSize: "13px",
  fontWeight: 700,
};

const createDefaultForm = () => ({
  event_name: "",
  disaster_type: "",
  start_date: "",
  end_date: "",
  barangay_ids: [],
});

const DisasterEventFormModal = ({
  isOpen,
  barangays,
  isSubmitting,
  errorMessage,
  onClose,
  onSubmit,
}) => {
  const [formValues, setFormValues] = useState(createDefaultForm());
  const [validationMessage, setValidationMessage] = useState("");

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setFormValues(createDefaultForm());
    setValidationMessage("");
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const allBarangayIds = barangays.map((barangay) => barangay.id);
  const areAllBarangaysSelected =
    allBarangayIds.length > 0 &&
    allBarangayIds.every((barangayId) =>
      formValues.barangay_ids.includes(barangayId),
    );

  const handleChange = (fieldName, value) => {
    setFormValues((currentValues) => ({
      ...currentValues,
      [fieldName]: value,
    }));
  };

  const handleBarangayToggle = (barangayId, isChecked) => {
    setFormValues((currentValues) => ({
      ...currentValues,
      barangay_ids: isChecked
        ? [...currentValues.barangay_ids, barangayId]
        : currentValues.barangay_ids.filter((id) => id !== barangayId),
    }));
  };

  const handleToggleAllBarangays = () => {
    setFormValues((currentValues) => ({
      ...currentValues,
      barangay_ids: areAllBarangaysSelected ? [] : allBarangayIds,
    }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    if (!formValues.event_name.trim()) {
      setValidationMessage("event_name is required.");
      return;
    }

    if (!formValues.disaster_type.trim()) {
      setValidationMessage("disaster_type is required.");
      return;
    }

    if (!formValues.start_date) {
      setValidationMessage("start_date is required.");
      return;
    }

    if (
      formValues.end_date &&
      new Date(formValues.end_date) < new Date(formValues.start_date)
    ) {
      setValidationMessage("end_date must not be earlier than start_date.");
      return;
    }

    setValidationMessage("");

    onSubmit({
      title: formValues.event_name.trim(),
      disaster_type: formValues.disaster_type.trim(),
      description: null,
      start_date: formValues.start_date,
      end_date: formValues.end_date || null,
      status: "ACTIVE",
      created_by: null,
      barangay_ids: formValues.barangay_ids,
    });
  };

  return (
    <div style={overlayStyles}>
      <div style={modalStyles}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: "16px",
            marginBottom: "20px",
          }}
        >
          <div>
            <h3 style={{ margin: 0, color: "#17324d", fontSize: "26px" }}>
              Create Disaster Event
            </h3>
            <p
              style={{
                margin: "8px 0 0",
                color: "#60738a",
                fontSize: "14px",
                lineHeight: 1.6,
              }}
            >
              Create a new disaster event and optionally assign affected barangays
              for later masterlist filtering and monitoring.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={pageHeaderStyles.secondaryButton}
          >
            Close
          </button>
        </div>

        <form onSubmit={handleSubmit}>

          {/* ================= SECTION 1: EVENT DETAILS ================= */}
          <section style={shellStyles.card}>
            <h3 style={{ marginBottom: "16px", color: "#17324d" }}>
              Event Details
            </h3>

            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "18px",
            }}>
              {/* EVENT NAME */}
              <div>
                <label style={labelStyles}>Event Name</label>
                <input
                  type="text"
                  value={formValues.event_name}
                  onChange={(e) => handleChange("event_name", e.target.value)}
                  style={inputStyles}
                />
              </div>

              {/* DISASTER TYPE */}
              <div>
                <label style={labelStyles}>Disaster Type</label>
                <select
                  value={formValues.disaster_type}
                  onChange={(e) => handleChange("disaster_type", e.target.value)}
                  style={inputStyles}
                >
                  <option value="">Select Disaster Type</option>
                  <option value="Typhoon">Typhoon</option>
                  <option value="Flood">Flood</option>
                  <option value="Earthquake">Earthquake</option>
                  <option value="Landslide">Landslide</option>
                  <option value="Volcanic Eruption">Volcanic Eruption</option>
                  <option value="Storm Surge">Storm Surge</option>
                  <option value="Drought / El Niño">Drought / El Niño</option>
                  <option value="Tsunami">Tsunami</option>
                  <option value="Fire">Fire</option>
                  <option value="Other">Other</option>
                </select>

                {formValues.disaster_type === "Other" && (
                  <input
                    type="text"
                    placeholder="Specify disaster type"
                    value={formValues.custom_disaster_type || ""}
                    onChange={(e) =>
                      handleChange("custom_disaster_type", e.target.value)
                    }
                    style={{ ...inputStyles, marginTop: "10px" }}
                  />
                )}
              </div>
            </div>
          </section>

          {/* ================= SECTION 2: RELIEF PERIOD ================= */}
          <section style={{ ...shellStyles.card, marginTop: "16px" }}>
            <h3 style={{ marginBottom: "16px", color: "#17324d" }}>
              Relief Period
            </h3>

            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "18px",
            }}>
              <div>
                <label style={labelStyles}>Start Date</label>
                <input
                  type="date"
                  value={formValues.start_date}
                  onChange={(e) => handleChange("start_date", e.target.value)}
                  style={inputStyles}
                />
              </div>

              <div>
                <label style={labelStyles}>End Date</label>
                <input
                  type="date"
                  value={formValues.end_date}
                  onChange={(e) => handleChange("end_date", e.target.value)}
                  style={inputStyles}
                />
              </div>
            </div>
          </section>

          {/* ================= SECTION 3: AFFECTED BARANGAYS ================= */}
          <section style={{ ...shellStyles.card, marginTop: "16px" }}>
            <h3 style={{ marginBottom: "16px", color: "#17324d" }}>
              Affected Barangays
            </h3>

            <div style={{ marginBottom: "16px" }}>
              <button
                type="button"
                onClick={handleToggleAllBarangays}
                style={
                  areAllBarangaysSelected
                    ? pageHeaderStyles.primaryButton
                    : pageHeaderStyles.secondaryButton
                }
              >
                {areAllBarangaysSelected
                  ? "Unselect All Barangays"
                  : "Select All Barangays"}
              </button>
            </div>

            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "12px",
            }}>
              {barangays.map((barangay) => (
                <label
                  key={barangay.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    padding: "12px 14px",
                    borderRadius: "14px",
                    border: "1px solid #d7e2ef",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={formValues.barangay_ids.includes(barangay.id)}
                    onChange={(e) =>
                      handleBarangayToggle(barangay.id, e.target.checked)
                    }
                  />
                  {barangay.name}
                </label>
              ))}
            </div>
          </section>

          {validationMessage ? (
            <div
              style={{
                marginTop: "18px",
                padding: "14px 16px",
                borderRadius: "14px",
                backgroundColor: "#fff3f1",
                border: "1px solid #f1d2cc",
                color: "#9d4d58",
                fontSize: "14px",
                fontWeight: 600,
              }}
            >
              {validationMessage}
            </div>
          ) : null}

          {errorMessage ? (
            <div
              style={{
                marginTop: "18px",
                padding: "14px 16px",
                borderRadius: "14px",
                backgroundColor: "#fff3f1",
                border: "1px solid #f1d2cc",
                color: "#9d4d58",
                fontSize: "14px",
                fontWeight: 600,
              }}
            >
              {errorMessage}
            </div>
          ) : null}

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "12px",
              flexWrap: "wrap",
              marginTop: "24px",
            }}
          >
            <button
              type="button"
              onClick={onClose}
              style={pageHeaderStyles.secondaryButton}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                ...pageHeaderStyles.primaryButton,
                opacity: isSubmitting ? 0.7 : 1,
              }}
            >
              {isSubmitting ? "Creating..." : "Create Event"}
            </button>
          </div>
        </form>
      </div >
    </div >
  );
};

export default DisasterEventFormModal;
