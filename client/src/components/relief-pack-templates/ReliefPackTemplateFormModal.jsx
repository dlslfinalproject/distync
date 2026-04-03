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
  width: "min(760px, 100%)",
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
  name: "",
  description: "",
  based_on_family_size: false,
  based_on_sector: false,
  is_active: true,
});

const ReliefPackTemplateFormModal = ({
  isOpen,
  mode,
  templateData,
  isSubmitting,
  errorMessage,
  onClose,
  onSubmit,
}) => {
  const [formValues, setFormValues] = useState(createDefaultForm());

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    if (templateData) {
      setFormValues({
        name: templateData.name || "",
        description: templateData.description || "",
        based_on_family_size: Boolean(templateData.based_on_family_size),
        based_on_sector: Boolean(templateData.based_on_sector),
        is_active:
          typeof templateData.is_active === "boolean"
            ? templateData.is_active
            : true,
      });
      return;
    }

    setFormValues(createDefaultForm());
  }, [isOpen, templateData]);

  if (!isOpen) {
    return null;
  }

  const handleChange = (fieldName, value) => {
    setFormValues((currentValues) => ({
      ...currentValues,
      [fieldName]: value,
    }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    onSubmit({
      name: formValues.name.trim(),
      description: formValues.description.trim() || null,
      based_on_family_size: formValues.based_on_family_size,
      based_on_sector: formValues.based_on_sector,
      created_by: null,
      is_active: formValues.is_active,
      items: [],
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
              {mode === "edit"
                ? "Edit Relief Pack Template"
                : "Create Relief Pack Template"}
            </h3>
            <p
              style={{
                margin: "8px 0 0",
                color: "#60738a",
                fontSize: "14px",
                lineHeight: 1.6,
              }}
            >
              Update template header details first, then manage the full item list
              in the template detail panel.
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
            <div style={{ gridColumn: "1 / -1" }}>
              <label htmlFor="template_name" style={labelStyles}>
                Name
              </label>
              <input
                id="template_name"
                type="text"
                value={formValues.name}
                onChange={(event) => handleChange("name", event.target.value)}
                style={inputStyles}
              />
            </div>

            <div style={{ gridColumn: "1 / -1" }}>
              <label htmlFor="template_description" style={labelStyles}>
                Description
              </label>
              <textarea
                id="template_description"
                value={formValues.description}
                onChange={(event) =>
                  handleChange("description", event.target.value)
                }
                style={{ ...inputStyles, minHeight: "110px", resize: "vertical" }}
              />
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "18px",
              marginTop: "20px",
            }}
          >
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "14px 16px",
                borderRadius: "14px",
                border: "1px solid #d7e2ef",
                color: "#21405f",
                fontWeight: 600,
              }}
            >
              <input
                type="checkbox"
                checked={formValues.based_on_family_size}
                onChange={(event) =>
                  handleChange("based_on_family_size", event.target.checked)
                }
              />
              Based on Family Size
            </label>

            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "14px 16px",
                borderRadius: "14px",
                border: "1px solid #d7e2ef",
                color: "#21405f",
                fontWeight: 600,
              }}
            >
              <input
                type="checkbox"
                checked={formValues.based_on_sector}
                onChange={(event) =>
                  handleChange("based_on_sector", event.target.checked)
                }
              />
              Based on Sector
            </label>

            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "14px 16px",
                borderRadius: "14px",
                border: "1px solid #d7e2ef",
                color: "#21405f",
                fontWeight: 600,
              }}
            >
              <input
                type="checkbox"
                checked={formValues.is_active}
                onChange={(event) =>
                  handleChange("is_active", event.target.checked)
                }
              />
              Active
            </label>
          </div>

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
              {isSubmitting
                ? mode === "edit"
                  ? "Saving..."
                  : "Creating..."
                : mode === "edit"
                  ? "Save Changes"
                  : "Create Template"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ReliefPackTemplateFormModal;
