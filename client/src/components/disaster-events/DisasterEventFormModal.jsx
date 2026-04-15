import React, { useEffect, useState } from "react";
import { pageHeaderStyles } from "../layout/PageHeader";

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

const allowedStatuses = ["PLANNED", "ACTIVE", "CLOSED", "ARCHIVED"];

const createDefaultForm = () => ({
  event_code: "",
  title: "",
  disaster_type: "",
  description: "",
  start_date: "",
  end_date: "",
  status: "ACTIVE",
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

  const handleSubmit = (event) => {
    event.preventDefault();

    if (!formValues.event_code.trim()) {
      setValidationMessage("event_code is required.");
      return;
    }

    if (!formValues.title.trim()) {
      setValidationMessage("title is required.");
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
      event_code: formValues.event_code.trim(),
      title: formValues.title.trim(),
      disaster_type: formValues.disaster_type.trim(),
      description: formValues.description.trim() || null,
      start_date: formValues.start_date,
      end_date: formValues.end_date || null,
      status: formValues.status,
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
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "18px",
            }}
          >
            <div>
              <label htmlFor="event_code" style={labelStyles}>
                Event Code
              </label>
              <input
                id="event_code"
                type="text"
                value={formValues.event_code}
                onChange={(event) =>
                  handleChange("event_code", event.target.value)
                }
                style={inputStyles}
              />
            </div>

            <div>
              <label htmlFor="title" style={labelStyles}>
                Title
              </label>
              <input
                id="title"
                type="text"
                value={formValues.title}
                onChange={(event) => handleChange("title", event.target.value)}
                style={inputStyles}
              />
            </div>

            <div>
              <label htmlFor="disaster_type" style={labelStyles}>
                Disaster Type
              </label>
              <input
                id="disaster_type"
                type="text"
                value={formValues.disaster_type}
                onChange={(event) =>
                  handleChange("disaster_type", event.target.value)
                }
                style={inputStyles}
              />
            </div>

            <div>
              <label htmlFor="status" style={labelStyles}>
                Status
              </label>
              <select
                id="status"
                value={formValues.status}
                onChange={(event) => handleChange("status", event.target.value)}
                style={inputStyles}
              >
                {allowedStatuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="start_date" style={labelStyles}>
                Start Date
              </label>
              <input
                id="start_date"
                type="date"
                value={formValues.start_date}
                onChange={(event) =>
                  handleChange("start_date", event.target.value)
                }
                style={inputStyles}
              />
            </div>

            <div>
              <label htmlFor="end_date" style={labelStyles}>
                End Date
              </label>
              <input
                id="end_date"
                type="date"
                value={formValues.end_date}
                onChange={(event) => handleChange("end_date", event.target.value)}
                style={inputStyles}
              />
            </div>

            <div style={{ gridColumn: "1 / -1" }}>
              <label htmlFor="description" style={labelStyles}>
                Description
              </label>
              <textarea
                id="description"
                value={formValues.description}
                onChange={(event) =>
                  handleChange("description", event.target.value)
                }
                style={{ ...inputStyles, minHeight: "110px", resize: "vertical" }}
              />
            </div>
          </div>

          <div style={{ marginTop: "20px" }}>
            <p style={{ ...labelStyles, marginBottom: "12px" }}>
              Affected Barangays
            </p>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: "12px",
              }}
            >
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
                    color: "#21405f",
                    fontSize: "14px",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={formValues.barangay_ids.includes(barangay.id)}
                    onChange={(event) =>
                      handleBarangayToggle(barangay.id, event.target.checked)
                    }
                  />
                  {barangay.name}
                </label>
              ))}
            </div>
          </div>

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
      </div>
    </div>
  );
};

export default DisasterEventFormModal;
