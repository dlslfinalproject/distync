import React, { useEffect, useState } from "react";
import { pageHeaderStyles } from "../layout/PageHeader";
import { shellStyles } from "../layout/BarangayLayout";
import { FiX, FiCheckSquare, FiSquare } from "react-icons/fi";
import { formatDisasterEventDateInputValue } from "../../features/disaster-events/disasterEventFormatters";
import { DISASTER_TYPE_OPTIONS as SHARED_DISASTER_TYPE_OPTIONS } from "../../features/disaster-events/disasterTypeOptions";

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
  backgroundColor: "#eef5fb",
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

const errorTextStyles = {
  margin: "6px 0 0",
  color: "#c53030",
  fontSize: "12px",
  lineHeight: 1.4,
};

const lockedInputStyles = {
  ...inputStyles,
  backgroundColor: "#eef5fc",
  color: "#4f6780",
};

const createDefaultForm = () => ({
  event_name: "",
  disaster_type: "",
  custom_disaster_type: "",
  start_date: "",
  end_date: "",
  barangay_ids: [],
});

const createDefaultErrors = () => ({
  event_name: "",
  disaster_type: "",
  custom_disaster_type: "",
  start_date: "",
  end_date: "",
  barangay_ids: "",
});


const mapServerErrorToFieldError = (message) => {
  const normalizedMessage = String(message || "").trim();

  if (!normalizedMessage) {
    return { fieldName: "", message: "" };
  }

  if (/current end_date/i.test(normalizedMessage)) {
    return {
      fieldName: "end_date",
      message: "End date cannot be earlier than the current end date.",
    };
  }

  if (/latest recorded household activity/i.test(normalizedMessage)) {
    return {
      fieldName: "end_date",
      message: "End date cannot be earlier than the latest recorded household activity.",
    };
  }

  if (/registered records cannot be removed/i.test(normalizedMessage)) {
    return {
      fieldName: "barangay_ids",
      message:
        "Barangays with registered records cannot be unselected.",
    };
  }

  if (/end_date must not be earlier than start_date/i.test(normalizedMessage)) {
    return {
      fieldName: "end_date",
      message: "End date must not be earlier than start date.",
    };
  }

  if (/end date/i.test(normalizedMessage) || /end_date/i.test(normalizedMessage)) {
    return {
      fieldName: "end_date",
      message: normalizedMessage,
    };
  }

  return { fieldName: "", message: normalizedMessage };
};

const DisasterEventFormModal = ({
  isOpen,
  barangays,
  isSubmitting,
  errorMessage,
  initialValues = null,
  mode = "create",
  onClose,
  onSubmit,
}) => {
  const [formValues, setFormValues] = useState(createDefaultForm());
  const [fieldErrors, setFieldErrors] = useState(createDefaultErrors());
  const isEditMode = mode === "edit";
  const latestHouseholdActivityDate = formatDisasterEventDateInputValue(
    initialValues?.latest_household_activity_at || "",
  );
  const { fieldName: serverErrorFieldName, message: serverErrorMessage } =
    mapServerErrorToFieldError(errorMessage);

  useEffect(() => {
    if (!isOpen) return;
    setFormValues(
      initialValues
        ? (() => {
            const initialDisasterType = initialValues.disaster_type || "";
            const usesCustomDisasterType =
              initialDisasterType &&
              !SHARED_DISASTER_TYPE_OPTIONS.includes(initialDisasterType);

            return {
              event_name: initialValues.title || "",
              disaster_type: usesCustomDisasterType
                ? "Other"
                : initialDisasterType,
              custom_disaster_type: usesCustomDisasterType
                ? initialDisasterType
                : "",
              start_date: formatDisasterEventDateInputValue(
                initialValues.start_date || "",
              ),
              end_date: formatDisasterEventDateInputValue(
                initialValues.end_date || "",
              ),
              barangay_ids: (initialValues.affected_barangays || []).map(
                (barangay) => barangay.id,
              ),
            };
          })()
        : createDefaultForm(),
    );
    setFieldErrors(createDefaultErrors());
  }, [initialValues, isOpen]);

  useEffect(() => {
    if (!isOpen || !serverErrorFieldName || !serverErrorMessage) {
      return;
    }

    setFieldErrors((currentErrors) => ({
      ...currentErrors,
      [serverErrorFieldName]: serverErrorMessage,
    }));
  }, [isOpen, serverErrorFieldName, serverErrorMessage]);

  if (!isOpen) return null;

  const allBarangayIds = barangays.map((barangay) => barangay.id);
  const lockedBarangayIds = new Set(
    isEditMode
      ? (initialValues?.affected_barangays || [])
          .filter((barangay) => barangay.has_registered_records)
          .map((barangay) => barangay.id)
      : [],
  );
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

    setFieldErrors((currentErrors) => ({
      ...currentErrors,
      [fieldName]: "",
      ...(fieldName === "disaster_type" ? { custom_disaster_type: "" } : {}),
      ...(fieldName === "start_date" ? { end_date: "" } : {}),
    }));
  };

  const handleBarangayToggle = (barangayId, isChecked) => {
    if (isEditMode && !isChecked && lockedBarangayIds.has(barangayId)) {
      setFieldErrors((currentErrors) => ({
        ...currentErrors,
        barangay_ids: "Barangays with registered records cannot be unselected.",
      }));
      return;
    }

    setFormValues((currentValues) => ({
      ...currentValues,
      barangay_ids: isChecked
        ? [...currentValues.barangay_ids, barangayId]
        : currentValues.barangay_ids.filter((id) => id !== barangayId),
    }));

    setFieldErrors((currentErrors) => ({
      ...currentErrors,
      barangay_ids: "",
    }));
  };

  const handleToggleAllBarangays = () => {
    const nextBarangayIds = areAllBarangaysSelected
      ? allBarangayIds.filter((barangayId) => lockedBarangayIds.has(barangayId))
      : allBarangayIds;

    setFormValues((currentValues) => ({
      ...currentValues,
      barangay_ids: nextBarangayIds,
    }));

    setFieldErrors((currentErrors) => ({
      ...currentErrors,
      barangay_ids:
        areAllBarangaysSelected && lockedBarangayIds.size > 0
          ? "Barangays with registered records cannot be unselected."
          : "",
    }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    const nextErrors = createDefaultErrors();

    if (!formValues.event_name.trim()) {
      nextErrors.event_name = "Event name is required.";
    }

    if (!formValues.disaster_type.trim()) {
      nextErrors.disaster_type = "Disaster type is required.";
    }

    if (
      formValues.disaster_type === "Other" &&
      !formValues.custom_disaster_type?.trim()
    ) {
      nextErrors.custom_disaster_type = "Please specify the disaster type.";
    }

    if (!formValues.start_date) {
      nextErrors.start_date = "Start date is required.";
    }

    if (!formValues.end_date) {
      nextErrors.end_date = "End date is required.";
    }

    if (!formValues.barangay_ids.length) {
      nextErrors.barangay_ids = "Please select at least one affected barangay.";
    }

    if (
      formValues.end_date &&
      new Date(formValues.end_date) < new Date(formValues.start_date)
    ) {
      nextErrors.end_date = "End date must not be earlier than start date.";
    }

    if (
      isEditMode &&
      latestHouseholdActivityDate &&
      formValues.end_date &&
      formValues.end_date < latestHouseholdActivityDate
    ) {
      nextErrors.end_date =
        "End date cannot be earlier than the latest recorded household activity.";
    }

    if (Object.values(nextErrors).some(Boolean)) {
      setFieldErrors(nextErrors);
      return;
    }

    setFieldErrors(createDefaultErrors());

    const finalDisasterType =
      formValues.disaster_type === "Other"
        ? formValues.custom_disaster_type.trim()
        : formValues.disaster_type.trim();

    onSubmit({
      title: formValues.event_name.trim(),
      event_name: formValues.event_name.trim(),
      disaster_type: finalDisasterType,
      start_date: formValues.start_date,
      end_date: formValues.end_date,
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
              {isEditMode ? "Edit Disaster Event" : "Create Disaster Event"}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={pageHeaderStyles.secondaryButton}
          >
            <FiX />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "18px",
          }}
        >
          {errorMessage && !serverErrorFieldName ? (
            <p style={errorTextStyles}>{serverErrorMessage || errorMessage}</p>
          ) : null}

          {/* SECTION 1 */}
          <section style={{ ...shellStyles.card, padding: "18px 20px" }}>
            <h3 style={{ margin: "0 0 12px", color: "#17324d" }}>
              Event Details
            </h3>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: "18px",
              }}
            >
              <div>
                <label style={labelStyles}>Event Name</label>
                <input
                  type="text"
                  value={formValues.event_name}
                  onChange={(e) => handleChange("event_name", e.target.value)}
                  style={isEditMode ? lockedInputStyles : inputStyles}
                  disabled={isEditMode}
                />
                {fieldErrors.event_name ? (
                  <p style={errorTextStyles}>{fieldErrors.event_name}</p>
                ) : null}
              </div>

              <div>
                <label style={labelStyles}>Disaster Type</label>
                {isEditMode ? (
                  <input
                    type="text"
                    value={
                      formValues.disaster_type === "Other"
                        ? formValues.custom_disaster_type || ""
                        : formValues.disaster_type
                    }
                    style={lockedInputStyles}
                    disabled
                  />
                ) : (
                  <select
                    value={formValues.disaster_type}
                    onChange={(e) =>
                      handleChange("disaster_type", e.target.value)
                    }
                    style={inputStyles}
                  >
                    <option value="">Select Disaster Type</option>
                    {SHARED_DISASTER_TYPE_OPTIONS.map((disasterType) => (
                      <option key={disasterType} value={disasterType}>
                        {disasterType}
                      </option>
                    ))}
                  </select>
                )}
                {fieldErrors.disaster_type ? (
                  <p style={errorTextStyles}>{fieldErrors.disaster_type}</p>
                ) : null}

                {!isEditMode && formValues.disaster_type === "Other" && (
                  <>
                    <input
                      type="text"
                      placeholder="Specify disaster type"
                      value={formValues.custom_disaster_type || ""}
                      onChange={(e) =>
                        handleChange("custom_disaster_type", e.target.value)
                      }
                      style={{ ...inputStyles, marginTop: "10px" }}
                    />
                    {fieldErrors.custom_disaster_type ? (
                      <p style={errorTextStyles}>
                        {fieldErrors.custom_disaster_type}
                      </p>
                    ) : null}
                  </>
                )}
              </div>
            </div>
          </section>

          {/* SECTION 2 */}
          <section style={{ ...shellStyles.card, padding: "18px 20px" }}>
            <h3 style={{ margin: "0 0 12px", color: "#17324d" }}>
              Relief Period
            </h3>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: "18px",
              }}
            >
              <div>
                <label style={labelStyles}>Start Date</label>
                <input
                  type="date"
                  value={formValues.start_date}
                  onChange={(e) => handleChange("start_date", e.target.value)}
                  style={isEditMode ? lockedInputStyles : inputStyles}
                  disabled={isEditMode}
                />
                {fieldErrors.start_date ? (
                  <p style={errorTextStyles}>{fieldErrors.start_date}</p>
                ) : null}
              </div>

              <div>
                <label style={labelStyles}>End Date</label>
                <input
                  type="date"
                  value={formValues.end_date}
                  onChange={(e) => handleChange("end_date", e.target.value)}
                  style={inputStyles}
                />
                {fieldErrors.end_date ? (
                  <p style={errorTextStyles}>{fieldErrors.end_date}</p>
                ) : null}
              </div>
            </div>
          </section>

          {/* SECTION 3 */}
          <section style={{ ...shellStyles.card, padding: "18px 20px" }}>
            <h3 style={{ margin: "0 0 12px", color: "#17324d" }}>
              Affected Barangays
            </h3>
            {fieldErrors.barangay_ids ? (
              <p style={{ ...errorTextStyles, marginBottom: "12px" }}>
                {fieldErrors.barangay_ids}
              </p>
            ) : null}

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                marginBottom: "12px",
              }}
            >
              <button
                type="button"
                onClick={handleToggleAllBarangays}
                style={{
                  border: areAllBarangaysSelected
                    ? "none"
                    : "1px solid #c6d8ea",
                  borderRadius: "12px",
                  padding: "8px 14px",
                  background: areAllBarangaysSelected
                    ? "linear-gradient(135deg, #2f6499 0%, #4c86be 100%)"
                    : "#f8fbfe",
                  color: areAllBarangaysSelected ? "#ffffff" : "#2a4c6f",
                  fontSize: "13px",
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                {areAllBarangaysSelected ? (
                  <FiCheckSquare size={14} />
                ) : (
                  <FiSquare size={14} />
                )}

                {areAllBarangaysSelected ? "Unselect All" : "Select All"}
              </button>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: "12px",
              }}
            >
              {barangays.map((barangay) => {
                const isLockedBarangay = lockedBarangayIds.has(barangay.id);

                return (
                  <label
                    key={barangay.id}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "8px",
                      border: "1px solid #d4dfeb",
                      borderRadius: "999px",
                      padding: "10px 14px",
                      backgroundColor: isLockedBarangay ? "#eef5fc" : "#f8fbfe",
                      color: isLockedBarangay ? "#6a87a6" : "#385a7b",
                      fontSize: "13px",
                      fontWeight: 600,
                      cursor: isLockedBarangay ? "not-allowed" : "pointer",
                      opacity: isLockedBarangay ? 0.82 : 1,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={formValues.barangay_ids.includes(barangay.id)}
                      onChange={(e) =>
                        handleBarangayToggle(barangay.id, e.target.checked)
                      }
                      disabled={isLockedBarangay}
                    />
                    {barangay.name}
                  </label>
                );
              })}
            </div>
          </section>

          {/* ACTIONS */}
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "12px",
              marginTop: "10px",
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
              {isSubmitting
                ? isEditMode
                  ? "Saving..."
                  : "Creating..."
                : isEditMode
                  ? "Save Changes"
                  : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DisasterEventFormModal;
