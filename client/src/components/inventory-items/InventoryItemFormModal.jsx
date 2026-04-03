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
  width: "min(720px, 100%)",
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
  item_code: "",
  item_name: "",
  category: "",
  unit_of_measure: "",
  barcode: "",
  is_perishable: false,
  is_active: true,
});

const InventoryItemFormModal = ({
  isOpen,
  mode,
  itemData,
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

    if (itemData) {
      setFormValues({
        item_code: itemData.item_code || "",
        item_name: itemData.item_name || "",
        category: itemData.category || "",
        unit_of_measure: itemData.unit_of_measure || "",
        barcode: itemData.barcode || "",
        is_perishable: Boolean(itemData.is_perishable),
        is_active:
          typeof itemData.is_active === "boolean" ? itemData.is_active : true,
      });
      return;
    }

    setFormValues(createDefaultForm());
  }, [isOpen, itemData]);

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
      item_code: formValues.item_code.trim(),
      item_name: formValues.item_name.trim(),
      category: formValues.category.trim(),
      unit_of_measure: formValues.unit_of_measure.trim(),
      barcode: formValues.barcode.trim() || null,
      is_perishable: formValues.is_perishable,
      is_active: formValues.is_active,
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
              {mode === "edit" ? "Edit Inventory Item" : "Create Inventory Item"}
            </h3>
            <p
              style={{
                margin: "8px 0 0",
                color: "#60738a",
                fontSize: "14px",
                lineHeight: 1.6,
              }}
            >
              Enter the inventory item details using the existing backend fields.
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
              <label htmlFor="item_code" style={labelStyles}>
                Item Code
              </label>
              <input
                id="item_code"
                type="text"
                value={formValues.item_code}
                onChange={(event) => handleChange("item_code", event.target.value)}
                style={inputStyles}
              />
            </div>

            <div>
              <label htmlFor="item_name" style={labelStyles}>
                Item Name
              </label>
              <input
                id="item_name"
                type="text"
                value={formValues.item_name}
                onChange={(event) => handleChange("item_name", event.target.value)}
                style={inputStyles}
              />
            </div>

            <div>
              <label htmlFor="category" style={labelStyles}>
                Category
              </label>
              <input
                id="category"
                type="text"
                value={formValues.category}
                onChange={(event) => handleChange("category", event.target.value)}
                style={inputStyles}
              />
            </div>

            <div>
              <label htmlFor="unit_of_measure" style={labelStyles}>
                Unit of Measure
              </label>
              <input
                id="unit_of_measure"
                type="text"
                value={formValues.unit_of_measure}
                onChange={(event) =>
                  handleChange("unit_of_measure", event.target.value)
                }
                style={inputStyles}
              />
            </div>

            <div style={{ gridColumn: "1 / -1" }}>
              <label htmlFor="barcode" style={labelStyles}>
                Barcode
              </label>
              <input
                id="barcode"
                type="text"
                value={formValues.barcode}
                onChange={(event) => handleChange("barcode", event.target.value)}
                style={inputStyles}
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
                checked={formValues.is_perishable}
                onChange={(event) =>
                  handleChange("is_perishable", event.target.checked)
                }
              />
              Perishable
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
                  : "Create Item"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default InventoryItemFormModal;
