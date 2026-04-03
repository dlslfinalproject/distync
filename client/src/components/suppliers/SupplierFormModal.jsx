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
  contact_person: "",
  contact_number: "",
  address: "",
  has_moa: false,
  notes: "",
});

const SupplierFormModal = ({
  isOpen,
  mode,
  supplierData,
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

    if (supplierData) {
      setFormValues({
        name: supplierData.name || "",
        contact_person: supplierData.contact_person || "",
        contact_number: supplierData.contact_number || "",
        address: supplierData.address || "",
        has_moa: Boolean(supplierData.has_moa),
        notes: supplierData.notes || "",
      });
      return;
    }

    setFormValues(createDefaultForm());
  }, [isOpen, supplierData]);

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
      contact_person: formValues.contact_person.trim() || null,
      contact_number: formValues.contact_number.trim() || null,
      address: formValues.address.trim() || null,
      has_moa: formValues.has_moa,
      notes: formValues.notes.trim() || null,
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
              {mode === "edit" ? "Edit Supplier" : "Create Supplier"}
            </h3>
            <p
              style={{
                margin: "8px 0 0",
                color: "#60738a",
                fontSize: "14px",
                lineHeight: 1.6,
              }}
            >
              Maintain supplier reference data using the existing backend
              fields.
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
              <label htmlFor="supplier_name" style={labelStyles}>
                Name
              </label>
              <input
                id="supplier_name"
                type="text"
                value={formValues.name}
                onChange={(event) => handleChange("name", event.target.value)}
                style={inputStyles}
              />
            </div>

            <div>
              <label htmlFor="contact_person" style={labelStyles}>
                Contact Person
              </label>
              <input
                id="contact_person"
                type="text"
                value={formValues.contact_person}
                onChange={(event) =>
                  handleChange("contact_person", event.target.value)
                }
                style={inputStyles}
              />
            </div>

            <div>
              <label htmlFor="contact_number" style={labelStyles}>
                Contact Number
              </label>
              <input
                id="contact_number"
                type="text"
                value={formValues.contact_number}
                onChange={(event) =>
                  handleChange("contact_number", event.target.value)
                }
                style={inputStyles}
              />
            </div>

            <div style={{ gridColumn: "1 / -1" }}>
              <label htmlFor="supplier_address" style={labelStyles}>
                Address
              </label>
              <input
                id="supplier_address"
                type="text"
                value={formValues.address}
                onChange={(event) => handleChange("address", event.target.value)}
                style={inputStyles}
              />
            </div>

            <div style={{ gridColumn: "1 / -1" }}>
              <label htmlFor="supplier_notes" style={labelStyles}>
                Notes
              </label>
              <textarea
                id="supplier_notes"
                value={formValues.notes}
                onChange={(event) => handleChange("notes", event.target.value)}
                style={{ ...inputStyles, minHeight: "110px", resize: "vertical" }}
              />
            </div>
          </div>

          <div style={{ marginTop: "20px" }}>
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
                maxWidth: "220px",
              }}
            >
              <input
                type="checkbox"
                checked={formValues.has_moa}
                onChange={(event) =>
                  handleChange("has_moa", event.target.checked)
                }
              />
              Has MOA
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
                  : "Create Supplier"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SupplierFormModal;
